# Speak each narration line to its own WAV with an offline Windows voice (System.Speech).
# powershell -NoProfile -File pitch/explainer/voice.ps1 -Lines lines.json -OutDir dir [-Voice "Microsoft Zira Desktop"] [-Rate 0]
# lines.json: [{ "id": "race-01", "text": "..." }]. Writes <OutDir>/<id>.wav, 44.1 kHz 16-bit mono.
param(
  [Parameter(Mandatory = $true)][string]$Lines,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = 0
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
New-Item -ItemType Directory -Force $OutDir | Out-Null
$items = Get-Content -Raw -Encoding UTF8 $Lines | ConvertFrom-Json
foreach ($item in $items) {
  $path = Join-Path $OutDir ($item.id + ".wav")
  $synth.SetOutputToWaveFile($path, $format)
  $synth.Speak([string]$item.text)
  $synth.SetOutputToNull()
}
$synth.Dispose()
