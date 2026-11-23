package app.luminos.mobile.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas as ComposeCanvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import app.luminos.mobile.core.SkinData
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin

/**
 * Software 3D player renderer: every body part is a textured box, drawn back-to-front. Orthographic projection makes
 * each face an exact parallelogram, so one affine matrix per face maps the skin pixels onto the screen with
 * nearest-neighbour sampling (crisp pixels). Includes the overlay layer, slim/classic arms and a swaying cape.
 */
class SkinPainter {
    private val paint = Paint().apply { isFilterBitmap = false; isAntiAlias = false; isDither = false }
    private val m = Matrix()
    private val srcPts = FloatArray(6)
    private val dstPts = FloatArray(6)
    private val srcRect = Rect()
    private val dstRect = RectF()

    private class F {
        var z = 0f; var tex: Bitmap? = null
        var sx = 0; var sy = 0; var sw = 0; var sh = 0
        val d = FloatArray(6)
    }
    private val pool = Array(110) { F() }
    private var n = 0

    // per-frame state
    private var cyaw = 1f; private var syaw = 0f; private var cp = 1f; private var sp = 0f
    private var scale = 1f; private var ox = 0f; private var oy = 0f

    private fun rot(x: Float, y: Float, z: Float, out: FloatArray) {
        val yc = y - 16f
        val x1 = x * cyaw + z * syaw
        val z1 = -x * syaw + z * cyaw
        val y2 = yc * cp - z1 * sp
        val z2 = yc * sp + z1 * cp
        out[0] = x1; out[1] = y2; out[2] = z2
    }

    private val a = FloatArray(3); private val u = FloatArray(3); private val v = FloatArray(3); private val c0 = FloatArray(3)

    /** Adds one face. (ax,ay,az) origin; U/V are the texture axes in model space. */
    private fun face(
        tex: Bitmap, sx: Int, sy: Int, sw: Int, sh: Int,
        ax: Float, ay: Float, az: Float, ux: Float, uy: Float, uz: Float, vx: Float, vy: Float, vz: Float, bias: Float,
    ) {
        rot(ax, ay, az, a)
        rot(ax + ux, ay + uy, az + uz, u)
        rot(ax + vx, ay + vy, az + vz, v)
        val u0 = u[0] - a[0]; val u1 = u[1] - a[1]
        val v0 = v[0] - a[0]; val v1 = v[1] - a[1]
        // outward normal = -(U x V); visible when it points at the viewer (+z)
        val nz = -(u0 * v1 - u1 * v0)
        if (nz <= 0f) return
        val f = pool[n++]
        rot(ax + (ux + vx) / 2, ay + (uy + vy) / 2, az + (uz + vz) / 2, c0)
        f.z = c0[2] + bias
        f.tex = tex; f.sx = sx; f.sy = sy; f.sw = sw; f.sh = sh
        f.d[0] = ox + a[0] * scale; f.d[1] = oy - a[1] * scale
        f.d[2] = ox + u[0] * scale; f.d[3] = oy - u[1] * scale
        f.d[4] = ox + v[0] * scale; f.d[5] = oy - v[1] * scale
    }

    // pre-rotation of a part about the X axis through (pivotY, pivotZ)
    private var preAng = 0f; private var pivY = 0f; private var pivZ = 0f

    private fun pre(y: Float, z: Float, out: FloatArray) {
        if (preAng == 0f) { out[0] = y; out[1] = z; return }
        val dy = y - pivY; val dz = z - pivZ
        val c = cos(preAng); val s = sin(preAng)
        out[0] = pivY + dy * c - dz * s
        out[1] = pivZ + dy * s + dz * c
    }

    private val p0 = FloatArray(2); private val p1 = FloatArray(2); private val p2 = FloatArray(2)

    /** Box with Minecraft's unfolded UV layout. [swapFB] swaps the front/back rectangles (used by the cape). */
    private fun box(
        tex: Bitmap, u: Int, v: Int, w: Int, h: Int, d: Int,
        x0: Float, y0: Float, z0: Float, inflate: Float, bias: Float, swapFB: Boolean = false,
    ) {
        val xa = x0 - inflate; val ya = y0 - inflate; val za = z0 - inflate
        val W = w + 2 * inflate; val H = h + 2 * inflate; val D = d + 2 * inflate
        val x1 = xa + W; val y1 = ya + H; val z1 = za + D
        val frontU = u + d; val backU = u + d + w + d
        fun q(
            sx: Int, sy: Int, sw: Int, sh: Int, ax: Float, ay: Float, az: Float,
            ux: Float, uy: Float, uz: Float, vx: Float, vy: Float, vz: Float,
        ) {
            // apply the optional X-axis pre-rotation to origin and both axis tips
            pre(ay, az, p0); pre(ay + uy, az + uz, p1); pre(ay + vy, az + vz, p2)
            face(tex, sx, sy, sw, sh, ax, p0[0], p0[1], ux, p1[0] - p0[0], p1[1] - p0[1], vx, p2[0] - p0[0], p2[1] - p0[1], bias)
        }
        q(if (swapFB) backU else frontU, v + d, w, h, xa, y1, z1, W, 0f, 0f, 0f, -H, 0f)           // front (+z)
        q(if (swapFB) frontU else backU, v + d, w, h, x1, y1, za, -W, 0f, 0f, 0f, -H, 0f)          // back (-z)
        q(u, v + d, d, h, xa, y1, za, 0f, 0f, D, 0f, -H, 0f)                                        // character's right (-x)
        q(u + d + w, v + d, d, h, x1, y1, z1, 0f, 0f, -D, 0f, -H, 0f)                               // character's left (+x)
        q(u + d, v, w, d, xa, y1, za, W, 0f, 0f, 0f, 0f, D)                                         // top
        q(u + d + w, v, w, d, xa, ya, z1, W, 0f, 0f, 0f, 0f, -D)                                    // bottom
    }

