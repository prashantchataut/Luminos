package app.luminos.mobile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.luminos.mobile.AppVm

@Composable
fun SkinsScreen(vm: AppVm) {
    val skin = vm.skin
    var name by rememberSaveable { mutableStateOf("") }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) vm.importSkin(uri) }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().imePadding().padding(horizontal = 20.dp).padding(top = 12.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Micro("Skins")
        Text("Your skin", style = Type.title)
        Box(Modifier.fillMaxWidth().height(380.dp).clip(RoundedCornerShape(Lx.Radius))) {
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Lx.Bg0.copy(alpha = 0.55f), Lx.AccentDeep.copy(alpha = 0.35f)))))
            if (skin != null) SkinViewer(skin, Modifier.matchParentSize(), animate = !vm.settings.reduceMotion)
            Micro("Drag to turn", Modifier.align(Alignment.BottomCenter).padding(12.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(vm.account?.name ?: "", style = Type.label)
            Text(vm.account?.uuid ?: "", style = Type.mono.copy(color = Lx.AccentHi, fontSize = 11.sp))
            val src = if (vm.account?.premiumName != null) "From Mojang · ${vm.account?.premiumName}" else "Luminos default skin or imported file"
            Micro(src + if (skin?.cape != null) " · cape" else " · no cape")
        }
        Segmented(listOf("Classic arms", "Slim arms"), if (skin?.slim == true) 1 else 0, { vm.setSlim(it == 1) }, Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            LxField(name, { name = it.take(16) }, "Minecraft username", Modifier.weight(1f))
            LxButton(if (vm.skinBusy) "…" else "Load", { vm.fetchSkin(name.trim()) }, Modifier.width(88.dp), enabled = !vm.skinBusy)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            LxButton("Import PNG", { pick.launch("image/png") }, Modifier.weight(1f), primary = false)
            LxButton("Reset", { vm.resetSkin() }, Modifier.weight(1f), primary = false)
        }
        vm.skinMessage?.let { Text(it, style = Type.bodyMuted.copy(color = Lx.Ice)) }
        SeenBy()
    }
}

/** Honest answer to "where will other players see my skin?" (the #1 offline-launcher complaint). */
@Composable
private fun SeenBy() {
    Panel(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Micro("Where others will see this skin")
            Seen("Premium servers (online-mode)", "Only with a Microsoft account. Skins come from Mojang's session server, never from a launcher. Offline accounts can't join these.", false)
            Seen("Offline servers", "The server must run a skin plugin that looks skins up by name (such as SkinsRestorer). Otherwise everyone sees Steve or Alex, whatever the launcher does.", false)
            Seen("Servers using Ely.by or another authlib-injector auth", "Your skin lives on that auth server. Upload it there; Luminos will sign you in with it.", false)
            Seen("Other Luminos players", "Needs the Luminos cosmetics service, which is not deployed yet.", false)
            Text("Right now this skin is rendered in Luminos only. Nothing is uploaded anywhere.", style = Type.body.copy(color = Lx.Ice))
        }
    }
}

@Composable
private fun Seen(title: String, note: String, ok: Boolean) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.padding(top = 6.dp).size(8.dp).background(if (ok) Lx.Ok else Lx.Warn))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = Type.label)
            Text(note, style = Type.bodyMuted.copy(fontSize = 12.sp, lineHeight = 17.sp))
        }
    }
}
