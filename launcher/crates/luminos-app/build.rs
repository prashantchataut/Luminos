// Embeds the Luminos icon + version info into luminos.exe on Windows builds.
fn main() {
    println!("cargo:rerun-if-changed=assets/luminos.ico");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("assets/luminos.ico");
        res.set("ProductName", "Luminos Launcher");
        res.set("FileDescription", "Luminos Launcher");
        res.set("CompanyName", "Luminos");
        res.set("LegalCopyright", "GPL-3.0-or-later");
        if let Err(e) = res.compile() {
            println!("cargo:warning=could not embed Windows resources: {e}");
        }
    }
}
