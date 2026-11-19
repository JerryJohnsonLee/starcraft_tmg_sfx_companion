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
const roleFiltersByFaction = new Map();

// Per-unit SFX bank selection (StarCraft I vs StarCraft II audio), persisted across reloads.
const SFX_BANKS = { sc1: 'SC1', sc2: 'SC2' };
const DEFAULT_SFX_BANK = 'sc2';
const sfxBankStorageKey = (faction, unitKey) => `sfxBank:${faction}/${unitKey}`;
const unitModeStorageKey = (faction, storageKey) => `unitMode:${faction}/${storageKey}`;

// Offline awareness, fed by offline.js. While the device is offline, only sounds stored in the media cache can play;
// everything else is dimmed with a message. While online nothing is restricted.
const offlineState = { isOffline: false, cachedUrls: new Set() };
const OFFLINE_HINT = 'Reconnect and use "Offline Settings" in the Control Center to save sounds for offline use.';

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
    clearSearch: document.getElementById('clear-search'),
    openRoleFilter: document.getElementById('open-role-filter'),
    roleFilterCount: document.getElementById('role-filter-count'),
    roleFilterDialog: document.getElementById('role-filter-dialog'),
    closeRoleFilter: document.getElementById('close-role-filter'),
    clearRoleFilters: document.getElementById('clear-role-filters'),
    applyRoleFilters: document.getElementById('apply-role-filters'),
    roleFilterFaction: document.getElementById('role-filter-faction'),
    armySlotOptions: document.getElementById('army-slot-options'),
    combatRoleOptions: document.getElementById('combat-role-options')
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

    elements.openRoleFilter.addEventListener('click', openRoleFilterDialog);
    elements.closeRoleFilter.addEventListener('click', () => elements.roleFilterDialog.close());
    elements.applyRoleFilters.addEventListener('click', () => elements.roleFilterDialog.close());
    elements.clearRoleFilters.addEventListener('click', clearActiveRoleFilters);
    elements.roleFilterDialog.addEventListener('click', event => {
        if (event.target === elements.roleFilterDialog) elements.roleFilterDialog.close();
    });
    [elements.armySlotOptions, elements.combatRoleOptions].forEach(options => {
        options.addEventListener('change', event => {
            if (!event.target.matches('input[type="checkbox"]')) return;
            const filters = getActiveRoleFilters();
            const selected = event.target.dataset.filterGroup === 'army-slot' ? filters.armySlots : filters.combatRoles;
            if (event.target.checked) selected.add(event.target.value);
            else selected.delete(event.target.value);
            updateRoleFilterButton();
            filterUnits();
        });
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
        updateRoleFilterButton();
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

    // Offline, only the tracks saved on this device can play.
    currentPlaylist = playlist.filter(isUrlPlayable);
    // Reset shuffled queue when playlist configurations change
    shuffledQueue = [];
    refreshMusicOfflineNotice(playlist.length);
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
        elements.ostTrackTitle.textContent = offlineState.isOffline ? "NO SAVED TRACKS AVAILABLE OFFLINE" : "NO TRACKS IN CONFIGURED PLAYLIST";
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
// `earlyNext` ({ afterSeconds, callback }) fires `callback` that many seconds after the clip actually starts playing,
// so a following clip can overlap it. It is skipped when the clip already ended or was stopped.
function playSfx(trackPath, cardElement = null, onComplete = null, earlyNext = null) {
    if (!trackPath) {
        if (onComplete) onComplete();
        return null;
    }

    const audio = new Audio(trackPath);
    audio.volume = sfxVolume;
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        if (cardElement) decrementCardActivePlaying(cardElement);
        activeSfxAudios.delete(audio);
        if (onComplete) onComplete();
    };

    // Track active SFX to support "STOP ALL"
    activeSfxAudios.add(audio);
    
    // Add visual glowing indicator on card when sound triggers
    if (cardElement) {
        incrementCardActivePlaying(cardElement);
    }
    audio.onended = finish;
    audio.onerror = finish;

    if (earlyNext) {
        // Counted from the moment playback really starts (after loading), not from the click.
        audio.addEventListener('playing', () => {
            setTimeout(() => {
                if (!finished && activeSfxAudios.has(audio)) earlyNext.callback();
            }, earlyNext.afterSeconds * 1000);
        }, { once: true });
    }

    audio.play().catch(e => {
        console.error("SFX audio blocked by browser: ", e);
        finish();
    });
    return audio;
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

// Sources an ability plays: the SC1 override (sc1_sound_sources) when the card is on the SC1 bank and defines one.
function getAbilitySources(ability, bank) {
    return (bank === 'sc1' && ability.sc1_sound_sources) ? ability.sc1_sound_sources : (ability.sound_sources || []);
}

function playConfiguredAbility(ability, unitAudio, cardElement, bank) {
    const steps = getAbilitySources(ability, bank)
        .map(source => ({ source, trackList: unitAudio[source] || [] }))
        .filter(step => step.trackList.length > 0)
        .map(step => ({ source: step.source, track: step.trackList[Math.floor(Math.random() * step.trackList.length)] }));
    if (steps.length === 0) return;

    if (ability.playback === 'sequential') {
        // Sources listed in `overlap_sources` start `overlap_seconds` after the previous clip started (or when it
        // ends, if it is shorter) instead of after it ended.
        const overlapList = (bank === 'sc1' && ability.sc1_overlap_sources) ? ability.sc1_overlap_sources : (ability.overlap_sources || []);
        const overlapSources = new Set(overlapList);
        const overlapSeconds = Number(ability.overlap_seconds || 0);

        const playNext = index => {
            if (index >= steps.length) return;
            const next = steps[index + 1];
            const startsNextEarly = !!next && overlapSeconds > 0 && overlapSources.has(next.source);

            // The next step may be triggered early (overlap) or when this clip ends; only the first trigger counts.
            let hasAdvanced = false;
            const advance = () => {
                if (hasAdvanced) return;
                hasAdvanced = true;
                playNext(index + 1);
            };
            playSfx(steps[index].track, cardElement, advance, startsNextEarly ? { afterSeconds: overlapSeconds, callback: advance } : null);
        };
        playNext(0);
        return;
    }

    steps.forEach(step => playSfx(step.track, cardElement));
}

/* ==========================================================================
   SFX BANK (SC1 / SC2) SELECTION
   ========================================================================== */
function getSfxBank(faction, unitKey) {
    try {
        const stored = localStorage.getItem(sfxBankStorageKey(faction, unitKey));
        return stored in SFX_BANKS ? stored : DEFAULT_SFX_BANK;
    } catch (e) {
        return DEFAULT_SFX_BANK;
    }
}

function setSfxBank(faction, unitKey, bank) {
    try {
        localStorage.setItem(sfxBankStorageKey(faction, unitKey), bank);
    } catch (e) {
        console.warn('SFX bank preference could not be saved:', e);
    }
}

/* ==========================================================================
   UNIT MODES (e.g. Nova: Stealth / Assault)
   ========================================================================== */
function getUnitMode(faction, group) {
    try {
        const stored = localStorage.getItem(unitModeStorageKey(faction, group.storageKey));
        return group.modes.find(mode => mode.unitKey === stored) || group.modes[0];
    } catch (e) {
        return group.modes[0];
    }
}

function setUnitMode(faction, group, mode) {
    try {
        localStorage.setItem(unitModeStorageKey(faction, group.storageKey), mode.unitKey);
    } catch (e) {
        console.warn('Unit mode preference could not be saved:', e);
    }
}

function renderModeToggle(faction, group, activeMode) {
    const buttons = group.modes.map(mode => {
        const isActive = mode === activeMode;
        return `<button type="button" class="bank-toggle-btn${isActive ? ' active' : ''}" data-mode="${escapeHtml(mode.unitKey)}" aria-pressed="${isActive}">${escapeHtml(mode.label.toUpperCase())}</button>`;
    }).join('');
    return `<div class="bank-toggle" role="group" aria-label="Mode for ${escapeHtml(group.title)}" data-e2e-id="mode-toggle-${faction}-${group.storageKey}">${buttons}</div>`;
}

// Returns the audio map used for playback: SC1 folders when selected and present, SC2 otherwise (per source key).
function resolveUnitAudio(unitAudio, sc1Audio, bank) {
    if (bank !== 'sc1' || !sc1Audio) return unitAudio;
    const resolved = { ...unitAudio };
    Object.keys(sc1Audio).forEach(source => {
        if (sc1Audio[source] && sc1Audio[source].length > 0) resolved[source] = sc1Audio[source];
    });
    return resolved;
}

// Sound sources referenced by the unit config that have no SC1 files and therefore fall back to SC2.
function getSc1FallbackSources(config, sc1Audio) {
    const configured = [...Object.values(config.regular_abilities || {}), ...Object.values(config.additional_abilities || {})]
        .flatMap(ability => getAbilitySources(ability, 'sc1'));
    return [...new Set(configured)].filter(source => !(sc1Audio[source] && sc1Audio[source].length > 0));
}

function renderBankToggle(faction, unitKey, bank, fallbackSources) {
    const fallbackNote = fallbackSources.length > 0
        ? `SC1 bank: SC2 sounds are used for ${fallbackSources.map(abilityLabel).join(', ')}`
        : 'SC1 bank: complete StarCraft I audio';
    const buttons = Object.keys(SFX_BANKS).map(key => {
        const isActive = key === bank;
        return `<button type="button" class="bank-toggle-btn${isActive ? ' active' : ''}" data-bank="${key}" aria-pressed="${isActive}">${SFX_BANKS[key]}</button>`;
    }).join('');
    return `<div class="bank-toggle" role="group" aria-label="Sound effects bank for ${escapeHtml(unitKey)}" title="${escapeHtml(fallbackNote)}" data-e2e-id="bank-toggle-${faction}-${unitKey}">${buttons}</div>`;
}

// Static marker for units that only have StarCraft I audio (`unit.audio_source: sc1`), so there is nothing to switch.
function renderSc1OnlyBadge(faction, unitKey) {
    return `<span class="bank-badge" title="This unit only has StarCraft I audio" data-e2e-id="bank-badge-${faction}-${unitKey}">${SFX_BANKS.sc1}</span>`;
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
   OFFLINE AWARENESS
   ========================================================================== */
// Called by offline.js whenever the connection or the stored sounds change.
function setOfflineState(isOffline, cachedUrls) {
    offlineState.isOffline = isOffline;
    offlineState.cachedUrls = cachedUrls;

    document.querySelectorAll('.unit-card').forEach(card => {
        if (card.applyOfflineAvailability) card.applyOfflineAvailability();
    });
    FACTION_NAMES.forEach(refreshFactionOfflineNotice);
    buildPlaylist();
}

const FACTION_NAMES = ['terran', 'zerg', 'protoss'];

function isUrlPlayable(url) {
    return !offlineState.isOffline || offlineState.cachedUrls.has(new URL(url, document.baseURI).href);
}

// An ability is playable when every sound source it uses (with files) has at least one playable file.
// Sources without any file are not an offline matter: online they do nothing either.
function isAbilityPlayable(ability, unitAudio, bank) {
    return getAbilitySources(ability, bank)
        .map(source => unitAudio[source] || [])
        .filter(trackList => trackList.length > 0)
        .every(trackList => trackList.some(isUrlPlayable));
}

function getAbilityForButton(config, button) {
    return button.dataset.abilityGroup === 'additional'
        ? config.additional_abilities[button.dataset.abilityKey]
        : config.regular_abilities[button.dataset.abilityKey];
}

// One notice above each faction's unit list that explains why buttons are dimmed.
function createFactionOfflineNotice(factionName, container) {
    const notice = document.createElement('div');
    notice.id = `offline-notice-${factionName}`;
    notice.className = 'offline-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('data-e2e-id', `offline-notice-${factionName}`);
    notice.hidden = true;
    container.parentNode.insertBefore(notice, container);
}

function refreshFactionOfflineNotice(factionName) {
    const notice = document.getElementById(`offline-notice-${factionName}`);
    if (!notice) return;

    const buttons = [...document.querySelectorAll(`#${factionName}-unit-container .config-ability-btn`)];
    const unavailableCount = buttons.filter(button => button.disabled).length;
    notice.hidden = !offlineState.isOffline || unavailableCount === 0;
    if (notice.hidden) return;

    notice.textContent = unavailableCount === buttons.length
        ? `You are offline and no ${factionName} sounds are saved on this device. ${OFFLINE_HINT}`
        : `You are offline: ${unavailableCount} ${unavailableCount === 1 ? 'button is' : 'buttons are'} dimmed because their sounds are not saved on this device. ${OFFLINE_HINT}`;
}

// `selectionCount` = tracks in the current music selection, before the offline filter.
function refreshMusicOfflineNotice(selectionCount) {
    const notice = document.getElementById('ost-offline-notice');
    if (!notice) return;

    const savedCount = currentPlaylist.length;
    const isPlaying = !!currentMusicAudio && !currentMusicAudio.paused;
    const isMissingTracks = offlineState.isOffline && savedCount < selectionCount;

    notice.hidden = !isMissingTracks;
    elements.btnOstPlayPause.disabled = offlineState.isOffline && savedCount === 0 && !isPlaying;
    if (!isMissingTracks) return;

    notice.textContent = savedCount === 0
        ? `You are offline and no battle music is saved on this device. ${OFFLINE_HINT}`
        : `You are offline: only the ${savedCount} of ${selectionCount} tracks saved on this device will play. ${OFFLINE_HINT}`;
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

// Config-driven renderer: unit cards and triggers are defined in each config.yaml
// and embedded in AUDIO_REGISTRY by generate-registry.ps1.
function renderAllUnitBoards() {
    const registry = window.AUDIO_REGISTRY;
    const sc1 = registry.unitsSC1 || {};
    renderFactionUnits('terran', registry.units.terran, registry.unitConfigs.terran, sc1.terran, elements.terranContainer);
    renderFactionUnits('zerg', registry.units.zerg, registry.unitConfigs.zerg, sc1.zerg, elements.zergContainer);
    renderFactionUnits('protoss', registry.units.protoss, registry.unitConfigs.protoss, sc1.protoss, elements.protossContainer);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function abilityLabel(key) {
    return key.replace(/_/g, ' ').toUpperCase();
}

function renderFactionUnits(factionName, factionUnits, factionConfigs, factionSc1Units, container) {
    container.innerHTML = '';
    if (!factionUnits || Object.keys(factionUnits).length === 0) {
        container.innerHTML = '<div class="no-results">SYSTEM FAILURE: FACTION DATA CORRUPT</div>';
        return;
    }

    createFactionOfflineNotice(factionName, container);
    groupUnitModes(factionName, factionUnits, factionConfigs, factionSc1Units)
        .forEach(group => renderUnitCard(factionName, group, container));
}

// Units whose config.yaml share the same `unit.mode_group` (e.g. the two Nova cards) are rendered as ONE card
// with a mode toggle. Every mode keeps its own config (weapon, abilities) and its own sound folders.
function groupUnitModes(factionName, factionUnits, factionConfigs, factionSc1Units) {
    const groups = [];
    const groupsByName = {};

    Object.keys(factionUnits).forEach(unitKey => {
        const config = factionConfigs && factionConfigs[unitKey];
        if (!config || !config.unit) throw new Error(`Missing generated config for ${factionName}/${unitKey}`);
        const mode = {
            unitKey,
            config,
            unitAudio: factionUnits[unitKey],
            sc1Audio: (factionSc1Units && factionSc1Units[unitKey]) || null,
            label: config.unit.mode_label || unitKey
        };
        const groupName = config.unit.mode_group;
        if (!groupName) {
            groups.push({ title: config.unit.name || unitKey, storageKey: unitKey, modes: [mode] });
            return;
        }
        if (!groupsByName[groupName]) {
            groupsByName[groupName] = { title: groupName, storageKey: groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_'), modes: [] };
            groups.push(groupsByName[groupName]);
        }
        groupsByName[groupName].modes.push(mode);
    });

    // Optional `unit.mode_order` (1, 2, ...) sets the toggle order; the first mode is the default one.
    groups.forEach(group => group.modes.sort((a, b) => Number(a.config.unit.mode_order || 0) - Number(b.config.unit.mode_order || 0)));

    return groups;
}

function renderUnitCard(factionName, group, container) {
    const hasModes = group.modes.length > 1;
    const primary = group.modes[0];
    let activeMode = hasModes ? getUnitMode(factionName, group) : primary;

    // The SC1/SC2 bank toggle only exists on single-mode cards (mode cards use the same slot for the mode toggle).
    const sc1Audio = hasModes ? null : primary.sc1Audio;
    const hasSc1Bank = !!sc1Audio && Object.keys(sc1Audio).length > 0;
    let activeBank = hasSc1Bank ? getSfxBank(factionName, primary.unitKey) : DEFAULT_SFX_BANK;

    const unitName = hasModes ? group.title : (primary.config.unit.name || primary.unitKey);
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.setAttribute('data-unit-name', unitName.toLowerCase());
    card.setAttribute('data-play-count', '0');

    const headerToggle = hasModes
        ? renderModeToggle(factionName, group, activeMode)
        : (hasSc1Bank ? renderBankToggle(factionName, primary.unitKey, activeBank, getSc1FallbackSources(primary.config, sc1Audio))
            : (primary.config.unit.audio_source === 'sc1' ? renderSc1OnlyBadge(factionName, primary.unitKey) : ''));

    card.innerHTML = `
        <div class="unit-header" onclick="toggleCard(this.parentNode)">
            <div style="display: flex; align-items: center;">
                <div class="sound-indicator"></div>
                <div class="unit-title-group">
                    <span class="unit-name">${escapeHtml(unitName)}</span>
                    <span class="unit-role"></span>
                </div>
            </div>
            <div class="unit-header-controls">
                ${headerToggle}
                <span class="chevron-icon">▼</span>
            </div>
        </div>
        <div class="unit-body"></div>
    `;
    container.appendChild(card);

    // Fills everything that depends on the active mode: role, description and the ability buttons.
    const renderActiveMode = () => {
        const { config } = activeMode;
        const metadata = config.unit;
        const description = metadata.description || (metadata.weapon ? `Weapon: ${metadata.weapon}` : 'Wargame asset');
        const regular = Object.entries(config.regular_abilities || {});
        const additional = Object.entries(config.additional_abilities || {});

        const roleParts = String(metadata.role || '').split(',').map(part => part.trim()).filter(Boolean);
        card.dataset.armySlot = normalizeRoleFilterValue(roleParts[0] || 'Unassigned');
        card.dataset.combatRole = normalizeRoleFilterValue(roleParts[1] || 'Unassigned');
        card.querySelector('.unit-role').textContent = metadata.role || 'FIGHTER';

        let html = `
            <div style="font-size: 0.65rem; color: var(--hud-text-muted); margin-bottom: 15px; border-left: 2px solid var(--hud-border); padding-left: 8px;">
                ${escapeHtml(description).toUpperCase()}
            </div>
            <div class="btn-matrix">${renderConfiguredButtons(regular, false)}</div>
        `;
        if (additional.length > 0) {
            html += `
                <div class="special-divider">
                    <div class="special-line"></div>
                    <div class="special-title">ADDITIONAL ABILITIES</div>
                    <div class="special-line"></div>
                </div>
                <div class="btn-matrix">${renderConfiguredButtons(additional, true)}</div>
            `;
        }
        card.querySelector('.unit-body').innerHTML = html;

        card.querySelectorAll('.config-ability-btn').forEach(button => {
            const ability = getAbilityForButton(config, button);
            button.addEventListener('click', event => {
                event.stopPropagation();
                playConfiguredAbility(ability, resolveUnitAudio(activeMode.unitAudio, sc1Audio, activeBank), card, activeBank);
            });
        });
        refreshOfflineAvailability();
    };

    // Dims the buttons whose sounds are not stored on this device (only while offline) and updates the faction notice.
    function applyOfflineAvailability() {
        const audio = resolveUnitAudio(activeMode.unitAudio, sc1Audio, activeBank);
        card.querySelectorAll('.config-ability-btn').forEach(button => {
            const isPlayable = isAbilityPlayable(getAbilityForButton(activeMode.config, button), audio, activeBank);
            button.disabled = !isPlayable;
            if (isPlayable) button.removeAttribute('title');
            else button.title = 'Not saved on this device for offline use';
        });
    }
    function refreshOfflineAvailability() {
        applyOfflineAvailability();
        refreshFactionOfflineNotice(factionName);
    }
    card.applyOfflineAvailability = applyOfflineAvailability;
    renderActiveMode();

    card.querySelectorAll('.bank-toggle-btn[data-bank]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation(); // Keep the accordion state untouched
            const bank = button.dataset.bank;
            if (bank === activeBank) return;
            activeBank = bank;
            setSfxBank(factionName, primary.unitKey, bank);
            setToggleActive(card, '[data-bank]', 'bank', bank);
            refreshOfflineAvailability();
            showToast(`${unitName.toUpperCase()}: ${SFX_BANKS[bank]} sound bank active`);
        });
    });

    card.querySelectorAll('.bank-toggle-btn[data-mode]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            const mode = group.modes.find(candidate => candidate.unitKey === button.dataset.mode);
            if (!mode || mode === activeMode) return;
            activeMode = mode;
            setUnitMode(factionName, group, mode);
            setToggleActive(card, '[data-mode]', 'mode', mode.unitKey);
            renderActiveMode();
            showToast(`${unitName.toUpperCase()}: ${mode.label.toUpperCase()} mode active`);
        });
    });
}

