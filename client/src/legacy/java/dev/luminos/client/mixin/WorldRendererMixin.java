package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.Camera;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.client.renderer.culling.Frustum;
import net.minecraft.client.renderer.state.LevelRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Once per frame, before entities are collected: caches the camera position, the frame-time-scaled cull radii and the camera's sky exposure. */
@Mixin(LevelRenderer.class)
public abstract class WorldRendererMixin {
	@Inject(method = "extractVisibleEntities", at = @At("HEAD"))
	private void luminos$beginFrame(Camera camera, Frustum frustum, DeltaTracker delta, LevelRenderState state, CallbackInfo ci) {
		Engine.beginFrame(camera);
	}
}
