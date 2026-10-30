#define InstallArch AppArch == "arm64" ? "arm64" : "x64compatible"

[Setup]
AppId=vestige.lixue
AppName=Vestige
AppVersion={#AppVersion}
DefaultDirName={autopf}\Vestige
DefaultGroupName=Vestige
LicenseFile=..\LICENSE
ArchitecturesAllowed={#InstallArch}
ArchitecturesInstallIn64BitMode={#InstallArch}
MinVersion=10.0
OutputDir=..\dist\release
OutputBaseFilename=vestige-{#AppVersion}-{#AppArch}-setup
SetupIconFile=..\resources\logos\logo-square-black.ico
UninstallDisplayName=Vestige
UninstallDisplayIcon={app}\vestige.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "inno-languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#AppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Vestige"; Filename: "{app}\vestige.exe"
Name: "{autodesktop}\Vestige"; Filename: "{app}\vestige.exe"; Tasks: desktopicon

#include "inno-uninstall.iss"