package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.world.level.dimension.DimensionType;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/**
 * Native fullbright: the lightmap is built from the dimension's ambient light, so reporting full ambient light while Fullbright is on
 * lifts every light level in the lightmap itself (no gamma slider writes, no night-vision potion, so no flicker when a real effect ends).
 */
@Mixin(LightTexture.class)
public abstract class LightmapTextureManagerMixin {
	@Redirect(method = "updateLightTexture", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/dimension/DimensionType;ambientLight()F"))
	private float luminos$ambient(DimensionType type) {
		return Engine.fullbrightNow() ? 1.0f : type.ambientLight();
	}
}
