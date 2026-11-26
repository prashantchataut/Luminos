package dev.luminos.client.mixin;

import dev.luminos.client.LuminosClient;
import dev.luminos.client.TitleMenu;
import dev.luminos.client.TitleScene;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Cleans up Minecraft's own TitleScreen in place. It does NOT replace the screen, it does NOT cancel {@code render()} and it does NOT
 * draw fake rectangles: after vanilla has finished {@code init()}, the cluttered vanilla buttons are removed and five real
 * {@code Button} widgets are registered with {@code addRenderableWidget} (Mojang's name for Yarn's {@code addDrawableChild}).
 * {@code render()} and {@code mouseClicked()} stay vanilla's, so every button draws, hovers, clicks, tabs and plays its sound natively
 * at any GUI scale. Off when the player chose "Use vanilla title screen" or LUMINOS_VANILLA_TITLE is set.
 */
@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin extends Screen {
	protected TitleScreenMixin(Component title) { super(title); }

	@Inject(method = "init", at = @At("TAIL"))
	private void luminos$buttons(CallbackInfo ci) {
		if (!LuminosClient.wantCustomTitle()) return;
		this.clearWidgets();   // vanilla's Realms / Accessibility / Language / copyright widgets
		for (TitleScene.Btn spec : TitleMenu.layout(this.width, this.height)) {
			this.addRenderableWidget(TitleMenu.widget(spec, this));
		}
	}
}
