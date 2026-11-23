package app.luminos.mobile.core

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import java.util.UUID

/** What we need to draw a player: 64x64 skin, arm model, optional 64x32 cape. */
class SkinData(val bitmap: Bitmap, val slim: Boolean, val cape: Bitmap?)

object Offline {
    /** Vanilla's offline UUID: version-3 UUID of "OfflinePlayer:<name>". Servers in offline mode use exactly this. */
    fun uuid(name: String): UUID = UUID.nameUUIDFromBytes("OfflinePlayer:$name".toByteArray(Charsets.UTF_8))
}

object Skins {
    /** Brings any skin (legacy 64x32, HD) to 64x64. */
    fun normalize(src: Bitmap): Bitmap {
        val s = if (src.width != 64) Bitmap.createScaledBitmap(src, 64, (src.height * 64 / src.width).coerceAtLeast(32), false) else src
        val out = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        Canvas(out).drawBitmap(s, 0f, 0f, null)
        if (s.height <= 32) {
            mirrorCube(s, out, 0, 16, 4, 12, 4, 16, 48) // right leg -> left leg
            mirrorCube(s, out, 40, 16, 4, 12, 4, 32, 48) // right arm -> left arm
        }
        return out
    }

    /** Slim (3px) arms leave the 4th column of the right arm's front face transparent. */
    fun detectSlim(b: Bitmap): Boolean = (20..31).all { y -> (b.getPixel(47, y) ushr 24) == 0 }

    private fun face(src: Bitmap, sx: Int, sy: Int, w: Int, h: Int, dst: Bitmap, dx: Int, dy: Int) {
        for (y in 0 until h) for (x in 0 until w) dst.setPixel(dx + x, dy + y, src.getPixel(sx + (w - 1 - x), sy + y))
    }

    private fun mirrorCube(src: Bitmap, dst: Bitmap, u: Int, v: Int, w: Int, h: Int, d: Int, du: Int, dv: Int) {
        face(src, u + d, v, w, d, dst, du + d, dv)
        face(src, u + d + w, v, w, d, dst, du + d + w, dv)
        face(src, u + d, v + d, w, h, dst, du + d, dv + d)
        face(src, u + d + w + d, v + d, w, h, dst, du + d + w + d, dv + d)
        face(src, u, v + d, d, h, dst, du + d + w, dv + d)
        face(src, u + d + w, v + d, d, h, dst, du, dv + d)
    }

    // ---- Luminos default skin (original artwork, drawn from rectangles) ----
    private fun col(hex: String) = Color.parseColor(hex)

    private fun fill(c: Canvas, p: Paint, x: Int, y: Int, w: Int, h: Int, color: Int) {
        p.color = color
        c.drawRect(Rect(x, y, x + w, y + h), p)
    }

    private fun cube(c: Canvas, p: Paint, u: Int, v: Int, w: Int, h: Int, d: Int, color: Int) {
        fill(c, p, u + d, v, w * 2, d, color)
        fill(c, p, u, v + d, d * 2 + w * 2, h, color)
    }

    private fun sideBand(c: Canvas, p: Paint, u: Int, v: Int, w: Int, d: Int, y0: Int, y1: Int, color: Int) =
        fill(c, p, u, v + d + y0, d * 2 + w * 2, y1 - y0 + 1, color)

    fun defaultSkin(): Bitmap {
        val b = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        val p = Paint().apply { isAntiAlias = false; style = Paint.Style.FILL }
        val skin = col("#D9A77D"); val hair = col("#0C2370"); val hoodie = col("#3F74E6"); val trim = col("#1A45BD")
        val pants = col("#08124A"); val boot = col("#01020A"); val ice = col("#D3E4FC"); val glow = col("#8FB6F5")
        cube(c, p, 0, 0, 8, 8, 8, skin)
        fill(c, p, 8, 0, 16, 8, hair)                // top + bottom
        fill(c, p, 0, 8, 32, 3, hair)                // fringe + temples on all four sides
        fill(c, p, 24, 8, 8, 8, hair)                // back of head
        fill(c, p, 9, 12, 2, 1, ice); fill(c, p, 13, 12, 2, 1, ice)   // eyes
        fill(c, p, 10, 12, 1, 1, trim); fill(c, p, 13, 12, 1, 1, trim)
        fill(c, p, 11, 14, 2, 1, col("#7A3E2B"))     // mouth
        cube(c, p, 16, 16, 8, 12, 4, hoodie)
        fill(c, p, 16, 20, 24, 1, trim)              // hem line wraps the body
        fill(c, p, 23, 23, 2, 2, ice); fill(c, p, 22, 22, 4, 4, glow); fill(c, p, 23, 23, 2, 2, ice) // lumen orb on chest
        cube(c, p, 40, 16, 4, 12, 4, hoodie); cube(c, p, 32, 48, 4, 12, 4, hoodie)
        sideBand(c, p, 40, 16, 4, 4, 9, 11, skin); sideBand(c, p, 32, 48, 4, 4, 9, 11, skin)
        cube(c, p, 0, 16, 4, 12, 4, pants); cube(c, p, 16, 48, 4, 12, 4, pants)
        sideBand(c, p, 0, 16, 4, 4, 9, 11, boot); sideBand(c, p, 16, 48, 4, 4, 9, 11, boot)
        return b
    }
}
