# StarCraft Tabletop Miniature Game (TMG) SFX Companion App

<p align="center">
  <img src="pics/app_logo.png" alt="StarCraft TMG SFX Companion Logo" width="360">
</p>

An immersive, responsive, retro-futuristic sci-fi soundboard and soundtrack console designed for tabletop wargaming. This application runs entirely client-side as a Single-Page Application (SPA), optimized for mobile/tablet wargaming layouts and ready for free, static hosting (e.g., GitHub Pages).

> **About this version:** this is a fork of [JerryJohnsonLee/starcraft_tmg_sfx_companion](https://github.com/JerryJohnsonLee/starcraft_tmg_sfx_companion), extended and maintained separately. Live app: [ernsthb.github.io/starcraft_tmg_sfx_companion](https://ernsthb.github.io/starcraft_tmg_sfx_companion/). See [Credits](#-credits).
>
> Differences from the original project:
> *   Optional StarCraft I sound bank per unit with an `SC1 | SC2` card switch (see "StarCraft I Sound Bank" below), including the `fetch-sc1-sounds.ps1` asset downloader.
> *   Web app manifest and install icons (`manifest.webmanifest`, `pics/icons/`), so the app can be added to the home screen as "SC:TMG - SFX". The square icons are generated from the existing artwork by `generate-pwa-icons.ps1`. A service worker (`sw.js`, registered by `pwa.js`) keeps the app shell available offline, in a cache that is replaced on every release, and holds a separate persistent cache for audio that survives releases. It is not registered on localhost (add `?sw=1` to test it there), and `?nosw=1` removes it anywhere. The Control Center has a collapsed "Offline Settings" card with a "Prepare offline" button that saves the unit sounds of the chosen factions (both the StarCraft I and II banks, battle music optional and independent of the factions, so a pack can hold only the music) on the device, with a progress bar. While the device is offline, the faction pages dim every button whose sounds are not saved and explain why in a notice above the units, and the music player only plays saved tracks (with its own notice). The buttons and the status line show roughly how much will be downloaded or freed. Installing the app itself is left to the browser (the install icon in the address bar, or Share > Add to Home Screen on iOS). A prepared pack stays current by itself: after a release, only new or changed sounds are downloaded and removed ones are deleted. The header uses a reduced copy of the logo (`pics/app_logo_small.png`, made by `generate-app-logo-small.ps1`; the original `pics/app_logo.png` stays as the source for the install icons). A "Change log" button below the repository links opens a dialog with the latest changes.
> *   TMG wave 3 units, added step by step. Done: High Templar (SC2 + SC1 banks; in SC2 the Attack plays a voice line followed by a random storm impact, and Psionic Storm plays the voice, a random storm impact and the storm launch sound, which starts 1 second into the impact so they overlap; in SC1 the Attack is voice only and Psionic Storm plays a random Yes line with the storm sound starting 1 second into it), Raven (SC2 only; its destroyed sound is a placeholder borrowed from the Siege Tank). Nova (one card with a Stealth / Assault mode toggle, SC2 only; the Assault Mode attack is voice only until a blade/shotgun effect is found). Zagara (SC2 only; her attack and death effects are placeholders borrowed from the Queen, and the Bile Launcher is not included yet). Defiler and Tassadar (SC1 audio only. The Defiler uses all its voice lines (Selected quotes join Ready on deploy, Pissed quotes play before the Claws melee sound), plus Consume, Plague and the StarCraft I burrow sounds; the Claws melee sound is a placeholder borrowed from the Roach, and Dark Swarm borrows Plague's second voice line until a better sound is found. Tassadar's attack is the Psi Assault effect, the Force Wall and other abilities have no sound yet; Tassadar's deploy plays his Selected quotes and two chained Pissed pairs, as he has no Ready line).
> *   TMG wave 4 units (pre-orders opened 2026-11-16), added step by step from the store pages until the official card sheets are out, so roles and weapons are provisional. Done: Firebat (SC1 and SC2 banks with the usual switch: SC2 voice lines from the wiki with the flamethrower burst starting 1 second into the attack line, the Marine's Stimpack effect, and the SC1 "building on fire" sounds for the Fire Wall, shared by both banks).

---

## 🎮 Features

### 1. Morphic Faction HUD Stylesheets
Tapping the faction tabs dynamically morphs the entire visual interface of the console to match the corresponding StarCraft race:
*   **Terran Console**: Swaps to an industrial, metal-panel theme with glowing cyan accents, yellow military hazards, and tactical HUD grids.
*   **Zerg Console**: Shifts into a biological hive shell utilizing organic violet chassis curves, neon-green bioluminescent highlight buttons, and biological membranes.
*   **Protoss Console**: Morphs into a sleek, golden geometric interface powered by sapphire shield glows and high-tech warp nodes.
*   **CRT Screen Overlay**: Includes subtle retro CRT monitor scanlines and glass curved reflections for an authentic command-terminal vibe.

### 2. Refined OST Player
*   **Version & Faction Shuffling**: Customize your background music by selecting Starcraft versions (SC1, SC2) and/or factions (Terran, Zerg, Protoss) via the tactical checkboxes.
*   **Double-Randomization**: Leverages a robust Fisher-Yates array shuffle, combined with a dynamic random-index splice to guarantee high-entropy startup tracks and smooth automated transitions.
*   **Tactical Skip-on-Play**: Pausing the background music and hitting Play immediately pulls a new randomized track, serving as a manual skip control.
*   **Master Volume Grids**: Independent wargame volume sliders allow background OST to keep playing smoothly while multiple overlapping unit voice lines run.

### 3. Faction Soundboards
Collapsible accordion cards keep the mobile interface compact. Trigger unit audio lines directly from the tactile console grids:
*   **Mobile Mobile-First UX**: Cards expand and collapse smoothly with one touch. A real-time filter bar searches and narrows down units instantly.
*   **Complex Stimpack Combinations**: Playing stimpack on Marines or Marauders blends a random chemical injector spray with a random voice overlay simultaneously.
*   **visceral Death Layers**: Units with custom `death` and `deathFX` subdirectories automatically play one sound from each folder in parallel for maximum audio depth.
*   ** Burrow/Unburrow Abilities**: Automatically scans, processes, and displays Burrow and Unburrow controls on Zerg units.
*   **Scanned Extensible Abilities**: Any custom subdirectories (e.g., Artanis's `charge`, Stalker's `blink`, Goliath's `missiles`) are automatically compiled into a "Scanned Abilities" sub-menu on their cards!
*   **SC1 / SC2 Sound Banks**: Units that also existed in the original StarCraft (Marine, Medic, Goliath, Siege Tank, Raynor, Hydralisk, Zergling, Kerrigan, Zealot, Zeratul) show an `SC1 | SC2` switch in their card header. SC1 selects the classic Brood War voice lines and weapon sounds; any action without an SC1 recording (e.g. burrow, death FX) silently falls back to the SC2 sound. The choice is remembered per unit on the device.

---

## 🛠️ Adding New Sounds and Units

This app is config-driven. When adding a unit, add its sound folders and a `config.yaml` in the unit folder. The build script validates the config, indexes the audio, and embeds the unit definitions for the browser app; frontend scripts do not need edits for ordinary content updates.

### Directory Structure Rules
Sound assets are arranged inside folders corresponding to their versions, races, and units:
```
starcraft_tmg_sfx_companion/
│
├── ost/                             # Soundtrack directories
│   ├── starcraft1/
│   │   ├── terran/
│   │   ├── zerg/
│   │   └── protoss/
│   └── starcraft2/
│       ├── terran/
│       ├── zerg/
│       └── protoss/
│
└── units/                           # Soundboard directories
    ├── terran/
    │   ├── marine/
    │       │   ├── config.yaml           # Unit metadata, buttons, and sound-folder combinations
    │   │   ├── deploy/
    │   │   ├── move/
    │   │   ├── attack/
    │   │   ├── death/
    │   │   ├── stimpack/            # Optional custom action subfolder
    │   │   └── sc1/                 # Optional StarCraft I bank, mirrors the action folders above
    │   │       ├── deploy/
    │   │       ├── move/
    │   │       └── attack/
    │   └── ... (other terran units)
    ├── zerg/
    └── protoss/
```

### Updating Unit Sounds and Adding Units

Each unit's `config.yaml` defines its display name, role, weapon or description, regular abilities, and additional abilities. Ability keys become uppercase button labels, with underscores converted to spaces. `sound_sources` lists action folder names; one sound is chosen at random from each folder. For a single source, omit `playback`. For multiple sources, set `playback` to `simultaneous` or `sequential`. With `sequential`, an ability can make later clips overlap the previous one: `overlap_sources: [folder, ...]` plus `overlap_seconds: <number>` (both are required together). The listed sources then start that many seconds after the previous clip started (or when it ends, if it is shorter) instead of after it ended; the first source cannot be listed. On the SC1 bank an ability can list its own overlapping sources with `sc1_overlap_sources: [folder, ...]` (it shares `overlap_seconds`, and each entry must be one of the SC1 sources and not the first). Regular buttons default to size 1; additional buttons default to size 2. Set `button_size` only to override the default.

Example:

```yaml
unit:
  name: Roach
  role: Tank
  weapon: "Acid Saliva, Claws"

regular_abilities:
  destroyed:
    sound_sources: [death, deathFX]
    playback: simultaneous

additional_abilities:
  burrow:
    button_size: 1
    sound_sources: [burrow]
  unburrow:
    button_size: 1
    sound_sources: [unburrow]
```

### StarCraft I Sound Bank (`sc1/` folders)

A unit can carry an alternative StarCraft I bank in `units/<race>/<unit>/sc1/<action>/`. The action folder names are the same ones referenced by `sound_sources` in the unit's `config.yaml`; no config changes are needed. When a player switches a card to SC1, each action plays from `sc1/<action>/` if that folder has audio and from the regular `<action>/` folder otherwise, so partial banks are fine. The build warns about `sc1/` folders that no ability references. When an ability should behave differently on the SC1 bank (for example, not append an SC2-only effect), add `sc1_sound_sources: [...]` to that ability; the card then plays those sources instead of `sound_sources` while on SC1 (`playback` applies if it lists several).

Units that only exist in StarCraft I (no SC2 audio, for example the Defiler and Tassadar) set `audio_source: sc1` in the `unit` block. Their `sc1/<action>/` folders then act as the only sound bank, so `sound_sources` resolve there, and the card shows a static `SC1` badge instead of the SC1/SC2 switch.

Some characters have several TMG cards, for example Nova with her Stealth Mode and Assault Mode cards. Give each card its own unit folder and config, and put the same `mode_group` (the card title, e.g. `"Nova"`) and a `mode_label` (the toggle text) in the `unit` block of each. The app then shows one card with a mode toggle in place of the SC1/SC2 switch, and each mode keeps its own weapon, abilities and sound folders. The optional `mode_order` (`1`, `2`, ...) sets the toggle order, and the first mode is the default. A mode card has no SC1 switch.

The SC1 assets for the current units are fetched by script instead of being extracted by hand:
```powershell
powershell -ExecutionPolicy Bypass -File .\fetch-sc1-sounds.ps1
python convert-to-ogg.py
```
*   **Voice lines** come from the [StarCraft Wiki unit sound files](https://starcraft.fandom.com/wiki/Category:StarCraft_unit_sounds) through the MediaWiki API (already OGG). Heroes have no "Ready" line in SC1, so hand-picked quotes stand in for their deploy action.
*   **Weapon fire/impact sounds** come from the StarCraft "Weapons" pack on [The Sounds Resource](https://sounds.spriters-resource.com/pc_computer/starcraft/) (WAV; the second command transcodes them). Chained multi-part quotes also need `ffmpeg` on the PATH.
*   The script is idempotent: files that already exist are skipped, so it can be re-run after extending the mapping tables at the top of the file.

### Importing StarCraft II audio from your own game install

StarCraft II unit audio is not downloadable from a public source, so it is extracted from a licensed local installation with [CascView](https://www.zezula.net/en/casc/main.html) (enable "Allow downloading storage metadata if they're missing" in its options; on recent game builds the local storage may only open after that). Extract the files you need into `tmp_assets/` (keep the path structure; the folder is ignored by git), then:
```powershell
powershell -ExecutionPolicy Bypass -File .\import-sc2-audio.ps1
python convert-to-ogg.py
```
`import-sc2-audio.ps1` copies the staged files into the unit action folders according to the table at the top of the script (wildcard patterns per target folder). It is idempotent, and entries whose files are not staged yet only print a notice. English unit voice lines live under `mods\liberty.sc2mod\enus.sc2assets\localizeddata\sounds\<race>unitvo\<unit>\` (tip: in CascView's search dialog, untick all language tags except `enUS` to hide the other languages).

After adding or changing unit sounds/configs, run these steps from the project root:

#### Step 1: Transcode WAVs to OGG (Guarantees Mobile Web Compatibility)
Legacy compressed WAV files (ADPCM) do not play natively in modern mobile browsers and consume massive bandwidth. Keep your asset footprints light and mobile-optimized by running:
```bash
python convert-to-ogg.py
```
*   **What it does**: Automatically walks the `units/` directories, locates any new `.wav` files, compresses them to high-fidelity **OGG Vorbis** format (quality level 4) using `ffmpeg`, and safely deletes the original `.wav` files.
*   *Note: Ensure `ffmpeg` is installed in your system PATH, or edit the `ffmpeg_path` variable inside `convert-to-ogg.py` to point to your `ffmpeg.exe` file.*

#### Step 2: Build the App's Audio and Unit Registry
Compile the audio index and unit definitions from sound folders and each unit's required `config.yaml`:
```powershell
powershell -ExecutionPolicy Bypass -File .\generate-registry.ps1
```
*   **What it does**: Recursively scans audio files inside `units/` and `ost/` (including the optional `sc1/` banks), reads every unit's `config.yaml`, and writes the audio index, the SC1 index, and unit definitions to `audio-registry.js`. The build stops with a clear error if a unit config is missing, a configured sound folder has no audio, or a multi-folder ability has no playback mode.
*   **Result**: The browser builds the unit cards, labels, button sizes, and simultaneous or sequential playback from the generated registry on next load.
*   **Also writes `sw-config.js`**: the list of app shell files for the service worker (found by scanning `index.html`, `styles.css`, `app.js` and the manifest) plus a version hash of their contents. Run the script again after changing any of those files (and bump the `?v=` tokens in `index.html` as before), otherwise installed copies keep serving the old shell.
*   **Version stamps**: every unit sound and battle music path in the registry ends with `?v=<short content hash>-<size in bytes>`. A file replaced under the same name therefore gets a new URL, so devices with an offline pack download it again and drop the old copy, and the size feeds the download estimates in the Offline Settings card.
*   **Change log**: add one line at the top of `changelog.js` when a change is merged (short, written for players). It feeds the "Change log" dialog.

---

## 🌐 Local Development & Hosting

### Local Server (`server.py`)
To prevent Windows Registry MIME-type conflicts (which sometimes blocks `.ogg` audio files from playing locally) and bypass aggressive browser caching, start the development server using:
```bash
python server.py
```
*   **MIME Maps**: Maps `.ogg` to `audio/ogg` explicitly.
*   **Cache-Busting**: Sets `Cache-Control: no-store` to ensure your browser fetches your latest JS edits and audio registry files instantly.
*   **Address Reuse**: Automatically manages ports to avoid "address already in use" errors during quick restarts.
*   Access the local console at **`http://localhost:8000`**.

### GitHub Pages (Static Hosting)
Because this is a serverless Single-Page Application, it can be deployed for free in seconds:
1.  Push the codebase to a public GitHub repository.
2.  Go to **Repository Settings -> Pages**.
3.  Set the **Source** to "Deploy from a branch", select **`main`** and **`/ (root)`**, and click **Save**.
4.  Within minutes, your StarCraft SFX HUD is live online!

---

## 🤝 Credits

*   Original project by Jerry Lee ([@JerryJohnsonLee](https://github.com/JerryJohnsonLee)).
*   Current version forked, extended and maintained by Ernesto Hernández Benítez ([@ErnstHB](https://github.com/ErnstHB)).
*   StarCraft I voice lines: [StarCraft Wiki](https://starcraft.fandom.com/wiki/Category:StarCraft_unit_sounds). StarCraft I weapon sounds: [The Sounds Resource](https://sounds.spriters-resource.com/pc_computer/starcraft/).

---

## ⚖️ Legal Disclaimer

This is an unofficial, non-commercial fan-made companion app. All StarCraft audio, music, and asset rights belong entirely to Blizzard Entertainment. This project is not affiliated with, endorsed by, or associated with Blizzard Entertainment or Archon Studio.
