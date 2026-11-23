//! Dependency solver for Fabric mods.
//!
//! Why this exists: the launcher used to install "the newest Modrinth version of each mod". That put
//! Sodium 0.9.4-beta.1 next to Sodium Extra, which needs exactly Sodium 0.9.3, and shipped a client jar
//! whose `fabric.mod.json` only allowed Minecraft ~1.21.4 into a 26.3 instance. Fabric then refused to
//! load. The fix is to do what Fabric Loader does *before* launching: read every jar's
//! `fabric.mod.json` (nested jars included), evaluate `depends` / `breaks` against the real Minecraft,
//! loader and Java versions, and only keep a set that Fabric will accept.
//!
//! Rules (documented for users in the app):
//! 1. Stable (`release`) builds only, unless the user opted in to betas.
//! 2. Mods are added in priority order. Newest compatible version wins; if a newer version of an
//!    already chosen mod blocks a later one, the solver tries older versions of the chosen mod
//!    (one level of repair) before giving up on the later one.
//! 3. A mod that cannot be satisfied is dropped (optional) with a plain-language reason. A required
//!    mod that cannot be satisfied is a hard error.
use crate::{content, http, instances::Instance, instances::Loader, modrinth, paths, store};
use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read};

// ---------------------------------------------------------------- versions

#[derive(Clone, Debug, PartialEq, Eq)]
enum Pre {
    Num(u64),
    Str(String),
}

/// A parsed SemVer-ish version (Fabric accepts 1-N numeric parts, e.g. Minecraft `26.3`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ver {
    nums: Vec<u64>,
    pre: Vec<Pre>,
}

impl Ver {
    pub fn parse(s: &str) -> Option<Ver> {
        let s = s.trim().trim_start_matches('v');
        let s = s.split('+').next()?;
        let (core, pre) = match s.split_once('-') {
            Some((c, p)) => (c, Some(p)),
            None => (s, None),
        };
        let nums: Option<Vec<u64>> = core.split('.').map(|p| p.parse::<u64>().ok()).collect();
        let nums = nums?;
        if nums.is_empty() {
            return None;
        }
        let pre = pre
            .map(|p| {
                p.split(['.', '-'])
                    .map(|x| x.parse::<u64>().map(Pre::Num).unwrap_or_else(|_| Pre::Str(x.to_string())))
                    .collect()
            })
            .unwrap_or_default();
        Some(Ver { nums, pre })
    }
}

