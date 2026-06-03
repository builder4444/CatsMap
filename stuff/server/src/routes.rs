use axum::{
    extract::{State, Path, Multipart},
    response::Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use tokio::sync::broadcast;

use crate::state::{AppState, ConnectedUser};
use crate::models::{User, Message, WsServerMessage, UserStatus, ChannelPermissions, CustomEmoji, ReplyPreview, parse_mentions};
use crate::share_code::generate_code;

// ── Cat avatars & colors ──────────────────────────────────────────────────────

const CAT_EMOJIS: &[&str] = &["🐱","😸","😹","😺","😻","😼","😽","🙀","😿","😾","🐈","🐈‍⬛"];
const USER_COLORS: &[&str] = &[
    "#f472b6","#a78bfa","#34d399","#60a5fa","#fb923c",
    "#e879f9","#22d3ee","#f87171","#facc15","#a3e635",
];

fn random_cat_emoji() -> String {
    let idx = (uuid::Uuid::new_v4().as_u128() as usize) % CAT_EMOJIS.len();
    CAT_EMOJIS[idx].to_string()
}

fn random_color() -> String {
    let idx = (uuid::Uuid::new_v4().as_u128() as usize) % USER_COLORS.len();
    USER_COLORS[idx].to_string()
}

// ── Login ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub user: User,
    pub network_id: String,
    pub network_name: String,
    pub channels: Vec<crate::models::Channel>,
    pub is_admin: bool,
    pub custom_emojis: Vec<CustomEmoji>,
}

fn account_to_user(account: &crate::auth::Account, network_id: &str, color: String) -> User {
    User {
        id: account.id.clone(),
        username: account.display_name.clone(),
        avatar_emoji: account.avatar_emoji.clone(),
        color,
        network_id: network_id.to_string(),
        is_admin: account.is_admin,
        status: UserStatus::Online,
        bio: account.bio.clone(),
        custom_status: account.custom_status.clone(),
    }
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let account = state.accounts.verify(&req.username, &req.password)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Disconnect existing session for same account
    if state.connected_users.contains_key(&account.id) {
        if let Some((_, conn)) = state.connected_users.remove(&account.id) {
            let kicked = WsServerMessage::Kicked {
                reason: "Logged in from another device".to_string(),
            };
            if let Ok(json) = serde_json::to_string(&kicked) {
                let _ = conn.tx.send(json);
            }
        }
    }

    let user = account_to_user(&account, &state.network_id, random_color());

    if account.is_admin {
        state.set_admin(&user.id);
    }

    let (tx, _rx) = broadcast::channel::<String>(256);
    state.connected_users.insert(user.id.clone(), ConnectedUser {
        user: user.clone(),
        tx,
        ws_connected: false,
        last_message_at: std::time::Instant::now(),
        message_count_window: 0,
    });

    let joined_msg = WsServerMessage::UserJoined { user: user.clone() };
    if let Ok(json) = serde_json::to_string(&joined_msg) {
        state.broadcast_except(&json, &user.id);
    }

    for channel in state.channels.iter() {
        let sys = Message::new_system(
            &channel.id,
            &format!("{} {} joined the network 🐾", user.avatar_emoji, user.username),
            &state.network_id,
        );
        state.store_message(sys);
    }

    let mut channels: Vec<_> = state.channels.iter().map(|e| e.value().clone()).collect();
    channels.sort_by(|a, b| a.name.cmp(&b.name));

    let custom_emojis = state.custom_emojis.lock().unwrap().clone();

    Ok(Json(LoginResponse {
        user: user.clone(),
        network_id: state.network_id.clone(),
        network_name: state.get_network_name(),
        channels,
        is_admin: account.is_admin,
        custom_emojis,
    }))
}

// ── Rejoin (session restore after page reload) ────────────────────────────────

#[derive(Deserialize)]
pub struct RejoinRequest {
    pub user_id: String,
}

#[derive(Serialize)]
pub struct RejoinResponse {
    pub found: bool,
    pub user: Option<User>,
    pub network_id: String,
    pub network_name: String,
    pub channels: Vec<crate::models::Channel>,
}

