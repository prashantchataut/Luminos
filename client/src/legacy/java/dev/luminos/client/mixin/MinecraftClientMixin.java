package dev.luminos.client.mixin;

import dev.luminos.client.WindowBrand;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Native window identity. Minecraft builds its window title in {@code createTitle()} (Yarn: {@code getWindowTitle()}) and re-applies it
 * when a world opens or closes, so returning "Luminos Client 4.0 - &lt;version&gt;" from it means the window is never titled "Minecraft* ..."
 * and, on Windows, never left to show the JVM's "OpenJDK Platform binary" text. The icon is set natively in {@link WindowBrand}
 * through {@code GLFW.glfwSetWindowIcon}.
 */
@Mixin(Minecraft.class)
public abstract class MinecraftClientMixin {
	@Inject(method = "createTitle", at = @At("RETURN"), cancellable = true)
	private void luminos$title(CallbackInfoReturnable<String> cir) {
		cir.setReturnValue("Luminos Client 4.0 \u2014 " + WindowBrand.mcVersion());
	}
}
