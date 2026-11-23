package app.luminos.mobile.ui

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.luminos.mobile.AppVm
import app.luminos.mobile.Launch
import app.luminos.mobile.Tab

private val R6 = RoundedCornerShape(Lx.Radius)

@Composable
fun HomeScreen(vm: AppVm) {
    val inst = vm.selected
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 20.dp).padding(top = 12.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Micro("Luminos")
                Text(vm.account?.name ?: "Player", style = Type.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Avatar(vm.skin, 46.dp)
        }
        if (inst == null) {
            Panel(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("No instance yet", style = Type.title)
                    Text("An instance is one Minecraft version with its own mods and settings. Create the first one.", style = Type.bodyMuted)
                    LxButton("Create an instance", { vm.tab = Tab.Library }, Modifier.fillMaxWidth())
                }
            }
        } else {
            Box(Modifier.fillMaxWidth().height(260.dp).clip(R6).border(1.dp, Lx.Line, R6)) {
                CoverArt(vm.coverFor(inst.mc), inst.mc, Modifier.matchParentSize())
                Column(Modifier.align(Alignment.BottomStart).padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Micro("${inst.loader} · Minecraft ${inst.mc}", color = Lx.Ice)
                    Text(inst.name, style = Type.hero, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            LaunchButton(vm.launch, "Prepare", { vm.prepare() }, vm.settings.haptics, vm.settings.reduceMotion)
            when (val l = vm.launch) {
                is Launch.Failed -> ErrorLine(l.message)
                is Launch.Verified -> Text("Java runtime and Minecraft ${inst.mc} files are verified on this device. Starting the game itself is engine stage 3 and is not in this build yet.", style = Type.bodyMuted)
                is Launch.Working -> Text("Keep the app open. Files come straight from Mojang and are checked against their SHA-1.", style = Type.bodyMuted)
                else -> Text("Downloads the Java runtime and Minecraft ${inst.mc} from Mojang, then boots the JVM to prove it works on this phone.", style = Type.bodyMuted)
            }
            EngineStages(vm, inst.mc)
            Micro("Instances")
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(vm.instances, key = { it.id }) { i ->
                    val sel = i.id == inst.id
                    Box(
                        Modifier.width(150.dp).height(104.dp).clip(R6).border(if (sel) 2.dp else 1.dp, if (sel) Lx.Accent else Lx.Line, R6)
                            .clickable { vm.select(i.id) },
                    ) {
                        CoverArt(vm.coverFor(i.mc), i.mc, Modifier.matchParentSize())
                        Column(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
                            Text(i.name, style = Type.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Micro("${i.loader} ${i.mc}")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EngineStages(vm: AppVm, mc: String) {
    val chk = vm.engineCheck
    val prepared = vm.launch is Launch.Verified
    Panel(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Micro("Engine · what works on this phone")
            Stage(
                "1", "Java runtime boots",
                when { chk?.ok == true -> "${chk.summary} · ${chk.millis} ms"; chk != null -> chk.summary; vm.jreInstalled -> "Installed, not booted yet"; else -> "Not downloaded yet" },
                if (chk?.ok == true) 1 else if (chk != null) -1 else 0,
            )
            Stage("2", "Minecraft $mc files verified", if (prepared) "Client, libraries and assets match Mojang's SHA-1" else "Run Prepare to download and verify", if (prepared) 1 else 0)
            Stage("3", "Minecraft reaches its title screen", "Needs the OpenGL + window layer. Not built yet.", 0, pending = true)
        }
    }
}

@Composable
private fun Stage(n: String, title: String, detail: String, state: Int, pending: Boolean = false) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Box(
            Modifier.size(24.dp).clip(RoundedCornerShape(4.dp)).background(if (state == 1) Lx.Ok.copy(alpha = 0.18f) else if (state == -1) Lx.Err.copy(alpha = 0.18f) else Lx.PanelHi),
            contentAlignment = Alignment.Center,
        ) {
            when {
                state == 1 -> Icon(Icons.Rounded.Check, "done", tint = Lx.Ok, modifier = Modifier.size(16.dp))
                state == -1 -> Icon(Icons.Rounded.Warning, "failed", tint = Lx.Err, modifier = Modifier.size(16.dp))
                else -> Text(n, style = Type.micro)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = Type.label)
            Text(detail, style = Type.bodyMuted.copy(fontSize = 12.sp, color = if (pending) Lx.Warn else Lx.Muted))
        }
    }
}
