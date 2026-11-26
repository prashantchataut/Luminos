package dev.luminos.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

/**
 * "Cosmetics & 3D Capes": the ten HD (512x256) Luminos capes. Each card shows the cape's outer face from the real texture;
 * choosing one saves its id to the Luminos config, and {@link CapeSkin} swaps it in for the local player (third person / F5, freelook).
 */
public final class LuminosCosmeticsScreen extends Screen {
	static final String[][] CAPES = {
		{"luminos-original-moon", "Luminos Original Moon 3D"}, {"job-application", "Job Application 3D"}, {"ball-knowledge-tactician", "Ball Knowledge Tactician 3D"},
		{"touch-grass-3d", "Touch Grass 3D"}, {"404-skill-not-found", "404 Skill Not Found"}, {"crimson-ronin-3d", "Crimson Ronin 3D"},
		{"eclipse-monarch-3d", "Eclipse Monarch 3D"}, {"cobalt-prism-3d", "Cobalt Prism 3D"}, {"sakura-nightfall-3d", "Sakura Nightfall 3D"}, {"void-dragon-3d", "Void Dragon 3D"},
	};
	private final Screen parent;

	public LuminosCosmeticsScreen(Screen parent) { super(Component.literal("Luminos Cosmetics")); this.parent = parent; }

	@Override
	protected void init() {
		int cw = 104, gap = 10, cols = 5, left = (width - (cols * cw + (cols - 1) * gap)) / 2, top = 56;
		for (int i = 0; i < CAPES.length; i++) {
			int cx = left + (i % cols) * (cw + gap), cy = top + (i / cols) * 150;
			final String id = CAPES[i][0], name = CAPES[i][1];
			addRenderableWidget(new LuminosButton(cx, cy + 112, cw, 20, id.equals(Config.get().cosmeticCape) ? "Equipped" : "Equip", id.equals(Config.get().cosmeticCape),
				() -> { Config.get().cosmeticCape = id.equals(Config.get().cosmeticCape) ? "" : id; Config.save(); CapeSkin.invalidate(); minecraft.setScreen(new LuminosCosmeticsScreen(parent)); }));
		}
		addRenderableWidget(new LuminosButton(width / 2 - 60, height - 34, 120, 20, "Back", false, () -> minecraft.setScreen(parent)));
	}

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) {
		g.fillGradient(0, 0, width, height, 0xFF0B0D12, 0xFF11141C);
		g.drawCenteredString(font, "Cosmetics & 3D Capes", width / 2, 22, 0xFFFFFFFF);
		g.drawCenteredString(font, "HD 512x256 capes. Pick one, then press F5 to see it from behind.", width / 2, 36, 0xFF93C5FD);
		int cw = 104, gap = 10, cols = 5, left = (width - (cols * cw + (cols - 1) * gap)) / 2, top = 56;
		for (int i = 0; i < CAPES.length; i++) {
			int cx = left + (i % cols) * (cw + gap), cy = top + (i / cols) * 150;
			g.fill(cx, cy, cx + cw, cy + 110, 0xFF161A24);
			g.renderOutline(cx, cy, cw, 110, CAPES[i][0].equals(Config.get().cosmeticCape) ? 0xFF3B82F6 : 0x33FFFFFF);
			Identifier tex = Identifier.fromNamespaceAndPath("luminos_client", "textures/capes/" + CAPES[i][0] + ".png");
			g.blit(RenderPipelines.GUI_TEXTURED, tex, cx + (cw - 55) / 2, cy + 3, 8f, 8f, 55, 88, 80, 128, 512, 256);
			String n = CAPES[i][1];
			g.drawCenteredString(font, n.length() > 18 ? n.substring(0, 17) + "." : n, cx + cw / 2, cy + 96, 0xFFD7DEEE);
		}
		super.render(g, mx, my, pt);
	}

	@Override
	public void onClose() { minecraft.setScreen(parent); }
}
