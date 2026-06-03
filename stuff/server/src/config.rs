use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub network_name: String,
    pub server_port:  u16,
    pub web_port:     u16,
    pub upload_dir:   String,
    pub data_dir:     String,
    pub max_upload_mb: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            network_name:  "My CatsMap Network".to_string(),
            server_port:   3001,
            web_port:      3000,
            upload_dir:    "./uploads".to_string(),
            data_dir:      "./data".to_string(),
            max_upload_mb: 100,
        }
    }
}

impl ServerConfig {
    /// Load from CATSMAP_CONFIG env var path, or /etc/catsmap/config.json, or defaults.
    pub fn load() -> Self {
        let paths = [
            std::env::var("CATSMAP_CONFIG").unwrap_or_default(),
            "/etc/catsmap/config.json".to_string(),
            "./config.json".to_string(),
        ];

        for path_str in &paths {
            if path_str.is_empty() { continue }
            let path = Path::new(path_str);
            if path.exists() {
                match std::fs::read_to_string(path) {
                    Ok(content) => match serde_json::from_str::<ServerConfig>(&content) {
                        Ok(cfg) => {
                            tracing::info!("Loaded config from {}", path_str);
                            return cfg;
                        }
                        Err(e) => tracing::warn!("Bad config at {}: {}", path_str, e),
                    },
                    Err(e) => tracing::warn!("Can't read {}: {}", path_str, e),
                }
            }
        }

        tracing::info!("Using default configuration");
        Self::default()
    }
}
