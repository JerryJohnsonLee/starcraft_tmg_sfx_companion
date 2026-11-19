<#
.SYNOPSIS
    Copies StarCraft II audio extracted from your own game install into units/<race>/<unit>/<action>/.

.DESCRIPTION
    Blizzard's audio is not distributed with this tool. Extract the files you need from your own
    StarCraft II installation with CascView (https://www.zezula.net/en/casc/main.html) into the
    staging folder (default: tmp_assets/, ignored by git), keeping the path structure, then run:

        powershell -ExecutionPolicy Bypass -File .\import-sc2-audio.ps1
        python convert-to-ogg.py          # only needed when WAV files were imported
        powershell -ExecutionPolicy Bypass -File .\generate-registry.ps1

    The $importMap table below says which staged files go to which unit action folder. Patterns are
    PowerShell -like wildcards (* and ?) matched against the full path of each staged file, using
    backslashes. Files that are already in the destination are skipped, and entries without any
    staged file only produce a notice (extract them and run the script again).

.PARAMETER SourceRoot
    Staging folder with the CascView extraction (default: tmp_assets next to this script).
#>
param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot 'tmp_assets')
)

$ErrorActionPreference = 'Stop'
$unitsRoot = Join-Path $PSScriptRoot 'units'

# Standard English unit voice lines live here (enUS tag in CascView):
$voice = '*\mods\liberty.sc2mod\enus.sc2assets\localizeddata\sounds\protossunitvo'
$terranVoice = '*\mods\liberty.sc2mod\enus.sc2assets\localizeddata\sounds\terranunitvo'
$zergHeroVoice = '*\enus.sc2assets\localizeddata\sounds\vo\zerg'          # Zagara's hero lines (void campaign)
$novaVoice = '*\enus.sc2assets\localizeddata\sounds\terranunitvo\nova'   # Covert Ops lines sit in the liberty mod and the void campaign

# target = '<race>/<unit>/<action>', patterns = staged files to copy there.
$importMap = @(
    # --- Protoss High Templar (TMG wave 3) ---
    @{ target = 'protoss/high_templar/deploy';        patterns = @("$voice\hightemplar\hightemplar_ready??.ogg",
                                                                   '*\campaigns\voidstory.sc2campaign\enus.sc2assets\localizeddata\sounds\vo\pmission_ulnar03_hightemplar_117.ogg') }  # extra mission line, picked by the maintainer
    @{ target = 'protoss/high_templar/move';          patterns = @("$voice\hightemplar\hightemplar_yes??.ogg") }
    @{ target = 'protoss/high_templar/psionic_storm'; patterns = @("$voice\hightemplar\hightemplar_psionicstorm??.ogg") }                    # voice: "Saraht tuun!"
    @{ target = 'protoss/high_templar/psionic_stormFX'; patterns = @('*\mods\liberty.sc2mod\base.sc2assets\assets\sounds\protoss\hightemplar\hightemplar_psionicstormimpact?.wav') }  # storm impact, played after the voice (also the attack effect)
    @{ target = 'protoss/high_templar/psionic_stormLaunch'; patterns = @('*\mods\liberty.sc2mod\base.sc2assets\assets\sounds\protoss\hightemplar\hightemplar_psionicstormlaunch?.wav') }  # storm launch, played last
    @{ target = 'protoss/high_templar/attack';        patterns = @("$voice\hightemplar\hightemplar_attack04.ogg", "$voice\hightemplar\hightemplar_attack06.ogg") }  # picked by the maintainer; no AttackLaunch file exists
    @{ target = 'protoss/high_templar/death';         patterns = @("$voice\hightemplar\hightemplar_death*.ogg", "$voice\hightemplar\hightemplar_death*.wav",
                                                                   "$voice\hightemplar\hightemplar_energylow00.ogg",                              # "low energy" line as an extra death line
                                                                   '*\campaigns\liberty.sc2campaign\enus.sc2assets\localizeddata\sounds\protossvo\campaignunits\karass\karass_death*.wav') }  # Karass is a campaign High Templar

    # --- Terran Raven (TMG wave 3) ---
    # Not imported from the game, copied from existing repo files instead:
    #   death/          <- units/terran/tank/death/SiegeTank_Death0.ogg (placeholder until the Raven has a better sound)
    #   auto_turretFX/  <- units/terran/goliath/attack/Goliath_GroundAttackLaunch0-2.ogg (gunfire after the voice line)
    @{ target = 'terran/raven/deploy';             patterns = @("$terranVoice\raven\raven_ready??.ogg") }
    @{ target = 'terran/raven/move';               patterns = @("$terranVoice\raven\raven_yes??.ogg") }
    @{ target = 'terran/raven/auto_turret';        patterns = @("$terranVoice\raven\raven_autoturret??.ogg") }          # voice, followed by auto_turretFX
    @{ target = 'terran/raven/seeker_missile';     patterns = @("$terranVoice\raven\raven_hunterseeker??.ogg") }
    @{ target = 'terran/raven/anti_armour_missile'; patterns = @("$terranVoice\raven\raven_targetingdrone??.ogg") }     # closest SC2 line for the debuff missile (no dedicated voice)

    # --- Terran Nova (TMG wave 3): see the Nova block after this table (two modes, one card) ---

    # --- Zerg Zagara (TMG wave 3) ---
    # Bile Launcher (a separate card) is intentionally left out for now.
    # Not imported from the game: attackFX/, combat/ and deathFX/ are copies of the Queen's sounds
    # (units/zerg/queen/attack, combat, deathFX), placeholders until Zagara has her own effects.
    @{ target = 'zerg/zagara/deploy';  patterns = @("$zergHeroVoice\zagarahero_ready??.ogg") }
    @{ target = 'zerg/zagara/move';    patterns = @("$zergHeroVoice\zagarahero_yes??.ogg") }
    @{ target = 'zerg/zagara/attack';  patterns = @("$zergHeroVoice\zagarahero_attack??.ogg") }
    @{ target = 'zerg/zagara/death';   patterns = @("$zergHeroVoice\zagarahero_death??.wav") }

    # --- Terran Firebat (TMG wave 4) ---
    # The StarCraft II voice lines come from the wiki (fetch-sc1-sounds.ps1, Phase A3). Not imported from the game,
    # copied from existing repo files instead: stimpack/ <- units/terran/marine/stimpack/Marine_Stimpack0-7.ogg (injection effect).
    @{ target = 'terran/firebat/attackFX'; patterns = @('*\mods\liberty.sc2mod\base.sc2assets\assets\sounds\terran\firebat\firebat_attacklaunch?.wav') }  # flamethrower burst, played with the voice
    # Fire Wall: the StarCraft I "building on fire" sounds (staged by hand in tmp_assets\SC1), used on both banks, picked at random.
    @{ target = 'terran/firebat/fire_wall'; patterns = @('*\SC1\bldg\onfirlrg.wav', '*\SC1\sounds\onfirsml.wav') }
)

