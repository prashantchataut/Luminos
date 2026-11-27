package dev.luminos.client;

/**
 * Pure decision for Right Ctrl / Right Shift: no Minecraft types, so the same rule the raw key hook, the per-frame poll and the screens
 * share can be unit-tested. {@link QuickPanelToggle} maps the live screen to a {@link Where} and obeys the answer.
 */
public final class PanelRouting {
	private PanelRouting() {}

	public enum Where { WORLD, PANEL, MAIN_MENU, TITLE, PAUSE, OTHER }
	public enum Action { OPEN, CLOSE, IGNORE }

	/** @param inWorld a player and a level exist (the bare in-game view is only meaningful then) */
	public static Action route(Where where, boolean inWorld) {
		return switch (where) {
			case PANEL -> Action.CLOSE;
			case WORLD -> inWorld ? Action.OPEN : Action.IGNORE;
			case MAIN_MENU, TITLE, PAUSE -> Action.OPEN;
			case OTHER -> Action.IGNORE;   // chat, inventories, options: never hijacked
		};
	}
}
