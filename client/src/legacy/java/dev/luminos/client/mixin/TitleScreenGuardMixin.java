package dev.luminos.client.mixin;

import dev.luminos.client.LuminosMainMenuScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Safety net behind {@code MinecraftClientMixin.setScreen}. Vanilla's own {@code setScreen(null)} builds a TitleScreen internally
 * (after our interception ran), so if one ever reaches {@code init()} it is redirected here to the Luminos menu instead. Cancelling at
 * HEAD also stops the in-place cleanup mixin from touching a screen that is never shown.
 */
@Mixin(TitleScreen.class)
public abstract class TitleScreenGuardMixin {
	@Inject(method = "init", at = @At("HEAD"), cancellable = true)
	private void luminos$redirect(CallbackInfo ci) {
		if (!LuminosMainMenuScreen.wanted()) return;
		Minecraft.getInstance().setScreen(new LuminosMainMenuScreen());
		ci.cancel();
	}
}
