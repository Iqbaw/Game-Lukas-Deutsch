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

// ═══════════════════════════════════════════════════════════════════
// ITEM DESCRIPTIONS — Lokale Präpositionen (Dativ)
// Center pop-up text saat item auto-collected via proximity.
// Mudah di-extend untuk objek lain di masa depan.
// Format: <span class="prep">PRÄPOSITION</span> di highlight kuning.
// ═══════════════════════════════════════════════════════════════════
const ITEM_DESCRIPTIONS = {
  // ── QUEST 1 items (Oma sarapan) ──
  pfanne:  { emoji: '🍳', text: 'Die Pfanne ist <span class="prep">IN</span> dem Schrank.' },
  wurst:   { emoji: '🌭', text: 'Die Wurst ist <span class="prep">AUF</span> dem Serviertisch.' },
  eier:    { emoji: '🥚', text: 'Das Ei liegt <span class="prep">UNTER</span> dem Tisch.' },
  teller:  { emoji: '🍽', text: 'Der Teller ist <span class="prep">AUF</span> dem Küchentisch.' },
  besteck: { emoji: '🍴', text: 'Das Besteck ist <span class="prep">IN</span> der Schublade.' },
  // ── QUEST 2 items (Tante minta cari benda) ──
  socken:    { emoji: '🧦', text: 'Die Socken sind <span class="prep">IN</span> dem Schrank.' },
  papier:    { emoji: '📄', text: 'Das Papier liegt <span class="prep">AUF</span> dem Tisch.' },
  spielzeug: { emoji: '🧸', text: 'Das Spielzeug ist <span class="prep">UNTER</span> dem Küchentisch.' },
  // ── STAGE 2: Quest 4 (Supermarkt) + Quest 5 (Eis) ──
  fleisch: { emoji: '🥩', text: 'Das Fleisch ist <span class="prep">BEI</span> der Kühltheke.' },
  gemuese: { emoji: '🥬', text: 'Das Gemüse ist <span class="prep">AM</span> Eingang.' },
  brot:    { emoji: '🍞', text: 'Das Brot ist <span class="prep">IN</span> der Mitte.' },
  eis:     { emoji: '🍦', text: 'Das Eis ist <span class="prep">NEBEN</span> der Kasse.' },
};

/**
 * showCenterPopup — Reusable 3-detik popup center UI.
 * Bisa dipakai untuk item pickup, achievement, dll.
 * @param {string} html  - HTML konten (boleh ada <span class="prep">)
 * @param {string} emoji - Optional emoji di atas teks
 * @param {number} duration - Durasi tampil (ms), default 3000
 */
function showCenterPopup(html, emoji = '', duration = 3000) {
  let el = document.getElementById('center-popup');
  if (!el) {
    el = document.createElement('div');
    el.id = 'center-popup';
    el.className = 'center-popup';
    document.body.appendChild(el);
  }
  const emojiHtml = emoji ? `<span class="emoji">${emoji}</span>` : '';
  el.innerHTML = `${emojiHtml}${html}`;
  el.classList.add('visible');
  if (el._popupTimer) clearTimeout(el._popupTimer);
  el._popupTimer = setTimeout(() => el.classList.remove('visible'), duration);
}

// Expose ke window untuk debugging / external trigger
if (typeof window !== 'undefined') {
  window.showCenterPopup = showCenterPopup;
  window.ITEM_DESCRIPTIONS = ITEM_DESCRIPTIONS;
}

// Room AABB bounds (sinkron dengan world.js buildHausInterior ROOMS)
const ROOM_BOUNDS = {
  schlaf_lukas: { x1:-18, x2:-6,  z1:-14, z2:-4  },
  schlaf_oma:   { x1:-6,  x2:6,   z1:-14, z2:-4  },
  schlaf_tante: { x1:6,   x2:18,  z1:-14, z2:-4  },
  flur:         { x1:-18, x2:18,  z1:-4,  z2:4   },
  kueche:       { x1:-18, x2:-3,  z1:4,   z2:14  },
  wohnzimmer:   { x1:-3,  x2:9,   z1:4,   z2:14  },
  badezimmer:   { x1:9,   x2:18,  z1:4,   z2:14  },
};

function pointInRoom(x, z, roomId) {
  const r = ROOM_BOUNDS[roomId];
  if (!r) return false;
  return x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;
}

