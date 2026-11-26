package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Camera;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.boss.enderdragon.EnderDragon;
import net.minecraft.world.entity.boss.wither.WitherBoss;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

/**
 * The Luminos native engine (Minecraft 1.21.x line). Every Mixin in {@code dev.luminos.client.mixin} is a thin hook that calls into
 * this class, so the logic lives in one place, is cached once per frame instead of once per entity, and allocates nothing in the hot
 * paths (no boxing, no new Vec3/BlockPos per call: the scratch objects below are reused).
 *
 * <p>Every switch is a {@link Config} flag/number, so the quick panel and the launcher's config sync drive it the same way as any module.
 * Defaults are conservative: culling distances are far beyond normal combat range, and nothing here changes what a server can see.
 */
public final class Engine {
	private Engine() {}

	public static KeyMapping freelookKey;
	/** Push/pop pairing flags for the viewmodel and fire-overlay Mixins (render thread only). */
	public static boolean handPushed, firePushed;

	// ------------------------------------------------------------------ telemetry (read by the HUD / benchmarks)
	public static int culledEntitiesLastFrame, culledBlockEntitiesLastFrame, droppedParticlesLastTick;
	private static int culledEntities, culledBlockEntities, droppedParticles, particlesThisTick;

	// ------------------------------------------------------------------ per-frame cached cull state
	private static boolean cullOn, camSky;
	private static double camX, camY, camZ, entityMax2, blockEntityMax2;
	private static long frameNo, lastFrameNanos;
	private static float frameMsAvg = 8f;
	private static final BlockPos.MutableBlockPos POS = new BlockPos.MutableBlockPos();
	private static final int SLOTS = 4096;
	private static final int[] cacheId = new int[SLOTS];
	private static final long[] cacheFrame = new long[SLOTS];
	private static final boolean[] cacheCulled = new boolean[SLOTS];

	// ------------------------------------------------------------------ freelook + zoom state
	private static boolean freelookActive;
	private static float freelookYaw, freelookPitch;
	private static float zoomCurrent = 1f;
	private static long zoomNanos;

	public static void init(KeyMapping.Category cat) {
		freelookKey = Nav.register(new KeyMapping("key.luminos.freelook", InputConstants.KEY_LALT, cat));
		ClientTickEvents.END_CLIENT_TICK.register(Engine::tick);
		if (System.getenv("LUMINOS_SMOKE") != null) mixinAudit();
		LuminosClient.LOGGER.info("[luminos] native engine ready: entity/block-entity culling, particle budget, fog, lightmap, freelook, zoom, 1.7 viewmodel, time/weather lock");
	}

	/** CI only: forces every Mixin to be applied now, so a bad target fails the smoke job instead of a player's launch. */
	private static void mixinAudit() {
		try {
			org.spongepowered.asm.mixin.MixinEnvironment.getCurrentEnvironment().audit();
			LuminosClient.LOGGER.info("[luminos] mixin audit passed");
		} catch (Throwable t) {
			LuminosClient.LOGGER.error("[luminos] mixin audit FAILED", t);
			System.exit(86);
		}
	}

	private static void tick(Minecraft mc) {
		particlesThisTick = 0;
		droppedParticlesLastTick = droppedParticles;
		droppedParticles = 0;
		boolean want = freelookKey != null && freelookKey.isDown() && mc.player != null && mc.screen == null && Config.flag("freelook.on", true);
		if (want && !freelookActive) { freelookYaw = mc.player.getYRot(); freelookPitch = mc.player.getXRot(); }
		freelookActive = want;
	}

	// ================================================================== entity + block-entity culling
	/** Called once per frame from {@code LevelRenderer.extractVisibleEntities}: everything per-entity below reads these cached values. */
	public static void beginFrame(Camera cam) {
		Minecraft mc = Minecraft.getInstance();
		Vec3 p = cam.position();
		camX = p.x; camY = p.y; camZ = p.z;
		frameNo++;
		culledEntitiesLastFrame = culledEntities; culledBlockEntitiesLastFrame = culledBlockEntities;
		culledEntities = 0; culledBlockEntities = 0;
		long now = System.nanoTime();
		if (lastFrameNanos != 0) frameMsAvg += ((now - lastFrameNanos) / 1.0e6f - frameMsAvg) * 0.05f;
		lastFrameNanos = now;
		cullOn = Config.flag("entity_cull.on", true);
		// the cull radius shrinks when frames are slow (dynamic threshold): 100% under 16 ms, down to 55% at 40 ms and above
		float k = frameMsAvg <= 16f ? 1f : Math.max(0.55f, 1f - (frameMsAvg - 16f) / 24f * 0.45f);
		double e = Config.num("entity_cull.distance", 96f) * k;
		double b = Config.num("entity_cull.block_distance", 64f) * k;
		entityMax2 = e * e;
		blockEntityMax2 = b * b;
		ClientLevel lvl = mc.level;
		camSky = lvl != null && lvl.canSeeSky(POS.set(Math.floor(camX), Math.floor(camY), Math.floor(camZ)));
	}

