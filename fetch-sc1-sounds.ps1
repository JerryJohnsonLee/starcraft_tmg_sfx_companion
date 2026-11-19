# Downloads StarCraft I unit audio into units/<race>/<unit>/sc1/<action>/.
#
# Phase A: voice lines from the StarCraft Wiki (already OGG Vorbis).
# Phase A3: StarCraft II voice lines from the wiki, saved in the regular (StarCraft II) action folders.
# Phase B: weapon fire/impact FX from The Sounds Resource "Weapons" pack (WAV), plus a few other SC1 effects.
#          The pack download is blocked by Cloudflare for scripts, so WAVs staged by hand under
#          tmp_assets/SC1/ (any subfolder, matched by file name) are used first; the download is the fallback.
#          Run `python convert-to-ogg.py` afterwards to transcode the WAVs.
#
# The script is idempotent: files that already exist are skipped.

$ErrorActionPreference = 'Stop'
$rootPath = $PSScriptRoot
$unitsRoot = Join-Path $rootPath 'units'
$userAgent = 'starcraft-tmg-sfx-companion/1.0 (https://github.com/JerryJohnsonLee/starcraft_tmg_sfx_companion)'
$wikiApi = 'https://starcraft.fandom.com/api.php'
$weaponsZipUrl = 'https://sounds.spriters-resource.com/media/assets/416/419501.zip'

