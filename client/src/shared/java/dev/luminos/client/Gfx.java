package dev.luminos.client;

import net.minecraft.world.item.ItemStack;

/** The few drawing operations the HUD needs. Each Minecraft line implements this over its own renderer. */
public interface Gfx {
	void text(String s, int x, int y, int color);
	void fill(int x0, int y0, int x1, int y1, int color);
	void outline(int x, int y, int w, int h, int color);
	void item(ItemStack stack, int x, int y);
	void itemDecorations(ItemStack stack, int x, int y);
	int textWidth(String s);
	int width();
	int height();
	/** Translate then scale the following drawing; pair with {@link #pop()}. */
	void push(float tx, float ty, float scale);
	void pop();
}
