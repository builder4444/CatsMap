mod state;
mod routes;
mod ws;
mod models;
mod auth;
mod share_code;
mod config;
mod persist;

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

    let web_dir = std::env::var("CATSMAP_WEB_DIR")
        .unwrap_or_else(|_| "./web".to_string());

    let mut app = Router::new()
        .route("/ws", get(ws::ws_handler))
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
        .route("/api/admin/rename",            post(routes::admin_rename_network))
        .route("/api/admin/kick",              post(routes::admin_kick_user))
        .route("/api/admin/promote",           post(routes::admin_promote_user))
        .route("/api/admin/demote",            post(routes::admin_demote_user))
        .route("/api/admin/channels",          post(routes::admin_create_channel))
        .route("/api/admin/channels/:id",      axum::routing::delete(routes::admin_delete_channel))
        .route("/files/:filename",             get(routes::serve_file))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

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

    if std::path::Path::new(&web_dir).exists() {
        tracing::info!("   Open http://localhost:{} in your browser 🐾", cfg.server_port);
    } else {
        tracing::info!("   API on :{} — run 'npm run dev' in web/ for UI on :3000", cfg.server_port);
    }

    let listener = tokio::net::TcpListener::bind(&addr).await
        .unwrap_or_else(|e| {
            eprintln!("\n  ❌  Cannot bind to {} — {}", addr, e);
            eprintln!("  If another CatsMap is running, stop it first.\n");
            std::process::exit(1);
        });

    // Auto-save every 60 seconds
    {
        let state_bg = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
            interval.tick().await; // skip first immediate tick
            loop {
                interval.tick().await;
                state_bg.save_to_disk();
            }
        });
    }

    // Run server, save on Ctrl+C / SIGTERM
    tokio::select! {
        result = axum::serve(listener, app) => {
            if let Err(e) = result {
                tracing::error!("Server error: {}", e);
            }
        }
        _ = shutdown_signal() => {
            tracing::info!("🛑 Shutdown signal received — saving state...");
        }
    }

    // Final save before exit
    state.save_to_disk();
    tracing::info!("✅ State saved. Goodbye 🐾");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to listen for Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}
