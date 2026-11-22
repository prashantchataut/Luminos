//! Official Minecraft: Java Edition patch notes feed (used for the Home screen news panel).
use crate::http;
use anyhow::Result;
use serde::Deserialize;

const FEED: &str = "https://launchercontent.mojang.com/v2/javaPatchNotes.json";
const BASE: &str = "https://launchercontent.mojang.com";

#[derive(Deserialize, Default)]
#[serde(default)]
struct Feed {
    entries: Vec<Entry>,
}
#[derive(Deserialize, Default)]
#[serde(default)]
struct Entry {
    title: String,
    version: String,
    #[serde(rename = "type")]
    kind: String,
    date: String,
    #[serde(rename = "shortText")]
    short_text: String,
    image: Option<Img>,
}
#[derive(Deserialize, Default)]
#[serde(default)]
struct Img {
    url: String,
}

#[derive(Clone, Debug)]
pub struct NewsItem {
    pub title: String,
    pub version: String,
    pub kind: String,
    pub date: String,
    pub summary: String,
    pub image_url: Option<String>,
}

pub fn fetch(limit: usize) -> Result<Vec<NewsItem>> {
    let feed: Feed = http::get_json(FEED)?;
    Ok(feed
        .entries
        .into_iter()
        .take(limit)
        .map(|e| NewsItem {
            title: e.title,
            version: e.version,
            kind: e.kind,
            date: e.date.get(..10).unwrap_or("").to_string(),
            summary: e.short_text,
            image_url: e.image.map(|i| format!("{BASE}{}", i.url)),
        })
        .collect())
}
