# User artwork audit: commit `be42463` ("images to use.")

12 files were added under `docs/`. Method: every file was decoded, its real pixel size read, and all of them were looked at on two contact sheets at ~640 px wide.
**Limit of this audit:** nothing was inspected at 100% zoom, so fine artefacts (hands, tool edges, texture seams) may have been missed.

| File | Filename says | Actual size | Verdict | Used in |
|---|---|---|---|---|
| `01-hero-blue-hour-2560x1440.webp` | 2560x1440 | 2048x1152 | Best composition: rim-lit character on the left third, lit village and moon on the right, calm dark sky. The character sits where left-aligned text would go, so the Home hero puts its text on the right and darkens from the right. | Launcher Home hero, onboarding backdrop, site hero |
| `01-...[1].webp` | | same bytes as 01 | **Byte-identical duplicate** (`cmp` equal). Not used, not copied. | none |
| `02-hero-sunrise-meadow` | 2560x1440 | 2048x1152 | Bright and clean, warm light. Too bright for the dark UI, kept as an alternate. | `app/public/art/hero-sunrise.webp` |
| `03-hero-snowy-aurora` | 2560x1440 | 2048x1152 | Strong aurora and frozen lake. The cloaked figure reads as a hooded human more than a blocky Minecraft player. | `hero-aurora.webp`, site |
| `04-hero-lush-cave` | 2560x1440 | 2048x1152 | Busy, very dark (mean luminance 0.13); text over it needs a heavy scrim. | `hero-cave.webp` |
| `05-title-screen-background-1920x1080-no-text` | 1920x1080 | 2048x1152 | Right choice for a menu background: dark, low contrast, no text. The lower-left tree is soft and blocky-blurry, so the in-game vignette and left scrim cover it. Downscaled to 1600x900 PNG (876 KB). | `client/.../textures/gui/title_bg.png`, `LuminosTitleScreen` |
| `06-skin-studio-backdrop-1920x1080-no-character` | 1920x1080 | 2048x1152 | Clean empty podium. Used behind the 3D stage in "Studio Rim Light". | Skin Showdown Studio |
| `07-mod-library-empty-state` | 1920x1080 | 2048x1152 | Warm interior, detailed. Not yet placed in a UI; copied for the Mods empty state. | `mods-empty.webp` |
| `site-og-card-1200x630` | 1200x630 | 2192x1152 | Wrong aspect ratio (1.90 vs 1.91 is fine, but the pixel size is 1.8x larger than named). The left half is a flat blue gradient with a visible seam where the scene dissolves into it. Needs a crop before use as `og:image`. | copied to `site/public/art/` only |
| `site-readme-banner-1280x640` | 1280x640 | 2240x1120 | Pixel-art style: consistent with the Luminos moon mark, but the character is tiny. | `site/public/art/` |
| `version-cover-overworld-1024x1024` | 1024x1024 | 1600x1600 | Clean isometric farm; reads well at card size. | Home version cover card |
| `version-cover-nether-1024x1024` | 1024x1024 | 1600x1600 | Lava and crimson fungi, high contrast, reads well. | Home version cover card |

Every filename overstates the real resolution except the covers' aspect ratios. None of the images contain readable text.
