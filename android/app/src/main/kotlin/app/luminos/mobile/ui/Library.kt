package app.luminos.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.luminos.mobile.AppVm
import app.luminos.mobile.core.ModHit
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

private val R6 = RoundedCornerShape(Lx.Radius)

@Composable
fun LibraryScreen(vm: AppVm) {
    var seg by rememberSaveable { mutableIntStateOf(0) }
    var sheet by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 20.dp).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Micro("Library")
        Text(if (seg == 0) "Instances" else "Mods", style = Type.title)
        Segmented(listOf("Instances", "Mods"), seg, { seg = it }, Modifier.fillMaxWidth())
        if (seg == 0) InstancesTab(vm) { sheet = true } else ModsTab(vm)
    }
    if (sheet) NewInstanceSheet(vm) { sheet = false }
}

@Composable
private fun InstancesTab(vm: AppVm, onNew: () -> Unit) {
    LxButton("New instance", onNew, Modifier.fillMaxWidth())
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 110.dp)) {
        items(vm.instances, key = { it.id }) { i ->
            val sel = i.id == vm.selectedId
            Panel(Modifier.fillMaxWidth().border(if (sel) 1.dp else 0.dp, if (sel) Lx.Accent else Lx.Line, R6).clickable { vm.select(i.id) }) {
                Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    CoverArt(vm.coverFor(i.mc), i.mc, Modifier.size(72.dp).clip(R6), scrim = false)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(i.name, style = Type.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Micro("${i.loader} · ${i.mc}")
                        if (sel) Micro("Selected", color = Lx.AccentHi)
                    }
                    Box(Modifier.size(44.dp).clickable { vm.deleteInstance(i.id) }, Alignment.Center) {
                        Icon(Icons.Rounded.Delete, "Delete ${i.name}", tint = Lx.Muted)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewInstanceSheet(vm: AppVm, onClose: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var loader by remember { mutableIntStateOf(0) }
    var q by remember { mutableStateOf("") }
    var snaps by remember { mutableStateOf(false) }
    var pick by remember { mutableStateOf(vm.latestRelease) }
    val list = remember(vm.versions, q, snaps) {
        vm.versions.filter { (snaps || it.type == "release") && it.id.contains(q.trim(), true) }.take(80)
    }
    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Lx.PanelSolid) {
        Column(Modifier.padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("New instance", style = Type.title)
            if (vm.versions.isEmpty()) {
                ErrorLine(vm.catalogError ?: "Loading Mojang's version list…")
                LxButton("Try again", { vm.loadCatalog() }, Modifier.fillMaxWidth(), primary = false)
            } else {
                LxField(name, { name = it }, "Name (optional)")
                Segmented(listOf("Vanilla", "Fabric"), loader, { loader = it }, Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    LxField(q, { q = it }, "Filter versions", Modifier.weight(1f))
                    Chip("Snapshots", snaps, { snaps = !snaps })
                }
                LazyColumn(Modifier.heightIn(max = 260.dp).clip(R6).border(1.dp, Lx.Line, R6)) {
                    items(list, key = { it.id }) { v ->
                        val on = v.id == pick
                        Row(
                            Modifier.fillMaxWidth().height(46.dp).background(if (on) Lx.Accent.copy(alpha = 0.22f) else androidx.compose.ui.graphics.Color.Transparent)
                                .clickable { pick = v.id }.padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(v.id, style = Type.mono); Micro(v.type, color = if (on) Lx.Ice else Lx.Muted)
                        }
                    }
                }
                LxButton("Create", {
                    pick?.let { vm.createInstance(name.trim(), it, if (loader == 0) "vanilla" else "fabric") }; onClose()
                }, Modifier.fillMaxWidth(), enabled = pick != null)
            }
        }
    }
}

@Composable
private fun ModsTab(vm: AppVm) {
    val inst = vm.selected
    if (inst == null) { Text("Create an instance first. Mods are installed per instance.", style = Type.bodyMuted); return }
    var query by rememberSaveable { mutableStateOf("") }
    if (inst.loader == "vanilla") {
        Panel(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("${inst.name} is Vanilla", style = Type.label)
                Text("Mods run on a mod loader. Switch this instance to Fabric to browse and install mods from Modrinth.", style = Type.bodyMuted)
                LxButton("Switch to Fabric", { vm.setLoader(inst.id, "fabric") }, Modifier.fillMaxWidth())
            }
        }
        return
    }
    LaunchedEffect(query, inst.id, inst.loader) { if (query.isNotEmpty()) delay(350); vm.searchMods(query) }
    LxField(query, { query = it }, "Search Modrinth for ${inst.mc} · ${inst.loader}")
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 110.dp)) {
        if (vm.installedMods.isNotEmpty()) {
            item { Micro("Installed · ${vm.installedMods.size}") }
            items(vm.installedMods, key = { "i" + it.projectId }) { m ->
                Panel(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(start = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f).padding(vertical = 10.dp)) { Text(m.title, style = Type.label); Micro(m.version) }
                        Box(Modifier.size(48.dp).clickable { vm.removeMod(m) }, Alignment.Center) { Icon(Icons.Rounded.Close, "Remove ${m.title}", tint = Lx.Muted) }
                    }
                }
            }
            item { Micro(if (query.isBlank()) "Most downloaded" else "Results") }
        }
        vm.modsError?.let { e -> item { ErrorLine(e) } }
        if (vm.modsLoading && vm.modResults.isEmpty()) item { Micro("Searching Modrinth…", color = Lx.AccentHi) }
        items(vm.modResults, key = { it.id }) { h -> ModRow(vm, h) }
    }
}

@Composable
private fun ModRow(vm: AppVm, h: ModHit) {
    val installed = vm.installedMods.any { it.projectId == h.id }
    val busy = h.id in vm.modBusy
    Panel(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(R6).background(Lx.PanelHi)) {
                if (h.icon != null) AsyncImage(h.icon, "${h.title} icon", Modifier.size(52.dp), contentScale = ContentScale.Crop)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(h.title, style = Type.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(h.desc, style = Type.bodyMuted.copy(fontSize = 12.sp, lineHeight = 16.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                Micro("${compact(h.downloads)} downloads · ${h.author}")
            }
            Box(
                Modifier.height(40.dp).clip(R6).background(if (installed) Lx.Ok.copy(alpha = 0.15f) else Lx.Accent)
                    .clickable(enabled = !installed && !busy) { vm.installMod(h) }.padding(horizontal = 14.dp),
                Alignment.Center,
            ) {
                if (installed) Icon(Icons.Rounded.Check, "Installed", tint = Lx.Ok, modifier = Modifier.size(18.dp))
                else Text(if (busy) "…" else "Install", style = Type.label.copy(color = androidx.compose.ui.graphics.Color.White))
            }
        }
    }
}

private fun compact(n: Long): String = when {
    n >= 1_000_000 -> "%.1fM".format(n / 1_000_000.0)
    n >= 1_000 -> "%.1fK".format(n / 1_000.0)
    else -> n.toString()
}
