package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.core.Holder;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.item.ItemStack;

/** Minecraft 26.x (unobfuscated, extractRenderState pipeline) implementation of {@link Gfx}. */
final class Adapter implements Gfx {
	private static int savedBlur = -1;
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
	public void effectIcon(Holder<MobEffect> e, int x, int y, int size) {
		String[] n = e.getRegisteredName().split(":", 2);   // 26.x dropped Gui.getMobEffectSprite: the sprite is mob_effect/<name> in the effect's namespace
		g.blitSprite(RenderPipelines.GUI_TEXTURED, net.minecraft.resources.Identifier.fromNamespaceAndPath(n.length > 1 ? n[0] : "minecraft", "mob_effect/" + n[n.length - 1]), x, y, size, size);
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

	static void restoreBlur() {
		if (savedBlur >= 0) Minecraft.getInstance().options.menuBackgroundBlurriness().set(savedBlur);
		savedBlur = -1;
	}
}
