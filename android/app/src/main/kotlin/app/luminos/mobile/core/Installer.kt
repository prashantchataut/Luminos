package app.luminos.mobile.core

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.atomic.AtomicLong

/**
 * Engine stage 2: Mojang's own files, verified by SHA-1, downloaded straight from Mojang's endpoints.
 * Nothing from Mojang is bundled in the APK or mirrored by us.
 */
object Installer {
    fun gameDir(ctx: Context) = File(ctx.filesDir, "game")
    fun versionDir(ctx: Context, id: String) = File(gameDir(ctx), "versions/$id")
    fun isPrepared(ctx: Context, id: String) = File(versionDir(ctx, id), ".complete").exists()

    private class Job(val url: String, val dest: File, val sha1: String, val size: Long)

    private fun allowedOnLinux(lib: JSONObject): Boolean {
        val rules = lib.optJSONArray("rules") ?: return true
        var ok = false
        for (i in 0 until rules.length()) {
            val r = rules.getJSONObject(i)
            val os = r.optJSONObject("os")?.optString("name")
            val applies = os == null || os == "linux"
            if (applies) ok = r.getString("action") == "allow"
        }
        return ok
    }

    suspend fun prepare(ctx: Context, v: McVersion, onProgress: (label: String, fraction: Float) -> Unit) =
        withContext(Dispatchers.IO) {
            onProgress("Reading version metadata", 0f)
            val meta = Net.json(v.url)
            val dir = gameDir(ctx)
            val jobs = ArrayList<Job>()

            val client = meta.getJSONObject("downloads").getJSONObject("client")
            jobs += Job(client.getString("url"), File(dir, "versions/${v.id}/${v.id}.jar"), client.getString("sha1"), client.getLong("size"))

            val libs = meta.getJSONArray("libraries")
            for (i in 0 until libs.length()) {
                val lib = libs.getJSONObject(i)
                if (!allowedOnLinux(lib)) continue
                val art = lib.optJSONObject("downloads")?.optJSONObject("artifact") ?: continue
                val path = art.getString("path")
                if (path.contains("natives-")) continue // desktop natives are useless on Android; engine stage 3 supplies its own
                jobs += Job(art.getString("url"), File(dir, "libraries/$path"), art.getString("sha1"), art.getLong("size"))
            }

            val ai = meta.getJSONObject("assetIndex")
            val aiFile = File(dir, "assets/indexes/${ai.getString("id")}.json")
            Net.download(ai.getString("url"), aiFile, "SHA-1", ai.getString("sha1"))
            val objects = JSONObject(aiFile.readText()).getJSONObject("objects")
            for (name in objects.keys()) {
                val o = objects.getJSONObject(name)
                val h = o.getString("hash")
                jobs += Job("https://resources.download.minecraft.net/${h.substring(0, 2)}/$h", File(dir, "assets/objects/${h.substring(0, 2)}/$h"), h, o.getLong("size"))
            }
            File(versionDir(ctx, v.id), "${v.id}.json").apply { parentFile?.mkdirs(); writeText(meta.toString()) }

            val total = jobs.sumOf { it.size }.coerceAtLeast(1)
            val done = AtomicLong(0)
            var last = -1
            fun report(label: String) {
                val pct = (done.get() * 1000 / total).toInt()
                if (pct != last) { last = pct; onProgress(label, pct / 1000f) }
            }
            val gate = Semaphore(6)
            coroutineScope {
                jobs.map { j ->
                    async {
                        gate.withPermit {
                            if (j.dest.exists() && j.dest.length() == j.size) {
                                done.addAndGet(j.size)
                            } else {
                                var attempt = 0
                                while (true) {
                                    try {
                                        var got = 0L
                                        Net.download(j.url, j.dest, "SHA-1", j.sha1) { n -> got += n; done.addAndGet(n.toLong()) }
                                        break
                                    } catch (e: IOException) {
                                        if (++attempt >= 3) throw e
                                    }
                                }
                            }
                            report("Downloading Minecraft ${v.id}")
                        }
                    }
                }.awaitAll()
            }
            File(versionDir(ctx, v.id), ".complete").writeText("ok")
            onProgress("Game files verified", 1f)
        }
}
