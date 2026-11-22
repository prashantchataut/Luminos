// Embeds icon, version info and an application manifest into luminos.exe on Windows builds.
// A proper manifest + complete version resource is one of the signals that make an executable
// look like a normal desktop app to Windows SmartScreen / Defender heuristics.
fn main() {
    println!("cargo:rerun-if-changed=assets/luminos.ico");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("assets/luminos.ico");
        res.set("ProductName", "Luminos");
        res.set("FileDescription", "Luminos — Minecraft launcher");
        res.set("CompanyName", "Luminos");
        res.set("InternalName", "luminos");
        res.set("OriginalFilename", "luminos.exe");
        res.set(
            "LegalCopyright",
            "Copyright (c) 2026 Luminos. All rights reserved.",
        );
        res.set_manifest(
            r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security><requestedPrivileges>
      <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
    </requestedPrivileges></security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
</assembly>"#,
        );
        if let Err(e) = res.compile() {
            println!("cargo:warning=could not embed Windows resources: {e}");
        }
    }
}
