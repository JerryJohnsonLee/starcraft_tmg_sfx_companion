/**
 * StarCraft TMG SFX Companion - Core Engine
 * Client-side script managing OST shuffling, dynamic UI generation,
 * complex parallel SFX playing, and faction console morphing.
 */

// Global Audio State
let currentMusicAudio = null;
let currentPlaylist = [];
let shuffledQueue = [];
let activeSfxAudios = new Set();
let musicVolume = 0.5; // Default 50%
let sfxVolume = 0.8;   // Default 80%
let activeTab = 'ost';

// In-Game Faction Role Metadata (Adds visual richness & wargame flavor)
const UNIT_METADATA = {
    // Terran
    raynor: { name: "Jim Raynor", role: "Tactician Hero", desc: 'Weapon: Commando Rifle, "Justice" Revolver (Upgrade: C-14 Rifle)' },
    marine: { name: "Marine", role: "Damage Dealer", desc: 'Weapon: C-14 Rifle (Upgrade: AGG-12, Rocket Launcher)' },
    marauder: { name: "Marauder", role: "Tank", desc: 'Weapon: Quad K12' },
    medic: { name: "Medic", role: "Lifesaver", desc: 'Weapon: Medpack' },
    goliath: { name: "Goliath", role: "Elite Damage Dealer", desc: 'Weapon: Autocannon, Underbelly Machine Gun, Hellfire Missiles (Upgrade: Scatter Missiles, Haywire Missiles)' },
    
    // Zerg
    kerrigan: { name: "Kerrigan", role: "Damage Dealing Hero", desc: 'Weapon: Energy Blast, Blades' },
    zergling: { name: "Zergling", role: "Damage Dealer", desc: 'Weapon: Claws (Upgrade: Shredding Claws)' },
    roach: { name: "Roach", role: "Tank", desc: 'Weapon: Acid Saliva, Claws' },
    queen: { name: "Queen", role: "Lifesaver", desc: 'Weapon: Talons, Acid Spines' },
    omega_worm: { name: "Omega Worm", role: "Tactical Structure", desc: 'SUBTERRANEAN TRANSPORT NETWORK' },
    hydralisk: { name: "Hydralisk", role: "Elite Damage Dealer", desc: 'Weapon: Needle Spine, Scyche' },
    
    // Protoss
    artanis: { name: "Artanis", role: "Tank Hero", desc: 'Weapon: Twilight Blades' },
    zealot: { name: "Zealot", role: "Damage Dealer", desc: 'Weapon: Psi Blades' },
    adept: { name: "Adept", role: "Damage Dealer", desc: 'Weapon: Glaive Cannon' },
    sentry: { name: "Sentry", role: "Lifesaver", desc: 'Weapon: Disruption Beam' },
    stalker: { name: "Stalker", role: "Elite Damage Dealer", desc: 'Weapon: Particle Disruptors' },
    pylon: { name: "Pylon", role: "Tactical Structure", desc: 'WARP FIELD GENERATOR' }
};

// UI Elements Cache
const elements = {
    body: document.body,
    btnStopAll: document.getElementById('btn-stop-all'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabViews: document.querySelectorAll('.tab-view'),
    volumeOst: document.getElementById('volume-ost'),
    volOstVal: document.getElementById('vol-ost-val'),
    volumeSfx: document.getElementById('volume-sfx'),
    volSfxVal: document.getElementById('vol-sfx-val'),
    
    // OST Elements
    ostStatus: document.getElementById('ost-status-indicator'),
    ostTrackTitle: document.getElementById('ost-track-title'),
    btnOstPlayPause: document.getElementById('btn-ost-play-pause'),
    chkSC1: document.getElementById('version-sc1'),
    chkSC2: document.getElementById('version-sc2'),
    chkTerran: document.getElementById('race-terran'),
    chkZerg: document.getElementById('race-zerg'),
    chkProtoss: document.getElementById('race-protoss'),
    
    // Faction containers
    terranContainer: document.getElementById('terran-unit-container'),
    zergContainer: document.getElementById('zerg-unit-container'),
    protossContainer: document.getElementById('protoss-unit-container'),
    
    // Search
    searchContainer: document.getElementById('search-container'),
    unitSearch: document.getElementById('unit-search'),
    clearSearch: document.getElementById('clear-search')
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    renderAllUnitBoards();
});

