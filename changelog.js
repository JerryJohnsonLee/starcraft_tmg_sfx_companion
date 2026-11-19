// Change log shown by the CHANGE LOG button in the Control Center.
//
// One line per merged change, newest first: add the new entry at the TOP when a pull request is merged.
// Keep titles short and written for players, not for developers.
window.CHANGELOG = [
    { date: '2026-11-18', title: 'Wave 4: Firebat added (StarCraft I and StarCraft II sounds, with Fire Wall and Stimpack)' },
    { date: '2026-11-18', title: 'StarCraft I: Tassadar has an attack sound, Zerg burrow and unburrow use the original sounds, and the High Templar storm starts over a random Yes line' },
    { date: '2026-11-18', title: 'High Templar: Psionic Storm ends with the storm launch sound, overlapping the impact, and Attack now has a storm impact effect (StarCraft II)' },
    { date: '2026-10-24', title: 'Offline: music can be saved without any faction; sounds that are not saved are dimmed with a notice when you are offline' },
    { date: '2026-10-24', title: 'Offline Settings: a collapsible card that shows how much each download or removal will use or free' },
    { date: '2026-10-24', title: 'Install and offline: save the sounds on your device, smaller header logo, this change log' },
    { date: '2026-10-24', title: 'The app shell works offline (service worker)' },
    { date: '2026-10-24', title: 'Defiler and Tassadar added (StarCraft I sounds only)' },
    { date: '2026-10-23', title: 'Unit names, roles and weapons checked against the official card sheets' },
    { date: '2026-10-22', title: 'Zagara, Raven and Nova added (Nova is one card with a Stealth / Assault toggle)' },
    { date: '2026-10-22', title: 'High Templar: attack and death lines' },
    { date: '2026-10-21', title: 'High Templar added (StarCraft II and StarCraft I sounds)' },
    { date: '2026-10-20', title: 'Install icons and web app manifest' },
    { date: '2026-10-13', title: 'Credits and links to this version and the original project' },
    { date: '2026-10-05', title: 'SC1 sound bank per unit, with SC2 fallback' }
];

(() => {
    const dialog = document.getElementById('changelog-dialog');
    const list = document.getElementById('changelog-list');
    const openButton = document.getElementById('btn-changelog');
    const closeButton = document.getElementById('btn-changelog-close');
    if (!dialog || !list || !openButton) return;

    window.CHANGELOG.forEach(entry => {
        const item = document.createElement('li');
        item.className = 'changelog-entry';

        const date = document.createElement('span');
        date.className = 'changelog-date';
        date.textContent = entry.date;

        const title = document.createElement('span');
        title.className = 'changelog-title';
        title.textContent = entry.title;

        item.append(date, title);
        list.appendChild(item);
    });

    openButton.addEventListener('click', () => dialog.showModal());
    closeButton.addEventListener('click', () => dialog.close());
    // A click on the backdrop (the dialog element itself, outside its content) closes it, like the role filter dialog.
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
})();
