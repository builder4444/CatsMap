use axum::{
    extract::{State, WebSocketUpgrade, Query},
    response::Response,
};
use axum::extract::ws::{WebSocket, Message as WsMessage};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};

use crate::state::AppState;
use crate::models::{
    WsClientMessage, WsServerMessage, Message, ReplyPreview,
    parse_mentions, toggle_reaction,
};

#[derive(Deserialize)]
pub struct WsQuery {
    pub user_id: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let user_id = params.user_id;
    ws.on_upgrade(move |socket| handle_socket(socket, user_id, state))
}

fn build_message(
    state: &AppState,
    user: &crate::models::User,
    channel_id: &str,
    content: String,
    message_type: crate::models::MessageType,
    attachment: Option<crate::models::Attachment>,
    reply_to_id: Option<String>,
    thread_parent_id: Option<String>,
    forwarded_from: Option<String>,
) -> Message {
    let reply_preview = reply_to_id.as_ref().and_then(|id| {
        state.find_message(channel_id, id).map(|m| ReplyPreview {
            id: m.id,
            author_name: m.author_name,
            content: if m.content.len() > 120 {
                format!("{}...", &m.content[..120])
            } else {
                m.content
            },
        })
    });

    let mention_accounts = state.account_usernames_for_mentions();
    let mentions = parse_mentions(&content, &mention_accounts);

    Message {
        id: uuid::Uuid::new_v4().to_string(),
        channel_id: channel_id.to_string(),
        author_id: user.id.clone(),
        author_name: user.username.clone(),
        author_emoji: user.avatar_emoji.clone(),
        author_color: user.color.clone(),
        content,
        message_type,
        attachment,
        timestamp: chrono::Utc::now(),
        edited: false,
        deleted: false,
        network_id: state.network_id.clone(),
        author_network_name: Some(state.get_network_name()),
        reply_to_id,
        reply_preview,
        reactions: vec![],
        pinned: false,
        thread_parent_id,
        mentions,
        forwarded_from,
    }
}

