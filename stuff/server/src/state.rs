use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use dashmap::DashMap;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::auth::AccountStore;
use crate::models::{User, Channel, Message, CustomEmoji, ChannelPermissions, UserStatus};

pub type Tx = broadcast::Sender<String>;

#[derive(Debug)]
pub struct ConnectedUser {
    pub user: User,
    pub tx:   Tx,
    pub ws_connected: bool,
    pub last_message_at: Instant,
    pub message_count_window: u32,
}

pub struct AppState {
    pub network_id:   String,
    pub network_name: Mutex<String>,
    pub connected_users: DashMap<String, ConnectedUser>,
    pub messages: Arc<Mutex<HashMap<String, Vec<Message>>>>,
    pub channels: DashMap<String, Channel>,
    pub share_codes: DashMap<String, String>,
    pub bridged_networks: DashMap<String, String>,
    pub admin_ids: Mutex<Vec<String>>,
    pub upload_dir: String,
    pub data_dir: String,
    pub max_upload_size: u64,
    pub accounts: Arc<AccountStore>,
    pub pinned: Arc<Mutex<HashMap<String, Vec<String>>>>,
    pub read_receipts: Arc<Mutex<HashMap<String, HashMap<String, Vec<String>>>>>,
    pub custom_emojis: Mutex<Vec<CustomEmoji>>,
    pub rate_limit_per_minute: u32,
}

#[allow(dead_code)]
impl AppState {
    pub fn new() -> Self {
        Self::new_with_config(&crate::config::ServerConfig::default(), None, None)
    }

    pub fn new_with_config(
        cfg: &crate::config::ServerConfig,
        admin_username: Option<&str>,
        admin_password: Option<&str>,
    ) -> Self {
        let network_id = Uuid::new_v4().to_string();
        let channels: DashMap<String, Channel> = DashMap::new();

        for (name, desc) in [
            ("general",   "Everyone's welcome here 🐾"),
            ("media-den", "Share videos, images & files 🎨"),
            ("random",    "Anything goes 🐱"),
        ] {
            let id = Uuid::new_v4().to_string();
            channels.insert(id.clone(), Channel {
                id,
                name: name.to_string(),
                description: desc.to_string(),
                network_id: network_id.clone(),
                category: Some("Channels".to_string()),
                permissions: ChannelPermissions::default(),
            });
        }

        let upload_dir = cfg.upload_dir.clone();
        let data_dir = cfg.data_dir.clone();
        std::fs::create_dir_all(&upload_dir).ok();
        std::fs::create_dir_all(&data_dir).ok();

        let max_upload_size = cfg.max_upload_mb * 1024 * 1024;
        let accounts = Arc::new(AccountStore::new(&data_dir));

        if let (Some(u), Some(p)) = (admin_username, admin_password) {
            if !u.is_empty() && !p.is_empty() {
                accounts.bootstrap_admin(u, p, "🐱");
            }
        }

        Self {
            network_id,
            network_name:    Mutex::new(cfg.network_name.clone()),
            connected_users: DashMap::new(),
            messages:        Arc::new(Mutex::new(HashMap::new())),
            channels,
            share_codes:     DashMap::new(),
            bridged_networks: DashMap::new(),
            admin_ids:       Mutex::new(vec![]),
            upload_dir,
            data_dir,
            max_upload_size,
            accounts,
            pinned: Arc::new(Mutex::new(HashMap::new())),
            read_receipts: Arc::new(Mutex::new(HashMap::new())),
            custom_emojis: Mutex::new(vec![]),
            rate_limit_per_minute: 30,
        }
    }

    pub fn get_network_name(&self) -> String {
        self.network_name.lock().unwrap().clone()
    }
    pub fn set_network_name(&self, name: &str) {
        *self.network_name.lock().unwrap() = name.to_string();
    }

    pub fn store_message(&self, msg: Message) {
        let mut messages = self.messages.lock().unwrap();
        let list = messages.entry(msg.channel_id.clone()).or_insert_with(Vec::new);
        list.push(msg);
        if list.len() > 500 { list.drain(0..list.len() - 500); }
    }

    pub fn get_messages(&self, channel_id: &str) -> Vec<Message> {
        self.messages.lock().unwrap().get(channel_id).cloned().unwrap_or_default()
    }

    pub fn update_message<F>(&self, channel_id: &str, message_id: &str, f: F) -> Option<Message>
    where F: FnOnce(&mut Message),
    {
        let mut messages = self.messages.lock().unwrap();
        let list = messages.get_mut(channel_id)?;
        for msg in list.iter_mut() {
            if msg.id == message_id {
                f(msg);
                return Some(msg.clone());
            }
        }
        None
    }

    pub fn find_message(&self, channel_id: &str, message_id: &str) -> Option<Message> {
        self.messages.lock().unwrap()
            .get(channel_id)?
            .iter()
            .find(|m| m.id == message_id)
            .cloned()
    }

