package dev.luminos.client;

import net.minecraft.client.Minecraft;

/**
 * A movable on-screen widget. Modules draw at (0,0); the host translates and scales them,
 * so a module only has to describe its own size and contents.
 */
public abstract class HudModule {
	protected static final int TEXT = 0xFFE8EEFF;
	protected static final int DIM = 0xFF8596C5;
	protected static final int ACCENT = 0xFF4F8CFF;
	protected static final int PANEL = 0x99080D20;
	protected static final int PANEL_ON = 0xCC2C4F9C;

	public abstract String id();

	public abstract String title();

	/** Width in unscaled GUI pixels. */
	public abstract int width(Minecraft mc);

	public abstract int height(Minecraft mc);

	/** @param preview true inside the editor or when no world is loaded: use sample data. */
	public abstract void render(Gfx g, Minecraft mc, boolean preview);

	public int defaultX() {
		return 6;
	}

	public int defaultY() {
		return 6;
	}

	/** Centred on screen; the configured x/y are ignored. */
	public boolean centered() {
		return false;
	}

	public boolean enabledByDefault() {
		return true;
	}

	protected void panel(Gfx g, int w, int h) {
		if (Config.get().showBackground) {
			g.fill(0, 0, w, h, PANEL);
			g.fill(0, 0, 2, h, ACCENT);
		}
	}
}
