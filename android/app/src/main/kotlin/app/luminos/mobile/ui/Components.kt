package app.luminos.mobile.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import app.luminos.mobile.Launch
import app.luminos.mobile.core.SkinData
import coil.compose.AsyncImage
import kotlin.math.roundToInt

private val Shape = RoundedCornerShape(Lx.Radius)

@Composable fun Micro(text: String, modifier: Modifier = Modifier, color: Color = Lx.Muted) =
    Text(text.uppercase(), modifier, style = Type.micro.copy(color = color))

/** Flat ink panel: hairline border, 6dp radius, no glow. */
@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.clip(Shape).background(Lx.Panel).border(1.dp, Lx.Line, Shape)) { content() }
}

@Composable
fun LxButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, primary: Boolean = true, enabled: Boolean = true) {
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(120), label = "btn")
    val view = LocalView.current
    Box(
        modifier.height(48.dp).graphicsLayer { scaleX = scale; scaleY = scale }.clip(Shape)
            .background(if (!enabled) Lx.PanelHi else if (primary) Lx.Accent else Color.Transparent)
            .border(1.dp, if (primary) Color.Transparent else Lx.Line, Shape)
            .clickable(src, null, enabled = enabled, role = Role.Button) { Haptics.tap(view, true); onClick() }
            .padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, style = Type.label.copy(color = if (enabled) Lx.Text else Lx.Muted)) }
}

@Composable
fun Chip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val view = LocalView.current
    val bg by animateColorAsState(if (selected) Lx.Accent else Color.Transparent, tween(160), label = "chip")
    Box(
        modifier.height(36.dp).clip(Shape).background(bg).border(1.dp, if (selected) Lx.Accent else Lx.Line, Shape)
            .clickable(role = Role.Tab) { Haptics.select(view, true); onClick() }.padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, style = Type.label.copy(color = if (selected) Color.White else Lx.Muted)) }
}

@Composable
fun LxField(
    value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier,
    keyboard: KeyboardOptions = KeyboardOptions.Default, singleLine: Boolean = true, mono: Boolean = false,
) {
    BasicTextField(
        value, onChange, modifier = modifier, singleLine = singleLine, keyboardOptions = keyboard,
        textStyle = (if (mono) Type.mono else Type.body),
        cursorBrush = SolidColor(Lx.AccentHi),
        decorationBox = { inner ->
            Box(
                Modifier.fillMaxWidth().height(48.dp).clip(Shape).background(Lx.Bg0.copy(alpha = 0.55f)).border(1.dp, Lx.Line, Shape).padding(horizontal = 14.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (value.isEmpty()) Text(placeholder, style = Type.bodyMuted)
                inner()
            }
        },
    )
}

/** Segmented pixel progress bar (24 cells) instead of a smooth gradient bar. */
@Composable
fun PixelProgress(fraction: Float, modifier: Modifier = Modifier, color: Color = Lx.Accent) {
    val f by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(200), label = "progress")
    Canvas(modifier.fillMaxWidth().height(8.dp)) {
        val n = 24; val gap = 3.dp.toPx(); val w = (size.width - gap * (n - 1)) / n
        for (i in 0 until n) {
            val on = (i + 1f) / n <= f + 0.0001f
            drawRect(if (on) color else Lx.Line, Offset(i * (w + gap), 0f), Size(w, size.height))
        }
    }
}

/** Head + hat layer of the player's actual skin, nearest-neighbour. */
@Composable
fun Avatar(skin: SkinData?, size: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val img = remember(skin?.bitmap) { skin?.bitmap?.asImageBitmap() }
    Canvas(modifier.size(size).clip(Shape).background(Lx.PanelHi).semantics { contentDescription = "Your skin" }) {
        val i = img ?: return@Canvas
        val s = IntSize(this.size.width.roundToInt(), this.size.height.roundToInt())
        drawImage(i, IntOffset(8, 8), IntSize(8, 8), IntOffset.Zero, s, filterQuality = FilterQuality.None)
        drawImage(i, IntOffset(40, 8), IntSize(8, 8), IntOffset.Zero, s, filterQuality = FilterQuality.None)
    }
}

/** Mojang's official art for the version when available; otherwise a dithered placeholder that says so. */
@Composable
fun CoverArt(url: String?, version: String, modifier: Modifier = Modifier, scrim: Boolean = true) {
    Box(modifier.background(Lx.Bg2)) {
        Canvas(Modifier.matchParentSize()) {
            drawRect(Brush.verticalGradient(listOf(Lx.Bg2, Lx.AccentDeep.copy(alpha = 0.7f))))
        }
        if (url != null) AsyncImage(url, "Minecraft $version artwork", Modifier.matchParentSize(), contentScale = ContentScale.Crop)
        if (scrim) Box(Modifier.matchParentSize().background(Brush.verticalGradient(0.45f to Color.Transparent, 1f to Lx.Bg1.copy(alpha = 0.92f))))
    }
}

