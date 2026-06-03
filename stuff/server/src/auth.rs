use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub display_name: String,
    pub avatar_emoji: String,
    pub is_admin: bool,
    pub bio: String,
    pub custom_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AccountsFile {
    accounts: Vec<Account>,
}

pub struct AccountStore {
    path: String,
    accounts: Mutex<HashMap<String, Account>>, // username -> account
    by_id: Mutex<HashMap<String, String>>,    // id -> username
}

impl AccountStore {
    pub fn new(data_dir: &str) -> Self {
        std::fs::create_dir_all(data_dir).ok();
        let path = format!("{}/accounts.json", data_dir);
        let store = Self {
            path,
            accounts: Mutex::new(HashMap::new()),
            by_id: Mutex::new(HashMap::new()),
        };
        store.load();
        store
    }

    fn load(&self) {
        if !Path::new(&self.path).exists() {
            return;
        }
        if let Ok(content) = std::fs::read_to_string(&self.path) {
            if let Ok(file) = serde_json::from_str::<AccountsFile>(&content) {
                let mut accounts = self.accounts.lock().unwrap();
                let mut by_id = self.by_id.lock().unwrap();
                accounts.clear();
                by_id.clear();
                for acc in file.accounts {
                    by_id.insert(acc.id.clone(), acc.username.clone());
                    accounts.insert(acc.username.to_lowercase(), acc);
                }
            }
        }
    }

    fn save(&self) {
        let accounts = self.accounts.lock().unwrap();
        let file = AccountsFile {
            accounts: accounts.values().cloned().collect(),
        };
        if let Ok(json) = serde_json::to_string_pretty(&file) {
            let _ = std::fs::write(&self.path, json);
        }
    }

    pub fn bootstrap_admin(&self, username: &str, password: &str, emoji: &str) {
        let key = username.to_lowercase();
        if self.accounts.lock().unwrap().contains_key(&key) {
            return;
        }
        let acc = Account {
            id: Uuid::new_v4().to_string(),
            username: username.to_string(),
            password_hash: hash_password(password),
            display_name: username.to_string(),
            avatar_emoji: emoji.to_string(),
            is_admin: true,
            bio: String::new(),
            custom_status: String::new(),
        };
        let id = acc.id.clone();
        let uname = acc.username.clone();
        self.accounts.lock().unwrap().insert(key, acc);
        self.by_id.lock().unwrap().insert(id, uname);
        self.save();
        tracing::info!("Bootstrap admin account: {}", username);
    }

    pub fn verify(&self, username: &str, password: &str) -> Option<Account> {
        let key = username.to_lowercase();
        let accounts = self.accounts.lock().unwrap();
        let acc = accounts.get(&key)?;
        if verify_password(password, &acc.password_hash) {
            Some(acc.clone())
        } else {
            None
        }
    }

    pub fn get_by_username(&self, username: &str) -> Option<Account> {
        self.accounts.lock().unwrap().get(&username.to_lowercase()).cloned()
    }

    pub fn get_by_id(&self, id: &str) -> Option<Account> {
        let by_id = self.by_id.lock().unwrap();
        let username = by_id.get(id)?;
        self.accounts.lock().unwrap().get(username).cloned()
    }

    pub fn list_accounts(&self) -> Vec<Account> {
        self.accounts.lock().unwrap().values().cloned().collect()
    }

    pub fn create_account(
        &self,
        username: &str,
        password: &str,
        display_name: &str,
        avatar_emoji: &str,
        is_admin: bool,
    ) -> Result<Account, String> {
        let key = username.to_lowercase();
        if username.trim().is_empty() || username.len() > 32 {
            return Err("Username must be 1-32 characters".into());
        }
        if password.len() < 4 {
            return Err("Password must be at least 4 characters".into());
        }
        let mut accounts = self.accounts.lock().unwrap();
        if accounts.contains_key(&key) {
            return Err("Username already exists".into());
        }
        let acc = Account {
            id: Uuid::new_v4().to_string(),
            username: username.trim().to_string(),
            password_hash: hash_password(password),
            display_name: display_name.trim().to_string(),
            avatar_emoji: avatar_emoji.to_string(),
            is_admin,
            bio: String::new(),
            custom_status: String::new(),
        };
        let id = acc.id.clone();
        let uname = acc.username.clone();
        accounts.insert(key, acc.clone());
        drop(accounts);
        self.by_id.lock().unwrap().insert(id, uname);
        self.save();
        Ok(acc)
    }

