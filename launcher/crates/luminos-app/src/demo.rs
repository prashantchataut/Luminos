//! Deterministic demo data used by the screenshot renderer (no disk, no network).
use crate::app::{App, DTab, Loadable, Page};
use eframe::egui;
use luminos_core::{
    accounts::Account,
    content::Entry,
    instances::{Instance, Loader},
    modrinth::{Project, SearchResult},
    news::NewsItem,
    playtime::{Log, Session},
};

fn inst(
    id: &str,
    name: &str,
    mc: &str,
    loader: Loader,
    color: u8,
    hours: f32,
    last: i64,
    preset: bool,
) -> Instance {
    Instance {
        id: id.into(),
        name: name.into(),
        mc_version: mc.into(),
        loader,
        color,
        playtime_secs: (hours * 3600.0) as u64,
        last_played: Some(luminos_core::store::now_unix() - last),
        preset: preset.then(|| "luminos-client".to_string()),
        ..Default::default()
    }
}

fn proj(title: &str, desc: &str, author: &str, downloads: u64, kind: &str) -> Project {
    Project {
        id: title.to_lowercase().replace(' ', "-"),
        slug: title.to_lowercase().replace(' ', "-"),
        title: title.into(),
        description: desc.into(),
        author: author.into(),
        downloads,
        project_type: kind.into(),
        ..Default::default()
    }
}

fn entry(name: &str, ver: &str, desc: &str, enabled: bool, linked: bool) -> Entry {
    Entry {
        file: format!("{}.jar", name.to_lowercase().replace(' ', "-")),
        display_name: name.into(),
        version: ver.into(),
        enabled,
        linked,
        project_id: None,
        icon_url: None,
        description: desc.into(),
        size: 1_200_000,
    }
}

