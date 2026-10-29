#define InstallArch AppArch == "arm64" ? "arm64" : "x64compatible"

[Setup]
AppId=vestige.lixue
AppName=Vestige
AppVersion={#AppVersion}
DefaultDirName={autopf}\Vestige
ArchitecturesAllowed={#InstallArch}
ArchitecturesInstallIn64BitMode={#InstallArch}
MinVersion=10.0
OutputDir=..\dist\release
OutputBaseFilename=vestige-{#AppVersion}-{#AppArch}-setup
SetupIconFile=..\resources\logos\logo-square-black.ico
UninstallDisplayName=Vestige
UninstallDisplayIcon={app}\vestige.exe

[Files]
Source: "{#AppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Vestige"; Filename: "{app}\vestige.exe"