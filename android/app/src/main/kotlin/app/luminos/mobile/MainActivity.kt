package app.luminos.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import app.luminos.mobile.ui.App
import app.luminos.mobile.ui.LuminosTheme

class MainActivity : ComponentActivity() {
    private val vm: AppVm by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) handle(intent)
        setContent { LuminosTheme { App(vm) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** CI/automation extras. They drive the same code paths a user does (tab switch, real onboarding, real engine install). */
    private fun handle(i: Intent?) {
        i ?: return
        i.getStringExtra("lx_tab")?.let { t -> Tab.entries.firstOrNull { it.name.equals(t, true) }?.let { vm.tab = it } }
        if (i.hasExtra("lx_step")) vm.onbStep = i.getIntExtra("lx_step", 0)
        i.getStringExtra("lx_autotest")?.let { vm.autotest(it, i.getBooleanExtra("lx_engine", false)) }
    }
}