impl Ord for Ver {
    fn cmp(&self, o: &Self) -> Ordering {
        let n = self.nums.len().max(o.nums.len());
        for i in 0..n {
            let a = self.nums.get(i).copied().unwrap_or(0);
            let b = o.nums.get(i).copied().unwrap_or(0);
            if a != b {
                return a.cmp(&b);
            }
        }
        match (self.pre.is_empty(), o.pre.is_empty()) {
            (true, true) => Ordering::Equal,
            (true, false) => Ordering::Greater,
            (false, true) => Ordering::Less,
            (false, false) => {
                for (a, b) in self.pre.iter().zip(o.pre.iter()) {
                    let c = match (a, b) {
                        (Pre::Num(x), Pre::Num(y)) => x.cmp(y),
                        (Pre::Num(_), Pre::Str(_)) => Ordering::Less,
                        (Pre::Str(_), Pre::Num(_)) => Ordering::Greater,
                        (Pre::Str(x), Pre::Str(y)) => x.cmp(y),
                    };
                    if c != Ordering::Equal {
                        return c;
                    }
                }
                self.pre.len().cmp(&o.pre.len())
            }
        }
    }
}
impl PartialOrd for Ver {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Op {
    Eq,
    Ge,
    Gt,
    Le,
    Lt,
}

#[derive(Clone, Debug)]
struct Cmp {
    op: Op,
    v: Ver,
}

/// A Fabric version predicate: alternatives (`||` or a JSON array) of AND-ed comparators.
#[derive(Clone, Debug, Default)]
pub struct Req {
    alts: Vec<Vec<Cmp>>,
    raw: String,
}

fn bump(nums: &[u64], at: usize) -> Ver {
    let mut n: Vec<u64> = nums.iter().take(at + 1).copied().collect();
    while n.len() <= at {
        n.push(0);
    }
    n[at] += 1;
    Ver { nums: n, pre: vec![] }
}

fn comparator(tok: &str) -> Option<Vec<Cmp>> {
    let t = tok.trim();
    if t.is_empty() || t == "*" || t.eq_ignore_ascii_case("x") {
        return Some(vec![]);
    }
    let (op, rest) = [">=", "<=", ">", "<", "=", "^", "~"]
        .iter()
        .find_map(|p| t.strip_prefix(p).map(|r| (*p, r.trim())))
        .unwrap_or(("", t));
    let parts: Vec<&str> = rest.split('.').collect();
    if let Some(w) = parts.iter().position(|p| matches!(*p, "x" | "X" | "*")) {
        if w == 0 {
            return Some(vec![]);
        }
        let nums: Option<Vec<u64>> = parts[..w].iter().map(|p| p.parse().ok()).collect();
        let nums = nums?;
        return Some(vec![
            Cmp { op: Op::Ge, v: Ver { nums: nums.clone(), pre: vec![] } },
            Cmp { op: Op::Lt, v: bump(&nums, w - 1) },
        ]);
    }
    let v = Ver::parse(rest)?;
    let mk = |op, v: Ver| Cmp { op, v };
    Some(match op {
        "" | "=" => vec![mk(Op::Eq, v)],
        ">=" => vec![mk(Op::Ge, v)],
        ">" => vec![mk(Op::Gt, v)],
        "<=" => vec![mk(Op::Le, v)],
        "<" => vec![mk(Op::Lt, v)],
        "^" => vec![mk(Op::Ge, v.clone()), mk(Op::Lt, bump(&v.nums, 0))],
        _ => {
            let at = if v.nums.len() >= 2 { 1 } else { 0 };
            vec![mk(Op::Ge, v.clone()), mk(Op::Lt, bump(&v.nums, at))]
        }
    })
}

impl Req {
    pub fn parse(s: &str) -> Req {
        Req::parse_any(&[s.to_string()])
    }
    pub fn parse_any(options: &[String]) -> Req {
        let mut alts = vec![];
        for o in options {
            for alt in o.split("||") {
                let mut and = vec![];
                let mut ok = true;
                for tok in alt.split_whitespace() {
                    match comparator(tok) {
                        Some(c) => and.extend(c),
                        None => ok = false, // unknown syntax: be lenient, do not drop mods on a guess
                    }
                }
                alts.push(if ok { and } else { vec![] });
            }
        }
        if alts.is_empty() {
            alts.push(vec![]);
        }
        Req { alts, raw: options.join(" || ") }
    }
    pub fn matches(&self, version: &str) -> bool {
        let Some(v) = Ver::parse(version) else {
            return true; // cannot parse the provider's version: assume fine (Fabric is lenient too)
        };
        self.alts.iter().any(|and| {
            and.iter().all(|c| {
                let o = v.cmp(&c.v);
                match c.op {
                    Op::Eq => o == Ordering::Equal,
                    Op::Ge => o != Ordering::Less,
                    Op::Gt => o == Ordering::Greater,
                    Op::Le => o != Ordering::Greater,
                    Op::Lt => o == Ordering::Less,
                }
            })
        })
    }
    pub fn raw(&self) -> &str {
        if self.raw.is_empty() {
            "*"
        } else {
            &self.raw
        }
    }
}

// ---------------------------------------------------------------- fabric.mod.json

/// One module inside a jar: the jar itself, or a jar-in-jar (Fabric API ships dozens).
#[derive(Clone, Debug, Default)]
pub struct Unit {
    pub id: String,
    pub version: String,
    pub provides: Vec<String>,
    pub depends: Vec<(String, Req)>,
    pub breaks: Vec<(String, Req)>,
}

#[derive(Clone, Debug, Default)]
pub struct ModMeta {
    /// `units[0]` is the jar's own mod; the rest are nested jars.
    pub units: Vec<Unit>,
}

impl ModMeta {
    pub fn id(&self) -> &str {
        self.units.first().map(|u| u.id.as_str()).unwrap_or("")
    }
    pub fn version(&self) -> &str {
        self.units.first().map(|u| u.version.as_str()).unwrap_or("")
    }
}

fn req_map(v: &serde_json::Value) -> Vec<(String, Req)> {
    let Some(o) = v.as_object() else { return vec![] };
    o.iter()
        .map(|(k, val)| {
            let opts: Vec<String> = match val {
                serde_json::Value::String(s) => vec![s.clone()],
                serde_json::Value::Array(a) => a.iter().filter_map(|x| x.as_str().map(String::from)).collect(),
                _ => vec!["*".into()],
            };
            (k.clone(), Req::parse_any(&opts))
        })
        .collect()
}

fn read_units(bytes: &[u8], depth: u8, out: &mut Vec<Unit>) -> Result<()> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).context("not a jar")?;
    let mut json = String::new();
    zip.by_name("fabric.mod.json")
        .context("no fabric.mod.json (not a Fabric mod)")?
        .read_to_string(&mut json)?;
    let v: serde_json::Value = serde_json::from_str(json.trim_start_matches('\u{feff}')).context("bad fabric.mod.json")?;
    let provides = v["provides"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|p| p.as_str().or_else(|| p["id"].as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();
    out.push(Unit {
        id: v["id"].as_str().unwrap_or("").to_string(),
        version: v["version"].as_str().unwrap_or("").to_string(),
        provides,
        depends: req_map(&v["depends"]),
        breaks: req_map(&v["breaks"]),
    });
    if depth < 2 {
        let nested: Vec<String> = v["jars"]
            .as_array()
            .map(|a| a.iter().filter_map(|j| j["file"].as_str().map(String::from)).collect())
            .unwrap_or_default();
        for f in nested {
            let mut buf = vec![];
            if let Ok(mut e) = zip.by_name(&f) {
                if e.read_to_end(&mut buf).is_ok() {
                    let _ = read_units(&buf, depth + 1, out);
                }
            }
        }
    }
    Ok(())
}

/// Parse the Fabric metadata of a jar (and the jars nested in it).
pub fn read_meta(bytes: &[u8]) -> Result<ModMeta> {
    let mut units = vec![];
    read_units(bytes, 0, &mut units)?;
    Ok(ModMeta { units })
}

// ---------------------------------------------------------------- checking

/// The runtime Fabric will evaluate mods against.
#[derive(Clone, Debug)]
pub struct Env {
    pub minecraft: String,
    pub loader: String,
    pub java: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ProblemKind {
    Missing,
    WrongVersion,
    Breaks,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Problem {
    pub owner: String,
    pub dep: String,
    pub wanted: String,
    pub found: String,
    pub kind: ProblemKind,
}

impl Problem {
    pub fn describe(&self) -> String {
        match self.kind {
            ProblemKind::Missing => format!("{} needs {} ({}), which is not installed", self.owner, self.dep, self.wanted),
            ProblemKind::WrongVersion => format!(
                "{} needs {} {}, but {} is what would be installed",
                self.owner, self.dep, self.wanted, self.found
            ),
            ProblemKind::Breaks => format!("{} cannot run together with {} {}", self.owner, self.dep, self.found),
        }
    }
}

/// Evaluate a set of jars the way Fabric Loader does. Empty result = Fabric will load them.
pub fn check(env: &Env, metas: &[&ModMeta]) -> Vec<Problem> {
    let mut prov: HashMap<String, Vec<String>> = HashMap::new();
    let mut add = |id: &str, v: &str| prov.entry(id.to_string()).or_default().push(v.to_string());
    add("minecraft", &env.minecraft);
    add("fabricloader", &env.loader);
    add("java", &env.java.to_string());
    for m in metas {
        for u in &m.units {
            add(&u.id, &u.version);
            for p in &u.provides {
                add(p, &u.version);
            }
        }
    }
    let mut out = vec![];
    for m in metas {
        for u in &m.units {
            for (dep, req) in &u.depends {
                match prov.get(dep) {
                    None => out.push(Problem {
                        owner: u.id.clone(),
                        dep: dep.clone(),
                        wanted: req.raw().into(),
                        found: String::new(),
                        kind: ProblemKind::Missing,
                    }),
                    Some(vs) if !vs.iter().any(|v| req.matches(v)) => out.push(Problem {
                        owner: u.id.clone(),
                        dep: dep.clone(),
                        wanted: req.raw().into(),
                        found: vs.join(", "),
                        kind: ProblemKind::WrongVersion,
                    }),
                    _ => {}
                }
            }
            for (dep, req) in &u.breaks {
                if let Some(vs) = prov.get(dep) {
                    if let Some(v) = vs.iter().find(|v| req.matches(v)) {
                        out.push(Problem {
                            owner: u.id.clone(),
                            dep: dep.clone(),
                            wanted: req.raw().into(),
                            found: v.clone(),
                            kind: ProblemKind::Breaks,
                        });
                    }
                }
            }
        }
    }
    out.sort_by(|a, b| (&a.owner, &a.dep).cmp(&(&b.owner, &b.dep)));
    out.dedup();
    out
}

/// The runtime for an instance: its Minecraft, its Fabric Loader and the Java major it launches with.
pub fn env_for(inst: &Instance, java_major: u32) -> Result<Env> {
    let loader = match &inst.loader_version {
        Some(v) => v.clone(),
        None => crate::mojang::loader_versions(&inst.mc_version, inst.loader)?
            .into_iter()
            .next()
            .ok_or_else(|| anyhow!("no Fabric Loader for Minecraft {}", inst.mc_version))?,
    };
    Ok(Env { minecraft: inst.mc_version.clone(), loader, java: java_major })
}

// ---------------------------------------------------------------- candidates

#[derive(Clone, Debug, Default)]
pub struct Cand {
    pub slug: String,
    pub project: modrinth::Project,
    pub version: modrinth::Version,
}

impl Cand {
    pub fn channel(&self) -> &str {
        &self.version.version_type
    }
    fn required_projects(&self) -> Vec<String> {
        self.version
            .dependencies
            .iter()
            .filter(|d| d.dependency_type == "required")
            .filter_map(|d| d.project_id.clone())
            .collect()
    }
}

/// Where candidate versions and jar metadata come from (Modrinth in the app, a fake in tests).
pub trait Source {
    /// All versions for this project on this Minecraft + loader, newest first, every channel.
    fn candidates(&self, slug: &str, env: &Env) -> Result<Vec<Cand>>;
    fn meta(&self, c: &Cand) -> Result<ModMeta>;
}

pub struct ModrinthSource;

impl ModrinthSource {
    fn cache_path(sha1: &str) -> std::path::PathBuf {
        paths::cache_dir().join("jars").join(format!("{sha1}.jar"))
    }
    /// Download (once) and return the cached jar path for a candidate.
    pub fn jar(&self, c: &Cand) -> Result<std::path::PathBuf> {
        let f = c.version.primary_file().ok_or_else(|| anyhow!("{} has no file", c.project.title))?;
        let p = Self::cache_path(&f.hashes.sha1);
        if p.exists() && store::sha1_file(&p).map(|h| h == f.hashes.sha1).unwrap_or(false) {
            return Ok(p);
        }
        let bytes = http::get_bytes(&f.url)?;
        if !f.hashes.sha1.is_empty() && store::sha1_bytes(&bytes) != f.hashes.sha1 {
            bail!("{}: download did not match its checksum", f.filename);
        }
        std::fs::create_dir_all(p.parent().unwrap())?;
        std::fs::write(&p, &bytes)?;
        Ok(p)
    }
}

impl Source for ModrinthSource {
    fn candidates(&self, slug: &str, env: &Env) -> Result<Vec<Cand>> {
        let project = modrinth::project(slug)?;
        let list = modrinth::versions(&project.id, Some("fabric"), Some(&env.minecraft))?;
        Ok(list
            .into_iter()
            .map(|version| Cand { slug: slug.to_string(), project: project.clone(), version })
            .collect())
    }
    fn meta(&self, c: &Cand) -> Result<ModMeta> {
        let p = self.jar(c)?;
        read_meta(&std::fs::read(p)?)
    }
}

// ---------------------------------------------------------------- solving

#[derive(Clone, Debug)]
pub struct Want {
    pub slug: String,
    pub name: String,
    /// Required mods that cannot be satisfied abort the solve; optional ones are dropped.
    pub required: bool,
}

/// A jar that is already there and is not ours to change (the client jar, a user-added mod).
#[derive(Clone, Debug)]
pub struct Fixed {
    pub label: String,
    pub meta: ModMeta,
}

#[derive(Clone, Debug)]
pub struct Chosen {
    pub name: String,
    pub cand: Cand,
    pub meta: ModMeta,
    pub required: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Dropped {
    pub slug: String,
    pub name: String,
    pub reason: String,
}

#[derive(Clone, Debug, Default)]
pub struct Plan {
    pub chosen: Vec<Chosen>,
    pub dropped: Vec<Dropped>,
    /// Human-readable decisions: "Using Sodium 0.9.3 so Sodium Extra can load".
    pub notes: Vec<String>,
}

const MAX_CANDIDATES: usize = 8;

struct Solver<'a> {
    src: &'a dyn Source,
    env: &'a Env,
    fixed: &'a [Fixed],
    allow_beta: bool,
    chosen: Vec<Chosen>,
    notes: Vec<String>,
    pools: HashMap<String, Vec<Cand>>,
    only_prerelease: HashSet<String>,
}

impl<'a> Solver<'a> {
    fn metas<'b>(&'b self, extra: Option<&'b ModMeta>, skip: Option<usize>) -> Vec<&'b ModMeta> {
        let mut v: Vec<&ModMeta> = self.fixed.iter().map(|f| &f.meta).collect();
        for (i, c) in self.chosen.iter().enumerate() {
            if Some(i) != skip {
                v.push(&c.meta);
            }
        }
        if let Some(e) = extra {
            v.push(e);
        }
        v
    }

    fn pool(&mut self, slug: &str) -> Result<Vec<Cand>> {
        if let Some(p) = self.pools.get(slug) {
            return Ok(p.clone());
        }
        let all = self.src.candidates(slug, self.env)?;
        let stable: Vec<Cand> = all.iter().filter(|c| c.channel() == "release").cloned().collect();
        let pool = if self.allow_beta { all.clone() } else { stable.clone() };
        if stable.is_empty() && !all.is_empty() {
            self.only_prerelease.insert(slug.to_string());
        }
        self.pools.insert(slug.to_string(), pool.clone());
        Ok(pool)
    }

    fn has(&self, slug_or_id: &str) -> Option<usize> {
        self.chosen
            .iter()
            .position(|c| c.cand.slug == slug_or_id || c.cand.project.id == slug_or_id || c.cand.project.slug == slug_or_id)
    }

    fn new_problems(&self, before: &[Problem], extra: Option<&ModMeta>, skip: Option<usize>) -> Vec<Problem> {
        let after = check(self.env, &self.metas(extra, skip));
        after.into_iter().filter(|p| !before.contains(p)).collect()
    }

    /// Try to add `slug`. Err(reason) = could not be satisfied.
    fn add(&mut self, slug: &str, name: &str, required: bool, depth: u8) -> std::result::Result<(), String> {
        if self.has(slug).is_some() {
            return Ok(());
        }
        let pool = self.pool(slug).map_err(|e| format!("could not look it up on Modrinth ({e:#})"))?;
        if pool.is_empty() {
            return Err(if self.only_prerelease.contains(slug) {
                format!(
                    "only beta builds exist for Minecraft {} (turn on \"Allow beta mods\" to use them)",
                    self.env.minecraft
                )
            } else {
                format!("no build for Fabric on Minecraft {}", self.env.minecraft)
            });
        }
        let mut first_reason: Option<String> = None;
        for cand in pool.iter().take(MAX_CANDIDATES) {
            let meta = match self.src.meta(cand) {
                Ok(m) => m,
                Err(e) => {
                    first_reason.get_or_insert(format!("{} could not be read ({e:#})", cand.version.version_number));
                    continue;
                }
            };
            let start = self.chosen.len();
            // Required dependencies (from Modrinth's metadata) come first so the check can see them.
            let mut dep_fail = None;
            if depth < 3 {
                for dep in cand.required_projects() {
                    if self.has(&dep).is_none() {
                        if let Err(r) = self.add(&dep, &dep, true, depth + 1) {
                            dep_fail = Some(format!("{} needs another mod that cannot be installed ({r})", cand.version.version_number));
                            break;
                        }
                    }
                }
            }
            if let Some(r) = dep_fail {
                self.chosen.truncate(start);
                first_reason.get_or_insert(r);
                continue;
            }
            let before = check(self.env, &self.metas(None, None));
            let problems = self.new_problems(&before, Some(&meta), None);
            if problems.is_empty() {
                self.chosen.push(Chosen { name: name.to_string(), cand: cand.clone(), meta, required });
                return Ok(());
            }
            if self.repair(cand, &meta, name, required, &before, &problems) {
                return Ok(());
            }
            self.chosen.truncate(start);
            first_reason.get_or_insert(format!("{} - {}", cand.version.version_number, self.explain(&problems[0])));
        }
        Err(first_reason.unwrap_or_else(|| "no compatible version".into()))
    }

    fn explain(&self, p: &Problem) -> String {
        let nm = |id: &str| {
            self.chosen
                .iter()
                .find(|c| c.meta.units.iter().any(|u| u.id == id))
                .map(|c| c.name.clone())
        };
        let mut p2 = p.clone();
        if let Some(n) = nm(&p.dep) {
            p2.dep = n;
        }
        if let Some(n) = nm(&p.owner) {
            p2.owner = n;
        }
        p2.describe()
    }

    /// One level of backtracking: swap an already chosen (non-required) mod for an older version so
    /// `cand` fits, as long as nothing else breaks.
    fn repair(&mut self, cand: &Cand, meta: &ModMeta, name: &str, required: bool, before: &[Problem], problems: &[Problem]) -> bool {
        let mut blockers: Vec<usize> = vec![];
        for p in problems {
            if let Some(i) = self
                .chosen
                .iter()
                .position(|c| !c.required && c.meta.units.iter().any(|u| u.id == p.dep || u.provides.contains(&p.dep)))
            {
                if !blockers.contains(&i) {
                    blockers.push(i);
                }
            }
        }
        for i in blockers {
            let slug = self.chosen[i].cand.slug.clone();
            let cur = self.chosen[i].cand.version.id.clone();
            let Ok(pool) = self.pool(&slug) else { continue };
            for alt in pool.iter().filter(|a| a.version.id != cur).take(MAX_CANDIDATES) {
                let Ok(alt_meta) = self.src.meta(alt) else { continue };
                // alt replaces chosen[i]; then cand joins.
                let mut metas: Vec<&ModMeta> = self.metas(None, Some(i));
                metas.push(&alt_meta);
                metas.push(meta);
                let after = check(self.env, &metas);
                if after.iter().all(|p| before.contains(p)) {
                    let old = self.chosen[i].cand.version.version_number.clone();
                    let title = self.chosen[i].name.clone();
                    self.notes.push(format!(
                        "Using {} {} instead of {} so {} can load.",
                        title, alt.version.version_number, old, name
                    ));
                    self.chosen[i].cand = alt.clone();
                    self.chosen[i].meta = alt_meta;
                    self.chosen.push(Chosen { name: name.to_string(), cand: cand.clone(), meta: meta.clone(), required });
                    return true;
                }
            }
        }
        false
    }
}

/// Solve for `wants` (priority order) on top of the `fixed` jars.
pub fn solve(src: &dyn Source, env: &Env, fixed: &[Fixed], wants: &[Want], allow_beta: bool) -> Result<Plan> {
    let mut s = Solver {
        src,
        env,
        fixed,
        allow_beta,
        chosen: vec![],
        notes: vec![],
        pools: HashMap::new(),
        only_prerelease: HashSet::new(),
    };
    let mut dropped = vec![];
    for w in wants {
        if let Err(reason) = s.add(&w.slug, &w.name, w.required, 0) {
            if w.required {
                bail!("{} cannot be installed for Minecraft {}: {}", w.name, env.minecraft, reason);
            }
            dropped.push(Dropped { slug: w.slug.clone(), name: w.name.clone(), reason });
        }
    }
    Ok(Plan { chosen: s.chosen, dropped, notes: s.notes })
}

// ---------------------------------------------------------------- applying to an instance

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Report {
    pub minecraft: String,
    pub checked: usize,
    pub ok: bool,
    pub installed: Vec<String>,
    pub replaced: Vec<String>,
    pub dropped: Vec<Dropped>,
    pub notes: Vec<String>,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Options {
    pub allow_beta: bool,
}

fn mods_dir(inst: &Instance) -> std::path::PathBuf {
    inst.game_dir().join("mods")
}

/// Put the planned jars into the instance, removing older tracked versions of the same project.
pub fn apply(inst: &Instance, plan: &Plan, report: &mut Report) -> Result<()> {
    let src = ModrinthSource;
    let installed = content::list(inst, content::Kind::Mod);
    std::fs::create_dir_all(mods_dir(inst))?;
    for c in &plan.chosen {
        let Some(f) = c.cand.version.primary_file() else { continue };
        let already = installed.iter().any(|e| e.file == f.filename && e.enabled);
        if already {
            continue;
        }
        for old in installed.iter().filter(|e| e.project_id.as_deref() == Some(c.cand.project.id.as_str())) {
            let _ = content::remove(inst, content::Kind::Mod, &old.file);
            report.replaced.push(format!("{} {} -> {}", c.name, old.version, c.cand.version.version_number));
        }
        let jar = src.jar(&c.cand)?;
        std::fs::copy(&jar, mods_dir(inst).join(&f.filename))?;
        content::install_version(inst, content::Kind::Mod, &c.cand.project, &c.cand.version)?;
        report.installed.push(format!("{} {}", c.name, c.cand.version.version_number));
    }
    Ok(())
}

/// Install a set of preset mods with the solver (replaces "newest version of each").
pub fn install_wants(inst: &Instance, env: &Env, wants: &[Want], opts: Options) -> Result<Report> {
    let fixed = fixed_from_disk(inst, &[])?;
    let plan = solve(&ModrinthSource, env, &fixed, wants, opts.allow_beta)?;
    let mut report = Report { minecraft: env.minecraft.clone(), ..Default::default() };
    apply(inst, &plan, &mut report)?;
    report.dropped = plan.dropped;
    report.notes = plan.notes;
    report.ok = true;
    report.checked = plan.chosen.len();
    Ok(report)
}

fn fixed_from_disk(inst: &Instance, skip_projects: &[String]) -> Result<Vec<Fixed>> {
    let mut out = vec![];
    for e in content::list(inst, content::Kind::Mod).into_iter().filter(|e| e.enabled) {
        if let Some(p) = &e.project_id {
            if skip_projects.contains(p) {
                continue;
            }
        }
        if e.project_id.is_some() && skip_projects.is_empty() {
            // tracked: already part of the instance, treat as fixed when not being re-solved
        }
        if let Ok(bytes) = std::fs::read(mods_dir(inst).join(&e.file)) {
            if let Ok(meta) = read_meta(&bytes) {
                out.push(Fixed { label: e.file.clone(), meta });
            }
        }
    }
    Ok(out)
}

fn looks_prerelease(v: &str) -> bool {
    let l = v.to_lowercase();
    ["beta", "alpha", "snapshot", "-rc", "-pre", "nightly"].iter().any(|k| l.contains(k))
}

/// Run before every launch. Reads each enabled jar's `fabric.mod.json`, evaluates the whole set for
/// this Minecraft, and repairs what Fabric would refuse: swaps in compatible stable versions,
/// refreshes the Luminos Client jar for this Minecraft, and disables (never deletes) a mod that
/// cannot be satisfied, recording why. Fast path: no network when everything already checks out.
pub fn prelaunch(inst: &Instance, env: &Env, opts: Options) -> Result<Report> {
    let mut report = Report { minecraft: env.minecraft.clone(), ..Default::default() };
    if inst.loader != Loader::Fabric || !mods_dir(inst).exists() {
        report.ok = true;
        return Ok(report);
    }
    // 1. Luminos Client jar built for another Minecraft: fetch the right build (compat manifest).
    let load = |inst: &Instance| -> Vec<(content::Entry, ModMeta)> {
        content::list(inst, content::Kind::Mod)
            .into_iter()
            .filter(|e| e.enabled)
            .filter_map(|e| {
                let bytes = std::fs::read(mods_dir(inst).join(&e.file)).ok()?;
                read_meta(&bytes).ok().map(|m| (e, m))
            })
            .collect()
    };
    let mut jars = load(inst);
    let own_problem = jars.iter().any(|(_, m)| m.id() == "luminos_client" && !check(env, &[m]).iter().all(|p| p.dep != "minecraft"));
    if own_problem {
        match crate::preset::install_first_party(inst) {
            Ok(n) => {
                report.replaced.push(format!("Luminos Client -> {n} (built for Minecraft {})", env.minecraft));
                jars = load(inst);
            }
            Err(e) => {
                for (entry, m) in jars.iter().filter(|(_, m)| m.id() == "luminos_client") {
                    let _ = content::set_enabled(inst, content::Kind::Mod, &entry.file, false);
                    report.dropped.push(Dropped {
                        slug: "luminos_client".into(),
                        name: "Luminos Client".into(),
                        reason: format!("version {} does not support Minecraft {}: {e:#}", m.version(), env.minecraft),
                    });
                }
                jars = load(inst);
            }
        }
    }
    report.checked = jars.len();
    // 2. Is anything wrong?
    let metas: Vec<&ModMeta> = jars.iter().map(|(_, m)| m).collect();
    let problems = check(env, &metas);
    let unstable: Vec<&(content::Entry, ModMeta)> = if opts.allow_beta {
        vec![]
    } else {
        jars.iter().filter(|(e, m)| e.project_id.is_some() && looks_prerelease(m.version()) && m.id() != "luminos_client").collect()
    };
    if problems.is_empty() && unstable.is_empty() {
        report.ok = true;
        return Ok(report);
    }
    // 3. Re-solve the Modrinth-tracked mods around the jars we do not own.
    let tracked: Vec<(content::Entry, ModMeta)> = jars
        .iter()
        .filter(|(e, m)| e.project_id.is_some() && m.id() != "luminos_client")
        .cloned()
        .collect();
    let tracked_ids: Vec<String> = tracked.iter().filter_map(|(e, _)| e.project_id.clone()).collect();
    let fixed: Vec<Fixed> = jars
        .iter()
        .filter(|(e, m)| e.project_id.is_none() || m.id() == "luminos_client")
        .map(|(e, m)| Fixed { label: e.file.clone(), meta: m.clone() })
        .collect();
    let mut wants: Vec<Want> = tracked
        .iter()
        .map(|(e, m)| Want { slug: e.project_id.clone().unwrap(), name: e.display_name.clone(), required: m.id() == "fabric-api" })
        .collect();
    wants.sort_by_key(|w| !w.required);
    let plan = solve(&ModrinthSource, env, &fixed, &wants, opts.allow_beta).context("solving mod versions")?;
    let dropped_ids: HashSet<String> = plan.dropped.iter().map(|d| d.slug.clone()).collect();
    // Anything tracked that was not chosen and not dropped is simply kept (never silently lost).
    for pid in &tracked_ids {
        if dropped_ids.contains(pid) {
            for (e, _) in tracked.iter().filter(|(e, _)| e.project_id.as_deref() == Some(pid.as_str())) {
                let _ = content::set_enabled(inst, content::Kind::Mod, &e.file, false);
            }
        }
    }
    apply(inst, &plan, &mut report)?;
    report.dropped.extend(plan.dropped.clone());
    report.notes.extend(plan.notes.clone());
    // 4. Whatever still fails belongs to a jar the user added: disable it so the game starts.
    for _ in 0..4 {
        let now = load(inst);
        let refs: Vec<&ModMeta> = now.iter().map(|(_, m)| m).collect();
        let left = check(env, &refs);
        if left.is_empty() {
            break;
        }
        let mut progressed = false;
        for p in &left {
            if let Some((e, _)) = now.iter().find(|(_, m)| m.units.iter().any(|u| u.id == p.owner)) {
                if content::set_enabled(inst, content::Kind::Mod, &e.file, false).is_ok() {
                    report.dropped.push(Dropped {
                        slug: p.owner.clone(),
                        name: e.display_name.clone(),
                        reason: p.describe(),
                    });
                    progressed = true;
                }
            }
        }
        if !progressed {
            break;
        }
    }
    let now = load(inst);
    let refs: Vec<&ModMeta> = now.iter().map(|(_, m)| m).collect();
    report.ok = check(env, &refs).is_empty();
    let _ = store::write_json(&inst.dir().join("resolve-report.json"), &report);
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unit(id: &str, ver: &str, deps: &[(&str, &str)], breaks: &[(&str, &str)]) -> ModMeta {
        ModMeta {
            units: vec![Unit {
                id: id.into(),
                version: ver.into(),
                provides: vec![],
                depends: deps.iter().map(|(k, v)| (k.to_string(), Req::parse(v))).collect(),
                breaks: breaks.iter().map(|(k, v)| (k.to_string(), Req::parse(v))).collect(),
            }],
        }
    }
    fn env(mc: &str) -> Env {
        Env { minecraft: mc.into(), loader: "0.20.1".into(), java: 25 }
    }

    #[test]
    fn predicates_follow_fabric_semantics() {
        assert!(Req::parse("~1.21.4").matches("1.21.11"));
        assert!(!Req::parse("~1.21.4").matches("26.3"));
        assert!(Req::parse(">=1.21.4 <1.22").matches("1.21.11"));
        assert!(Req::parse(">=1.21.4").matches("26.3"));
        assert!(Req::parse("1.21.x").matches("1.21.4"));
        assert!(!Req::parse("1.21.x").matches("1.22"));
        assert!(Req::parse("0.9.3").matches("0.9.3+mc26.3"));
        assert!(!Req::parse("0.9.3").matches("0.9.4-beta.1"));
        assert!(Req::parse("^1.2.3").matches("1.9.0"));
        assert!(!Req::parse("^1.2.3").matches("2.0.0"));
        assert!(Req::parse("1.21.4 || 26.3").matches("26.3"));
        assert!(Req::parse("*").matches("anything"));
        assert!(Ver::parse("0.9.4-beta.1").unwrap() < Ver::parse("0.9.4").unwrap());
        assert!(Ver::parse("26.3").unwrap() > Ver::parse("1.21.11").unwrap());
        assert!(Req::parse(">=21").matches("25"));
    }

    #[test]
    fn the_old_client_jar_is_rejected_on_26_3_and_accepted_on_1_21_11() {
        let old = unit("luminos_client", "0.2.0", &[("minecraft", "~1.21.4"), ("java", ">=21")], &[]);
        let p = check(&env("26.3"), &[&old]);
        assert_eq!(p.len(), 1);
        assert_eq!(p[0].dep, "minecraft");
        assert!(check(&env("1.21.11"), &[&old]).is_empty());
    }

    #[test]
    fn nested_jars_provide_fabric_api_modules() {
        let mut api = unit("fabric-api", "0.166.2", &[], &[]);
        api.units.push(Unit { id: "fabric-resource-loader-v0".into(), version: "3.0.0".into(), ..Default::default() });
        let user = unit("m", "1", &[("fabric-resource-loader-v0", ">=2.0")], &[]);
        assert!(check(&env("26.3"), &[&api, &user]).is_empty());
        assert_eq!(check(&env("26.3"), &[&user]).len(), 1);
    }

    struct Fake(HashMap<String, Vec<(Cand, ModMeta)>>);
    impl Fake {
        fn add(&mut self, slug: &str, ver: &str, channel: &str, meta: ModMeta) {
            let mut c = Cand { slug: slug.into(), ..Default::default() };
            c.project.id = slug.into();
            c.project.slug = slug.into();
            c.project.title = slug.into();
            c.version.id = format!("{slug}-{ver}");
            c.version.version_number = ver.into();
            c.version.version_type = channel.into();
            self.0.entry(slug.into()).or_default().push((c, meta));
        }
    }
    impl Source for Fake {
        fn candidates(&self, slug: &str, _: &Env) -> Result<Vec<Cand>> {
            Ok(self.0.get(slug).map(|v| v.iter().map(|(c, _)| c.clone()).collect()).unwrap_or_default())
        }
        fn meta(&self, c: &Cand) -> Result<ModMeta> {
            self.0[&c.slug].iter().find(|(x, _)| x.version.id == c.version.id).map(|(_, m)| m.clone()).ok_or_else(|| anyhow!("none"))
        }
    }
    fn want(s: &str, req: bool) -> Want {
        Want { slug: s.into(), name: s.into(), required: req }
    }

    /// The exact failure from the bug report: newest Sodium is a beta, Sodium Extra needs 0.9.3.
    fn sodium_world() -> Fake {
        let mut f = Fake(HashMap::new());
        f.add("sodium", "mc26.3-0.9.4-beta.1-fabric", "beta", unit("sodium", "0.9.4-beta.1+mc26.3", &[("minecraft", "26.3")], &[]));
        f.add("sodium", "mc26.3-0.9.3-fabric", "release", unit("sodium", "0.9.3+mc26.3", &[("minecraft", "26.3")], &[]));
        f.add("sodium-extra", "0.9.6", "release", unit("sodium-extra", "0.9.6", &[("sodium", "0.9.3")], &[]));
        f
    }

    #[test]
    fn stable_sodium_is_chosen_not_the_beta() {
        let f = sodium_world();
        let plan = solve(&f, &env("26.3"), &[], &[want("sodium", false), want("sodium-extra", false)], false).unwrap();
        let v: Vec<&str> = plan.chosen.iter().map(|c| c.cand.version.version_number.as_str()).collect();
        assert_eq!(v, vec!["mc26.3-0.9.3-fabric", "0.9.6"]);
        assert!(plan.dropped.is_empty());
    }

    #[test]
    fn with_betas_allowed_sodium_is_downgraded_so_the_extra_still_loads() {
        let f = sodium_world();
        let plan = solve(&f, &env("26.3"), &[], &[want("sodium", false), want("sodium-extra", false)], true).unwrap();
        assert!(plan.dropped.is_empty(), "{:?}", plan.dropped);
        assert!(plan.chosen.iter().any(|c| c.cand.version.version_number == "mc26.3-0.9.3-fabric"));
        assert!(plan.notes.iter().any(|n| n.contains("so sodium-extra can load")), "{:?}", plan.notes);
    }

    #[test]
    fn an_optional_mod_that_cannot_be_satisfied_is_dropped_with_a_reason() {
        let mut f = Fake(HashMap::new());
        f.add("sodium", "0.9.3", "release", unit("sodium", "0.9.3", &[], &[]));
        f.add("old-extra", "1", "release", unit("old-extra", "1", &[("sodium", "0.8.0")], &[]));
        let plan = solve(&f, &env("26.3"), &[], &[want("sodium", true), want("old-extra", false)], false).unwrap();
        assert_eq!(plan.chosen.len(), 1);
        assert_eq!(plan.dropped.len(), 1);
        assert!(plan.dropped[0].reason.contains("sodium") && plan.dropped[0].reason.contains("0.8.0"), "{}", plan.dropped[0].reason);
    }

    #[test]
    fn beta_only_mods_are_dropped_unless_opted_in() {
        let mut f = Fake(HashMap::new());
        f.add("shiny", "1.0-beta", "beta", unit("shiny", "1.0.0-beta.1", &[], &[]));
        let off = solve(&f, &env("26.3"), &[], &[want("shiny", false)], false).unwrap();
        assert!(off.chosen.is_empty());
        assert!(off.dropped[0].reason.contains("Allow beta"));
        let on = solve(&f, &env("26.3"), &[], &[want("shiny", false)], true).unwrap();
        assert_eq!(on.chosen.len(), 1);
    }

    #[test]
    fn a_required_mod_that_cannot_be_satisfied_is_a_hard_error() {
        let f = Fake(HashMap::new());
        assert!(solve(&f, &env("26.3"), &[], &[want("fabric-api", true)], false).is_err());
    }

    #[test]
    fn breaks_is_enforced() {
        let mut f = Fake(HashMap::new());
        f.add("a", "1", "release", unit("a", "1", &[], &[]));
        f.add("b", "1", "release", unit("b", "1", &[], &[("a", "*")]));
        let plan = solve(&f, &env("26.3"), &[], &[want("a", false), want("b", false)], false).unwrap();
        assert_eq!(plan.dropped.len(), 1);
        assert!(plan.dropped[0].reason.contains("cannot run together"));
    }

    #[test]
    fn reads_a_real_jar_layout_including_nested_jars() {
        use std::io::Write;
        let mut inner = Cursor::new(vec![]);
        {
            let mut z = zip::ZipWriter::new(&mut inner);
            z.start_file("fabric.mod.json", zip::write::SimpleFileOptions::default()).unwrap();
            z.write_all(br#"{"schemaVersion":1,"id":"nested-mod","version":"2.0.0","depends":{"minecraft":">=26"}}"#).unwrap();
            z.finish().unwrap();
        }
        let mut outer = Cursor::new(vec![]);
        {
            let mut z = zip::ZipWriter::new(&mut outer);
            let o = zip::write::SimpleFileOptions::default();
            z.start_file("fabric.mod.json", o).unwrap();
            z.write_all(br#"{"schemaVersion":1,"id":"host","version":"1.0.0","provides":["alias"],"depends":{"minecraft":["1.21.x","26.3"],"fabricloader":">=0.16"},"breaks":{"badmod":"*"},"jars":[{"file":"META-INF/jars/n.jar"}]}"#).unwrap();
            z.start_file("META-INF/jars/n.jar", o).unwrap();
            z.write_all(&inner.into_inner()).unwrap();
            z.finish().unwrap();
        }
        let m = read_meta(&outer.into_inner()).unwrap();
        assert_eq!(m.units.len(), 2);
        assert_eq!(m.id(), "host");
        assert_eq!(m.units[0].provides, vec!["alias"]);
        assert!(check(&env("26.3"), &[&m]).is_empty());
        assert!(!check(&env("1.20.1"), &[&m]).is_empty());
    }
}
