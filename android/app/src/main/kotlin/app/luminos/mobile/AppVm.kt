package app.luminos.mobile

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.luminos.mobile.core.Account
import app.luminos.mobile.core.EngineCheck
import app.luminos.mobile.core.Engine
import app.luminos.mobile.core.Installer
import app.luminos.mobile.core.Instance
import app.luminos.mobile.core.InstalledMod
import app.luminos.mobile.core.McVersion
import app.luminos.mobile.core.ModHit
import app.luminos.mobile.core.Modrinth
import app.luminos.mobile.core.Mojang
import app.luminos.mobile.core.Net
import app.luminos.mobile.core.Offline
import app.luminos.mobile.core.Persisted
import app.luminos.mobile.core.Settings
import app.luminos.mobile.core.SkinData
import app.luminos.mobile.core.Skins
import app.luminos.mobile.core.Store
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException

enum class Tab { Home, Library, Skins, Settings }

sealed interface Launch {
    data object Ready : Launch
    data class Working(val label: String, val progress: Float) : Launch
    data object Verified : Launch
    data class Failed(val message: String) : Launch
}

private val NAME_RE = Regex("^[A-Za-z0-9_]{3,16}$")
fun validName(n: String) = NAME_RE.matches(n)

class AppVm(app: Application) : AndroidViewModel(app) {
    private val ctx get() = getApplication<Application>()
    private val dir get() = ctx.filesDir

    var loaded by mutableStateOf(false)
    var onboarded by mutableStateOf(false)
    var onbStep by mutableIntStateOf(0)
    var account by mutableStateOf<Account?>(null)
    var instances by mutableStateOf<List<Instance>>(emptyList())
    var selectedId by mutableStateOf<String?>(null)
    var settings by mutableStateOf(Settings())
    var skin by mutableStateOf<SkinData?>(null)
    var tab by mutableStateOf(Tab.Home)

    var versions by mutableStateOf<List<McVersion>>(emptyList())
    var latestRelease by mutableStateOf<String?>(null)
    var covers by mutableStateOf<Map<String, String>>(emptyMap())
    var catalogLoading by mutableStateOf(true)
    var catalogError by mutableStateOf<String?>(null)

    var launch by mutableStateOf<Launch>(Launch.Ready)
    var jreInstalled by mutableStateOf(false)
    var engineCheck by mutableStateOf<EngineCheck?>(null)
    var engineBusy by mutableStateOf<String?>(null)

    var skinBusy by mutableStateOf(false)
    var skinMessage by mutableStateOf<String?>(null)

    var modResults by mutableStateOf<List<ModHit>>(emptyList())
    var modsLoading by mutableStateOf(false)
    var modsError by mutableStateOf<String?>(null)
    var installedMods by mutableStateOf<List<InstalledMod>>(emptyList())
    var modBusy by mutableStateOf<Set<String>>(emptySet())

    var toast by mutableStateOf<String?>(null)

    val selected: Instance? get() = instances.firstOrNull { it.id == selectedId }
    /** Java major the selected instance needs (heuristic until Mojang's version JSON is read in [prepare]). */
    val javaMajor: Int get() = Engine.majorForId(selected?.mc)

    init {
        viewModelScope.launch {
            val p = withContext(Dispatchers.IO) { Store.load(dir) }
            onboarded = p.onboarded; account = p.account; instances = p.instances
            selectedId = p.selected ?: p.instances.firstOrNull()?.id; settings = p.settings
            withContext(Dispatchers.IO) { reloadSkin() }
            jreInstalled = Engine.installed(ctx, javaMajor)
            refreshLaunch(); refreshMods()
            loaded = true
            loadCatalog()
        }
    }

    private fun persist() {
        val p = Persisted(onboarded, account, instances, selectedId, settings)
        viewModelScope.launch(Dispatchers.IO) { Store.save(dir, p) }
    }

    fun loadCatalog() {
        catalogLoading = true; catalogError = null
        viewModelScope.launch {
            try {
                val v = async(Dispatchers.IO) { Mojang.versions() }
                val c = async(Dispatchers.IO) { try { Mojang.coverArt() } catch (e: IOException) { emptyMap() } }
                val (latest, list) = v.await()
                latestRelease = latest; versions = list; covers = c.await()
            } catch (e: Exception) {
                catalogError = e.message ?: "Could not reach Mojang"
            } finally {
                catalogLoading = false
            }
        }
    }

    /** Official artwork for a version; falls back to the same major.minor line (e.g. 1.21.4 -> 1.21). */
    fun coverFor(mc: String): String? {
        covers[mc]?.let { return it }
        var p = mc
        while ('.' in p) { p = p.substringBeforeLast('.'); covers[p]?.let { return it } }
        return covers.entries.firstOrNull { it.key.startsWith("$mc-") || it.key.startsWith("$mc.") }?.value
    }

    fun toast(msg: String) { toast = msg }

    // ---------- settings ----------
    fun setReduceMotion(v: Boolean) { settings = settings.copy(reduceMotion = v); persist() }
    fun setHaptics(v: Boolean) { settings = settings.copy(haptics = v); persist() }

