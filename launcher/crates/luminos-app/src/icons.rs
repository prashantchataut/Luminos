//! Crisp vector icons drawn with the egui painter (no icon fonts, no image assets).
use eframe::egui::{
    epaint::PathShape, vec2, Color32, Painter, Pos2, Rect, Shape, Stroke, StrokeKind,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Icon {
    Home,
    Compass,
    Grid,
    Shirt,
    Chart,
    Gear,
    Play,
    Stop,
    Plus,
    Close,
    Minus,
    Square,
    Download,
    Refresh,
    Trash,
    Search,
    Folder,
    Check,
    Link,
    Clock,
    Cube,
    Back,
    Bolt,
    Star,
    Brush,
    Bucket,
    Pipette,
    Eraser,
    Layers,
    Server,
}

fn arc(c: Pos2, r: f32, a0: f32, a1: f32, n: usize) -> Vec<Pos2> {
    (0..=n)
        .map(|i| {
            let a = a0 + (a1 - a0) * i as f32 / n as f32;
            c + vec2(a.cos(), a.sin()) * r
        })
        .collect()
}

pub fn paint(p: &Painter, icon: Icon, c: Pos2, size: f32, color: Color32) {
    let k = size / 20.0;
    let pt = |x: f32, y: f32| c + vec2(x, y) * k;
    let st = Stroke::new((1.7 * k).max(1.2), color);
    let line = |pts: &[(f32, f32)]| {
        let v: Vec<Pos2> = pts.iter().map(|(x, y)| pt(*x, *y)).collect();
        p.add(Shape::Path(PathShape::line(v, st)));
    };
    let rrect = |x0: f32, y0: f32, x1: f32, y1: f32, r: f32| {
        p.rect_stroke(
            Rect::from_two_pos(pt(x0, y0), pt(x1, y1)),
            r * k,
            st,
            StrokeKind::Middle,
        );
    };
    match icon {
        Icon::Home => {
            line(&[(-8.5, -0.5), (0.0, -8.0), (8.5, -0.5)]);
            line(&[
                (-6.0, -2.5),
                (-6.0, 7.5),
                (-2.0, 7.5),
                (-2.0, 2.0),
                (2.0, 2.0),
                (2.0, 7.5),
                (6.0, 7.5),
                (6.0, -2.5),
            ]);
        }
        Icon::Compass => {
            p.circle_stroke(c, 8.5 * k, st);
            p.add(Shape::convex_polygon(
                vec![pt(4.0, -4.0), pt(1.2, 1.2), pt(-4.0, 4.0), pt(-1.2, -1.2)],
                color,
                Stroke::NONE,
            ));
        }
        Icon::Grid => {
            rrect(-8.0, -8.0, -1.5, -1.5, 2.0);
            rrect(1.5, -8.0, 8.0, -1.5, 2.0);
            rrect(-8.0, 1.5, -1.5, 8.0, 2.0);
            rrect(1.5, 1.5, 8.0, 8.0, 2.0);
        }
        Icon::Shirt => {
            line(&[
                (-3.0, -8.0),
                (-8.5, -4.5),
                (-6.0, -1.0),
                (-4.0, -2.5),
                (-4.0, 8.0),
                (4.0, 8.0),
                (4.0, -2.5),
                (6.0, -1.0),
                (8.5, -4.5),
                (3.0, -8.0),
            ]);
            p.add(Shape::Path(PathShape::line(
                arc(pt(0.0, -8.0), 3.0 * k, 0.0, std::f32::consts::PI, 8),
                st,
            )));
        }
        Icon::Chart => {
            for (i, h) in [6.0, 11.0, 16.0].iter().enumerate() {
                let x = -8.0 + i as f32 * 6.0;
                p.rect_filled(
                    Rect::from_two_pos(pt(x, 8.0), pt(x + 4.0, 8.0 - h)),
                    1.5 * k,
                    color,
                );
            }
        }
        Icon::Gear => {
            p.circle_stroke(c, 3.2 * k, st);
            p.circle_stroke(c, 6.6 * k, st);
            for i in 0..8 {
                let a = i as f32 * std::f32::consts::TAU / 8.0;
                let d = vec2(a.cos(), a.sin());
                p.line_segment(
                    [c + d * 6.6 * k, c + d * 9.2 * k],
                    Stroke::new(2.6 * k, color),
                );
            }
        }
        Icon::Play => {
            p.add(Shape::convex_polygon(
                vec![pt(-5.0, -8.0), pt(8.0, 0.0), pt(-5.0, 8.0)],
                color,
                Stroke::NONE,
            ));
        }
        Icon::Stop => {
            p.rect_filled(
                Rect::from_two_pos(pt(-6.0, -6.0), pt(6.0, 6.0)),
                2.0 * k,
                color,
            );
        }
        Icon::Plus => {
            line(&[(0.0, -8.0), (0.0, 8.0)]);
            line(&[(-8.0, 0.0), (8.0, 0.0)]);
        }
        Icon::Close => {
            line(&[(-6.0, -6.0), (6.0, 6.0)]);
            line(&[(-6.0, 6.0), (6.0, -6.0)]);
        }
        Icon::Minus => line(&[(-7.0, 0.0), (7.0, 0.0)]),
        Icon::Square => rrect(-6.0, -6.0, 6.0, 6.0, 1.5),
        Icon::Download => {
            line(&[(0.0, -8.0), (0.0, 4.5)]);
            line(&[(-4.5, 0.5), (0.0, 5.0), (4.5, 0.5)]);
            line(&[(-8.0, 9.0), (8.0, 9.0)]);
        }
        Icon::Refresh => {
            p.add(Shape::Path(PathShape::line(
                arc(c, 7.0 * k, -2.2, 3.4, 20),
                st,
            )));
            let tip = c + vec2((-2.2f32).cos(), (-2.2f32).sin()) * 7.0 * k;
            line(&[
                ((tip.x - c.x) / k - 1.0, (tip.y - c.y) / k - 5.0),
                ((tip.x - c.x) / k, (tip.y - c.y) / k),
                ((tip.x - c.x) / k + 5.0, (tip.y - c.y) / k - 1.5),
            ]);
        }
        Icon::Trash => {
            line(&[(-8.0, -5.0), (8.0, -5.0)]);
            line(&[(-3.0, -5.0), (-3.0, -8.0), (3.0, -8.0), (3.0, -5.0)]);
            line(&[(-6.0, -3.0), (-5.0, 8.5), (5.0, 8.5), (6.0, -3.0)]);
            line(&[(0.0, 0.0), (0.0, 5.5)]);
        }
        Icon::Search => {
            p.circle_stroke(pt(-1.5, -1.5), 6.0 * k, st);
            line(&[(3.0, 3.0), (8.5, 8.5)]);
        }
        Icon::Folder => {
            line(&[
                (-8.5, -5.0),
                (-8.5, 7.0),
                (8.5, 7.0),
                (8.5, -3.0),
                (0.5, -3.0),
                (-1.5, -6.0),
                (-8.5, -6.0),
                (-8.5, -5.0),
            ]);
        }
        Icon::Check => line(&[(-7.0, 0.5), (-2.5, 5.5), (7.5, -5.5)]),
        Icon::Link => {
            rrect(-9.0, -3.5, 1.5, 3.5, 3.5);
            rrect(-1.5, -3.5, 9.0, 3.5, 3.5);
        }
        Icon::Clock => {
            p.circle_stroke(c, 8.5 * k, st);
            line(&[(0.0, -4.5), (0.0, 0.0), (4.0, 2.5)]);
        }
        Icon::Cube => {
            line(&[
                (0.0, -9.0),
                (8.0, -4.5),
                (8.0, 4.5),
                (0.0, 9.0),
                (-8.0, 4.5),
                (-8.0, -4.5),
                (0.0, -9.0),
            ]);
            line(&[(-8.0, -4.5), (0.0, 0.0), (8.0, -4.5)]);
            line(&[(0.0, 0.0), (0.0, 9.0)]);
        }
        Icon::Server => {
            rrect(-8.0, -8.0, 8.0, -1.5, 2.0);
            rrect(-8.0, 1.5, 8.0, 8.0, 2.0);
            line(&[(-4.5, -4.75), (-3.0, -4.75)]);
            line(&[(-4.5, 4.75), (-3.0, 4.75)]);
        }
        Icon::Back => {
            line(&[(8.0, 0.0), (-8.0, 0.0)]);
            line(&[(-2.5, -5.5), (-8.0, 0.0), (-2.5, 5.5)]);
        }
        Icon::Bolt => {
            p.add(Shape::convex_polygon(
                vec![
                    pt(2.0, -9.0),
                    pt(-6.0, 1.5),
                    pt(-0.5, 1.5),
                    pt(-2.0, 9.0),
                    pt(6.0, -2.0),
                    pt(0.5, -2.0),
                ],
                color,
                Stroke::NONE,
            ));
        }
        Icon::Star => {
            let mut pts = vec![];
            for i in 0..10 {
                let r = if i % 2 == 0 { 9.0 } else { 4.0 };
                let a = -std::f32::consts::FRAC_PI_2 + i as f32 * std::f32::consts::PI / 5.0;
                pts.push(pt(a.cos() * r, a.sin() * r));
            }
            p.add(Shape::convex_polygon(pts, color, Stroke::NONE));
        }
        Icon::Brush => {
            line(&[(-7.0, 7.0), (-3.0, 3.0)]);
            line(&[(-1.0, 1.0), (8.0, -8.0)]);
            p.circle_filled(pt(-4.5, 4.5), 2.4 * k, color);
        }
        Icon::Bucket => {
            line(&[
                (-7.0, 0.0),
                (0.0, -7.0),
                (7.0, 0.0),
                (0.0, 7.0),
                (-7.0, 0.0),
            ]);
            p.circle_filled(pt(8.0, 6.0), 1.8 * k, color);
        }
        Icon::Pipette => {
            line(&[(-8.0, 8.0), (-2.0, 2.0)]);
            line(&[(-1.0, -3.0), (3.0, 1.0)]);
            line(&[
                (1.0, -5.0),
                (6.0, 0.0),
                (8.0, -2.0),
                (3.0, -7.0),
                (1.0, -5.0),
            ]);
        }
        Icon::Eraser => {
            line(&[
                (-8.0, 3.0),
                (-1.0, -6.0),
                (7.0, 0.0),
                (0.0, 8.0),
                (-5.0, 8.0),
                (-8.0, 3.0),
            ]);
            line(&[(-5.0, 3.0), (3.0, 3.0)]);
        }
        Icon::Layers => {
            line(&[
                (0.0, -8.0),
                (8.5, -3.0),
                (0.0, 2.0),
                (-8.5, -3.0),
                (0.0, -8.0),
            ]);
            line(&[(-8.5, 1.0), (0.0, 6.0), (8.5, 1.0)]);
        }
    }
}
