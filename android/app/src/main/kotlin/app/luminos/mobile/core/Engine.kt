package app.luminos.mobile.core

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.system.Os
import org.tukaani.xz.XZInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.TimeUnit

data class JreAsset(val abi: String, val url: String, val sha256: String, val bytes: Long)
data class EngineCheck(val ok: Boolean, val summary: String, val output: String, val millis: Long)

/**
 * Engine stage 1: a Java runtime that really boots on the device, matched to the Minecraft version
 * (Java 21 for 1.20.5 to 1.21.x, Java 25 for 26.x). The runtimes are Termux's Android (bionic) OpenJDK builds,
 * repackaged by our `android-runtimes` workflow (GPLv2 + Classpath Exception; every source .deb is SHA-256 checked
 * against the Termux index in CI). We verify the SHA-256 of the archive again here, unpack it into app-private
 * storage and run `java -version` as a child process.
 */
object Engine {
    private const val BASE = "https://github.com/prashantchataut/Luminos/releases/download/android-runtimes-v1"
    const val DEFAULT_MAJOR = 21
    val SUPPORTED_MAJORS = listOf(21, 25)

    /** abi -> major -> (sha256, bytes); values copied from SHA256SUMS-runtimes.txt of release android-runtimes-v1. */
    private val table = mapOf(
        "arm64-v8a" to mapOf(
            21 to Pair("e1586f55a1cfd894b6ddecbafc6994f5b3f8f830a053f88f6b2404a062decd3c", 40_000_348L),
            25 to Pair("dfba6deccd754d07baeb554b30f1429e491b60577a6715f4dcb05e7a037a1119", 45_936_236L),
        ),
        "x86_64" to mapOf(
            21 to Pair("195575f8305fa515ee6d9c05b0e5ac79d46858cc8048f57acba2815b56a9c095", 41_028_232L),
            25 to Pair("bf7b78e99591ec39ae0bd6510c5573cf23d841e2faaec296761271eb83376294", 47_233_592L),
        ),
    )

    /** Which Java major a Minecraft id needs when we have not read Mojang's version JSON yet. 26.x and 26w snapshots: 25. */
    fun majorForId(id: String?): Int {
        val lead = id?.takeWhile { it.isDigit() }?.toIntOrNull() ?: return DEFAULT_MAJOR
        return if (lead >= 26) 25 else DEFAULT_MAJOR
    }

    /** Authoritative: Mojang's version JSON says which Java it was built for. Older Javas run on 21; 25+ needs 25. */
    fun majorFor(meta: org.json.JSONObject): Int =
        if ((meta.optJSONObject("javaVersion")?.optInt("majorVersion", 17) ?: 17) >= 25) 25 else DEFAULT_MAJOR

    fun asset(major: Int = DEFAULT_MAJOR): JreAsset? {
        for (abi in Build.SUPPORTED_ABIS) {
            val e = table[abi]?.get(major) ?: continue
            val arch = if (abi == "arm64-v8a") "aarch64" else abi
            return JreAsset(abi, "$BASE/luminos-jre$major-$arch.tar.xz", e.first, e.second)
        }
        return null
    }

    fun home(ctx: Context, major: Int) = File(ctx.filesDir, "runtime/jre$major")
    fun javaBin(ctx: Context, major: Int): File? = File(home(ctx, major), "bin/java").takeIf { it.exists() && it.canExecute() }
    fun installed(ctx: Context, major: Int) = javaBin(ctx, major) != null

