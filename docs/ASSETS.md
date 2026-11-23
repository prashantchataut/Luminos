# ASSETS

## Original voxel icon set (B2)
- 29 icons, 16x16, drawn by us in `tools/make_icons.py` from polygons/lines/discs with one shared palette and an automatic 1px outline. Output: `brand/icons/svg/*.svg`, `brand/icons/png/*.png` (128px, nearest-neighbour), `brand/icons/manifest.json`, contact sheet `brand/icons/sheet.png`.
- Groups: **versions** (5, one per supported version: 1.21.4 grass, 1.21.11 copper, 26.1.2 ice, 26.2 amber, 26.3 night-blue), **loaders** (vanilla, fabric, quilt, forge, neoforge: generic concept symbols, deliberately *not* the loaders' own logos), **modes** (survival, creative, adventure, spectator), **items** (sword, pickaxe, apple, potion, torch, chest, diamond), **categories** (performance, visuals, utility, worldgen, decoration, library, technology, magic).
- Nothing is traced from or extracted out of Minecraft's texture atlas. The palette contains no violet/lavender (taste-skill TASTE-6); `tools/test_icons.py` enforces that, plus size, palette, outline, uniqueness and byte-identical regeneration.
- Not done yet (ledger B2i): the launcher UI still draws its own vector icons (`icons.rs`); these assets are not yet wired into the egui screens or the site.

## Mojang Brand and Asset Guidelines: what I could and could not check
- **Could not fetch** the official page (`minecraft.net/.../usage-guidelines` and the brand page both returned errors from this sandbox), so this summary is **from secondary pages seen in search results only** and must be re-checked by the owner against the official text.
- What those pages say (paraphrased): non-commercial fan projects may use the name only if it is not the first word of the name and is not used in any logo; they must say clearly that the product is unofficial and not approved by Minecraft/Mojang; commercial uses need the notice "NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG." (Microsoft is named in newer wording); all rights in the name, brand and assets stay with Mojang; permissions can be revoked. The old Brand/Commercial guidelines were merged into one "Minecraft Usage Guidelines" in 2023.
- How Luminos applies it: product name has no "Minecraft" in it; no Mojang textures, logos or artwork in the product or site; the site footer carries "Luminos is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft." (ledger B5c, not yet added).

## Not done
- B1 in-game cover art: needs the headless-client CI harness (not built). No real in-game captures exist yet, so there is nothing to attribute.
