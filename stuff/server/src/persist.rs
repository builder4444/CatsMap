use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::models::{Channel, Message, CustomEmoji};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedState {
    pub network_id: String,
    pub network_name: String,
    pub channels: Vec<Channel>,
    pub messages: HashMap<String, Vec<Message>>,
    pub pinned: HashMap<String, Vec<String>>,
    pub custom_emojis: Vec<CustomEmoji>,
}

impl PersistedState {
    pub fn save(&self, data_dir: &str) {
        let path = format!("{}/state.json", data_dir);
        let tmp = format!("{}/state.json.tmp", data_dir);
        match serde_json::to_string(self) {
            Ok(json) => {
                if std::fs::write(&tmp, &json).is_ok() {
                    if let Err(e) = std::fs::rename(&tmp, &path) {
                        tracing::warn!("Failed to rename state file: {}", e);
                    } else {
                        tracing::info!("💾 State saved ({} channels, {} msg maps)",
                            self.channels.len(),
                            self.messages.len());
                    }
                } else {
                    tracing::warn!("Failed to write tmp state file");
                }
            }
            Err(e) => tracing::warn!("Failed to serialize state: {}", e),
        }
    }

    pub fn load(data_dir: &str) -> Option<Self> {
        let path = format!("{}/state.json", data_dir);
        if !std::path::Path::new(&path).exists() {
            return None;
        }
        match std::fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<PersistedState>(&content) {
                Ok(state) => {
                    tracing::info!("📂 Loaded saved state: {} channels, {} msg maps",
                        state.channels.len(), state.messages.len());
                    Some(state)
                }
                Err(e) => {
                    tracing::warn!("Failed to parse saved state, starting fresh: {}", e);
                    None
                }
            },
            Err(e) => {
                tracing::warn!("Failed to read state file: {}", e);
                None
            }
        }
    }
}