/// Build an app populated with realistic fake data.
pub fn app(ctx: &egui::Context) -> App {
    let mut a = App::new(ctx, false);
    a.settings.setup_done = true;
    a.accounts.add(Account::offline("LuminosPilot"));
    a.accounts.add(Account::offline("Statics"));
    a.accounts.active = 0;
    a.instances = vec![
        inst(
            "luminos-client",
            "Luminos Client",
            "1.21.4",
            Loader::Fabric,
            0,
            42.9,
            3600 * 2,
            true,
        ),
        inst(
            "survival",
            "Survival 2026",
            "1.21.4",
            Loader::Fabric,
            2,
            18.5,
            86400,
            false,
        ),
        inst(
            "vanilla",
            "Vanilla Snapshot",
            "26.4-snapshot-10",
            Loader::Vanilla,
            4,
            3.2,
            86400 * 4,
            false,
        ),
        inst(
            "cobblemon",
            "Cobblemon",
            "1.21.1",
            Loader::Fabric,
            3,
            27.0,
            86400 * 2,
            false,
        ),
        inst(
            "pvp",
            "PvP Practice",
            "1.8.9",
            Loader::Vanilla,
            6,
            9.4,
            86400 * 9,
            false,
        ),
    ];
    a.featured = Loadable::Ready(vec![
        proj(
            "Fabulously Optimized",
            "Beautiful graphics, speedy performance and familiar features in a simple modpack",
            "robotkoer",
            19_500_000,
            "modpack",
        ),
        proj(
            "Cobblemon Official Modpack",
            "The official modpack of the Cobblemon mod, for Fabric!",
            "CobbledStudios",
            11_500_000,
            "modpack",
        ),
        proj(
            "Better MC [FABRIC]",
            "A proper Vanilla+ modpack — don't play vanilla, play better",
            "SHXRKIE",
            3_700_000,
            "modpack",
        ),
    ]);
    a.news = Loadable::Ready(vec![
        NewsItem {
            title: "Minecraft 26.4 Snapshot 10".into(),
            version: "26.4-snapshot-10".into(),
            kind: "snapshot".into(),
            date: "2026-11-17".into(),
            summary: String::new(),
            image_url: None,
        },
        NewsItem {
            title: "Minecraft 26.3 Release".into(),
            version: "26.3".into(),
            kind: "release".into(),
            date: "2026-10-28".into(),
            summary: String::new(),
            image_url: None,
        },
        NewsItem {
            title: "Minecraft 26.3 Release Candidate 1".into(),
            version: "26.3-rc-1".into(),
            kind: "snapshot".into(),
            date: "2026-10-21".into(),
            summary: String::new(),
            image_url: None,
        },
        NewsItem {
            title: "Minecraft 26.3 Pre-Release 4".into(),
            version: "26.3-pre-4".into(),
            kind: "snapshot".into(),
            date: "2026-10-14".into(),
            summary: String::new(),
            image_url: None,
        },
    ]);
    // playtime across the last two weeks
    let now = luminos_core::store::now_unix();
    let hours = [
        1.5f32, 0.0, 2.2, 3.1, 0.7, 4.5, 2.8, 1.9, 0.0, 2.4, 3.6, 1.1, 2.0, 2.5,
    ];
    let ids = [
        "luminos-client",
        "survival",
        "cobblemon",
        "luminos-client",
        "pvp",
    ];
    let mut log = Log::default();
    for (i, h) in hours.iter().enumerate() {
        if *h > 0.0 {
            log.sessions.push(Session {
                instance: ids[i % ids.len()].into(),
                start: now - (13 - i as i64) * 86400 - 600,
                secs: (*h * 3600.0) as u64,
            });
        }
    }
    a.playtime = log;
    a.manifest = Loadable::Ready(luminos_core::mojang::Manifest {
        latest: luminos_core::mojang::Latest {
            release: "1.21.4".into(),
            snapshot: "26.4-snapshot-10".into(),
        },
        versions: vec![],
    });
    a.discover.results = Loadable::Ready(SearchResult {
        total_hits: 5_321,
        hits: vec![
            proj(
                "Sodium",
                "The fastest and most compatible rendering optimization mod for Minecraft",
                "jellysquid3",
                255_450_795,
                "mod",
            ),
            proj(
                "Entity Culling",
                "Using async path-tracing to hide Block-/Entities that are not visible",
                "tr7zw",
                191_623_096,
                "mod",
            ),
            proj(
                "Mod Menu",
                "Adds a mod menu to view the list of mods you have installed",
                "Prospector",
                163_236_873,
                "mod",
            ),
            proj(
                "Lithium",
                "No-compromises game logic optimization mod",
                "jellysquid3",
                145_665_544,
                "mod",
            ),
            proj(
                "AppleSkin",
                "Adds hunger-related features to the HUD of the game",
                "squeek502",
                100_255_805,
                "mod",
            ),
            proj(
                "Iris Shaders",
                "A modern shader pack loader designed for compatibility with Sodium",
                "coderbot",
                196_932_931,
                "mod",
            ),
            proj(
                "Armor Hud",
                "Shows your equipped armour and its durability on screen",
                "mod_author",
                1_379_498,
                "mod",
            ),
            proj(
                "Zoomify",
                "A highly configurable zoom mod with smooth transitions",
                "isxander",
                73_447_445,
                "mod",
            ),
            proj(
                "FerriteCore",
                "Memory usage optimizations",
                "malte0811",
                169_643_029,
                "mod",
            ),
        ],
    });
    a.servers.list = vec![
        luminos_core::servers::SavedServer {
            name: "Hypixel".into(),
            address: "mc.hypixel.net".into(),
            ..Default::default()
        },
        luminos_core::servers::SavedServer {
            name: "Our SMP".into(),
            address: "play.ourSMP.example:25570".into(),
            ..Default::default()
        },
        luminos_core::servers::SavedServer {
            name: "PvP Practice".into(),
            address: "pvp.example.org".into(),
            ..Default::default()
        },
        luminos_core::servers::SavedServer {
            name: "Creative Plots".into(),
            address: "plots.example.net".into(),
            ..Default::default()
        },
    ];
    use luminos_core::loginprobe::LoginMode;
    a.servers.list[1].favorite = true;
    a.servers
        .modes
        .insert("play.ourSMP.example:25570".into(), Ok(LoginMode::OfflineOk));
    a.servers
        .modes
        .insert("mc.hypixel.net".into(), Ok(LoginMode::OnlineRequired));
    let st = |motd: &str, on, max, ver: &str, ms| {
        Loadable::Ready(luminos_core::servers::Status {
            motd: motd.into(),
            online: on,
            max,
            version: ver.into(),
            protocol: 767,
            latency_ms: ms,
        })
    };
    a.servers.status.insert(
        "mc.hypixel.net".into(),
        st(
            "Hypixel Network [1.8-1.21]",
            24_660,
            200_000,
            "Requires MC 1.8 / 1.21",
            56,
        ),
    );
    a.servers.status.insert(
        "play.ourSMP.example:25570".into(),
        st(
            "Season 4 — the Nether update is live!",
            7,
            40,
            "Paper 1.21.4",
            112,
        ),
    );
    a.servers.status.insert(
        "pvp.example.org".into(),
        st("Ranked 1v1 · Kit PvP · Duels", 312, 500, "1.8.9", 241),
    );
    a.servers.status.insert(
        "plots.example.net".into(),
        Loadable::Failed("connecting: Connection refused".into()),
    );
    a.discover.target = Some("luminos-client".into());
    a.detail.entries = vec![
        entry(
            "Armor Hud",
            "1.4.2",
            "Shows your equipped armour and its durability on screen",
            true,
            true,
        ),
        entry(
            "AppleSkin",
            "3.0.5",
            "Adds hunger-related features to the HUD of the game",
            true,
            true,
        ),
        entry(
            "Entity Culling",
            "1.7.4",
            "Using async path-tracing to hide entities that are not visible",
            true,
            true,
        ),
        entry(
            "FerriteCore",
            "7.0.1",
            "Memory usage optimizations",
            true,
            true,
        ),
        entry(
            "Lithium",
            "0.14.3",
            "No-compromises game logic optimization mod",
            true,
            true,
        ),
        entry(
            "Mod Menu",
            "11.0.3",
            "Adds a mod menu to view the list of mods you have installed",
            true,
            true,
        ),
        entry(
            "Sodium",
            "0.6.5",
            "The fastest and most compatible rendering optimization mod",
            true,
            true,
        ),
        entry(
            "Iris Shaders",
            "1.8.1",
            "A modern shader pack loader designed for Sodium",
            false,
            true,
        ),
        entry("My Custom Tweaks", "", "", true, false),
    ];
    // The real built-in skins, exactly as the app ships them.
    a.skins.lib.skins = luminos_core::cosmetics::SKINS
        .iter()
        .map(|b| luminos_core::skins::SkinEntry {
            id: b.id.into(),
            name: b.name.into(),
            slim: b.slim,
            source: "Luminos original".into(),
            added: 0,
        })
        .collect();
    for b in luminos_core::cosmetics::SKINS {
        let px = crate::pages::skins::decode(b.png).unwrap_or_default();
        a.skins.tex.insert(
            b.id.to_string(),
            ctx.load_texture(
                format!("demo-skin-{}", b.id),
                egui::ColorImage::new([64, 64], px),
                egui::TextureOptions::NEAREST,
            ),
        );
    }
    if let Some(acc) = a.accounts.accounts.get_mut(0) {
        acc.skin_id = Some("luminos-default".into());
        acc.cape_id = Some("luminos-moon-cape".into());
    }
    // Client page: pretend the Luminos Client instance is installed, with a few optional mods present.
    if let Some(inst) = a.instances.iter().find(|i| i.id == "luminos-client").cloned() {
        let mk = |file: &str, on: bool| luminos_core::content::Entry {
            file: file.into(),
            display_name: file.into(),
            version: String::new(),
            enabled: on,
            linked: true,
            project_id: None,
            icon_url: None,
            description: String::new(),
            size: 0,
        };
        a.client.mods = vec![mk("luminos-client-0.2.0.jar", true), mk("resourcify-1.21.4.jar", true), mk("zoomify-2.14.jar", false)];
        a.client.cfg = serde_json::json!({"modules": {"cps": {"enabled": false}}, "toggleSprint": true, "zoomFov": 24});
        a.client.instance = Some(inst);
        a.client.loaded_for = a.page_t0;
    }
    a.maint.storage = crate::app::Loadable::Ready(vec![
        luminos_core::storage::Area { name: "Instances", detail: "Worlds, mods and settings.", path: Default::default(), bytes: 3_400_000_000, reclaimable: false },
        luminos_core::storage::Area { name: "Minecraft files", detail: "Re-downloaded when needed.", path: Default::default(), bytes: 1_150_000_000, reclaimable: true },
        luminos_core::storage::Area { name: "Java runtimes", detail: "Re-downloaded when needed.", path: Default::default(), bytes: 610_000_000, reclaimable: true },
        luminos_core::storage::Area { name: "Downloads cache", detail: "Temporary downloads.", path: Default::default(), bytes: 24_000_000, reclaimable: true },
        luminos_core::storage::Area { name: "Skins", detail: "Your skin library.", path: Default::default(), bytes: 90_000, reclaimable: false },
    ]);
    a.skins.selected = Some("luminos-default".into());
    a.detail.tab = DTab::Content;
    a.page = Page::Home;
    a
}
