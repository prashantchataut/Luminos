package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.item.ItemStack;

/** Minecraft 1.21.x (Mojang-mapped) implementation of {@link Gfx}. */
final class Adapter implements Gfx {
	private final GuiGraphics g;
	private final Minecraft mc = Minecraft.getInstance();

	Adapter(GuiGraphics g) { this.g = g; }

	public void text(String s, int x, int y, int color) { g.drawString(mc.font, s, x, y, color); }
	public void fill(int x0, int y0, int x1, int y1, int color) { g.fill(x0, y0, x1, y1, color); }
	public void outline(int x, int y, int w, int h, int color) { g.renderOutline(x, y, w, h, color); }
	public void item(ItemStack s, int x, int y) { g.renderItem(s, x, y); }
	public void itemDecorations(ItemStack s, int x, int y) { g.renderItemDecorations(mc.font, s, x, y); }
	public int textWidth(String s) { return mc.font.width(s); }
	public int width() { return g.guiWidth(); }
	public int height() { return g.guiHeight(); }
	public void push(float tx, float ty, float scale) {
		g.pose().pushMatrix();
		g.pose().translate(tx, ty);
		g.pose().scale(scale, scale);
	}
	public void pop() { g.pose().popMatrix(); }
}
