package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;

/**
 * The Luminos startup screen. It is not a layer on vanilla's TitleScreen: {@code MinecraftClientMixin} swaps every TitleScreen for this
 * class in {@code setScreen}, and {@code TitleScreenGuardMixin} redirects {@code TitleScreen.init} here as a safety net.
 *
 * <p>No widgets are registered. {@link MainMenuView} paints every control and registers its hit rectangle in the same call, so a click
 * can only land on what was drawn. Vanilla's background (panorama / blur) is suppressed with a no-op {@link #renderBackground}.
 */
public final class LuminosMainMenuScreen extends Screen {
	private final MainMenuView view = new MainMenuView(this::run);
	private long lastFrame = System.nanoTime();
	private float fps = 60f;

	public LuminosMainMenuScreen() {
		super(Component.literal("Luminos"));
		view.setClickSound(() -> Minecraft.getInstance().getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1f)));
	}

	/** True when the Luminos menu should replace vanilla's: the player has not chosen vanilla, and this is not the CI smoke run. */
	public static boolean wanted() {
		return LuminosClient.wantCustomTitle() && System.getenv("LUMINOS_SMOKE") == null;
	}

	private void run(String id) {
		Minecraft mc = Minecraft.getInstance();
		switch (id) {
			case MainMenuView.SINGLE -> mc.setScreen(new SelectWorldScreen(this));
			case MainMenuView.MULTI -> mc.setScreen(new JoinMultiplayerScreen(this));
			case MainMenuView.PANEL -> mc.setScreen(new LuminosQuickPanelScreen(Panel.Tab.MODULES, false, this));
			case MainMenuView.HUD -> mc.setScreen(new HudEditorScreen(this));
			case MainMenuView.CAPES -> mc.setScreen(new LuminosCosmeticsScreen(this));
			case MainMenuView.OPTIONS -> mc.setScreen(new OptionsScreen(this, mc.options));
			case MainMenuView.QUIT -> mc.stop();
			default -> { }
		}
	}

	/** Vanilla 1.21 draws a blurred panorama here; our scene is painted in {@link #render}, so this must do nothing. */
	@Override
	public void renderBackground(GuiGraphics g, int mx, int my, float pt) {}

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) {
		long now = System.nanoTime();
		fps += ((1e9f / Math.max(1, now - lastFrame)) - fps) * 0.05f;
		lastFrame = now;
		String who = minecraft.getUser() == null ? "" : minecraft.getUser().getName();
		boolean sodium = FabricLoader.getInstance().isModLoaded("sodium");
		String engine = sodium ? "Sodium + Native Engine Active" : "Native Engine Active";   // only claims Sodium when it is really loaded
		view.render(new Adapter(g), mx, my, System.currentTimeMillis(), who, Math.round(fps), WindowBrand.mcVersion(), engine);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean dbl) {
		return view.click(e.x(), e.y(), e.button()) || super.mouseClicked(e, dbl);
	}

	@Override
	public boolean keyPressed(KeyEvent e) {
		if (Hotkeys.opensPanel(e.key())) { QuickPanelToggle.press(e.key()); return true; }   // normally handled earlier by KeyboardMixin
		if (view.key(e.key())) return true;   // Up/Down/Tab/Enter/H
		if (e.key() == InputConstants.KEY_ESCAPE) return true;   // nothing to go back to
		return super.keyPressed(e);
	}

	@Override
	public boolean shouldCloseOnEsc() { return false; }

	@Override
	public boolean isPauseScreen() { return false; }
}