function initEvents() {
    // Faction View Navigation Buttons
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const faction = tab.getAttribute('data-tab');
            switchTab(faction);
        });
    });

    // Volume Sliders
    elements.volumeOst.addEventListener('input', (e) => {
        musicVolume = parseInt(e.target.value) / 100;
        elements.volOstVal.textContent = e.target.value + '%';
        if (currentMusicAudio) {
            currentMusicAudio.volume = musicVolume;
        }
    });

    elements.volumeSfx.addEventListener('input', (e) => {
        sfxVolume = parseInt(e.target.value) / 100;
        elements.volSfxVal.textContent = e.target.value + '%';
        activeSfxAudios.forEach(audio => {
            audio.volume = sfxVolume;
        });
    });

    // Master Stop Button Safety Check (Button removed in index.html, check prevents runtime crashes)
    if (elements.btnStopAll) {
        elements.btnStopAll.addEventListener('click', stopAllSounds);
    }

    // OST Play/Pause Button
    elements.btnOstPlayPause.addEventListener('click', toggleMusic);

    // OST Playlist Checkbox Changes with real-time HUD toast notification banners
    const playlistToggles = [
        { el: elements.chkSC1, label: "StarCraft I OST" },
        { el: elements.chkSC2, label: "StarCraft II OST" },
        { el: elements.chkTerran, label: "Terran themed OST" },
        { el: elements.chkZerg, label: "Zerg themed OST" },
        { el: elements.chkProtoss, label: "Protoss themed OST" }
    ];
    playlistToggles.forEach(toggle => {
        if (toggle.el) {
            toggle.el.addEventListener('change', (e) => {
                const action = e.target.checked ? "added to" : "removed from";
                showToast(`${toggle.label} ${action} playlist`);
                
                // Re-shuffle playlist dynamically on next play, or if currently playing
                buildPlaylist();
            });
        }
    });

    // Search Box Listener
    elements.unitSearch.addEventListener('input', filterUnits);
    elements.clearSearch.addEventListener('click', () => {
        elements.unitSearch.value = '';
        filterUnits();
    });
}

/* ==========================================================================
   THEME MORPHING & NAVIGATION
   ========================================================================== */
function switchTab(faction) {
    activeTab = faction;
    
    // Remove active styles from nav tabs
    elements.tabs.forEach(t => t.classList.remove('active'));
    elements.tabViews.forEach(v => v.classList.remove('active'));

    // Highlight selected nav and display corresponding tab content
    const selectedTab = document.querySelector(`.tab-btn[data-tab="${faction}"]`);
    const selectedView = document.getElementById(`view-${faction}`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedView) selectedView.classList.add('active');

    // Switch Body Faction Class for morphic style sheet transitions
    elements.body.className = `theme-${faction === 'ost' ? 'neutral' : faction}`;

    // Toggle Search Bar Visibility
    if (faction === 'ost') {
        elements.searchContainer.classList.add('hidden');
    } else {
        elements.searchContainer.classList.remove('hidden');
        // Reset Search Input on tab change
        elements.unitSearch.value = '';
        filterUnits();
    }
}

/* ==========================================================================
   OST MUSIC PLAYER ENGINE
   ========================================================================== */
function buildPlaylist() {
    const includeSC1 = elements.chkSC1.checked;
    const includeSC2 = elements.chkSC2.checked;
    const includeTerran = elements.chkTerran.checked;
    const includeZerg = elements.chkZerg.checked;
    const includeProtoss = elements.chkProtoss.checked;

    let playlist = [];

    // Safety fallback: if nothing checked, select all
    if (!includeSC1 && !includeSC2) {
        elements.chkSC1.checked = true;
        elements.chkSC2.checked = true;
        buildPlaylist();
        return;
    }
    if (!includeTerran && !includeZerg && !includeProtoss) {
        elements.chkTerran.checked = true;
        buildPlaylist();
        return;
    }

    const ostData = window.AUDIO_REGISTRY.ost;

    const versions = [];
    if (includeSC1) versions.push('starcraft1');
    if (includeSC2) versions.push('starcraft2');

    const races = [];
    if (includeTerran) races.push('terran');
    if (includeZerg) races.push('zerg');
    if (includeProtoss) races.push('protoss');

    versions.forEach(v => {
        races.forEach(r => {
            if (ostData[v] && ostData[v][r]) {
                playlist = playlist.concat(ostData[v][r]);
            }
        });
    });

    currentPlaylist = playlist;
    // Reset shuffled queue when playlist configurations change
    shuffledQueue = [];
}