# --- Terran Nova (TMG wave 3) ---
# Nova has two TMG cards (Stealth Mode, Assault Mode) that the app shows as ONE card with a mode toggle
# (`mode_group` in both configs). Both modes share the Covert Ops voice pools (heronovamp1 + 2 + 3, never the
# "2hd" set: it has a reverb, and never the "_np" neural-parasite lines). Only these differ per mode:
#   deploy: the shared ready lines + the co-op commander mode lines (stealthmode + cloak, or assaultmode)
#   attack: Stealth appends the Ghost rifle shot (attackFX/), Assault is voice only until a blade/shotgun effect is found
# Not imported from the game, copied from existing repo files instead:
#   nova_stealth_mode/attackFX/        <- units/terran/raynor/revolver/Ghost_AttackLaunch0-2.ogg (rifle shots)
#   nova_assault_mode/phase_reactor_suit/ <- units/protoss/stalker/blink/Stalker_Blink0.ogg (placeholder blink sound)
# Staged but unused (curate later): heronovamp1_what_n*, heronovamp3_visor_what*, heronovamp1_respawn* and the rest of the set.
$novaShared = @(
    @{ action = 'deploy';     patterns = @("$novaVoice\heronovamp1_ready_n[123]00.ogg", "$novaVoice\heronovamp2_ready00.ogg", "$novaVoice\heronovamp3_visor_ready00.ogg") }
    @{ action = 'move';       patterns = @("$novaVoice\heronovamp1_yes0[0-3].ogg", "$novaVoice\heronovamp1_yes_n[12]0[0-4].ogg") }
    @{ action = 'attack';     patterns = @("$novaVoice\heronovamp1_attack0[0-5].ogg", "$novaVoice\heronovamp3_visor_attack0[01].ogg") }
    @{ action = 'death';      patterns = @("$novaVoice\heronovamp1_death0[01].wav", "$novaVoice\heronovamp3_visor_death00.wav") }
    @{ action = 'holo_decoy'; patterns = @('*\novacommander_holodecoy0[0-4].ogg') }
)
foreach ($mode in 'nova_stealth_mode', 'nova_assault_mode') {
    foreach ($shared in $novaShared) {
        $importMap += @{ target = "terran/$mode/$($shared.action)"; patterns = $shared.patterns }
    }
}
$importMap += @{ target = 'terran/nova_stealth_mode/deploy'; patterns = @("$novaVoice\heronovamp1_cloak00.ogg", '*\novacommander_stealthmode0[0-3].ogg') }
$importMap += @{ target = 'terran/nova_assault_mode/deploy'; patterns = @('*\novacommander_assaultmode0[0-3].ogg') }

if (-not (Test-Path -LiteralPath $SourceRoot)) {
    Write-Error "Staging folder not found: $SourceRoot. Extract the game files with CascView first (see the script header)."
}

$staged = @(Get-ChildItem -LiteralPath $SourceRoot -Recurse -File)
Write-Host "Staged files found in ${SourceRoot}: $($staged.Count)"

$stats = @{ copied = 0; skipped = 0; pending = 0 }
$wavCopied = $false

foreach ($entry in $importMap) {
    $matches = @($staged | Where-Object {
        $path = $_.FullName
        foreach ($pattern in $entry.patterns) { if ($path -like $pattern) { return $true } }
        return $false
    })
    if ($matches.Count -eq 0) {
        $stats.pending++
        Write-Host "  (nothing staged yet) $($entry.target)"
        continue
    }
    $targetDir = Join-Path $unitsRoot ($entry.target -replace '/', '\')
    if (-not (Test-Path -LiteralPath $targetDir)) { New-Item -ItemType Directory -Path $targetDir | Out-Null }
    foreach ($file in $matches) {
        $destination = Join-Path $targetDir $file.Name
        $oggTwin = [System.IO.Path]::ChangeExtension($destination, '.ogg')
        if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $oggTwin)) { $stats.skipped++; continue }
        Copy-Item -LiteralPath $file.FullName -Destination $destination
        $stats.copied++
        if ($file.Extension -ieq '.wav') { $wavCopied = $true }
        Write-Host "  + units/$($entry.target)/$($file.Name)"
    }
}

if ($wavCopied) { Write-Host 'WAV files were copied. Run `python convert-to-ogg.py` to transcode them to OGG.' }
Write-Host "Done. Copied: $($stats.copied), skipped (already present): $($stats.skipped), entries with nothing staged: $($stats.pending)"
