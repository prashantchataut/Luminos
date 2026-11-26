package dev.luminos.client.mixin;

import dev.luminos.client.CapeSkin;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.core.ClientAsset;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Swaps the local player's cape for the Luminos HD cape chosen in the launcher or the in-game Cosmetics screen. */
@Mixin(AbstractClientPlayer.class)
public abstract class PlayerSkinMixin {
	@Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
	private void luminos$cape(CallbackInfoReturnable<PlayerSkin> cir) {
		if ((Object) this != Minecraft.getInstance().player) return;
		ClientAsset.Texture cape = CapeSkin.texture();
		if (cape == null) return;
		PlayerSkin s = cir.getReturnValue();
		cir.setReturnValue(new PlayerSkin(s.body(), cape, s.elytra(), s.model(), s.secure()));
	}
}
