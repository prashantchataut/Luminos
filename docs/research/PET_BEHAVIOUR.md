# Pet behaviour spec

Written before the models. Every pet answers the same five situations; the 3D preview in the Locker (`app/src/cos3d.ts`) implements exactly this table and the Behaviour list in the Locker shows it. Lunar's Bee is remembered for the diving helmet, not the bee (see LUNAR_COSMETICS.md), so every pet gets a **swim** change, not just a bob.

## Cube (`pet-cube`)
| State | Behaviour |
|---|---|
| idle | Hovers at your right, 14 px out and 8 px up; bobs 1.5 px every 2 s and turns once per 8 s. |
| walk | Trails 6 px behind; the bob speeds up to once per second and the turn follows your heading. |
| jump | Squashes for 0.1 s, then rises 6 px above you and settles after you land. |
| swim | A clear shell appears around it so it stays dry; it drifts at your shoulder height. |
| hurt | Flashes red for 0.3 s and shakes sideways; the glow dims until you heal. |

## Wyrmling (`pet-wyrmling`)
| State | Behaviour |
|---|---|
| idle | Perches on your right shoulder; folds wings, tail sways every 1.2 s, blinks every 4 s. |
| walk | Bobs with your stride and leans into the turn; wings stay folded. |
| jump | Flares both wings for the airtime, folds on landing. |
| swim | A snorkel slides out of its snout; it grips your collar and keeps its head up. |
| hurt | Squeaks, flattens its wings and hunches for 0.4 s. |

## Wisp (`pet-wisp`)
| State | Behaviour |
|---|---|
| idle | Circles you at 12 px radius once per 6 s, rising and falling 3 px; a 6-point trail fades over 0.5 s. |
| walk | Orbit tightens to 9 px and speeds up; the trail stretches behind you. |
| jump | Spirals upward with you and drops back as you fall. |
| swim | Wraps itself in a bubble and leaves rising bubbles instead of a trail. |
| hurt | Flares bright for 0.2 s, then dims to half for 2 s. |

## Mini-Me (`pet-minime`)
| State | Behaviour |
|---|---|
| idle | Stands at your left, 9 px out, 0.28 scale; copies your skin and your head turn. |
| walk | Copies your stride a half step late, keeping pace beside you. |
| jump | Jumps when you jump, with a 0.1 s delay. |
| swim | A tiny diving helmet appears on its head and it floats with its arms out. |
| hurt | Staggers back 2 px and rocks for 0.3 s. |

Status: **VERIFIED** in the 3D preview (renders, states switch). **NOT BUILT** in the Java client: nothing draws pets in a world yet.