    pub fn delete_account(&self, account_id: &str) -> Result<(), String> {
        let by_id = self.by_id.lock().unwrap();
        let username = by_id.get(account_id).cloned()
            .ok_or_else(|| "Account not found".to_string())?;
        drop(by_id);
        let mut accounts = self.accounts.lock().unwrap();
        let acc = accounts.remove(&username.to_lowercase())
            .ok_or_else(|| "Account not found".to_string())?;
        if acc.is_admin {
            let admin_count = accounts.values().filter(|a| a.is_admin).count();
            if admin_count == 0 {
                return Err("Cannot delete the last admin account".into());
            }
        }
        drop(accounts);
        self.by_id.lock().unwrap().remove(account_id);
        self.save();
        Ok(())
    }

    pub fn set_password(&self, account_id: &str, new_password: &str) -> Result<(), String> {
        if new_password.len() < 4 {
            return Err("Password must be at least 4 characters".into());
        }
        let by_id = self.by_id.lock().unwrap();
        let username = by_id.get(account_id).cloned()
            .ok_or_else(|| "Account not found".to_string())?;
        drop(by_id);
        let mut accounts = self.accounts.lock().unwrap();
        let acc = accounts.get_mut(&username.to_lowercase())
            .ok_or_else(|| "Account not found".to_string())?;
        acc.password_hash = hash_password(new_password);
        self.save();
        Ok(())
    }

    pub fn update_profile(
        &self,
        account_id: &str,
        display_name: Option<&str>,
        avatar_emoji: Option<&str>,
        bio: Option<&str>,
        custom_status: Option<&str>,
    ) -> Result<Account, String> {
        let by_id = self.by_id.lock().unwrap();
        let username = by_id.get(account_id).cloned()
            .ok_or_else(|| "Account not found".to_string())?;
        drop(by_id);
        let mut accounts = self.accounts.lock().unwrap();
        let acc = accounts.get_mut(&username.to_lowercase())
            .ok_or_else(|| "Account not found".to_string())?;
        if let Some(n) = display_name {
            if !n.trim().is_empty() { acc.display_name = n.trim().to_string(); }
        }
        if let Some(e) = avatar_emoji { acc.avatar_emoji = e.to_string(); }
        if let Some(b) = bio { acc.bio = b.to_string(); }
        if let Some(s) = custom_status { acc.custom_status = s.to_string(); }
        let out = acc.clone();
        self.save();
        Ok(out)
    }

    pub fn set_admin_flag(&self, account_id: &str, is_admin: bool) -> Result<(), String> {
        let by_id = self.by_id.lock().unwrap();
        let username = by_id.get(account_id).cloned()
            .ok_or_else(|| "Account not found".to_string())?;
        drop(by_id);
        let mut accounts = self.accounts.lock().unwrap();
        let acc = accounts.get_mut(&username.to_lowercase())
            .ok_or_else(|| "Account not found".to_string())?;
        acc.is_admin = is_admin;
        self.save();
        Ok(())
    }
}

pub fn hash_password(password: &str) -> String {
    let salt: String = (0..16)
        .map(|_| {
            let idx = (Uuid::new_v4().as_u128() % 62) as u8;
            (b'a' + (idx % 26)) as char
        })
        .collect();
    let hash = sha256_hex(&format!("{salt}:{password}"));
    format!("{salt}:{hash}")
}

fn verify_password(password: &str, stored: &str) -> bool {
    let parts: Vec<&str> = stored.splitn(2, ':').collect();
    if parts.len() != 2 { return false; }
    let expected = sha256_hex(&format!("{}:{}", parts[0], password));
    expected == parts[1]
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}
