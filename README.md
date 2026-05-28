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

This app has a **zero-maintenance architecture**. You never need to hardcode file paths or manually edit frontend scripts when adding new sounds or units.

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
    │   │   ├── deploy/
    │   │   ├── move/
    │   │   ├── attack/
    │   │   ├── death/
    │   │   └── stimpack/            # Optional custom action subfolder
    │   └── ... (other terran units)
    ├── zerg/
    └── protoss/
```

### The 2-Step Auto-Update Workflow

Whenever you add new folders, new units, or fresh audio tracks, follow these two steps:

#### Step 1: Transcode WAVs to OGG (Guarantees Mobile Web Compatibility)
Legacy compressed WAV files (ADPCM) do not play natively in modern mobile browsers and consume massive bandwidth. Keep your asset footprints light and mobile-optimized by running:
```bash
python convert-to-ogg.py
```
*   **What it does**: Automatically walks the `units/` directories, locates any new `.wav` files, compresses them to high-fidelity **OGG Vorbis** format (quality level 4) using `ffmpeg`, and safely deletes the original `.wav` files.
*   *Note: Ensure `ffmpeg` is installed in your system PATH, or edit the `ffmpeg_path` variable inside `convert-to-ogg.py` to point to your `ffmpeg.exe` file.*

#### Step 2: Compile the Asset Database Registry
Re-compile the application's file paths database so that the UI can scan and render new units dynamically:
```powershell
powershell -ExecutionPolicy Bypass -File .\generate-registry.ps1
```
*   **What it does**: Recursively scans all folders inside `units/` and `ost/`, structures the matching `.ogg` tracks, and outputs a complete asset database to `audio-registry.js`. 
*   **Result**: The frontend automatically compiles and renders the new buttons, collapsible grids, and custom abilities on next load!

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

