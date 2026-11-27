package dev.luminos.client.mixin;

import dev.luminos.client.QuickPanelToggle;
import net.minecraft.client.KeyboardHandler;
import net.minecraft.client.Minecraft;
import net.minecraft.client.input.KeyEvent;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * First hook for Right Ctrl / Right Shift: sees the raw GLFW key event before any screen, key binding or widget does, so the quick
 * panel opens (and closes) the same way over the world, the pause menu, the title screen and the Luminos main menu. The per-frame poll in
 * {@link MinecraftClientMixin} is the second hook; {@link QuickPanelToggle} de-duplicates the two.
 */
@Mixin(KeyboardHandler.class)
public abstract class KeyboardMixin {
	@Inject(method = "keyPress", at = @At("HEAD"), cancellable = true)
	private void luminos$onKey(long window, int action, KeyEvent event, CallbackInfo ci) {
		Minecraft mc = Minecraft.getInstance();
		if (mc == null || mc.getWindow() == null || window != mc.getWindow().handle()) return;
		if (action != GLFW.GLFW_PRESS) return;
		int key = event.key();
		if (key != GLFW.GLFW_KEY_RIGHT_CONTROL && key != GLFW.GLFW_KEY_RIGHT_SHIFT && !QuickPanelToggle.isPanelKey(key)) return;
		if (QuickPanelToggle.press(key)) ci.cancel();
	}
}
