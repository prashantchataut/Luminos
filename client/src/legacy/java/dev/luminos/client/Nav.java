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
	static Screen screen(Minecraft mc) { return mc.screen; }
	static void open(Minecraft mc, Screen s) { mc.setScreen(s); }
	static KeyMapping register(KeyMapping k) { return KeyBindingHelper.registerKeyBinding(k); }
	static int boundCode(KeyMapping k) { return KeyBindingHelper.getBoundKeyOf(k).getValue(); }
	static String keyName(KeyMapping k) { return k.getTranslatedKeyMessage().getString(); }
	static void rebind(Minecraft mc, KeyMapping k, int code) {
		k.setKey(InputConstants.Type.KEYSYM.getOrCreate(code));
		KeyMapping.resetMapping();
		mc.options.save();
	}
	static void toast(Minecraft mc, String s) { if (mc.player != null) mc.player.displayClientMessage(Component.literal(s), true); }
	static String version(Minecraft mc) { return mc.getLaunchedVersion(); }
	static boolean windowActive(Minecraft mc) { return mc.isWindowActive(); }
}
