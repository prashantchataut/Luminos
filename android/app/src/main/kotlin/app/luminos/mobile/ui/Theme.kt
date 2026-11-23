package app.luminos.mobile.ui

import android.view.HapticFeedbackConstants
import android.view.View
import android.os.Build
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Semantic tokens shared with the website's dithered night-sky palette (UX-6: no raw hex in screens). */
object Lx {
    val Bg0 = Color(0xFF01020A)
    val Bg1 = Color(0xFF050A1F)
    val Bg2 = Color(0xFF08124A)
    val Panel = Color(0xE60A1230)
    val PanelSolid = Color(0xFF0A1230)
    val PanelHi = Color(0xFF0E1A44)
    val Line = Color(0xFF1F2F6B)
    val Accent = Color(0xFF3F74E6)
    val AccentDeep = Color(0xFF1A45BD)
    val AccentHi = Color(0xFF8FB6F5)
    val Ice = Color(0xFFD3E4FC)
    val Text = Color(0xFFEAF1FF)
    val Muted = Color(0xFF98AAD3)
    val Ok = Color(0xFF7BD5A5)
    val Warn = Color(0xFFF0C674)
    val Err = Color(0xFFFF8F8F)
    val Radius = 6.dp
    val Display = FontFamily.Serif
    val Mono = FontFamily.Monospace
}

object Type {
    val micro = TextStyle(fontFamily = Lx.Mono, fontSize = 10.sp, letterSpacing = 1.4.sp, fontWeight = FontWeight.Medium, color = Lx.Muted)
    val body = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, color = Lx.Text)
    val bodyMuted = body.copy(color = Lx.Muted)
    val label = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Lx.Text)
    val title = TextStyle(fontFamily = Lx.Display, fontSize = 26.sp, lineHeight = 30.sp, color = Lx.Text)
    val hero = TextStyle(fontFamily = Lx.Display, fontSize = 38.sp, lineHeight = 40.sp, color = Lx.Text)
    val mono = TextStyle(fontFamily = Lx.Mono, fontSize = 12.sp, color = Lx.Text)
}

@Composable
fun LuminosTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Lx.Accent, onPrimary = Color.White, background = Lx.Bg1, onBackground = Lx.Text,
            surface = Lx.PanelSolid, onSurface = Lx.Text, surfaceVariant = Lx.PanelHi, onSurfaceVariant = Lx.Muted,
            outline = Lx.Line,
        ),
        content = content,
    )
}

/** Haptic vocabulary. One call site per meaning; all respect the in-app switch and the system touch-feedback setting. */
object Haptics {
    fun tap(v: View, on: Boolean) { if (on) v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP) }
    fun select(v: View, on: Boolean) { if (on) v.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK) }
    fun confirm(v: View, on: Boolean) {
        if (on) v.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS)
    }
    fun reject(v: View, on: Boolean) {
        if (on) v.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS)
    }
}