// Fisher-Yates Shuffle with standard ES5 swap for guaranteed cross-browser compatibility
function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

function getNextTrack() {
    if (currentPlaylist.length === 0) {
        buildPlaylist();
    }
    
    if (shuffledQueue.length === 0) {
        shuffledQueue = shuffleArray(currentPlaylist);
        console.log("Playlist shuffled. New queue contains " + shuffledQueue.length + " tracks.");
    }
    
    // Choose a random index from the shuffled queue to guarantee absolute initial randomness and avoid repetitive start biases
    const randomIndex = Math.floor(Math.random() * shuffledQueue.length);
    const track = shuffledQueue[randomIndex];
    shuffledQueue.splice(randomIndex, 1);
    
    console.log("Selected track: " + track + " | Remaining in queue: " + shuffledQueue.length);
    return track;
}

function toggleMusic() {
    if (currentMusicAudio && !currentMusicAudio.paused) {
        // Currently playing: Pause it
        currentMusicAudio.pause();
        updateMusicUI(false);
    } else {
        // Paused or Idle: Start a new random track
        playNextMusicTrack();
    }
}

function playNextMusicTrack() {
    if (currentMusicAudio) {
        currentMusicAudio.pause();
        currentMusicAudio = null;
    }

    const nextTrack = getNextTrack();
    if (!nextTrack) {
        elements.ostTrackTitle.textContent = "NO TRACKS IN CONFIGURED PLAYLIST";
        elements.ostStatus.textContent = "ERROR";
        return;
    }

    currentMusicAudio = new Audio(nextTrack);
    currentMusicAudio.volume = musicVolume;
    
    // Automatically shuffle on end
    currentMusicAudio.onended = () => {
        playNextMusicTrack();
    };

    currentMusicAudio.play().then(() => {
        updateMusicUI(true, nextTrack);
    }).catch(err => {
        console.error("Audio playback error:", err);
        elements.ostStatus.textContent = "TAP PLAY TO ENABLE BROWSER AUDIO";
        updateMusicUI(false);
    });
}

function updateMusicUI(isPlaying, trackPath = '') {
    if (isPlaying) {
        elements.btnOstPlayPause.classList.add('playing');
        elements.btnOstPlayPause.innerHTML = `<span class="play-icon">⏸</span> PAUSE MUSIC`;
        elements.ostStatus.textContent = "TRANSMITTING BATTLE OST";
        elements.ostStatus.style.color = "var(--hud-accent)";
        
        // Clean track path for user readability (e.g. SC1_Terran1.ogg -> SC1 - Terran 1)
        if (trackPath) {
            let cleanName = trackPath.split('/').pop().replace(/\.[^/.]+$/, "");
            cleanName = cleanName.replace('SC1_', 'SC1 - ').replace('SC2-', ' - ');
            // Capitalize race name
            cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
            elements.ostTrackTitle.textContent = cleanName.toUpperCase();
        }
    } else {
        elements.btnOstPlayPause.classList.remove('playing');
        elements.btnOstPlayPause.innerHTML = `<span class="play-icon">▶</span> PLAY MUSIC`;
        elements.ostStatus.textContent = "PAUSED";
        elements.ostStatus.style.color = "var(--hud-accent-secondary)";
    }
}

/* ==========================================================================
   SFX SOUNDBOARD ENGINE
   ========================================================================== */
function playSfx(trackPath, cardElement = null) {
    if (!trackPath) return;

    const audio = new Audio(trackPath);
    audio.volume = sfxVolume;

    // Track active SFX to support "STOP ALL"
    activeSfxAudios.add(audio);
    
    // Add visual glowing indicator on card when sound triggers
    if (cardElement) {
        incrementCardActivePlaying(cardElement);
        audio.onended = () => {
            decrementCardActivePlaying(cardElement);
            activeSfxAudios.delete(audio);
        };
        audio.onerror = () => {
            decrementCardActivePlaying(cardElement);
            activeSfxAudios.delete(audio);
        };
    } else {
        audio.onended = () => {
            activeSfxAudios.delete(audio);
        };
        audio.onerror = () => {
            activeSfxAudios.delete(audio);
        };
    }

    audio.play().catch(e => console.error("SFX audio blocked by browser: ", e));
}