export const QuestSystem = {
  currentState: STATE.IDLE,
  activeQuestId: null,
  activeStep: 0,       // index of current step in quest.steps
  questTimer: 0,
  interactionAttempts: 0,
  collectedItems: null,
  lastRoom: null,      // track player's room for reach_room triggers
  _roomCheckTimer: 0,

  // Raycaster for Constructivism interaction
  raycaster: new THREE.Raycaster(),
  rayDirection: new THREE.Vector3(0, 0, 1),

  init() {
    window.__questState__ = window.__questState__ || {};
    window.__QUEST_SYSTEM__ = this;

    // Register update loop for timer and interactions
    registerUpdate((delta) => this.update(delta));

    // Listen to quest start events
    window.addEventListener(EVENTS.QUEST_START, (e) => {
      this.startQuest(e.detail.questId);
    });

    // Auto-start quest_1 saat game pertama mulai
    // (Delay singkat 800ms supaya story-intro fade-out selesai)
    window.addEventListener('game:start', () => {
      // FRESH SESSION: reset quest state supaya tidak terblok dari sesi sebelumnya
      // (localStorage persistence menyimpan completed state, ini menghapusnya saat
      // user mulai game baru via "Abenteuer beginnen")
      window.__questState__ = {};
      this.activeQuestId = null;
      this.activeStep = 0;
      this.currentState = STATE.IDLE;
      this.collectedItems = new Set();
      // Reset scene triggers (telepon) supaya bisa di-trigger ulang
      if (window.__sceneTriggers__) {
        Object.values(window.__sceneTriggers__).forEach(t => { if (t) t.triggered = false; });
      }

      this.showOnboardingBanner();   // Tampil INSTAN saat game mulai
      setTimeout(() => {
        if (this.activeQuestId) return;
        this.startQuest('quest_1');
      }, 800);
    });

    // Wire dialog-driven step progression
    window.addEventListener('quest:progress', (e) => {
      const stepId = e.detail && e.detail.stepId;
      if (stepId) this.progressStep(stepId);
    });

    // Wire quest completion (clear state + auto-start next quest)
    window.addEventListener('quest:complete', (e) => {
      const qid = e.detail && e.detail.questId;
      if (qid === this.activeQuestId) {
        window.__questState__[qid] = 'completed';
        this.activeQuestId = null;
        this.activeStep = 0;
        this.currentState = STATE.IDLE;
        // Hide panels + hint button
        this.hideSummaryPanel();
        this.hideQuestListPanel();
        this.hideHintButton();
      }
      // CHAIN: Quest 1 done → Quest 2 starts (Tante phone call)
      if (qid === 'quest_1') {
        // SAFETY-NET: Force-hide semua 5 item Q1 (pfanne, wurst, eier, teller, besteck)
        // — supaya tidak muncul lagi di Gameplay 2.
        // Lukas sudah "memakai" benda-benda itu untuk memasak.
        this.hideQuestItems(['pfanne', 'wurst', 'eier', 'teller', 'besteck']);

        setTimeout(() => {
          if (!this.activeQuestId && window.__questState__['quest_2'] !== 'completed') {
            // PHONE SHAKE — visual cue "telepon berdering"
            this.ringPhoneAnimation();
            showToast({
              title: '📞 Das Telefon klingelt wieder!',
              body: 'Wer ruft jetzt an?',
              type: 'info', icon: '📞', duration: 5000
            });
            // Re-trigger phone proximity for Q2: reset wired_phone trigger
            if (window.__sceneTriggers__?.wired_phone) {
              window.__sceneTriggers__.wired_phone.triggered = false;
            }
            // Hide onboarding banner if still visible
            this.hideOnboardingBanner();
            this.startQuest('quest_2');
          }
        }, 3000);
      }
      // Q3 selesai: Leni otomatis langsung MASUK ke rumah Oma.
      // Saat pindah zona STADT→HAUS, loadZone men-despawn semua NPC (termasuk
      // Leni yang mengikuti). Jadi: spawn ulang Leni di halaman HAUS di samping
      // Lukas, lalu scripted walk menuju pintu rumah → despawn (masuk rumah).
      if (qid === 'quest_3') {
        setTimeout(() => {
          if (window.__spawnNPCAt__ && window.__walkNPCTo__) {
            // Spawn Leni di ujung jembatan (di belakang posisi masuk Lukas)
            window.__spawnNPCAt__('leni', -5.5, 2.2, Math.PI / 2).then(() => {
              showToast({
                title: '👧 Leni läuft ins Haus!',
                body: 'Leni geht direkt zu Oma hinein. Tschüss, Leni!',
                type: 'success', icon: '🏡', duration: 5000
              });
              // Pintu rumah = portal interior di (0, 2.6)
              window.__walkNPCTo__('leni', 0, 2.6, () => {
                if (window.__despawnNPC__) window.__despawnNPC__('leni');
              });
            });
          }
        }, 600);
      }
      // CHAIN: Quest 3 done → Quest 4 starts (Stage 2 — Oma minta belanja)
      if (qid === 'quest_3') {
        setTimeout(() => {
          if (!this.activeQuestId && window.__questState__['quest_4'] !== 'completed') {
            showToast({
              title: '🛒 Oma braucht etwas!',
              body: 'Oma möchte Lebensmittel für das Abendessen.',
              type: 'info', icon: '🛒', duration: 5000
            });
            // (Center popup DIHILANGKAN — cukup toast di atas)
            this.startQuest('quest_4');
          }
        }, 3000);
      }
      // Q4 (Ein Brief von Oma) selesai: setelah 7 detik Lukas langsung
      // spawn kembali DI DALAM rumah Oma (bawa belanjaan pulang).
      if (qid === 'quest_4') {
        setTimeout(() => {
          import('./zone.js').then(z => {
            z.loadZone('haus_interior', null, true);
            showToast({
              title: '🏡 Wieder zu Hause!',
              body: 'Lukas bringt die Einkäufe zu Oma.',
              type: 'success', icon: '🛒', duration: 5000
            });
          });
        }, 7000);
      }
      // Q5 (Weg nach Tantes Haus) selesai: Tante menerima kadonya
      if (qid === 'quest_5') {
        setTimeout(() => {
          showToast({
            title: '🎁 Angekommen!',
            body: 'Tante Maria freut sich über das Geschenk!',
            type: 'success', icon: '🏠', duration: 5000
          });
        }, 800);
      }
      // CHAIN: Q4→Q5→Q6→Q7 (lanjutan, data-driven)
      const STAGE2_CHAIN = {
        quest_4: { next: 'quest_5', icon: '🎁', title: 'Zu Tantes Haus!', body: 'Lukas möchte Tante etwas bringen — aber wo wohnt sie?', delay: 9500 },
        quest_5: { next: 'quest_6', icon: '🧭', title: 'Wo bin ich?',  body: 'Lukas hat sich verlaufen! Frag nach dem Weg.' },
        quest_6: { next: 'quest_7', icon: '🎬', title: 'Ins Kino!',    body: 'Nach dem Essen — schnell zum Kino!' },
      };
      const chain = STAGE2_CHAIN[qid];
      if (chain) {
        setTimeout(() => {
          if (!this.activeQuestId && window.__questState__[chain.next] !== 'completed') {
            showToast({ title: `${chain.icon} ${chain.title}`, body: chain.body, type: 'info', icon: chain.icon, duration: 5000 });
            // (Center popup DIHILANGKAN — cukup toast di atas, konsisten dengan Q1→Q2)
            this.startQuest(chain.next);
          }
        }, chain.delay || 3000);
      }
      // STAGE 2 FINALE: Q7 selesai → seluruh Stage 2 tamat
      if (qid === 'quest_7') {
        setTimeout(() => {
          showCenterPopup(
            '<b>STAGE 2 abgeschlossen! 🎉</b><br>Du hast alle Ortsangaben gemeistert!<br>Gut gemacht, Lukas!',
            '🏆', 6000
          );
          showToast({ title: '🏆 Stage 2 komplett!', body: 'Alle Quests von Reise abgeschlossen.', type: 'success', icon: '🏆', duration: 6000 });
        }, 1500);
      }
      // CHAIN: Quest 2 done → Quest 3 starts (Stage 2 — Tante telpon lagi minta jemput Leni)
      if (qid === 'quest_2') {
        setTimeout(() => {
          if (!this.activeQuestId && window.__questState__['quest_3'] !== 'completed') {
            // Force-hide semua Q2 items (safety-net)
            this.hideQuestItems(['socken', 'papier', 'spielzeug']);
            // Phone shake + toast — Tante telpon lagi untuk Stage 2
            this.ringPhoneAnimation();
            showToast({
              title: '📞 Tante ruft wieder an!',
              body: 'Stage 2 beginnt — Geh zum Telefon!',
              type: 'info', icon: '📞', duration: 5000
            });
            // Reset phone trigger supaya Q3 phone-walk flow bisa fires
            if (window.__sceneTriggers__?.wired_phone) {
              window.__sceneTriggers__.wired_phone.triggered = false;
            }
            // (Center popup "STAGE 2" DIHILANGKAN — cukup toast di atas seperti Q1→Q2)
            this.startQuest('quest_3');
          }
        }, 3000);
      }
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
    // Wire hint button
    this.initHintButton();
  },

  restoreProgress(data) {
    window.__questState__ = { ...(data.questState || {}) };
    const questOrder = Array.from({ length: 10 }, (_, index) => `quest_${index + 1}`);
    const nextQuest = questOrder.find(id => window.__questState__[id] !== 'completed') || null;
    this.activeQuestId = data.activeQuestId || nextQuest;
    this.activeStep = data.activeQuestId
      ? Math.max(0, Number.isFinite(data.activeStep) ? data.activeStep : 0)
      : 0;
    if (this.activeQuestId && !window.__questState__[this.activeQuestId]) {
      window.__questState__[this.activeQuestId] = 'active';
    }
    this.currentState = this.activeQuestId ? STATE.EXPLORATION : STATE.IDLE;
    this.collectedItems = new Set(Array.isArray(data.collectedItems) ? data.collectedItems : []);
    this.lastRoom = data.lastRoom || null;
    this.questTimer = 0;
    this.interactionAttempts = 0;

    const completed = window.__questState__;
    if (completed.quest_1 === 'completed') this.hideQuestItems(['pfanne', 'wurst', 'eier', 'teller', 'besteck']);
    if (completed.quest_2 === 'completed') this.hideQuestItems(['socken', 'papier', 'spielzeug']);

    if (!this.activeQuestId) {
      this.hideSummaryPanel();
      this.hideQuestListPanel();
      this.hideHintButton();
      return;
    }

    const quest = getQuest(this.activeQuestId);
    if (!quest) return;
    this.updateHUD(quest.title);
    this.updateStepHUD(quest);
    this.showHintButton();
    const step = quest.steps[this.activeStep];
    if (step?.kind === 'collect_auto') this.onCollectStepStart();

    const itemSets = {
      quest_1: ['pfanne', 'wurst', 'eier', 'teller', 'besteck'],
      quest_2: ['socken', 'papier', 'spielzeug'],
      quest_4: ['fleisch', 'gemuese', 'brot'],
      quest_5: ['eis'],
    };
    const currentItems = itemSets[this.activeQuestId] || [];
    this.revealQuestItems(currentItems.filter(name => !this.collectedItems.has(name)));
    this.hideQuestItems(currentItems.filter(name => this.collectedItems.has(name)));
    this.collectedItems.forEach(name => this.markItemFoundInPanel(name));
  },

  startQuest(questId) {
    const quest = getQuest(questId);
    if (!quest) return;

    this.activeQuestId = questId;
    this.activeStep = 0;
    this.collectedItems = new Set();
    window.__questState__[questId] = 'active';
    this.questTimer = 0;
    this.interactionAttempts = 0;

    // ── VARIAN LAYOUT KOTA per quest Stage 3 ──
    // Setiap quest kota pakai tata letak berbeda supaya siswa membaca teks
    // deskriptif, bukan menghafal peta. Dibaca oleh buildStadt() saat loadZone.
    const STADT_VARIANTS = { quest_3: 'A', quest_4: 'B', quest_5: 'C' };
    if (STADT_VARIANTS[questId]) {
      window.__stadtVariant__ = STADT_VARIANTS[questId];
    }

    // Q4 (Ein Brief von Oma): panel instruksi kiri — masuk rumah, cari Brief
    if (questId === 'quest_4') {
      this.showSummaryPanel(
        `Geh <span class="kw">ins Haus</span> hinein. Auf dem <span class="kw">Esstisch</span> ` +
        `liegt ein <span class="kw">Brief von Oma</span> ✉️ — finde und lies ihn!`,
        '📜 Aufgabe:'
      );
    }

    // Q5 (Weg nach Tantes Haus): Lukas spawn di TENGAH KOTA (varian C),
    // lalu harus bertanya kepada orang asing (Frau Weber).
    if (questId === 'quest_5') {
      this.showSummaryPanel(
        `Du möchtest <span class="kw">Tante Maria</span> etwas bringen 🎁 — aber du hast ` +
        `dich <span class="kw">verlaufen</span>! Frag eine <span class="kw">Passantin</span> ` +
        `nach dem Weg (E drücken).`,
        '📜 Aufgabe:'
      );
      setTimeout(() => {
        import('./zone.js').then(z => {
          // Tengah kota, di Hauptstraße; Frau Weber berdiri di dekatnya
          z.loadZone('stadt', { x: 36, z: 0, facing: -Math.PI / 2 }, true);
        });
      }, 900);
    }

    showToast({ title: 'Neue Aufgabe!', body: quest.title, type: 'info', icon: '📜' });
    this.updateHUD(quest.title);
    this.updateStepHUD(quest);
    // Show hint button — selalu visible saat quest aktif
    this.showHintButton();

    // Hint awal: biar player tahu bisa gerak dulu
    setTimeout(() => {
      showToast({
        title: '💡 Tipp',
        body: 'Bewege Lukas mit WASD! Schau dich erst um.',
        type: 'info',
        icon: '🎮',
        duration: 4500
      });
    }, 600);

    // Auto-trigger intro dialog QUICKLY supaya player tahu apa yang harus dilakukan
    if (quest.intro_dialog) {
      const dlg = getDialog(quest.intro_dialog);
      if (dlg) {
        // Hardcoded speaker map untuk hindari race dengan __NPC_DATA__
        const SPEAKERS = {
          lukas:       { id: 'lukas',       name: 'Lukas',       avatarUrl: '' },
          oma_helga:   { id: 'oma_helga',   name: 'Oma Helga',   avatarUrl: '' },
          opa_klaus:   { id: 'opa_klaus',   name: 'Opa Klaus',   avatarUrl: '' },
          tante_maria: { id: 'tante_maria', name: 'Tante Maria', avatarUrl: '' },
          // Stage 2 NPCs
          leni:        { id: 'leni',        name: 'Leni',        avatarUrl: '' },
          passant_1:   { id: 'passant_1',   name: 'Herr Bauer',  avatarUrl: '' },
          passant_2:   { id: 'passant_2',   name: 'Frau Schmidt',avatarUrl: '' },
          passant_3:   { id: 'passant_3',   name: 'Herr Fischer',avatarUrl: '' },
          passant_4:   { id: 'passant_4',   name: 'Frau Müller', avatarUrl: '' },
        };
        const speaker = SPEAKERS[quest.giver]
          || (window.__NPC_DATA__ && window.__NPC_DATA__[quest.giver])
          || { id: quest.giver, name: 'NPC', avatarUrl: '' };
        // Delay 1.5 detik — cukup untuk player melihat ruangan sebentar
        setTimeout(() => {
          if (this.activeQuestId === questId && this.activeStep === 0) {
            this.hideOnboardingBanner();
            this.currentState = STATE.DIALOG;
            openDialog(dlg, speaker);
          }
        }, 1500);
      }
    }
    // NOTE: Quest tanpa intro_dialog (e.g. Quest 2) TIDAK auto-open dialog di sini.
    // Dialog akan dibuka via step trigger flow:
    //   step1 (reach_trigger) → step2 (auto) → triggerAutoStep buka dialog yg tepat.
    // (Sebelumnya ada fallback `openDialogForNPC(npcData)` yang BUG: membuka
    // greeting dialog dengan speaker "NPC" alih-alih flow phone-walk yang seharusnya.)
  },

  // Mark current step done and advance to next. Used by dialog onEnter 'progress_quest'.
  progressStep(stepId) {
    const quest = getQuest(this.activeQuestId);
    if (!quest) return;
    const idx = quest.steps.findIndex(s => s.id === stepId);
    if (idx < 0 || idx < this.activeStep) return;
    this.activeStep = idx + 1;
    this.updateStepHUD(quest);

    if (this.activeStep >= quest.steps.length) {
      // Semua step selesai. Jika quest BELUM punya complete_quest eksplisit di
      // dialog (mis. Q3-Q7 yang berakhir di reach_zone/talk_npc), auto-complete
      // di sini. Q1/Q2 sudah dispatch complete_quest dari dialog terakhir, jadi
      // guard __questState__ mencegah double-complete.
      const qid = this.activeQuestId;
      if (qid && window.__questState__[qid] !== 'completed') {
        const reward = quest.reward || {};
        if (reward.score) {
          window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, {
            detail: { points: reward.score, label: `${quest.title} abgeschlossen!` }
          }));
        }
        showCenterPopup(
          `<b>${quest.title}</b><br>abgeschlossen! 🎉`,
          '✅', 4000
        );
        window.dispatchEvent(new CustomEvent('quest:complete', { detail: { questId: qid } }));
      }
      return;
    }

    const next = quest.steps[this.activeStep];
    // Persistent toast (8 detik) untuk SETIAP step transition supaya player tahu next action
    const STEP_GUIDE = {
      // Quest 1
      step2_reach_phone:     { title: '📞 Geh zum Telefon!',       body: 'Im Flur — links neben Omas Schlafzimmer-Tür.',   icon: '📞' },
      step3_phone_call:      { title: '☎️ Das Telefon klingelt!',  body: 'Hör Oma gut zu — sie sagt dir, wo alles ist.',    icon: '☎️' },
      step4_collect_kitchen: { title: '🧺 Sammle in der Küche!',   body: 'Gehe einfach NAHE an die Sachen — kein E nötig!', icon: '🧺' },
      step5_cook:            { title: '🍳 Koch dein Frühstück!',   body: 'Du hast alles! Jetzt kochen.',                    icon: '🍳' },
      // Quest 2 (new step IDs setelah split phone_ring jadi reach+call)
      step1_reach_phone2:    { title: '📞 Tante ruft an!',         body: 'Geh schnell zum Telefon im Flur — Tante wartet!', icon: '📞' },
      step2_phone_call2:     { title: '☎️ Tante spricht...',       body: 'Hör genau zu — sie braucht deine Hilfe!',         icon: '☎️' },
      step3_find_3_items:    { title: '🔎 Such die 3 Sachen!',     body: 'Socken, Papier, Spielzeug — KEINE Hinweise! Such im ganzen Haus.', icon: '🔎' },
      step4_send_message:    { title: '📱 Schreib Tante!',         body: 'Sag ihr, WO du jede Sache gefunden hast.',        icon: '📱' },
      // Quest 3 (Stage 3 — Der Weg zur Schule von Leni)
      step1_reach_phone3:    { title: '📞 Tante ruft an!',         body: 'Geh zum Telefon — neue Aufgabe wartet!',           icon: '📞' },
      step2_get_directions3: { title: '☎️ Tante erklärt den Weg',  body: 'Hör genau zu: Ampel, rechts, gegenüber?',          icon: '☎️' },
      step3_go_schule:       { title: '🏫 Geh zur Schule!',         body: 'Folge Tantes Weg zum großen gelben Gebäude!',      icon: '🏫' },
      step4_meet_leni:       { title: '👧 Triff Leni!',             body: 'Sprich mit Leni vor der Schule (E drücken).',      icon: '👧' },
      step5_return_home:     { title: '🏡 Bring Leni nach Hause!',  body: 'Geh zurück zu Omas Haus.',                         icon: '🏡' },
      // Quest 4 (Stage 3 — Ein Brief von Oma)
      step2_find_brief:      { title: '✉️ Ein Brief von Oma!',      body: 'Auf dem Esstisch in der Küche liegt ein Brief.',   icon: '✉️' },
      step4_go_edeka:        { title: '🛒 Geh zum EDEKA!',          body: 'Folge dem Weg aus Omas Brief in die Stadt!',       icon: '🛒' },
      // Quest 5 (Stage 3 — Weg nach Tantes Haus)
      step2_go_tantes_haus:  { title: '🏠 Zu Tantes Haus!',         body: 'Kreuzung → rechts → Brücke → Park → Bibliothek!',  icon: '🏠' },
    };
    const guide = STEP_GUIDE[next.id];
    if (guide) {
      showToast({ ...guide, type: 'info', duration: 8000 });
    }

    if (next.kind === 'auto') {
      this.triggerAutoStep(next);
    } else if (next.kind === 'collect_auto') {
      // Tampilkan Summary Panel + Quest List Panel
      this.collectedItems = new Set();
      this.onCollectStepStart();
    }

    // Q3: saat mulai jalan ke sekolah → panel kiri dengan rute deskriptif Tante
    if (next.id === 'step3_go_schule') {
      this.showSummaryPanel(
        `Geh zuerst <span class="kw">geradeaus</span> bis zur <span class="kw">Ampel</span>. ` +
        `Dort siehst du eine große <span class="kw">Apotheke</span> — nimm <span class="kw">nach rechts</span> ` +
        `in die <span class="kw">Gutenbergstraße</span>.<br><br>` +
        `Geh weiter geradeaus bis zum <span class="kw">Supermarkt</span>. ` +
        `Direkt <span class="kw">gegenüber</span> liegt die Schule: ein großes ` +
        `<span class="kw">gelbes Gebäude</span> <span class="kw">neben</span> einer kleinen Bäckerei.`,
        '📞 Tante sagt:'
      );
    }

    // Q4: setelah kuis Brief selesai → panel kiri berisi isi Brief von Oma
    if (next.id === 'step4_go_edeka') {
      this.showSummaryPanel(
        `<i>Lieber Lukas,</i><br>` +
        `geh aus dem Haus <span class="kw">nach rechts</span> in die ` +
        `<span class="kw">Blumenstraße</span>. Dann <span class="kw">geradeaus</span> ` +
        `bis zur <span class="kw">Kreuzung</span> — dort siehst du eine ` +
        `<span class="kw">Bank</span>. Nimm <span class="kw">nach rechts</span> in die ` +
        `<span class="kw">Wolfgangstraße</span>. Der Supermarkt liegt ` +
        `<span class="kw">gegenüber</span> dem <span class="kw">Mall</span>.<br><br>` +
        `Kauf: <span class="kw">Kartoffeln</span>, <span class="kw">Fleisch</span>, ` +
        `<span class="kw">Salat</span> und <span class="kw">Butter</span>.<br>` +
        `<i>Deine Oma</i>`,
        '✉️ Omas Brief:'
      );
    }

    // Q5: setelah bicara dengan Frau Weber → panel kiri berisi rutenya
    if (next.id === 'step2_go_tantes_haus') {
      this.showSummaryPanel(
        `Geh diese Straße <span class="kw">geradeaus</span> bis zur großen ` +
        `<span class="kw">Kreuzung</span>. Dann biegst du <span class="kw">nach rechts</span> ab ` +
        `und gehst immer weiter. Nach der <span class="kw">Brücke</span> siehst du einen ` +
        `<span class="kw">Park</span>. Geh <span class="kw">durch</span> den Park hindurch. ` +
        `Auf der anderen Seite steht die alte <span class="kw">Bibliothek</span>. ` +
        `Das Haus deiner Tante ist gleich <span class="kw">daneben</span>.`,
        '🗣️ Die Frau sagt:'
      );
    }

    // Q3: setelah bicara dengan Leni → Leni mengikuti Lukas pulang
    if (next.id === 'step5_return_home') {
      if (window.__setNPCFollowing__) {
        window.__setNPCFollowing__('leni', true);
      }
      showToast({
        title: '👧 Leni folgt dir!',
        body: 'Bring Leni zurück zu Omas Haus.',
        type: 'success', icon: '👧', duration: 6000
      });
    }
  },

  triggerAutoStep(step) {
    // Quest 2 step4_send_message tidak buka dialog — buka SMS Modal sebagai gantinya
    if (step.id === 'step4_send_message') {
      setTimeout(() => this.showSmsModal(), 800);
      return;
    }
    // Quest 4 step3_read_brief: tampilkan panel besar Brief von Oma di tengah layar
    if (step.id === 'step3_read_brief') {
      setTimeout(() => this.showBriefModal(), 600);
      return;
    }
    // Map step.id → dialog (untuk step lain)
    const dialogMap = {
      // Quest 1
      step3_phone_call:  { dialog: 'oma_phone_call',         speaker: 'oma_helga' },
      step5_cook:        { dialog: 'lukas_cooking_timeskip', speaker: 'lukas' },
      // Quest 2 — phone_call2 setelah player reach phone
      step2_phone_call2: { dialog: 'tante_quest2_intro',     speaker: 'tante_maria' },
      // Quest 3 — phone_call3 setelah player reach phone (Stage 2)
      step2_get_directions3: { dialog: 'tante_quest3_intro', speaker: 'tante_maria' },
      // Quest 4 — dialog belanja saat sampai di EDEKA
      step5_shopping:    { dialog: 'lukas_einkaufen',        speaker: 'lukas' },
    };
    const entry = dialogMap[step.id];
    if (!entry) return;
    setTimeout(() => {
      this.currentState = STATE.DIALOG;
      const dlg = getDialog(entry.dialog);
      if (!dlg) return;
      const speakerMap = {
        lukas:       { id: 'lukas',       name: 'Lukas',       avatarUrl: '' },
        oma_helga:   { id: 'oma_helga',   name: 'Oma Helga',   avatarUrl: '' },
        tante_maria: { id: 'tante_maria', name: 'Tante Maria', avatarUrl: '' },
      };
      const speaker = speakerMap[entry.speaker] || speakerMap.lukas;
      openDialog(dlg, speaker);
    }, 800);
  },

  /**
   * Saat phone call selesai → tampilkan Summary Panel + Quest List Panel.
   * Konten berbeda per quest.
   */
  onCollectStepStart() {
    if (this.activeQuestId === 'quest_1') {
      // Quest 1: Oma berikan PETUNJUK lokasi (Leseverstehen)
      this.showSummaryPanel(`
        <p>Lukas, du brauchst diese Sachen:</p>
        <ul>
          <li>Eine <b>Pfanne</b> — <span class="kw">IN</span> dem Schrank</li>
          <li>Die <b>Wurst</b> — <span class="kw">AUF</span> dem Serviertisch</li>
          <li>Die <b>Eier</b> — <span class="kw">UNTER</span> dem kleinen Tisch</li>
          <li>Den <b>Teller</b> — <span class="kw">AUF</span> dem Küchentisch</li>
          <li>Das <b>Besteck</b> — <span class="kw">IN</span> der Schublade</li>
        </ul>
      `);
      this.showQuestListPanel([
        { id: 'pfanne',  label: 'Pfanne',   emoji: '🍳' },
        { id: 'wurst',   label: 'Wurst',    emoji: '🌭' },
        { id: 'eier',    label: 'Eier',     emoji: '🥚' },
        { id: 'teller',  label: 'Teller',   emoji: '🍽' },
        { id: 'besteck', label: 'Besteck',  emoji: '🍴' },
      ]);
    } else if (this.activeQuestId === 'quest_2') {
      // Quest 2: TANTE TIDAK BERI PETUNJUK — Lukas cari sendiri
      this.showSummaryPanel(`
        <p>📱 <b>Tante Maria</b> hat mich gefragt:</p>
        <ul>
          <li>Die <b>Socken</b> 🧦</li>
          <li>Das <b>Papier</b> 📄</li>
          <li>Das <b>Spielzeug</b> 🧸</li>
        </ul>
        <p style="margin-top:8px; font-style:italic; color:#ffcc88;">⚠️ Tante weiß nicht, wo sie sind! Such selbst im ganzen Haus.</p>
      `);
      this.showQuestListPanel([
        { id: 'socken',    label: 'Socken',    emoji: '🧦' },
        { id: 'papier',    label: 'Papier',    emoji: '📄' },
        { id: 'spielzeug', label: 'Spielzeug', emoji: '🧸' },
      ]);
      // Reveal Quest 2 items (yang sebelumnya hidden)
      this.revealQuestItems(['socken', 'papier', 'spielzeug']);
    } else if (this.activeQuestId === 'quest_4') {
      // Quest 4: belanja di Supermarkt
      this.showSummaryPanel(`
        <p>🛒 <b>Omas Einkaufsliste:</b></p>
        <ul>
          <li>Das <b>Fleisch</b> 🥩</li>
          <li>Das <b>Gemüse</b> 🥬</li>
          <li>Das <b>Brot</b> 🍞</li>
        </ul>
        <p style="margin-top:8px; font-style:italic; color:#aaddff;">Geh durch den Supermarkt und sammle alles ein!</p>
      `);
      this.showQuestListPanel([
        { id: 'fleisch', label: 'Fleisch', emoji: '🥩' },
        { id: 'gemuese', label: 'Gemüse',  emoji: '🥬' },
        { id: 'brot',    label: 'Brot',    emoji: '🍞' },
      ]);
    } else if (this.activeQuestId === 'quest_5') {
      // Quest 5: beli Eis
      this.showSummaryPanel(`
        <p>🍦 <b>Lukas möchte ein Eis!</b></p>
        <p style="font-style:italic; color:#ffccdd;">Finde den Eisstand und kauf dir ein Eis.</p>
      `);
      this.showQuestListPanel([
        { id: 'eis', label: 'Eis', emoji: '🍦' },
      ]);
    }
  },

  /**
   * Reveal hidden quest items (visible=true) saat quest mereka mulai.
   */
  revealQuestItems(names) {
    if (!Game.itemsGroup) return;
    Game.itemsGroup.children.forEach(c => {
      if (c.userData?.itemName && names.includes(c.userData.itemName)) {
        c.visible = true;
        if (c.userData.labelSprite) c.userData.labelSprite.visible = true;
      }
    });
  },

  /**
   * Hide quest items (visible=false) — safety-net saat quest selesai.
   * Lukas sudah "memakai" benda-benda Q1, jadi mereka tidak boleh muncul
   * lagi di Gameplay 2 dan seterusnya.
   */
  hideQuestItems(names) {
    if (!Game.itemsGroup) return;
    Game.itemsGroup.children.forEach(c => {
      if (c.userData?.itemName && names.includes(c.userData.itemName)) {
        c.visible = false;
        if (c.userData.labelSprite) c.userData.labelSprite.visible = false;
      }
    });
  },

  /* ─── HINT BUTTON ───────────────────────────────────────────── */

  /**
   * Hint button menampilkan petunjuk berdasarkan step aktif.
   * Per step ada hint text-nya sendiri.
   */
  initHintButton() {
    const btn = document.getElementById('hint-button');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', () => this.showStepHint());
  },

  showStepHint() {
    if (!this.activeQuestId) return;
    const quest = getQuest(this.activeQuestId);
    if (!quest) return;
    const step = quest.steps[this.activeStep];
    if (!step) return;
    const HINTS = {
      // Quest 1
      step1_wake_up:         'Drücke <b>Weiter</b> im Dialog. Lukas redet mit sich selbst.',
      step2_reach_phone:     'Gehe aus deinem Schlafzimmer in den <b>Flur</b>. Das Telefon ist links neben Omas Tür.',
      step3_phone_call:      'Hör Oma zu! Klicke <b>Weiter</b>, um die Anweisungen zu lesen.',
      step4_collect_kitchen: 'Gehe in die <b>Küche</b>. Nähere dich den Sachen — du brauchst kein E zu drücken!',
      step5_cook:            'Du hast alles. Klicke <b>Weiter</b> beim Koch-Dialog.',
      // Quest 2 (new step IDs)
      step1_reach_phone2:    'Tante ruft an! <b>Geh zum Telefon</b> im Flur (links neben Omas Tür).',
      step2_phone_call2:     'Lukas hört Tante zu. Klicke <b>Weiter</b>.',
      step3_find_3_items:    'Such SELBST! Tipp: <b>Socken</b> = Schlafzimmer, <b>Papier</b> = Wohnzimmer, <b>Spielzeug</b> = Küche.',
      step4_send_message:    'Lies jede SMS sorgfältig — eine hat keine Fehler!',
    };
    const hint = HINTS[step.id];
    if (hint) {
      showCenterPopup(hint, '💡', 4500);
    } else {
      showCenterPopup('Schau dich um — Erkunde das Haus!', '💡', 3000);
    }
  },

  showHintButton() {
    document.getElementById('hint-button')?.classList.remove('hud-hidden');
  },
  hideHintButton() {
    document.getElementById('hint-button')?.classList.add('hud-hidden');
  },

  /* ─── PHONE RING ANIMATION ────────────────────────────────────── */

  /**
   * Visual "ringing" effect untuk wired phone — shake + glow pulse.
   * Duration ~4 detik supaya player notice notif sebelum dialog auto-open.
   */
  ringPhoneAnimation() {
    const phone = window.__sceneTriggers__?.wired_phone?.mesh;
    if (!phone) return;
    const startTime = performance.now();
    const duration = 4000;
    const origY = phone.rotation.y;
    const ringTick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        phone.rotation.y = origY;
        phone.position.y = 0;
        return;
      }
      // Rapid shake: rotation oscillation
      const t = elapsed / 1000;
      phone.rotation.y = origY + Math.sin(t * 30) * 0.12;
      phone.position.y = Math.abs(Math.sin(t * 18)) * 0.08;
      requestAnimationFrame(ringTick);
    };
    requestAnimationFrame(ringTick);
  },

  /* ─── SMS MODAL (Quest 2 step4_send_message) ──────────────────── */

  /**
   * 3 SMS cards untuk Quest 2 endgame.
   * Player pilih card yang BENAR. 2 wrong dengan subtle preposition error.
   */
  /**
   * Q4: Panel besar di tengah layar berisi Brief von Oma (gaya surat).
   * Klik di mana saja → tutup → buka dialog kuis (lukas_brief_quiz).
   */
  showBriefModal() {
    // Jangan dobel
    if (document.getElementById('brief-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'brief-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:960;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(10,8,4,0.6);backdrop-filter:blur(3px);cursor:pointer;';
    overlay.innerHTML = `
      <div style="max-width:460px;width:88%;background:#fdf3dc;color:#3a2f1e;
                  border:2px solid #c9a85c;border-radius:10px;padding:26px 30px;
                  font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;
                  box-shadow:0 18px 60px rgba(0,0,0,0.55);">
        <div style="text-align:center;font-size:30px;margin-bottom:8px;">✉️</div>
        <p style="margin:0 0 10px;"><i>Lieber Lukas,</i></p>
        <p style="margin:0 0 10px;">heute Abend kochen wir zusammen. Bitte geh zum Supermarkt
          „EDEKA“ und kauf die Zutaten ein. Der Supermarkt ist nicht weit.
          Geh aus dem Haus nach rechts in die Blumenstraße. Dann geh geradeaus bis zur
          Kreuzung. An der Kreuzung siehst du eine Bank. Nimmt dort nach rechts in die
          Wolfgangstraße. Der Supermarkt liegt gegenüber dem Mall.</p>
        <p style="margin:0 0 10px;">Bitte kauf: Kartoffeln, Fleisch, Salat und Butter.</p>
        <p style="margin:0;">Bis später!<br><i>Deine Oma</i></p>
        <div style="margin-top:16px;text-align:center;font-size:11px;color:#8a744a;
                    font-family:sans-serif;">— Klick irgendwo, um weiterzulesen —</div>
      </div>`;
    document.body.appendChild(overlay);
    // Klik sembarang → tutup → buka kuis
    overlay.addEventListener('click', () => {
      overlay.remove();
      setTimeout(() => {
        this.currentState = STATE.DIALOG;
        const dlg = getDialog('lukas_brief_quiz');
        if (dlg) openDialog(dlg, { id: 'lukas', name: 'Lukas', avatarUrl: '' });
      }, 400);
    }, { once: true });
  },

  showSmsModal() {
    // Hide quest list + summary panels supaya fokus ke SMS modal
    this.hideQuestListPanel();
    this.hideSummaryPanel();
    const modal = document.getElementById('sms-modal');
    const container = document.getElementById('sms-cards');
    if (!modal || !container) return;

    // 3 SMS variants: 2 wrong (subtle preposition error) + 1 correct
    const SMS_VARIANTS = [
      {
        label: 'A',
        correct: false,
        lines: [
          { icon: '🧦', text: 'Die Socken sind AUF dem Schrank.' },  // ← subtle error: should be IM
          { icon: '📄', text: 'Das Papier liegt AUF dem Tisch.' },
          { icon: '🧸', text: 'Das Spielzeug ist UNTER dem Esstisch.' },
        ]
      },
      {
        label: 'B',
        correct: false,
        lines: [
          { icon: '🧦', text: 'Die Socken sind IM Schrank.' },
          { icon: '📄', text: 'Das Papier liegt UNTER dem Tisch.' }, // ← subtle error: should be AUF
          { icon: '🧸', text: 'Das Spielzeug ist UNTER dem Esstisch.' },
        ]
      },
      {
        label: 'C',
        correct: true,
        lines: [
          { icon: '🧦', text: 'Die Socken sind IM Schrank.' },
          { icon: '📄', text: 'Das Papier liegt AUF dem Tisch.' },
          { icon: '🧸', text: 'Das Spielzeug ist UNTER dem Esstisch.' },
        ]
      },
    ];

    // Shuffle order (semua bisa di posisi A/B/C) → cegah pemain hafal jawaban
    const shuffled = [...SMS_VARIANTS].sort(() => Math.random() - 0.5);

    container.innerHTML = '';
    shuffled.forEach((variant, idx) => {
      const card = document.createElement('div');
      card.className = 'sms-card';
      card.dataset.correct = variant.correct ? 'true' : 'false';
      const linesHtml = variant.lines.map(l =>
        `<div class="sms-line"><span class="icon">${l.icon}</span><span>${l.text}</span></div>`
      ).join('');
      card.innerHTML = `
        <div class="sms-greeting"><span class="sms-label">${String.fromCharCode(65+idx)}</span> Hallo Tante! Ich habe alles gefunden:</div>
        ${linesHtml}
      `;
      card.addEventListener('click', () => {
        this.handleSmsChoice(variant.correct, card);
      });
      container.appendChild(card);
    });

    modal.classList.remove('hud-hidden');
  },

  /**
   * Handle SMS card click.
   * Correct: green flash + Tante "Danke!" toast + complete quest 2
   * Wrong: shake + red flash + retry
   */
  handleSmsChoice(isCorrect, cardEl) {
    if (isCorrect) {
      cardEl.classList.add('correct');
      // Disable all cards
      document.querySelectorAll('.sms-card').forEach(c => {
        c.style.pointerEvents = 'none';
      });
      showToast({
        title: '✅ Perfekt!',
        body: 'Tante Maria: "Danke, Lukas! 💕"',
        type: 'success', icon: '💌', duration: 4000
      });
      // Wait then close modal + complete quest
      setTimeout(() => {
        const modal = document.getElementById('sms-modal');
        if (modal) modal.classList.add('hud-hidden');
        window.dispatchEvent(new CustomEvent('quest:progress', { detail: { stepId: 'step4_send_message' } }));
        window.dispatchEvent(new CustomEvent('quest:complete', { detail: { questId: 'quest_2' } }));
        window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, {
          detail: { points: 500, label: 'Quest 2 abgeschlossen!' }
        }));
        showCenterPopup(
          '<b>Gameplay 2 abgeschlossen!</b><br>Du hast Tante geholfen 💪',
          '🎉', 4500
        );
      }, 1500);
    } else {
      cardEl.classList.add('wrong');
      showToast({
        title: '❌ Falsch!',
        body: 'Lies nochmal sorgfältig. Wo waren die Sachen wirklich?',
        type: 'error', icon: '📖', duration: 3500
      });
      // Reset wrong class after animation so user can retry
      setTimeout(() => cardEl.classList.remove('wrong'), 500);
    }
  },

  /* ─── ONBOARDING BANNER HELPERS ─────────────────────────────── */
  showOnboardingBanner(text) {
    const el = document.getElementById('onboarding-banner');
    if (!el) return;
    if (text) {
      const txtEl = el.querySelector('.onb-text');
      if (txtEl) txtEl.textContent = text;
    }
    el.classList.remove('hud-hidden');
  },
  hideOnboardingBanner() {
    const el = document.getElementById('onboarding-banner');
    if (el) el.classList.add('hud-hidden');
  },

  /* ─── STEP HUD with PULSE + EMOJI PREFIX ─────────────────────── */
  updateStepHUD(quest) {
    const step = quest.steps[this.activeStep];
    if (!step) return;
    const qName = document.getElementById('quest-name');
    if (!qName) return;
    // Emoji prefix per step ID
    const stepIcons = {
      // Quest 1
      step1_wake_up:         '😴',
      step2_reach_phone:     '📞',
      step3_phone_call:      '☎️',
      step4_collect_kitchen: '🧺',
      step5_cook:            '🍳',
      // Quest 2 (new step IDs)
      step1_reach_phone2:    '📞',
      step2_phone_call2:     '☎️',
      step3_find_3_items:    '🔎',
      step4_send_message:    '📱',
      // Quest 3 (Stage 2)
      step1_reach_phone3:    '📞',
      step2_get_directions3: '☎️',
      step3_go_schule:       '🏫',
      step4_meet_leni:       '👧',
      step5_return_home:     '🏡',
    };
    const icon = stepIcons[step.id] || '🎯';
    qName.innerHTML = `${icon} ${step.description || quest.title}`;
    // Restart pulse animation
    qName.classList.remove('pulse');
    void qName.offsetWidth; // force reflow
    qName.classList.add('pulse');
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
      // Resolve a model part to its quest root; ignore hidden items and labels.
      for (const intersection of intersects) {
        let hit = intersection.object;
        let visible = true;
        for (let parent = hit; parent; parent = parent.parent) {
          if (!parent.visible) visible = false;
        }
        while (hit && !hit.userData.isInteractable && !hit.userData.isDoor) hit = hit.parent;
        if (hit && visible) { this.evaluateInteraction(hit); break; }
      }
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
    if (mesh.userData.labelSprite) mesh.userData.labelSprite.visible = false;
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
      // Stage 1 Quest 1: 7 benda dapur
      const quest = getQuest('quest_1');
      const step = quest && quest.steps[this.activeStep];
      const targetList = (step && step.kind === 'collect_items') ? step.target : [];
      const totalNeeded = targetList.length || 7;
      if (this.collectedItems.size >= totalNeeded) {
        // Step 4 done → advance to step 5 (cooking time skip)
        this.progressStep('step4_collect_kitchen');
      } else {
        showToast({ title: 'Fortschritt', body: `${this.collectedItems.size}/${totalNeeded} Küchenutensilien gefunden`, type: 'info' });
      }
    } else if (this.activeQuestId === 'quest_2') {
      // Stage 1 Quest 2: 1 mainan (spielzeug)
      if (this.collectedItems.size >= 1) {
        this.currentState = STATE.DIALOG;
        setTimeout(() => {
          showToast({ title: 'Spielzeug gefunden!', body: 'Das Spielzeug ist auf dem Sofa!', type: 'success', icon: '🧸' });
          window.__questState__['quest_2'] = 'completed';
          this.activeQuestId = null;
          this.currentState = STATE.IDLE;
          window.dispatchEvent(new CustomEvent('quest:complete', { detail: { questId: 'quest_2' } }));
        }, 1000);
      }
    } else {
      // Quest lainnya
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

    // Map quest ID → journal entry key
    const journalMap = {
      quest_1: 'frühstück_notiz',
      quest_2: 'wohnzimmer_notiz',
      quest_3: 'leni_abholen_notiz',
      quest_4: 'einkaufen_notiz',
      quest_5: 'tantes_haus_notiz',
      quest_6: 'verloren_notiz',
      quest_7: 'kino_notiz',
    };
    const entryKey = journalMap[questId];
    if (entryKey) {
      import('./data/dialogs.js').then(({ getJournalEntry }) => {
        const entry = getJournalEntry(entryKey);
        if (entry) {
          descEl.innerHTML = `<strong>${entry.title}</strong><br><em>${entry.subtitle || ''}</em><br><br>${entry.body}`;
        }
      });
    } else {
      descEl.innerHTML = 'Du suchst nach Hinweisen...';
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

    // Step-based trigger detection (poll ~200ms)
    this._roomCheckTimer += delta;
    if (this._roomCheckTimer >= 0.2) {
      this._roomCheckTimer = 0;
      this.checkStepTriggers();
    }
  },

  /**
   * Polling-based trigger detection untuk step aktif.
   * Supported kinds: 'reach_room', 'reach_trigger', 'collect_auto'.
   */
  checkStepTriggers() {
    if (!Game.player || !this.activeQuestId) return;
    if (this.currentState === STATE.DIALOG) return;
    const quest = getQuest(this.activeQuestId);
    if (!quest) return;
    const step = quest.steps[this.activeStep];
    if (!step) return;

    const px = Game.player.position.x;
    const pz = Game.player.position.z;

    if (step.kind === 'reach_room') {
      if (pointInRoom(px, pz, step.target)) {
        this.progressStep(step.id);
      }
    } else if (step.kind === 'reach_trigger') {
      // Trigger zone (e.g. wired_phone). Data from window.__sceneTriggers__
      const trig = window.__sceneTriggers__ && window.__sceneTriggers__[step.target];
      if (trig && !trig.triggered) {
        const dx = px - trig.x;
        const dz = pz - trig.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= trig.radius) {
          trig.triggered = true;
          this.progressStep(step.id);
        }
      }
    } else if (step.kind === 'reach_zone') {
      // Step advances when player CURRENTLY in target zone (zone change detected)
      // Stored at window.__currentZoneId__ by zone.js after loadZone
      const currentZone = window.__currentZoneId__;
      if (currentZone === step.target) {
        this.progressStep(step.id);
      }
    } else if (step.kind === 'reach_building') {
      // Step advances saat player dekat gedung target di kota STADT.
      // Registry: window.__stadtBuildings__[name] = {x, z, r}
      const b = window.__stadtBuildings__ && window.__stadtBuildings__[step.target];
      if (b && Math.hypot(px - b.x, pz - b.z) <= (b.r || 3.5)) {
        this.progressStep(step.id);
      }
    } else if (step.kind === 'talk_npc') {
      // NPC dialog progresses step via onEnter actions in dialog tree (no proximity check)
      // Just no-op here — dialog system handles step advance
    } else if (step.kind === 'collect_auto') {
      // Auto-proximity item pickup (NO key press required)
      const PICKUP_RADIUS = 1.6;
      const needed = step.target || [];
      if (!this.collectedItems) this.collectedItems = new Set();

      for (const child of Game.itemsGroup.children) {
        if (!child.userData || !child.userData.itemName) continue;
        const name = child.userData.itemName;
        if (!needed.includes(name)) continue;
        if (this.collectedItems.has(name)) continue;
        if (!child.visible) continue;
        const dx = px - child.position.x;
        const dz = pz - child.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= PICKUP_RADIUS) {
          this.autoCollectItem(child, name);
        }
      }
    }
  },

  /**
   * Auto-collect item via proximity. No raycast/E-key.
   */
  autoCollectItem(mesh, itemName) {
    if (!this.collectedItems) this.collectedItems = new Set();
    this.collectedItems.add(itemName);

    // Fade-out animation (or instant hide)
    mesh.visible = false;
    if (mesh.userData.labelSprite) mesh.userData.labelSprite.visible = false;

    // Confetti + score
    this.spawnConfetti();
    window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, {
      detail: { points: 50, label: `Gefunden: ${itemName}` }
    }));

    // 3-detik popup CENTER UI dengan Lokale Präpositionen (Dativ)
    const desc = ITEM_DESCRIPTIONS[itemName];
    if (desc) {
      showCenterPopup(desc.text, desc.emoji, 3000);
    }

    // Strike-through in QuestListPanel
    this.markItemFoundInPanel(itemName);

    // Cek apakah sudah semua
    const quest = getQuest(this.activeQuestId);
    const step = quest && quest.steps[this.activeStep];
    if (step && step.target) {
      const total = step.target.length;
      const got = this.collectedItems.size;
      showToast({ title: 'Gefunden!', body: `${got}/${total} — ${itemName}`, type: 'success', icon: '🎉', duration: 1500 });
      if (got >= total) {
        // Hide quest list panel, advance step
        setTimeout(() => {
          this.hideQuestListPanel();
          this.hideSummaryPanel();
          this.progressStep(step.id);
        }, 1200);
      }
    }
  },

  /* ─── UI PANEL HELPERS ─────────────────────────────────────────── */

  showSummaryPanel(html, title = null) {
    const panel = document.getElementById('summary-panel');
    const body = document.getElementById('summary-content');
    if (!panel || !body) return;
    body.innerHTML = html;
    const titleEl = panel.querySelector('.summary-title');
    if (titleEl) titleEl.textContent = title || 'Oma sagt:';
    panel.classList.remove('hud-hidden');
  },
  hideSummaryPanel() {
    const panel = document.getElementById('summary-panel');
    if (panel) panel.classList.add('hud-hidden');
  },

  showQuestListPanel(items) {
    // items: array of { id, label, emoji }
    const panel = document.getElementById('quest-list-panel');
    const ul = document.getElementById('quest-list-items');
    const counter = document.getElementById('quest-list-count');
    if (!panel || !ul) return;
    ul.innerHTML = '';
    items.forEach(it => {
      const li = document.createElement('li');
      li.dataset.itemId = it.id;
      li.innerHTML =
        `<span class="item-checkbox"></span>` +
        `<span class="item-emoji">${it.emoji}</span>` +
        `<span class="item-label">${it.label}</span>`;
      ul.appendChild(li);
    });
    if (counter) counter.textContent = `0 / ${items.length}`;
    panel.classList.remove('hud-hidden');
    this._questListTotal = items.length;
  },
  hideQuestListPanel() {
    const panel = document.getElementById('quest-list-panel');
    if (panel) panel.classList.add('hud-hidden');
  },
  markItemFoundInPanel(itemId) {
    const li = document.querySelector(`#quest-list-items li[data-item-id="${itemId}"]`);
    if (li) li.classList.add('found');
    const counter = document.getElementById('quest-list-count');
    if (counter && this._questListTotal) {
      const found = document.querySelectorAll('#quest-list-items li.found').length;
      counter.textContent = `${found} / ${this._questListTotal}`;
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
