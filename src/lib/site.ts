export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const REPO = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/prashantchataut/Luminos";

export const shot = (file: string) => `${BASE}/screenshots/${file}.png`;

export type Status = "live" | "preview" | "planned";

export const SCREENS = [
  { file: "01-setup-welcome", title: "Welcome", desc: "Animated first-run: logo reveal, letter stagger, typewriter tagline on a living dither backdrop." },
  { file: "02-setup-profile", title: "Profile", desc: "Pick your name; see the exact offline UUID a vanilla server will derive." },
  { file: "03-setup-performance", title: "Performance", desc: "Java scan, recommended RAM from your machine, motion preferences." },
  { file: "04-setup-client", title: "Choose your client", desc: "Luminos Client, Vanilla, or skip — one click installs ~28 optimisation mods." },
  { file: "05-setup-install", title: "Installing", desc: "Live progress with moving dither stripes while the bundle installs." },
  { file: "06-home", title: "Home", desc: "Quick play, featured packs, recent instances, weekly playtime and Minecraft news." },
  { file: "07-library", title: "Library", desc: "Every instance as a card with loader, version, playtime and a Play button." },
  { file: "08-instance-content", title: "Instance", desc: "Toggle, update, unlink or remove every mod. Identify unknown jars. Update all." },
  { file: "09-discover", title: "Discover", desc: "Modrinth mods, modpacks, packs and shaders with filters and one-click install." },
  { file: "10-skins-library", title: "Skins library", desc: "Fetch any player's skin from open libraries and keep your favourites." },
  { file: "11-skins-studio", title: "Skin studio", desc: "A real 64×64 pixel editor with front/back preview and slim-arm model." },
  { file: "12-playtime", title: "Playtime", desc: "Local-only session tracking: 14-day chart, streaks, per-instance totals." },
  { file: "13-settings", title: "Settings", desc: "Six blue accents, reduce-motion, memory, JVM flags and auto-update." },
  { file: "14-new-instance", title: "New instance", desc: "Vanilla, Fabric or Quilt — optionally with the full Luminos Client bundle." },
  { file: "15-launching", title: "Launching", desc: "Downloads game files with parallel, verified transfers and clear progress." },
];

export const FEATURES: { title: string; body: string; status: Status; icon: string }[] = [
  { title: "Built-in mod library", body: "Browse Modrinth inside the launcher. Dependencies resolve automatically; install into any instance.", status: "live", icon: "◈" },
  { title: "Auto-update & unlink", body: "Update every linked mod before launch. Unlink a file to pin it forever. Identify unknown jars by hash.", status: "preview", icon: "⟳" },
  { title: "Isolated instances", body: "Each instance has its own version, loader, mods, packs, worlds, memory and JVM flags.", status: "live", icon: "▣" },
  { title: "Luminos Client bundle", body: "Fabric + Sodium, Lithium, Entity Culling, Armor HUD, Mod Menu and more, preselected.", status: "preview", icon: "⬡" },
  { title: "Playtime tracking", body: "Every session recorded locally. Charts, streaks, per-instance totals. No telemetry.", status: "live", icon: "◷" },
  { title: "Skin studio", body: "Fetch skins from open libraries, edit pixel by pixel, wear them offline via CustomSkinLoader.", status: "preview", icon: "◧" },
  { title: "Modpack import", body: "Install .mrpack modpacks from Modrinth as brand-new instances with overrides applied.", status: "preview", icon: "❒" },
  { title: "Auto Java", body: "Detects installed Java or downloads the exact Temurin runtime each Minecraft version needs.", status: "preview", icon: "☕" },
  { title: "Tiny & fast", body: "100% Rust, immediate-mode UI, no webview. ≈ 11 MB release binary, near-zero idle CPU.", status: "live", icon: "⚡" },
  { title: "Microsoft sign-in", body: "Xbox device-code login, token refresh and skin upload.", status: "planned", icon: "⌘" },
  { title: "Forge & NeoForge", body: "Installer processing so every loader launches.", status: "planned", icon: "⚒" },
  { title: "Luminos Client mod", body: "Own HUD modules and a drag-and-drop customisable mod menu.", status: "planned", icon: "✦" },
];

export const CLIENT_MODS: { group: string; mods: string[] }[] = [
  { group: "Performance", mods: ["Sodium", "Lithium", "Entity Culling", "FerriteCore", "ModernFix", "ImmediatelyFast", "More Culling", "Dynamic FPS", "Krypton", "Sodium Extra", "Reese's Sodium Options", "BadOptimizations", "ScalableLux", "Memory Leak Fix"] },
  { group: "HUD", mods: ["Armor HUD", "AppleSkin", "Status Effect Bars", "BetterF3", "Better Ping Display", "Paper Doll (opt-in)"] },
  { group: "Utility", mods: ["Zoomify", "Mouse Tweaks", "Crash Assistant"] },
  { group: "Visuals & Skins", mods: ["Iris Shaders (opt-in)", "3D Skin Layers (opt-in)", "CustomSkinLoader"] },
  { group: "Menu & Core", mods: ["Mod Menu", "YetAnotherConfigLib", "Cloth Config", "Fabric API"] },
];

export const ROADMAP: { phase: string; title: string; items: string[]; state: "done" | "next" | "later" }[] = [
  { phase: "Session 1", title: "Foundation", state: "done", items: ["Rust engine + egui UI", "Dither theme & animated setup", "Instances, Discover, content manager", "Skins studio, playtime, news", "CI, Pages, screenshot renderer"] },
  { phase: "Next", title: "Real-world hardening", state: "next", items: ["Test launches on Win / macOS / Linux", "Microsoft login & skin upload", "Forge / NeoForge", "Installers & self-update"] },
  { phase: "Then", title: "Luminos Client mod", state: "next", items: ["Armour / potion / keystroke HUD modules", "Drag-and-drop HUD editor", "Zoom, freelook, toggle sprint"] },
  { phase: "Later", title: "Power features", state: "later", items: ["CurseForge source", "World backups & server hub", "Crash doctor", "Instance import from Prism / MultiMC"] },
];
