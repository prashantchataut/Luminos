//! Servers: saved list with live status, favourites, login-mode detection (offline/online), version fit,
//! per-server quick-join, direct connect and `luminos://join` invite links.
use crate::{
    app::{App, Loadable, ToastKind},
    icons::Icon,
    motion, theme,
    widgets::{self, Btn},
};
use eframe::egui::{self, vec2, Align, FontId, Id, Layout, Sense, Ui};
use luminos_core::{
    joinlink::{self, JoinLink},
    loginprobe::{self, LoginMode},
    servers::{self, SavedServer},
};

fn latency_color(ms: u64) -> egui::Color32 {
    match ms {
        0..=79 => theme::GOOD,
        80..=199 => theme::WARN,
        _ => theme::BAD,
    }
}

/// Instance that matches the server's reported version (pinned instance wins).
pub fn pick_instance(app: &App, s: &SavedServer) -> Option<String> {
    if let Some(id) = &s.instance {
        if app.instance(id).is_some() {
            return Some(id.clone());
        }
    }
    let ver = match app.servers.status.get(&s.address) {
        Some(Loadable::Ready(st)) => st.version.clone(),
        _ => String::new(),
    };
    app.instances
        .iter()
        .find(|i| !ver.is_empty() && ver.contains(&i.mc_version))
        .map(|i| i.id.clone())
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    if app.persist && !app.servers.pinged {
        app.servers.pinged = true;
        app.ping_all();
    }
    let now = ui.input(|i| i.time);
    if app.servers.t0 < 0.0 {
        app.servers.t0 = now;
    }
    let since = (now - app.servers.t0) as f32;

    ui.horizontal(|ui| {
        ui.vertical(|ui| {
            widgets::heading(ui, "Servers");
            widgets::muted(ui, "Status is read straight from each server. Joining first checks whether it accepts your account type.");
        });
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "Refresh all", Some(Icon::Refresh), Btn::Secondary, true, 0.0, 36.0).clicked() {
                app.ping_all();
            }
        });
    });
    ui.add_space(6.0);

    // Add + direct connect
    let (mut add, mut direct) = (false, false);
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut app.servers.name)
                    .hint_text("Name")
                    .desired_width(170.0)
                    .margin(egui::Margin::symmetric(12, 10)),
            );
            let w = (ui.available_width() - 250.0).max(160.0);
            let r = ui.add(
                egui::TextEdit::singleline(&mut app.servers.addr)
                    .hint_text("play.example.com[:25565]")
                    .desired_width(w)
                    .margin(egui::Margin::symmetric(12, 10)),
            );
            let ok = !app.servers.addr.trim().is_empty();
            if widgets::button_sized(
                ui,
                accent,
                "Direct connect",
                Some(Icon::Play),
                Btn::Secondary,
                ok,
                0.0,
                38.0,
            )
            .clicked()
            {
                direct = true;
            }
            if widgets::button_sized(
                ui,
                accent,
                "Add",
                Some(Icon::Plus),
                Btn::Primary,
                ok,
                0.0,
                38.0,
            )
            .clicked()
                || (r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) && ok)
            {
                add = true;
            }
        });
    });
    if direct {
        let a = app.servers.addr.trim().to_string();
        let tmp = SavedServer {
            name: a.clone(),
            address: a,
            ..Default::default()
        };
        match pick_instance(app, &tmp).or_else(|| app.instances.first().map(|i| i.id.clone())) {
            Some(id) => app.play_ext(&id, Some(tmp.address.clone())),
            None => app.toast("Create an instance first", ToastKind::Bad),
        }
    }
    if add {
        let address = app.servers.addr.trim().to_string();
        let name = if app.servers.name.trim().is_empty() {
            address.clone()
        } else {
            app.servers.name.trim().to_string()
        };
        if app.servers.list.iter().any(|s| s.address == address) {
            app.toast("That server is already in your list", ToastKind::Info);
        } else {
            app.servers.list.push(SavedServer {
                name,
                address: address.clone(),
                ..Default::default()
            });
            if app.persist {
                let _ = servers::save(&app.servers.list);
            }
            app.servers.name.clear();
            app.servers.addr.clear();
            app.ping_server(&address);
        }
    }

    if app.servers.list.is_empty() {
        ui.add_space(30.0);
        widgets::muted(ui, "No servers yet. Add one above, or open the directory for servers that answered a ping today.");
    }

    let acct_offline = app
        .accounts
        .active()
        .map(|a| a.kind == luminos_core::accounts::AccountKind::Offline)
        .unwrap_or(true);
    let list = app.servers.list.clone();
    let mut order: Vec<usize> = (0..list.len()).collect();
    order.sort_by_key(|&i| !list[i].favorite); // favourites first, stable
    let (mut remove, mut refresh, mut fav, mut check, mut join, mut copy): (
        Option<usize>,
        Option<String>,
        Option<usize>,
        Option<String>,
        Option<usize>,
        Option<usize>,
    ) = (None, None, None, None, None, None);
    let reduce = app.settings.reduce_motion;

    for (row, &i) in order.iter().enumerate() {
        let s = &list[i];
        let a = motion::stagger_opacity(
            ui.ctx(),
            Id::new(("srv-row", &s.address)),
            row,
            since,
            reduce,
        );
        ui.scope(|ui| {
            ui.set_opacity(a);
            widgets::card(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    let (r, _) = ui.allocate_exact_size(vec2(52.0, 52.0), Sense::hover());
                    widgets::instance_icon(ui, r, &s.name, (i % 7) as u8);
                    ui.add_space(6.0);
                    ui.vertical(|ui| {
                        // keep badges clear of the action buttons on the right
                        ui.set_max_width((ui.available_width() - 330.0).max(200.0));
                        ui.horizontal_wrapped(|ui| {
                            ui.label(
                                egui::RichText::new(&s.name).font(FontId::new(16.0, theme::bold())),
                            );
                            if s.favorite {
                                widgets::pill(ui, "favourite", theme::GOOD);
                            }
                            match app.servers.status.get(&s.address) {
                                Some(Loadable::Ready(st)) => {
                                    widgets::pill(
                                        ui,
                                        &format!("{} ms", st.latency_ms),
                                        latency_color(st.latency_ms),
                                    );
                                    widgets::pill(
                                        ui,
                                        &format!("{} / {}", st.online, st.max),
                                        accent,
                                    );
                                    widgets::pill(ui, &st.version, theme::MUTED);
                                    match pick_instance(app, s)
                                        .and_then(|id| app.instance(&id).map(|x| x.name.clone()))
                                    {
                                        Some(n) => {
                                            widgets::pill(ui, &format!("fits {n}"), theme::GOOD)
                                        }
                                        None => {
                                            widgets::pill(ui, "no matching instance", theme::WARN)
                                        }
                                    }
                                }
                                Some(Loadable::Loading) => {
                                    widgets::pill(ui, "pinging…", theme::WARN)
                                }
                                Some(Loadable::Failed(_)) => {
                                    widgets::pill(ui, "offline", theme::BAD)
                                }
                                _ => widgets::pill(ui, "not checked", theme::MUTED),
                            }
                            match app.servers.modes.get(&s.address) {
                                Some(Ok(LoginMode::OfflineOk)) => {
                                    widgets::pill(ui, "offline players welcome", theme::GOOD)
                                }
                                Some(Ok(LoginMode::OnlineRequired)) => {
                                    widgets::pill(ui, "online-mode", theme::WARN)
                                }
                                Some(Ok(LoginMode::Whitelisted)) => {
                                    widgets::pill(ui, "whitelist", theme::WARN)
                                }
                                _ if app.servers.checking.contains(&s.address) => {
                                    widgets::pill(ui, "checking login…", theme::WARN)
                                }
                                _ => {}
                            }
                        });
                        ui.label(
                            egui::RichText::new(&s.address)
                                .monospace()
                                .size(11.5)
                                .color(theme::MUTED),
                        );
                        match app.servers.status.get(&s.address) {
                            Some(Loadable::Ready(st)) => {
                                let first = st.motd.lines().next().unwrap_or("").trim();
                                ui.label(egui::RichText::new(first).size(13.0).color(theme::TEXT));
                            }
                            Some(Loadable::Failed(e)) => {
                                ui.label(egui::RichText::new(e).size(12.0).color(theme::BAD));
                            }
                            _ => {}
                        }
                        if let Some(Ok(m)) = app.servers.modes.get(&s.address) {
                            if *m != LoginMode::OfflineOk {
                                ui.label(
                                    egui::RichText::new(loginprobe::explain(m, acct_offline))
                                        .size(12.0)
                                        .color(theme::WARN),
                                );
                            }
                        }
                    });
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if widgets::icon_button(ui, accent, Icon::Trash, "Remove", true).clicked() {
                            remove = Some(i);
                        }
                        if widgets::icon_button(
                            ui,
                            accent,
                            Icon::Link,
                            "Copy invite link (luminos://join)",
                            false,
                        )
                        .clicked()
                        {
                            copy = Some(i);
                        }
                        if widgets::icon_button(
                            ui,
                            accent,
                            Icon::Star,
                            if s.favorite {
                                "Remove from favourites"
                            } else {
                                "Favourite"
                            },
                            false,
                        )
                        .clicked()
                        {
                            fav = Some(i);
                        }
                        if widgets::icon_button(
                            ui,
                            accent,
                            Icon::Check,
                            "Check whether it accepts your account",
                            false,
                        )
                        .clicked()
                        {
                            check = Some(s.address.clone());
                        }
                        if widgets::icon_button(ui, accent, Icon::Refresh, "Ping now", false)
                            .clicked()
                        {
                            refresh = Some(s.address.clone());
                        }
                        if widgets::button_sized(
                            ui,
                            accent,
                            "Join",
                            Some(Icon::Play),
                            Btn::Primary,
                            true,
                            0.0,
                            34.0,
                        )
                        .clicked()
                        {
                            join = Some(i);
                        }
                    });
                });
            });
        });
    }

    if let Some(i) = join {
        let s = list[i].clone();
        match pick_instance(app, &s) {
            Some(id) => app.play_ext(&id, Some(s.address.clone())),
            None => match app.instances.first().map(|x| x.id.clone()) {
                Some(id) => app.play_ext(&id, Some(s.address.clone())),
                None => app.toast("Create an instance first", ToastKind::Bad),
            },
        }
    }
    if let Some(i) = copy {
        let s = &list[i];
        let version = match app.servers.status.get(&s.address) {
            Some(Loadable::Ready(st)) => Some(
                st.version
                    .split_whitespace()
                    .last()
                    .unwrap_or("")
                    .to_string(),
            )
            .filter(|v| !v.is_empty()),
            _ => None,
        };
        let link = joinlink::build(&JoinLink {
            server: s.address.clone(),
            version,
            name: Some(s.name.clone()),
        });
        ui.ctx().copy_text(link);
        app.toast("Invite link copied", ToastKind::Good);
    }
    if let Some(i) = fav {
        app.servers.list[i].favorite = !app.servers.list[i].favorite;
        if app.persist {
            let _ = servers::save(&app.servers.list);
        }
    }
    if let Some(a) = check {
        app.check_mode(&a);
    }
    if let Some(i) = remove {
        let gone = app.servers.list.remove(i);
        app.servers.status.remove(&gone.address);
        app.servers.modes.remove(&gone.address);
        if app.persist {
            let _ = servers::save(&app.servers.list);
        }
    }
    if let Some(a) = refresh {
        app.ping_server(&a);
    }
}
