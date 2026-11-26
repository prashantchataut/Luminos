package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Per-tick particle budget that shrinks when the frame rate drops (an explosion in a crowd no longer turns into a slideshow).
 * Vanilla 1.21.11 already frustum-culls particles when it extracts them for rendering, so this only limits how many are created.
 */
@Mixin(ParticleEngine.class)
public abstract class ParticleManagerMixin {
	@Inject(method = "add", at = @At("HEAD"), cancellable = true)
	private void luminos$budget(Particle particle, CallbackInfo ci) {
		if (Engine.dropParticle()) ci.cancel();
	}
}
