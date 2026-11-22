//! Headless screenshot renderer.
//!
//! Runs the *real* launcher UI against deterministic demo data, tessellates it with egui and
//! rasterises the triangles in software, so we can publish true renders of every screen
//! (for PRs and the website) without a GPU, window system or network.
//!
//! Usage: `cargo run -p luminos-app --release --bin luminos-shots -- docs/screenshots`
use eframe::egui::{
    self, epaint::Primitive, vec2, ColorImage, ImageData, Pos2, Rect, TextureFilter, TextureId,
};
use luminos_app::{
    app::{App, CreateState, DTab, Launching, Page},
    demo,
};
use luminos_core::{download::Progress, instances::Loader};
use std::{collections::HashMap, path::PathBuf, sync::atomic::Ordering};

struct Tex {
    img: ColorImage,
    nearest: bool,
}

struct Canvas {
    w: usize,
    h: usize,
    px: Vec<[f32; 4]>,
}

impl Canvas {
    fn new(w: usize, h: usize) -> Self {
        Self {
            w,
            h,
            px: vec![[0.02, 0.03, 0.09, 1.0]; w * h],
        }
    }
}

fn sample(t: &Tex, u: f32, v: f32) -> [f32; 4] {
    let [tw, th] = t.img.size;
    let get = |x: i64, y: i64| -> [f32; 4] {
        let c = t.img.pixels
            [(y.clamp(0, th as i64 - 1) as usize) * tw + x.clamp(0, tw as i64 - 1) as usize];
        [
            c.r() as f32 / 255.0,
            c.g() as f32 / 255.0,
            c.b() as f32 / 255.0,
            c.a() as f32 / 255.0,
        ]
    };
    if t.nearest {
        return get(
            (u * tw as f32).floor() as i64,
            (v * th as f32).floor() as i64,
        );
    }
    let (fx, fy) = (u * tw as f32 - 0.5, v * th as f32 - 0.5);
    let (x0, y0) = (fx.floor(), fy.floor());
    let (ax, ay) = (fx - x0, fy - y0);
    let (x0, y0) = (x0 as i64, y0 as i64);
    let (c00, c10, c01, c11) = (
        get(x0, y0),
        get(x0 + 1, y0),
        get(x0, y0 + 1),
        get(x0 + 1, y0 + 1),
    );
    let mut out = [0.0; 4];
    for i in 0..4 {
        out[i] = (c00[i] * (1.0 - ax) + c10[i] * ax) * (1.0 - ay)
            + (c01[i] * (1.0 - ax) + c11[i] * ax) * ay;
    }
    out
}

fn rasterize(
    canvas: &mut Canvas,
    prims: &[egui::ClippedPrimitive],
    textures: &HashMap<TextureId, Tex>,
    ppp: f32,
) {
    for cp in prims {
        let Primitive::Mesh(mesh) = &cp.primitive else {
            continue;
        };
        let Some(tex) = textures.get(&mesh.texture_id) else {
            continue;
        };
        let clip = cp.clip_rect;
        let (cx0, cy0) = (
            ((clip.min.x * ppp).floor().max(0.0)) as usize,
            ((clip.min.y * ppp).floor().max(0.0)) as usize,
        );
        let (cx1, cy1) = (
            ((clip.max.x * ppp).ceil() as usize).min(canvas.w),
            ((clip.max.y * ppp).ceil() as usize).min(canvas.h),
        );
        for tri in mesh.indices.chunks_exact(3) {
            let mut v = [
                mesh.vertices[tri[0] as usize],
                mesh.vertices[tri[1] as usize],
                mesh.vertices[tri[2] as usize],
            ];
            let p = |i: usize| (v[i].pos.x * ppp, v[i].pos.y * ppp);
            let area =
                (p(1).0 - p(0).0) * (p(2).1 - p(0).1) - (p(1).1 - p(0).1) * (p(2).0 - p(0).0);
            if area.abs() < 1e-6 {
                continue;
            }
            if area < 0.0 {
                v.swap(1, 2);
            }
            let p = |i: usize| (v[i].pos.x * ppp, v[i].pos.y * ppp);
            let area =
                (p(1).0 - p(0).0) * (p(2).1 - p(0).1) - (p(1).1 - p(0).1) * (p(2).0 - p(0).0);
            let minx = p(0).0.min(p(1).0).min(p(2).0).floor().max(cx0 as f32) as usize;
            let maxx = (p(0).0.max(p(1).0).max(p(2).0).ceil() as usize).min(cx1);
            let miny = p(0).1.min(p(1).1).min(p(2).1).floor().max(cy0 as f32) as usize;
            let maxy = (p(0).1.max(p(1).1).max(p(2).1).ceil() as usize).min(cy1);
            let col: Vec<[f32; 4]> = v
                .iter()
                .map(|vx| {
                    [
                        vx.color.r() as f32 / 255.0,
                        vx.color.g() as f32 / 255.0,
                        vx.color.b() as f32 / 255.0,
                        vx.color.a() as f32 / 255.0,
                    ]
                })
                .collect();
            for y in miny..maxy {
                for x in minx..maxx {
                    // tiny offset breaks exact-diagonal ties so shared edges never double-blend
                    let (sx, sy) = (x as f32 + 0.5 + 1.1e-4, y as f32 + 0.5 + 2.3e-4);
                    let e = |a: (f32, f32), b: (f32, f32)| {
                        (b.0 - a.0) * (sy - a.1) - (b.1 - a.1) * (sx - a.0)
                    };
                    let w0 = e(p(1), p(2)) / area;
                    let w1 = e(p(2), p(0)) / area;
                    let w2 = e(p(0), p(1)) / area;
                    if w0 < 0.0 || w1 < 0.0 || w2 < 0.0 {
                        continue;
                    }
                    let u = w0 * v[0].uv.x + w1 * v[1].uv.x + w2 * v[2].uv.x;
                    let vv = w0 * v[0].uv.y + w1 * v[1].uv.y + w2 * v[2].uv.y;
                    let t = sample(tex, u, vv);
                    let mut s = [0.0f32; 4];
                    for i in 0..4 {
                        s[i] = t[i] * (col[0][i] * w0 + col[1][i] * w1 + col[2][i] * w2);
                    }
                    let d = &mut canvas.px[y * canvas.w + x];
                    let inv = 1.0 - s[3];
                    for i in 0..4 {
                        d[i] = s[i] + d[i] * inv;
                    }
                }
            }
        }
    }
}

