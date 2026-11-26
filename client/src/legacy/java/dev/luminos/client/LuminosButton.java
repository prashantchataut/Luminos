package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/**
 * A real {@link Button}: Minecraft's Screen owns hit-testing, hover/focus, keyboard navigation (Tab, Enter),
 * the click sound and narration. Only the pixels are Luminos': a flat obsidian slab, a 3px accent bar on the
 * left edge that grows on hover/focus, and a plain label.
 */
final class LuminosButton extends Button {
	private final boolean primary;
	private float lit;

	LuminosButton(int x, int y, int w, int h, String label, boolean primary, Runnable action) {
		super(x, y, w, h, Component.literal(label), b -> action.run(), DEFAULT_NARRATION);
		this.primary = primary;
	}

	@Override
	protected void renderContents(GuiGraphics g, int mx, int my, float pt) {
		boolean hot = isHoveredOrFocused() && active;
		lit += ((hot ? 1f : 0f) - lit) * 0.35f;
		int x = getX(), y = getY(), w = getWidth(), h = getHeight();
		int base = primary ? 0xFF162A55 : 0xFF11141C;
		int over = primary ? 0xFF1F3C7A : 0xFF1A2030;
		g.fill(x, y, x + w, y + h, lit > 0.5f ? over : base);
		g.renderOutline(x, y, w, h, 0x33FFFFFF);
		int bar = 2 + Math.round(lit * 3);
		g.fill(x, y, x + bar, y + h, active ? 0xFF3B82F6 : 0xFF3A4152);
		int tx = x + 12 + Math.round(lit * 3);
		int ty = y + (h - 8) / 2;
		Minecraft mc = Minecraft.getInstance();
		g.drawString(mc.font, getMessage(), tx, ty, active ? (hot ? 0xFFFFFFFF : 0xFFD7DEEE) : 0xFF6B7385);
		if (hot) g.drawString(mc.font, "\u203A", x + w - 14, ty, 0xFF93C5FD);
	}
}
