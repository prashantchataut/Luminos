; Luminos Launcher — Windows installer (Inno Setup 6)
; Build: iscc /DAppVersion=0.2.0 installer\luminos.iss   (expects target\release\luminos.exe)
#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif
#ifndef BinDir
  #define BinDir "..\launcher\target\release"
#endif

[Setup]
AppId={{6E1B6C2A-2B7D-4F0B-9C55-1D0A4C7E10A1}
AppName=Luminos
AppVersion={#AppVersion}
AppVerName=Luminos {#AppVersion}
AppPublisher=Luminos
AppPublisherURL=https://github.com/prashantchataut/Luminos
AppSupportURL=https://github.com/prashantchataut/Luminos/issues
AppUpdatesURL=https://github.com/prashantchataut/Luminos/releases
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\Luminos
DefaultGroupName=Luminos
; Per-user install by default: no admin prompt, no UAC. Users can still choose "all users".
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\dist
OutputBaseFilename=Luminos-Setup
SetupIconFile=..\brand\luminos.ico
UninstallDisplayIcon={app}\luminos.exe
WizardStyle=modern
WizardImageFile=..\brand\wizard-side.bmp
WizardSmallImageFile=..\brand\wizard-small.bmp
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
CloseApplications=yes
LicenseFile=..\LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "{#BinDir}\luminos.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Luminos"; Filename: "{app}\luminos.exe"
Name: "{autodesktop}\Luminos"; Filename: "{app}\luminos.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\luminos.exe"; Description: "Launch Luminos"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Game data (instances, worlds, accounts) lives in %APPDATA%\Luminos and is deliberately kept.
Type: filesandordirs; Name: "{app}"
