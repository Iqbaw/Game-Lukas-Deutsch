import * as THREE from 'three';
import { Game, registerUpdate } from './main.js';
import { CONFIG, EVENTS } from './config.js';
import { getQuest } from './data/quests.js';
import { openDialogForNPC, openDialog } from './dialog.js';
import { getDialog } from './data/dialogs.js';
import { showToast } from './ui.js';

const STATE = {
  IDLE: 'IDLE',
  DIALOG: 'DIALOG',
  EXPLORATION: 'EXPLORATION',
  INTERACTION: 'INTERACTION',
  REFLECTION: 'REFLECTION'
};

export const QuestSystem = {
  currentState: STATE.IDLE,
  activeQuestId: null,
  questTimer: 0,
  interactionAttempts: 0,
  
  // Raycaster for Constructivism interaction
  raycaster: new THREE.Raycaster(),
  rayDirection: new THREE.Vector3(0, 0, 1),
  
  init() {
    window.__questState__ = window.__questState__ || {};
    
    // Register update loop for timer and interactions
    registerUpdate((delta) => this.update(delta));

    // Listen to quest start events
    window.addEventListener(EVENTS.QUEST_START, (e) => {
      this.startQuest(e.detail.questId);
    });

    // Listen to dialogue open/close to toggle states
    window.addEventListener(EVENTS.DIALOG_OPEN, () => {
      if (this.currentState === STATE.EXPLORATION || this.currentState === STATE.IDLE) {
        this.currentState = STATE.DIALOG;
      }
    });

    window.addEventListener(EVENTS.DIALOG_CLOSE, () => {
      if (this.currentState === STATE.DIALOG && this.activeQuestId) {
        this.transitionToExploration();
      }
    });

    // Interaction key binding
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        if (this.currentState === STATE.EXPLORATION || this.currentState === STATE.INTERACTION) {
          this.handleInteraction();
        }
      } else if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleReisetagebuch();
      }
    });

    // Close Reflection UI bindings
    const refBtn = document.getElementById('reflection-submit');
    if (refBtn) {
      refBtn.addEventListener('click', () => this.submitReflection());
    }
    
    const reiseCloseBtn = document.getElementById('reisetagebuch-close');
    if (reiseCloseBtn) {
      reiseCloseBtn.addEventListener('click', () => this.toggleReisetagebuch(false));
    }
  },

  startQuest(questId) {
    const quest = getQuest(questId);
    if (!quest) return;

    this.activeQuestId = questId;
    window.__questState__[questId] = 'active';
    this.questTimer = 0;
    this.interactionAttempts = 0;
    
    // Pan camera to objective general area (simulate by hinting)
    showToast({ title: 'Neue Aufgabe!', body: quest.title, type: 'info', icon: '📜' });
    this.updateHUD(quest.title);

    // Give NPC the dialog
    if (quest.giver) {
      // In a real scenario, player approaches NPC. For now, let's just trigger it directly or wait for player to talk to NPC.
      const npcData = window.__NPC_DATA__ ? window.__NPC_DATA__[quest.giver] : { id: quest.giver, name: 'NPC' };
      if (npcData) {
        openDialogForNPC(npcData);
      }
    }
  },

  transitionToExploration() {
    this.currentState = STATE.EXPLORATION;
    
    // Show Reisetagebuch hint
    showToast({
      title: 'Tipp:',
      body: 'Drücke TAB, um das Reisetagebuch für Hinweise zu öffnen.',
      type: 'info',
      icon: '💡'
    });
    
    this.updateReisetagebuch(this.activeQuestId, false);
  },

  handleInteraction() {
    if (!Game.player) return;

    // Setup raycaster from player looking forward based on facing rotation
    const origin = Game.player.position.clone().add(new THREE.Vector3(0, 1, 0));
    
    // The player's facing is a rotation on Y axis
    const angle = Game.player.rotation.y;
    this.rayDirection.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
    
    this.raycaster.set(origin, this.rayDirection);
    this.raycaster.far = CONFIG.INTERACTION_RADIUS;

    // Check intersections with itemsGroup or worldGroup
    const intersects = this.raycaster.intersectObjects(Game.itemsGroup.children, true);
    
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      this.evaluateInteraction(hit);
    } else {
      // No object hit
    }
  },

  evaluateInteraction(hitMesh) {
    if (hitMesh.userData && hitMesh.userData.isDoor) {
      // Play doorbell sound
      const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_e68c859d04.mp3?filename=door-bell-sound-99933.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed', e));

      // Load target zone
      import('./zone.js').then(({ loadZone }) => {
        loadZone(hitMesh.userData.targetZone);
      });
      return;
    }

    this.interactionAttempts++;
    
    const isCorrect = hitMesh.userData && hitMesh.userData.questTarget === this.activeQuestId;

    if (isCorrect) {
      this.handleCorrectInteraction(hitMesh);
    } else {
      this.handleWrongInteraction(hitMesh);
    }
  },

  handleCorrectInteraction(mesh) {
    // Confetti
    this.spawnConfetti();

    // Hide collected item
    mesh.visible = false;
    mesh.position.y = -100;
    if (mesh.parent) mesh.parent.remove(mesh);
    
    // Score based on attempts
    let points = CONFIG.CORRECT_THIRD || 20;
    if (this.interactionAttempts === 1) points = 100;
    else if (this.interactionAttempts === 2) points = 50;
    
    const itemName = mesh.userData.itemName || 'Gegenstand';
    window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, { 
      detail: { points: points, label: `Gefunden: ${itemName}` } 
    }));

    // Reset interaction attempts for the next item
    this.interactionAttempts = 0;

    // Track collected item
    if (!this.collectedItems) this.collectedItems = new Set();
    this.collectedItems.add(itemName);

    if (this.activeQuestId === 'quest_1') {
      if (this.collectedItems.size >= 4) {
        // All items collected, trigger final assessment
        this.currentState = STATE.DIALOG;
        setTimeout(() => {
          openDialog(getDialog('oma_quest1_return'), { id: 'oma_helga', name: 'Oma Helga', avatarUrl: '' });
        }, 1500);
      } else {
        // Update Reisetagebuch hint if needed, or just let them find the rest
        showToast({ title: 'Fortschritt', body: `${this.collectedItems.size}/4 gefunden`, type: 'info' });
      }
    } else {
      // Logic for other quests
      this.updateReisetagebuch(this.activeQuestId, true);
      this.currentState = STATE.REFLECTION;
      setTimeout(() => {
        this.showReflectionPhase();
      }, 1500);
    }
  },

  handleWrongInteraction(mesh) {
    // Shake animation
    if (window.gsap) {
      const origX = mesh.position.x;
      gsap.to(mesh.position, {
        x: origX + 0.2,
        duration: 0.05,
        yoyo: true,
        repeat: 5,
        onComplete: () => { mesh.position.x = origX; }
      });
    }

    // UI Red Flash
    const hud = document.getElementById('hud');
    if (hud) {
      hud.classList.add('ui-flash-red');
      setTimeout(() => hud.classList.remove('ui-flash-red'), 300);
    }

    // Deduct points
    window.dispatchEvent(new CustomEvent('score:reset_streak'));
    window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, { 
      detail: { points: -10, label: 'Das ist falsch.' } 
    }));
  },

  showReflectionPhase() {
    const refUI = document.getElementById('reflection-ui');
    if (refUI) {
      refUI.classList.remove('hud-hidden');
      Game.isPaused = true; // Pause game during reflection
    }
  },

  submitReflection() {
    const input = document.getElementById('reflection-input');
    const expected = input.dataset.expected || 'Kartoffel'; // Default fallback
    
    if (input.value.trim().toLowerCase() === expected.toLowerCase()) {
      // Correct!
      const refUI = document.getElementById('reflection-ui');
      refUI.classList.add('hud-hidden');
      Game.isPaused = false;
      
      window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, { 
        detail: { points: 50, label: 'Reflexion abgeschlossen!' } 
      }));

      // Complete Quest
      window.__questState__[this.activeQuestId] = 'completed';
      this.activeQuestId = null;
      this.currentState = STATE.IDLE;
      
      showToast({ title: 'Level abgeschlossen!', type: 'success', icon: '🏆' });
    } else {
      // Wrong
      input.classList.add('shake-input');
      setTimeout(() => input.classList.remove('shake-input'), 400);
    }
  },

  toggleReisetagebuch(forceState) {
    const rb = document.getElementById('reisetagebuch');
    if (!rb) return;

    if (forceState !== undefined) {
      if (forceState) rb.classList.remove('hud-hidden');
      else rb.classList.add('hud-hidden');
    } else {
      rb.classList.toggle('hud-hidden');
    }
  },

  updateReisetagebuch(questId, isRevealed) {
    // Add spatial prepositions description
    const descEl = document.getElementById('reisetagebuch-desc');
    if (!descEl) return;

    if (questId === 'quest_1') {
      // Pull from JOURNAL_ENTRIES
      import('./data/dialogs.js').then(({ getJournalEntry }) => {
        const entry = getJournalEntry('oma_quest1_letter');
        if (entry) {
          descEl.innerHTML = this.processVocabTags(entry.body);
        }
      });
    } else {
      descEl.innerHTML = "Du suchst nach Hinweisen...";
    }
  },

  processVocabTags(text) {
    return text.replace(
      /<vocab title="([^"]+)">([^<]+)<\/vocab>/g,
      (_, translation, word) =>
        `<span class="vocab" data-translation="${translation}">${word}</span>`
    );
  },

  updateHUD(title) {
    const qName = document.getElementById('quest-name');
    if (qName) qName.textContent = title;
    
    const tracker = document.getElementById('quest-tracker');
    if (tracker) tracker.classList.remove('hud-hidden');
  },

  update(delta) {
    if (this.currentState === STATE.EXPLORATION || this.currentState === STATE.INTERACTION) {
      this.questTimer += delta;
    }
  },

  spawnConfetti() {
    let container = document.querySelector('.confetti-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'confetti-container';
      document.body.appendChild(container);
    }
  
    const colors = ['#f4c430','#ff6b35','#5dc26b','#4a9bd4','#e85a5a'];
    for (let i = 0; i < 32; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        left: ${20 + Math.random() * 60}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        width: ${6 + Math.random() * 8}px;
        height: ${10 + Math.random() * 8}px;
        animation-delay: ${Math.random() * 0.4}s;
        animation-duration: ${1.2 + Math.random() * 0.6}s;
      `;
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 2000);
    }
  }
};
