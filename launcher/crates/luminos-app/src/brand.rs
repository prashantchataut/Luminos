//! Luminos brand: the **lumen orb** – a sphere lit from the upper left and quantised with a 4×4 Bayer
//! matrix into four blues. One source of truth: the in-app painter, the `.exe` icon, the SVGs, the installer
//! art and the website favicon are all generated from [`tile`] by the `luminos-brand` binary.
use eframe::egui::Color32;

pub const INK: Color32 = Color32::from_rgb(6, 10, 26);
pub const TONES: [Color32; 4] = [
    Color32::from_rgb(14, 27, 82),
    Color32::from_rgb(35, 72, 224),
    Color32::from_rgb(92, 140, 255),
    Color32::from_rgb(226, 238, 255),
];

const BAYER4: [[f32; 4]; 4] = [
    [0.0, 8.0, 2.0, 10.0],
    [12.0, 4.0, 14.0, 6.0],
    [3.0, 11.0, 1.0, 9.0],
    [15.0, 7.0, 13.0, 5.0],
];

pub fn bayer4(x: usize, y: usize) -> f32 {
    (BAYER4[y & 3][x & 3] + 0.5) / 16.0
}

/// Brightness 0..3 of one orb cell, `None` outside the disc. `light` is the direction the light comes from.
pub fn orb_cell(n: usize, x: usize, y: usize, light: (f32, f32)) -> Option<usize> {
    let h = n as f32 / 2.0;
    let dx = (x as f32 + 0.5 - h) / h;
    let dy = (y as f32 + 0.5 - h) / h;
    let r2 = dx * dx + dy * dy;
    if r2 > 1.0 {
        return None;
    }
    let nz = (1.0 - r2).sqrt();
    let lz = 0.62f32;
    let norm = (light.0 * light.0 + light.1 * light.1 + lz * lz).sqrt();
    let lam = (dx * light.0 + dy * light.1 + nz * lz) / norm;
    // soft wrap lighting + a faint rim so the dark side never vanishes into the tile
    let b = (lam * 0.92 + 0.2 + (1.0 - nz) * 0.06).clamp(0.0, 1.0);
    let v = b * 3.0;
    let lo = v.floor();
    let idx = lo as usize + usize::from(v - lo > bayer4(x, y));
    Some(idx.min(3))
}

pub const LIGHT_UPPER_LEFT: (f32, f32) = (-0.62, -0.62);

/// A finished icon on a `size`×`size` cell grid: `None` = transparent.
/// `client == true` adds the HUD reticle brackets that mark the in-game client.
pub fn tile(client: bool) -> (usize, Vec<Option<Color32>>) {
    let size = 20usize;
    let mut g: Vec<Option<Color32>> = vec![None; size * size];
    for y in 0..size {
        for x in 0..size {
            let corner = (x == 0 || x == size - 1) && (y == 0 || y == size - 1);
            if !corner {
                g[y * size + x] = Some(INK);
            }
        }
    }
    let (n, off) = if client {
        (12usize, 4usize)
    } else {
        (16usize, 2usize)
    };
    for y in 0..n {
        for x in 0..n {
            if let Some(t) = orb_cell(n, x, y, LIGHT_UPPER_LEFT) {
                g[(y + off) * size + x + off] = Some(TONES[t]);
            }
        }
    }
    if client {
        let arm = 4usize;
        let (a, b) = (1usize, size - 2);
        for i in 0..arm {
            for (x, y) in [
                (a + i, a),
                (a, a + i),
                (b - i, a),
                (b, a + i),
                (a + i, b),
                (a, b - i),
                (b - i, b),
                (b, b - i),
            ] {
                g[y * size + x] = Some(TONES[3]);
            }
        }
    }
    (size, g)
}

/// RGBA pixels of the icon at `px`×`px` (nearest-neighbour: crisp cells at any size).
pub fn render_rgba(px: usize, client: bool) -> Vec<u8> {
    let (n, g) = tile(client);
    let mut out = vec![0u8; px * px * 4];
    for y in 0..px {
        for x in 0..px {
            if let Some(c) = g[(y * n / px) * n + (x * n / px)] {
                let i = (y * px + x) * 4;
                out[i..i + 4].copy_from_slice(&[c.r(), c.g(), c.b(), 255]);
            }
        }
    }
    out
}

/// Crisp vector version (one `<rect>` per cell, adjacent cells share edges).
pub fn svg(client: bool) -> String {
    let (n, g) = tile(client);
    let mut s = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {n} {n}\" width=\"256\" height=\"256\" shape-rendering=\"crispEdges\">\n"
    );
    for y in 0..n {
        let mut x = 0;
        while x < n {
            if let Some(c) = g[y * n + x] {
                let mut w = 1;
                while x + w < n && g[y * n + x + w] == Some(c) {
                    w += 1;
                }
                s += &format!(
                    "<rect x=\"{x}\" y=\"{y}\" width=\"{w}\" height=\"{}\" fill=\"#{:02x}{:02x}{:02x}\"/>\n",
                    1,
                    c.r(),
                    c.g(),
                    c.b()
                );
                x += w;
            } else {
                x += 1;
            }
        }
    }
    s + "</svg>\n"
}