	/** True when the entity cannot matter this frame. Never culls players, bosses, glowing entities or big mobs. */
	public static boolean cullEntity(Entity e, double cx, double cy, double cz) {
		if (!cullOn) return false;
		if (e instanceof Player || e instanceof EnderDragon || e instanceof WitherBoss || e.isCurrentlyGlowing() || e.getBbWidth() > 4f) return false;
		int slot = e.getId() & (SLOTS - 1);
		if (cacheId[slot] == e.getId() && frameNo - cacheFrame[slot] < 12) {
			if (cacheCulled[slot]) culledEntities++;
			return cacheCulled[slot];
		}
		double dx = e.getX() - cx, dy = e.getY() - cy, dz = e.getZ() - cz;
		double d2 = dx * dx + dy * dy + dz * dz;
		boolean cull = d2 > entityMax2;
		if (!cull && d2 > 256.0 && camSky && -dy > 6.0) {
			// vertical occlusion: the camera sees the sky from well above, and this entity is roofed over (cave, basement, house)
			Level lvl = e.level();
			cull = !lvl.canSeeSky(POS.set(e.getBlockX(), e.getBlockY() + 1, e.getBlockZ()));
		}
		cacheId[slot] = e.getId(); cacheFrame[slot] = frameNo; cacheCulled[slot] = cull;
		if (cull) culledEntities++;
		return cull;
	}

	public static boolean cullBlockEntity(BlockPos pos) {
		if (!cullOn) return false;
		double dx = pos.getX() + 0.5 - camX, dy = pos.getY() + 0.5 - camY, dz = pos.getZ() + 0.5 - camZ;
		boolean cull = dx * dx + dy * dy + dz * dz > blockEntityMax2;
		if (cull) culledBlockEntities++;
		return cull;
	}

	// ================================================================== particles
	/** Per-tick particle budget: shrinks while the frame rate is low. Returns true when this particle should be dropped. */
	public static boolean dropParticle() {
		if (!Config.flag("particle_budget.on", true)) return false;
		float k = frameMsAvg <= 16f ? 1f : Math.max(0.4f, 1f - (frameMsAvg - 16f) / 30f);
		int cap = (int) (Config.num("particle_budget.max", 600f) * k);
		if (++particlesThisTick > cap) { droppedParticles++; return true; }
		return false;
	}

	// ================================================================== fog (per dimension)
	/** True when fog should be pushed out. Water, lava and powder-snow fog are always left alone. */
	public static boolean clearFogNow() {
		Minecraft mc = Minecraft.getInstance();
		if (mc.level == null || !Config.flag("clear_fog.on", false)) return false;
		if (mc.gameRenderer.getMainCamera().getFluidInCamera() != net.minecraft.world.level.material.FogType.NONE) return false;
		var dim = mc.level.dimension();
		if (dim == Level.NETHER) return Config.flag("clear_fog.nether", true);
		if (dim == Level.END) return Config.flag("clear_fog.end", true);
		return Config.flag("clear_fog.overworld", true);
	}

	public static float fogStart(float v) { return clearFogNow() ? Math.max(v, 200_000f) : v; }
	public static float fogEnd(float v) { return clearFogNow() ? Math.max(v, 204_096f) : v; }

	// ================================================================== lightmap
	public static boolean fullbrightNow() {
		Minecraft mc = Minecraft.getInstance();
		return Config.flag("fullbright.on", true) && !Compliance.restricted(mc);
	}

	// ================================================================== freelook
	public static boolean freelook() { return freelookActive; }
	public static float freelookYaw() { return freelookYaw; }
	public static float freelookPitch() { return freelookPitch; }

	/** Mouse movement while Left Alt is held turns the camera, not the player. */
	public static boolean consumeTurn(double dx, double dy) {
		if (!freelookActive) return false;
		freelookYaw += (float) dx * 0.15f;
		freelookPitch = Math.max(-90f, Math.min(90f, freelookPitch + (float) dy * 0.15f));
		return true;
	}

	// ================================================================== zoom
	public static boolean zoomHeld() {
		Minecraft mc = Minecraft.getInstance();
		return LuminosClient.zoomKey != null && LuminosClient.zoomKey.isDown() && mc.screen == null && Config.flag("zoom.on", true) && !Compliance.restricted(mc);
	}

	public static void zoomScroll(double dy) {
		float f = Config.num("zoom.factor", 4f);
		f = Math.max(2f, Math.min(12f, f * (dy > 0 ? 1.15f : 1f / 1.15f)));
		Config.setNum("zoom.factor", Math.round(f * 10f) / 10f);
	}

	/** Exponential approach to the target zoom, frame-rate independent (about 90 ms to cover 63% of the way). */
	public static float zoomFov(float fovDeg) {
		long now = System.nanoTime();
		float dt = zoomNanos == 0 ? 0.016f : Math.min(0.1f, (now - zoomNanos) / 1.0e9f);
		zoomNanos = now;
		float target = zoomHeld() ? Config.num("zoom.factor", 4f) : 1f;
		zoomCurrent += (target - zoomCurrent) * (1f - (float) Math.exp(-11f * dt));
		if (Math.abs(zoomCurrent - target) < 0.002f) zoomCurrent = target;
		if (zoomCurrent <= 1.001f) return fovDeg;
		double half = Math.toRadians(fovDeg) * 0.5;
		return (float) Math.toDegrees(2.0 * Math.atan(Math.tan(half) / zoomCurrent));
	}

	/** Mouse sensitivity multiplier while zoomed, so aiming stays controllable at 12x. */
	public static float sensitivityScale() { return zoomCurrent > 1.01f ? 1f / zoomCurrent : 1f; }

	// ================================================================== client-side time and weather lock
	public static boolean timeLocked() { return Config.flag("time_lock.on", false); }
	public static long lockedTime() { return (long) Config.num("time_lock.time", 6000f); }
	public static boolean weatherLocked() { return Config.flag("weather_lock.on", false); }
	public static float lockedRain() { return Config.num("weather_lock.state", 0f) >= 1f ? 1f : 0f; }
	public static float lockedThunder() { return Config.num("weather_lock.state", 0f) >= 2f ? 1f : 0f; }

	// ================================================================== viewmodel
	public static boolean viewmodelOn() { return Config.flag("viewmodel.on", false); }
	public static boolean anim17On() { return Config.flag("anim17.on", false); }
}
