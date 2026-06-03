mod state;
mod routes;
mod ws;
mod models;
mod auth;
mod share_code;
mod config;

use axum::{Router, routing::{get, post}};
use tower_http::{cors::{CorsLayer, Any}, trace::TraceLayer, services::ServeDir};
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use state::AppState;
use config::ServerConfig;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "catsmap=info,tower_http=warn".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = ServerConfig::load();
    tracing::info!("🐱 CatsMap starting — network: \"{}\"", cfg.network_name);

    let admin_user = std::env::var("CATSMAP_ADMIN_USERNAME").ok();
    let admin_pass = std::env::var("CATSMAP_ADMIN_PASSWORD").ok();
    let state = Arc::new(AppState::new_with_config(
        &cfg,
        admin_user.as_deref(),
        admin_pass.as_deref(),
    ));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Serve the built React app from ./web (relative to CWD) or /opt/catsmap/web
    let web_dir = std::env::var("CATSMAP_WEB_DIR")
        .unwrap_or_else(|_| "./web".to_string());

    let mut app = Router::new()
        // WebSocket
        .route("/ws", get(ws::ws_handler))
        // REST API
        .route("/api/login",                   post(routes::login))
        .route("/api/rejoin",                  post(routes::rejoin_network))
        .route("/api/search",                  get(routes::search_messages))
        .route("/api/messages/:channel_id/pinned", get(routes::get_pinned_messages))
        .route("/api/messages/:channel_id/export", get(routes::export_channel))
        .route("/api/custom-emojis",           get(routes::list_custom_emojis))
        .route("/api/admin/accounts",          get(routes::admin_list_accounts))
        .route("/api/admin/accounts/create",   post(routes::admin_create_account))
        .route("/api/admin/accounts/:id",      axum::routing::delete(routes::admin_delete_account))
        .route("/api/admin/accounts/:id/password", post(routes::admin_reset_password))
        .route("/api/admin/pin",               post(routes::admin_pin_message))
        .route("/api/admin/unpin",             post(routes::admin_unpin_message))
        .route("/api/admin/custom-emojis",     post(routes::admin_add_custom_emoji))
        .route("/api/profile",                 post(routes::update_profile))
        .route("/api/channels",                get(routes::list_channels))
        .route("/api/messages/:channel_id",    get(routes::get_messages))
        .route("/api/upload",                  post(routes::upload_file))
        .route("/api/share-code/generate",     post(routes::generate_share_code))
        .route("/api/share-code/connect",      post(routes::connect_share_code))
        .route("/api/bridge/message",          post(routes::post_bridge_message))
        .route("/api/network-info",            get(routes::network_info))
        .route("/api/online-users",            get(routes::online_users))
        // Admin routes
        .route("/api/admin/rename",            post(routes::admin_rename_network))
        .route("/api/admin/kick",              post(routes::admin_kick_user))
        .route("/api/admin/promote",           post(routes::admin_promote_user))
        .route("/api/admin/demote",            post(routes::admin_demote_user))
        .route("/api/admin/channels",          post(routes::admin_create_channel))
        .route("/api/admin/channels/:id",      axum::routing::delete(routes::admin_delete_channel))
        // Serve uploaded files
        .route("/files/:filename",             get(routes::serve_file))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Serve the SPA — fallback to index.html for client-side routing
    if std::path::Path::new(&web_dir).exists() {
        app = app.fallback_service(
            ServeDir::new(&web_dir).append_index_html_on_directories(true)
        );
        tracing::info!("   Serving web UI from {}", web_dir);
    } else {
        tracing::warn!("   Web dir '{}' not found — UI not served (dev mode: use Vite on :3000)", web_dir);
    }

    let addr = format!("0.0.0.0:{}", cfg.server_port);
    tracing::info!("   Listening on http://0.0.0.0:{}", cfg.server_port);

    // If web is bundled into the server port, tell the user the single URL
    if std::path::Path::new(&web_dir).exists() {
        tracing::info!("   Open http://localhost:{} in your browser 🐾", cfg.server_port);
    } else {
        // Dev: web dev server is on 3000, API on 3001
        tracing::info!("   API on :{} — run 'npm run dev' in web/ for UI on :3000", cfg.server_port);
    }

    let listener = tokio::net::TcpListener::bind(&addr).await
        .unwrap_or_else(|e| {
            eprintln!("");
            eprintln!("  ❌  Cannot bind to {} — {}", addr, e);
            eprintln!("  If another CatsMap is running (e.g. the systemd service), stop it first:");
            eprintln!("    sudo systemctl stop catsmap");
            eprintln!("");
            std::process::exit(1);
        });
    axum::serve(listener, app).await.unwrap();
}
