package app.luminos.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Account(val name: String, val uuid: String, val premiumName: String?, val slimOverride: Boolean?)
data class Instance(val id: String, val name: String, val mc: String, val loader: String, val createdAt: Long)
data class Settings(val reduceMotion: Boolean = false, val haptics: Boolean = true)
data class Persisted(
    val onboarded: Boolean = false,
    val account: Account? = null,
    val instances: List<Instance> = emptyList(),
    val selected: String? = null,
    val settings: Settings = Settings(),
)

/** One small JSON file, written atomically. Nothing sensitive is stored: offline accounts have no tokens. */
object Store {
    private fun file(dir: File) = File(dir, "state.json")

    fun load(dir: File): Persisted = try {
        val j = JSONObject(file(dir).readText())
        val acc = j.optJSONObject("account")?.let {
            Account(
                it.getString("name"), it.getString("uuid"),
                it.optString("premiumName").ifEmpty { null },
                if (it.has("slim")) it.getBoolean("slim") else null,
            )
        }
        val inst = j.optJSONArray("instances") ?: JSONArray()
        val list = (0 until inst.length()).map {
            val o = inst.getJSONObject(it)
            Instance(o.getString("id"), o.getString("name"), o.getString("mc"), o.getString("loader"), o.optLong("createdAt"))
        }
        val s = j.optJSONObject("settings")
        Persisted(
            j.optBoolean("onboarded"), acc, list, j.optString("selected").ifEmpty { null },
            Settings(s?.optBoolean("reduceMotion") ?: false, s?.optBoolean("haptics", true) ?: true),
        )
    } catch (e: Exception) {
        Persisted()
    }

    fun save(dir: File, p: Persisted) {
        val j = JSONObject()
        j.put("onboarded", p.onboarded)
        p.account?.let {
            j.put(
                "account",
                JSONObject().put("name", it.name).put("uuid", it.uuid)
                    .apply { it.premiumName?.let { n -> put("premiumName", n) }; it.slimOverride?.let { s -> put("slim", s) } },
            )
        }
        j.put(
            "instances",
            JSONArray().apply {
                p.instances.forEach {
                    put(JSONObject().put("id", it.id).put("name", it.name).put("mc", it.mc).put("loader", it.loader).put("createdAt", it.createdAt))
                }
            },
        )
        p.selected?.let { j.put("selected", it) }
        j.put("settings", JSONObject().put("reduceMotion", p.settings.reduceMotion).put("haptics", p.settings.haptics))
        dir.mkdirs()
        val tmp = File(dir, "state.json.tmp")
        tmp.writeText(j.toString())
        tmp.renameTo(file(dir))
    }
}
