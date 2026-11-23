package app.luminos.mobile.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Build
import androidx.compose.material.icons.rounded.Face
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.luminos.mobile.AppVm
import app.luminos.mobile.Tab
import kotlinx.coroutines.delay

private fun icon(t: Tab): ImageVector = when (t) {
    Tab.Home -> Icons.Rounded.Home; Tab.Library -> Icons.Rounded.Build; Tab.Skins -> Icons.Rounded.Face; Tab.Settings -> Icons.Rounded.Settings
}

@Composable
fun App(vm: AppVm) {
    Box(Modifier.fillMaxSize().background(Lx.Bg1)) {
        Crossfade(
            when { !vm.loaded -> 0; !vm.onboarded -> 1; else -> 2 },
            animationSpec = tween(if (vm.settings.reduceMotion) 0 else 450), label = "root",
        ) { s ->
            when (s) {
                0 -> DitherSky(animate = false)
                1 -> Onboarding(vm)
                else -> Main(vm)
            }
        }
        vm.toast?.let { msg ->
            LaunchedEffect(msg) { delay(3200); if (vm.toast == msg) vm.toast = null }
            Box(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 92.dp, start = 20.dp, end = 20.dp)) {
                Panel(Modifier.fillMaxWidth()) { Text(msg, Modifier.padding(14.dp), style = Type.body) }
            }
        }
    }
}

@Composable
private fun Main(vm: AppVm) {
    Box(Modifier.fillMaxSize()) {
        DitherSky(animate = !vm.settings.reduceMotion)
        AnimatedContent(
            vm.tab,
            transitionSpec = {
                val d = if (vm.settings.reduceMotion) 0 else 320
                val dir = if (targetState.ordinal > initialState.ordinal) 1 else -1
                (slideInHorizontally(tween(d, easing = FastOutSlowInEasing)) { it / 7 * dir } + fadeIn(tween(d))) togetherWith
                    (slideOutHorizontally(tween(d / 2)) { -it / 9 * dir } + fadeOut(tween(d / 2)))
            },
            label = "tabs",
        ) { t ->
            when (t) {
                Tab.Home -> HomeScreen(vm)
                Tab.Library -> LibraryScreen(vm)
                Tab.Skins -> SkinsScreen(vm)
                Tab.Settings -> SettingsScreen(vm)
            }
        }
        BottomBar(vm, Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun BottomBar(vm: AppVm, modifier: Modifier) {
    val view = LocalView.current
    Column(modifier.fillMaxWidth().background(Lx.Bg1.copy(alpha = 0.96f)).navigationBarsPadding()) {
        BoxWithConstraints(Modifier.fillMaxWidth().height(2.dp).background(Lx.Line)) {
            val frac by animateFloatAsState(vm.tab.ordinal.toFloat(), tween(if (vm.settings.reduceMotion) 0 else 280, easing = FastOutSlowInEasing), label = "ind")
            Box(Modifier.offset(x = maxWidth / Tab.entries.size * frac).width(maxWidth / Tab.entries.size).height(2.dp).background(Lx.Accent))
        }
        androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth()) {
            Tab.entries.forEach { t ->
                val sel = vm.tab == t
                Column(
                    Modifier.weight(1f).height(64.dp).clip(RoundedCornerShape(0.dp)).clickable(role = Role.Tab) {
                        if (!sel) { Haptics.select(view, vm.settings.haptics); vm.tab = t }
                    },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                ) {
                    Icon(icon(t), t.name, tint = if (sel) Lx.AccentHi else Lx.Muted, modifier = Modifier.size(24.dp))
                    Micro(t.name, color = if (sel) Lx.AccentHi else Lx.Muted)
                }
            }
        }
    }
}