    // ---------- skin ----------
    private fun skinFile() = File(dir, "skins/skin.png")
    private fun capeFile() = File(dir, "skins/cape.png")

    private fun reloadSkin() {
        val sf = skinFile()
        val bmp = if (sf.exists()) BitmapFactory.decodeFile(sf.path) else null
        val cape = if (capeFile().exists()) BitmapFactory.decodeFile(capeFile().path) else null
        skin = if (bmp != null) {
            val n = Skins.normalize(bmp)
            SkinData(n, account?.slimOverride ?: Skins.detectSlim(n), cape)
        } else SkinData(Skins.defaultSkin(), false, cape)
    }

    private fun savePng(b: Bitmap, f: File) {
        f.parentFile?.mkdirs()
        val out = ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.PNG, 100, out); f.writeBytes(out.toByteArray())
    }

    /** Real Mojang lookup: username -> profile -> textures -> skin/cape PNGs. */
    suspend fun fetchPremiumSkin(name: String): String = withContext(Dispatchers.IO) {
        val prof = Mojang.profile(name) ?: return@withContext "No Minecraft account is named \"$name\"."
        val tex = Mojang.textures(prof.uuid)
        val skinUrl = tex.skinUrl ?: return@withContext "${prof.name} has no custom skin."
        val sbytes = Net.bytes(skinUrl)
        val sb = BitmapFactory.decodeByteArray(sbytes, 0, sbytes.size) ?: return@withContext "Mojang returned an unreadable skin."
        savePng(Skins.normalize(sb), skinFile())
        if (tex.capeUrl != null) {
            val cb = Net.bytes(tex.capeUrl)
            BitmapFactory.decodeByteArray(cb, 0, cb.size)?.let { savePng(it, capeFile()) }
        } else capeFile().delete()
        account = account?.copy(premiumName = prof.name, slimOverride = tex.slim)
        reloadSkin(); persist()
        "Loaded ${prof.name}'s skin${if (tex.capeUrl != null) " and cape" else ""} from Mojang."
    }

    fun fetchSkin(name: String) {
        if (!validName(name)) { skinMessage = "Usernames are 3-16 letters, numbers or underscores."; return }
        skinBusy = true; skinMessage = null
        viewModelScope.launch {
            skinMessage = try { fetchPremiumSkin(name) } catch (e: Exception) { "Could not reach Mojang: ${e.message}" }
            skinBusy = false
        }
    }

    fun importSkin(uri: Uri) {
        viewModelScope.launch {
            skinMessage = try {
                withContext(Dispatchers.IO) {
                    val bytes = ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IOException("Cannot read that file")
                    val b = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw IOException("That is not a PNG image")
                    if (b.width != b.height * 2 && b.width != b.height) throw IOException("Skins are 64x64 or 64x32 (or an HD multiple). This image is ${b.width}x${b.height}.")
                    val n = Skins.normalize(b)
                    savePng(n, skinFile())
                    account = account?.copy(slimOverride = Skins.detectSlim(n))
                    reloadSkin(); persist()
                }
                "Skin imported. Arm model: ${if (skin?.slim == true) "slim" else "classic"} (detected)."
            } catch (e: Exception) { e.message ?: "Import failed" }
        }
    }

    fun setSlim(slim: Boolean) { account = account?.copy(slimOverride = slim); skin = skin?.let { SkinData(it.bitmap, slim, it.cape) }; persist() }

    fun resetSkin() {
        skinFile().delete(); capeFile().delete()
        account = account?.copy(premiumName = null, slimOverride = null)
        reloadSkin(); persist(); skinMessage = "Back to the Luminos default skin."
    }

    // ---------- onboarding / account ----------
    fun createAccount(name: String, wantPremiumSkin: Boolean, onDone: () -> Unit) {
        val latest = latestRelease ?: return
        viewModelScope.launch {
            account = Account(name, Offline.uuid(name).toString(), null, null)
            if (wantPremiumSkin) { skinMessage = try { fetchPremiumSkin(name) } catch (e: Exception) { "Could not load your skin: ${e.message}" } }
            if (instances.isEmpty()) createInstance("Minecraft $latest", latest, "vanilla")
            onboarded = true; persist(); onDone()
        }
    }

    fun renameAccount(name: String) {
        account = Account(name, Offline.uuid(name).toString(), account?.premiumName, account?.slimOverride); persist()
    }

    // ---------- instances ----------
    fun createInstance(name: String, mc: String, loader: String) {
        val inst = Instance("i" + System.currentTimeMillis().toString(36), name.ifBlank { "Minecraft $mc" }, mc, loader, System.currentTimeMillis())
        instances = instances + inst; selectedId = inst.id; persist(); refreshLaunch(); refreshMods()
    }

    fun select(id: String) { selectedId = id; persist(); refreshLaunch(); refreshMods(); modResults = emptyList() }

    fun deleteInstance(id: String) {
        instances = instances.filter { it.id != id }
        File(dir, "instances/$id").deleteRecursively()
        if (selectedId == id) selectedId = instances.firstOrNull()?.id
        persist(); refreshLaunch(); refreshMods()
    }

    fun setLoader(id: String, loader: String) {
        instances = instances.map { if (it.id == id) it.copy(loader = loader) else it }; persist(); modResults = emptyList()
    }

    // ---------- engine ----------
    private var engineMajor = 0

    fun refreshLaunch() {
        val i = selected
        jreInstalled = Engine.installed(ctx, javaMajor)
        if (engineMajor != javaMajor) engineCheck = null // a check for another Java major says nothing about this instance
        launch = if (i != null && Installer.isPrepared(ctx, i.mc) && engineCheck?.ok == true) Launch.Verified else Launch.Ready
    }

    /** Stage 1 + 2 + boot check for the selected instance. */
    fun prepare() {
        val inst = selected ?: return
        if (launch is Launch.Working) return
        viewModelScope.launch {
            try {
                launch = Launch.Working("Preparing", 0f)
                val ver = versions.firstOrNull { it.id == inst.mc } ?: throw IOException("Minecraft ${inst.mc} is not in Mojang's manifest (offline?)")
                val major = withContext(Dispatchers.IO) { Engine.majorFor(Net.json(ver.url)) }
                if (!Engine.installed(ctx, major)) {
                    withContext(Dispatchers.IO) { Engine.install(ctx, major) { p -> launch = Launch.Working("Downloading Java $major runtime", p * 0.2f) } }
                }
                jreInstalled = true
                Installer.prepare(ctx, ver) { label, f -> launch = Launch.Working(label, 0.2f + f * 0.7f) }
                launch = Launch.Working("Booting Java $major", 0.93f)
                val chk = withContext(Dispatchers.IO) { Engine.check(ctx, major) }
                engineMajor = major
                engineCheck = chk
                launch = if (chk.ok) Launch.Verified else Launch.Failed(chk.summary)
            } catch (e: Exception) {
                launch = Launch.Failed(e.message ?: e.toString())
            }
        }
    }

    fun installRuntime() {
        if (engineBusy != null) return
        viewModelScope.launch {
            try {
                engineBusy = "Downloading runtime 0%"
                withContext(Dispatchers.IO) { Engine.install(ctx, javaMajor) { p -> engineBusy = "Downloading Java $javaMajor ${(p * 100).toInt()}%" } }
                jreInstalled = true
                runCheck()
            } catch (e: Exception) {
                toast("Runtime install failed: ${e.message}")
            } finally { engineBusy = null }
        }
    }

    fun runEngineCheck() {
        if (engineBusy != null) return
        viewModelScope.launch { engineBusy = "Booting JVM"; runCheck(); engineBusy = null }
    }

    private suspend fun runCheck() {
        val chk = withContext(Dispatchers.IO) { Engine.check(ctx, javaMajor) }
        engineMajor = javaMajor
        engineCheck = chk
        Log.i("Luminos", (if (chk.ok) "LUMINOS_ENGINE_OK " else "LUMINOS_ENGINE_FAIL ") + chk.summary + " in ${chk.millis} ms")
        if (!chk.ok) Log.w("Luminos", chk.output)
        refreshLaunch()
    }

    /** CI hook (intent extras): run the real onboarding + real engine install, then report through logcat. */
    fun autotest(name: String, engine: Boolean) {
        viewModelScope.launch {
            while (!loaded || catalogLoading) kotlinx.coroutines.delay(200)
            if (!onboarded && validName(name)) {
                var done = false
                createAccount(name, true) { done = true }
                while (!done) kotlinx.coroutines.delay(200)
            }
            if (engine) {
                try {
                    if (!Engine.installed(ctx, javaMajor)) withContext(Dispatchers.IO) { Engine.install(ctx, javaMajor) { } }
                    jreInstalled = true
                } catch (e: Exception) { Log.e("Luminos", "LUMINOS_ENGINE_FAIL install: ${e.message}") }
                runCheck()
            }
        }
    }

    // ---------- mods ----------
    private fun root(i: Instance) = File(dir, "instances/${i.id}")

    fun refreshMods() { installedMods = selected?.let { Modrinth.installed(root(it)) } ?: emptyList() }

    fun searchMods(q: String) {
        val inst = selected ?: return
        modsLoading = true; modsError = null
        viewModelScope.launch {
            try { modResults = withContext(Dispatchers.IO) { Modrinth.search(q, inst.mc, inst.loader) } }
            catch (e: Exception) { modsError = e.message ?: "Search failed" }
            modsLoading = false
        }
    }

    fun installMod(hit: ModHit) {
        val inst = selected ?: return
        if (hit.id in modBusy) return
        modBusy = modBusy + hit.id
        viewModelScope.launch {
            try {
                val added = withContext(Dispatchers.IO) { Modrinth.install(root(inst), hit.id, inst.mc, inst.loader) }
                refreshMods()
                toast(if (added.size > 1) "Installed ${hit.title} and ${added.size - 1} required mod(s)" else "Installed ${hit.title}")
            } catch (e: Exception) { toast("${hit.title}: ${e.message}") }
            modBusy = modBusy - hit.id
        }
    }

    fun removeMod(m: InstalledMod) {
        val inst = selected ?: return
        Modrinth.remove(root(inst), m.projectId); refreshMods()
    }
}
