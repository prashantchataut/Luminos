//! Parallel, resumable-by-skipping downloader with progress reporting and SHA-1 verification.
use crate::{http, store};
use anyhow::{anyhow, Result};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread,
};

#[derive(Clone, Debug)]
pub struct Task {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: u64,
}

/// Shared between worker threads and the UI.
pub struct Progress {
    pub stage: Mutex<String>,
    pub total: AtomicU64,
    pub done: AtomicU64,
    pub bytes: AtomicU64,
    pub cancel: AtomicBool,
}

impl Progress {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            stage: Mutex::new(String::new()),
            total: AtomicU64::new(0),
            done: AtomicU64::new(0),
            bytes: AtomicU64::new(0),
            cancel: AtomicBool::new(false),
        })
    }
    pub fn set_stage(&self, s: impl Into<String>) {
        *self.stage.lock().unwrap() = s.into();
    }
    pub fn stage(&self) -> String {
        self.stage.lock().unwrap().clone()
    }
    pub fn fraction(&self) -> f32 {
        let t = self.total.load(Ordering::Relaxed);
        if t == 0 {
            0.0
        } else {
            (self.done.load(Ordering::Relaxed) as f32 / t as f32).clamp(0.0, 1.0)
        }
    }
    pub fn reset_counts(&self) {
        self.total.store(0, Ordering::Relaxed);
        self.done.store(0, Ordering::Relaxed);
    }
}

fn already_ok(t: &Task) -> bool {
    match std::fs::metadata(&t.path) {
        Ok(m) if m.is_file() => {
            if t.size > 0 {
                m.len() == t.size
            } else if let Some(h) = &t.sha1 {
                store::sha1_file(&t.path).map(|x| &x == h).unwrap_or(false)
            } else {
                m.len() > 0
            }
        }
        _ => false,
    }
}

fn fetch_one(t: &Task, p: &Progress) -> Result<()> {
    if already_ok(t) {
        return Ok(());
    }
    let mut last = anyhow!("unknown error");
    for _ in 0..3 {
        if p.cancel.load(Ordering::Relaxed) {
            return Err(anyhow!("cancelled"));
        }
        match http::download_to(&t.url, &t.path) {
            Ok(n) => {
                if let Some(expected) = &t.sha1 {
                    let got = store::sha1_file(&t.path)?;
                    if &got != expected {
                        let _ = std::fs::remove_file(&t.path);
                        last = anyhow!("checksum mismatch for {}", t.url);
                        continue;
                    }
                }
                p.bytes.fetch_add(n, Ordering::Relaxed);
                return Ok(());
            }
            Err(e) => last = e,
        }
    }
    Err(last)
}

/// Download everything in `tasks` using `threads` workers. Fails fast on the first hard error.
pub fn download_all(tasks: Vec<Task>, threads: usize, p: &Progress) -> Result<()> {
    p.total.fetch_add(tasks.len() as u64, Ordering::Relaxed);
    let idx = AtomicUsize::new(0);
    let err: Mutex<Option<String>> = Mutex::new(None);
    let workers = threads.clamp(1, 64).min(tasks.len().max(1));
    thread::scope(|s| {
        for _ in 0..workers {
            s.spawn(|| loop {
                if p.cancel.load(Ordering::Relaxed) {
                    break;
                }
                let i = idx.fetch_add(1, Ordering::Relaxed);
                let Some(t) = tasks.get(i) else { break };
                match fetch_one(t, p) {
                    Ok(()) => {
                        p.done.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(e) => {
                        *err.lock().unwrap() = Some(format!("{e:#}"));
                        p.cancel.store(true, Ordering::Relaxed);
                    }
                }
            });
        }
    });
    if let Some(e) = err.into_inner().unwrap() {
        return Err(anyhow!(e));
    }
    Ok(())
}
