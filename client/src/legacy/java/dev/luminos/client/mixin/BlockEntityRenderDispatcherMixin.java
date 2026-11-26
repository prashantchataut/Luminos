package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderDispatcher;
import net.minecraft.client.renderer.blockentity.state.BlockEntityRenderState;
import net.minecraft.client.renderer.feature.ModelFeatureRenderer;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Chests, signs, skulls, banners and beds beyond the block-entity radius never get a render state. Vanilla already treats null as "nothing to draw". */
@Mixin(BlockEntityRenderDispatcher.class)
public abstract class BlockEntityRenderDispatcherMixin {
	@Inject(method = "tryExtractRenderState", at = @At("HEAD"), cancellable = true)
	private void luminos$cull(BlockEntity blockEntity, float partialTick, ModelFeatureRenderer.CrumblingOverlay crumbling, CallbackInfoReturnable<BlockEntityRenderState> cir) {
		if (Engine.cullBlockEntity(blockEntity.getBlockPos())) cir.setReturnValue(null);
	}
}
