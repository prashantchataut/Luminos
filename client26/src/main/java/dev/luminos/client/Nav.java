package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Everything whose name differs between Minecraft lines lives here, so shared code stays identical. (26.x) */
final class Nav {
	private Nav() {}
	static Screen screen(Minecraft mc) { return mc.gui.screen(); }
	static void open(Minecraft mc, Screen s) { mc.setScreenAndShow(s); }
	static KeyMapping register(KeyMapping k) { return KeyMappingHelper.registerKeyMapping(k); }
	static int boundCode(KeyMapping k) { return KeyMappingHelper.getBoundKeyOf(k).getValue(); }
	static String keyName(KeyMapping k) { return k.getTranslatedKeyMessage().getString(); }
	static void rebind(Minecraft mc, KeyMapping k, Object ev) {
		k.setKey(InputConstants.getKey((net.minecraft.client.input.KeyEvent) ev));
		KeyMapping.resetMapping();
		mc.options.save();
	}
	static void toast(Minecraft mc, String s) { if (mc.player != null) mc.player.sendOverlayMessage(Component.literal(s)); }
	static String version(Minecraft mc) { return net.minecraft.SharedConstants.getCurrentVersion().name(); }
	static boolean windowActive(Minecraft mc) { return mc.isWindowActive(); }
	static java.util.List<net.minecraft.world.item.ItemStack> containerItems(net.minecraft.world.item.component.ItemContainerContents c) { return c.nonEmptyItemCopyStream().toList(); }
	static Object overlay(Minecraft mc) { return mc.gui.overlay(); }
	static java.util.List<net.minecraft.world.item.ItemStack> bundleItems(net.minecraft.world.item.component.BundleContents b) {
		java.util.List<net.minecraft.world.item.ItemStack> out = new java.util.ArrayList<>();
		for (var t : b.items()) out.add(t.create());
		return out;
	}
}
