use luminos_auth::{new_state, router, Config};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let env = |k: &str, d: &str| std::env::var(k).unwrap_or_else(|_| d.to_string());
    let cfg = Config {
        server_name: env("LUMINOS_AUTH_NAME", "Luminos Auth"),
        public_url: env("LUMINOS_AUTH_PUBLIC_URL", "http://127.0.0.1:8787"),
        skin_domains: env("LUMINOS_AUTH_SKIN_DOMAINS", "127.0.0.1,localhost")
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        data_dir: Some(PathBuf::from(env(
            "LUMINOS_AUTH_DATA",
            "./luminos-auth-data",
        ))),
        allow_registration: env("LUMINOS_AUTH_REGISTRATION", "open") != "closed",
    };
    let addr = env("LUMINOS_AUTH_ADDR", "127.0.0.1:8787");
    let app = router(new_state(cfg)?);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("luminos-auth listening on http://{addr}");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
