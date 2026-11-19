param([Parameter(Mandatory=$true)][string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
$parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality),([long]92)
foreach ($letter in @('A','B','C','D','E')) {
    foreach ($channel in @('C','N')) {
        $stem = "T_SQ_MalevolentShrine_01${letter}_${channel}"
        $source = [System.Drawing.Image]::FromFile((Join-Path $SourceDirectory "$stem.png"))
        $bitmap = New-Object System.Drawing.Bitmap 1024,1024
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($source,0,0,1024,1024)
            $bitmap.Save((Join-Path $SourceDirectory "$stem.jpg"),$jpeg,$parameters)
        } finally { $graphics.Dispose(); $bitmap.Dispose(); $source.Dispose() }
    }
}
$parameters.Dispose()
