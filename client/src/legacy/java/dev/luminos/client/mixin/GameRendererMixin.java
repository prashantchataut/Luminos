package dev.luminos.client.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import dev.luminos.client.Config;
import dev.luminos.client.Engine;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Smooth exponential zoom on the world FOV (the hand keeps its own FOV), and the optional "no damage camera tilt" switch. */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
	@Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
	private void luminos$zoom(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Float> cir) {
		if (useFovSetting) cir.setReturnValue(Engine.zoomFov(cir.getReturnValueF()));
	}

	@Inject(method = "bobHurt", at = @At("HEAD"), cancellable = true)
	private void luminos$hurtCam(PoseStack poseStack, float partialTick, CallbackInfo ci) {
		if (Config.flag("hurtcam_off.on", false)) ci.cancel();
	}
}
