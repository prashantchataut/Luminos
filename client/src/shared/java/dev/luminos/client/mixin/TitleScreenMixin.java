package dev.luminos.client.mixin;

import dev.luminos.client.LuminosClient;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Replaces Minecraft's startup/title screen with the Luminos one the moment the vanilla screen starts to initialise
 * (first launch, after leaving a world, after a disconnect). The swap runs on the next client task, before the next frame is drawn,
 * so the vanilla menu is never shown. Off when the player chose "Use vanilla title screen" or LUMINOS_VANILLA_TITLE is set.
 */
@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin {
	@Inject(method = "init", at = @At("HEAD"), cancellable = true)
	private void luminos$useLuminosTitle(CallbackInfo ci) {
		if (!LuminosClient.wantCustomTitle()) return;
		Minecraft mc = Minecraft.getInstance();
		ci.cancel();
		mc.execute(LuminosClient::replaceTitleScreen);
	}
}
