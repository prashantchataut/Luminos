//! Launcher upkeep UI: self-update, storage and data reset, and the premium-name check.
//! All I/O runs on worker threads and reports back through `Msg::Maint` (AGENTS.md: never block the UI).
use crate::{
    app::{App, Loadable, Msg, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{self, Ui};
use luminos_core::{
    namecheck::{self, NameStatus},
    storage::{self, Area},
    update::{self, Release},
};
use std::path::PathBuf;

pub enum UpdateState {
    Idle,
    Checking,
    UpToDate,
    Available(Release),
    Downloading(Release),
    Failed(String),
}

pub enum Probe {
    Checking,
    Done(NameStatus),
    Failed(String),
}

#[derive(PartialEq)]
pub enum Confirm {
    None,
    Reset,
    Wipe(String),
}

pub struct Maint {
    pub update: UpdateState,
    pub storage: Loadable<Vec<Area>>,
    pub probe: Option<(String, Probe)>,
    /// Name being typed and when it last changed (debounce for the lookup).
    pub probe_due: Option<(String, f64)>,
    pub confirm: Confirm,
}

impl Default for Maint {
    fn default() -> Self {
        Self {
            update: UpdateState::Idle,
            storage: Loadable::Idle,
            probe: None,
            probe_due: None,
            confirm: Confirm::None,
        }
    }
}

pub enum MaintMsg {
    Update {
        manual: bool,
        result: Result<Option<Release>, String>,
    },
    Installer(Result<(Release, PathBuf), String>),
    Storage(Vec<Area>),
    StorageDone(Result<String, String>),
    Name(String, Result<NameStatus, String>),
}

impl App {
    pub fn check_update(&mut self, manual: bool) {
        if !self.persist {
            return;
        }
        self.maint.update = UpdateState::Checking;
        let bg = self.bg();
        std::thread::spawn(move || {
            let result = update::check(luminos_core::VERSION).map_err(|e| format!("{e:#}"));
            bg.send(Msg::Maint(MaintMsg::Update { manual, result }));
        });
    }

    pub fn install_update(&mut self, rel: Release) {
        self.maint.update = UpdateState::Downloading(rel.clone());
        let bg = self.bg();
        std::thread::spawn(move || {
            let r = update::download_verified(&rel)
                .map(|p| (rel, p))
                .map_err(|e| format!("{e:#}"));
            bg.send(Msg::Maint(MaintMsg::Installer(r)));
        });
    }

    pub fn refresh_storage(&mut self) {
        if !self.persist {
            return;
        }
        self.maint.storage = Loadable::Loading;
        let bg = self.bg();
        std::thread::spawn(move || bg.send(Msg::Maint(MaintMsg::Storage(storage::areas()))));
    }

    fn run_cleanup(&mut self, label: &'static str, job: fn() -> anyhow::Result<u64>) {
        let bg = self.bg();
        std::thread::spawn(move || {
            let r = job()
                .map(|n| format!("{label}: freed {}", storage::human(n)))
                .map_err(|e| format!("{e:#}"));
            bg.send(Msg::Maint(MaintMsg::StorageDone(r)));
        });
    }

    /// Call every frame while the username box is visible; looks the name up once typing pauses.
    pub fn probe_name_tick(&mut self, name: &str) {
        if !self.persist || namecheck::check_format(name).is_err() {
            self.maint.probe_due = None;
            return;
        }
        if self.maint.probe.as_ref().is_some_and(|(n, _)| n == name) {
            return;
        }
        match &self.maint.probe_due {
            Some((n, t0)) if n == name => {
                if self.time - t0 > 0.6 {
                    self.maint.probe_due = None;
                    self.maint.probe = Some((name.to_string(), Probe::Checking));
                    let (bg, nm) = (self.bg(), name.to_string());
                    std::thread::spawn(move || {
                        let r = namecheck::lookup(&nm).map_err(|e| format!("{e:#}"));
                        bg.send(Msg::Maint(MaintMsg::Name(nm, r)));
                    });
                } else {
                    self.ctx
                        .request_repaint_after(std::time::Duration::from_millis(250));
                }
            }
            _ => {
                self.maint.probe_due = Some((name.to_string(), self.time));
                self.ctx
                    .request_repaint_after(std::time::Duration::from_millis(700));
            }
        }
    }

    pub fn handle_maint(&mut self, m: MaintMsg) {
        match m {
            MaintMsg::Update { manual, result } => match result {
                Ok(Some(r)) => {
                    self.toast(
                        format!("Luminos {} is available", r.version),
                        ToastKind::Info,
                    );
                    self.maint.update = UpdateState::Available(r);
                }
                Ok(None) => {
                    self.maint.update = UpdateState::UpToDate;
                    self.settings.last_update_check = luminos_core::store::now_unix();
                    self.settings.save();
                    if manual {
                        self.toast("You're on the latest version", ToastKind::Good);
                    }
                }
                Err(e) => {
                    if manual {
                        self.toast(format!("Update check failed: {e}"), ToastKind::Bad);
                    }
                    self.maint.update = UpdateState::Failed(e);
                }
            },
            MaintMsg::Installer(Ok((rel, path))) => match update::run_installer(&path) {
                Ok(()) => self.ctx.send_viewport_cmd(egui::ViewportCommand::Close),
                Err(e) => {
                    self.toast(format!("{e:#}"), ToastKind::Bad);
                    let _ = open::that(&rel.page);
                    self.maint.update = UpdateState::Available(rel);
                }
            },
            MaintMsg::Installer(Err(e)) => {
                self.toast(format!("Update failed: {e}"), ToastKind::Bad);
                self.maint.update = UpdateState::Failed(e);
            }
            MaintMsg::Storage(v) => self.maint.storage = Loadable::Ready(v),
            MaintMsg::StorageDone(r) => {
                match r {
                    Ok(t) => self.toast(t, ToastKind::Good),
                    Err(e) => self.toast(format!("Cleanup failed: {e}"), ToastKind::Bad),
                }
                self.refresh_storage();
            }
            MaintMsg::Name(n, r) => {
                if self.maint.probe.as_ref().is_some_and(|(cur, _)| *cur == n) {
                    self.maint.probe = Some((
                        n,
                        match r {
                            Ok(s) => Probe::Done(s),
                            Err(e) => Probe::Failed(e),
                        },
                    ));
                }
            }
        }
    }
}

/// Banner shown on Home when a newer release exists.
pub fn update_banner(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    let rel = match &app.maint.update {
        UpdateState::Available(r) | UpdateState::Downloading(r) => r.clone(),
        _ => return,
    };
    let downloading = matches!(app.maint.update, UpdateState::Downloading(_));
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(egui::RichText::new(format!("Luminos {} is ready", rel.version)).font(egui::FontId::new(16.0, theme::bold())));
                widgets::muted(ui, &format!("You have {}. The installer is checked against the published SHA-256 before it runs.", luminos_core::VERSION));
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let label = if downloading { "Downloading…" } else { "Update now" };
                if widgets::button(ui, accent, label, Some(Icon::Download), Btn::Primary, !downloading).clicked() {
                    app.install_update(rel.clone());
                }
                if widgets::button(ui, accent, "What's new", Some(Icon::Link), Btn::Ghost, true).clicked() {
                    let _ = open::that(&rel.page);
                }
            });
        });
    });
    ui.add_space(10.0);
}

