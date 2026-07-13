$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $root 'evidence\expedition-engine\raw'
$plots = Join-Path $root 'evidence\expedition-engine\plots'
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

$sim = Get-Content (Join-Path $raw 'expedition-simulations.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'ending-distribution.png') '10,000 seven-day expedition endings' @('CHORUS','SURVIVOR','FADING') @($sim.endings.'the-chorus',$sim.endings.'the-survivor',$sim.endings.'the-fading-signal') 7000
New-BarPlot (Join-Path $plots 'vitality-by-day.png') 'Average Murmur vitality by day' @('D1','D2','D3','D4','D5','D6','D7') @($sim.averageVitalityByDay) 3
New-BarPlot (Join-Path $plots 'consequence-frequency.png') 'Consequences across 70,000 decisions' @('SAFE','COSTLY','DANGER') @($sim.consequences.safe,$sim.consequences.costly,$sim.consequences.dangerous) 40000
$sched = Get-Content (Join-Path $raw 'scheduler-idempotency.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'scheduler-outcomes.png') 'Duplicate job outcomes' @('RESOLVE CALLS','RESOLUTIONS','PUBLISH CALLS','POSTS') @($sched.resolveCalls,$sched.immutableResolutions,$sched.publishCalls,$sched.chapterPosts) 100
New-BarPlot (Join-Path $plots 'expedition-completion.png') 'Expedition completion invariants' @('COMPLETE','BLOCKED','DAY 8','INVALID') @($sim.sampleSize,$sim.blockedExpeditions,$sim.accidentalDay8,$sim.invalidStates) 10000
