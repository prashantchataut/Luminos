package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/**
 * Standalone copy of the Luminos title menu (used by the CI smoke tour and as a fallback; the player normally sees Minecraft's own
 * TitleScreen cleaned up in place by TitleScreenMixin). Layout and painting live in {@link TitleScene} (so the offscreen preview in docs/design/rounds draws the
 * same pixels); this class only owns state and behaviour. Every button is a {@link LuminosPillButton}, a real Minecraft {@link Button}
 * registered with {@code addRenderableWidget} (Mojang's name for Yarn's {@code addDrawableChild}), and {@code mouseClicked} defers to
 * {@code super}, so hit-testing, hover, Tab/Enter navigation and the click sound all come from Minecraft's own Screen code.
 */
public final class LuminosTitleScreen extends Screen {
	private long lastFrame = System.nanoTime();
	private float fps = 60f;

	public LuminosTitleScreen() { super(Component.literal("Luminos")); }

	/** A Minecraft Button whose pixels come from {@link TitleScene#paintButton}; hover eases 0..1 at 0.25 per frame. */
	public static final class LuminosPillButton extends Button {
		private final TitleScene.Btn spec;
		private float hoverAnim;

		public LuminosPillButton(TitleScene.Btn spec, Runnable action) {
			super(spec.x(), spec.y(), spec.w(), spec.h(), Component.literal(spec.label()), b -> action.run(), DEFAULT_NARRATION);
			this.spec = spec;
		}

		@Override
		protected void renderContents(GuiGraphics g, int mx, int my, float pt) {
			hoverAnim = Math.max(0f, Math.min(1f, hoverAnim + (isHoveredOrFocused() ? 0.25f : -0.25f)));
			TitleScene.paintButton(new Adapter(g), spec, hoverAnim);
		}
	}

	@Override
	protected void init() {
		for (TitleScene.Btn b : TitleMenu.layout(width, height)) addRenderableWidget(TitleMenu.widget(b, this));
	}

	/** The scene is painted in {@link #render}; vanilla's own background (blur / panorama) must not draw over it. */
	@Override
	public void renderBackground(GuiGraphics g, int mx, int my, float pt) {}

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) {
		Gfx gx = new Adapter(g);
		long now = System.nanoTime();
		fps += ((1e9f / Math.max(1, now - lastFrame)) - fps) * 0.05f;
		lastFrame = now;
		String mc = WindowBrand.mcVersion();
		TitleScene.paintBackdrop(gx, width, height);
		TitleScene.paintBrand(gx, width, height, mc);
		String who = minecraft.getUser() == null ? "" : minecraft.getUser().getName();
		TitleScene.paintChrome(gx, width, height, who, Math.round(fps), mc);
		super.render(g, mx, my, pt);   // draws the registered buttons
	}

	/** Never swallow clicks: every registered button gets its click from Minecraft's own Screen code. */
	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
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
