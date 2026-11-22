//! Application state, background messaging and the window shell (title bar, sidebar, toasts).
use crate::{
    dither,
    icons::{self, Icon},
    theme,
    widgets::{self, Btn},
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
use eframe::egui::{self, pos2, vec2, Align2, Color32, ColorImage, CornerRadius, FontId, Rect, Sense, Stroke, StrokeKind, TextureHandle, TextureOptions, Ui, UiBuilder};
use std::{
    collections::{HashMap, HashSet},
    sync::{
        mpsc::{channel, Receiver, Sender},
        Arc,
    },
    time::Duration,
};

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
    Stats,
    Settings,
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
    Created { result: Result<Instance, String>, from_wizard: bool },
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
    backdrop: Option<TextureHandle>,
    backdrop_key: (usize, usize, i64),
    pub manifest: Loadable<Manifest>,
    pub news: Loadable<Vec<NewsItem>>,
    pub featured: Loadable<Vec<Project>>,
    pub wizard: Wizard,
    pub create: Option<CreateState>,
    pub discover: DiscoverState,
    pub detail: DetailState,
    pub skins: SkinState,
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
        let settings = if persist { Settings::load() } else { Settings { setup_done: true, ..Default::default() } };
        let mut app = App {
            ctx: ctx.clone(),
            tx,
            rx,
            persist,
            time: 0.0,
            accounts: if persist { AccountStore::load() } else { AccountStore::default() },
            instances: if persist { instances::list() } else { vec![] },
            playtime: if persist { playtime::load() } else { playtime::Log::default() },
            settings,
            page: Page::Home,
            page_t0: 0.0,
            account_menu: false,
            new_account: String::new(),
            backdrop: None,
            backdrop_key: (0, 0, -1),
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
            },
            skins: crate::pages::skins::new_state(),
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
        Bg { tx: self.tx.clone(), ctx: self.ctx.clone() }
    }

    pub fn accent(&self) -> Color32 {
        theme::accent(self.settings.accent)
    }

    pub fn toast(&mut self, text: impl Into<String>, kind: ToastKind) {
        self.toasts.push(Toast { text: text.into(), kind, born: self.time });
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
            move || bg.send(Msg::Manifest(luminos_core::mojang::fetch_manifest().map_err(|e| format!("{e:#}"))))
        });
        self.news = Loadable::Loading;
        std::thread::spawn({
            let bg = bg.clone();
            move || bg.send(Msg::News(luminos_core::news::fetch(6).map_err(|e| format!("{e:#}"))))
        });
        self.featured = Loadable::Loading;
        std::thread::spawn({
            let bg = bg.clone();
            move || {
                let q = luminos_core::modrinth::SearchQuery { project_type: "modpack".into(), sort: "downloads".into(), limit: 3, ..Default::default() };
                bg.send(Msg::Featured(luminos_core::modrinth::search(&q).map(|r| r.hits).map_err(|e| format!("{e:#}"))));
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
                let img = luminos_core::http::get_bytes(&url).ok().and_then(|b| image::load_from_memory(&b).ok()).map(|im| {
                    let im = if im.width() > 256 { im.resize(256, 256, image::imageops::FilterType::Triangle) } else { im };
                    let rgba = im.to_rgba8();
                    ColorImage::from_rgba_unmultiplied([rgba.width() as usize, rgba.height() as usize], rgba.as_raw())
                });
                bg.send(Msg::Icon(url, img));
            });
        }
        None
    }

    /// Draw an icon/image URL into `rect`, or the fallback closure while loading.
    pub fn paint_remote(&mut self, ui: &Ui, rect: Rect, url: Option<&str>, radius: u8, fallback: impl FnOnce(&Ui)) {
        if let Some(id) = url.and_then(|u| self.icon_tex(u)) {
            ui.painter().add(egui::epaint::RectShape::filled(rect, CornerRadius::same(radius), Color32::WHITE).with_texture(id, Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0))));
        } else {
            fallback(ui);
        }
    }

    pub fn play(&mut self, id: &str) {
        if self.game.is_some() || self.launching.is_some() {
            self.toast("A game is already running", ToastKind::Info);
            return;
        }
        let Some(inst) = self.instance(id).cloned() else { return };
        let Some(acc) = self.accounts.active().cloned() else {
            self.toast("Add an account first", ToastKind::Bad);
            return;
        };
        if !inst.loader.supported() {
            self.toast(format!("{} launching is coming soon", inst.loader.label()), ToastKind::Bad);
            return;
        }
        if !self.persist {
            return;
        }
        let progress = Progress::new();
        self.launching = Some(Launching { id: inst.id.clone(), name: inst.name.clone(), progress: progress.clone() });
        let settings = self.settings.clone();
        let bg = self.bg();
        std::thread::spawn(move || {
            if settings.auto_update_content {
                progress.set_stage("Checking for mod updates…");
                let _ = content::update_all(&inst);
            }
            match launch::prepare(&inst, &settings, &progress).and_then(|p| launch::spawn(&inst, &settings, &acc, &p)) {
            Ok(h) => {
                bg.send(Msg::Launched(Ok(h.clone())));
                let code = launch::wait_and_record(&h);
                bg.send(Msg::GameExit(inst.id.clone(), code));
            }
            Err(e) => bg.send(Msg::Launched(Err(format!("{e:#}")))),
            }
        });
    }

    fn handle(&mut self, m: Msg) {
        match m {
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
            Msg::Featured(r) => self.featured = r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed),
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
            Msg::Updates(r) => self.detail.updates = r.map(Loadable::Ready).unwrap_or_else(Loadable::Failed),
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
                    self.toast(format!("Game exited with code {code}. Check the Logs tab."), ToastKind::Bad);
                }
            }
            Msg::SkinFetched(r) => {
                self.skins.fetching = false;
                match r {
                    Ok((name, png)) => crate::pages::skins::import_png(self, &name, &png, "Minotar"),
                    Err(e) => self.toast(format!("Skin fetch failed: {e}"), ToastKind::Bad),
                }
            }
            Msg::Busy(b) => {
                self.detail.busy = b;
            }
            Msg::Created { result, from_wizard } => {
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

    fn paint_backdrop(&mut self, ui: &Ui, full: Rect) {
        let wizard = !self.settings.setup_done;
        if !self.settings.dither_background {
            ui.painter().rect_filled(full, 0.0, theme::BG0);
            return;
        }
        let (w, h) = dither::size_for(full.width(), full.height());
        let animated = !self.settings.reduce_motion;
        let q = if !animated { 0 } else if wizard { (self.time * 8.0) as i64 } else { (self.time * 1.5) as i64 };
        if self.backdrop.is_none() || self.backdrop_key != (w, h, q) {
            let t = if animated { q as f32 / if wizard { 8.0 } else { 1.5 } } else { 0.0 };
            let img = dither::render(w, h, t, self.accent(), if wizard { 1.15 } else { 0.95 });
            match &mut self.backdrop {
                Some(tex) => tex.set(img, TextureOptions::NEAREST),
                None => self.backdrop = Some(self.ctx.load_texture("luminos-dither", img, TextureOptions::NEAREST)),
            }
            self.backdrop_key = (w, h, q);
        }
        if let Some(tex) = &self.backdrop {
            ui.painter().image(tex.id(), full, Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0)), Color32::WHITE);
        }
        if animated {
            self.ctx.request_repaint_after(Duration::from_millis(if wizard { 120 } else { 700 }));
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
                (Rect::from_min_max(full.left_top() + vec2(c, 0.0), pos2(full.right() - c, full.top() + e)), D::North, C::ResizeVertical),
                (Rect::from_min_max(pos2(full.left() + c, full.bottom() - e), full.right_bottom() - vec2(c, 0.0)), D::South, C::ResizeVertical),
                (Rect::from_min_max(full.left_top() + vec2(0.0, c), pos2(full.left() + e, full.bottom() - c)), D::West, C::ResizeHorizontal),
                (Rect::from_min_max(pos2(full.right() - e, full.top() + c), full.right_bottom() - vec2(0.0, c)), D::East, C::ResizeHorizontal),
                (Rect::from_min_size(full.left_top(), vec2(c, c)), D::NorthWest, C::ResizeNwSe),
                (Rect::from_min_size(pos2(full.right() - c, full.top()), vec2(c, c)), D::NorthEast, C::ResizeNeSw),
                (Rect::from_min_size(pos2(full.left(), full.bottom() - c), vec2(c, c)), D::SouthWest, C::ResizeNeSw),
                (Rect::from_min_size(pos2(full.right() - c, full.bottom() - c), vec2(c, c)), D::SouthEast, C::ResizeNwSe),
            ];
            for (i, (r, dir, cur)) in zones.into_iter().enumerate() {
                let resp = ui.interact(r, egui::Id::new(("resize", i)), Sense::drag());
                if resp.hovered() {
                    ui.ctx().set_cursor_icon(cur);
                }
                if resp.drag_started() {
                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::BeginResize(dir));
                }
            }
        }
        let bar = Rect::from_min_size(full.min, vec2(full.width(), 46.0));
        let drag = ui.interact(Rect::from_min_max(bar.min + vec2(0.0, 5.0), pos2(bar.right() - 150.0, bar.bottom())), egui::Id::new("titlebar"), Sense::click_and_drag());
        if drag.drag_started() {
            ui.ctx().send_viewport_cmd(egui::ViewportCommand::StartDrag);
        }
        if drag.double_clicked() {
            self.maximized = !self.maximized;
            ui.ctx().send_viewport_cmd(egui::ViewportCommand::Maximized(self.maximized));
        }
        let p = ui.painter();
        widgets::logo_mark(p, pos2(bar.left() + 34.0, bar.center().y), 22.0, accent, 0.0);
        let g = p.layout_no_wrap("Luminos".into(), FontId::new(16.5, theme::bold()), theme::TEXT);
        let gw = g.size().x;
        p.galley(pos2(bar.left() + 54.0, bar.center().y - g.size().y / 2.0), g, theme::TEXT);
        // version pill
        let pill = Rect::from_min_size(pos2(bar.left() + 54.0 + gw + 10.0, bar.center().y - 10.0), vec2(74.0, 20.0));
        p.rect_filled(pill, CornerRadius::same(10), theme::alpha(accent, 34));
        p.rect_stroke(pill, CornerRadius::same(10), Stroke::new(1.0, theme::alpha(accent, 110)), StrokeKind::Inside);
        p.text(pill.center(), Align2::CENTER_CENTER, format!("v{} beta", luminos_core::VERSION), FontId::new(11.0, theme::bold()), theme::mix(accent, Color32::WHITE, 0.5));

        // running game badge
        if let Some(h) = self.game.clone() {
            let name = self.instance(&h.instance_id).map(|i| i.name.clone()).unwrap_or_default();
            let mins = (luminos_core::store::now_unix() - h.started).max(0) / 60;
            let r = Rect::from_center_size(pos2(bar.center().x, bar.center().y), vec2(300.0, 30.0));
            ui.painter().rect_filled(r, CornerRadius::same(15), theme::alpha(theme::GOOD, 30));
            ui.painter().rect_stroke(r, CornerRadius::same(15), Stroke::new(1.0, theme::alpha(theme::GOOD, 120)), StrokeKind::Inside);
            let pulse = (0.5 + 0.5 * (self.time * 3.0).sin()) as f32;
            ui.painter().circle_filled(r.left_center() + vec2(16.0, 0.0), 4.0 + pulse, theme::GOOD);
            ui.painter().text(r.left_center() + vec2(30.0, 0.0), Align2::LEFT_CENTER, format!("Playing {name} · {mins}m"), FontId::new(13.0, theme::bold()), theme::TEXT);
            let stop = Rect::from_center_size(r.right_center() - vec2(18.0, 0.0), vec2(26.0, 26.0));
            let resp = ui.interact(stop, egui::Id::new("stopgame"), Sense::click());
            icons::paint(ui.painter(), Icon::Stop, stop.center(), 14.0, if resp.hovered() { theme::BAD } else { theme::MUTED });
            if resp.on_hover_text("Stop game").clicked() {
                h.kill();
            }
            self.ctx.request_repaint_after(Duration::from_secs(5));
        }

        // window buttons
        let mut x = bar.right() - 14.0;
        for (i, (icon, tip)) in [(Icon::Close, "Close"), (Icon::Square, "Maximize"), (Icon::Minus, "Minimize")].into_iter().enumerate() {
            let r = Rect::from_center_size(pos2(x - 18.0, bar.center().y), vec2(36.0, 30.0));
            x -= 38.0;
            let resp = ui.interact(r, egui::Id::new(("winbtn", i)), Sense::click());
            let h = ui.ctx().animate_bool_with_time(resp.id, resp.hovered(), 0.1);
            let hot = if i == 0 { theme::BAD } else { theme::BG3 };
            ui.painter().rect_filled(r, CornerRadius::same(9), theme::alpha(hot, (h * if i == 0 { 70.0 } else { 255.0 }) as u8));
            icons::paint(ui.painter(), icon, r.center(), 14.0, theme::mix(theme::MUTED, theme::TEXT, h));
            if resp.on_hover_text(tip).clicked() {
                match i {
                    0 => ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close),
                    1 => {
                        self.maximized = !self.maximized;
                        ui.ctx().send_viewport_cmd(egui::ViewportCommand::Maximized(self.maximized));
                    }
                    _ => ui.ctx().send_viewport_cmd(egui::ViewportCommand::Minimized(true)),
                }
            }
        }
        Rect::from_min_max(pos2(full.left() + 12.0, bar.bottom()), full.right_bottom() - vec2(12.0, 12.0))
    }

    fn sidebar(&mut self, ui: &mut Ui, rect: Rect) {
        let accent = self.accent();
        ui.painter().rect_filled(rect, CornerRadius::same(18), theme::alpha(theme::BG1, 232));
        ui.painter().rect_stroke(rect, CornerRadius::same(18), Stroke::new(1.0, theme::LINE), StrokeKind::Inside);
        let cx = rect.center().x;
        // account avatar
        let av = Rect::from_center_size(pos2(cx, rect.top() + 14.0 + 26.0), vec2(48.0, 48.0));
        let resp = ui.interact(av, egui::Id::new("avatar"), Sense::click());
        let name = self.accounts.active().map(|a| a.username.clone()).unwrap_or_else(|| "?".into());
        let tex = self.accounts.active().and_then(|a| a.skin_id.clone()).and_then(|id| crate::pages::skins::skin_tex(self, &id));
        widgets::face(ui, av, tex.as_ref(), &name);
        if self.account_menu || resp.hovered() {
            ui.painter().rect_stroke(av.expand(3.0), CornerRadius::same(14), Stroke::new(1.5, accent), StrokeKind::Outside);
        }
        if resp.on_hover_text(name).clicked() {
            self.account_menu = !self.account_menu;
        }
        // nav items
        let items = [(Icon::Home, "Home", Page::Home), (Icon::Compass, "Discover", Page::Discover), (Icon::Grid, "Library", Page::Library), (Icon::Shirt, "Skins", Page::Skins), (Icon::Chart, "Playtime", Page::Stats)];
        let mut y = av.bottom() + 20.0;
        for (i, (icon, tip, page)) in items.into_iter().enumerate() {
            let active = self.page == page || (page == Page::Library && matches!(self.page, Page::Instance(_)));
            if self.nav_button(ui, Rect::from_center_size(pos2(cx, y + 22.0), vec2(52.0, 44.0)), icon, tip, active, accent, i) {
                self.goto(page);
            }
            y += 52.0;
        }
        // separator
        ui.painter().line_segment([pos2(rect.left() + 18.0, y + 6.0), pos2(rect.right() - 18.0, y + 6.0)], Stroke::new(1.0, theme::LINE));
        y += 16.0;
        if self.nav_button(ui, Rect::from_center_size(pos2(cx, y + 22.0), vec2(52.0, 44.0)), Icon::Plus, "New instance", false, accent, 20) {
            self.open_create();
        }
        y += 52.0;
        // recent instances
        let recent: Vec<Instance> = self.instances.iter().take(((rect.bottom() - y - 80.0) / 56.0).max(0.0) as usize).take(5).cloned().collect();
        for (i, inst) in recent.iter().enumerate() {
            let r = Rect::from_center_size(pos2(cx, y + 24.0), vec2(44.0, 44.0));
            let resp = ui.interact(r, egui::Id::new(("recent", i)), Sense::click());
            let h = ui.ctx().animate_bool_with_time(resp.id, resp.hovered(), 0.12);
            let active = self.page == Page::Instance(inst.id.clone());
            if active {
                ui.painter().rect_stroke(r.expand(3.0), CornerRadius::same(14), Stroke::new(2.0, accent), StrokeKind::Outside);
            }
            widgets::instance_icon(ui, r.shrink(2.0 - h * 2.0), &inst.name, inst.color);
            if resp.on_hover_text(&inst.name).clicked() {
                self.open_instance(&inst.id);
            }
            y += 54.0;
        }
        if self.nav_button(ui, Rect::from_center_size(pos2(cx, rect.bottom() - 36.0), vec2(52.0, 44.0)), Icon::Gear, "Settings", self.page == Page::Settings, accent, 30) {
            self.goto(Page::Settings);
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn nav_button(&mut self, ui: &mut Ui, r: Rect, icon: Icon, tip: &str, active: bool, accent: Color32, idx: usize) -> bool {
        let resp = ui.interact(r, egui::Id::new(("nav", idx)), Sense::click());
        let h = ui.ctx().animate_bool_with_time(resp.id, resp.hovered(), 0.12);
        let a = ui.ctx().animate_bool_with_time(resp.id.with("a"), active, 0.2);
        if a > 0.0 {
            ui.painter().rect_filled(r, CornerRadius::same(14), theme::alpha(accent, (a * 255.0) as u8));
            ui.painter().rect_filled(Rect::from_min_size(r.min + vec2(2.0, 1.0), vec2(r.width() - 4.0, r.height() * 0.4)), CornerRadius::same(12), Color32::from_white_alpha((a * 22.0) as u8));
        } else if h > 0.0 {
            ui.painter().rect_filled(r, CornerRadius::same(14), theme::alpha(theme::BG3, (h * 255.0) as u8));
        }
        icons::paint(ui.painter(), icon, r.center(), 22.0, theme::mix(theme::MUTED, Color32::WHITE, a.max(h * 0.8)));
        resp.on_hover_text(tip).on_hover_cursor(egui::CursorIcon::PointingHand).clicked()
    }

    pub fn open_create(&mut self) {
        let v = self.manifest.ready().map(|m| m.latest.release.clone()).unwrap_or_default();
        self.create = Some(CreateState { name: String::new(), loader: Loader::Fabric, mc_version: v, preset_client: false, busy: false, error: None, show_snapshots: false });
    }

    fn account_popup(&mut self, ui: &mut Ui, side: Rect) {
        if !self.account_menu {
            return;
        }
        let accent = self.accent();
        let pos = pos2(side.right() + 8.0, side.top() + 8.0);
        let mut close = false;
        egui::Area::new(egui::Id::new("account_menu")).order(egui::Order::Foreground).fixed_pos(pos).show(ui.ctx(), |ui| {
            widgets::card(ui, |ui| {
                ui.set_width(300.0);
                widgets::eyebrow(ui, "Accounts");
                let accs = self.accounts.accounts.clone();
                let mut switch = None;
                let mut remove = None;
                for (i, a) in accs.iter().enumerate() {
                    ui.horizontal(|ui| {
                        let (r, resp) = ui.allocate_exact_size(vec2(40.0, 40.0), Sense::click());
                        let tex = a.skin_id.clone().and_then(|id| crate::pages::skins::skin_tex(self, &id));
                        widgets::face(ui, r, tex.as_ref(), &a.username);
                        ui.vertical(|ui| {
                            ui.label(egui::RichText::new(&a.username).font(FontId::new(14.5, theme::bold())));
                            let kind = if a.kind == accounts::AccountKind::Offline { "Offline account" } else { "Microsoft account" };
                            ui.label(egui::RichText::new(if i == self.accounts.active { format!("{kind} · active") } else { kind.into() }).size(12.0).color(if i == self.accounts.active { theme::GOOD } else { theme::MUTED }));
                        });
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if widgets::icon_button(ui, accent, Icon::Trash, "Remove account", true).clicked() {
                                remove = Some(i);
                            }
                        });
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
                    ui.add(egui::TextEdit::singleline(&mut self.new_account).hint_text("Offline username").desired_width(170.0));
                    let ok = accounts::valid_username(&self.new_account);
                    if widgets::button(ui, accent, "Add", Some(Icon::Plus), Btn::Primary, ok).clicked() {
                        self.accounts.add(Account::offline(&self.new_account));
                        self.accounts.save();
                        self.new_account.clear();
                    }
                });
                ui.label(egui::RichText::new("Microsoft sign-in is on the roadmap.").size(12.0).color(theme::MUTED));
            });
        });
        if ui.input(|i| i.pointer.any_click()) {
            let over = ui.input(|i| i.pointer.interact_pos()).map(|p| Rect::from_min_size(pos, vec2(320.0, 260.0 + self.accounts.accounts.len() as f32 * 48.0)).contains(p) || side.contains(p)).unwrap_or(false);
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
            let g = ui.painter().layout(t.text.clone(), FontId::new(13.5, theme::bold()), theme::TEXT, 380.0);
            let size = vec2(g.size().x + 54.0, g.size().y + 24.0);
            let r = Rect::from_min_size(pos2(full.right() - 24.0 - size.x + (1.0 - a) * 30.0, y - size.y), size);
            let p = ui.painter();
            p.rect_filled(r.translate(vec2(0.0, 4.0)), CornerRadius::same(14), Color32::from_black_alpha((90.0 * a) as u8));
            p.rect_filled(r, CornerRadius::same(14), theme::alpha(theme::BG2, (250.0 * a) as u8));
            p.rect_stroke(r, CornerRadius::same(14), Stroke::new(1.0, theme::alpha(col, (160.0 * a) as u8)), StrokeKind::Inside);
            p.circle_filled(pos2(r.left() + 22.0, r.center().y), 5.0, theme::alpha(col, (255.0 * a) as u8));
            p.galley(pos2(r.left() + 38.0, r.top() + 12.0), g, theme::alpha(theme::TEXT, (255.0 * a) as u8));
            y -= size.y + 10.0;
        }
        if !self.toasts.is_empty() {
            self.ctx.request_repaint();
        }
    }

    fn launch_panel(&mut self, ui: &mut Ui, full: Rect) {
        let Some(l) = &self.launching else { return };
        let (name, stage, frac, progress) = (l.name.clone(), l.progress.stage(), l.progress.fraction(), l.progress.clone());
        let accent = self.accent();
        let r = Rect::from_center_size(pos2(full.center().x, full.bottom() - 70.0), vec2(460.0, 96.0));
        ui.painter().rect_filled(r.translate(vec2(0.0, 6.0)), CornerRadius::same(18), Color32::from_black_alpha(110));
        ui.painter().rect_filled(r, CornerRadius::same(18), theme::alpha(theme::BG2, 250));
        ui.painter().rect_stroke(r, CornerRadius::same(18), Stroke::new(1.0, theme::alpha(accent, 140)), StrokeKind::Inside);
        ui.scope_builder(UiBuilder::new().max_rect(r.shrink(16.0)), |ui| {
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new(format!("Launching {name}")).font(FontId::new(15.0, theme::bold())));
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if widgets::button_sized(ui, accent, "Cancel", None, Btn::Ghost, true, 0.0, 28.0).clicked() {
                        progress.cancel.store(true, std::sync::atomic::Ordering::Relaxed);
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
        let side = Rect::from_min_size(body.min, vec2(76.0, body.height()));
        self.sidebar(ui, side);
        let has_right = matches!(self.page, Page::Home | Page::Discover) && body.width() > 1080.0;
        let right_w = if has_right { 320.0 } else { 0.0 };
        let content = Rect::from_min_max(pos2(side.right() + 12.0, body.top()), pos2(body.right() - right_w - if has_right { 12.0 } else { 0.0 }, body.bottom()));
        ui.painter().rect_filled(content, CornerRadius::same(18), theme::alpha(theme::BG1, 232));
        ui.painter().rect_stroke(content, CornerRadius::same(18), Stroke::new(1.0, theme::LINE), StrokeKind::Inside);
        let fade = (((self.time - self.page_t0) / 0.22) as f32).clamp(0.0, 1.0);
        if fade < 1.0 {
            ctx.request_repaint();
        }
        let ease = 1.0 - (1.0 - fade).powi(3);
        ui.scope_builder(UiBuilder::new().max_rect(content.shrink2(vec2(26.0, 20.0)).translate(vec2(0.0, (1.0 - ease) * 14.0))), |ui| {
            ui.set_clip_rect(content.shrink(2.0));
            ui.set_opacity(ease);
            egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
                ui.set_width(content.width() - 52.0 - 8.0);
                match self.page.clone() {
                    Page::Home => crate::pages::home::ui(self, ui),
                    Page::Discover => crate::pages::discover::ui(self, ui),
                    Page::Library => crate::pages::library::ui(self, ui),
                    Page::Instance(id) => crate::pages::instance::ui(self, ui, &id),
                    Page::Skins => crate::pages::skins::ui(self, ui),
                    Page::Stats => crate::pages::stats::ui(self, ui),
                    Page::Settings => crate::pages::settings::ui(self, ui),
                }
            });
        });
        if has_right {
            let right = Rect::from_min_max(pos2(content.right() + 12.0, body.top()), body.right_bottom());
            ui.painter().rect_filled(right, CornerRadius::same(18), theme::alpha(theme::BG1, 232));
            ui.painter().rect_stroke(right, CornerRadius::same(18), Stroke::new(1.0, theme::LINE), StrokeKind::Inside);
            ui.scope_builder(UiBuilder::new().max_rect(right.shrink2(vec2(16.0, 16.0))), |ui| {
                ui.set_clip_rect(right.shrink(2.0));
                egui::ScrollArea::vertical().id_salt("right").auto_shrink([false, false]).show(ui, |ui| {
                    ui.set_width(right.width() - 32.0 - 6.0);
                    match self.page {
                        Page::Discover => crate::pages::discover::filters(self, ui),
                        _ => crate::pages::home::news_panel(self, ui),
                    }
                });
            });
        }
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
        [0.02, 0.03, 0.09, 1.0]
    }
}
