package dev.luminos.client.mixin;

import com.mojang.blaze3d.platform.FramerateLimitTracker;
import dev.luminos.client.Config;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Unfocused GPU saver. Vanilla only throttles a minimised window; this also caps an alt-tabbed (visible but unfocused) window to 15 FPS
 * and hands the normal limit back the same frame focus returns, because the cap is recomputed from the live focus state on every call.
 */
@Mixin(FramerateLimitTracker.class)
public abstract class FramerateLimitTrackerMixin {
	@Shadow @Final private Minecraft minecraft;

	@Inject(method = "getFramerateLimit", at = @At("RETURN"), cancellable = true)
	private void luminos$unfocused(CallbackInfoReturnable<Integer> cir) {
		if (!minecraft.isWindowActive() && Config.flag("unfocused_fps.on", true)) {
			int cap = Math.max(5, (int) Config.num("unfocused_fps.cap", 15f));
			if (cir.getReturnValueI() > cap) cir.setReturnValue(cap);
		}
	}
}