    fun draw(
        canvas: Canvas, skin: SkinData, yawDeg: Float, pitchDeg: Float, t: Float, width: Float, height: Float, animate: Boolean,
    ) {
        val yaw = Math.toRadians(yawDeg.toDouble()); val pitch = Math.toRadians(pitchDeg.toDouble())
        cyaw = cos(yaw).toFloat(); syaw = sin(yaw).toFloat(); cp = cos(pitch).toFloat(); sp = sin(pitch).toFloat()
        scale = height * 0.9f / 32f; ox = width / 2f; oy = height * 0.5f + 0f
        n = 0
        val b = skin.bitmap
        val aw = if (skin.slim) 3 else 4
        val swing = if (animate) sin(t * 1.5f) * 0.09f else 0f

        fun part(u: Int, v: Int, w: Int, h: Int, d: Int, x: Float, y: Float, z: Float, ou: Int, ov: Int, ang: Float, py: Float) {
            preAng = ang; pivY = py; pivZ = 0f
            box(b, u, v, w, h, d, x, y, z, 0f, 0f)
            box(b, ou, ov, w, h, d, x, y, z, if (h == 8) 0.5f else 0.25f, 0.02f)
        }
        part(0, 0, 8, 8, 8, -4f, 24f, -4f, 32, 0, 0f, 0f)                     // head
        part(16, 16, 8, 12, 4, -4f, 12f, -2f, 16, 32, 0f, 0f)                  // body
        part(40, 16, aw, 12, 4, -4f - aw, 12f, -2f, 40, 32, swing, 22f)        // right arm
        part(32, 48, aw, 12, 4, 4f, 12f, -2f, 48, 48, -swing, 22f)             // left arm
        part(0, 16, 4, 12, 4, -4f, 0f, -2f, 0, 32, -swing * 0.6f, 12f)         // right leg
        part(16, 48, 4, 12, 4, 0f, 0f, -2f, 0, 48, swing * 0.6f, 12f)          // left leg
        skin.cape?.let { cape ->
            preAng = Math.toRadians(8.0 + (if (animate) 4.0 * sin(t * 1.1) else 0.0)).toFloat(); pivY = 24f; pivZ = -2f
            box(cape, 0, 0, 10, 16, 1, -5f, 8f, -3f, 0f, -0.01f, swapFB = true)
        }
        preAng = 0f

        // painter's algorithm: far first (insertion sort, n <= ~100)
        for (i in 1 until n) {
            val f = pool[i]; var j = i - 1
            while (j >= 0 && pool[j].z > f.z) { pool[j + 1] = pool[j]; j-- }
            pool[j + 1] = f
        }
        for (i in 0 until n) {
            val f = pool[i]
            val tex = f.tex ?: continue
            srcPts[0] = 0f; srcPts[1] = 0f; srcPts[2] = f.sw.toFloat(); srcPts[3] = 0f; srcPts[4] = 0f; srcPts[5] = f.sh.toFloat()
            m.setPolyToPoly(srcPts, 0, f.d, 0, 3)
            canvas.save()
            canvas.concat(m)
            srcRect.set(f.sx, f.sy, f.sx + f.sw, f.sy + f.sh)
            dstRect.set(-0.03f, -0.03f, f.sw + 0.03f, f.sh + 0.03f)
            canvas.drawBitmap(tex, srcRect, dstRect, paint)
            canvas.restore()
        }
    }
}

/** Rotating, draggable 3D player. Releasing a drag eases the auto-spin back in with a spring. */
@Composable
fun SkinViewer(skin: SkinData, modifier: Modifier, animate: Boolean) {
    val painter = remember { SkinPainter() }
    val yaw = remember { mutableFloatStateOf(-28f) }
    val clock = remember { mutableFloatStateOf(0f) }
    val spin = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(animate) {
        if (!animate) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            var last = 0L
            while (true) {
                androidx.compose.runtime.withFrameNanos { ns ->
                    if (last != 0L) {
                        val dt = (ns - last) / 1e9f
                        clock.floatValue += dt
                        yaw.floatValue += dt * 32f * spin.value
                    }
                    last = ns
                }
            }
        }
    }
    ComposeCanvas(
        modifier.pointerInput(Unit) {
            detectDragGestures(
                onDragStart = { scope.launch { spin.snapTo(0f) } },
                onDragEnd = { scope.launch { spin.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 40f)) } },
                onDragCancel = { scope.launch { spin.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 40f)) } },
            ) { change, drag -> change.consume(); yaw.floatValue += drag.x * 0.7f }
        },
    ) {
        drawIntoCanvas { c -> painter.draw(c.nativeCanvas, skin, yaw.floatValue, 9f, clock.floatValue, size.width, size.height, animate) }
    }
}
