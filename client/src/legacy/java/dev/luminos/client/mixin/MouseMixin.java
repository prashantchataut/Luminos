package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.MouseHandler;
import net.minecraft.client.player.LocalPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Look input is applied per rendered frame by vanilla's {@code turnPlayer}; the redirect sends it to the freelook camera while the key is
 * held, and scales it by 1/zoom while zoomed so 12x aiming is still controllable. The scroll wheel changes the zoom level while C is held.
 */
@Mixin(MouseHandler.class)
public abstract class MouseMixin {
	@Redirect(method = "turnPlayer", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/player/LocalPlayer;turn(DD)V"))
	private void luminos$turn(LocalPlayer player, double dx, double dy) {
		if (Engine.consumeTurn(dx, dy)) return;
		float s = Engine.sensitivityScale();
		player.turn(dx * s, dy * s);
	}

	@Inject(method = "onScroll", at = @At("HEAD"), cancellable = true)
	private void luminos$zoomScroll(long window, double xOffset, double yOffset, CallbackInfo ci) {
		if (yOffset != 0 && Engine.zoomHeld()) {
			Engine.zoomScroll(yOffset);
			ci.cancel();
		}
	}
}
