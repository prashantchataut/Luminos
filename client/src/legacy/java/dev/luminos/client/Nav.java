package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Everything whose name differs between Minecraft lines lives here, so shared code stays identical. (1.21.x) */
final class Nav {
	private Nav() {}
	/** True on the line that ships the native Mixin engine (1.21.x). */
	static boolean hasEngine() { return true; }
	static void engineInit(KeyMapping.Category cat) { Engine.init(cat); }
	/** A title-screen button: Luminos-styled pill on this line (a real Button either way). */
	static net.minecraft.client.gui.components.Button menuButton(TitleScene.Btn spec, Runnable action) { return new LuminosTitleScreen.LuminosPillButton(spec, action); }
	static Screen screen(Minecraft mc) { return mc.screen; }
	static void open(Minecraft mc, Screen s) { mc.setScreen(s); }
	static KeyMapping register(KeyMapping k) { return KeyBindingHelper.registerKeyBinding(k); }
	static int boundCode(KeyMapping k) { return KeyBindingHelper.getBoundKeyOf(k).getValue(); }
	static String keyName(KeyMapping k) { return k.getTranslatedKeyMessage().getString(); }
	static void rebind(Minecraft mc, KeyMapping k, Object ev) {
		k.setKey(InputConstants.Type.KEYSYM.getOrCreate(((net.minecraft.client.input.KeyEvent) ev).key()));
		KeyMapping.resetMapping();
		mc.options.save();
	}
	static void toast(Minecraft mc, String s) { if (mc.player != null) mc.player.displayClientMessage(Component.literal(s), true); }
	static String version(Minecraft mc) { return mc.getLaunchedVersion(); }
	static boolean windowActive(Minecraft mc) { return mc.isWindowActive(); }
	static java.util.List<net.minecraft.world.item.ItemStack> containerItems(net.minecraft.world.item.component.ItemContainerContents c) {
		java.util.List<net.minecraft.world.item.ItemStack> out = new java.util.ArrayList<>();
		for (net.minecraft.world.item.ItemStack s : c.nonEmptyItems()) out.add(s);
		return out;
	}
	static Object overlay(Minecraft mc) { return mc.getOverlay(); }
	static java.util.List<net.minecraft.world.item.ItemStack> bundleItems(net.minecraft.world.item.component.BundleContents b) {
		java.util.List<net.minecraft.world.item.ItemStack> out = new java.util.ArrayList<>();
		for (net.minecraft.world.item.ItemStack s : b.items()) out.add(s);
		return out;
	}
}
