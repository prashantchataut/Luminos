package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Client-side weather lock. {@code Level} is shared with the integrated server, so only {@link ClientLevel} instances are touched. */
@Mixin(Level.class)
public abstract class LevelWeatherMixin {
	@Inject(method = "getRainLevel", at = @At("HEAD"), cancellable = true)
	private void luminos$rain(float partialTick, CallbackInfoReturnable<Float> cir) {
		if (Engine.weatherLocked() && (Object) this instanceof ClientLevel) cir.setReturnValue(Engine.lockedRain());
	}

	@Inject(method = "getThunderLevel", at = @At("HEAD"), cancellable = true)
	private void luminos$thunder(float partialTick, CallbackInfoReturnable<Float> cir) {
		if (Engine.weatherLocked() && (Object) this instanceof ClientLevel) cir.setReturnValue(Engine.lockedThunder());
	}
}
