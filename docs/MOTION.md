# Motion spec

Implemented tokens live in `launcher/crates/luminos-app/src/motion.rs` (unit-tested). This document is the contract; the status column says what is real.

## Tokens
| Token | Value |
|---|---|
| Durations | 120 / 200 / 320 / 520 / 900 ms (`INSTANT, FAST, BASE, SLOW, EPIC`) |
| Standard easing | cubic-bezier(0.2, 0, 0, 1): movement and size |
| Emphasized decelerate | cubic-bezier(0.05, 0.7, 0.1, 1): entrances |
| Springs (stiffness, damping) | snappy (420, 34), soft (180, 24), drag (260, 26), unit mass, fixed 1/240 s sub-step, no runaway at any frame rate |
| Stagger | 50 ms per sibling, capped at 10 siblings so the last row never waits more than 0.5 s |
| Properties | opacity and transform only. Nothing animates layout in a loop |
| Frame budget | 16.6 ms; idle UI repaints only while an animation is active |
| Reduced motion | OS preference and the in-app switch (Settings → Reduce motion, exists today). When on: no stagger, no parallax, no ambient background motion, state changes are instant (opacity only, ≤120 ms) |

## Rules
1. One token per interaction; no ad-hoc durations.
2. Entrances decelerate, exits accelerate and are shorter (≈ 60 %).
3. Origin-aware overlays: menus, popovers and toasts scale from 0.96 and fade from the element that opened them.
4. Ambient motion (sky, clouds, twinkle) pauses when the window is unfocused or minimised.
5. Never block input on an animation.

## Choreography (target)
| Area | Behaviour | Status |
|---|---|---|
| Lists | Staggered fade-in | ✅ Servers page |
| Background | Animated Bayer dither (strip behind headers); setting + reduce-motion exist | 🟡 no moon/clouds/stars, no pause-on-blur |
| Onboarding | Logo resolves out of dither, per-line headline reveal, shared-element steps, progress ring | ❌ (a typewriter/logo reveal from session 1 exists) |
| Navigation | Directional page transitions, sidebar pill glide, tab underline slide, scroll-linked header blur, skeleton shimmer | ❌ |
| Launch button | Idle glow, press squash, progress fill, Ready → Preparing → Launching → Running morph | ❌ |
| Library | Card lift + image parallax, install → progress → check morph | ❌ |
| Cosmetics | Spring-damped 3D drag, cape sway, wardrobe reorder | ❌ (viewer does not exist) |
| Charts | Draw-on, count-up | ❌ |
| Overlays | Origin-aware scale/fade | ❌ |

## Verification still owed
GIF captures per animation and a frame-time profile on real hardware. The sandbox has no GPU or display, and `luminos-shots` renders single frames.