function setToggleActive(card, selector, dataKey, value) {
    card.querySelectorAll(`.bank-toggle-btn${selector}`).forEach(button => {
        const isActive = button.dataset[dataKey] === value;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function renderConfiguredButtons(entries, isAdditional) {
    return entries.map(([key, ability]) => {
        const defaultSize = isAdditional ? 2 : 1;
        const buttonSize = Number(ability.button_size || defaultSize) === 1 ? 1 : 2;
        const classes = ['sfx-btn', 'config-ability-btn'];
        if (isAdditional) classes.push('special-btn');
        if (key === 'destroyed') classes.push('btn-death');
        if (key === 'deploy' || key === 'ready') classes.push('btn-deploy');
        const group = isAdditional ? 'additional' : 'regular';
        return `<button type="button" class="${classes.join(' ')}" data-ability-key="${escapeHtml(key)}" data-ability-group="${group}" style="grid-column: span ${buttonSize}">${abilityLabel(key)}</button>`;
    }).join('');
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
    const filters = getActiveRoleFilters();
    let visibleCount = 0;

    cards.forEach(card => {
        const name = card.getAttribute('data-unit-name') || '';
        const matchesSearch = name.includes(query);
        const matchesArmySlot = filters.armySlots.size === 0 || filters.armySlots.has(card.dataset.armySlot);
        const matchesCombatRole = filters.combatRoles.size === 0 || filters.combatRoles.has(card.dataset.combatRole);
        if (matchesSearch && matchesArmySlot && matchesCombatRole) {
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
            noResultsNotice.textContent = 'EMPTY';
            container.appendChild(noResultsNotice);
        }
    } else {
        if (noResultsNotice) {
            noResultsNotice.remove();
        }
    }
}

function normalizeRoleFilterValue(value) {
    return String(value).trim().toLocaleLowerCase();
}

function getActiveRoleFilters() {
    if (!roleFiltersByFaction.has(activeTab)) {
        roleFiltersByFaction.set(activeTab, { armySlots: new Set(), combatRoles: new Set() });
    }
    return roleFiltersByFaction.get(activeTab);
}

function openRoleFilterDialog() {
    const container = document.getElementById(`${activeTab}-unit-container`);
    if (!container) return;

    const cards = Array.from(container.querySelectorAll('.unit-card'));
    const filters = getActiveRoleFilters();
    const armySlots = [...new Set(cards.map(card => card.dataset.armySlot).filter(Boolean))].sort();
    const combatRoles = [...new Set(cards.map(card => card.dataset.combatRole).filter(Boolean))].sort();

    elements.roleFilterFaction.textContent = `${activeTab.toUpperCase()} UNITS`;
    renderRoleFilterOptions(elements.armySlotOptions, armySlots, 'army-slot', filters.armySlots);
    renderRoleFilterOptions(elements.combatRoleOptions, combatRoles, 'combat-role', filters.combatRoles);
    elements.roleFilterDialog.showModal();
}

function renderRoleFilterOptions(container, values, group, selectedValues) {
    container.replaceChildren();
    if (values.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'role-filter-empty';
        empty.textContent = 'NO OPTIONS AVAILABLE';
        container.appendChild(empty);
        return;
    }

    values.forEach(value => {
        const label = document.createElement('label');
        label.className = 'role-filter-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = value;
        checkbox.dataset.filterGroup = group;
        checkbox.checked = selectedValues.has(value);
        const text = document.createElement('span');
        text.textContent = value.toLocaleUpperCase();
        label.append(checkbox, text);
        container.appendChild(label);
    });
}

function clearActiveRoleFilters() {
    const filters = getActiveRoleFilters();
    filters.armySlots.clear();
    filters.combatRoles.clear();
    elements.roleFilterDialog.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateRoleFilterButton();
    filterUnits();
}

function updateRoleFilterButton() {
    const filters = getActiveRoleFilters();
    const count = filters.armySlots.size + filters.combatRoles.size;
    elements.roleFilterCount.textContent = String(count);
    elements.roleFilterCount.hidden = count === 0;
    elements.openRoleFilter.setAttribute('aria-pressed', String(count > 0));
    elements.openRoleFilter.setAttribute('aria-label', count > 0 ? `Role filters, ${count} selected` : 'Filter by army slot or combat role');
}
