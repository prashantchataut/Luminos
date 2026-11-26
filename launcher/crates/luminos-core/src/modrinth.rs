//! Modrinth API v2 client (search, versions, hash lookups, bulk update checks).
use crate::http;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const API: &str = "https://api.modrinth.com/v2";

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Project {
    #[serde(alias = "project_id")]
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub project_type: String,
    pub downloads: u64,
    pub follows: u64,
    pub author: String,
    pub categories: Vec<String>,
    pub featured_gallery: Option<String>,
    pub client_side: String,
}

#[derive(Deserialize, Default, Debug)]
#[serde(default)]
pub struct SearchResult {
    pub hits: Vec<Project>,
    pub total_hits: u64,
}

#[derive(Clone, Debug, Default)]
pub struct SearchQuery {
    pub text: String,
    /// mod | modpack | resourcepack | shader | datapack
    pub project_type: String,
    pub loader: Option<String>,
    pub game_version: Option<String>,
    /// relevance | downloads | follows | newest | updated
    pub sort: String,
    pub offset: u32,
    pub limit: u32,
}

pub fn search(q: &SearchQuery) -> Result<SearchResult> {
    search_facets(q, &[])
}

/// Like [`search`], with extra Modrinth categories that must all match (the store's category chips).
pub fn search_facets(q: &SearchQuery, categories: &[String]) -> Result<SearchResult> {
    let mut facets: Vec<Vec<String>> = vec![vec![format!("project_type:{}", q.project_type)]];
    if let Some(l) = &q.loader {
        if q.project_type == "mod" || q.project_type == "modpack" {
            facets.push(vec![format!("categories:{l}")]);
        }
    }
    if let Some(v) = &q.game_version {
        facets.push(vec![format!("versions:{v}")]);
    }
    for c in categories
        .iter()
        .filter(|c| c.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-'))
    {
        facets.push(vec![format!("categories:{c}")]);
    }
    let query = vec![
        ("query", q.text.clone()),
        ("facets", serde_json::to_string(&facets)?),
        (
            "index",
            if q.sort.is_empty() {
                "relevance".into()
            } else {
                q.sort.clone()
            },
        ),
        ("offset", q.offset.to_string()),
        (
            "limit",
            if q.limit == 0 {
                "24".into()
            } else {
                q.limit.to_string()
            },
        ),
    ];
    http::get_json_query(&format!("{API}/search"), &query)
}

pub fn project(id_or_slug: &str) -> Result<Project> {
    http::get_json(&format!("{API}/project/{id_or_slug}"))
}

pub fn projects(ids: &[String]) -> Result<Vec<Project>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    http::get_json_query(
        &format!("{API}/projects"),
        &[("ids", serde_json::to_string(ids)?)],
    )
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Hashes {
    pub sha1: String,
    pub sha512: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct VFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: u64,
    pub hashes: Hashes,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Dependency {
    pub project_id: Option<String>,
    pub version_id: Option<String>,
    pub dependency_type: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Version {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub version_type: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<VFile>,
    pub dependencies: Vec<Dependency>,
    pub date_published: String,
}

impl Version {
    pub fn primary_file(&self) -> Option<&VFile> {
        self.files
            .iter()
            .find(|f| f.primary)
            .or_else(|| self.files.first())
    }
}

pub fn versions(
    project: &str,
    loader: Option<&str>,
    game_version: Option<&str>,
) -> Result<Vec<Version>> {
    let mut q: Vec<(&str, String)> = vec![];
    if let Some(l) = loader {
        q.push(("loaders", serde_json::to_string(&[l])?));
    }
    if let Some(g) = game_version {
        q.push(("game_versions", serde_json::to_string(&[g])?));
    }
    http::get_json_query(&format!("{API}/project/{project}/version"), &q)
}

/// Newest stable (release) version, falling back to the newest of any channel.
pub fn best_version(list: Vec<Version>) -> Option<Version> {
    let rel = list.iter().find(|v| v.version_type == "release").cloned();
    rel.or_else(|| list.into_iter().next())
}

/// Identify files by SHA-1: returns hash -> Version.
pub fn versions_by_hashes(hashes: &[String]) -> Result<HashMap<String, Version>> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    http::post_json(
        &format!("{API}/version_files"),
        &serde_json::json!({ "hashes": hashes, "algorithm": "sha1" }),
    )
}

/// Latest compatible version for every hash in one request: hash -> newest Version.
pub fn latest_for_hashes(
    hashes: &[String],
    loaders: &[String],
    game_versions: &[String],
) -> Result<HashMap<String, Version>> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    http::post_json(
        &format!("{API}/version_files/update"),
        &serde_json::json!({
            "hashes": hashes,
            "algorithm": "sha1",
            "loaders": loaders,
            "game_versions": game_versions,
        }),
    )
}

/// Minecraft versions Modrinth knows about (newest first) — handy for filters.
pub fn game_versions() -> Result<Vec<String>> {
    #[derive(Deserialize)]
    struct Gv {
        version: String,
        version_type: String,
    }
    let list: Vec<Gv> = http::get_json(&format!("{API}/tag/game_version"))?;
    Ok(list
        .into_iter()
        .filter(|g| g.version_type == "release")
        .map(|g| g.version)
        .collect())
}