// Visual active playing classes (supports multiple overlapping tracks per unit card)
function incrementCardActivePlaying(cardElement) {
    let playCount = parseInt(cardElement.getAttribute('data-play-count') || '0');
    playCount++;
    cardElement.setAttribute('data-play-count', playCount.toString());
    cardElement.classList.add('active-playing');
}

function decrementCardActivePlaying(cardElement) {
    let playCount = parseInt(cardElement.getAttribute('data-play-count') || '0');
    playCount = Math.max(0, playCount - 1);
    cardElement.setAttribute('data-play-count', playCount.toString());
    
    if (playCount === 0) {
        cardElement.classList.remove('active-playing');
    }
}

function playRandomSfxFromList(sfxList, cardElement) {
    if (!sfxList || sfxList.length === 0) return;
    const randomIndex = Math.floor(Math.random() * sfxList.length);
    playSfx(sfxList[randomIndex], cardElement);
}

// Complex multi-track triggers
function handleDeathSFX(unitObj, cardElement) {
    // 1. Play standard death
    if (unitObj.death && unitObj.death.length > 0) {
        playRandomSfxFromList(unitObj.death, cardElement);
    }
    
    // 2. Play deathFX simultaneously if present
    if (unitObj.deathFX && unitObj.deathFX.length > 0) {
        playRandomSfxFromList(unitObj.deathFX, cardElement);
    }
}

function handleStimpackSFX(unitObj, cardElement) {
    // Play stimpack sound + stimpackVO sound simultaneously
    if (unitObj.stimpack && unitObj.stimpack.length > 0) {
        playRandomSfxFromList(unitObj.stimpack, cardElement);
    }
    if (unitObj.stimpackVO && unitObj.stimpackVO.length > 0) {
        playRandomSfxFromList(unitObj.stimpackVO, cardElement);
    }
}

function stopAllSounds() {
    // Stop all SFX
    activeSfxAudios.forEach(audio => {
        audio.pause();
    });
    activeSfxAudios.clear();

    // Pause Background OST (keeps playlist shuffled state intact)
    if (currentMusicAudio) {
        currentMusicAudio.pause();
        updateMusicUI(false);
    }

    // Reset visual active states on all unit cards
    document.querySelectorAll('.unit-card').forEach(card => {
        card.setAttribute('data-play-count', '0');
        card.classList.remove('active-playing');
    });
}

/* ==========================================================================
   INTERACTIVE HUD TOAST BANNERS
   ========================================================================== */
