//! Server hub: saved servers with live status (MOTD, players, version, latency).
use crate::{
    app::{App, Loadable, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{self, vec2, Align, FontId, Layout, Sense, Ui};
use luminos_core::servers::{self, SavedServer};

fn latency_color(ms: u64) -> egui::Color32 {
    match ms {
        0..=79 => theme::GOOD,
        80..=199 => theme::WARN,
        _ => theme::BAD,
    }
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    if app.persist && !app.servers.pinged {
        app.servers.pinged = true;
        app.ping_all();
    }
    ui.horizontal(|ui| {
        ui.vertical(|ui| {
            widgets::heading(ui, "Servers");
            widgets::muted(ui, "Status is read straight from each server — no third-party API, nothing leaves your PC but the ping.");
        });
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "Refresh all", Some(Icon::Refresh), Btn::Secondary, true, 0.0, 36.0).clicked() {
                app.ping_all();
            }
        });
    });
    ui.add_space(6.0);
    let mut add = false;
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut app.servers.name)
                    .hint_text("Name")
                    .desired_width(170.0)
                    .margin(egui::Margin::symmetric(12, 10)),
            );
            let w = (ui.available_width() - 130.0).max(160.0);
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
                "Add server",
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
        widgets::muted(
            ui,
            "No servers yet — add your favourite above and Luminos will keep its status fresh.",
        );
    }
    let list = app.servers.list.clone();
    let (mut remove, mut refresh): (Option<usize>, Option<String>) = (None, None);
    for (i, s) in list.iter().enumerate() {
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                let (r, _) = ui.allocate_exact_size(vec2(52.0, 52.0), Sense::hover());
                widgets::instance_icon(ui, r, &s.name, (i % 7) as u8);
                ui.add_space(6.0);
                ui.vertical(|ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(&s.name).font(FontId::new(16.0, theme::bold())),
                        );
                        match app.servers.status.get(&s.address) {
                            Some(Loadable::Ready(st)) => {
                                widgets::pill(
                                    ui,
                                    &format!("{} ms", st.latency_ms),
                                    latency_color(st.latency_ms),
                                );
                                widgets::pill(ui, &format!("{} / {}", st.online, st.max), accent);
                                widgets::pill(ui, &st.version, theme::MUTED);
                            }
                            Some(Loadable::Loading) => widgets::pill(ui, "pinging…", theme::WARN),
                            Some(Loadable::Failed(_)) => widgets::pill(ui, "offline", theme::BAD),
                            _ => widgets::pill(ui, "not checked", theme::MUTED),
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
                });
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if widgets::icon_button(ui, accent, Icon::Trash, "Remove", true).clicked() {
                        remove = Some(i);
                    }
                    if widgets::icon_button(ui, accent, Icon::Refresh, "Ping now", false).clicked()
                    {
                        refresh = Some(s.address.clone());
                    }
                });
            });
        });
    }
    if let Some(i) = remove {
        let gone = app.servers.list.remove(i);
        app.servers.status.remove(&gone.address);
        if app.persist {
            let _ = servers::save(&app.servers.list);
        }
    }
    if let Some(a) = refresh {
        app.ping_server(&a);
    }
}
