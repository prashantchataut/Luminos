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
 * Engine stage 1: a Java runtime that really boots on the device. We download an OpenJDK 17 build for
 * Android (GPLv2 + Classpath Exception, built by the PojavLauncher team's public CI), verify its SHA-256,
 * unpack it into app-private storage and run `java -version` as a child process.
 */
object Engine {
    private const val BASE = "https://github.com/PojavLauncherTeam/android-openjdk-build-multiarch/releases/download/jre17-ec28559"

    fun asset(): JreAsset? {
        for (abi in Build.SUPPORTED_ABIS) {
            when (abi) {
                "arm64-v8a" -> return JreAsset(abi, "$BASE/jre17-arm64-20210825-release.tar.xz",
                    "c64583ac2e0ec8857e43456fa9adcf482c6a8e454a7133173bf15692d2478b8d", 38_065_004)
                "x86_64" -> return JreAsset(abi, "$BASE/jre17-x86_64-20210825-release.tar.xz",
                    "ebbdf75ab864a83671a108032c30e67174f79cc19596cfc1d7bfb71be26b6e71", 39_230_848)
            }
        }
        return null
    }

    fun home(ctx: Context) = File(ctx.filesDir, "runtime/jre17")
    fun javaBin(ctx: Context): File? = File(home(ctx), "bin/java").takeIf { it.exists() && it.canExecute() }
    fun installed(ctx: Context) = javaBin(ctx) != null

    /** Download (verified) + unpack. [onProgress] gets 0..1 across both steps. */
    @Throws(IOException::class)
    fun install(ctx: Context, onProgress: (Float) -> Unit) {
        val a = asset() ?: throw IOException("No Java runtime for this CPU (${Build.SUPPORTED_ABIS.joinToString()}). Supported: arm64-v8a, x86_64.")
        val tar = File(ctx.cacheDir, "jre17.tar.xz")
        var got = 0L
        Net.download(a.url, tar, "SHA-256", a.sha256) { n ->
            got += n
            onProgress(0.6f * (got.toFloat() / a.bytes).coerceAtMost(1f))
        }
        val dest = home(ctx)
        dest.deleteRecursively()
        dest.mkdirs()
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
        if (javaBin(ctx) == null) throw IOException("Runtime unpacked but bin/java is missing")
    }

    @Throws(IOException::class)
    fun check(ctx: Context): EngineCheck {
        val java = javaBin(ctx) ?: return EngineCheck(false, "Runtime not installed", "", 0)
        val h = home(ctx)
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
