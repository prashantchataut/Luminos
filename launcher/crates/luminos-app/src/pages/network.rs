//! Network activity: every host Luminos may contact, why, what it sends, and a switch for each.
//! Data comes straight from `luminos_core::netaudit` (the same registry that http.rs enforces).
use crate::{
    app::{App, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{self, FontId, RichText, Ui};
use luminos_core::netaudit::{self, Category};

const CATEGORIES: [Category; 5] = [
    Category::Game,
    Category::Content,
    Category::Accounts,
    Category::Skins,
    Category::Luminos,
];

fn count_for(rule_host: &str, act: &[netaudit::Activity]) -> (u64, u64) {
    act.iter()
        .filter(|a| netaudit::lookup(&a.host).is_some_and(|r| r.host == rule_host))
        .fold((0, 0), |(r, b), a| (r + a.requests, b + a.blocked))
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    let act = netaudit::activity();
    let before = app.settings.net_disabled.clone();

    ui.horizontal(|ui| {
        if widgets::icon_button(ui, accent, Icon::Back, "Back to settings", false).clicked() {
            app.goto(crate::app::Page::Settings);
        }
        widgets::heading(ui, "Network activity");
    });
    widgets::muted(
        ui,
        "Luminos can only reach the hosts listed here. A request to any other host is refused before it leaves your PC. There are no ad, analytics or telemetry hosts.",
    );
    ui.add_space(8.0);

    let total_req: u64 = act.iter().map(|a| a.requests).sum();
    let refused: u64 = act.iter().map(|a| a.blocked).sum();
    let off = app.settings.net_disabled.len();
    ui.horizontal_wrapped(|ui| {
        for (label, value, color) in [
            (
                "Allowed hosts",
                format!("{}", netaudit::REGISTRY.len() - off),
                theme::GOOD,
            ),
            (
                "Switched off",
                format!("{off}"),
                if off > 0 { theme::WARN } else { theme::MUTED },
            ),
            ("Ad / analytics hosts", "0".to_string(), theme::GOOD),
            ("Requests", format!("{total_req}"), theme::TEXT),
            (
                "Refused",
                format!("{refused}"),
                if refused > 0 {
                    theme::BAD
                } else {
                    theme::MUTED
                },
            ),
        ] {
            widgets::card(ui, |ui| {
                ui.set_min_width(120.0);
                widgets::eyebrow(ui, label);
                ui.label(
                    RichText::new(value)
                        .font(FontId::new(24.0, theme::bold()))
                        .color(color),
                );
            });
        }
    });
    ui.add_space(4.0);
    ui.horizontal(|ui| {
        if widgets::button(
            ui,
            accent,
            "Copy host list (JSON)",
            Some(Icon::Link),
            Btn::Secondary,
            true,
        )
        .clicked()
        {
            ui.ctx().copy_text(netaudit::registry_json());
            app.toast("Host list copied", ToastKind::Good);
        }
        if !app.settings.net_disabled.is_empty()
            && widgets::button(
                ui,
                accent,
                "Switch everything back on",
                None,
                Btn::Ghost,
                true,
            )
            .clicked()
        {
            app.settings.net_disabled.clear();
        }
    });

    for cat in CATEGORIES {
        ui.add_space(10.0);
        widgets::subheading(ui, cat.label());
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            let rules: Vec<_> = netaudit::REGISTRY
                .iter()
                .filter(|r| r.category == cat)
                .collect();
            for (i, r) in rules.iter().enumerate() {
                if i > 0 {
                    ui.add_space(6.0);
                    ui.separator();
                    ui.add_space(6.0);
                }
                let (req, blocked) = count_for(r.host, &act);
                let mut allowed = !app.settings.net_disabled.iter().any(|h| h == r.host);
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.horizontal_wrapped(|ui| {
                            ui.label(
                                RichText::new(r.host)
                                    .font(FontId::new(13.5, egui::FontFamily::Monospace))
                                    .color(if allowed { theme::TEXT } else { theme::MUTED }),
                            );
                            if r.required_to_play {
                                widgets::pill(ui, "NEEDED TO PLAY", theme::WARN);
                            }
                            if req > 0 {
                                widgets::pill(ui, &format!("{req} REQ"), theme::GOOD);
                            }
                            if blocked > 0 {
                                widgets::pill(ui, &format!("{blocked} REFUSED"), theme::BAD);
                            }
                        });
                        ui.label(RichText::new(r.purpose).size(13.0));
                        ui.label(
                            RichText::new(format!("Sends: {}", r.sends))
                                .size(12.0)
                                .color(theme::MUTED),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let resp = widgets::toggle(ui, accent, &mut allowed);
                        resp.on_hover_text(if allowed {
                            "Allowed. Click to block this host."
                        } else {
                            "Blocked. Click to allow this host."
                        });
                    });
                });
                let listed = app.settings.net_disabled.iter().any(|h| h == r.host);
                if allowed && listed {
                    app.settings.net_disabled.retain(|h| h != r.host);
                } else if !allowed && !listed {
                    app.settings.net_disabled.push(r.host.to_string());
                }
            }
        });
    }

    let mine: Vec<_> = act.iter().filter(|a| a.user_configured).collect();
    if !mine.is_empty() {
        ui.add_space(10.0);
        widgets::subheading(ui, "Servers you added");
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            for a in mine {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(&a.host).font(FontId::new(13.5, egui::FontFamily::Monospace)),
                    );
                    widgets::pill(ui, "YOUR SERVER", theme::MUTED);
                    widgets::pill(ui, &format!("{} REQ", a.requests), theme::GOOD);
                });
            }
        });
    }

    let unlisted: Vec<_> = act
        .iter()
        .filter(|a| !a.user_configured && netaudit::lookup(&a.host).is_none())
        .collect();
    if !unlisted.is_empty() {
        ui.add_space(10.0);
        widgets::subheading(ui, "Refused (not on the list)");
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            for a in unlisted {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(&a.host).font(FontId::new(13.5, egui::FontFamily::Monospace)),
                    );
                    widgets::pill(ui, &format!("{} REFUSED", a.blocked), theme::BAD);
                });
            }
        });
    }

    ui.add_space(12.0);
    widgets::muted(
        ui,
        "Redirects are checked hop by hop. Game servers you join talk to Minecraft directly over TCP and are not part of this list.",
    );

    if app.settings.net_disabled != before {
        app.settings.save();
    }
}
