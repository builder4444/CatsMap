use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UserStatus {
    Online,
    Away,
    Busy,
    Offline,
}

impl Default for UserStatus {
    fn default() -> Self { UserStatus::Online }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub avatar_emoji: String,
    pub color: String,
    pub network_id: String,
    pub is_admin: bool,
    pub status: UserStatus,
    pub bio: String,
    pub custom_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelPermissions {
    pub read_only: bool,
    pub admin_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub network_id: String,
    pub category: Option<String>,
    pub permissions: ChannelPermissions,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Text,
    Image,
    Video,
    File,
    Audio,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub url: String,
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyPreview {
    pub id: String,
    pub author_name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub emoji: String,
    pub user_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub author_id: String,
    pub author_name: String,
    pub author_emoji: String,
    pub author_color: String,
    pub content: String,
    pub message_type: MessageType,
    pub attachment: Option<Attachment>,
    pub timestamp: DateTime<Utc>,
    pub edited: bool,
    pub deleted: bool,
    pub network_id: String,
    pub author_network_name: Option<String>,
    pub reply_to_id: Option<String>,
    pub reply_preview: Option<ReplyPreview>,
    pub reactions: Vec<Reaction>,
    pub pinned: bool,
    pub thread_parent_id: Option<String>,
    pub mentions: Vec<String>,
    pub forwarded_from: Option<String>,
}

impl Message {
    pub fn new_text(channel_id: &str, author: &User, content: &str, network_id: &str) -> Self {
        Self::new_text_with_opts(channel_id, author, content, network_id, None, None, vec![])
    }

    pub fn new_text_with_opts(
        channel_id: &str,
        author: &User,
        content: &str,
        network_id: &str,
        reply_to_id: Option<String>,
        reply_preview: Option<ReplyPreview>,
        mentions: Vec<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            channel_id: channel_id.to_string(),
            author_id: author.id.clone(),
            author_name: author.username.clone(),
            author_emoji: author.avatar_emoji.clone(),
            author_color: author.color.clone(),
            content: content.to_string(),
            message_type: MessageType::Text,
            attachment: None,
            timestamp: Utc::now(),
            edited: false,
            deleted: false,
            network_id: network_id.to_string(),
            author_network_name: Some(author.network_id.clone()),
            reply_to_id,
            reply_preview,
            reactions: vec![],
            pinned: false,
            thread_parent_id: None,
            mentions,
            forwarded_from: None,
        }
    }

    pub fn new_system(channel_id: &str, content: &str, network_id: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            channel_id: channel_id.to_string(),
            author_id: "system".to_string(),
            author_name: "CatsMap".to_string(),
            author_emoji: "🐱".to_string(),
            author_color: "#a855f7".to_string(),
            content: content.to_string(),
            message_type: MessageType::System,
            attachment: None,
            timestamp: Utc::now(),
            edited: false,
            deleted: false,
            network_id: network_id.to_string(),
            author_network_name: None,
            reply_to_id: None,
            reply_preview: None,
            reactions: vec![],
            pinned: false,
            thread_parent_id: None,
            mentions: vec![],
            forwarded_from: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomEmoji {
    pub id: String,
    pub name: String,
    pub url: String,
}

// WebSocket message envelopes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsClientMessage {
    SendMessage {
        channel_id: String,
        content: String,
        attachment: Option<Attachment>,
        message_type: MessageType,
        reply_to_id: Option<String>,
        thread_parent_id: Option<String>,
        forward_from_channel: Option<String>,
        forward_message_id: Option<String>,
    },
    EditMessage {
        message_id: String,
        channel_id: String,
        content: String,
    },
    DeleteMessage {
        message_id: String,
        channel_id: String,
    },
    AddReaction {
        message_id: String,
        channel_id: String,
        emoji: String,
    },
    RemoveReaction {
        message_id: String,
        channel_id: String,
        emoji: String,
    },
    MarkRead {
        channel_id: String,
        message_id: String,
    },
    SetStatus {
        status: UserStatus,
        custom_status: Option<String>,
    },
    Typing {
        channel_id: String,
    },
    StopTyping {
        channel_id: String,
    },
    DirectMessage {
        recipient_id: String,
        content: String,
        attachment: Option<Attachment>,
        reply_to_id: Option<String>,
    },
    Ping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsServerMessage {
    NewMessage {
        message: Message,
    },
    MessageUpdated {
        message: Message,
    },
    MessageDeleted {
        message_id: String,
        channel_id: String,
    },
    Mention {
        message: Message,
        mentioned_user_id: String,
    },
    UserJoined {
        user: User,
    },
    UserLeft {
        user_id: String,
        username: String,
    },
    UserStatusChanged {
        user_id: String,
        status: UserStatus,
        custom_status: String,
    },
    Typing {
        user_id: String,
        username: String,
        channel_id: String,
    },
    StopTyping {
        user_id: String,
        channel_id: String,
    },
    DirectMessage {
        message: Message,
        from_user: User,
        recipient_id: String,
    },
    ReadReceipt {
        channel_id: String,
        message_id: String,
        user_id: String,
        username: String,
    },
    PinnedMessages {
        channel_id: String,
        messages: Vec<Message>,
    },
    NetworkBridged {
        network_name: String,
    },
    NetworkRenamed {
        name: String,
    },
    Kicked {
        reason: String,
    },
    UserPromoted {
        user_id: String,
    },
    ChannelCreated {
        channel: Channel,
    },
    ChannelDeleted {
        channel_id: String,
    },
    CustomEmojisUpdated {
        emojis: Vec<CustomEmoji>,
    },
    Pong,
    Error {
        message: String,
    },
}

pub fn parse_mentions(content: &str, accounts: &[(String, String)]) -> Vec<String> {
    let mut mentions = Vec::new();
    for (username, id) in accounts {
        let pattern = format!("@{}", username);
        if content.contains(&pattern) && !mentions.contains(id) {
            mentions.push(id.clone());
        }
    }
    mentions
}

pub fn toggle_reaction(reactions: &mut Vec<Reaction>, emoji: &str, user_id: &str, add: bool) {
    if let Some(r) = reactions.iter_mut().find(|r| r.emoji == emoji) {
        if add {
            if !r.user_ids.contains(&user_id.to_string()) {
                r.user_ids.push(user_id.to_string());
            }
        } else {
            r.user_ids.retain(|id| id != user_id);
        }
        if r.user_ids.is_empty() {
            reactions.retain(|r| r.emoji != emoji);
        }
    } else if add {
        reactions.push(Reaction {
            emoji: emoji.to_string(),
            user_ids: vec![user_id.to_string()],
        });
    }
}
