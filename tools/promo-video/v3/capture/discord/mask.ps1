<#
.SYNOPSIS
  Masque les zones privées d’une capture brute et la publie pour le montage du tutoriel Discord de NXT5.

.DESCRIPTION
  Lit capture/discord/raw-local/<Name>.png (capture brute de snap.ps1, jamais publiée), recouvre chaque rectangle
  d’un aplat opaque magenta (#FF00FF : le montage le retrouve et le remplace par un cache soigné), puis écrit
  public/tuto-discord/real/<Name>.png et enregistre les rectangles dans public/tuto-discord/real/masks.json.
  C’est le seul chemin d’une capture vers le dossier publié. -Rects est en pixels de la PNG brute :
  « x,y,largeur,hauteur:raison », plusieurs rectangles séparés par « ; ». Une capture sans zone privée se publie
  avec -None, après vérification.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/mask.ps1 -Name dc08-verifier-comptes -Rects "0,0,72,1032:colonne des serveurs;0,970,312,62:panneau utilisateur;402,610,260,24:compte NXT5"

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/mask.ps1 -Name dc03-oauth-autorise -None
#>
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^dc\d{2}[a-z]?-[a-z0-9-]+$')][string]$Name,
  [string]$Rects = '',
  [switch]$None,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raw = Join-Path (Join-Path $PSScriptRoot 'raw-local') "$Name.png"
if (-not (Test-Path $raw)) { throw "Capture brute introuvable : $raw. Lance d’abord snap.ps1 -Name $Name." }
if (-not $None -and -not $Rects) { throw 'Indique les zones avec -Rects, ou -None si la capture ne montre rien de privé.' }
if ($None -and $Rects) { throw 'Choisis -Rects ou -None, pas les deux.' }

$outDir = Join-Path $PSScriptRoot '..\..\public\tuto-discord\real'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outDir = (Resolve-Path $outDir).Path
$out = Join-Path $outDir "$Name.png"
if ((Test-Path $out) -and -not $Force) { throw "$Name.png est déjà publiée. Relance avec -Force pour la remplacer." }

$list = @()
if ($Rects) {
  foreach ($part in ($Rects -split ';' | Where-Object { $_.Trim() })) {
    $why = ''
    $geom = $part
    if ($part -match '^(.*?):(.*)$') { $geom = $Matches[1]; $why = $Matches[2].Trim() }
    $n = $geom -split ',' | ForEach-Object { [int]$_.Trim() }
    if ($n.Count -ne 4 -or $n[2] -le 0 -or $n[3] -le 0) { throw "Rectangle invalide : « $part » (attendu x,y,largeur,hauteur:raison)." }
    if (-not $why) { throw "Rectangle « $part » : indique la raison après « : »." }
    $list += [ordered]@{ x = $n[0]; y = $n[1]; w = $n[2]; h = $n[3]; why = $why }
  }
}

$source = [System.Drawing.Image]::FromFile($raw)
try {
  $bitmap = New-Object System.Drawing.Bitmap $source.Width, $source.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.DrawImage($source, 0, 0, $source.Width, $source.Height)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0, 255))
    foreach ($r in $list) {
      if ($r.x -lt 0 -or $r.y -lt 0 -or ($r.x + $r.w) -gt $source.Width -or ($r.y + $r.h) -gt $source.Height) {
        throw "Rectangle hors de l’image ($($source.Width)x$($source.Height)) : $($r.x),$($r.y),$($r.w),$($r.h)."
      }
      $graphics.FillRectangle($brush, $r.x, $r.y, $r.w, $r.h)
    }
    $brush.Dispose()
  } finally { $graphics.Dispose() }
  $bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
} finally { $source.Dispose() }

# masks.json: { "<name>.png": { "masked": [...], "none": bool } }, rewritten whole (UTF-8 without BOM).
$index = Join-Path $outDir 'masks.json'
$all = [ordered]@{}
if (Test-Path $index) {
  $old = Get-Content -Raw -Encoding UTF8 $index | ConvertFrom-Json
  foreach ($p in $old.PSObject.Properties) { $all[$p.Name] = $p.Value }
}
$all["$Name.png"] = [ordered]@{ none = [bool]$None; masked = @($list) }
[IO.File]::WriteAllText($index, ($all | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
Write-Output "publiée : $out ($($list.Count) zone(s) masquée(s))"
