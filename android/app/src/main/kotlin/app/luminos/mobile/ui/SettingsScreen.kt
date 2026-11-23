package app.luminos.mobile.ui

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.luminos.mobile.AppVm
import app.luminos.mobile.BuildConfig
import app.luminos.mobile.core.Net

@Composable
fun SettingsScreen(vm: AppVm) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 20.dp).padding(top = 12.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Micro("Settings")
        Text("Settings", style = Type.title)

        Panel(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Micro("Feel")
                LxToggle(vm.settings.reduceMotion, { vm.setReduceMotion(it) }, "Reduce motion", "Stops the sky, the 3D spin and slide transitions. Follows no system flag; this is the switch.")
                LxToggle(vm.settings.haptics, { vm.setHaptics(it) }, "Haptics", "Taps, selections, and a distinct buzz when a launch step succeeds or fails.")
            }
        }

        Panel(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Micro("Engine · Java runtime")
                val c = vm.engineCheck
                Text(
                    when {
                        c != null && c.ok -> "Booted: ${c.summary} (${c.millis} ms)"
                        c != null -> "Failed: ${c.summary}"
                        vm.jreInstalled -> "Installed. Not booted yet in this session."
                        else -> "Not installed. About 38 MB, SHA-256 verified."
                    },
                    style = Type.body.copy(color = if (c?.ok == true) Lx.Ok else if (c != null) Lx.Err else Lx.Text),
                )
                vm.engineBusy?.let { Micro(it, color = Lx.AccentHi) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (!vm.jreInstalled) LxButton("Download runtime", { vm.installRuntime() }, Modifier.weight(1f), enabled = vm.engineBusy == null)
                    else LxButton("Boot check", { vm.runEngineCheck() }, Modifier.weight(1f), enabled = vm.engineBusy == null)
                }
                c?.let { if (!it.ok && it.output.isNotBlank()) Text(it.output.take(600), style = Type.mono.copy(fontSize = 10.sp, color = Lx.Muted)) }
                Text("CPU: ${Build.SUPPORTED_ABIS.joinToString()} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})", style = Type.bodyMuted.copy(fontSize = 12.sp))
            }
        }

        Panel(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Micro("Network activity")
                Text("The only servers this app will talk to. Anything else is refused in code, and plain HTTP is upgraded to HTTPS. No ads, no analytics, no crash reporting.", style = Type.bodyMuted)
                Net.registry.forEach { h ->
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(h.host, style = Type.mono.copy(fontSize = 11.sp, color = Lx.AccentHi), modifier = Modifier.weight(1f))
                            Micro("${Net.requestCount(h.host)} req")
                        }
                        Text("${h.purpose} · sends ${h.sends}", style = Type.bodyMuted.copy(fontSize = 12.sp, lineHeight = 16.sp))
                    }
                }
            }
        }

        Panel(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Micro("About")
                Text("Luminos Mobile ${BuildConfig.VERSION_NAME}", style = Type.label)
                Text("Proprietary, all rights reserved. Not an official Minecraft product and not approved by or associated with Mojang or Microsoft. The only permission requested is INTERNET.", style = Type.bodyMuted)
                Text("github.com/prashantchataut/Luminos", style = Type.mono.copy(fontSize = 11.sp, color = Lx.AccentHi))
            }
        }
    }
}
