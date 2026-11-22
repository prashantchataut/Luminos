//! Playtime tracking: every session is stored so we can draw per-day and per-instance stats.
use crate::{paths, store};
use chrono::{Datelike, Duration, Local, NaiveDate, TimeZone};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Session {
    pub instance: String,
    pub start: i64,
    pub secs: u64,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct Log {
    pub sessions: Vec<Session>,
}

pub fn load() -> Log {
    store::read_json(&paths::playtime_file())
}

pub fn record(instance: &str, start: i64, secs: u64) {
    if secs < 5 {
        return;
    }
    let mut log = load();
    log.sessions.push(Session {
        instance: instance.to_string(),
        start,
        secs,
    });
    let _ = store::write_json(&paths::playtime_file(), &log);
}

fn day_of(ts: i64) -> NaiveDate {
    Local
        .timestamp_opt(ts, 0)
        .single()
        .map(|d| d.date_naive())
        .unwrap_or_default()
}

/// Seconds played per day for the last `days` days (oldest first), with short weekday labels.
pub fn daily(log: &Log, days: usize) -> Vec<(String, u64)> {
    let today = Local::now().date_naive();
    let mut buckets: HashMap<NaiveDate, u64> = HashMap::new();
    for s in &log.sessions {
        *buckets.entry(day_of(s.start)).or_default() += s.secs;
    }
    (0..days)
        .rev()
        .map(|i| {
            let d = today - Duration::days(i as i64);
            let label = match d.weekday() {
                chrono::Weekday::Mon => "Mon",
                chrono::Weekday::Tue => "Tue",
                chrono::Weekday::Wed => "Wed",
                chrono::Weekday::Thu => "Thu",
                chrono::Weekday::Fri => "Fri",
                chrono::Weekday::Sat => "Sat",
                chrono::Weekday::Sun => "Sun",
            };
            (label.to_string(), buckets.get(&d).copied().unwrap_or(0))
        })
        .collect()
}

pub fn total(log: &Log) -> u64 {
    log.sessions.iter().map(|s| s.secs).sum()
}

pub fn last_days_total(log: &Log, days: i64) -> u64 {
    let cutoff = store::now_unix() - days * 86_400;
    log.sessions
        .iter()
        .filter(|s| s.start >= cutoff)
        .map(|s| s.secs)
        .sum()
}

pub fn per_instance(log: &Log) -> Vec<(String, u64)> {
    let mut m: HashMap<String, u64> = HashMap::new();
    for s in &log.sessions {
        *m.entry(s.instance.clone()).or_default() += s.secs;
    }
    let mut v: Vec<_> = m.into_iter().collect();
    v.sort_by(|a, b| b.1.cmp(&a.1));
    v
}

/// Consecutive days (ending today or yesterday) with at least one session.
pub fn streak(log: &Log) -> u32 {
    let days: std::collections::HashSet<NaiveDate> =
        log.sessions.iter().map(|s| day_of(s.start)).collect();
    let mut d = Local::now().date_naive();
    if !days.contains(&d) {
        d -= Duration::days(1);
    }
    let mut n = 0;
    while days.contains(&d) {
        n += 1;
        d -= Duration::days(1);
    }
    n
}
