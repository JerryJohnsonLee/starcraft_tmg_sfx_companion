$rootPath = $PSScriptRoot
$registry = [ordered]@{
    ost = [ordered]@{
        starcraft1 = [ordered]@{ protoss = @(); terran = @(); zerg = @() }
        starcraft2 = [ordered]@{ protoss = @(); terran = @(); zerg = @() }
    }
    units = [ordered]@{ protoss = [ordered]@{}; terran = [ordered]@{}; zerg = [ordered]@{} }
    # Optional StarCraft I audio bank: units/<race>/<unit>/sc1/<action>/. Same action names as `units`.
    unitsSC1 = [ordered]@{ protoss = [ordered]@{}; terran = [ordered]@{}; zerg = [ordered]@{} }
    unitConfigs = [ordered]@{ protoss = [ordered]@{}; terran = [ordered]@{}; zerg = [ordered]@{} }
}
$sc1FolderName = 'sc1'

function Get-ConfigScalar([string]$value) {
    $value = $value.Trim()
    if ($value -eq 'null') { return $null }
    if ($value.StartsWith('"')) { return ($value | ConvertFrom-Json) }
    return $value
}

$stampHasher = [System.Security.Cryptography.SHA1]::Create()
# Stamp = "<short content hash>-<size in bytes>". The hash makes a replaced file a new URL; the size lets the offline
# settings estimate download sizes without a separate table (see offline.js, getUrlSize).
function Get-FileStamp([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $hash = $stampHasher.ComputeHash($bytes)
    return "$(-join ($hash[0..3] | ForEach-Object { $_.ToString('x2') }))-$($bytes.Length)"
}

function Read-UnitConfig([string]$path) {
    $config = [ordered]@{
        unit = [ordered]@{}
        regular_abilities = [ordered]@{}
        additional_abilities = [ordered]@{}
    }
    $section = ''
    $ability = ''

    foreach ($line in Get-Content -LiteralPath $path) {
        if ($line -match '^(unit|regular_abilities|additional_abilities):\s*$') {
            $section = $Matches[1]
            $ability = ''
            continue
        }
        if ($line -match '^  ([a-zA-Z0-9_-]+):\s*$' -and $section -ne 'unit') {
            $ability = $Matches[1]
            $config[$section][$ability] = [ordered]@{ sound_sources = @() }
            continue
        }
        if ($section -eq 'unit' -and $line -match '^  ([a-zA-Z0-9_-]+):\s*(.*?)\s*$') {
            $config.unit[$Matches[1]] = Get-ConfigScalar $Matches[2]
            continue
        }
        if ($ability -and $line -match '^    button_size:\s*(\d+)\s*$') {
            $config[$section][$ability].button_size = [int]$Matches[1]
            continue
        }
        if ($ability -and $line -match '^    playback:\s*([a-zA-Z_-]+)\s*$') {
            $config[$section][$ability].playback = $Matches[1]
            continue
        }
        if ($ability -and $line -match '^    sound_sources:\s*\[(.*?)\]\s*$') {
            $sources = @()
            if ($Matches[1].Trim()) { $sources = @($Matches[1].Split(',') | ForEach-Object { $_.Trim() }) }
            $config[$section][$ability].sound_sources = $sources
            continue
        }
        # Optional (sequential playback): the listed sources start `overlap_seconds` after the PREVIOUS clip started
        # (or at its end, if that clip is shorter) instead of after it ended, so the sounds overlap.
        if ($ability -and $line -match '^    overlap_sources:\s*\[(.*?)\]\s*$') {
            $overlapSources = @()
            if ($Matches[1].Trim()) { $overlapSources = @($Matches[1].Split(',') | ForEach-Object { $_.Trim() }) }
            $config[$section][$ability].overlap_sources = $overlapSources
            continue
        }
        # Optional: the same list for the SC1 bank (its sources can differ), sharing `overlap_seconds`.
        if ($ability -and $line -match '^    sc1_overlap_sources:\s*\[(.*?)\]\s*$') {
            $sc1OverlapSources = @()
            if ($Matches[1].Trim()) { $sc1OverlapSources = @($Matches[1].Split(',') | ForEach-Object { $_.Trim() }) }
            $config[$section][$ability].sc1_overlap_sources = $sc1OverlapSources
            continue
        }
        if ($ability -and $line -match '^    overlap_seconds:\s*(\d+(?:\.\d+)?)\s*$') {
            $config[$section][$ability].overlap_seconds = [double]::Parse($Matches[1], [System.Globalization.CultureInfo]::InvariantCulture)
            continue
        }
        # Optional: different sources when the card is switched to the SC1 bank (e.g. no SC2-only effect appended).
        if ($ability -and $line -match '^    sc1_sound_sources:\s*\[(.*?)\]\s*$') {
            $sc1Sources = @()
            if ($Matches[1].Trim()) { $sc1Sources = @($Matches[1].Split(',') | ForEach-Object { $_.Trim() }) }
            $config[$section][$ability].sc1_sound_sources = $sc1Sources
        }
    }

    if (-not $config.unit.name -or -not $config.unit.role) {
        throw "Missing unit name or role in config: $path"
    }
    return $config
}

# Scan soundtrack files.
$ostRoot = Join-Path $rootPath 'ost'
if (Test-Path -LiteralPath $ostRoot) {
    Get-ChildItem -LiteralPath $ostRoot -File -Recurse | ForEach-Object {
        if ($_.Extension.ToLower() -in @('.wav', '.ogg', '.mp3')) {
            $relPath = $_.FullName.Substring($rootPath.Length + 1).Replace([string][char]92, '/')
            $parts = $relPath.Split('/')
            if ($parts.Count -ge 4) {
                $ver = $parts[1]
                $race = $parts[2]
                if ($registry.ost.Contains($ver) -and $registry.ost[$ver].Contains($race)) {
                    $registry.ost[$ver][$race] += "${relPath}?v=$(Get-FileStamp $_.FullName)"
                }
            }
        }
    }
}

# Scan sound files and require a config for each unit.
$unitsRoot = Join-Path $rootPath 'units'
foreach ($raceDir in Get-ChildItem -LiteralPath $unitsRoot -Directory) {
    $race = $raceDir.Name
    if (-not $registry.units.Contains($race)) { throw "Unsupported unit faction folder: $race" }
    foreach ($unitDir in Get-ChildItem -LiteralPath $raceDir.FullName -Directory) {
        $unit = $unitDir.Name
        $configPath = Join-Path $unitDir.FullName 'config.yaml'
        if (-not (Test-Path -LiteralPath $configPath)) {
            throw "Missing config.yaml for units/$race/$unit. Add the unit config before building the registry."
        }
        $registry.unitConfigs[$race][$unit] = Read-UnitConfig $configPath
        $registry.units[$race][$unit] = [ordered]@{}
    }
}

Get-ChildItem -LiteralPath $unitsRoot -File -Recurse | ForEach-Object {
    if ($_.Extension.ToLower() -in @('.wav', '.ogg', '.mp3')) {
        $relPath = $_.FullName.Substring($rootPath.Length + 1).Replace([string][char]92, '/')
        $parts = $relPath.Split('/')
        if ($parts.Count -ge 5) {
            $race = $parts[1]
            $unit = $parts[2]
            $isSC1 = $parts[3] -eq $sc1FolderName
            if ($isSC1 -and $parts.Count -lt 6) { return }
            $action = if ($isSC1) { $parts[4] } else { $parts[3] }
            # Units without SC2 audio set `unit.audio_source: sc1`; their sc1/ folders are the only (primary) bank.
            $isSC1Only = $registry.unitConfigs[$race].Contains($unit) -and $registry.unitConfigs[$race][$unit].unit.audio_source -eq 'sc1'
            $isSecondaryBank = $isSC1 -and -not $isSC1Only
            $bank = if ($isSecondaryBank) { $registry.unitsSC1 } else { $registry.units }
            if ($registry.units[$race] -and $registry.units[$race].Contains($unit)) {
                if ($isSecondaryBank -and -not $bank[$race].Contains($unit)) {
                    $bank[$race][$unit] = [ordered]@{}
                }
                if (-not $bank[$race][$unit].Contains($action)) {
                    $bank[$race][$unit][$action] = @()
                }
                # Version stamp: a short content hash in the URL. A file replaced under the same name gets a new URL, so the
                # offline media cache downloads it again and drops the old copy (see offline.js).
                $bank[$race][$unit][$action] += "${relPath}?v=$(Get-FileStamp $_.FullName)"
            }
        }
    }
}

# Validate every configured sound source resolves to at least one audio file.
foreach ($race in $registry.unitConfigs.Keys) {
    foreach ($unit in $registry.unitConfigs[$race].Keys) {
        foreach ($section in @('regular_abilities', 'additional_abilities')) {
            foreach ($ability in $registry.unitConfigs[$race][$unit][$section].Keys) {
                $sources = @($registry.unitConfigs[$race][$unit][$section][$ability].sound_sources)
                if ($sources.Count -eq 0) { throw "Ability '$ability' has no sound_sources in units/$race/$unit/config.yaml" }
                foreach ($source in $sources) {
                    if (-not $registry.units[$race][$unit].Contains($source) -or $registry.units[$race][$unit][$source].Count -eq 0) {
                        throw "Sound source '$source' for ability '$ability' has no audio files in units/$race/$unit/"
                    }
                }
                if ($sources.Count -gt 1 -and $registry.unitConfigs[$race][$unit][$section][$ability].playback -notin @('simultaneous', 'sequential')) {
                    throw "Ability '$ability' in units/$race/$unit/config.yaml needs playback: simultaneous or sequential because it has multiple sound sources."
                }
                # overlap_sources + overlap_seconds work together, only with sequential playback, on known sources.
                $abilityConfig = $registry.unitConfigs[$race][$unit][$section][$ability]
                $hasOverlapSources = $abilityConfig.Contains('overlap_sources')
                $hasSc1OverlapSources = $abilityConfig.Contains('sc1_overlap_sources')
                $hasOverlapSeconds = $abilityConfig.Contains('overlap_seconds')
                if (($hasOverlapSources -or $hasSc1OverlapSources) -ne $hasOverlapSeconds) {
                    throw "Ability '$ability' in units/$race/$unit/config.yaml needs overlap_seconds together with overlap_sources (or sc1_overlap_sources)."
                }
                if ($hasOverlapSeconds) {
                    if ($abilityConfig.playback -ne 'sequential') {
                        throw "Ability '$ability' in units/$race/$unit/config.yaml uses overlap_seconds, which needs playback: sequential."
                    }
                }
                if ($hasOverlapSources) {
                    foreach ($overlapSource in @($abilityConfig.overlap_sources)) {
                        if ($overlapSource -notin $sources -or [array]::IndexOf($sources, $overlapSource) -eq 0) {
                            throw "overlap_sources entry '$overlapSource' of ability '$ability' in units/$race/$unit/config.yaml must be a sound source that is not the first one."
                        }
                    }
                }
            }
        }
    }
}

# Validate optional sc1_sound_sources overrides: every source must have audio in the SC1 bank or, failing that, the base folders.
foreach ($race in $registry.unitConfigs.Keys) {
    foreach ($unit in $registry.unitConfigs[$race].Keys) {
        foreach ($section in @('regular_abilities', 'additional_abilities')) {
            foreach ($ability in $registry.unitConfigs[$race][$unit][$section].Keys) {
                $abilityConfig = $registry.unitConfigs[$race][$unit][$section][$ability]
                # sc1_overlap_sources must name sources the SC1 bank actually plays (its override, or the regular list), never the first.
                if ($abilityConfig.Contains('sc1_overlap_sources')) {
                    $effectiveSc1Sources = if ($abilityConfig.Contains('sc1_sound_sources')) { @($abilityConfig.sc1_sound_sources) } else { @($abilityConfig.sound_sources) }
                    foreach ($overlapSource in @($abilityConfig.sc1_overlap_sources)) {
                        if ($overlapSource -notin $effectiveSc1Sources -or [array]::IndexOf($effectiveSc1Sources, $overlapSource) -eq 0) {
                            throw "sc1_overlap_sources entry '$overlapSource' of ability '$ability' in units/$race/$unit/config.yaml must be an SC1 sound source that is not the first one."
                        }
                    }
                }
                if (-not $abilityConfig.Contains('sc1_sound_sources')) { continue }
                $sc1Sources = @($abilityConfig.sc1_sound_sources)
                if ($sc1Sources.Count -eq 0) { throw "Ability '$ability' has an empty sc1_sound_sources in units/$race/$unit/config.yaml" }
                foreach ($source in $sc1Sources) {
                    $inSc1 = $registry.unitsSC1[$race].Contains($unit) -and $registry.unitsSC1[$race][$unit].Contains($source) -and $registry.unitsSC1[$race][$unit][$source].Count -gt 0
                    $inBase = $registry.units[$race][$unit].Contains($source) -and $registry.units[$race][$unit][$source].Count -gt 0
                    if (-not ($inSc1 -or $inBase)) {
                        throw "SC1 sound source '$source' for ability '$ability' has no audio files in units/$race/$unit/"
                    }
                }
                if ($sc1Sources.Count -gt 1 -and $abilityConfig.playback -notin @('simultaneous', 'sequential')) {
                    throw "Ability '$ability' in units/$race/$unit/config.yaml needs playback: simultaneous or sequential because sc1_sound_sources has multiple sources."
                }
            }
        }
    }
}

# SC1 folders are optional overrides, so only warn when one does not match any configured sound source (likely a typo).
$sc1FileCount = 0
foreach ($race in $registry.unitsSC1.Keys) {
    foreach ($unit in $registry.unitsSC1[$race].Keys) {
        $configuredSources = @()
        foreach ($section in @('regular_abilities', 'additional_abilities')) {
            foreach ($ability in $registry.unitConfigs[$race][$unit][$section].Values) {
                $configuredSources += @($ability.sound_sources)
                if ($ability.Contains('sc1_sound_sources')) { $configuredSources += @($ability.sc1_sound_sources) }
            }
        }
        foreach ($action in $registry.unitsSC1[$race][$unit].Keys) {
            $sc1FileCount += $registry.unitsSC1[$race][$unit][$action].Count
            if ($action -notin $configuredSources) {
                Write-Warning "units/$race/$unit/$sc1FolderName/$action is not referenced by any sound_sources in config.yaml and will never play."
            }
        }
    }
}

$json = $registry | ConvertTo-Json -Depth 30
$jsContent = "// Automatically generated by generate-registry.ps1. Do not modify manually.`nwindow.AUDIO_REGISTRY = $json;`n"
[System.IO.File]::WriteAllText((Join-Path $rootPath 'audio-registry.js'), $jsContent, [System.Text.UTF8Encoding]::new($false))
# App shell for the service worker (sw.js): every local file that index.html, styles.css, app.js and the manifest
# reference, found by scanning those files so nothing is listed by hand. The version is a hash of the shell contents
# (text files normalized to LF), so a release that changes any shell file gets a new shell cache.
function Get-ShellFiles {
    $found = [System.Collections.Generic.List[string]]::new()
    $addReference = {
        param([string]$reference)
        $reference = ($reference -split '[?#]')[0]
        if (-not $reference -or $reference -match '^(https?:|data:|mailto:|//)') { return }
        $reference = [uri]::UnescapeDataString($reference).TrimStart('.', '/')
        if (-not (Test-Path -LiteralPath (Join-Path $rootPath $reference) -PathType Leaf)) {
            Write-Warning "Shell reference '$reference' does not exist and is skipped."
            return
        }
        if (-not $found.Contains($reference)) { $found.Add($reference) }
    }

    & $addReference 'index.html'
    & $addReference 'manifest.webmanifest'
    $scanned = @{
        'index.html' = @('(?:src|href)="([^"]+)"', 'url\(''?"?([^)''"]+)')
        'styles.css' = @('url\(''?"?([^)''"]+)')
        'app.js' = @('[''"`](pics/[^''"`]+)[''"`]')
        'manifest.webmanifest' = @('"src":\s*"([^"]+)"')
    }
    foreach ($file in $scanned.Keys) {
        $text = [System.IO.File]::ReadAllText((Join-Path $rootPath $file))
        foreach ($pattern in $scanned[$file]) {
            foreach ($match in [regex]::Matches($text, $pattern)) { & $addReference $match.Groups[1].Value }
        }
    }
    return @($found | Sort-Object)
}

$shellFiles = Get-ShellFiles
$textExtensions = @('.html', '.css', '.js', '.webmanifest')
$sha = [System.Security.Cryptography.SHA256]::Create()
$hashInput = [System.IO.MemoryStream]::new()
foreach ($file in $shellFiles) {
    $bytes = [System.IO.File]::ReadAllBytes((Join-Path $rootPath $file))
    if ([System.IO.Path]::GetExtension($file) -in $textExtensions) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([System.Text.Encoding]::UTF8.GetString($bytes).Replace("`r`n", "`n"))
    }
    $nameBytes = [System.Text.Encoding]::UTF8.GetBytes("$file`n")
    $hashInput.Write($nameBytes, 0, $nameBytes.Length)
    $hashInput.Write($bytes, 0, $bytes.Length)
}
$shellVersion = -join ($sha.ComputeHash($hashInput.ToArray())[0..5] | ForEach-Object { $_.ToString('x2') })
$swConfig = [ordered]@{ version = $shellVersion; shell = @('./') + $shellFiles }
$swConfigJs = "// Automatically generated by generate-registry.ps1. Do not modify manually.`nself.SW_CONFIG = $($swConfig | ConvertTo-Json -Depth 5);`n"
[System.IO.File]::WriteAllText((Join-Path $rootPath 'sw-config.js'), $swConfigJs, [System.Text.UTF8Encoding]::new($false))
Write-Host "sw-config.js generated: shell version $shellVersion, $($shellFiles.Count + 1) files."

$sc1UnitCount = $registry.unitsSC1.protoss.Count + $registry.unitsSC1.terran.Count + $registry.unitsSC1.zerg.Count
Write-Host "audio-registry.js generated with configs for $($registry.unitConfigs.protoss.Count + $registry.unitConfigs.terran.Count + $registry.unitConfigs.zerg.Count) units ($sc1UnitCount with an SC1 bank, $sc1FileCount SC1 files)."
