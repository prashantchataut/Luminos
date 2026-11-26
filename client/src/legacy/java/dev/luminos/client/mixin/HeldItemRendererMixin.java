package dev.luminos.client.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import dev.luminos.client.Config;
import dev.luminos.client.Engine;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.ItemInHandRenderer;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.tags.ItemTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * First-person item transform, wrapped in its own push/pop so it can never leak into the next hand or the rest of the frame.
 * Viewmodel X/Y/Z/scale, a classic 1.7-style sword block pose while the use key is held, and a lowered off-hand shield.
 * The block pose is a hand-tuned approximation of the 1.7 look, not a pixel match.
 */
@Mixin(ItemInHandRenderer.class)
public abstract class HeldItemRendererMixin {
	@Inject(method = "renderArmWithItem", at = @At("HEAD"))
	private void luminos$pre(AbstractClientPlayer player, float partialTick, float pitch, InteractionHand hand, float swing, ItemStack stack,
			float equip, PoseStack pose, SubmitNodeCollector collector, int light, CallbackInfo ci) {
		Engine.handPushed = false;
		boolean vm = Engine.viewmodelOn(), a17 = Engine.anim17On(), lowShield = Config.flag("low_shield.on", false);
		if (!vm && !a17 && !lowShield) return;
		Minecraft mc = Minecraft.getInstance();
		pose.pushPose();
		Engine.handPushed = true;
		boolean main = hand == InteractionHand.MAIN_HAND;
		float side = (main == (mc.options.mainHand().get() == HumanoidArm.RIGHT)) ? 1f : -1f;
		if (vm) {
			pose.translate(Config.num("viewmodel.x", 0f), Config.num("viewmodel.y", 0f), Config.num("viewmodel.z", 0f));
			float s = Config.num("viewmodel.scale", 1f);
			pose.scale(s, s, s);
		}
		if (a17 && main && mc.options.keyUse.isDown() && stack.is(ItemTags.SWORDS)) {
			pose.translate(side * -0.10f, 0.02f, -0.02f);
			pose.mulPose(Axis.YP.rotationDegrees(side * 20f));
			pose.mulPose(Axis.ZP.rotationDegrees(side * -12f));
			pose.mulPose(Axis.XP.rotationDegrees(-8f));
		}
		if (lowShield && !main && stack.is(Items.SHIELD)) pose.translate(0f, -Config.num("low_shield.drop", 18f) / 100f, 0f);
	}

	@Inject(method = "renderArmWithItem", at = @At("RETURN"))
	private void luminos$post(AbstractClientPlayer player, float partialTick, float pitch, InteractionHand hand, float swing, ItemStack stack,
			float equip, PoseStack pose, SubmitNodeCollector collector, int light, CallbackInfo ci) {
		if (Engine.handPushed) { pose.popPose(); Engine.handPushed = false; }
	}
}
