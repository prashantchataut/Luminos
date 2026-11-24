# Lunar cosmetics: the pattern we matched

Read from Lunar's public store pages on 2026-11-24. Nothing was downloaded, decompiled or copied; art and names in Luminos are original.

Sources: store.lunarclient.com/category/pets, /category/emotes, /category/plus, /category/summermasks; the Lunar download page; holy.gg "Best Lunar Client Cosmetics" (2026-05); bisecthosting.com "Top 10 Must-Have Lunar Client Cosmetics".

## What the store shows
- **Categories**: Cloaks, Emotes, Pets, Auras, Headwear, Wings, Bodywear, Suits, Masks, Bandannas, Backpacks, Music. Store copy: "You can purchase emotes, cloaks, wings, bandannas, hats, and more."
- **Pets** ("Bring a charismatic companion along for your in-game adventures"): 184 packages. Named examples: Bee, Mini-Me, Dragon (Black), Black Wyvern, Ashclaw, Oblivion, Black Hole, Capybara, Cat, Bat, Bunny, Penguin, Frog, Turtle.
- **Bee**: follows the player, animates while idle, wears a tiny diving helmet underwater (holy.gg, bisecthosting).
- **Mini-Me**: a small clone of the player. **Dragon** pets sit by the shoulder. **Black Hole** is an orb pet.
- **Wings**: "Display one of the unique designs for our wings on the back of your character" (Feather, Dragon, Demon, Crystal, Rose, Heart). **Cloaks**: custom-designed cloaks; Lunar+ adds cloth physics.
- **Emotes**: "expressive dances and animations". **Hug** "works solo or syncs with another player nearby" (holy.gg).
- **Masks, Bandannas (neck and face), Headwear, Backpacks** each have their own entries.

## What Luminos does with it
| Lunar pattern | Luminos |
|---|---|
| Pets follow and are independent of other cosmetics | 4 pets, own slot; pets and wings are both worn |
| Bee's diving helmet | every pet changes underwater: Mini-Me gets a diving helmet, Cube a shell, Wyrmling a snorkel, Wisp a bubble (`PET_BEHAVIOUR.md`) |
| Each category has its own slot | 8 slots: pets, wings, hats, masks, bandanas, cloaks, back, emotes |
| Hug syncs between nearby players | `Cosmetics.EmoteSync`: same emote id, within 4 blocks, within 2 s |
| Categories | Pets 4, Wings 3, Hats 3, Masks 2, Bandanas 2, Back items 2, Emotes 3, Cloaks (14 original capes from v0.9) |

Visibility is stated on screen: cosmetics are drawn by the Luminos client, so only Luminos users see them.
