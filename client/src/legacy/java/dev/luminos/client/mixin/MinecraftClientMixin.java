package dev.luminos.client.mixin;

import dev.luminos.client.LuminosClient;
import dev.luminos.client.LuminosMainMenuScreen;
import dev.luminos.client.QuickPanelToggle;
import dev.luminos.client.WindowBrand;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Three jobs on {@link Minecraft}:
 * <ol>
 *   <li>Window identity: {@code createTitle()} returns "Luminos Client &lt;version&gt; - &lt;mc&gt;" (icon is set natively in {@link WindowBrand}).</li>
 *   <li>Startup screen: {@code setScreen} swaps every vanilla {@link TitleScreen} for {@link LuminosMainMenuScreen} before it is ever shown.</li>
 *   <li>Right Ctrl / Right Shift, second hook: a per-frame GLFW poll with a rising-edge detector, for the case where the raw key event never
 *       reaches {@code KeyboardMixin} (another mod cancelled it earlier). {@link QuickPanelToggle} de-duplicates the two hooks.</li>
 * </ol>
 */
@Mixin(Minecraft.class)
public abstract class MinecraftClientMixin {
	@Unique private boolean luminos$rCtrlWasDown;

	@Inject(method = "createTitle", at = @At("RETURN"), cancellable = true)
	private void luminos$title(CallbackInfoReturnable<String> cir) {
		cir.setReturnValue("Luminos Client " + LuminosClient.VERSION + " \u2014 " + WindowBrand.mcVersion());
	}

	@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
	private Screen luminos$interceptTitleScreen(Screen screen) {
		if (screen instanceof TitleScreen && LuminosMainMenuScreen.wanted()) return new LuminosMainMenuScreen();
		return screen;
	}

	@Inject(method = "runTick", at = @At("HEAD"))
	private void luminos$pollRightCtrl(boolean advance, CallbackInfo ci) {
		Minecraft mc = (Minecraft) (Object) this;
		if (mc.getWindow() == null) return;
		long handle = mc.getWindow().handle();
		boolean ctrl = GLFW.glfwGetKey(handle, GLFW.GLFW_KEY_RIGHT_CONTROL) == GLFW.GLFW_PRESS;
		boolean shift = GLFW.glfwGetKey(handle, GLFW.GLFW_KEY_RIGHT_SHIFT) == GLFW.GLFW_PRESS;
		boolean down = ctrl || shift;
		if (down && !luminos$rCtrlWasDown) QuickPanelToggle.press(ctrl ? GLFW.GLFW_KEY_RIGHT_CONTROL : GLFW.GLFW_KEY_RIGHT_SHIFT);
		luminos$rCtrlWasDown = down;
	}
}
