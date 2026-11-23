package app.luminos.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.URLEncoder

data class ModHit(val id: String, val title: String, val desc: String, val downloads: Long, val icon: String?, val author: String)
data class ModFile(val projectId: String, val versionNumber: String, val filename: String, val url: String, val sha512: String, val requires: List<String>)
data class InstalledMod(val projectId: String, val title: String, val filename: String, val version: String)

object Modrinth {
    private const val API = "https://api.modrinth.com/v2"
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    @Throws(IOException::class)
    fun search(query: String, mc: String, loader: String, offset: Int = 0): List<ModHit> {
        val facets = JSONArray().put(JSONArray().put("project_type:mod")).put(JSONArray().put("versions:$mc"))
        if (loader != "vanilla") facets.put(JSONArray().put("categories:$loader"))
        val index = if (query.isBlank()) "downloads" else "relevance"
        val j = Net.json("$API/search?query=${enc(query)}&limit=20&offset=$offset&index=$index&facets=${enc(facets.toString())}")
        val hits = j.getJSONArray("hits")
        return (0 until hits.length()).map {
            val h = hits.getJSONObject(it)
            ModHit(h.getString("project_id"), h.getString("title"), h.optString("description"), h.optLong("downloads"),
                h.optString("icon_url").ifEmpty { null }, h.optString("author"))
        }
    }

    @Throws(IOException::class)
    fun latestFile(projectId: String, mc: String, loader: String): ModFile? {
        val q = "game_versions=${enc("[\"$mc\"]")}&loaders=${enc("[\"$loader\"]")}"
        val text = Net.text("$API/project/$projectId/version?$q")
        val arr = JSONArray(text)
        if (arr.length() == 0) return null
        val v = arr.getJSONObject(0)
        val files = v.getJSONArray("files")
        var pick: JSONObject = files.getJSONObject(0)
        for (i in 0 until files.length()) if (files.getJSONObject(i).optBoolean("primary")) pick = files.getJSONObject(i)
        val deps = v.optJSONArray("dependencies") ?: JSONArray()
        val req = (0 until deps.length()).map { deps.getJSONObject(it) }
            .filter { it.optString("dependency_type") == "required" && it.optString("project_id").isNotEmpty() }
            .map { it.getString("project_id") }
        return ModFile(projectId, v.getString("version_number"), pick.getString("filename"), pick.getString("url"),
            pick.getJSONObject("hashes").getString("sha512"), req)
    }

    @Throws(IOException::class)
    fun title(projectId: String): String = Net.json("$API/project/$projectId").optString("title", projectId)

    // ---- per-instance bookkeeping: instances/<id>/mods/ + mods.json ----
    private fun modsDir(root: File) = File(root, "mods")
    private fun index(root: File) = File(root, "mods.json")

    fun installed(root: File): List<InstalledMod> = try {
        val a = JSONArray(index(root).readText())
        (0 until a.length()).map { val o = a.getJSONObject(it); InstalledMod(o.getString("id"), o.getString("title"), o.getString("file"), o.getString("version")) }
            .filter { File(modsDir(root), it.filename).exists() }
    } catch (e: Exception) { emptyList() }

    private fun write(root: File, list: List<InstalledMod>) {
        root.mkdirs()
        index(root).writeText(JSONArray().apply {
            list.forEach { put(JSONObject().put("id", it.projectId).put("title", it.title).put("file", it.filename).put("version", it.version)) }
        }.toString())
    }

    /** Installs the mod and its required dependencies (depth-limited), verifying SHA-512 of every jar. Returns what was added. */
    @Throws(IOException::class)
    fun install(root: File, projectId: String, mc: String, loader: String, depth: Int = 0): List<InstalledMod> {
        val have = installed(root).toMutableList()
        if (have.any { it.projectId == projectId }) return emptyList()
        val f = latestFile(projectId, mc, loader) ?: throw IOException("No $loader build for Minecraft $mc")
        val added = ArrayList<InstalledMod>()
        if (depth < 3) f.requires.forEach { added += install(root, it, mc, loader, depth + 1) }
        Net.download(f.url, File(modsDir(root), f.filename), "SHA-512", f.sha512)
        val m = InstalledMod(projectId, title(projectId), f.filename, f.versionNumber)
        write(root, installed(root) + m)
        added += m
        return added
    }

    fun remove(root: File, projectId: String) {
        val cur = installed(root)
        cur.filter { it.projectId == projectId }.forEach { File(modsDir(root), it.filename).delete() }
        write(root, cur.filter { it.projectId != projectId })
    }
}
