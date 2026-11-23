package app.luminos.mobile

import android.app.Application
import app.luminos.mobile.core.Net
import coil.ImageLoader
import coil.ImageLoaderFactory
import okhttp3.OkHttpClient

/** Image loading goes through the same host allow-list as every other request. */
class LuminosApp : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader {
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val req = chain.request()
                Net.require(req.url.host)
                chain.proceed(req.newBuilder().header("User-Agent", Net.UA).build())
            }
            .build()
        return ImageLoader.Builder(this).okHttpClient(client).crossfade(200).build()
    }
}
