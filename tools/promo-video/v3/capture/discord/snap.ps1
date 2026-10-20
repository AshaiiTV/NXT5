<#
.SYNOPSIS
  Capture PNG en pixels natifs pour le tutoriel Discord de NXT5, sans le pointeur de la souris.

.DESCRIPTION
  Enregistre la fenêtre au premier plan (par défaut) ou tout l’écran où elle se trouve dans
  tools/promo-video/v3/capture/discord/raw-local/<Name>.png, puis ajoute une ligne à snaps.jsonl dans le même dossier.
  raw-local/ est ignoré par Git : une capture brute n’est jamais publiée. Seul mask.ps1 copie une capture, masquée,
  vers public/tuto-discord/real/.
  Le processus est rendu « DPI aware » : la capture garde la définition réelle de l’écran, même avec une mise à
  l’échelle Windows de 125 % ou 150 %. La zone est limitée à l’écran de la fenêtre. Une capture existante n’est
  jamais écrasée sans -Force.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/snap.ps1 -Name dc04-salon-bot-nxt5 -Expect Discord

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/snap.ps1 -Name dc01-oauth-serveur -Mode screen -Expect chrome -Delay 6
#>
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^dc\d{2}[a-z]?-[a-z0-9-]+$')][string]$Name,
  [ValidateSet('window', 'screen')][string]$Mode = 'window',
  # Partie du nom du processus attendu au premier plan (Discord, chrome, msedge, firefox) : refuse la capture sinon.
  [string]$Expect = '',
  # Secondes d’attente avant la capture : le temps de remettre la bonne fenêtre devant et de ranger la souris.
  [int]$Delay = 2,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NxtSnap {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO info);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out RECT rect, int size);
}
'@
# DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4, before any drawing call; older Windows: system-aware.
if (-not [NxtSnap]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][NxtSnap]::SetProcessDPIAware() }
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot 'raw-local'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outDir = (Resolve-Path $outDir).Path
$file = Join-Path $outDir "$Name.png"
if ((Test-Path $file) -and -not $Force) { throw "$Name.png existe déjà. Relance avec -Force pour la remplacer." }

if ($Delay -gt 0) { Start-Sleep -Seconds $Delay }

$hwnd = [NxtSnap]::GetForegroundWindow()
$procId = [uint32]0
[void][NxtSnap]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$process = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
if ($Expect -and ($process -notlike "*$Expect*")) {
  throw "La fenêtre au premier plan appartient à « $process », pas à « $Expect ». Remets la bonne fenêtre devant (relance avec -Delay 6 si besoin), puis recommence."
}
$scale = [math]::Round([NxtSnap]::GetDpiForWindow($hwnd) / 96, 2)

# The monitor that holds the window (MONITOR_DEFAULTTONEAREST = 2): the capture never leaves it.
$mi = New-Object NxtSnap+MONITORINFO
$mi.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($mi)
if (-not [NxtSnap]::GetMonitorInfo([NxtSnap]::MonitorFromWindow($hwnd, 2), [ref]$mi)) { throw "Écran de la fenêtre introuvable." }
$m = $mi.rcMonitor

if ($Mode -eq 'window') {
  $rect = New-Object NxtSnap+RECT
  # DWMWA_EXTENDED_FRAME_BOUNDS = 9 : the visible frame, without the invisible resize borders.
  $hr = [NxtSnap]::DwmGetWindowAttribute($hwnd, 9, [ref]$rect, [Runtime.InteropServices.Marshal]::SizeOf($rect))
  if ($hr -ne 0) { throw "Impossible de lire le cadre de la fenêtre (code $hr). Essaie -Mode screen." }
  $left = [math]::Max($rect.Left, $m.Left); $top = [math]::Max($rect.Top, $m.Top)
  $x = $left; $y = $top
  $w = [math]::Min($rect.Right, $m.Right) - $left; $h = [math]::Min($rect.Bottom, $m.Bottom) - $top
} else {
  $x = $m.Left; $y = $m.Top; $w = $m.Right - $m.Left; $h = $m.Bottom - $m.Top
}
if ($w -lt 800 -or $h -lt 500) { throw "Zone trop petite (${w}x${h}). La fenêtre est-elle agrandie ?" }

$bitmap = New-Object System.Drawing.Bitmap $w, $h
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  # CopyFromScreen ne copie pas le pointeur : le montage ajoute son propre curseur.
  $graphics.CopyFromScreen($x, $y, 0, 0, $bitmap.Size)
  $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $bitmap.Dispose()
}

$entry = [ordered]@{ file = "$Name.png"; mode = $Mode; process = $process; x = $x; y = $y; width = $w; height = $h; windowsScale = $scale; at = (Get-Date).ToString('s') }
$line = $entry | ConvertTo-Json -Compress
# UTF-8 without BOM in both Windows PowerShell 5.1 and PowerShell 7 (one JSON object per line).
[IO.File]::AppendAllText((Join-Path $outDir 'snaps.jsonl'), $line + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding $false))
Write-Output $line
