//! Application state, background messaging and the window shell (title bar, sidebar, toasts).
use crate::{
    dither,
    icons::{self, Icon},
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{
    self, pos2, vec2, Align2, Color32, ColorImage, CornerRadius, FontId, Rect, Sense, Stroke,
    StrokeKind, TextureHandle, TextureOptions, Ui, UiBuilder,
};
use luminos_core::{
    accounts::{self, Account, AccountStore},
    config::Settings,
    content::{self, Entry, Kind, Update},
    download::Progress,
    instances::{self, Instance, Loader},
    java::JavaInstall,
    launch::{self, GameHandle},
    modrinth::{Project, SearchResult},
    mojang::Manifest,
    news::NewsItem,
    playtime,
    skins::{self, SkinLibrary},
};
use std::{
    collections::{HashMap, HashSet},
    sync::{
        mpsc::{channel, Receiver, Sender},
        Arc,
    },
    time::Duration,
};

pub const SIDEBAR_W: f32 = 212.0;
pub const TITLE_H: f32 = 40.0;

pub enum Loadable<T> {
    Idle,
    Loading,
    Ready(T),
    Failed(String),
}

impl<T> Loadable<T> {
    pub fn ready(&self) -> Option<&T> {
        match self {
            Loadable::Ready(t) => Some(t),
            _ => None,
        }
    }
    pub fn is_loading(&self) -> bool {
        matches!(self, Loadable::Loading)
    }
}

#[derive(Clone, PartialEq, Debug)]
pub enum Page {
    Home,
    Discover,
    Library,
    Instance(String),
    Skins,
    Servers,
    Stats,
    Settings,
    Network,
}

#[derive(Clone, Copy, PartialEq)]
pub enum ToastKind {
    Info,
    Good,
    Bad,
}

pub struct Toast {
    pub text: String,
    pub kind: ToastKind,
    pub born: f64,
}

pub enum Msg {
    Manifest(Result<Manifest, String>),
    News(Result<Vec<NewsItem>, String>),
    Featured(Result<Vec<Project>, String>),
    Search(u64, Result<SearchResult, String>),
    Icon(String, Option<ColorImage>),
    Toast(String, ToastKind),
    Instances,
    Content,
    Updates(Result<Vec<Update>, String>),
    Java(Vec<JavaInstall>),
    Launched(Result<GameHandle, String>),
    GameExit(String, i32),
    SkinFetched(Result<(String, Vec<u8>), String>),
    Busy(Option<String>),
    Created {
        result: Result<Instance, String>,
        from_wizard: bool,
    },
    Ping(String, Result<luminos_core::servers::Status, String>),
    LoginMode(String, Result<luminos_core::loginprobe::LoginMode, String>),
    SignedIn(Result<Account, String>),
    AccountUpdated(Account),
}

/// Cheap, cloneable handle that worker threads use to talk to the UI.
#[derive(Clone)]
pub struct Bg {
    tx: Sender<Msg>,
    ctx: egui::Context,
}

impl Bg {
    pub fn send(&self, m: Msg) {
        let _ = self.tx.send(m);
        self.ctx.request_repaint();
    }
}

pub struct Launching {
    pub id: String,
    pub name: String,
    pub progress: Arc<Progress>,
}

pub struct Wizard {
    pub step: usize,
    pub step_t0: f64,
    pub name: String,
    pub choice: u8,
    pub mc_version: String,
    pub installing: bool,
    pub finished: bool,
    pub progress: Arc<Progress>,
    pub error: Option<String>,
}

pub struct CreateState {
    pub name: String,
    pub loader: Loader,
    pub mc_version: String,
    pub preset_client: bool,
    pub busy: bool,
    pub error: Option<String>,
    pub show_snapshots: bool,
}

pub struct DiscoverState {
    pub query: String,
    pub kind: &'static str,
    pub sort: &'static str,
    pub filter_loader: bool,
    pub filter_version: bool,
    pub results: Loadable<SearchResult>,
    pub generation: u64,
    pub installing: HashSet<String>,
    pub target: Option<String>,
    pub key: String,
    pub submitted: String,
    pub list_view: bool,
    pub page: u32,
}

#[derive(Clone, Copy, PartialEq)]
pub enum DTab {
    Content,
    Worlds,
    Logs,
    Settings,
}

pub struct DetailState {
    pub tab: DTab,
    pub kind: Kind,
    pub entries: Vec<Entry>,
    pub filter: String,
    pub updates: Loadable<Vec<Update>>,
    pub busy: Option<String>,
    pub confirm_delete: bool,
    /// Findings from the crash doctor (empty = analyse the live log instead).
    pub crash: Vec<luminos_core::crash::Finding>,
}

/// Saved servers plus their latest ping result.
pub struct ServersState {
    pub list: Vec<luminos_core::servers::SavedServer>,
    pub status: HashMap<String, Loadable<luminos_core::servers::Status>>,
    pub name: String,
    pub addr: String,
    pub pinged: bool,
    pub modes: HashMap<String, Result<luminos_core::loginprobe::LoginMode, String>>,
    pub checking: std::collections::HashSet<String>,
    /// Time the page was first shown (egui seconds); drives the staggered entrance. Negative = not yet shown.
    pub t0: f64,
}

pub struct Editor {
    pub pixels: Vec<Color32>,
    pub tool: usize,
    pub color: Color32,
    pub undo: Vec<Vec<Color32>>,
    pub tex: Option<TextureHandle>,
    pub dirty: bool,
    pub slim: bool,
    pub name: String,
}

pub struct SkinState {
    pub lib: SkinLibrary,
    pub tex: HashMap<String, TextureHandle>,
    pub selected: Option<String>,
    pub username: String,
    pub fetching: bool,
    pub editor: Editor,
    pub editing: bool,
}

pub struct App {
    pub ctx: egui::Context,
    tx: Sender<Msg>,
    rx: Receiver<Msg>,
    pub persist: bool,
    pub time: f64,
    pub settings: Settings,
    pub accounts: AccountStore,
    pub instances: Vec<Instance>,
    pub playtime: playtime::Log,
    pub page: Page,
    pub page_t0: f64,
    pub account_menu: bool,
    pub new_account: String,
    pub acct_kind: u8,
    pub acct_login: String,
    pub acct_pass: String,
    pub acct_api: String,
    pub acct_busy: bool,
    backdrop: Option<TextureHandle>,
    backdrop_key: (usize, usize, i64),
    pub rail_tex: Option<TextureHandle>,
    pub manifest: Loadable<Manifest>,
    pub news: Loadable<Vec<NewsItem>>,
    pub featured: Loadable<Vec<Project>>,
    pub wizard: Wizard,
    pub create: Option<CreateState>,
    pub discover: DiscoverState,
    pub detail: DetailState,
    pub skins: SkinState,
    pub servers: ServersState,
    pub java_list: Loadable<Vec<JavaInstall>>,
    pub game: Option<GameHandle>,
    pub last_log: Vec<String>,
    pub launching: Option<Launching>,
    pub toasts: Vec<Toast>,
    pub icons: HashMap<String, Option<TextureHandle>>,
    icon_inflight: HashSet<String>,
    applied_accent: Option<u8>,
    pub maximized: bool,
}

impl App {
    pub fn new(ctx: &egui::Context, persist: bool) -> Self {
        theme::install_fonts(ctx);
        let (tx, rx) = channel();
        let settings = if persist {
            Settings::load()
        } else {
            Settings {
                setup_done: true,
                ..Default::default()
            }
        };
        let mut app = App {
            ctx: ctx.clone(),
            tx,
            rx,
            persist,
            time: 0.0,
            accounts: if persist {
                AccountStore::load()
            } else {
                AccountStore::default()
            },
            instances: if persist { instances::list() } else { vec![] },
            playtime: if persist {
                playtime::load()
            } else {
                playtime::Log::default()
            },
            settings,
            page: Page::Home,
            page_t0: 0.0,
            account_menu: false,
            new_account: String::new(),
            acct_kind: 0,
            acct_login: String::new(),
            acct_pass: String::new(),
            acct_api: String::new(),
            acct_busy: false,
            backdrop: None,
            backdrop_key: (0, 0, -1),
            rail_tex: None,
            manifest: Loadable::Idle,
            news: Loadable::Idle,
            featured: Loadable::Idle,
            wizard: Wizard {
                step: 0,
                step_t0: 0.0,
                name: String::new(),
                choice: 0,
                mc_version: String::new(),
                installing: false,
                finished: false,
                progress: Progress::new(),
                error: None,
            },
            create: None,
            discover: DiscoverState {
                query: String::new(),
                kind: "mod",
                sort: "downloads",
                filter_loader: true,
                filter_version: true,
                results: Loadable::Idle,
                generation: 0,
                installing: HashSet::new(),
                target: None,
                key: String::new(),
                submitted: String::new(),
                list_view: false,
                page: 0,
            },
            detail: DetailState {
                tab: DTab::Content,
                kind: Kind::Mod,
                entries: vec![],
                filter: String::new(),
                updates: Loadable::Idle,
                busy: None,
                confirm_delete: false,
                crash: vec![],
            },
            skins: crate::pages::skins::new_state(),
            servers: ServersState {
                list: if persist {
                    luminos_core::servers::load()
                } else {
                    vec![]
                },
                status: HashMap::new(),
                name: String::new(),
                addr: String::new(),
                pinged: false,
                modes: HashMap::new(),
                checking: Default::default(),
                t0: -1.0,
            },
            java_list: Loadable::Idle,
            game: None,
            last_log: vec![],
            launching: None,
            toasts: vec![],
            icons: HashMap::new(),
            icon_inflight: HashSet::new(),
            applied_accent: None,
            maximized: false,
        };
        if persist {
            app.skins.lib = skins::load();
            app.start_background_loads();
        }
        app
    }

    pub fn bg(&self) -> Bg {
        Bg {
            tx: self.tx.clone(),
            ctx: self.ctx.clone(),
        }
    }

    pub fn accent(&self) -> Color32 {
        theme::accent(self.settings.accent)
    }

    pub fn toast(&mut self, text: impl Into<String>, kind: ToastKind) {
        self.toasts.push(Toast {
            text: text.into(),
            kind,
            born: self.time,
        });
    }

    pub fn goto(&mut self, page: Page) {
        if self.page != page {
            self.page = page;
            self.page_t0 = self.time;
        }
    }

    pub fn open_instance(&mut self, id: &str) {
        self.detail.tab = DTab::Content;
        self.detail.kind = Kind::Mod;
        self.detail.updates = Loadable::Idle;
        self.detail.confirm_delete = false;
        self.detail.filter.clear();
        self.goto(Page::Instance(id.to_string()));
        self.reload_content();
    }

    pub fn instance(&self, id: &str) -> Option<&Instance> {
        self.instances.iter().find(|i| i.id == id)
    }

    pub fn reload_instances(&mut self) {
        if self.persist {
            self.instances = instances::list();
        }
    }

    pub fn reload_content(&mut self) {
        if !self.persist {
            return;
        }
        if let Page::Instance(id) = self.page.clone() {
            if let Some(inst) = self.instance(&id).cloned() {
                self.detail.entries = content::list(&inst, self.detail.kind);
            }
        }
    }

    fn start_background_loads(&mut self) {
        let bg = self.bg();
        self.manifest = Loadable::Loading;
        std::thread::spawn({
            let bg = bg.clone();
            move || {
                bg.send(Msg::Manifest(
                    luminos_core::mojang::fetch_manifest().map_err(|e| format!("{e:#}")),
                ))
            }
        });
        self.news = Loadable::Loading;
        std::thread::spawn({
            let bg = bg.clone();
            move || {
                bg.send(Msg::News(
                    luminos_core::news::fetch(6).map_err(|e| format!("{e:#}")),
                ))
            }
        });
        self.featured = Loadable::Loading;
        std::thread::spawn({
            let bg = bg.clone();
            move || {
                let q = luminos_core::modrinth::SearchQuery {
                    project_type: "modpack".into(),
                    sort: "downloads".into(),
                    limit: 3,
                    ..Default::default()
                };
                bg.send(Msg::Featured(
                    luminos_core::modrinth::search(&q)
                        .map(|r| r.hits)
                        .map_err(|e| format!("{e:#}")),
                ));
            }
        });
        self.java_list = Loadable::Loading;
        std::thread::spawn(move || bg.send(Msg::Java(luminos_core::java::detect())));
    }

    /// Lazily fetch and cache a remote icon/image as a texture.
    pub fn icon_tex(&mut self, url: &str) -> Option<egui::TextureId> {
        match self.icons.get(url) {
            Some(Some(t)) => return Some(t.id()),
            Some(None) => return None,
            None => {}
        }
        if self.persist && !self.icon_inflight.contains(url) && self.icon_inflight.len() < 10 {
            self.icon_inflight.insert(url.to_string());
            let bg = self.bg();
            let url = url.to_string();
            std::thread::spawn(move || {
                let img = luminos_core::http::get_bytes(&url)
                    .ok()
                    .and_then(|b| image::load_from_memory(&b).ok())
                    .map(|im| {
                        let im = if im.width() > 640 {
                            im.resize(640, 640, image::imageops::FilterType::Triangle)
                        } else {
                            im
                        };
                        let rgba = im.to_rgba8();
                        ColorImage::from_rgba_unmultiplied(
                            [rgba.width() as usize, rgba.height() as usize],
                            rgba.as_raw(),
                        )
                    });
                bg.send(Msg::Icon(url, img));
            });
        }
        None
    }

    /// Draw an icon/image URL into `rect`, or the fallback closure while loading.
    pub fn paint_remote(
        &mut self,
        ui: &Ui,
        rect: Rect,
        url: Option<&str>,
        radius: u8,
        fallback: impl FnOnce(&Ui),
    ) {
        if let Some(id) = url.and_then(|u| self.icon_tex(u)) {
            ui.painter().add(
                egui::epaint::RectShape::filled(rect, CornerRadius::same(radius), Color32::WHITE)
                    .with_texture(id, Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0))),
            );
        } else {
            fallback(ui);
        }
    }

    pub fn play(&mut self, id: &str) {
        self.play_ext(id, None);
    }

    /// Launch `id`, optionally joining `quick` (host[:port]) after a login pre-flight.
    pub fn play_ext(&mut self, id: &str, quick: Option<String>) {
        if self.game.is_some() || self.launching.is_some() {
            self.toast("A game is already running", ToastKind::Info);
            return;
        }
        let Some(inst) = self.instance(id).cloned() else {
            return;
        };
        let Some(acc) = self.accounts.active().cloned() else {
            self.toast("Add an account first", ToastKind::Bad);
            return;
        };
        if !inst.loader.supported() {
            self.toast(
                format!("{} launching is not supported yet", inst.loader.label()),
                ToastKind::Bad,
            );
            return;
        }
        if !self.persist {
            return;
        }
        let progress = Progress::new();
        self.launching = Some(Launching {
            id: inst.id.clone(),
            name: inst.name.clone(),
            progress: progress.clone(),
        });
        let settings = self.settings.clone();
        let bg = self.bg();
        std::thread::spawn(move || {
            if settings.auto_update_content {
                progress.set_stage("Checking for mod updates…");
                let _ = content::update_all(&inst);
            }
            let mut acc = acc;
            if acc.kind.uses_injector() {
                progress.set_stage("Refreshing your session…");
                if let Err(e) = luminos_core::yggdrasil::ensure_fresh(&mut acc) {
                    bg.send(Msg::Launched(Err(format!("{e:#}"))));
                    return;
                }
                bg.send(Msg::AccountUpdated(acc.clone()));
            }
            if let Some(addr) = &quick {
                progress.set_stage("Checking that the server accepts your account…");
                if let Err(m) = preflight(addr, &acc) {
                    bg.send(Msg::Launched(Err(m)));
                    return;
                }
            }
            match launch::prepare(&inst, &settings, &progress)
                .and_then(|p| launch::spawn_ext(&inst, &settings, &acc, &p, quick.as_deref()))
            {
                Ok(h) => {
                    bg.send(Msg::Launched(Ok(h.clone())));
                    let code = launch::wait_and_record(&h);
                    bg.send(Msg::GameExit(inst.id.clone(), code));
                }
                Err(e) => bg.send(Msg::Launched(Err(format!("{e:#}")))),
            }
        });
    }

    /// Ping one saved server on a worker thread.
    pub fn ping_server(&mut self, addr: &str) {
        if !self.persist {
            return;
        }
        self.servers
            .status
            .insert(addr.to_string(), Loadable::Loading);
        let (bg, a) = (self.bg(), addr.to_string());
        std::thread::spawn(move || {
            let r = luminos_core::servers::ping(&a).map_err(|e| format!("{e:#}"));
            bg.send(Msg::Ping(a, r));
        });
    }

    /// Ask the server whether it would accept the active account (a real login handshake; never bypasses online-mode).
    pub fn check_mode(&mut self, addr: &str) {
        if !self.persist {
            return;
        }
        self.servers.checking.insert(addr.to_string());
        let name = self
            .accounts
            .active()
            .map(|a| a.username.clone())
            .unwrap_or_else(|| "LuminosCheck".into());
        let (bg, a) = (self.bg(), addr.to_string());
        std::thread::spawn(move || {
            let r = luminos_core::servers::ping(&a)
                .map_err(|e| format!("Can't reach the server: {e:#}"))
                .and_then(|st| {
                    luminos_core::loginprobe::probe(&a, st.protocol, &name)
                        .map_err(|e| format!("{e:#}"))
                });
            bg.send(Msg::LoginMode(a, r));
        });
    }

    pub fn ping_all(&mut self) {
        let addrs: Vec<String> = self
            .servers
            .list
            .iter()
            .map(|s| s.address.clone())
            .collect();
        for a in addrs {
            self.ping_server(&a);
        }
    }

    fn handle(&mut self, m: Msg) {
        match m {
            Msg::LoginMode(addr, r) => {
                self.servers.checking.remove(&addr);
                match &r {
                    Ok(m) => {
                        let tag = match m {
                            luminos_core::loginprobe::LoginMode::OfflineOk => "offline-ok",
                            luminos_core::loginprobe::LoginMode::OnlineRequired => {
                                "online-required"
                            }
                            luminos_core::loginprobe::LoginMode::Whitelisted => "whitelisted",
                            _ => "other",
                        };
                        if let Some(sv) = self.servers.list.iter_mut().find(|s| s.address == addr) {
                            sv.login_mode = Some(tag.into());
                        }
                        if self.persist {
                            let _ = luminos_core::servers::save(&self.servers.list);
                        }
                    }
                    Err(e) => self.toast(e.clone(), ToastKind::Bad),
                }
                self.servers.modes.insert(addr, r);
            }
            Msg::SignedIn(r) => {
                self.acct_busy = false;
                match r {
                    Ok(acc) => {
                        self.toast(format!("Signed in as {}", acc.username), ToastKind::Good);
                        self.accounts.add(acc);
                        self.accounts.save();
                        self.acct_pass.clear();
                        self.acct_login.clear();
                    }
                    Err(e) => self.toast(format!("Sign-in failed: {e}"), ToastKind::Bad),
                }
            }
            Msg::AccountUpdated(acc) => {
                if let Some(a) = self
                    .accounts
                    .accounts
                    .iter_mut()
                    .find(|a| a.username == acc.username && a.kind == acc.kind)
                {
                    *a = acc;
                    self.accounts.save();
                }
            }
            Msg::Ping(addr, r) => {
                self.servers.status.insert(
                    addr,
                    r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed),
                );
            }
            Msg::Manifest(r) => match r {
                Ok(mf) => {
                    if self.wizard.mc_version.is_empty() {
                        self.wizard.mc_version = mf.latest.release.clone();
                    }
                    if let Some(c) = &mut self.create {
                        if c.mc_version.is_empty() {
                            c.mc_version = mf.latest.release.clone();
                        }
                    }
                    self.manifest = Loadable::Ready(mf);
                }
                Err(e) => self.manifest = Loadable::Failed(e),
            },
            Msg::News(r) => self.news = r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed),
            Msg::Featured(r) => {
                self.featured = r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed)
            }
            Msg::Search(g, r) => {
                if g == self.discover.generation {
                    self.discover.results = r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed);
                }
            }
            Msg::Icon(url, img) => {
                self.icon_inflight.remove(&url);
                let tex = img.map(|i| self.ctx.load_texture(&url, i, TextureOptions::LINEAR));
                self.icons.insert(url, tex);
            }
            Msg::Toast(t, k) => self.toast(t, k),
            Msg::Instances => self.reload_instances(),
            Msg::Content => {
                self.discover.installing.clear();
                self.reload_instances();
                self.reload_content();
            }
            Msg::Updates(r) => {
                self.detail.updates = r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed)
            }
            Msg::Java(j) => self.java_list = Loadable::Ready(j),
            Msg::Launched(r) => {
                self.launching = None;
                match r {
                    Ok(h) => {
                        self.toast("Game started — have fun!", ToastKind::Good);
                        self.game = Some(h);
                    }
                    Err(e) => self.toast(format!("Launch failed: {e}"), ToastKind::Bad),
                }
            }
            Msg::GameExit(_, code) => {
                if let Some(g) = &self.game {
                    self.last_log = g.log_tail(800);
                }
                self.game = None;
                self.reload_instances();
                if self.persist {
                    self.playtime = playtime::load();
                }
                if code == 0 {
                    self.toast("Game closed — playtime saved", ToastKind::Info);
                } else {
                    self.toast(
                        format!("Game exited with code {code}. Check the Logs tab."),
                        ToastKind::Bad,
                    );
                }
            }
            Msg::SkinFetched(r) => {
                self.skins.fetching = false;
                match r {
                    Ok((name, png)) => {
                        crate::pages::skins::import_png(self, &name, &png, "Minotar")
                    }
                    Err(e) => self.toast(format!("Skin fetch failed: {e}"), ToastKind::Bad),
                }
            }
            Msg::Busy(b) => {
                self.detail.busy = b;
            }
            Msg::Created {
                result,
                from_wizard,
            } => {
                self.discover.installing.clear();
                self.reload_instances();
                match result {
                    Ok(inst) => {
                        if from_wizard {
                            self.wizard.finished = true;
                            self.wizard.installing = false;
                        } else {
                            self.create = None;
                            self.toast(format!("Created {}", inst.name), ToastKind::Good);
                            self.open_instance(&inst.id);
                        }
                    }
                    Err(e) => {
                        if from_wizard {
                            self.wizard.installing = false;
                            self.wizard.error = Some(e);
                        } else if let Some(c) = &mut self.create {
                            c.busy = false;
                            c.error = Some(e);
                        } else {
                            self.toast(e, ToastKind::Bad);
                        }
                    }
                }
            }
        }
    }

    /// Flat ink background + (inside the app) one static dithered horizon under the title bar.
    fn paint_backdrop(&mut self, ui: &Ui, full: Rect) {
        ui.painter().rect_filled(full, 0.0, theme::BG0);
        if !self.settings.setup_done || !self.settings.dither_background {
            return;
        }
        let cell = 4.0;
        let w = ((full.width() - SIDEBAR_W) / cell).ceil().max(8.0) as usize;
        let h = 40usize;
        let key = (w, h, self.settings.accent as i64);
        if self.backdrop.is_none() || self.backdrop_key != key {
            let img = dither::band(w, h, self.accent());
            match &mut self.backdrop {
                Some(tex) => tex.set(img, TextureOptions::NEAREST),
                None => {
                    self.backdrop = Some(self.ctx.load_texture(
                        "luminos-band",
                        img,
                        TextureOptions::NEAREST,
                    ))
                }
            }
            self.backdrop_key = key;
        }
        if let Some(tex) = &self.backdrop {
            let r = Rect::from_min_size(
                pos2(full.left() + SIDEBAR_W, full.top() + TITLE_H),
                vec2(full.width() - SIDEBAR_W, h as f32 * cell),
            );
            ui.painter().image(
                tex.id(),
                r,
                Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0)),
                Color32::WHITE,
            );
        }
    }

    /// Custom window chrome: resize edges + title bar. Returns the rect below the title bar.
    fn chrome(&mut self, ui: &mut Ui, full: Rect) -> Rect {
        let accent = self.accent();
        if !self.maximized {
            use egui::{CursorIcon as C, ResizeDirection as D};
            let e = 5.0;
            let c = 12.0;
            let zones = [
                (
                    Rect::from_min_max(
                        full.left_top() + vec2(c, 0.0),
                        pos2(full.right() - c, full.top() + e),
                    ),
                    D::North,
                    C::ResizeVertical,
                ),
                (
                    Rect::from_min_max(
                        pos2(full.left() + c, full.bottom() - e),
                        full.right_bottom() - vec2(c, 0.0),
                    ),
                    D::South,
                    C::ResizeVertical,
                ),
                (
                    Rect::from_min_max(
                        full.left_top() + vec2(0.0, c),
                        pos2(full.left() + e, full.bottom() - c),
                    ),
                    D::West,
                    C::ResizeHorizontal,
                ),
                (
                    Rect::from_min_max(
                        pos2(full.right() - e, full.top() + c),
                        full.right_bottom() - vec2(0.0, c),
                    ),
                    D::East,
                    C::ResizeHorizontal,
                ),
                (
                    Rect::from_min_size(full.left_top(), vec2(c, c)),
                    D::NorthWest,
                    C::ResizeNwSe,
                ),
                (
                    Rect::from_min_size(pos2(full.right() - c, full.top()), vec2(c, c)),
                    D::NorthEast,
                    C::ResizeNeSw,
                ),
                (
                    Rect::from_min_size(pos2(full.left(), full.bottom() - c), vec2(c, c)),
                    D::SouthWest,
                    C::ResizeNeSw,
                ),
                (
                    Rect::from_min_size(pos2(full.right() - c, full.bottom() - c), vec2(c, c)),
                    D::SouthEast,
                    C::ResizeNwSe,
                ),
            ];
            for (i, (r, dir, cur)) in zones.into_iter().enumerate() {
                let resp = ui.interact(r, egui::Id::new(("resize", i)), Sense::drag());
                if resp.hovered() {
                    ui.ctx().set_cursor_icon(cur);
                }
                if resp.drag_started() {
                    ui.ctx()
                        .send_viewport_cmd(egui::ViewportCommand::BeginResize(dir));
                }
            }
        }
        let bar = Rect::from_min_size(full.min, vec2(full.width(), TITLE_H));
        let drag = ui.interact(
            Rect::from_min_max(
                bar.min + vec2(0.0, 4.0),
                pos2(bar.right() - 150.0, bar.bottom()),
            ),
            egui::Id::new("titlebar"),
            Sense::click_and_drag(),
        );
        if drag.drag_started() {
            ui.ctx().send_viewport_cmd(egui::ViewportCommand::StartDrag);
        }
        if drag.double_clicked() {
            self.maximized = !self.maximized;
            ui.ctx()
                .send_viewport_cmd(egui::ViewportCommand::Maximized(self.maximized));
        }
        let p = ui.painter();
        p.rect_filled(bar, 0.0, theme::BG0);
        p.line_segment(
            [bar.left_bottom(), bar.right_bottom()],
            Stroke::new(1.0, theme::LINE),
        );
        widgets::logo_mark(
            p,
            pos2(bar.left() + 26.0, bar.center().y),
            20.0,
            accent,
            0.0,
        );
        let g = p.layout_no_wrap(
            "LUMINOS".into(),
            FontId::new(12.5, theme::bold()),
            theme::TEXT,
        );
        let gw = g.size().x + 7.0 * 1.6;
        p.text(
            pos2(bar.left() + 44.0, bar.center().y),
            Align2::LEFT_CENTER,
            "L U M I N O S",
            FontId::new(11.5, theme::bold()),
            theme::TEXT,
        );
        p.text(
            pos2(bar.left() + 44.0 + gw + 22.0, bar.center().y + 0.5),
            Align2::LEFT_CENTER,
            format!("v{}", luminos_core::VERSION),
            FontId::new(10.5, egui::FontFamily::Monospace),
            theme::MUTED,
        );

        // running game badge
        if let Some(h) = self.game.clone() {
            let name = self
                .instance(&h.instance_id)
                .map(|i| i.name.clone())
                .unwrap_or_default();
            let mins = (luminos_core::store::now_unix() - h.started).max(0) / 60;
            let r = Rect::from_center_size(bar.center(), vec2(300.0, 26.0));
            ui.painter()
                .rect_filled(r, CornerRadius::same(3), theme::alpha(theme::GOOD, 24));
            ui.painter().rect_stroke(
                r,
                CornerRadius::same(3),
                Stroke::new(1.0, theme::alpha(theme::GOOD, 110)),
                StrokeKind::Inside,
            );
            let on = ((self.time * 2.0) as i64) % 2 == 0;
            ui.painter().rect_filled(
                Rect::from_center_size(r.left_center() + vec2(14.0, 0.0), vec2(6.0, 6.0)),
                0.0,
                if on {
                    theme::GOOD
                } else {
                    theme::alpha(theme::GOOD, 90)
                },
            );
            ui.painter().text(
                r.left_center() + vec2(28.0, 0.0),
                Align2::LEFT_CENTER,
                format!("PLAYING  {name}  {mins}m"),
                FontId::new(11.0, egui::FontFamily::Monospace),
                theme::TEXT,
            );
            let stop = Rect::from_center_size(r.right_center() - vec2(16.0, 0.0), vec2(24.0, 22.0));
            let resp = ui.interact(stop, egui::Id::new("stopgame"), Sense::click());
            icons::paint(
                ui.painter(),
                Icon::Stop,
                stop.center(),
                13.0,
                if resp.hovered() {
                    theme::BAD
                } else {
                    theme::MUTED
                },
            );
            if resp.on_hover_text("Stop game").clicked() {
                h.kill();
            }
            self.ctx.request_repaint_after(Duration::from_millis(500));
        }

        // window buttons: full-height flat squares
        let mut x = bar.right();
        for (i, (icon, tip)) in [
            (Icon::Close, "Close"),
            (Icon::Square, "Maximize"),
            (Icon::Minus, "Minimize"),
        ]
        .into_iter()
        .enumerate()
        {
            let r = Rect::from_min_max(pos2(x - 44.0, bar.top()), pos2(x, bar.bottom() - 1.0));
            x -= 44.0;
            let resp = ui.interact(r, egui::Id::new(("winbtn", i)), Sense::click());
            let h = ui
                .ctx()
                .animate_bool_with_time(resp.id, resp.hovered(), 0.08);
            let hot = if i == 0 { theme::BAD } else { theme::BG3 };
            ui.painter().rect_filled(
                r,
                0.0,
                theme::alpha(hot, (h * if i == 0 { 200.0 } else { 255.0 }) as u8),
            );
            icons::paint(
                ui.painter(),
                icon,
                r.center(),
                13.0,
                theme::mix(theme::MUTED, Color32::WHITE, h),
            );
            if resp.on_hover_text(tip).clicked() {
                match i {
                    0 => ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close),
                    1 => {
                        self.maximized = !self.maximized;
                        ui.ctx()
                            .send_viewport_cmd(egui::ViewportCommand::Maximized(self.maximized));
                    }
                    _ => ui
                        .ctx()
                        .send_viewport_cmd(egui::ViewportCommand::Minimized(true)),
                }
            }
        }
        Rect::from_min_max(pos2(full.left(), bar.bottom()), full.right_bottom())
    }

    fn sidebar(&mut self, ui: &mut Ui, rect: Rect) {
        let accent = self.accent();
        let p = ui.painter().clone();
        p.rect_filled(rect, 0.0, theme::BG1);
        p.line_segment(
            [rect.right_top(), rect.right_bottom()],
            Stroke::new(1.0, theme::LINE),
        );
        // account block
        let acct = Rect::from_min_size(rect.min + vec2(0.0, 0.0), vec2(rect.width(), 68.0));
        let resp = ui.interact(acct, egui::Id::new("avatar"), Sense::click());
        let h = ui
            .ctx()
            .animate_bool_with_time(resp.id, resp.hovered() || self.account_menu, 0.12);
        p.rect_filled(acct, 0.0, theme::alpha(theme::BG2, (h * 255.0) as u8));
        p.line_segment(
            [acct.left_bottom(), acct.right_bottom()],
            Stroke::new(1.0, theme::LINE),
        );
        let (name, kind) = self
            .accounts
            .active()
            .map(|a| (a.username.clone(), a.kind.label()))
            .unwrap_or_else(|| ("No account".into(), "—"));
        let tex = self
            .accounts
            .active()
            .and_then(|a| a.skin_id.clone())
            .and_then(|id| crate::pages::skins::skin_tex(self, &id));
        let av = Rect::from_min_size(acct.min + vec2(16.0, 16.0), vec2(36.0, 36.0));
        widgets::face(ui, av, tex.as_ref(), &name);
        p.text(
            acct.min + vec2(64.0, 22.0),
            Align2::LEFT_CENTER,
            &name,
            FontId::new(14.0, theme::bold()),
            theme::TEXT,
        );
        p.text(
            acct.min + vec2(64.0, 41.0),
            Align2::LEFT_CENTER,
            format!("{kind}  ▾"),
            FontId::new(10.0, egui::FontFamily::Monospace),
            theme::MUTED,
        );
        if resp
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            self.account_menu = !self.account_menu;
        }

        // nav
        let items = [
            (Icon::Home, "Home", Page::Home),
            (Icon::Compass, "Discover", Page::Discover),
            (Icon::Grid, "Library", Page::Library),
            (Icon::Server, "Servers", Page::Servers),
            (Icon::Shirt, "Skins", Page::Skins),
            (Icon::Chart, "Playtime", Page::Stats),
        ];
        let mut y = acct.bottom() + 12.0;
        for (i, (icon, label, page)) in items.into_iter().enumerate() {
            let active = self.page == page
                || (page == Page::Library && matches!(self.page, Page::Instance(_)));
            let r = Rect::from_min_size(pos2(rect.left(), y), vec2(rect.width() - 1.0, 36.0));
            if self.nav_button(ui, r, icon, label, active, accent, i) {
                self.goto(page);
            }
            y += 36.0;
        }
        y += 14.0;
        // instances header
        p.text(
            pos2(rect.left() + 18.0, y + 8.0),
            Align2::LEFT_CENTER,
            "INSTANCES",
            FontId::new(10.0, egui::FontFamily::Monospace),
            theme::MUTED,
        );
        let plus = Rect::from_center_size(pos2(rect.right() - 24.0, y + 8.0), vec2(24.0, 22.0));
        let pr = ui.interact(plus, egui::Id::new("newinst"), Sense::click());
        icons::paint(
            &p,
            Icon::Plus,
            plus.center(),
            14.0,
            if pr.hovered() { accent } else { theme::MUTED },
        );
        if pr.on_hover_text("New instance").clicked() {
            self.open_create();
        }
        y += 24.0;
        let room = ((rect.bottom() - y - 58.0) / 40.0).max(0.0) as usize;
        let recent: Vec<Instance> = self.instances.iter().take(room.min(7)).cloned().collect();
        for (i, inst) in recent.iter().enumerate() {
            let r = Rect::from_min_size(pos2(rect.left(), y), vec2(rect.width() - 1.0, 38.0));
            let resp = ui.interact(r, egui::Id::new(("recent", i)), Sense::click());
            let h = ui
                .ctx()
                .animate_bool_with_time(resp.id, resp.hovered(), 0.1);
            let active = self.page == Page::Instance(inst.id.clone());
            p.rect_filled(
                r,
                0.0,
                theme::alpha(theme::BG2, if active { 255 } else { (h * 255.0) as u8 }),
            );
            if active {
                p.rect_filled(
                    Rect::from_min_size(r.min, vec2(2.0, r.height())),
                    0.0,
                    accent,
                );
            }
            widgets::instance_icon(
                ui,
                Rect::from_min_size(r.min + vec2(16.0, 5.0), vec2(28.0, 28.0)),
                &inst.name,
                inst.color,
            );
            let running = self
                .game
                .as_ref()
                .map(|g| g.instance_id == inst.id)
                .unwrap_or(false);
            let nm = if inst.name.chars().count() > 17 {
                format!("{}…", inst.name.chars().take(16).collect::<String>())
            } else {
                inst.name.clone()
            };
            p.text(
                r.min + vec2(54.0, 13.0),
                Align2::LEFT_CENTER,
                nm,
                FontId::new(13.0, theme::bold()),
                theme::mix(
                    theme::MUTED,
                    theme::TEXT,
                    h.max(if active { 1.0 } else { 0.0 }),
                ),
            );
            p.text(
                r.min + vec2(54.0, 27.0),
                Align2::LEFT_CENTER,
                format!("{} {}", inst.loader.label().to_lowercase(), inst.mc_version),
                FontId::new(9.5, egui::FontFamily::Monospace),
                theme::MUTED,
            );
            if running {
                p.rect_filled(
                    Rect::from_center_size(r.right_center() - vec2(14.0, 0.0), vec2(6.0, 6.0)),
                    0.0,
                    theme::GOOD,
                );
            }
            if resp
                .on_hover_cursor(egui::CursorIcon::PointingHand)
                .clicked()
            {
                self.open_instance(&inst.id);
            }
            y += 40.0;
        }
        // settings pinned bottom
        let r = Rect::from_min_size(
            pos2(rect.left(), rect.bottom() - 48.0),
            vec2(rect.width() - 1.0, 36.0),
        );
        p.line_segment(
            [
                pos2(rect.left(), r.top() - 6.0),
                pos2(rect.right(), r.top() - 6.0),
            ],
            Stroke::new(1.0, theme::LINE),
        );
        if self.nav_button(
            ui,
            r,
            Icon::Gear,
            "Settings",
            matches!(self.page, Page::Settings | Page::Network),
            accent,
            30,
        ) {
            self.goto(Page::Settings);
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn nav_button(
        &mut self,
        ui: &mut Ui,
        r: Rect,
        icon: Icon,
        label: &str,
        active: bool,
        accent: Color32,
        idx: usize,
    ) -> bool {
        let resp = ui.interact(r, egui::Id::new(("nav", idx)), Sense::click());
        let h = ui
            .ctx()
            .animate_bool_with_time(resp.id, resp.hovered(), 0.1);
        let a = ui
            .ctx()
            .animate_bool_with_time(resp.id.with("a"), active, 0.16);
        let p = ui.painter();
        p.rect_filled(
            r,
            0.0,
            theme::alpha(theme::BG2, ((a.max(h * 0.7)) * 255.0) as u8),
        );
        if a > 0.0 {
            p.rect_filled(
                Rect::from_min_size(r.min, vec2(2.0, r.height() * a)),
                0.0,
                accent,
            );
        }
        let fg = theme::mix(theme::MUTED, theme::TEXT, a.max(h * 0.85));
        icons::paint(
            p,
            icon,
            pos2(r.left() + 28.0, r.center().y),
            17.0,
            theme::mix(fg, accent, a * 0.6),
        );
        p.text(
            pos2(r.left() + 48.0, r.center().y),
            Align2::LEFT_CENTER,
            label,
            FontId::new(
                13.5,
                if active {
                    theme::bold()
                } else {
                    egui::FontFamily::Proportional
                },
            ),
            fg,
        );
        resp.on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
    }

    pub fn open_create(&mut self) {
        let v = self
            .manifest
            .ready()
            .map(|m| m.latest.release.clone())
            .unwrap_or_default();
        self.create = Some(CreateState {
            name: String::new(),
            loader: Loader::Fabric,
            mc_version: v,
            preset_client: false,
            busy: false,
            error: None,
            show_snapshots: false,
        });
    }

    fn account_popup(&mut self, ui: &mut Ui, side: Rect) {
        if !self.account_menu {
            return;
        }
        let accent = self.accent();
        let pos = pos2(side.right() + 8.0, side.top() + 8.0);
        let mut close = false;
        egui::Area::new(egui::Id::new("account_menu"))
            .order(egui::Order::Foreground)
            .fixed_pos(pos)
            .show(ui.ctx(), |ui| {
                widgets::card(ui, |ui| {
                    ui.set_width(300.0);
                    widgets::eyebrow(ui, "Accounts");
                    let accs = self.accounts.accounts.clone();
                    let mut switch = None;
                    let mut remove = None;
                    for (i, a) in accs.iter().enumerate() {
                        ui.horizontal(|ui| {
                            let (r, resp) =
                                ui.allocate_exact_size(vec2(40.0, 40.0), Sense::click());
                            let tex = a
                                .skin_id
                                .clone()
                                .and_then(|id| crate::pages::skins::skin_tex(self, &id));
                            widgets::face(ui, r, tex.as_ref(), &a.username);
                            ui.vertical(|ui| {
                                ui.label(
                                    egui::RichText::new(&a.username)
                                        .font(FontId::new(14.5, theme::bold())),
                                );
                                let kind = format!("{} account", a.kind.label().to_lowercase());
                                ui.label(
                                    egui::RichText::new(if i == self.accounts.active {
                                        format!("{kind} · active")
                                    } else {
                                        kind.into()
                                    })
                                    .size(12.0)
                                    .color(
                                        if i == self.accounts.active {
                                            theme::GOOD
                                        } else {
                                            theme::MUTED
                                        },
                                    ),
                                );
                            });
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    if widgets::icon_button(
                                        ui,
                                        accent,
                                        Icon::Trash,
                                        "Remove account",
                                        true,
                                    )
                                    .clicked()
                                    {
                                        remove = Some(i);
                                    }
                                },
                            );
                            if resp.clicked() {
                                switch = Some(i);
                            }
                        });
                    }
                    if let Some(i) = switch {
                        self.accounts.active = i;
                        self.accounts.save();
                    }
                    if let Some(i) = remove {
                        self.accounts.remove(i);
                        self.accounts.save();
                    }
                    ui.separator();
                    ui.horizontal(|ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.new_account)
                                .hint_text("Offline username")
                                .desired_width(170.0),
                        );
                        let ok = accounts::valid_username(&self.new_account);
                        if widgets::button(ui, accent, "Add", Some(Icon::Plus), Btn::Primary, ok)
                            .clicked()
                        {
                            self.accounts.add(Account::offline(&self.new_account));
                            self.accounts.save();
                            self.new_account.clear();
                        }
                    });
                    ui.add_space(4.0);
                    ui.label(
                        egui::RichText::new("Sign in with an Ely.by or Luminos account")
                            .size(12.5)
                            .color(theme::MUTED),
                    );
                    ui.horizontal(|ui| {
                        ui.selectable_value(&mut self.acct_kind, 0, "Ely.by");
                        ui.selectable_value(&mut self.acct_kind, 1, "Luminos");
                    });
                    if self.acct_kind == 1 {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.acct_api)
                                .hint_text("https://your-luminos-auth.example")
                                .desired_width(280.0),
                        );
                    }
                    ui.add(
                        egui::TextEdit::singleline(&mut self.acct_login)
                            .hint_text("Username or email")
                            .desired_width(280.0),
                    );
                    ui.add(
                        egui::TextEdit::singleline(&mut self.acct_pass)
                            .password(true)
                            .hint_text("Password")
                            .desired_width(280.0),
                    );
                    let ready = !self.acct_login.trim().is_empty()
                        && !self.acct_pass.is_empty()
                        && (self.acct_kind == 0 || self.acct_api.starts_with("http"))
                        && !self.acct_busy;
                    let label = if self.acct_busy {
                        "Signing in…"
                    } else {
                        "Sign in"
                    };
                    if widgets::button(ui, accent, label, Some(Icon::Check), Btn::Primary, ready)
                        .clicked()
                    {
                        self.acct_busy = true;
                        let (kind, api) = if self.acct_kind == 0 {
                            (
                                accounts::AccountKind::Elyby,
                                luminos_core::yggdrasil::ELY_API_ROOT.to_string(),
                            )
                        } else {
                            (
                                accounts::AccountKind::Luminos,
                                self.acct_api.trim().to_string(),
                            )
                        };
                        let (login, pass, bg) = (
                            self.acct_login.trim().to_string(),
                            self.acct_pass.clone(),
                            self.bg(),
                        );
                        std::thread::spawn(move || {
                            let r =
                                luminos_core::yggdrasil::authenticate(kind, &api, &login, &pass)
                                    .map_err(|e| format!("{e:#}"));
                            bg.send(Msg::SignedIn(r));
                        });
                    }
                    ui.label(
                        egui::RichText::new(
                            "Microsoft sign-in needs an Azure app id and is not wired yet.",
                        )
                        .size(11.5)
                        .color(theme::MUTED),
                    );
                });
            });
        if ui.input(|i| i.pointer.any_click()) {
            let over = ui
                .input(|i| i.pointer.interact_pos())
                .map(|p| {
                    Rect::from_min_size(
                        pos,
                        vec2(320.0, 480.0 + self.accounts.accounts.len() as f32 * 48.0),
                    )
                    .contains(p)
                        || side.contains(p)
                })
                .unwrap_or(false);
            if !over {
                close = true;
            }
        }
        if close {
            self.account_menu = false;
        }
    }

    fn toasts_ui(&mut self, ui: &mut Ui, full: Rect) {
        let now = self.time;
        self.toasts.retain(|t| now - t.born < 5.0);
        let mut y = full.bottom() - 24.0;
        for t in self.toasts.iter().rev() {
            let age = (now - t.born) as f32;
            let a = ((age / 0.25).min(1.0) * ((5.0 - age) / 0.5).clamp(0.0, 1.0)).clamp(0.0, 1.0);
            let col = match t.kind {
                ToastKind::Good => theme::GOOD,
                ToastKind::Bad => theme::BAD,
                ToastKind::Info => self.accent(),
            };
            let g = ui.painter().layout(
                t.text.clone(),
                FontId::new(13.5, theme::bold()),
                theme::TEXT,
                380.0,
            );
            let size = vec2(g.size().x + 54.0, g.size().y + 24.0);
            let r = Rect::from_min_size(
                pos2(full.right() - 24.0 - size.x + (1.0 - a) * 30.0, y - size.y),
                size,
            );
            let p = ui.painter();
            p.rect_filled(
                r.translate(vec2(0.0, 4.0)),
                CornerRadius::same(4),
                Color32::from_black_alpha((90.0 * a) as u8),
            );
            p.rect_filled(
                r,
                CornerRadius::same(4),
                theme::alpha(theme::BG2, (250.0 * a) as u8),
            );
            p.rect_stroke(
                r,
                CornerRadius::same(4),
                Stroke::new(1.0, theme::alpha(col, (160.0 * a) as u8)),
                StrokeKind::Inside,
            );
            p.circle_filled(
                pos2(r.left() + 22.0, r.center().y),
                5.0,
                theme::alpha(col, (255.0 * a) as u8),
            );
            p.galley(
                pos2(r.left() + 38.0, r.top() + 12.0),
                g,
                theme::alpha(theme::TEXT, (255.0 * a) as u8),
            );
            y -= size.y + 10.0;
        }
        if !self.toasts.is_empty() {
            self.ctx.request_repaint();
        }
    }

    fn launch_panel(&mut self, ui: &mut Ui, full: Rect) {
        let Some(l) = &self.launching else { return };
        let (name, stage, frac, progress) = (
            l.name.clone(),
            l.progress.stage(),
            l.progress.fraction(),
            l.progress.clone(),
        );
        let accent = self.accent();
        let r = Rect::from_center_size(
            pos2(full.center().x, full.bottom() - 70.0),
            vec2(460.0, 96.0),
        );
        ui.painter().rect_filled(
            r.translate(vec2(0.0, 6.0)),
            CornerRadius::same(4),
            Color32::from_black_alpha(110),
        );
        ui.painter()
            .rect_filled(r, CornerRadius::same(4), theme::alpha(theme::BG2, 250));
        ui.painter().rect_stroke(
            r,
            CornerRadius::same(4),
            Stroke::new(1.0, theme::alpha(accent, 140)),
            StrokeKind::Inside,
        );
        ui.scope_builder(UiBuilder::new().max_rect(r.shrink(16.0)), |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(format!("Launching {name}"))
                        .font(FontId::new(15.0, theme::bold())),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if widgets::button_sized(
                        ui,
                        accent,
                        "Cancel",
                        None,
                        Btn::Ghost,
                        true,
                        0.0,
                        28.0,
                    )
                    .clicked()
                    {
                        progress
                            .cancel
                            .store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                });
            });
            ui.label(egui::RichText::new(stage).size(12.5).color(theme::MUTED));
            widgets::progress_bar(ui, accent, frac, r.width() - 32.0, self.time);
        });
        self.ctx.request_repaint_after(Duration::from_millis(60));
    }

    /// Draws one full frame of the launcher.
    pub fn draw(&mut self, ui: &mut Ui) {
        let ctx = ui.ctx().clone();
        self.time = ctx.input(|i| i.time);
        while let Ok(m) = self.rx.try_recv() {
            self.handle(m);
        }
        if self.applied_accent != Some(self.settings.accent) {
            theme::apply(&ctx, self.accent());
            self.applied_accent = Some(self.settings.accent);
        }
        let full = ui.max_rect();
        self.paint_backdrop(ui, full);
        let body = self.chrome(ui, full);
        if !self.settings.setup_done {
            crate::pages::setup::wizard_ui(self, ui, body);
            self.toasts_ui(ui, full);
            return;
        }
        let side = Rect::from_min_size(body.min, vec2(SIDEBAR_W, body.height()));
        self.sidebar(ui, side);
        let has_right = matches!(self.page, Page::Home | Page::Discover) && body.width() > 1120.0;
        let right_w = if has_right { 312.0 } else { 0.0 };
        let content = Rect::from_min_max(
            pos2(side.right(), body.top()),
            pos2(body.right() - right_w, body.bottom()),
        );
        let fade = (((self.time - self.page_t0) / 0.2) as f32).clamp(0.0, 1.0);
        if fade < 1.0 {
            ctx.request_repaint();
        }
        let ease = 1.0 - (1.0 - fade).powi(3);
        ui.scope_builder(
            UiBuilder::new().max_rect(
                content
                    .shrink2(vec2(30.0, 22.0))
                    .translate(vec2(0.0, (1.0 - ease) * 10.0)),
            ),
            |ui| {
                ui.set_clip_rect(content);
                ui.set_opacity(ease);
                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        ui.set_width(content.width() - 60.0 - 8.0);
                        match self.page.clone() {
                            Page::Home => crate::pages::home::ui(self, ui),
                            Page::Discover => crate::pages::discover::ui(self, ui),
                            Page::Library => crate::pages::library::ui(self, ui),
                            Page::Instance(id) => crate::pages::instance::ui(self, ui, &id),
                            Page::Skins => crate::pages::skins::ui(self, ui),
                            Page::Servers => crate::pages::servers::ui(self, ui),
                            Page::Stats => crate::pages::stats::ui(self, ui),
                            Page::Settings => crate::pages::settings::ui(self, ui),
                            Page::Network => crate::pages::network::ui(self, ui),
                        }
                    });
            },
        );
        if has_right {
            let right = Rect::from_min_max(pos2(content.right(), body.top()), body.right_bottom());
            ui.painter().rect_filled(right, 0.0, theme::BG1);
            ui.painter().line_segment(
                [right.left_top(), right.left_bottom()],
                Stroke::new(1.0, theme::LINE),
            );
            ui.scope_builder(
                UiBuilder::new().max_rect(right.shrink2(vec2(20.0, 20.0))),
                |ui| {
                    ui.set_clip_rect(right);
                    egui::ScrollArea::vertical()
                        .id_salt("right")
                        .auto_shrink([false, false])
                        .show(ui, |ui| {
                            ui.set_width(right.width() - 40.0 - 6.0);
                            match self.page {
                                Page::Discover => crate::pages::discover::filters(self, ui),
                                _ => crate::pages::home::news_panel(self, ui),
                            }
                        });
                },
            );
        }
        // hairline window frame
        ui.painter()
            .rect_stroke(full, 0.0, Stroke::new(1.0, theme::LINE), StrokeKind::Inside);
        crate::pages::library::create_dialog(self, ui, full);
        self.account_popup(ui, side);
        self.launch_panel(ui, full);
        self.toasts_ui(ui, full);
    }
}

impl eframe::App for App {
    fn ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        self.draw(ui);
    }

    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        [0.016, 0.027, 0.07, 1.0]
    }
}

/// Before quick-joining: ping + login handshake with the active account's name.
/// Blocks only when the server clearly can't accept this account; anything uncertain proceeds.
fn preflight(addr: &str, acc: &Account) -> Result<(), String> {
    use luminos_core::loginprobe::{self, LoginMode};
    let st = luminos_core::servers::ping(addr).map_err(|e| format!("Can't reach {addr}: {e:#}"))?;
    let offline = acc.kind == accounts::AccountKind::Offline;
    match loginprobe::probe(addr, st.protocol, &acc.username) {
        Ok(m @ LoginMode::OnlineRequired) if offline => Err(loginprobe::explain(&m, true)),
        Ok(m @ (LoginMode::Whitelisted | LoginMode::Banned | LoginMode::VersionMismatch(_))) => {
            Err(loginprobe::explain(&m, offline))
        }
        _ => Ok(()),
    }
}