function showToast(message) {
    let container = document.getElementById('hud-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'hud-notification-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger reflow to start transition
    toast.offsetHeight;

    // Add show class
    toast.classList.add('show');

    // Auto fade out and remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 3000);
}

/* ==========================================================================
   DYNAMIC UI GENERATION
   ========================================================================== */
function renderAllUnitBoards() {
    const unitsData = window.AUDIO_REGISTRY.units;

    // Render Terran
    renderFactionUnits('terran', unitsData.terran, elements.terranContainer);
    // Render Zerg
    renderFactionUnits('zerg', unitsData.zerg, elements.zergContainer);
    // Render Protoss
    renderFactionUnits('protoss', unitsData.protoss, elements.protossContainer);
}

function renderFactionUnits(factionName, factionUnits, container) {
    container.innerHTML = '';
    
    if (!factionUnits || Object.keys(factionUnits).length === 0) {
        container.innerHTML = '<div class="no-results">SYSTEM FAILURE: FACTION DATA CORRUPT</div>';
        return;
    }

    Object.keys(factionUnits).forEach(unitKey => {
        const unitObj = factionUnits[unitKey];
        const meta = UNIT_METADATA[unitKey] || { name: unitKey, role: "FIGHTER", desc: "Wargame asset" };
        
        // Check structural flags
        const isStructure = (unitKey === 'pylon' || unitKey === 'omega_worm');

        // Create Card Element
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.setAttribute('data-unit-name', meta.name.toLowerCase());
        card.setAttribute('data-play-count', '0');

        // Render card inner HTML structure
        let htmlContent = `
            <div class="unit-header" onclick="toggleCard(this.parentNode)">
                <div style="display: flex; align-items: center;">
                    <div class="sound-indicator"></div>
                    <div class="unit-title-group">
                        <span class="unit-name">${meta.name}</span>
                        <span class="unit-role">${meta.role}</span>
                    </div>
                </div>
                <span class="chevron-icon">▼</span>
            </div>
            
            <div class="unit-body">
                <!-- Unit Flavor Description -->
                <div style="font-size: 0.65rem; color: var(--hud-text-muted); margin-bottom: 15px; border-left: 2px solid var(--hud-border); padding-left: 8px;">
                    ${meta.desc.toUpperCase()}
                </div>
                
                <div class="btn-matrix">
        `;

        // 1. Structural vs Mobile Unit button configuration
        if (isStructure) {
            // Structures only get Deploy and Death
            htmlContent += `
                <button class="sfx-btn btn-deploy" id="btn-${unitKey}-deploy">DEPLOY</button>
                <button class="sfx-btn btn-death" id="btn-${unitKey}-death">DESTROYED</button>
            `;
        } else {
            // Standard Mobile Unit Grid
            // Deploy / Ready Mapping
            const hasDeploy = (unitObj.deploy && unitObj.deploy.length > 0) || (unitObj.ready && unitObj.ready.length > 0);
            if (hasDeploy) {
                const label = unitObj.ready ? "READY" : "DEPLOY";
                htmlContent += `<button class="sfx-btn btn-deploy" id="btn-${unitKey}-deploy">${label}</button>`;
            }

            if (unitObj.move && unitObj.move.length > 0) {
                htmlContent += `<button class="sfx-btn" id="btn-${unitKey}-move">MOVE</button>`;
            }
            
            if (unitObj.attack && unitObj.attack.length > 0) {
                const label = (unitKey === 'zergling') ? "MELEE COMBAT" : "ATTACK";
                htmlContent += `<button class="sfx-btn" id="btn-${unitKey}-attack">${label}</button>`;
            }

            if (unitObj.heal && unitObj.heal.length > 0) {
                htmlContent += `<button class="sfx-btn" id="btn-${unitKey}-heal">HEAL</button>`;
            }

            if (unitObj.combat && unitObj.combat.length > 0) {
                htmlContent += `<button class="sfx-btn" id="btn-${unitKey}-combat">MELEE COMBAT</button>`;
            }
            
            if (unitObj.death && unitObj.death.length > 0) {
                htmlContent += `<button class="sfx-btn btn-death" id="btn-${unitKey}-death">DESTROYED</button>`;
            }
        }

        htmlContent += `</div>`; // Close standard btn-matrix

        // 2. Additional Abilities Section (Burrow, Stimpack, and custom Scanned abilities under a single separator)
        const hasBurrow = (unitObj.burrow && unitObj.burrow.length > 0) && (unitObj.unburrow && unitObj.unburrow.length > 0);
        const hasStimpack = (unitObj.stimpack && unitObj.stimpack.length > 0);
        const standardKeys = [
            'deploy', 'ready', 'move', 'attack', 'death', 'deathFX', 
            'burrow', 'unburrow', 'stimpack', 'stimpackVO', 'heal', 'combat'
        ];
        const extraKeys = Object.keys(unitObj).filter(k => !standardKeys.includes(k));

        if (hasBurrow || hasStimpack || extraKeys.length > 0) {
            htmlContent += `
                <div class="special-divider">
                    <div class="special-line"></div>
                    <div class="special-title">ADDITIONAL ABILITIES</div>
                    <div class="special-line"></div>
                </div>
            `;

            if (hasBurrow) {
                htmlContent += `
                    <div class="btn-matrix">
                        <button class="sfx-btn special-btn" id="btn-${unitKey}-burrow">BURROW</button>
                        <button class="sfx-btn special-btn" id="btn-${unitKey}-unburrow">UNBURROW</button>
                    </div>
                `;
            }

            if (hasStimpack) {
                htmlContent += `
                    <div class="btn-matrix">
                        <button style="grid-column: span 2;" class="sfx-btn special-btn" id="btn-${unitKey}-stimpack">STIMPACK</button>
                    </div>
                `;
            }

            if (extraKeys.length > 0) {
                htmlContent += `
                    <div class="extra-btn-matrix">
                `;
                extraKeys.forEach(k => {
                    const label = k.replace('_', ' ').toUpperCase();
                    htmlContent += `<button class="sfx-btn special-btn" id="btn-${unitKey}-${k}">${label}</button>`;
                });
                htmlContent += `</div>`; // Close extra-btn-matrix
            }
        }

        htmlContent += `</div>`; // Close unit-body
        card.innerHTML = htmlContent;
        container.appendChild(card);

        // Bind Sound Trigger Events dynamically to generated elements
        bindUnitBtnEvents(unitKey, unitObj, card, isStructure);
    });
}

function bindUnitBtnEvents(unitKey, unitObj, cardElement, isStructure) {
    const bindEl = (id, callback) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid triggering accordion card collapse
                callback();
            });
        }
    };

    // Standard buttons binding
    if (isStructure) {
        bindEl(`btn-${unitKey}-deploy`, () => playRandomSfxFromList(unitObj.deploy, cardElement));
        bindEl(`btn-${unitKey}-death`, () => handleDeathSFX(unitObj, cardElement));
    } else {
        // Deploy/Ready
        if (unitObj.deploy) {
            bindEl(`btn-${unitKey}-deploy`, () => playRandomSfxFromList(unitObj.deploy, cardElement));
        } else if (unitObj.ready) {
            bindEl(`btn-${unitKey}-deploy`, () => playRandomSfxFromList(unitObj.ready, cardElement));
        }
        
        // Move, Attack, Death, Heal, Combat
        bindEl(`btn-${unitKey}-move`, () => playRandomSfxFromList(unitObj.move, cardElement));
        bindEl(`btn-${unitKey}-attack`, () => playRandomSfxFromList(unitObj.attack, cardElement));
        bindEl(`btn-${unitKey}-death`, () => handleDeathSFX(unitObj, cardElement));
        bindEl(`btn-${unitKey}-heal`, () => playRandomSfxFromList(unitObj.heal, cardElement));
        bindEl(`btn-${unitKey}-combat`, () => playRandomSfxFromList(unitObj.combat, cardElement));
    }

    // Special soundboard bindings
    bindEl(`btn-${unitKey}-burrow`, () => playRandomSfxFromList(unitObj.burrow, cardElement));
    bindEl(`btn-${unitKey}-unburrow`, () => playRandomSfxFromList(unitObj.unburrow, cardElement));
    bindEl(`btn-${unitKey}-stimpack`, () => handleStimpackSFX(unitObj, cardElement));

    // Custom Scanned Extra Buttons Binding
    const standardKeys = [
        'deploy', 'ready', 'move', 'attack', 'death', 'deathFX', 
        'burrow', 'unburrow', 'stimpack', 'stimpackVO', 'heal', 'combat'
    ];
    Object.keys(unitObj).forEach(k => {
        if (!standardKeys.includes(k)) {
            bindEl(`btn-${unitKey}-${k}`, () => playRandomSfxFromList(unitObj[k], cardElement));
        }
    });
}

// Collapsible accordion card toggling
window.toggleCard = function(cardElement) {
    cardElement.classList.toggle('expanded');
};

/* ==========================================================================
   TACTICAL HUD FILTERING (SEARCH BAR)
   ========================================================================== */
function filterUnits() {
    const query = elements.unitSearch.value.trim().toLowerCase();
    
    // Find unit cards inside the active faction tab container
    const activeContainerId = `${activeTab}-unit-container`;
    const container = document.getElementById(activeContainerId);
    if (!container) return;

    const cards = container.querySelectorAll('.unit-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const name = card.getAttribute('data-unit-name') || '';
        if (name.includes(query)) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Handle "No Results" notice rendering
    let noResultsNotice = container.querySelector('.no-results-banner');
    if (visibleCount === 0) {
        if (!noResultsNotice) {
            noResultsNotice = document.createElement('div');
            noResultsNotice.className = 'no-results-banner no-results';
            noResultsNotice.textContent = "COULD NOT LOCATE SPECIFIED WARGAME OBJECT";
            container.appendChild(noResultsNotice);
        }
    } else {
        if (noResultsNotice) {
            noResultsNotice.remove();
        }
    }
}
