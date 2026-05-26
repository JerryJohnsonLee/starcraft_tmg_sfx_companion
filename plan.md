I want to build a web application as a StarCraft Tabletop Miniature Game Sound Effect Companion. The main purpose of this app is to play an OST from StarCraft, and play unit voiceover and various sound effects to create a more immersive wargame play session. 



All the audio files are already prepared in the corresponding folders.



To be more specific, I would imagine the app to have four pages. The first page is OST playing page. You could choose ost from starcraft 1 or 2, and race specific osts (protoss, terran and zerg). Then there is a button to control play and pause of the OST. It creates a playlist from selected starcraft version and race, and randomly play music from it. when one piece of music stops, randomly choose another one to play.



The next 3 pages contain SFX for units in 3 different races. The units are:



* Terran:

  * Jim Raynor
  * Marine
  * Marauder
  * Medic
  * Goliath
* Zerg:

  * Kerrigan
  * Zergling
  * Roach
  * Queen
  * Omega Worm
  * Hydralisk
* Protoss:

  * Artanis
  * Zealot
  * Adept
  * Sentry
  * Stalker
  * Pylon



For each unit, there are a couple of basic buttons: Deploy, Move, Attack, Death. When each button is clicked, play a random sound from the corresponding folder. For death, if there is DeathFX folder, randomly choose one from Death folder and another one from DeathFX, and play together. Otherwise just randomly choose one from the Death folder.



Omega Worm and Pylon are special, because they are structures. They only have Deploy and Death SFX, so only display buttons for these two.



All zerg units also have burrow/unburrow, which should also display their buttons and play the corresponding SFX.



Marine and marauder also have stimpack ability. Show a button for stimpack, and play random combination of sounds, one from the stimpack folder, and the other from the stimpackVO folder.



For anything else, list them as additional items under the standard buttons. When clicked, also randomly play a sound from the related folder.



All these sounds can play along with the background OST.



Create or utilize UI elements that closely resemble StarCraft.

When you design the project structure, make sure it is easily extensible, as going forward there will be more units added, and it would be much better if there is a structured way to add new SFX for the new units.

