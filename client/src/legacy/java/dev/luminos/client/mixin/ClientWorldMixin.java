package dev.luminos.client.mixin;

import dev.luminos.client.Engine;
import net.minecraft.client.multiplayer.ClientLevel;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Client-side time lock. Server time packets are rewritten to the locked time on arrival, and after every client tick the time is
 * pinned again (no day-time advance), so the sky holds still even between packets. Only this client's view changes.
 */
@Mixin(ClientLevel.class)
public abstract class ClientWorldMixin {
	@ModifyVariable(method = "setTimeFromServer", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private long luminos$dayTime(long dayTime) { return Engine.timeLocked() ? Engine.lockedTime() : dayTime; }

	@Inject(method = "tickTime", at = @At("TAIL"))
	private void luminos$pin(CallbackInfo ci) {
		if (!Engine.timeLocked()) return;
		ClientLevel self = (ClientLevel) (Object) this;
		self.setTimeFromServer(self.getGameTime(), Engine.lockedTime(), false);
	}
}
