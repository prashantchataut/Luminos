package dev.luminos.client.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import dev.luminos.client.Config;
import dev.luminos.client.Engine;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.ScreenEffectRenderer;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Low fire: the on-screen fire quad is translated down (configurable) so it stops covering the crosshair while you are burning. */
@Mixin(ScreenEffectRenderer.class)
public abstract class InGameOverlayRendererMixin {
	@Inject(method = "renderFire", at = @At("HEAD"))
	private static void luminos$fireHead(PoseStack pose, MultiBufferSource buffers, TextureAtlasSprite sprite, CallbackInfo ci) {
		Engine.firePushed = false;
		if (!Config.flag("low_fire.on", false)) return;
		pose.pushPose();
		pose.translate(0f, -Config.num("low_fire.drop", 35f) / 100f, 0f);
		Engine.firePushed = true;
	}

	@Inject(method = "renderFire", at = @At("RETURN"))
	private static void luminos$fireTail(PoseStack pose, MultiBufferSource buffers, TextureAtlasSprite sprite, CallbackInfo ci) {
		if (Engine.firePushed) { pose.popPose(); Engine.firePushed = false; }
	}
}
