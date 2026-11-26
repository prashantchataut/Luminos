package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.renderer.fog.FogRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/**
 * Clear fog per dimension. In 1.21.11 every fog source ends up in {@code updateBuffer(buffer, offset, colour, envStart, envEnd,
 * renderStart, renderEnd, skyEnd, cloudEnd)}, so pushing those planes out here removes Overworld, Nether and End fog in one place and
 * leaves water, lava and powder-snow fog alone (the engine checks the camera fluid). Float ordinals 0..5 are the six planes in that order.
 */
@Mixin(FogRenderer.class)
public abstract class BackgroundRendererMixin {
	@ModifyVariable(method = "updateBuffer", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float luminos$envStart(float v) { return Engine.fogStart(v); }

	@ModifyVariable(method = "updateBuffer", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private float luminos$envEnd(float v) { return Engine.fogEnd(v); }

	@ModifyVariable(method = "updateBuffer", at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private float luminos$renderStart(float v) { return Engine.fogStart(v); }

	@ModifyVariable(method = "updateBuffer", at = @At("HEAD"), argsOnly = true, ordinal = 3)
	private float luminos$renderEnd(float v) { return Engine.fogEnd(v); }

	@ModifyVariable(method = "updateBuffer", at = @At("HEAD"), argsOnly = true, ordinal = 4)
	private float luminos$skyEnd(float v) { return Engine.fogEnd(v); }

	@ModifyVariable(method = "updateBuffer", at = @At("HEAD"), argsOnly = true, ordinal = 5)
	private float luminos$cloudEnd(float v) { return Engine.fogEnd(v); }
}