pub async fn rejoin_network(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RejoinRequest>,
) -> Json<RejoinResponse> {
    let user = state.connected_users.get(&req.user_id)
        .map(|e| e.value().user.clone());

    let mut channels: Vec<_> = state.channels.iter().map(|e| e.value().clone()).collect();
    channels.sort_by(|a, b| a.name.cmp(&b.name));

    Json(RejoinResponse {
        found: user.is_some(),
        user,
        network_id: state.network_id.clone(),
        network_name: state.get_network_name(),
        channels,
    })
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RenameNetworkRequest {
    pub requester_id: String,
    pub name: String,
}

pub async fn admin_rename_network(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RenameNetworkRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    let name = req.name.trim().to_string();
    if name.is_empty() || name.len() > 40 { return Err(StatusCode::BAD_REQUEST); }
    state.set_network_name(&name);
    let sys = WsServerMessage::NetworkRenamed { name: name.clone() };
    if let Ok(json) = serde_json::to_string(&sys) { state.broadcast(&json); }
    Ok(Json(serde_json::json!({ "ok": true, "name": name })))
}

#[derive(Deserialize)]
pub struct KickRequest { pub requester_id: String, pub target_id: String }

pub async fn admin_kick_user(
    State(state): State<Arc<AppState>>,
    Json(req): Json<KickRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    if req.target_id == req.requester_id  { return Err(StatusCode::BAD_REQUEST); }
    if let Some((_, conn)) = state.connected_users.remove(&req.target_id) {
        let kicked = WsServerMessage::Kicked { reason: "You were removed by an admin 🙀".to_string() };
        if let Ok(json) = serde_json::to_string(&kicked) { let _ = conn.tx.send(json); }
        let left = WsServerMessage::UserLeft { user_id: req.target_id.clone(), username: conn.user.username.clone() };
        if let Ok(json) = serde_json::to_string(&left) { state.broadcast(&json); }
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct PromoteRequest { pub requester_id: String, pub target_id: String }

pub async fn admin_promote_user(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PromoteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    state.set_admin(&req.target_id);
    if let Some(mut entry) = state.connected_users.get_mut(&req.target_id) {
        entry.value_mut().user.is_admin = true;
    }
    let ev = WsServerMessage::UserPromoted { user_id: req.target_id.clone() };
    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn admin_demote_user(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PromoteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    if req.target_id == req.requester_id  { return Err(StatusCode::BAD_REQUEST); }
    state.revoke_admin(&req.target_id);
    if let Some(mut entry) = state.connected_users.get_mut(&req.target_id) {
        entry.value_mut().user.is_admin = false;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct CreateChannelRequest {
    pub requester_id: String,
    pub name:         String,
    pub description:  Option<String>,
    pub category:     Option<String>,
    pub read_only:    Option<bool>,
    pub admin_only:   Option<bool>,
}

pub async fn admin_create_channel(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateChannelRequest>,
) -> Result<Json<crate::models::Channel>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    let name = req.name.trim().to_lowercase()
        .chars().filter(|c| c.is_alphanumeric() || *c == '-').collect::<String>();
    if name.is_empty() || name.len() > 32 { return Err(StatusCode::BAD_REQUEST); }
    let ch = crate::models::Channel {
        id: Uuid::new_v4().to_string(), name,
        description: req.description.unwrap_or_default(),
        network_id: state.network_id.clone(),
        category: req.category.filter(|c| !c.is_empty()),
        permissions: ChannelPermissions {
            read_only: req.read_only.unwrap_or(false),
            admin_only: req.admin_only.unwrap_or(false),
        },
    };
    state.channels.insert(ch.id.clone(), ch.clone());
    let ev = WsServerMessage::ChannelCreated { channel: ch.clone() };
    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
    Ok(Json(ch))
}

#[derive(Deserialize)]
pub struct DeleteChannelRequest { pub requester_id: String }

pub async fn admin_delete_channel(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
    Json(req): Json<DeleteChannelRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    if state.channels.len() <= 1 { return Err(StatusCode::BAD_REQUEST); }
    state.channels.remove(&channel_id);
    let ev = WsServerMessage::ChannelDeleted { channel_id: channel_id.clone() };
    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Channels ──────────────────────────────────────────────────────────────────

pub async fn list_channels(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::models::Channel>> {
    let mut channels: Vec<_> = state.channels.iter().map(|e| e.value().clone()).collect();
    channels.sort_by(|a, b| a.name.cmp(&b.name));
    Json(channels)
}

// ── Messages ─────────────────────────────────────────────────────────────────

pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
) -> Json<Vec<Message>> {
    Json(state.get_messages(&channel_id))
}

// ── File upload ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
}

pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, String)> {
    while let Some(field) = multipart.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? 
    {
        let original_name = field.file_name()
            .unwrap_or("upload.bin")
            .to_string();

        let data = field.bytes().await
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
        let size = data.len() as u64;

        if size == 0 {
            return Err((StatusCode::BAD_REQUEST, "Empty file".to_string()));
        }
        
        // Use configured max upload size from state (loaded from config)
        let max_size = state.max_upload_size;
        if size > max_size {
            return Err((StatusCode::PAYLOAD_TOO_LARGE, 
                format!("File too large (max {}MB)", max_size / 1024 / 1024)));
        }

        // Build a safe unique filename: <uuid>.<original_ext>
        // Keep only the extension from the original name, nothing else
        let ext = std::path::Path::new(&original_name)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .filter(|e| e.chars().all(|c| c.is_alphanumeric() || c == '_') && e.len() <= 20)
            .unwrap_or_else(|| "bin".to_string());

        let unique_name = format!("{}.{}", Uuid::new_v4(), ext);
        let path = format!("{}/{}", state.upload_dir, unique_name);

        tokio::fs::write(&path, &data).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, 
                format!("Failed to save file: {}", e)))?;

        let mime_type = mime_guess::from_path(&original_name)
            .first_or_octet_stream()
            .to_string();

        tracing::info!("Uploaded: {} → {} ({} bytes)", original_name, unique_name, size);

        return Ok(Json(UploadResponse {
            url: format!("/files/{}", unique_name),
            filename: original_name,
            mime_type,
            size,
        }));
    }
    Err((StatusCode::BAD_REQUEST, "No file field in request".to_string()))
}


pub async fn serve_file(
    State(state): State<Arc<AppState>>,
    Path(filename): Path<String>,
) -> Result<axum::response::Response, StatusCode> {
    use axum::body::Body;
    use axum::http::{header, Response};

    // Only allow safe filenames: UUID.ext pattern
    // Reject anything with path separators or suspicious chars
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(StatusCode::BAD_REQUEST);
    }
    // Allow only alphanumeric, hyphens, and dots
    let safe: String = filename.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '.')
        .collect();
    if safe != filename || safe.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let path = format!("{}/{}", state.upload_dir, safe);
    let data = tokio::fs::read(&path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    let mime = mime_guess::from_path(&safe).first_or_octet_stream().to_string();

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, &mime)
        .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
        .body(Body::from(data))
        .unwrap())
}

