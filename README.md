# StarCraft Tabletop Miniature Game (TMG) SFX Companion App

<p align="center">
  <img src="pics/app_logo.png" alt="StarCraft TMG SFX Companion Logo" width="360">
</p>

An immersive, responsive, retro-futuristic sci-fi soundboard and soundtrack console designed for tabletop wargaming. This application runs entirely client-side as a Single-Page Application (SPA), optimized for mobile/tablet wargaming layouts and ready for free, static hosting (e.g., GitHub Pages).

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
    │   │   ├── config.yaml           # Unit metadata, buttons, and sound-folder combinations
    │   │   ├── deploy/
    │   │   ├── move/
    │   │   ├── attack/
    │   │   ├── death/
    │   │   └── stimpack/            # Optional custom action subfolder
    │   └── ... (other terran units)
    ├── zerg/
    └── protoss/
```

### Updating Unit Sounds and Adding Units

Each unit's `config.yaml` defines its display name, role, weapon or description, regular abilities, and additional abilities. Ability keys become uppercase button labels, with underscores converted to spaces. `sound_sources` lists action folder names; one sound is chosen at random from each folder. For a single source, omit `playback`. For multiple sources, set `playback` to `simultaneous` or `sequential`. Regular buttons default to size 1; additional buttons default to size 2. Set `button_size` only to override the default.

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
*   **What it does**: Recursively scans audio files inside `units/` and `ost/`, reads every unit's `config.yaml`, and writes both the audio index and unit definitions to `audio-registry.js`. The build stops with a clear error if a unit config is missing, a configured sound folder has no audio, or a multi-folder ability has no playback mode.
*   **Result**: The browser builds the unit cards, labels, button sizes, and simultaneous or sequential playback from the generated registry on next load.

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

## ⚖️ Legal Disclaimer

This is an unofficial, non-commercial fan-made companion app. All StarCraft audio, music, and asset rights belong entirely to Blizzard Entertainment. This project is not affiliated with, endorsed by, or associated with Blizzard Entertainment or Archon Studio.