/**
 * The launch button. One shape that morphs through the states: Ready (full-width rectangle) -> Working
 * (pixel progress fills it, label becomes a live percentage) -> Verified (collapses to a pill with a check)
 * -> Failed (shakes, turns red, offers Retry). Haptics fire on each transition.
 */
@Composable
fun LaunchButton(state: Launch, readyLabel: String, onClick: () -> Unit, haptics: Boolean, reduceMotion: Boolean, modifier: Modifier = Modifier) {
    val view = LocalView.current
    val dur = if (reduceMotion) 0 else 320
    val widthFrac by animateFloatAsState(if (state is Launch.Verified) 0.62f else 1f, tween(dur, easing = FastOutSlowInEasing), label = "w")
    val radius by animateDpAsState(if (state is Launch.Verified) 28.dp else Lx.Radius, tween(dur), label = "r")
    val color by animateColorAsState(
        when (state) { is Launch.Verified -> Lx.AccentDeep; is Launch.Failed -> Color(0xFF7A2430); else -> Lx.Accent }, tween(dur), label = "c",
    )
    val shake = remember { Animatable(0f) }
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val press by animateFloatAsState(if (pressed) 0.97f else 1f, tween(120), label = "press")

    LaunchedEffect(state::class) {
        when (state) {
            is Launch.Verified -> Haptics.confirm(view, haptics)
            is Launch.Failed -> {
                Haptics.reject(view, haptics)
                if (!reduceMotion) for (d in listOf(-14f, 12f, -9f, 6f, 0f)) shake.animateTo(d, tween(55))
            }
            else -> {}
        }
    }
    val progress = (state as? Launch.Working)?.progress ?: 0f
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
        Box(
            Modifier.fillMaxWidth(widthFrac).height(56.dp)
                .graphicsLayer { translationX = shake.value; scaleX = press; scaleY = press }
                .clip(RoundedCornerShape(radius)).background(color)
                .clickable(src, null, enabled = state !is Launch.Working, role = Role.Button) { Haptics.tap(view, haptics); onClick() },
            contentAlignment = Alignment.Center,
        ) {
            if (state is Launch.Working) {
                Box(Modifier.matchParentSize().background(Lx.AccentDeep))
                Canvas(Modifier.matchParentSize()) { drawRect(Lx.Accent, Offset.Zero, Size(size.width * progress, size.height)) }
            }
            Crossfade(state, animationSpec = tween(if (reduceMotion) 0 else 200), label = "label") { s ->
                when (s) {
                    is Launch.Ready -> Text(readyLabel, style = Type.label.copy(color = Color.White))
                    is Launch.Working -> Row(Modifier.padding(horizontal = 16.dp), Arrangement.spacedBy(10.dp), Alignment.CenterVertically) {
                        Text(s.label, style = Type.label.copy(color = Color.White), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        Text("${(s.progress * 100).toInt()}%", style = Type.mono.copy(color = Lx.Ice))
                    }
                    is Launch.Verified -> Row(Modifier, Arrangement.spacedBy(8.dp), Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Check, null, tint = Lx.Ice, modifier = Modifier.size(20.dp)); Text("Verified", style = Type.label.copy(color = Lx.Ice))
                    }
                    is Launch.Failed -> Row(Modifier, Arrangement.spacedBy(8.dp), Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Refresh, null, tint = Color.White, modifier = Modifier.size(20.dp)); Text("Retry", style = Type.label.copy(color = Color.White))
                    }
                }
            }
        }
    }
}

@Composable
fun ErrorLine(text: String, modifier: Modifier = Modifier) =
    Row(modifier, Arrangement.spacedBy(8.dp), Alignment.Top) {
        Icon(Icons.Rounded.Close, null, tint = Lx.Err, modifier = Modifier.size(16.dp).padding(top = 2.dp))
        Text(text, style = Type.body.copy(color = Lx.Err, textAlign = TextAlign.Start))
    }

@Composable
fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.clip(Shape).border(1.dp, Lx.Line, Shape).background(Lx.Bg0.copy(alpha = 0.5f)).padding(3.dp), Arrangement.spacedBy(3.dp)) {
        options.forEachIndexed { i, o ->
            val bg by animateColorAsState(if (i == selected) Lx.Accent else Color.Transparent, tween(160), label = "seg")
            val view = LocalView.current
            Box(
                Modifier.weight(1f).height(38.dp).clip(RoundedCornerShape(4.dp)).background(bg)
                    .clickable(role = Role.Tab) { Haptics.select(view, true); onSelect(i) },
                contentAlignment = Alignment.Center,
            ) { Text(o, style = Type.label.copy(color = if (i == selected) Color.White else Lx.Muted)) }
        }
    }
}