// ── Share Codes ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ShareCodeResponse {
    pub code: String,
    pub network_id: String,
}

pub async fn generate_share_code(
    State(state): State<Arc<AppState>>,
) -> Json<ShareCodeResponse> {
    let code = generate_code();
    state.share_codes.insert(code.clone(), state.network_id.clone());
    Json(ShareCodeResponse {
        code,
        network_id: state.network_id.clone(),
    })
}

#[derive(Deserialize)]
pub struct ConnectShareCodeRequest {
    pub code: String,
    pub remote_url: String,
}

#[derive(Serialize)]
pub struct ConnectShareCodeResponse {
    pub success: bool,
    pub message: String,
}

pub async fn connect_share_code(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConnectShareCodeRequest>,
) -> Json<ConnectShareCodeResponse> {
    // Store the bridge (in production you'd verify the remote code too)
    state.bridged_networks.insert(req.code.clone(), req.remote_url.clone());

    let bridge_msg = WsServerMessage::NetworkBridged {
        network_name: req.remote_url.clone(),
    };
    if let Ok(json) = serde_json::to_string(&bridge_msg) {
        state.broadcast(&json);
    }

    Json(ConnectShareCodeResponse {
        success: true,
        message: format!("Network bridged via code {}! Cross-network chat is now active 🌉", req.code),
    })
}

