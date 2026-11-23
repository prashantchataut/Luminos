//! Motion tokens: the single source of truth for durations, easings, springs and stagger.
//! Spec: docs/MOTION.md. Everything here is pure maths (unit-tested) so UI code only picks a token.
use eframe::egui::{Context, Id};

/// Durations in seconds (120 / 200 / 320 / 520 / 900 ms).
pub mod dur {
    pub const INSTANT: f32 = 0.120;
    pub const FAST: f32 = 0.200;
    pub const BASE: f32 = 0.320;
    pub const SLOW: f32 = 0.520;
    pub const EPIC: f32 = 0.900;
}

/// Stagger between siblings, seconds. Lists longer than `MAX_STAGGERED` stop staggering so the last row never waits.
pub const STAGGER: f32 = 0.05;
pub const MAX_STAGGERED: usize = 10;

/// Spring presets (stiffness, damping), unit mass. Critically damped = 2*sqrt(k).
pub mod spring {
    pub const SNAPPY: (f32, f32) = (420.0, 34.0);
    pub const SOFT: (f32, f32) = (180.0, 24.0);
    pub const DRAG: (f32, f32) = (260.0, 26.0);
}

/// Standard easing: cubic-bezier(0.2, 0, 0, 1)-like ease-out used for most movement.
pub fn standard(t: f32) -> f32 {
    cubic_bezier(0.2, 0.0, 0.0, 1.0, t)
}

/// Emphasized decelerate: cubic-bezier(0.05, 0.7, 0.1, 1) for entrances.
pub fn emphasized_decelerate(t: f32) -> f32 {
    cubic_bezier(0.05, 0.7, 0.1, 1.0, t)
}

/// CSS-style cubic-bezier(x1,y1,x2,y2) solved with Newton + bisection fallback.
pub fn cubic_bezier(x1: f32, y1: f32, x2: f32, y2: f32, x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    let bez = |a: f32, b: f32, t: f32| {
        3.0 * a * (1.0 - t).powi(2) * t + 3.0 * b * (1.0 - t) * t * t + t.powi(3)
    };
    let (mut lo, mut hi) = (0.0f32, 1.0f32);
    let mut t = x;
    for _ in 0..24 {
        let cx = bez(x1, x2, t);
        if (cx - x).abs() < 1e-5 {
            break;
        }
        if cx < x {
            lo = t;
        } else {
            hi = t;
        }
        t = (lo + hi) * 0.5;
    }
    bez(y1, y2, t)
}

/// Damped spring integrated with semi-implicit Euler at a fixed sub-step, so it is stable at any frame rate.
#[derive(Clone, Copy, Debug)]
pub struct Spring {
    pub value: f32,
    pub velocity: f32,
    pub target: f32,
    pub stiffness: f32,
    pub damping: f32,
}

impl Spring {
    pub fn new(value: f32, (stiffness, damping): (f32, f32)) -> Self {
        Self {
            value,
            velocity: 0.0,
            target: value,
            stiffness,
            damping,
        }
    }
    pub fn step(&mut self, dt: f32) {
        let mut left = dt.min(0.1);
        while left > 0.0 {
            let h = left.min(1.0 / 240.0);
            let a = -self.stiffness * (self.value - self.target) - self.damping * self.velocity;
            self.velocity += a * h;
            self.value += self.velocity * h;
            left -= h;
        }
    }
    pub fn settled(&self) -> bool {
        (self.value - self.target).abs() < 0.001 && self.velocity.abs() < 0.01
    }
}

/// Opacity for the `index`-th row of a list entering `since_enter` seconds ago. Reduced motion = fully visible.
pub fn stagger_opacity(ctx: &Context, id: Id, index: usize, since_enter: f32, reduce: bool) -> f32 {
    if reduce {
        return 1.0;
    }
    let delay = STAGGER * index.min(MAX_STAGGERED) as f32;
    let target = if since_enter >= delay { 1.0 } else { 0.0 };
    ctx.animate_value_with_time(id, target, dur::BASE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn durations_follow_the_spec() {
        assert_eq!(
            [dur::INSTANT, dur::FAST, dur::BASE, dur::SLOW, dur::EPIC]
                .map(|d| (d * 1000.0).round() as u32),
            [120, 200, 320, 520, 900]
        );
    }

    #[test]
    fn easings_hit_endpoints_and_are_monotonic() {
        for f in [standard, emphasized_decelerate] {
            assert!(f(0.0).abs() < 1e-3 && (f(1.0) - 1.0).abs() < 1e-3);
            let mut prev = 0.0;
            for i in 1..=50 {
                let v = f(i as f32 / 50.0);
                assert!(v >= prev - 1e-4, "not monotonic at {i}");
                prev = v;
            }
        }
        // ease-out: well past halfway at t=0.5
        assert!(standard(0.5) > 0.75);
    }

    #[test]
    fn springs_settle_without_runaway_at_any_frame_rate() {
        for dt in [1.0f32 / 30.0, 1.0 / 60.0, 1.0 / 144.0, 0.25] {
            let mut s = Spring::new(0.0, spring::SNAPPY);
            s.target = 1.0;
            let mut peak: f32 = 0.0;
            for _ in 0..((3.0 / dt.min(0.1)) as usize) {
                s.step(dt);
                peak = peak.max(s.value);
                assert!(s.value.is_finite());
            }
            assert!(s.settled(), "dt={dt} value={} v={}", s.value, s.velocity);
            assert!(peak < 1.15, "overshoot too large: {peak}");
        }
    }

    #[test]
    fn long_lists_stop_staggering() {
        let ctx = Context::default();
        let a = stagger_opacity(&ctx, Id::new("a"), 3, 0.0, true);
        assert_eq!(a, 1.0, "reduce motion shows everything immediately");
        assert_eq!(STAGGER * MAX_STAGGERED as f32, 0.5);
    }
}
