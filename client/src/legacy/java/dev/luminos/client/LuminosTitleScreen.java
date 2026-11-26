package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

/**
 * The Luminos title screen (Mojang mappings: {@code addRenderableWidget} is Yarn's {@code addDrawableChild}). Every button is a registered {@link LuminosButton} (addRenderableWidget), so clicks,
 * hover, Tab/Enter navigation and the click sound come from Minecraft's own Screen code, not from hand-rolled hit boxes.
 *
 * Background: the supplied night-village artwork (textures/gui/title_bg.png, 1600x900) scaled to cover the window, a
 * vertical vignette and a left-hand scrim so the menu stays readable. Switch off in the panel or with LUMINOS_VANILLA_TITLE.
 */
public final class LuminosTitleScreen extends Screen {
	private static final Identifier BG = Identifier.fromNamespaceAndPath("luminos_client", "textures/gui/title_bg.png");
	private static final Identifier LOGO = Identifier.fromNamespaceAndPath("luminos_client", "textures/gui/logo.png");
	private static final int BG_W = 1600, BG_H = 900;

	private long lastFrame = System.nanoTime();
	private float fps = 60f;

	public LuminosTitleScreen() { super(Component.literal("Luminos")); }

	@Override
	protected void init() {
		int bw = 200, bh = 22, gap = 5;
		int x = Math.max(28, width / 12);
		int rows = 7;
		int total = rows * bh + (rows - 1) * gap + 14;
		int y = Math.max(64, Math.min(height / 2 - 40, height - total - 44));

		addRenderableWidget(new LuminosButton(x, y, bw, bh, "Singleplayer", true,
			() -> minecraft.setScreen(new SelectWorldScreen(this))));
		y += bh + gap;
		addRenderableWidget(new LuminosButton(x, y, bw, bh, "Multiplayer", true,
			() -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
		y += bh + gap;
		addRenderableWidget(new LuminosButton(x, y, bw, bh, "Luminos Mods  [Right Ctrl]", false,
			() -> minecraft.setScreen(new LuminosQuickPanelScreen(Panel.Tab.MODULES, false, this))));
		y += bh + gap;
		addRenderableWidget(new LuminosButton(x, y, bw, bh, "Cosmetics & 3D Capes", false,
			() -> minecraft.setScreen(new LuminosCosmeticsScreen(this))));
		y += bh + gap;
		addRenderableWidget(new LuminosButton(x, y, bw, bh, "HUD Studio", false,
			() -> minecraft.setScreen(new HudEditorScreen(this))));
		y += bh + gap + 14;
		int half = (bw - gap) / 2;
		addRenderableWidget(new LuminosButton(x, y, half, bh, "Options", false,
			() -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
		addRenderableWidget(new LuminosButton(x + half + gap, y, half, bh, "Quit Game", false,
			() -> minecraft.stop()));
		addRenderableWidget(new LuminosButton(8, height - 22, 150, 14, "Use vanilla title screen", false, () -> {
			Config.get().customTitle = false;
			Config.save();
			minecraft.setScreen(new TitleScreen());
		}));
	}

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) {
		Gfx gx = new Adapter(g);
		long now = System.nanoTime();
		fps += ((1e9f / Math.max(1, now - lastFrame)) - fps) * 0.05f;
		lastFrame = now;

		// artwork, cover-fit: crop the texture's centre to the window's aspect ratio
		float scale = Math.max(width / (float) BG_W, height / (float) BG_H);
		int rw = Math.min(BG_W, Math.round(width / scale)), rh = Math.min(BG_H, Math.round(height / scale));
		g.blit(RenderPipelines.GUI_TEXTURED, BG, 0, 0, (BG_W - rw) / 2f, (BG_H - rh) / 2f, width, height, rw, rh, BG_W, BG_H);
		// vignette (top to bottom) and a stepped left scrim behind the menu
		g.fillGradient(0, 0, width, height, 0x90080A0F, 0xD0080A0F);
		int scrimW = Math.min(width, Math.max(28, width / 12) + 330);
		for (int i = 0; i < 22; i++) {
			int x0 = scrimW * i / 22, x1 = scrimW * (i + 1) / 22;
			g.fill(x0, 0, x1, height, ((int) (0x99 * (1f - i / 22f)) << 24) | 0x080A0F);
		}

		// brand block above the buttons
		int x = Math.max(28, width / 12);
		g.blit(RenderPipelines.GUI_TEXTURED, LOGO, x, 18, 0f, 0f, 36, 36, 64, 64, 64, 64);
		Glass.text(gx, "LUMINOS CLIENT", x + 46, 22, 1.6f, 0xFFFFFFFF);
		Glass.text(gx, "Minecraft " + WindowBrand.mcVersion() + "  -  Native Max FPS", x + 46, 40, 1f, 0xFF93C5FD);

		// live telemetry (top right): frames per second and heap in use
		Runtime rt = Runtime.getRuntime();
		long used = (rt.totalMemory() - rt.freeMemory()) >> 20, max = rt.maxMemory() >> 20;
		String tele = Math.round(fps) + " FPS   " + used + " / " + max + " MB";
		pill(gx, g, width - 12 - gx.textWidth(tele) - 16, 12, tele, 0xFFE2E8F0);
		String who = minecraft.getUser() == null ? "" : minecraft.getUser().getName();
		if (!who.isEmpty()) pill(gx, g, width - 12 - gx.textWidth(who) - 16, 32, who, 0xFFFFFFFF);

		super.render(g, mx, my, pt);   // draws the registered buttons

		String v = "Luminos Client " + LuminosClient.VERSION;
		gx.text(v, width - gx.textWidth(v) - 8, height - 13, 0xFF8793A8);
	}

	private static void pill(Gfx gx, GuiGraphics g, int x, int y, String s, int color) {
		int w = gx.textWidth(s) + 16;
		g.fill(x, y, x + w, y + 16, 0xB011141C);
		g.renderOutline(x, y, w, 16, 0x26FFFFFF);
		g.fill(x, y, x + 2, y + 16, 0xFF3B82F6);
		gx.text(s, x + 9, y + 4, color);
	}

	/** Never swallow clicks: every registered button gets its click from Minecraft's own Screen code. */
	@Override
	public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent event, boolean doubleClick) {
		return super.mouseClicked(event, doubleClick);
	}

	@Override
	public boolean keyPressed(KeyEvent e) {
		if (e.key() == InputConstants.KEY_ESCAPE) return true;   // the title screen has nothing to go back to
		return super.keyPressed(e);
	}

	@Override
	public boolean shouldCloseOnEsc() { return false; }

	@Override
	public boolean isPauseScreen() { return false; }
}
