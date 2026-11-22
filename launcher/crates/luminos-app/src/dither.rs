//! Ordered (Bayer 8x8) dithering: the animated blue backdrop that gives Luminos its look.
//! A tiny image is generated on the CPU and stretched with nearest-neighbour filtering,
//! which produces chunky, retro "dither" pixels at almost zero cost.
use eframe::egui::{Color32, ColorImage};

fn bayer8(x: usize, y: usize) -> f32 {
    let (mut idx, mut x, mut y) = (0u32, x as u32 & 7, y as u32 & 7);
    for _ in 0..3 {
        idx = (idx << 2) | ((((x ^ y) & 1) << 1) | (y & 1));
        x >>= 1;
        y >>= 1;
    }
    (idx as f32 + 0.5) / 64.0
}

/// Colour ramp from near-black navy up to the accent colour.
fn ramp(accent: Color32, levels: usize) -> Vec<Color32> {
    let dark = Color32::from_rgb(4, 6, 18);
    let deep = Color32::from_rgb(8, 18, 58);
    (0..levels)
        .map(|i| {
            let t = i as f32 / (levels - 1) as f32;
            if t < 0.5 {
                crate::theme::mix(dark, deep, t * 2.0)
            } else {
                crate::theme::mix(deep, accent, (t - 0.5) * 2.0 * 0.85)
            }
        })
        .collect()
}

/// Render the backdrop. `t` is seconds (drives a slow drift), `intensity` 0..1 scales glow strength.
pub fn render(w: usize, h: usize, t: f32, accent: Color32, intensity: f32) -> ColorImage {
    const LEVELS: usize = 6;
    let colors = ramp(accent, LEVELS);
    let mut px = vec![Color32::BLACK; w * h];
    let aspect = w as f32 / h as f32;
    for y in 0..h {
        let v = y as f32 / h as f32;
        for x in 0..w {
            let u = x as f32 / w as f32;
            let ux = u * aspect;
            // top-left glow, drifting slowly
            let c1 = (0.10 * aspect + 0.06 * (t * 0.23).sin(), 0.05 + 0.04 * (t * 0.31).cos());
            let d1 = ((ux - c1.0).powi(2) + (v - c1.1).powi(2)).sqrt();
            let g1 = (1.0 - d1 / 0.85).max(0.0).powf(1.6) * 0.95;
            // bottom-right glow
            let c2 = (0.95 * aspect + 0.05 * (t * 0.27).cos(), 1.0 + 0.05 * (t * 0.19).sin());
            let d2 = ((ux - c2.0).powi(2) + (v - c2.1).powi(2)).sqrt();
            let g2 = (1.0 - d2 / 0.75).max(0.0).powf(1.5) * 0.8;
            // faint diagonal waves
            let wave = 0.045 * ((u * 9.0 + v * 6.0) + t * 0.6).sin() + 0.03 * ((u * 4.0 - v * 7.0) - t * 0.45).sin();
            let val = ((g1 + g2) * intensity + wave * intensity + 0.06).clamp(0.0, 1.0);
            let scaled = val * (LEVELS - 1) as f32;
            let lo = scaled.floor();
            let frac = scaled - lo;
            let idx = lo as usize + usize::from(frac > bayer8(x, y));
            px[y * w + x] = colors[idx.min(LEVELS - 1)];
        }
    }
    ColorImage::new([w, h], px)
}

/// Pick a backdrop resolution for a window: ~1 dither pixel per 6 screen points.
pub fn size_for(screen_w: f32, screen_h: f32) -> (usize, usize) {
    (((screen_w / 6.0).ceil() as usize).clamp(64, 480), ((screen_h / 6.0).ceil() as usize).clamp(48, 300))
}