    /** Download (verified) + unpack. [onProgress] gets 0..1 across both steps. */
    @Throws(IOException::class)
    fun install(ctx: Context, major: Int, onProgress: (Float) -> Unit) {
        val a = asset(major) ?: throw IOException("No Java $major runtime for this CPU (${Build.SUPPORTED_ABIS.joinToString()}). Supported: arm64-v8a, x86_64.")
        val tar = File(ctx.cacheDir, "jre$major.tar.xz")
        var got = 0L
        Net.download(a.url, tar, "SHA-256", a.sha256) { n ->
            got += n
            onProgress(0.6f * (got.toFloat() / a.bytes).coerceAtMost(1f))
        }
        val dest = home(ctx, major)
        dest.deleteRecursively()
        dest.mkdirs()
        File(ctx.filesDir, "runtime/jre17").deleteRecursively() // 0.1.0 shipped a Java 17 runtime; it is no longer used
        val total = tar.length().toFloat()
        FileInputStream(tar).use { raw ->
            val counted = object : java.io.FilterInputStream(BufferedInputStream(raw, 1 shl 16)) {
                var n = 0L
                override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, len).also { if (it > 0) n += it }
                override fun read(): Int = super.read().also { if (it >= 0) n++ }
            }
            extractTarXz(counted, dest) { onProgress(0.6f + 0.4f * (counted.n / total).coerceAtMost(1f)) }
        }
        tar.delete()
        if (javaBin(ctx, major) == null) throw IOException("Runtime unpacked but bin/java is missing")
    }

    @Throws(IOException::class)
    fun check(ctx: Context, major: Int): EngineCheck {
        val java = javaBin(ctx, major) ?: return EngineCheck(false, "Java $major runtime not installed", "", 0)
        val h = home(ctx, major)
        val pb = ProcessBuilder(java.absolutePath, "-Xshare:off", "-XX:+UseSerialGC", "-Xmx128m", "-XshowSettings:properties", "-version")
        pb.redirectErrorStream(true)
        pb.environment()["JAVA_HOME"] = h.absolutePath
        pb.environment()["LD_LIBRARY_PATH"] = listOf("lib", "lib/server", "lib/jli").joinToString(":") { File(h, it).absolutePath }
        pb.environment()["HOME"] = ctx.filesDir.absolutePath
        pb.environment()["TMPDIR"] = ctx.cacheDir.absolutePath
        val t0 = SystemClock.elapsedRealtime()
        return try {
            val p = pb.start()
            val out = StringBuilder()
            val reader = Thread { p.inputStream.bufferedReader().forEachLine { out.appendLine(it) } }.also { it.start() }
            val finished = p.waitFor(40, TimeUnit.SECONDS)
            if (!finished) p.destroyForcibly()
            reader.join(2000)
            val ms = SystemClock.elapsedRealtime() - t0
            val text = out.toString()
            val ver = text.lineSequence().firstOrNull { it.contains("version \"") }?.trim()
            val arch = text.lineSequence().firstOrNull { it.contains("os.arch") }?.substringAfter("=")?.trim()
            if (finished && p.exitValue() == 0 && ver != null) {
                EngineCheck(true, "$ver${arch?.let { " · $it" }.orEmpty()}", text, ms)
            } else {
                EngineCheck(false, if (finished) "java exited with ${p.exitValue()}" else "java did not finish in 40 s", text, ms)
            }
        } catch (e: IOException) {
            EngineCheck(false, "Could not start java: ${e.message}", e.toString(), SystemClock.elapsedRealtime() - t0)
        }
    }

    // ---- minimal tar reader (ustar + GNU long names + PAX paths, files, dirs, symlinks) ----
    private fun readFully(ins: InputStream, buf: ByteArray, len: Int = buf.size): Boolean {
        var o = 0
        while (o < len) {
            val n = ins.read(buf, o, len - o)
            if (n < 0) return o != 0 && false
            o += n
        }
        return true
    }

    private fun cstr(b: ByteArray, off: Int, len: Int): String {
        var e = off
        while (e < off + len && b[e] != 0.toByte()) e++
        return String(b, off, e - off, Charsets.UTF_8)
    }

    private fun octal(b: ByteArray, off: Int, len: Int): Long {
        val s = cstr(b, off, len).trim()
        return if (s.isEmpty()) 0 else s.toLong(8)
    }

    private fun skip(ins: InputStream, n: Long) {
        var left = n
        val scratch = ByteArray(8192)
        while (left > 0) {
            val r = ins.read(scratch, 0, minOf(left, scratch.size.toLong()).toInt())
            if (r < 0) throw IOException("Unexpected end of archive")
            left -= r
        }
    }

    internal fun extractTarXz(compressed: InputStream, dest: File, tick: () -> Unit) {
        val root = dest.canonicalFile
        XZInputStream(compressed).use { ins ->
            val hdr = ByteArray(512)
            var longName: String? = null
            var count = 0
            while (true) {
                if (!readFully(ins, hdr)) break
                if (hdr.all { it == 0.toByte() }) break
                var name = cstr(hdr, 0, 100)
                if (cstr(hdr, 257, 5) == "ustar") {
                    val prefix = cstr(hdr, 345, 155)
                    if (prefix.isNotEmpty()) name = "$prefix/$name"
                }
                val size = octal(hdr, 124, 12)
                val mode = octal(hdr, 100, 8).toInt()
                val type = hdr[156].toInt().toChar()
                val link = cstr(hdr, 157, 100)
                val padded = (size + 511) / 512 * 512
                when (type) {
                    'L' -> {
                        val data = ByteArray(size.toInt()); readFully(ins, data); skip(ins, padded - size)
                        longName = String(data, Charsets.UTF_8).trimEnd('\u0000')
                        continue
                    }
                    'x' -> {
                        val data = ByteArray(size.toInt()); readFully(ins, data); skip(ins, padded - size)
                        String(data, Charsets.UTF_8).lineSequence().forEach { rec ->
                            val kv = rec.substringAfter(' ', "")
                            if (kv.startsWith("path=")) longName = kv.removePrefix("path=")
                        }
                        continue
                    }
                    'g' -> { skip(ins, padded); continue }
                }
                val rel = (longName ?: name).also { longName = null }.removePrefix("./").trimEnd('/')
                if (rel.isEmpty() || rel.startsWith("._") || rel.contains("/._")) { skip(ins, padded); continue }
                val target = File(root, rel).canonicalFile
                if (!target.path.startsWith(root.path + File.separator)) throw IOException("Unsafe path in archive: $rel")
                when (type) {
                    '5' -> { target.mkdirs(); skip(ins, padded) }
                    '2' -> {
                        target.parentFile?.mkdirs()
                        if (target.exists()) target.delete()
                        Os.symlink(link, target.path)
                        skip(ins, padded)
                    }
                    '0', '\u0000' -> {
                        target.parentFile?.mkdirs()
                        target.outputStream().use { out ->
                            var left = size
                            val buf = ByteArray(64 * 1024)
                            while (left > 0) {
                                val r = ins.read(buf, 0, minOf(left, buf.size.toLong()).toInt())
                                if (r < 0) throw IOException("Unexpected end of archive")
                                out.write(buf, 0, r)
                                left -= r
                            }
                        }
                        skip(ins, padded - size)
                        target.setReadable(true, false)
                        if (mode and 0b001_000_000 != 0) target.setExecutable(true, false)
                    }
                    else -> skip(ins, padded)
                }
                if (++count % 25 == 0) tick()
            }
        }
        tick()
    }
}
