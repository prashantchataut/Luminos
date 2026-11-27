package dev.luminos.client;

/**
 * 65,536-entry sine table (one entry per 2*PI/65536 radians, cos is a quarter-turn shift). Built once at class load, read-only afterwards:
 * no allocation, no branches beyond a mask. Accuracy is about 1e-4, which is far below one pixel for any screen-space use.
 * Used by the menu animation and by HUD/waypoint projection helpers that previously called {@code Math.sin} per element per frame.
 */
public final class FastMathLUT {
	private FastMathLUT() {}

	public static final int SIZE = 65536, MASK = SIZE - 1;
	private static final float[] SIN = new float[SIZE];
	private static final float TO_INDEX = SIZE / (float) (Math.PI * 2);
	static {
		for (int i = 0; i < SIZE; i++) SIN[i] = (float) Math.sin(i * Math.PI * 2 / SIZE);
	}

	public static float sin(float radians) { return SIN[(int) (radians * TO_INDEX) & MASK]; }
	public static float cos(float radians) { return SIN[((int) (radians * TO_INDEX) + SIZE / 4) & MASK]; }
}
