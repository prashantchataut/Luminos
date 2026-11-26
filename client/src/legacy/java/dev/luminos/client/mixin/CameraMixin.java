package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/**
 * 360 degree freelook. While the freelook key is held the camera is forced into its detached (third-person) path and gets its own
 * yaw/pitch, while the player's real rotation (what the server sees) is untouched; the MouseMixin routes mouse movement here instead.
 * On release the flag drops and the very next frame is back to the normal view.
 */
@Mixin(Camera.class)
public abstract class CameraMixin {
	@ModifyVariable(method = "setup", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private boolean luminos$detach(boolean detached) { return detached || Engine.freelook(); }

	@ModifyVariable(method = "setRotation", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float luminos$yaw(float yaw) { return Engine.freelook() ? Engine.freelookYaw() : yaw; }

	@ModifyVariable(method = "setRotation", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private float luminos$pitch(float pitch) { return Engine.freelook() ? Engine.freelookPitch() : pitch; }
}
