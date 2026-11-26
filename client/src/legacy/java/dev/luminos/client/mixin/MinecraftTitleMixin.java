package dev.luminos.client.mixin;

import dev.luminos.client.WindowBrand;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Minecraft builds its window title in {@code createTitle()} (Yarn: {@code getWindowTitle()}) and re-applies it when a world opens
 * or closes. Returning "Luminos Client &lt;version&gt;" from it means the window is never titled "Minecraft* ..." or, on Windows, left
 * to show the JVM's "OpenJDK Platform binary" text. The icon is set natively in {@link WindowBrand}.
 */
@Mixin(Minecraft.class)
public abstract class MinecraftTitleMixin {
	@Inject(method = "createTitle", at = @At("RETURN"), cancellable = true)
	private void luminos$title(CallbackInfoReturnable<String> cir) {
		cir.setReturnValue("Luminos Client " + WindowBrand.mcVersion());
	}
}