fn apply_delta(
    textures: &mut HashMap<TextureId, Tex>,
    id: TextureId,
    delta: egui::epaint::ImageDelta,
) {
    {
        let ImageData::Color(c) = &delta.image;
        let nearest = delta.options.magnification == TextureFilter::Nearest;
        match delta.pos {
            None => {
                textures.insert(
                    id,
                    Tex {
                        img: (**c).clone(),
                        nearest,
                    },
                );
            }
            Some([px, py]) => {
                if let Some(t) = textures.get_mut(&id) {
                    for y in 0..c.size[1] {
                        for x in 0..c.size[0] {
                            t.img.pixels[(py + y) * t.img.size[0] + px + x] =
                                c.pixels[y * c.size[0] + x];
                        }
                    }
                }
            }
        }
    }
}

/// Render one scene to a PNG.
fn shot(
    name: &str,
    out: &PathBuf,
    size: (f32, f32),
    ppp: f32,
    times: &[f64],
    setup: impl FnOnce(&mut App),
) {
    let ctx = egui::Context::default();
    ctx.set_pixels_per_point(ppp);
    let mut app = demo::app(&ctx);
    setup(&mut app);
    let mut textures: HashMap<TextureId, Tex> = HashMap::new();
    let mut last = None;
    for &t in times {
        let mut input = egui::RawInput::default();
        input.screen_rect = Some(Rect::from_min_size(Pos2::ZERO, vec2(size.0, size.1)));
        input.time = Some(t);
        let mut full = ctx.run_ui(input, |ui| app.draw(ui));
        let set = std::mem::take(&mut full.textures_delta.set);
        for (id, deltas) in set {
            for delta in deltas {
                apply_delta(&mut textures, id, delta);
            }
        }
        last = Some(std::mem::take(&mut full.shapes));
    }
    let prims = ctx.tessellate(last.unwrap(), ppp);
    let (w, h) = ((size.0 * ppp) as usize, (size.1 * ppp) as usize);
    let mut canvas = Canvas::new(w, h);
    rasterize(&mut canvas, &prims, &textures, ppp);
    let mut img = image::RgbaImage::new(w as u32, h as u32);
    for (i, p) in canvas.px.iter().enumerate() {
        let c = |v: f32| (v.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
        img.put_pixel(
            (i % w) as u32,
            (i / w) as u32,
            image::Rgba([c(p[0]), c(p[1]), c(p[2]), 255]),
        );
    }
    let path = out.join(format!("{name}.png"));
    img.save(&path).expect("save png");
    println!("wrote {}", path.display());
}

fn main() {
    let out = PathBuf::from(
        std::env::args()
            .nth(1)
            .unwrap_or_else(|| "docs/screenshots".into()),
    );
    std::fs::create_dir_all(&out).unwrap();
    let size = (1280.0, 800.0);
    let ppp = 1.5;
    let settle = [2.0, 2.4, 2.8, 3.2, 3.6];

    shot("01-setup-welcome", &out, size, ppp, &[5.0, 5.3, 5.6], |a| {
        a.settings.setup_done = false;
        a.wizard.step = 0;
    });
    shot("02-setup-profile", &out, size, ppp, &settle, |a| {
        a.settings.setup_done = false;
        a.wizard.step = 1;
        a.wizard.name = "LuminosPilot".into();
    });
    shot("03-setup-performance", &out, size, ppp, &settle, |a| {
        a.settings.setup_done = false;
        a.wizard.step = 2;
        a.settings.memory_mb = 6144;
        a.java_list = luminos_app::app::Loadable::Ready(vec![
            luminos_core::java::JavaInstall {
                path: "/usr/lib/jvm/temurin-21/bin/java".into(),
                major: 21,
            },
            luminos_core::java::JavaInstall {
                path: "/usr/lib/jvm/temurin-17/bin/java".into(),
                major: 17,
            },
        ]);
    });
    shot("04-setup-client", &out, size, ppp, &settle, |a| {
        a.settings.setup_done = false;
        a.wizard.step = 3;
        a.wizard.mc_version = "1.21.4".into();
    });
    shot("05-setup-install", &out, size, ppp, &settle, |a| {
        a.settings.setup_done = false;
        a.wizard.step = 4;
        a.wizard.installing = true;
        a.wizard.progress.total.store(28, Ordering::Relaxed);
        a.wizard.progress.done.store(17, Ordering::Relaxed);
        a.wizard.progress.set_stage("Installing Entity Culling…");
    });
    shot("06-home", &out, size, ppp, &settle, |_| {});
    shot("07-library", &out, size, ppp, &settle, |a| {
        a.page = Page::Library
    });
    shot("08-instance-content", &out, size, ppp, &settle, |a| {
        a.page = Page::Instance("luminos-client".into());
        a.detail.tab = DTab::Content;
    });
    shot("09-discover", &out, size, ppp, &settle, |a| {
        a.page = Page::Discover
    });
    shot("10-skins-library", &out, size, ppp, &settle, |a| {
        a.page = Page::Skins
    });
    shot("11-skins-studio", &out, size, ppp, &settle, |a| {
        a.page = Page::Skins;
        a.skins.editing = true;
    });
    shot("12-playtime", &out, size, ppp, &settle, |a| {
        a.page = Page::Stats
    });
    shot("13-settings", &out, size, ppp, &settle, |a| {
        a.page = Page::Settings
    });
    shot("14-new-instance", &out, size, ppp, &settle, |a| {
        a.page = Page::Library;
        a.create = Some(CreateState {
            name: "Luminos Survival".into(),
            loader: Loader::Fabric,
            mc_version: "1.21.4".into(),
            preset_client: true,
            busy: false,
            error: None,
            show_snapshots: false,
        });
    });
    shot("16-servers", &out, size, ppp, &settle, |a| {
        a.page = Page::Servers
    });
    shot("17-instance-worlds", &out, size, ppp, &settle, |a| {
        a.page = Page::Instance("survival".into());
        a.detail.tab = DTab::Worlds;
    });
    shot("18-crash-doctor", &out, size, ppp, &settle, |a| {
        a.page = Page::Instance("survival".into());
        a.detail.tab = DTab::Logs;
        a.last_log = vec![
            "[12:01:07] [main/INFO]: Loading Minecraft 1.21.4 with Fabric Loader 0.16.10".into(),
            "[12:01:09] [main/WARN]: Mixin apply for mod coolshaders failed coolshaders.mixins.json:LevelRendererMixin".into(),
            "[12:01:11] [Render thread/ERROR]: Caused by: java.lang.OutOfMemoryError: Java heap space".into(),
            "[12:01:11] [Render thread/ERROR]: Minecraft ran out of memory".into(),
        ];
    });
    shot("15-launching", &out, size, ppp, &settle, |a| {
        a.page = Page::Instance("luminos-client".into());
        let p = Progress::new();
        p.total.store(3200, Ordering::Relaxed);
        p.done.store(1840, Ordering::Relaxed);
        p.set_stage("Downloading game files (3200)…");
        a.launching = Some(Launching {
            id: "luminos-client".into(),
            name: "Luminos Client".into(),
            progress: p,
        });
    });
}
