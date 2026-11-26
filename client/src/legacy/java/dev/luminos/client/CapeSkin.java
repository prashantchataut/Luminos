package dev.luminos.client;

import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;

/**
 * The HD cape (512x256, the vanilla 64x32 layout at 8x) the player picked. The PNGs ship inside this jar under
 * assets/luminos_client/textures/capes, so Minecraft's own texture manager loads them: no manual GPU upload and no native-image leaks.
 * The id comes from {@code config/luminos-client.json} ("cosmeticCape"), which the in-game Cosmetics screen writes and the launcher syncs.
 */
public final class CapeSkin {
	private CapeSkin() {}

	private static String lastId = "";
	private static ClientAsset.Texture cached;

	public static void invalidate() { lastId = "\0"; }

	/** The cape texture to show on the local player, or null for "keep whatever the account has". */
	public static ClientAsset.Texture texture() {
		String id = Config.get().cosmeticCape;
		if (id == null) id = "";
		if (!id.equals(lastId)) {
			lastId = id;
			boolean known = false;
			for (String[] c : LuminosCosmeticsScreen.CAPES) if (c[0].equals(id)) known = true;
			cached = known ? new ClientAsset.ResourceTexture(Identifier.fromNamespaceAndPath("luminos_client", "capes/" + id)) : null;
		}
		return cached;
	}
}
