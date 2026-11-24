package dev.luminos.client;

import com.mojang.blaze3d.pipeline.RenderPipeline;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.core.Holder;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.item.ItemStack;

/** Minecraft 1.21.x (Mojang-mapped) implementation of {@link Gfx}. */
final class Adapter implements Gfx {
	private static int savedBlur = -1;
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
	public void effectIcon(Holder<MobEffect> e, int x, int y, int size) {
		g.blitSprite(RenderPipelines.GUI_TEXTURED, Gui.getMobEffectSprite(e), x, y, size, size);
	}
	public void blur(int level) {
		var opt = mc.options.menuBackgroundBlurriness();
		if (savedBlur < 0) savedBlur = opt.get();
		if (opt.get() != level) opt.set(level);
		if (level > 0) {
			try { g.blurBeforeThisStratum(); }
			catch (IllegalStateException alreadyBlurred) { /* Minecraft or another mod already blurred this frame: the glass sits on that blur */ }
		}
	}
	public void clip(int x0, int y0, int x1, int y1) { g.enableScissor(x0, y0, x1, y1); }
	public void unclip() { g.disableScissor(); }

	/** Gives the player's own blur setting back (the panel borrows it while open). */
	static void restoreBlur() {
		if (savedBlur >= 0) Minecraft.getInstance().options.menuBackgroundBlurriness().set(savedBlur);
		savedBlur = -1;
	}
}