    pub fn search_messages(&self, query: &str, limit: usize) -> Vec<Message> {
        let q = query.to_lowercase();
        if q.is_empty() { return vec![]; }
        let messages = self.messages.lock().unwrap();
        let mut results = Vec::new();
        for list in messages.values() {
            for msg in list.iter().rev() {
                if msg.deleted || msg.message_type == crate::models::MessageType::System {
                    continue;
                }
                if msg.content.to_lowercase().contains(&q)
                    || msg.author_name.to_lowercase().contains(&q)
                {
                    results.push(msg.clone());
                    if results.len() >= limit { return results; }
                }
            }
        }
        results
    }

    pub fn get_pinned(&self, channel_id: &str) -> Vec<Message> {
        let ids = self.pinned.lock().unwrap().get(channel_id).cloned().unwrap_or_default();
        let messages = self.messages.lock().unwrap();
        let list = messages.get(channel_id).cloned().unwrap_or_default();
        ids.iter()
            .filter_map(|id| list.iter().find(|m| &m.id == id).cloned())
            .collect()
    }

    pub fn pin_message(&self, channel_id: &str, message_id: &str) -> bool {
        if self.find_message(channel_id, message_id).is_none() {
            return false;
        }
        let mut pinned = self.pinned.lock().unwrap();
        let list = pinned.entry(channel_id.to_string()).or_insert_with(Vec::new);
        if !list.contains(&message_id.to_string()) {
            list.push(message_id.to_string());
        }
        let _ = self.update_message(channel_id, message_id, |m| m.pinned = true);
        true
    }

    pub fn unpin_message(&self, channel_id: &str, message_id: &str) {
        let mut pinned = self.pinned.lock().unwrap();
        if let Some(list) = pinned.get_mut(channel_id) {
            list.retain(|id| id != message_id);
        }
        let _ = self.update_message(channel_id, message_id, |m| m.pinned = false);
    }

    pub fn mark_read(&self, channel_id: &str, message_id: &str, user_id: &str) {
        let mut receipts = self.read_receipts.lock().unwrap();
        let channel = receipts.entry(channel_id.to_string()).or_insert_with(HashMap::new);
        let readers = channel.entry(message_id.to_string()).or_insert_with(Vec::new);
        if !readers.contains(&user_id.to_string()) {
            readers.push(user_id.to_string());
        }
    }

    pub fn get_readers(&self, channel_id: &str, message_id: &str) -> Vec<String> {
        self.read_receipts.lock().unwrap()
            .get(channel_id)
            .and_then(|c| c.get(message_id))
            .cloned()
            .unwrap_or_default()
    }

    pub fn check_rate_limit(&self, user_id: &str) -> bool {
        if let Some(mut entry) = self.connected_users.get_mut(user_id) {
            let now = Instant::now();
            if now.duration_since(entry.last_message_at) > Duration::from_secs(60) {
                entry.last_message_at = now;
                entry.message_count_window = 0;
            }
            entry.message_count_window += 1;
            entry.message_count_window <= self.rate_limit_per_minute
        } else {
            true
        }
    }

    pub fn account_usernames_for_mentions(&self) -> Vec<(String, String)> {
        self.accounts.list_accounts()
            .iter()
            .map(|a| (a.username.clone(), a.id.clone()))
            .collect()
    }

    pub fn can_post_in_channel(&self, channel_id: &str, user_id: &str) -> bool {
        let channel = match self.channels.get(channel_id) {
            Some(c) => c.clone(),
            None => return false,
        };
        if channel.permissions.read_only && !self.is_admin(user_id) {
            return false;
        }
        if channel.permissions.admin_only && !self.is_admin(user_id) {
            return false;
        }
        true
    }

    pub fn broadcast(&self, json: &str) {
        for entry in self.connected_users.iter() {
            if entry.value().ws_connected {
                let _ = entry.value().tx.send(json.to_string());
            }
        }
    }

    pub fn broadcast_except(&self, json: &str, except_id: &str) {
        for entry in self.connected_users.iter() {
            if entry.key() != except_id && entry.value().ws_connected {
                let _ = entry.value().tx.send(json.to_string());
            }
        }
    }

    pub fn broadcast_to_users(&self, json: &str, user_ids: &[String]) {
        for uid in user_ids {
            if let Some(entry) = self.connected_users.get(uid) {
                if entry.ws_connected {
                    let _ = entry.value().tx.send(json.to_string());
                }
            }
        }
    }

    pub fn is_first_user(&self) -> bool {
        self.admin_ids.lock().unwrap().is_empty()
    }

    pub fn set_admin(&self, user_id: &str) {
        let mut ids = self.admin_ids.lock().unwrap();
        let s = user_id.to_string();
        if !ids.contains(&s) { ids.push(s); }
    }

    pub fn revoke_admin(&self, user_id: &str) {
        self.admin_ids.lock().unwrap().retain(|id| id != user_id);
    }

    pub fn is_admin(&self, user_id: &str) -> bool {
        self.admin_ids.lock().unwrap().contains(&user_id.to_string())
    }
}
