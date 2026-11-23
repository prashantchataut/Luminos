package app.luminos.mobile.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

// Kotlin port of site/src/lib/skyCore.ts: 8x8 Bayer ordered dither into the same 9-step blue palette.
private val PAL = intArrayOf(
    0xFF01020A.toInt(), 0xFF050A1F.toInt(), 0xFF08124A.toInt(), 0xFF0C2370.toInt(), 0xFF1A45BD.toInt(),
    0xFF3F74E6.toInt(), 0xFF8FB6F5.toInt(), 0xFFD3E4FC.toInt(), 0xFFFFFFFF.toInt(),
)
private val BAYER = FloatArray(64).also { m ->
    for (y in 0 until 8) for (x in 0 until 8) {
        var v = 0; var xx = x; var yy = y
        for (b in 0 until 3) { v = (v shl 2) or (((xx xor yy) and 1) shl 1) or (yy and 1); xx = xx shr 1; yy = yy shr 1 }
        m[y * 8 + x] = (v + 0.5f) / 64f
    }
}

private fun hash(ix: Int, iy: Int): Float {
    var n = (ix * 374761393) xor (iy * 668265263)
    n = (n xor (n ushr 13)) * 1274126177
    return ((n xor (n ushr 16)).toLong() and 0xFFFFFFFFL).toFloat() / 4294967296f
}
private fun vnoise(x: Float, y: Float): Float {
    val ix = kotlin.math.floor(x).toInt(); val iy = kotlin.math.floor(y).toInt()
    val fx = x - ix; val fy = y - iy
    val u = fx * fx * (3 - 2 * fx); val w = fy * fy * (3 - 2 * fy)
    val a = hash(ix, iy); val b = hash(ix + 1, iy); val c = hash(ix, iy + 1); val d = hash(ix + 1, iy + 1)
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w
}
private fun fbm(x: Float, y: Float): Float =
    vnoise(x, y) * 0.5f + vnoise(x * 2.03f + 11.1f, y * 2.03f + 5.7f) * 0.25f +
        vnoise(x * 4.1f + 3.3f, y * 4.1f + 17.9f) * 0.125f + vnoise(x * 8.3f + 9.9f, y * 8.3f + 1.3f) * 0.0625f
private fun sm(a: Float, b: Float, x: Float): Float { val t = ((x - a) / (b - a)).coerceIn(0f, 1f); return t * t * (3 - 2 * t) }
private fun level(v: Float, x: Int, y: Int): Int {
    val f = v.coerceIn(0f, 1f) * 8f
    var lo = f.toInt()
    if (lo >= 8) return 8
    if (f - lo > BAYER[(y and 7) * 8 + (x and 7)]) lo++
    return lo
}

private class Star(val x: Int, val y: Int, val phase: Float)
private class SkyLayers(val base: ImageBitmap, val clouds: ImageBitmap, val stars: List<Star>, val w: Int, val h: Int)

private fun buildSky(w: Int, h: Int, moon: Boolean): SkyLayers {
    val base = IntArray(w * h)
    val stars = ArrayList<Star>()
    val cx = w * 0.74f; val cy = h * 0.17f; val r = min(w, h) * 0.075f
    for (y in 0 until h) {
        val g = y / (h - 1f).coerceAtLeast(1f)
        for (x in 0 until w) {
            var v = 0.03f + 0.52f * g.pow(1.8f)
            if (moon) {
                val d = hypot(x - cx, y - cy)
                v += 0.34f * exp(-((d / (r * 3.2f)) * (d / (r * 3.2f))))
                if (d < r) v = 0.93f + 0.07f * (1 - d / r) - 0.13f * vnoise(x * 0.45f, y * 0.45f)
            }
            if (y < h * 0.58f && hash(x * 7 + 13, y * 13 + 5) > 0.9955f && hypot(x - cx, y - cy) > r * 1.2f) {
                v = 1f; stars += Star(x, y, hash(x, y) * 6.28f)
            }
            base[y * w + x] = PAL[level(v, x, y)]
        }
    }
    // One screen-wide cloud tile that wraps seamlessly: v(x) = g(x)(1-x/W) + g(x-W)(x/W).
    val cl = IntArray(w * h)
    for (y in 0 until h) {
        val g = y / (h - 1f).coerceAtLeast(1f)
        val band = sm(0.32f, 0.55f, g) * (1f - sm(0.88f, 1f, g))
        for (x in 0 until w) {
            val t = x / w.toFloat()
            val a = fbm(x * 0.035f, y * 0.085f); val b = fbm((x - w) * 0.035f, y * 0.085f)
            val n = a * (1 - t) + b * t
            val cv = sm(0.47f, 0.70f, n) * band
            cl[y * w + x] = if (cv > BAYER[(y and 7) * 8 + (x and 7)] * 0.9f) PAL[level(0.30f + 0.50f * cv + 0.1f * vnoise(x * 0.2f, y * 0.2f), x, y)] else 0
        }
    }
    fun bmp(a: IntArray): ImageBitmap = Bitmap.createBitmap(a, w, h, Bitmap.Config.ARGB_8888).asImageBitmap()
    return SkyLayers(bmp(base), bmp(cl), stars, w, h)
}

/**
 * The animated dithered night sky. Built once off the main thread; animation is a slide of a precomputed cloud
 * layer plus star twinkle, drawn in the draw phase only (no recomposition per frame). It stops while the app is
 * in the background and is a still frame when reduced motion is on (MOTION rule 4).
 */
@Composable
fun DitherSky(modifier: Modifier = Modifier.fillMaxSize(), animate: Boolean = true, moon: Boolean = true, cellDp: Float = 3.2f) {
    var px by remember { mutableStateOf(IntSize.Zero) }
    var layers by remember { mutableStateOf<SkyLayers?>(null) }
    val time = remember { mutableFloatStateOf(0f) }
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(px) {
        if (px.width == 0) return@LaunchedEffect
        val cell = (cellDp * density).coerceAtLeast(2f)
        val w = (px.width / cell).roundToInt().coerceIn(40, 360)
        val h = (px.height / cell).roundToInt().coerceIn(60, 800)
        layers = withContext(Dispatchers.Default) { buildSky(w, h, moon) }
    }
    LaunchedEffect(animate) {
        if (!animate) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            var last = 0L
            while (true) {
                androidx.compose.runtime.withFrameNanos { n ->
                    if (last != 0L && n - last >= 33_000_000L) { time.floatValue += (n - last) / 1e9f; last = n }
                    else if (last == 0L) last = n
                }
            }
        }
    }
    Canvas(modifier.onSizeChanged { px = it }) {
        val l = layers ?: run { drawRect(Lx.Bg1); return@Canvas }
        val cell = size.width / l.w
        val full = IntSize(size.width.roundToInt() + 1, size.height.roundToInt() + 1)
        drawImage(l.base, dstSize = full, filterQuality = FilterQuality.None)
        val off = (time.floatValue * 1.4f) % l.w
        for (k in 0..1) {
            drawImage(
                l.clouds, dstOffset = IntOffset(((k * l.w - off) * cell).roundToInt(), 0),
                dstSize = IntSize((l.w * cell).roundToInt() + 1, full.height), filterQuality = FilterQuality.None,
            )
        }
        val t = time.floatValue
        for (s in l.stars) {
            val a = 0.35f + 0.65f * (0.5f + 0.5f * sin(t * 1.7f + s.phase))
            drawRect(Color.White.copy(alpha = a * 0.55f), Offset(s.x * cell, s.y * cell), Size(cell, cell))
        }
    }
}
