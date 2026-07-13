$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $root 'evidence\private-senses\raw'
$plots = Join-Path $root 'evidence\private-senses\plots'
New-Item -ItemType Directory -Force -Path $plots | Out-Null

function New-BarPlot {
  param(
    [string]$Output,
    [string]$Title,
    [string[]]$Labels,
    [double[]]$Values,
    [System.Drawing.Color[]]$Colors,
    [double]$Maximum
  )
  $bitmap = New-Object System.Drawing.Bitmap 960, 540
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(5, 11, 14))
  $titleFont = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Bold)
  $labelFont = New-Object System.Drawing.Font 'Segoe UI', 15
  $valueFont = New-Object System.Drawing.Font 'Consolas', 14
  $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(224, 255, 247))
  $labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(166, 214, 204))
  $axisPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(58, 104, 101)), 2
  $graphics.DrawString($Title, $titleFont, $titleBrush, 46, 28)
  $graphics.DrawLine($axisPen, 80, 440, 900, 440)
  $count = $Values.Count
  $slot = 780 / [Math]::Max(1, $count)
  for ($index = 0; $index -lt $count; $index++) {
    $barWidth = [Math]::Min(118, $slot * 0.56)
    $x = 100 + $index * $slot + ($slot - $barWidth) / 2
    $height = if ($Maximum -gt 0) { 300 * ($Values[$index] / $Maximum) } else { 0 }
    $y = 440 - $height
    $brush = New-Object System.Drawing.SolidBrush $Colors[$index % $Colors.Count]
    $graphics.FillRectangle($brush, [single]$x, [single]$y, [single]$barWidth, [single]$height)
    $graphics.DrawString($Labels[$index], $labelFont, $labelBrush, [single]($x - 4), 454)
    $graphics.DrawString(([string]$Values[$index]), $valueFont, $titleBrush, [single]$x, [single]($y - 30))
    $brush.Dispose()
  }
  $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
  $axisPen.Dispose(); $titleBrush.Dispose(); $labelBrush.Dispose(); $titleFont.Dispose(); $labelFont.Dispose(); $valueFont.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

$cyan = [System.Drawing.Color]::FromArgb(90, 226, 205)
$warm = [System.Drawing.Color]::FromArgb(255, 156, 94)
$green = [System.Drawing.Color]::FromArgb(145, 216, 174)
$blue = [System.Drawing.Color]::FromArgb(89, 155, 187)
$gray = [System.Drawing.Color]::FromArgb(100, 120, 122)

$assignments = Get-Content (Join-Path $raw 'assignment-distribution.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'sensor-distribution.png') 'Stable sensor assignment - 30,000 identities' @('ECHO','HEAT','WIND') @($assignments.counts.echo,$assignments.counts.heat,$assignments.counts.wind) @($cyan,$warm,$green) 12000

$scenarios = Get-Content (Join-Path $raw 'scenario-generation.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'solution-distribution.png') 'Optimal path distribution - 1,000 scenarios' @('NORTH','EAST','SOUTH','WEST') @($scenarios.solutionDistribution.north,$scenarios.solutionDistribution.east,$scenarios.solutionDistribution.south,$scenarios.solutionDistribution.west) @($cyan,$warm,$green,$blue) 320
New-BarPlot (Join-Path $plots 'scenario-validity.png') 'Scenario validation' @('VALID','DISCARDED') @($scenarios.valid,$scenarios.discarded) @($green,$gray) 1000

$complementarity = Get-Content (Join-Path $raw 'complementarity.json') -Raw | ConvertFrom-Json
New-BarPlot (Join-Path $plots 'plausible-routes-by-sensor.png') 'Average plausible routes per private sense' @('ECHO','HEAT','WIND') @($complementarity.averagePlausibleRoutes.echo,$complementarity.averagePlausibleRoutes.heat,$complementarity.averagePlausibleRoutes.wind) @($cyan,$warm,$green) 4