async fn handle_socket(socket: WebSocket, user_id: String, state: Arc<AppState>) {
    if !state.connected_users.contains_key(&user_id) {
        tracing::warn!("WS rejected: unknown user_id {}", user_id);
        return;
    }

    let (tx, _seed_rx) = broadcast::channel::<String>(256);

    {
        let mut entry = state.connected_users.get_mut(&user_id).unwrap();
        entry.tx = tx.clone();
        entry.ws_connected = true;
    }

    let mut rx = tx.subscribe();
    let (mut ws_tx, mut ws_rx) = socket.split();

    tracing::debug!("WS connected: {}", user_id);

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if ws_tx.send(WsMessage::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let state_recv = Arc::clone(&state);
    let uid = user_id.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(result) = ws_rx.next().await {
            match result {
                Ok(WsMessage::Text(text)) => {
                    handle_client_message(&text, &uid, &state_recv).await;
                }
                Ok(WsMessage::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {}
        _ = recv_task => {}
    }

    tracing::debug!("WS closed: {} — starting grace period", user_id);

    if let Some(mut entry) = state.connected_users.get_mut(&user_id) {
        entry.ws_connected = false;
    }

    sleep(Duration::from_secs(5)).await;

    let still_disconnected = state.connected_users.get(&user_id)
        .map(|e| !e.ws_connected)
        .unwrap_or(false);

    if still_disconnected {
        tracing::debug!("WS evicting {} after grace period", user_id);

        if let Some((_, conn)) = state.connected_users.remove(&user_id) {
            let msg = WsServerMessage::UserLeft {
                user_id: user_id.clone(),
                username: conn.user.username.clone(),
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                state.broadcast(&json);
            }

            for channel in state.channels.iter() {
                let sys_msg = Message::new_system(
                    &channel.id,
                    &format!("{} {} left the network 😿", conn.user.avatar_emoji, conn.user.username),
                    &state.network_id,
                );
                state.store_message(sys_msg);
            }
        }
    }
}

async fn handle_client_message(text: &str, user_id: &str, state: &Arc<AppState>) {
    let client_msg: WsClientMessage = match serde_json::from_str(text) {
        Ok(m)  => m,
        Err(e) => {
            tracing::warn!("Bad WS message from {}: {} | raw: {}", user_id, e, text);
            return;
        }
    };

    let user = match state.connected_users.get(user_id) {
        Some(entry) => entry.value().user.clone(),
        None        => return,
    };

    match client_msg {
        WsClientMessage::SendMessage {
            channel_id, content, attachment, message_type,
            reply_to_id, thread_parent_id,
            forward_from_channel, forward_message_id,
        } => {
            if !state.channels.contains_key(&channel_id) { return; }
            if !state.can_post_in_channel(&channel_id, user_id) {
                send_error(state, user_id, "You cannot post in this channel");
                return;
            }
            if !state.check_rate_limit(user_id) {
                send_error(state, user_id, "Slow down! Rate limit exceeded");
                return;
            }

            let forwarded_from = if let (Some(ch), Some(mid)) = (forward_from_channel, forward_message_id) {
                state.find_message(&ch, &mid).map(|m| {
                    format!("{} in #{}", m.author_name, state.channels.get(&ch).map(|c| c.name.clone()).unwrap_or_default())
                })
            } else {
                None
            };

            let msg = build_message(
                state, &user, &channel_id, content, message_type, attachment,
                reply_to_id, thread_parent_id, forwarded_from,
            );

            state.store_message(msg.clone());
            broadcast_new_message(state, &msg);

            for mentioned_id in &msg.mentions {
                if mentioned_id != user_id {
                    let mention_ev = WsServerMessage::Mention {
                        message: msg.clone(),
                        mentioned_user_id: mentioned_id.clone(),
                    };
                    if let Ok(json) = serde_json::to_string(&mention_ev) {
                        state.broadcast_to_users(&json, &[mentioned_id.clone()]);
                    }
                }
            }

            bridge_message(state, &channel_id, &msg).await;
        }

        WsClientMessage::EditMessage { message_id, channel_id, content } => {
            if let Some(updated) = state.update_message(&channel_id, &message_id, |m| {
                if m.author_id == user_id {
                    m.content = content.clone();
                    m.edited = true;
                    let accounts = state.account_usernames_for_mentions();
                    m.mentions = parse_mentions(&content, &accounts);
                }
            }) {
                if updated.author_id == user_id {
                    let ev = WsServerMessage::MessageUpdated { message: updated };
                    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
                }
            }
        }

        WsClientMessage::DeleteMessage { message_id, channel_id } => {
            if let Some(updated) = state.update_message(&channel_id, &message_id, |m| {
                if m.author_id == user_id {
                    m.deleted = true;
                    m.content = "[message deleted]".to_string();
                }
            }) {
                if updated.author_id == user_id {
                    let ev = WsServerMessage::MessageDeleted {
                        message_id: message_id.clone(),
                        channel_id: channel_id.clone(),
                    };
                    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
                }
            }
        }

        WsClientMessage::AddReaction { message_id, channel_id, emoji } => {
            if let Some(updated) = state.update_message(&channel_id, &message_id, |m| {
                toggle_reaction(&mut m.reactions, &emoji, user_id, true);
            }) {
                let ev = WsServerMessage::MessageUpdated { message: updated };
                if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
            }
        }

        WsClientMessage::RemoveReaction { message_id, channel_id, emoji } => {
            if let Some(updated) = state.update_message(&channel_id, &message_id, |m| {
                toggle_reaction(&mut m.reactions, &emoji, user_id, false);
            }) {
                let ev = WsServerMessage::MessageUpdated { message: updated };
                if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
            }
        }

        WsClientMessage::MarkRead { channel_id, message_id } => {
            state.mark_read(&channel_id, &message_id, user_id);
            let ev = WsServerMessage::ReadReceipt {
                channel_id,
                message_id,
                user_id: user.id.clone(),
                username: user.username.clone(),
            };
            if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
        }

        WsClientMessage::SetStatus { status, custom_status } => {
            let custom = custom_status.unwrap_or_default();
            if let Some(mut entry) = state.connected_users.get_mut(user_id) {
                entry.user.status = status.clone();
                entry.user.custom_status = custom.clone();
                let _ = state.accounts.update_profile(user_id, None, None, None, Some(&custom));
            }
            let ev = WsServerMessage::UserStatusChanged {
                user_id: user.id.clone(),
                status,
                custom_status: custom,
            };
            if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
        }

        WsClientMessage::Typing { channel_id } => {
            let msg = WsServerMessage::Typing {
                user_id: user.id.clone(),
                username: user.username.clone(),
                channel_id,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                state.broadcast_except(&json, user_id);
            }
        }

        WsClientMessage::StopTyping { channel_id } => {
            let msg = WsServerMessage::StopTyping {
                user_id: user.id.clone(),
                channel_id,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                state.broadcast_except(&json, user_id);
            }
        }

        WsClientMessage::DirectMessage { recipient_id, content, attachment, reply_to_id } => {
            if !state.check_rate_limit(user_id) { return; }

            let message_type = attachment_type(&attachment);
            let dm_channel = format!("dm_{}_{}", user_id, recipient_id);
            let msg = build_message(
                state, &user, &dm_channel, content, message_type, attachment,
                reply_to_id, None, None,
            );
            state.store_message(msg.clone());

            let server_msg = WsServerMessage::DirectMessage {
                message: msg,
                from_user: user.clone(),
                recipient_id: recipient_id.clone(),
            };

            if let Ok(json) = serde_json::to_string(&server_msg) {
                if let Some(recipient) = state.connected_users.get(&recipient_id) {
                    let _ = recipient.value().tx.send(json.clone());
                }
                if let Some(sender) = state.connected_users.get(user_id) {
                    let _ = sender.value().tx.send(json);
                }
            }
        }

        WsClientMessage::Ping => {
            let pong = WsServerMessage::Pong;
            if let Ok(json) = serde_json::to_string(&pong) {
                if let Some(entry) = state.connected_users.get(user_id) {
                    let _ = entry.value().tx.send(json);
                }
            }
        }
    }
}

fn send_error(state: &AppState, user_id: &str, message: &str) {
    let ev = WsServerMessage::Error { message: message.to_string() };
    if let Ok(json) = serde_json::to_string(&ev) {
        if let Some(entry) = state.connected_users.get(user_id) {
            let _ = entry.value().tx.send(json);
        }
    }
}

fn attachment_type(attachment: &Option<crate::models::Attachment>) -> crate::models::MessageType {
    if let Some(att) = attachment {
        if att.mime_type.starts_with("image/") {
            crate::models::MessageType::Image
        } else if att.mime_type.starts_with("video/") {
            crate::models::MessageType::Video
        } else if att.mime_type.starts_with("audio/") {
            crate::models::MessageType::Audio
        } else {
            crate::models::MessageType::File
        }
    } else {
        crate::models::MessageType::Text
    }
}

fn broadcast_new_message(state: &AppState, msg: &Message) {
    let server_msg = WsServerMessage::NewMessage { message: msg.clone() };
    if let Ok(json) = serde_json::to_string(&server_msg) {
        state.broadcast(&json);
    }
}

async fn bridge_message(state: &AppState, channel_id: &str, msg: &Message) {
    if let Some(channel) = state.channels.get(channel_id) {
        let channel_name = channel.name.clone();
        let bridged: Vec<(String, String)> = state.bridged_networks.iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let msg = msg.clone();
        tokio::spawn(async move {
            for (code, remote_url) in bridged {
                let target_url = format!("{}/api/bridge/message", remote_url.trim_end_matches('/'));
                let payload = serde_json::json!({
                    "code": code,
                    "channel_name": channel_name,
                    "message": msg,
                });
                let _ = client.post(&target_url).json(&payload).send().await;
            }
        });
    }
}