/// Settings > Updates, Storage and Reset.
pub fn settings_sections(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();

    widgets::subheading(ui, "Updates");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        let (title, desc): (String, String) = match &app.maint.update {
            UpdateState::Idle => (
                format!("Luminos {}", luminos_core::VERSION),
                "Not checked yet this session.".into(),
            ),
            UpdateState::Checking => (
                format!("Luminos {}", luminos_core::VERSION),
                "Checking GitHub releases…".into(),
            ),
            UpdateState::UpToDate => (
                format!("Luminos {} is the latest", luminos_core::VERSION),
                "No newer release found.".into(),
            ),
            UpdateState::Available(r) => (
                format!("Luminos {} is available", r.version),
                format!(
                    "{} MB installer, verified before it runs.",
                    r.setup_size / 1_048_576
                ),
            ),
            UpdateState::Downloading(r) => (
                format!("Downloading {}…", r.version),
                "Verifying the checksum, then installing.".into(),
            ),
            UpdateState::Failed(e) => ("Couldn't check for updates".into(), e.clone()),
        };
        widgets::setting_row(ui, &title, &desc, |ui| {
            let busy = matches!(
                app.maint.update,
                UpdateState::Checking | UpdateState::Downloading(_)
            );
            if let UpdateState::Available(r) = &app.maint.update {
                let r = r.clone();
                if widgets::button(
                    ui,
                    accent,
                    "Update now",
                    Some(Icon::Download),
                    Btn::Primary,
                    true,
                )
                .clicked()
                {
                    app.install_update(r);
                }
            } else if widgets::button(
                ui,
                accent,
                "Check now",
                Some(Icon::Refresh),
                Btn::Secondary,
                !busy,
            )
            .clicked()
            {
                app.check_update(true);
            }
        });
        ui.add_space(4.0);
        widgets::setting_row(ui, "Check for updates on start", "One request to api.github.com. Nothing about you is sent. Also listed under Network activity.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.check_updates);
        });
    });

    widgets::subheading(ui, "Storage");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        match &app.maint.storage {
            Loadable::Idle => {
                app.refresh_storage();
            }
            Loadable::Loading => widgets::muted(ui, "Measuring disk usage…"),
            Loadable::Failed(e) => widgets::muted(ui, e),
            Loadable::Ready(areas) => {
                let total: u64 = areas.iter().map(|a| a.bytes).sum();
                let free: u64 = areas
                    .iter()
                    .filter(|a| a.reclaimable)
                    .map(|a| a.bytes)
                    .sum();
                let areas = areas.clone();
                ui.label(
                    egui::RichText::new(storage::human(total))
                        .font(egui::FontId::new(24.0, theme::bold())),
                );
                widgets::muted(
                    ui,
                    &format!(
                        "{} can be freed without touching your worlds.",
                        storage::human(free)
                    ),
                );
                ui.add_space(8.0);
                let max = areas.iter().map(|a| a.bytes).max().unwrap_or(1).max(1) as f32;
                for a in &areas {
                    ui.horizontal(|ui| {
                        ui.add_sized(
                            [150.0, 20.0],
                            egui::Label::new(
                                egui::RichText::new(a.name)
                                    .font(egui::FontId::new(14.0, theme::bold())),
                            ),
                        );
                        let w = (ui.available_width() - 240.0).max(80.0);
                        let (r, _) =
                            ui.allocate_exact_size(egui::vec2(w, 8.0), egui::Sense::hover());
                        ui.painter().rect_filled(r, 2.0, theme::BG3);
                        let mut f = r;
                        f.set_width((r.width() * a.bytes as f32 / max).max(2.0));
                        ui.painter().rect_filled(
                            f,
                            2.0,
                            if a.reclaimable { accent } else { theme::MUTED },
                        );
                        ui.label(
                            egui::RichText::new(storage::human(a.bytes))
                                .monospace()
                                .size(13.0),
                        );
                    })
                    .response
                    .on_hover_text(a.detail);
                }
                ui.add_space(10.0);
                ui.horizontal_wrapped(|ui| {
                    if widgets::button(ui, accent, "Clear downloads cache", Some(Icon::Trash), Btn::Secondary, true).clicked() {
                        app.run_cleanup("Downloads cache", storage::clear_cache);
                    }
                    if widgets::button(ui, accent, "Remove Minecraft files", Some(Icon::Trash), Btn::Secondary, true)
                        .on_hover_text("Versions, libraries and assets. They are downloaded again on the next launch.")
                        .clicked()
                    {
                        app.run_cleanup("Minecraft files", storage::clear_game_files);
                    }
                    if widgets::button(ui, accent, "Remove Java runtimes", Some(Icon::Trash), Btn::Secondary, true).clicked() {
                        app.run_cleanup("Java runtimes", storage::clear_runtimes);
                    }
                    if widgets::button(ui, accent, "Re-measure", Some(Icon::Refresh), Btn::Ghost, true).clicked() {
                        app.refresh_storage();
                    }
                });
            }
        }
    });

    widgets::subheading(ui, "Your data");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::muted(
            ui,
            "Everything lives in the launcher folder on this PC. Nothing is uploaded anywhere.",
        );
        ui.add_space(6.0);
        match &mut app.maint.confirm {
            Confirm::None => {
                ui.horizontal(|ui| {
                    if widgets::button(
                        ui,
                        accent,
                        "Reset launcher data…",
                        Some(Icon::Refresh),
                        Btn::Secondary,
                        true,
                    )
                    .clicked()
                    {
                        app.maint.confirm = Confirm::Reset;
                    }
                    if widgets::button(
                        ui,
                        accent,
                        "Delete everything…",
                        Some(Icon::Trash),
                        Btn::Danger,
                        true,
                    )
                    .clicked()
                    {
                        app.maint.confirm = Confirm::Wipe(String::new());
                    }
                });
            }
            Confirm::Reset => {
                ui.label(
                    egui::RichText::new("Reset accounts, settings, skins and playtime?")
                        .color(theme::WARN),
                );
                widgets::muted(
                    ui,
                    "Your instances and worlds are kept. Setup will run again.",
                );
                ui.horizontal(|ui| {
                    if widgets::button(ui, accent, "Reset", None, Btn::Danger, true).clicked() {
                        match storage::reset_launcher_data() {
                            Ok(()) => {
                                app.settings = luminos_core::config::Settings::default();
                                app.accounts = Default::default();
                                app.settings.save();
                                app.toast("Launcher data reset", ToastKind::Good);
                                app.refresh_storage();
                            }
                            Err(e) => app.toast(format!("{e:#}"), ToastKind::Bad),
                        }
                        app.maint.confirm = Confirm::None;
                    }
                    if widgets::button(ui, accent, "Cancel", None, Btn::Ghost, true).clicked() {
                        app.maint.confirm = Confirm::None;
                    }
                });
            }
            Confirm::Wipe(typed) => {
                ui.label(egui::RichText::new("This deletes every instance, world, skin and setting. It cannot be undone.").color(theme::BAD));
                widgets::muted(ui, "Type DELETE to confirm.");
                ui.add(
                    egui::TextEdit::singleline(typed)
                        .desired_width(180.0)
                        .margin(egui::Margin::symmetric(10, 8)),
                );
                let armed = typed.trim() == "DELETE";
                let mut done = false;
                let mut cancel = false;
                ui.horizontal(|ui| {
                    done = widgets::button(
                        ui,
                        accent,
                        "Delete everything",
                        Some(Icon::Trash),
                        Btn::Danger,
                        armed,
                    )
                    .clicked();
                    cancel =
                        widgets::button(ui, accent, "Cancel", None, Btn::Ghost, true).clicked();
                });
                if done {
                    match storage::wipe_everything() {
                        Ok(n) => {
                            app.settings = luminos_core::config::Settings::default();
                            app.accounts = Default::default();
                            app.instances.clear();
                            app.toast(format!("Deleted {}", storage::human(n)), ToastKind::Good);
                            app.refresh_storage();
                        }
                        Err(e) => app.toast(format!("{e:#}"), ToastKind::Bad),
                    }
                    app.maint.confirm = Confirm::None;
                } else if cancel {
                    app.maint.confirm = Confirm::None;
                }
            }
        }
    });
}

/// One line under the username box: honest about what a "taken" name means offline.
pub fn name_status_line(app: &App, ui: &mut Ui, name: &str) {
    let muted = |ui: &mut Ui, t: &str| {
        ui.label(egui::RichText::new(t).color(theme::MUTED).size(13.0));
    };
    match &app.maint.probe {
        Some((n, Probe::Checking)) if n == name => muted(ui, "Checking whether a premium account uses this name…"),
        Some((n, Probe::Done(NameStatus::Premium(_)))) if n == name => {
            ui.label(egui::RichText::new("Premium name. Fine for offline servers; online-mode servers will expect the real account.").color(theme::WARN).size(13.0));
        }
        Some((n, Probe::Done(NameStatus::Free))) if n == name => {
            ui.label(egui::RichText::new("Free name. Nobody owns offline names, so this works on any offline server.").color(theme::GOOD).size(13.0));
        }
        Some((n, Probe::Failed(_))) if n == name => muted(ui, "Couldn't reach Mojang to check the name. It will still work offline."),
        _ => muted(ui, "Offline names aren't reserved by anyone. We check whether a premium account already uses yours."),
    }
}
