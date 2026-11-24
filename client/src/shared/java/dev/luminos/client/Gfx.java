package dev.luminos.client;

import net.minecraft.core.Holder;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.item.ItemStack;

/** The few drawing operations the HUD and panels need. Each Minecraft line implements this over its own renderer. */
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
	/** Draws the vanilla mob-effect sprite (18x18 art) scaled to {@code size} GUI pixels. */
	void effectIcon(Holder<MobEffect> effect, int x, int y, int size);
	/** Real gaussian blur of everything drawn so far this frame (Minecraft's own menu blur). Level 0 turns it off. */
	void blur(int level);
	/** Clip following drawing to a rectangle in the current (pushed) coordinate space; pair with {@link #unclip()}. */
	void clip(int x0, int y0, int x1, int y1);
	void unclip();
}
