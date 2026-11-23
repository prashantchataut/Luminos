package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.world.item.ItemStack;

/** Minecraft 26.x (unobfuscated, extractRenderState pipeline) implementation of {@link Gfx}. */
final class Adapter implements Gfx {
	private final GuiGraphicsExtractor g;
	private final Minecraft mc = Minecraft.getInstance();

	Adapter(GuiGraphicsExtractor g) { this.g = g; }

	public void text(String s, int x, int y, int color) { g.text(mc.font, s, x, y, color); }
	public void fill(int x0, int y0, int x1, int y1, int color) { g.fill(x0, y0, x1, y1, color); }
	public void outline(int x, int y, int w, int h, int color) { g.outline(x, y, w, h, color); }
	public void item(ItemStack s, int x, int y) { g.item(s, x, y); }
	public void itemDecorations(ItemStack s, int x, int y) { g.itemDecorations(mc.font, s, x, y); }
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
