package app.luminos.mobile.core

import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

data class HostRule(val host: String, val purpose: String, val sends: String)

/**
 * Every outbound request passes through [require]: hosts that are not in [registry] are refused,
 * plain HTTP is upgraded to HTTPS, and each redirect hop is checked again. The Settings screen
 * renders this same list with live request counts. No ads, no analytics.
 */
object Net {
    const val UA = "Luminos-Mobile/0.1 (+https://github.com/prashantchataut/Luminos)"

    val registry: List<HostRule> = listOf(
        HostRule("piston-meta.mojang.com", "Minecraft version list and per-version metadata", "nothing but the URL"),
        HostRule("piston-data.mojang.com", "Minecraft client jar", "nothing but the URL"),
        HostRule("libraries.minecraft.net", "Minecraft libraries", "nothing but the URL"),
        HostRule("resources.download.minecraft.net", "Minecraft sounds, language files and other assets", "nothing but the URL"),
        HostRule("launchercontent.mojang.com", "Official per-version artwork shown on instance cards", "nothing but the URL"),
        HostRule("api.mojang.com", "Look up a premium username (only when you ask for your skin)", "the username you typed"),
        HostRule("sessionserver.mojang.com", "Fetch that account's skin and cape (only when you ask)", "the profile id"),
        HostRule("textures.minecraft.net", "Skin and cape image files", "nothing but the URL"),
        HostRule("api.modrinth.com", "Mod search and versions", "your search text, game version, loader"),
        HostRule("cdn.modrinth.com", "Mod jars and mod icons", "nothing but the URL"),
        HostRule("github.com", "Java runtime download (OpenJDK build for Android)", "nothing but the URL"),
        HostRule("release-assets.githubusercontent.com", "GitHub's download CDN for the runtime", "nothing but the URL"),
        HostRule("objects.githubusercontent.com", "GitHub's download CDN for the runtime", "nothing but the URL"),
    )

    private val counts = ConcurrentHashMap<String, AtomicInteger>()
    fun requestCount(host: String): Int = counts[host]?.get() ?: 0

    @Throws(IOException::class)
    fun require(host: String) {
        if (registry.none { it.host == host }) throw IOException("Blocked: $host is not on Luminos' host list")
        counts.getOrPut(host) { AtomicInteger() }.incrementAndGet()
    }

    @Throws(IOException::class)
    fun open(url: String, headers: Map<String, String> = emptyMap(), timeoutMs: Int = 25_000): HttpURLConnection {
        var current = url
        for (hop in 0..6) {
            if (current.startsWith("http://")) current = "https://" + current.removePrefix("http://")
            val u = URL(current)
            require(u.host)
            val c = u.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = timeoutMs
            c.readTimeout = timeoutMs
            c.setRequestProperty("User-Agent", UA)
            headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
            val code = c.responseCode
            if (code in 300..399) {
                val loc = c.getHeaderField("Location") ?: throw IOException("Redirect without Location")
                c.disconnect()
                current = URL(u, loc).toString()
                continue
            }
            if (code !in 200..299) {
                c.disconnect()
                throw IOException("HTTP $code from ${u.host}")
            }
            return c
        }
        throw IOException("Too many redirects")
    }

    @Throws(IOException::class)
    fun bytes(url: String, headers: Map<String, String> = emptyMap()): ByteArray {
        val c = open(url, headers)
        try {
            return c.inputStream.use { it.readBytes() }
        } finally {
            c.disconnect()
        }
    }

    @Throws(IOException::class)
    fun text(url: String, headers: Map<String, String> = emptyMap()): String =
        String(bytes(url, headers), Charsets.UTF_8)

    @Throws(IOException::class)
    fun json(url: String): JSONObject =
        try {
            JSONObject(text(url))
        } catch (e: org.json.JSONException) {
            throw IOException("Unexpected response from $url", e)
        }

    /** Streams to a .part file, verifies the digest when given, then moves into place. */
    @Throws(IOException::class)
    fun download(
        url: String,
        dest: File,
        algo: String? = null,
        expect: String? = null,
        onBytes: (Int) -> Unit = {},
    ) {
        dest.parentFile?.mkdirs()
        val tmp = File(dest.path + ".part")
        val md = algo?.let { MessageDigest.getInstance(it) }
        val c = open(url)
        try {
            c.inputStream.use { ins ->
                tmp.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = ins.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        md?.update(buf, 0, n)
                        onBytes(n)
                    }
                }
            }
        } finally {
            c.disconnect()
        }
        if (md != null && expect != null) {
            val got = md.digest().joinToString("") { "%02x".format(it) }
            if (!got.equals(expect, ignoreCase = true)) {
                tmp.delete()
                throw IOException("Checksum mismatch for ${dest.name}")
            }
        }
        if (dest.exists()) dest.delete()
        if (!tmp.renameTo(dest)) throw IOException("Could not move ${dest.name} into place")
    }
}
