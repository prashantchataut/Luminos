package app.luminos.mobile.core

import android.util.Base64
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException

data class McVersion(val id: String, val type: String, val url: String)
data class Profile(val uuid: String, val name: String)
data class Textures(val skinUrl: String?, val slim: Boolean, val capeUrl: String?)

object Mojang {
    private const val MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"

    /** (latest release id, every version newest first) */
    @Throws(IOException::class)
    fun versions(): Pair<String, List<McVersion>> {
        val j = Net.json(MANIFEST)
        val arr = j.getJSONArray("versions")
        val out = ArrayList<McVersion>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out += McVersion(o.getString("id"), o.getString("type"), o.getString("url"))
        }
        return j.getJSONObject("latest").getString("release") to out
    }

    /** Official artwork Mojang publishes for each version in its launcher patch-notes feed. */
    @Throws(IOException::class)
    fun coverArt(): Map<String, String> {
        val e = Net.json("https://launchercontent.mojang.com/v2/javaPatchNotes.json").getJSONArray("entries")
        val map = LinkedHashMap<String, String>()
        for (i in 0 until e.length()) {
            val o = e.getJSONObject(i)
            val v = o.optString("version")
            val img = o.optJSONObject("image")?.optString("url").orEmpty()
            if (v.isNotEmpty() && img.startsWith("/")) map.putIfAbsent(v, "https://launchercontent.mojang.com$img")
        }
        return map
    }

    /** null when the name does not exist; throws IOException when the network fails. */
    @Throws(IOException::class)
    fun profile(name: String): Profile? {
        return try {
            val j = Net.json("https://api.mojang.com/users/profiles/minecraft/$name")
            Profile(j.getString("id"), j.getString("name"))
        } catch (e: IOException) {
            val m = e.message.orEmpty()
            if (m.startsWith("HTTP 404") || m.startsWith("HTTP 204") || e.cause is JSONException) null else throw e
        }
    }

    @Throws(IOException::class)
    fun textures(uuid: String): Textures {
        val j = Net.json("https://sessionserver.mojang.com/session/minecraft/profile/$uuid")
        val props = j.getJSONArray("properties")
        for (i in 0 until props.length()) {
            val p = props.getJSONObject(i)
            if (p.getString("name") != "textures") continue
            val decoded = String(Base64.decode(p.getString("value"), Base64.DEFAULT), Charsets.UTF_8)
            val t = JSONObject(decoded).getJSONObject("textures")
            val skin = t.optJSONObject("SKIN")
            val cape = t.optJSONObject("CAPE")
            return Textures(
                skinUrl = skin?.optString("url"),
                slim = skin?.optJSONObject("metadata")?.optString("model") == "slim",
                capeUrl = cape?.optString("url"),
            )
        }
        return Textures(null, false, null)
    }
}
