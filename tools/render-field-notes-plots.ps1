$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $root 'evidence\field-notes\raw'
$plots = Join-Path $root 'evidence\field-notes\plots'
New-Item -ItemType Directory -Force -Path $plots | Out-Null

function New-BarPlot {
  param([string]$Output,[string]$Title,[string[]]$Labels,[double[]]$Values,[double]$Maximum)
  $bitmap = New-Object System.Drawing.Bitmap 960, 540
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(5, 11, 14))
  $titleFont = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Bold)
  $labelFont = New-Object System.Drawing.Font 'Segoe UI', 13
  $valueFont = New-Object System.Drawing.Font 'Consolas', 13
  $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(224, 255, 247))
  $labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(166, 214, 204))
  $axisPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(58, 104, 101)), 2
  $graphics.DrawString($Title, $titleFont, $titleBrush, 46, 28)
  $graphics.DrawLine($axisPen, 80, 440, 900, 440)
  $colors = @([System.Drawing.Color]::FromArgb(90,226,205),[System.Drawing.Color]::FromArgb(255,156,94),[System.Drawing.Color]::FromArgb(145,216,174),[System.Drawing.Color]::FromArgb(89,155,187),[System.Drawing.Color]::FromArgb(180,130,205),[System.Drawing.Color]::FromArgb(190,210,150),[System.Drawing.Color]::FromArgb(110,170,160))
  $slot = 780 / [Math]::Max(1, $Values.Count)
  for ($index=0; $index -lt $Values.Count; $index++) {
    $barWidth=[Math]::Min(108,$slot*0.58); $x=100+$index*$slot+($slot-$barWidth)/2
    $height=if($Maximum -gt 0){300*($Values[$index]/$Maximum)}else{0}; $y=440-$height
    $brush=New-Object System.Drawing.SolidBrush $colors[$index % $colors.Count]
    $graphics.FillRectangle($brush,[single]$x,[single]$y,[single]$barWidth,[single]$height)
    $graphics.DrawString($Labels[$index],$labelFont,$labelBrush,[single]($x-5),454)
    $graphics.DrawString(([string]$Values[$index]),$valueFont,$titleBrush,[single]$x,[single]($y-28)); $brush.Dispose()
  }
  $bitmap.Save($Output,[System.Drawing.Imaging.ImageFormat]::Png)
  $axisPen.Dispose();$titleBrush.Dispose();$labelBrush.Dispose();$titleFont.Dispose();$labelFont.Dispose();$valueFont.Dispose();$graphics.Dispose();$bitmap.Dispose()
}

$pub = Get-Content (Join-Path $raw 'publication-idempotency.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'publication-outcomes.png') 'Publication idempotency across 5,000 notes' @('PUBLISHED','REPLAYS','DUP COMMENTS','CONFLICTS') @($pub.published,$pub.idempotentReplays,$pub.duplicatesCreated,$pub.conflicts) 5000

$del = Get-Content (Join-Path $raw 'deletion-results.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'deletion-reconciliation.png') 'Deletion reconciliation outcomes' @('DELETED','DUP NOOPS','UNINDEXED','ORPHANS') @($del.deleted,$del.duplicateDeleteNoops,$del.unindexedRejected,$del.orphanIndices) 1000

$min = Get-Content (Join-Path $raw 'minority-reveal.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'minority-outcomes.png') 'Minority reveal across 10,000 resolutions' @('CHORUS','MINORITY','HOLLOW') @($min.verdicts.'chorus-held',$min.verdicts.'minority-heard',$min.verdicts.'hollow-kept-secret') 10000
