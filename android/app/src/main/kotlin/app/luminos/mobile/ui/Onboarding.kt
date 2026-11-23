package app.luminos.mobile.ui

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.luminos.mobile.AppVm
import app.luminos.mobile.R
import app.luminos.mobile.core.Engine
import app.luminos.mobile.core.Offline
import app.luminos.mobile.validName

@Composable
fun LxToggle(checked: Boolean, onChange: (Boolean) -> Unit, title: String, sub: String? = null, modifier: Modifier = Modifier) {
    val x by animateDpAsState(if (checked) 20.dp else 0.dp, tween(160, easing = FastOutSlowInEasing), label = "thumb")
    Row(
        modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 8.dp),
        Arrangement.spacedBy(14.dp), Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = Type.label)
            if (sub != null) Text(sub, style = Type.bodyMuted.copy(fontSize = 12.sp))
        }
        Box(
            Modifier.width(46.dp).height(26.dp).clip(RoundedCornerShape(4.dp))
                .background(if (checked) Lx.Accent else Lx.PanelHi).border(1.dp, Lx.Line, RoundedCornerShape(4.dp)).padding(3.dp),
        ) {
            Box(Modifier.offset(x = x).size(20.dp).clip(RoundedCornerShape(3.dp)).background(if (checked) Color.White else Lx.Muted))
        }
    }
}

private fun totalRamMb(ctx: Context): Long {
    val mi = ActivityManager.MemoryInfo()
    (ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(mi)
    return mi.totalMem / (1024 * 1024)
}

@Composable
fun Onboarding(vm: AppVm) {
    val step = vm.onbStep
    var name by rememberSaveable { mutableStateOf("") }
    var premium by rememberSaveable { mutableStateOf(false) }
    val ctx = LocalContext.current
    Box(Modifier.fillMaxSize().background(Lx.Bg1)) {
        DitherSky(animate = !vm.settings.reduceMotion)
        Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Image(painterResource(R.drawable.ic_launcher_art), null, Modifier.size(34.dp))
                Micro("Luminos · Mobile", Modifier.weight(1f), Lx.Ice)
                Micro("0${step + 1} / 03")
            }
            Spacer(Modifier.weight(1f))
            AnimatedContent(
                step,
                transitionSpec = {
                    val d = if (vm.settings.reduceMotion) 0 else 360
                    (slideInHorizontally(tween(d, easing = FastOutSlowInEasing)) { it / 6 } + fadeIn(tween(d))) togetherWith fadeOut(tween(d / 2))
                },
                label = "onb",
            ) { s ->
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    when (s) {
                        0 -> {
                            Text("Minecraft,\nlighter.", style = Type.hero.copy(fontSize = 52.sp, lineHeight = 52.sp))
                            Text("Java Edition on your phone. Offline accounts, Modrinth mods, your own skin. No ads, no trackers, no account with us.", style = Type.body.copy(color = Lx.Ice))
                            Micro("Early preview · installs, mods and skins work today · starting the game is the next engine stage")
                            LxButton("Get started", { vm.onbStep = 1 }, Modifier.fillMaxWidth())
                        }
                        1 -> {
                            Text("Who's playing?", style = Type.title)
                            Text("An offline account needs no login. Use the name you play under on your servers.", style = Type.bodyMuted)
                            LxField(name, { name = it.take(16) }, "Player name", keyboard = KeyboardOptions(keyboardType = KeyboardType.Ascii))
                            val ok = validName(name)
                            if (ok) {
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Micro("Offline UUID")
                                    Text(Offline.uuid(name).toString(), style = Type.mono.copy(color = Lx.AccentHi))
                                }
                            } else if (name.isNotEmpty()) ErrorLine("3-16 characters: letters, numbers, underscore.")
                            LxToggle(
                                premium, { premium = it }, "This is also my Minecraft account name",
                                "Load my real skin and cape from Mojang. Only the name is sent, only when you finish this step.",
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                LxButton("Back", { vm.onbStep = 0 }, Modifier.weight(1f), primary = false)
                                LxButton("Continue", { vm.onbStep = 2 }, Modifier.weight(2f), enabled = ok)
                            }
                        }
                        else -> {
                            val ram = remember { totalRamMb(ctx) }
                            val asset = remember { Engine.asset() }
                            Text("Your device", style = Type.title)
                            Panel(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Fact("CPU", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown", if (asset != null) "Java runtime available" else "No Java runtime for this CPU yet", asset != null)
                                    Fact("Memory", "$ram MB", "Game memory is capped at 75% = ${ram * 3 / 4} MB, because Android kills apps above that.", true)
                                    Fact("Download", "~${(asset?.bytes ?: 0) / 1_000_000} MB runtime", "OpenJDK 21 or 25 to match the Minecraft version, SHA-256 checked, fetched from GitHub when you first press Prepare.", true)
                                }
                            }
                            when {
                                vm.catalogLoading -> Micro("Reaching Mojang for the version list…", color = Lx.AccentHi)
                                vm.catalogError != null -> {
                                    ErrorLine("Couldn't reach Mojang: ${vm.catalogError}")
                                    LxButton("Try again", { vm.loadCatalog() }, Modifier.fillMaxWidth(), primary = false)
                                }
                                else -> Micro("Latest release: Minecraft ${vm.latestRelease}", color = Lx.Ok)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                LxButton("Back", { vm.onbStep = 1 }, Modifier.weight(1f), primary = false)
                                LxButton("Finish", { vm.createAccount(name, premium) { vm.tab = app.luminos.mobile.Tab.Home } }, Modifier.weight(2f), enabled = vm.latestRelease != null && validName(name))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Fact(k: String, v: String, note: String, good: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Micro(k, Modifier.width(72.dp)); Text(v, style = Type.mono.copy(color = if (good) Lx.Ice else Lx.Warn))
        }
        Text(note, style = Type.bodyMuted.copy(fontSize = 12.sp), modifier = Modifier.padding(start = 80.dp))
    }
}