# Phase A mapping: unit folder -> wiki file prefix and action folder -> wiki sound kind.
$voiceMap = @(
    @{ unit = 'terran/marine';   prefix = 'TerranMarine';         actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death'; stimpackVO = 'StimPack' } }
    @{ unit = 'terran/medic';    prefix = 'TerranMedic';          actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death'; heal = 'Heal' } }
    @{ unit = 'terran/goliath';  prefix = 'TerranGoliath';        actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death' } }
    @{ unit = 'terran/tank';     prefix = 'TerranSiegeTank';      actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death'; transform_to_siege = 'SiegeMode' } }
    @{ unit = 'terran/raynor';   prefix = 'TerranRaynorMarine';   actions = @{ move = 'Yes'; death = 'Death' } }
    @{ unit = 'zerg/hydralisk';  prefix = 'ZergHydralisk';        actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death' } }
    @{ unit = 'zerg/zergling';   prefix = 'ZergZergling';         actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death' } }
    @{ unit = 'zerg/kerrigan';   prefix = 'ZergInfestedKerrigan'; actions = @{ move = 'Yes'; death = 'Death' } }
    @{ unit = 'protoss/zealot';  prefix = 'ProtossZealot';        actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death'; combat = 'Attack' } }
    @{ unit = 'protoss/zeratul'; prefix = 'ProtossZeratul';       actions = @{ move = 'Yes'; death = 'Death' } }
    @{ unit = 'protoss/high_templar'; prefix = 'ProtossHighTemplar'; actions = @{ deploy = 'Ready'; move = 'Yes'; death = 'Death'; psionic_storm = 'PsionicStorm' } }
    # SC1-only units (config `audio_source: sc1`): no SC2 audio exists, the sc1/ folders are their only bank.
    # Defiler Mound ("ZergDefilerMound*") lines are a building and never match the exact kinds below.
    @{ unit = 'zerg/defiler';    prefix = 'ZergDefiler';          actions = @{ deploy = @('Ready', 'What'); move = 'Yes'; death = 'Death'; combatVO = 'Pissed'; consume = 'Consume' } }   # Plague is curated in $heroDeployMap below
    # Wave 4 Firebat: SC1 audio only until the SC2 (WoL) files are imported. "Fire" are two short flamethrower bursts
    # (the SC1 attack sound); the Stimpack clip is the Marine's (curated below). The seven "Pissed" lines are not used.
    @{ unit = 'terran/firebat';  prefix = 'TerranFirebat';        actions = @{ deploy = 'Ready'; move = 'Yes'; attack = 'Fire'; death = 'Death' } }
    # Tassadar's Gantrithor (Archon) lines are never used: the card is the High Templar one.
    @{ unit = 'protoss/tassadar'; prefix = 'ProtossTassadarHighTemplar'; actions = @{ move = 'Yes'; death = 'Death' } }
)

# Curated single wiki files for actions that no wiki kind maps to directly (the name is historical: it also holds other picks).
# Heroes have no "Ready" line in SC1. Selected "What"/"Pissed" quotes stand in for the TMG deploy action.
# `chains` concatenates several wiki files into one clip (needs ffmpeg on PATH).
$heroDeployMap = @(
    @{ unit = 'protoss/zeratul'; action = 'deploy'
       files = @('ProtossZeratulWhat03SC1.ogg')                                   # "Khas Naradah!"
       chains = @(@{ name = 'ProtossZeratulPissed02-03SC1.ogg'                    # "We will do what we must... but we do it for Aiur"
                     parts = @('ProtossZeratulPissed02SC1.ogg', 'ProtossZeratulPissed03SC1.ogg') }) }
    @{ unit = 'terran/raynor'; action = 'deploy'
       files = @('TerranRaynorMarineWhat00SC1.ogg',                               # "Raynor here"
                 'TerranRaynorMarineWhat01SC1.ogg',                               # "This is Jimmy"
                 'TerranRaynorMarineWhat02SC1.ogg',                               # "Aaany time you're ready"
                 'TerranRaynorMarinePissed03SC1.ogg') }                           # "I knew I should have stayed in bed this morning"
    @{ unit = 'zerg/kerrigan'; action = 'ready'
       files = @('ZergInfestedKerriganWhat01SC1.ogg',                             # harsh growl
                 'ZergInfestedKerriganPissed00SC1.ogg') }                         # "You begin to annoy me, cerebrate"
    # SC1 High Templars have no attack, so a "Selected" quote stands in for the TMG attack action.
    @{ unit = 'protoss/high_templar'; action = 'attack'
       files = @('ProtossHighTemplarWhat01SC1.ogg') }                             # "Zerah'hah..."
    # Defiler: the wiki has no Dark Swarm line, so Plague01 is borrowed for it until a better sound is found.
    # When Dark Swarm gets its own sound, move Plague01 back to plague (change the `files` below accordingly).
    @{ unit = 'zerg/defiler'; action = 'plague'
       files = @('ZergDefilerPlague00SC1.ogg') }
    @{ unit = 'zerg/defiler'; action = 'dark_swarm'
       files = @('ZergDefilerPlague01SC1.ogg') }                                  # placeholder borrowed from Plague
    # Firebat Stimpack: SC1 reuses the Marine's clip ("(injection sound) Ah! That's the stuff!" / "Ah yeah!").
    @{ unit = 'terran/firebat'; action = 'stimpackVO'
       files = @('TerranMarineStimPack00SC1.ogg', 'TerranMarineStimPack01SC1.ogg') }
    # Tassadar has no "Ready" line either: all four "Selected" quotes plus two chained "Pissed" pairs.
    @{ unit = 'protoss/tassadar'; action = 'deploy'
       files = @('ProtossTassadarHighTemplarWhat00SC1.ogg',                       # "Yes, Executor?"
                 'ProtossTassadarHighTemplarWhat01SC1.ogg',                       # "I hear you."
                 'ProtossTassadarHighTemplarWhat02SC1.ogg',                       # "How may I help?"
                 'ProtossTassadarHighTemplarWhat03SC1.ogg')                       # "Your will?"
       chains = @(@{ name = 'ProtossTassadarHighTemplarPissed00-01SC1.ogg'        # "Speak quickly, Executor!" + "I don't have time for games!"
                     parts = @('ProtossTassadarHighTemplarPissed00SC1.ogg', 'ProtossTassadarHighTemplarPissed01SC1.ogg') }
                  @{ name = 'ProtossTassadarHighTemplarPissed02-03SC1.ogg'        # "I was Executor long before you!" + "So do not try my patience!"
                     parts = @('ProtossTassadarHighTemplarPissed02SC1.ogg', 'ProtossTassadarHighTemplarPissed03SC1.ogg') }) }
)

# Phase B mapping: Blizzard bullet sound file (inside weapons/ in the zip) -> target sc1 action folders.
$weaponMap = @{
    'tmafir00' = @('terran/marine/attack', 'terran/raynor/attack')
    'tgofir00' = @('terran/goliath/attack')
    'hkmissle' = @('terran/goliath/missles')   # Candidate for Hellfire AA missiles (Goliath AA sounds like the Missile Turret's Longbolt in-game)
    'tgofi200' = @('terran/goliath/missles')   # Candidate by file code (Goliath fire weapon 2), sounds more like an energy weapon; keep one after A/B
    'ttafir00' = @('terran/tank/attack_tank_mode')
    'ttafi200' = @('terran/tank/attack_siege_mode')
    'ttahi200' = @('terran/tank/attack_impact')
    'zhyfir00' = @('zerg/hydralisk/attack')
    'ukifir00' = @('zerg/kerrigan/attack')
    'psiblade' = @('protoss/zealot/combat')
    'uzefir00' = @('protoss/zeratul/attack')
    'psahit00' = @('protoss/tassadar/attack')   # Psi Assault (P-S-A hit); chosen by file code, not auditioned
    # Burrow/unburrow (from the staged "sounds" bank, not part of the Weapons zip). Defiler: SC1-only unit.
    'burrowdn' = @('zerg/hydralisk/burrow', 'zerg/zergling/burrow', 'zerg/kerrigan/burrow', 'zerg/defiler/burrow')
    'burrowup' = @('zerg/hydralisk/unburrow', 'zerg/zergling/unburrow', 'zerg/kerrigan/unburrow', 'zerg/defiler/unburrow')
}

$stats = @{ downloaded = 0; skipped = 0; failed = 0 }

function Get-TargetPath([string]$unit, [string]$action, [string]$fileName) {
    $dir = Join-Path $unitsRoot (Join-Path $unit (Join-Path 'sc1' $action))
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    return Join-Path $dir $fileName
}

function Test-OggFile([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    return $bytes.Length -gt 4 -and [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4) -eq 'OggS'
}

function Invoke-WikiQuery([hashtable]$params) {
    $query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString($_.Value))" }) -join '&'
    return Invoke-RestMethod -Uri "${wikiApi}?action=query&format=json&$query" -Headers @{ 'User-Agent' = $userAgent }
}

function Get-WikiFileNames([string]$prefix) {
    $names = @()
    $continue = $null
    do {
        $params = @{ list = 'allimages'; aiprefix = $prefix; ailimit = '500' }
        if ($continue) { $params.aicontinue = $continue }
        $response = Invoke-WikiQuery $params
        $names += @($response.query.allimages.name)
        $continue = $response.continue.aicontinue
    } while ($continue)
    return $names
}

function Get-WikiFileUrls([string[]]$fileNames) {
    $urls = @{}
    for ($i = 0; $i -lt $fileNames.Count; $i += 50) {
        $batch = $fileNames[$i..([Math]::Min($i + 49, $fileNames.Count - 1))]
        $titles = ($batch | ForEach-Object { "File:$_" }) -join '|'
        $response = Invoke-WikiQuery @{ prop = 'imageinfo'; iiprop = 'url'; titles = $titles }
        foreach ($page in $response.query.pages.PSObject.Properties.Value) {
            # The API returns titles with spaces, while the file names use underscores.
            if ($page.imageinfo) { $urls[($page.title -replace '^File:', '') -replace ' ', '_'] = $page.imageinfo[0].url }
        }
    }
    return $urls
}

function Save-File([string]$url, [string]$target, [scriptblock]$validate) {
    if (Test-Path -LiteralPath $target) { $script:stats.skipped++; return }
    try {
        # The Wikia CDN answers 403 unless the request carries a wiki Referer.
        $headers = @{ 'User-Agent' = $userAgent; 'Referer' = 'https://starcraft.fandom.com/'; 'Accept' = '*/*' }
        Invoke-WebRequest -Uri $url -OutFile $target -Headers $headers -UseBasicParsing
        if ($validate -and -not (& $validate $target)) {
            Remove-Item -LiteralPath $target
            throw 'downloaded file failed validation'
        }
        $script:stats.downloaded++
        Write-Host "  + $($target.Substring($rootPath.Length + 1))"
    } catch {
        $script:stats.failed++
        Write-Warning "Failed: $url -> $($_.Exception.Message)"
    }
}

Write-Host '== Phase A: StarCraft Wiki voice lines =='
foreach ($entry in $voiceMap) {
    Write-Host "[$($entry.unit)]"
    foreach ($action in $entry.actions.Keys) {
        # An action maps to one wiki kind, or to a list of kinds that share the same folder (e.g. What + Pissed).
        foreach ($kind in @($entry.actions[$action])) {
            # Exact kind match: "<Prefix><Kind><digits>SC1.ogg". Avoids e.g. Ready matching ReadySomething.
            $names = @(Get-WikiFileNames "$($entry.prefix)$kind" | Where-Object { $_ -match "^$($entry.prefix)$kind\d*SC1\.ogg$" })
            if ($names.Count -eq 0) { Write-Warning "No wiki files for $($entry.prefix)$kind"; continue }
            $urls = Get-WikiFileUrls $names
            foreach ($name in $names) {
                if (-not $urls.ContainsKey($name)) { $stats.failed++; Write-Warning "No URL for $name"; continue }
                Save-File $urls[$name] (Get-TargetPath $entry.unit $action $name) { param($p) Test-OggFile $p }
            }
        }
    }
}

Write-Host '== Phase A2: hero deploy quotes =='
foreach ($entry in $heroDeployMap) {
    Write-Host "[$($entry.unit)]"
    $allNames = @($entry.files) + @($entry.chains | ForEach-Object { $_.parts })
    $urls = Get-WikiFileUrls $allNames
    foreach ($name in $entry.files) {
        if (-not $urls.ContainsKey($name)) { $stats.failed++; Write-Warning "No URL for $name"; continue }
        Save-File $urls[$name] (Get-TargetPath $entry.unit $entry.action $name) { param($p) Test-OggFile $p }
    }
    foreach ($chain in @($entry.chains)) {
        $target = Get-TargetPath $entry.unit $entry.action $chain.name
        if (Test-Path -LiteralPath $target) { $stats.skipped++; continue }
        $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
        if (-not $ffmpeg) { $stats.failed++; Write-Warning "ffmpeg not on PATH, cannot build $($chain.name)"; continue }
        $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "sc1-chain-$([guid]::NewGuid().ToString('N'))"
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        try {
            $inputs = @()
            foreach ($part in $chain.parts) {
                $partPath = Join-Path $tempDir $part
                Invoke-WebRequest -Uri $urls[$part] -OutFile $partPath -UseBasicParsing `
                    -Headers @{ 'User-Agent' = $userAgent; 'Referer' = 'https://starcraft.fandom.com/'; 'Accept' = '*/*' }
                $inputs += '-i', $partPath
            }
            $filter = (0..($chain.parts.Count - 1) | ForEach-Object { "[$_`:a]" }) -join ''
            $filter += "concat=n=$($chain.parts.Count):v=0:a=1[out]"
            & $ffmpeg.Source -y -loglevel error @inputs -filter_complex $filter -map '[out]' -c:a libvorbis -q:a 4 $target
            if ((Test-Path -LiteralPath $target) -and (Test-OggFile $target)) {
                $stats.downloaded++
                Write-Host "  + $($target.Substring($rootPath.Length + 1)) (chained $($chain.parts.Count) clips)"
            } else {
                $stats.failed++
                Write-Warning "ffmpeg failed to build $($chain.name)"
            }
        } finally {
            Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Phase A3 mapping: StarCraft II voice lines from the wiki ("<Prefix>_<Kind><digits>.ogg"), saved in the regular action
# folders (the StarCraft II bank), not under sc1/. Each action maps to a regex over the wiki file names.
$sc2VoiceMap = @(
    @{ unit = 'terran/firebat'; prefix = 'Firebat_'; actions = [ordered]@{
        deploy     = '^Firebat_(Ready|What)\d+\.ogg$'
        move       = '^Firebat_Yes\d+\.ogg$'
        attack     = '^Firebat_Attack\d+\.ogg$'
        death      = '^Firebat_Death\d+\.ogg$'
        stimpackVO = '^Firebat_(What04|Attack04|Yes02)\.ogg$'     # "Fueled up!", "Fired up.", "Smokin'!"
    } }
)

Write-Host '== Phase A3: StarCraft II wiki voice lines =='
foreach ($entry in $sc2VoiceMap) {
    Write-Host "[$($entry.unit)]"
    $allNames = @(Get-WikiFileNames $entry.prefix)
    foreach ($action in $entry.actions.Keys) {
        $names = @($allNames | Where-Object { $_ -match $entry.actions[$action] })
        if ($names.Count -eq 0) { Write-Warning "No wiki files for $($entry.prefix) $action"; continue }
        $urls = Get-WikiFileUrls $names
        $dir = Join-Path $unitsRoot (Join-Path $entry.unit $action)
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
        foreach ($name in $names) {
            if (-not $urls.ContainsKey($name)) { $stats.failed++; Write-Warning "No URL for $name"; continue }
            Save-File $urls[$name] (Join-Path $dir $name) { param($p) Test-OggFile $p }
        }
    }
}

Write-Host '== Phase B: The Sounds Resource weapon FX =='
$pendingWeapons = @{}
foreach ($code in $weaponMap.Keys) {
    foreach ($dest in $weaponMap[$code]) {
        $unit = ($dest -split '/')[0..1] -join '/'
        $action = ($dest -split '/')[2]
        $hasOgg = Test-Path -LiteralPath (Get-TargetPath $unit $action "$code.ogg")
        $hasWav = Test-Path -LiteralPath (Get-TargetPath $unit $action "$code.wav")
        if ($hasOgg -or $hasWav) { $stats.skipped++ } else { $pendingWeapons[$dest] = $code }
    }
}

if ($pendingWeapons.Count -eq 0) {
    Write-Host '  All weapon files already present.'
} else {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "sc1-weapons-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    try {
        $stagingDir = Join-Path $rootPath 'tmp_assets\SC1'
        $stagedFiles = @()
        if (Test-Path -LiteralPath $stagingDir) { $stagedFiles = @(Get-ChildItem -LiteralPath $stagingDir -Recurse -File -Filter '*.wav') }
        if ($stagedFiles.Count -gt 0) {
            Write-Host "  Using $($stagedFiles.Count) staged WAV files from tmp_assets\SC1"
            $extracted = $stagedFiles
        } else {
            $zipPath = Join-Path $tempDir 'weapons.zip'
            Write-Host "  Downloading $weaponsZipUrl"
            Invoke-WebRequest -Uri $weaponsZipUrl -OutFile $zipPath -Headers @{ 'User-Agent' = $userAgent } -UseBasicParsing
            Expand-Archive -LiteralPath $zipPath -DestinationPath $tempDir -Force
            $extracted = Get-ChildItem -LiteralPath $tempDir -Recurse -File -Filter '*.wav'
        }
        foreach ($dest in $pendingWeapons.Keys) {
            $code = $pendingWeapons[$dest]
            $source = $extracted | Where-Object { $_.BaseName -ieq $code } | Select-Object -First 1
            if (-not $source) { $stats.failed++; Write-Warning "Weapon file $code.wav not found in zip"; continue }
            $unit = ($dest -split '/')[0..1] -join '/'
            $action = ($dest -split '/')[2]
            $target = Get-TargetPath $unit $action "$code.wav"
            Copy-Item -LiteralPath $source.FullName -Destination $target
            $stats.downloaded++
            Write-Host "  + $($target.Substring($rootPath.Length + 1))"
        }
        Write-Host '  WAV files copied. Run `python convert-to-ogg.py` to transcode them to OGG.'
    } finally {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Done. Downloaded: $($stats.downloaded), skipped (already present): $($stats.skipped), failed: $($stats.failed)"
if ($stats.failed -gt 0) { exit 1 }