// ── Network Info ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct NetworkInfo {
    pub network_id: String,
    pub network_name: String,
    pub user_count: usize,
    pub channel_count: usize,
    pub bridged_count: usize,
}

pub async fn network_info(
    State(state): State<Arc<AppState>>,
) -> Json<NetworkInfo> {
    Json(NetworkInfo {
        network_id: state.network_id.clone(),
        network_name: state.get_network_name(),
        user_count: state.connected_users.len(),
        channel_count: state.channels.len(),
        bridged_count: state.bridged_networks.len(),
    })
}

#[derive(Serialize)]
pub struct OnlineUser {
    pub id: String,
    pub username: String,
    pub avatar_emoji: String,
    pub color: String,
    pub is_admin: bool,
    pub status: UserStatus,
    pub custom_status: String,
}

pub async fn online_users(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<OnlineUser>> {
    let users: Vec<OnlineUser> = state.connected_users.iter().map(|e| {
        let u = &e.value().user;
        OnlineUser {
            id: u.id.clone(),
            username: u.username.clone(),
            avatar_emoji: u.avatar_emoji.clone(),
            color: u.color.clone(),
            is_admin: u.is_admin,
            status: u.status.clone(),
            custom_status: u.custom_status.clone(),
        }
    }).collect();
    Json(users)
}

#[derive(Deserialize)]
pub struct BridgeMessageRequest {
    pub code: String,
    pub channel_name: String,
    pub message: Message,
}

pub async fn post_bridge_message(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BridgeMessageRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.share_codes.contains_key(&req.code) {
        return Err(StatusCode::FORBIDDEN);
    }

    let local_channel = state.channels.iter().find(|entry| {
        entry.value().name.to_lowercase() == req.channel_name.to_lowercase()
    });

    if let Some(channel_ref) = local_channel {
        let channel = channel_ref.value();
        let mut msg = req.message;
        msg.channel_id = channel.id.clone();

        state.store_message(msg.clone());

        let ev = WsServerMessage::NewMessage { message: msg };
        if let Ok(json) = serde_json::to_string(&ev) {
            state.broadcast(&json);
        }

        Ok(Json(serde_json::json!({ "ok": true })))
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

// ── Search ────────────────────────────────────────────────────────────────────

pub async fn search_messages(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
) -> Json<Vec<Message>> {
    let q = params.get("q").map(|s| s.as_str()).unwrap_or("");
    let limit: usize = params.get("limit").and_then(|s| s.parse().ok()).unwrap_or(50);
    Json(state.search_messages(q, limit))
}

// ── Pinned messages ───────────────────────────────────────────────────────────

pub async fn get_pinned_messages(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
) -> Json<Vec<Message>> {
    Json(state.get_pinned(&channel_id))
}

#[derive(Deserialize)]
pub struct PinRequest {
    pub requester_id: String,
    pub channel_id: String,
    pub message_id: String,
}

pub async fn admin_pin_message(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PinRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    if !state.pin_message(&req.channel_id, &req.message_id) {
        return Err(StatusCode::NOT_FOUND);
    }
    let pinned = state.get_pinned(&req.channel_id);
    let ev = WsServerMessage::PinnedMessages {
        channel_id: req.channel_id.clone(),
        messages: pinned,
    };
    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn admin_unpin_message(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PinRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    state.unpin_message(&req.channel_id, &req.message_id);
    let pinned = state.get_pinned(&req.channel_id);
    let ev = WsServerMessage::PinnedMessages {
        channel_id: req.channel_id.clone(),
        messages: pinned,
    };
    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Export ────────────────────────────────────────────────────────────────────

pub async fn export_channel(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
) -> Result<axum::response::Response, StatusCode> {
    use axum::http::{header, Response};
    use axum::body::Body;

    let format = params.get("format").map(|s| s.as_str()).unwrap_or("json");
    let messages = state.get_messages(&channel_id);

    let body = if format == "txt" {
        let mut lines = Vec::new();
        for m in &messages {
            if m.deleted { continue; }
            lines.push(format!(
                "[{}] {}: {}",
                m.timestamp.to_rfc3339(),
                m.author_name,
                m.content
            ));
        }
        lines.join("\n")
    } else {
        serde_json::to_string_pretty(&messages).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let content_type = if format == "txt" { "text/plain" } else { "application/json" };
    Ok(Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, "attachment")
        .body(Body::from(body))
        .unwrap())
}

// ── Account management ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AdminRequest { pub requester_id: String }

pub async fn admin_list_accounts(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(req): axum::extract::Query<AdminRequest>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    let list: Vec<_> = state.accounts.list_accounts().iter().map(|a| {
        serde_json::json!({
            "id": a.id,
            "username": a.username,
            "display_name": a.display_name,
            "avatar_emoji": a.avatar_emoji,
            "is_admin": a.is_admin,
        })
    }).collect();
    Ok(Json(list))
}

#[derive(Deserialize)]
pub struct CreateAccountRequest {
    pub requester_id: String,
    pub username: String,
    pub password: String,
    pub display_name: Option<String>,
    pub avatar_emoji: Option<String>,
    pub is_admin: Option<bool>,
}

pub async fn admin_create_account(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateAccountRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    let acc = state.accounts.create_account(
        &req.username,
        &req.password,
        req.display_name.as_deref().unwrap_or(&req.username),
        req.avatar_emoji.as_deref().unwrap_or("🐱"),
        req.is_admin.unwrap_or(false),
    ).map_err(|e| {
        tracing::warn!("Create account failed: {}", e);
        StatusCode::BAD_REQUEST
    })?;
    Ok(Json(serde_json::json!({
        "id": acc.id,
        "username": acc.username,
        "display_name": acc.display_name,
        "is_admin": acc.is_admin,
    })))
}

pub async fn admin_delete_account(
    State(state): State<Arc<AppState>>,
    Path(account_id): Path<String>,
    Json(req): Json<AdminRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    state.accounts.delete_account(&account_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    if let Some((_, conn)) = state.connected_users.remove(&account_id) {
        let kicked = WsServerMessage::Kicked { reason: "Account deleted".to_string() };
        if let Ok(json) = serde_json::to_string(&kicked) { let _ = conn.tx.send(json); }
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub requester_id: String,
    pub new_password: String,
}

pub async fn admin_reset_password(
    State(state): State<Arc<AppState>>,
    Path(account_id): Path<String>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    state.accounts.set_password(&account_id, &req.new_password)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Profile ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub user_id: String,
    pub display_name: Option<String>,
    pub avatar_emoji: Option<String>,
    pub bio: Option<String>,
    pub custom_status: Option<String>,
}

pub async fn update_profile(
    State(state): State<Arc<AppState>>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let acc = state.accounts.update_profile(
        &req.user_id,
        req.display_name.as_deref(),
        req.avatar_emoji.as_deref(),
        req.bio.as_deref(),
        req.custom_status.as_deref(),
    ).map_err(|_| StatusCode::BAD_REQUEST)?;

    if let Some(mut entry) = state.connected_users.get_mut(&req.user_id) {
        entry.user.username = acc.display_name.clone();
        entry.user.avatar_emoji = acc.avatar_emoji.clone();
        entry.user.bio = acc.bio.clone();
        entry.user.custom_status = acc.custom_status.clone();
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Custom emojis ─────────────────────────────────────────────────────────────

pub async fn list_custom_emojis(State(state): State<Arc<AppState>>) -> Json<Vec<CustomEmoji>> {
    Json(state.custom_emojis.lock().unwrap().clone())
}

#[derive(Deserialize)]
pub struct AddEmojiRequest {
    pub requester_id: String,
    pub name: String,
    pub url: String,
}

pub async fn admin_add_custom_emoji(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AddEmojiRequest>,
) -> Result<Json<CustomEmoji>, StatusCode> {
    if !state.is_admin(&req.requester_id) { return Err(StatusCode::FORBIDDEN); }
    let emoji = CustomEmoji {
        id: Uuid::new_v4().to_string(),
        name: req.name.trim().to_string(),
        url: req.url,
    };
    state.custom_emojis.lock().unwrap().push(emoji.clone());
    let ev = WsServerMessage::CustomEmojisUpdated {
        emojis: state.custom_emojis.lock().unwrap().clone(),
    };
    if let Ok(json) = serde_json::to_string(&ev) { state.broadcast(&json); }
    Ok(Json(emoji))
}

