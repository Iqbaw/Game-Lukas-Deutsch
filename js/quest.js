// ═══════════════════════════════════════════════════════════════════
// js/quest.js — QUEST ENGINE
//
// Seluruh alur quest dibaca dari js/data/quests.js. Setiap langkah punya
// jenis pemicu (kind) dan boleh membawa: dialog, action (sms / brief /
// cutscene:*), panel instruksi, dan daftar barang. Engine ini:
//   • menjalankan langkah 'auto' (dialog / aksi) setelah dialog lain tutup
//   • memeriksa pemicu (zona, gedung, telepon, barang) tiap 0,2 detik
//   • memperbarui HUD kiri-atas (Quest n/10, langkah x/y, instruksi + hint)
//   • menampilkan kartu "Quest selesai" + quest berikutnya, lalu transisi
//     waktu (makan malam → malam, hari berikutnya, sore) bila ada
//   • mengatur barang quest, NPC yang terlihat, dan penanda tujuan
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { Game, registerUpdate } from './main.js';
import { CONFIG, EVENTS, ZONES } from './config.js';
import { getQuest, QUEST_ORDER, questNumber } from './data/quests.js';
import { getNPCsInZone } from './data/npcs.js';
import { openDialog, Dialog } from './dialog.js';
import { getDialog } from './data/dialogs.js';
import { showToast } from './ui.js';
import { setInputEnabled } from './player.js';
import { spawnNPC, despawnNPC, getNPCRecord, getAllNPCs, setNPCFollowing } from './npc.js';
import { Journal } from './journal.js';
import { Cutscene } from './cutscene.js';
import { playJingle } from './music.js';

const STATE = {
  IDLE:        'IDLE',
  DIALOG:      'DIALOG',
  EXPLORATION: 'EXPLORATION',
  CUTSCENE:    'CUTSCENE',
  CARD:        'CARD',
};

// ═══════════════════════════════════════════════════════════════════
// ITEM DESCRIPTIONS — Lokale Präpositionen (Dativ)
// Pop-up tengah layar saat barang terambil otomatis.
// ═══════════════════════════════════════════════════════════════════
const ITEM_DESCRIPTIONS = {
  // ── Quest 1 (sarapan) ──
  pfanne:  { emoji: '🍳', text: 'Die Pfanne ist <span class="prep">IN</span> dem Schrank.' },
  wurst:   { emoji: '🌭', text: 'Die Wurst ist <span class="prep">AUF</span> dem Serviertisch.' },
  eier:    { emoji: '🥚', text: 'Die Eier sind <span class="prep">UNTER</span> dem Tisch.' },
  teller:  { emoji: '🍽', text: 'Der Teller ist <span class="prep">AUF</span> dem Küchentisch.' },
  besteck: { emoji: '🍴', text: 'Das Besteck ist <span class="prep">IN</span> der Schublade.' },
  // ── Quest 2 (barang Tante) ──
  socken:    { emoji: '🧦', text: 'Die Socken sind <span class="prep">IN</span> dem Schrank.' },
  papier:    { emoji: '📄', text: 'Das Papier liegt <span class="prep">AUF</span> dem Tisch.' },
  spielzeug: { emoji: '🧸', text: 'Das Spielzeug ist <span class="prep">UNTER</span> dem Esstisch.' },
  // ── Quest 4 (belanja di EDEKA) ──
  kartoffeln: { emoji: '🥔', text: 'Die Kartoffeln liegen <span class="prep">IM</span> Gemüseregal.' },
  salat:      { emoji: '🥬', text: 'Der Salat liegt <span class="prep">NEBEN</span> den Kartoffeln.' },
  fleisch:    { emoji: '🥩', text: 'Das Fleisch ist <span class="prep">IN</span> der Kühltheke.' },
  butter:     { emoji: '🧈', text: 'Die Butter ist <span class="prep">IM</span> Kühlregal.' },
};

/** Pop-up 3 detik di tengah layar (barang, pencapaian, hint). */
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

if (typeof window !== 'undefined') {
  window.showCenterPopup = showCenterPopup;
  window.ITEM_DESCRIPTIONS = ITEM_DESCRIPTIONS;
}

// Pembicara untuk dialog langkah 'auto' (nama tampil di kotak dialog)
const SPEAKERS = {
  lukas:       { id: 'lukas',       name: 'Lukas' },
  oma_helga:   { id: 'oma_helga',   name: 'Oma Helga' },
  opa_klaus:   { id: 'opa_klaus',   name: 'Opa Klaus' },
  tante_maria: { id: 'tante_maria', name: 'Tante Maria' },
  felix:       { id: 'felix',       name: 'Felix' },
};

// Tombol "Weiter" di kartu quest: E / Enter / Space
const CARD_KEYS = new Set(['KeyE', 'Enter', 'NumpadEnter', 'Space']);

// Penanda tujuan untuk gedung kota muncul bila pemain sudah dekat — rute
// tetap harus dibaca sendiri (tujuan belajar), penanda hanya memastikan.
const BUILDING_MARKER_RANGE = 14;

export const QuestSystem = {
  currentState: STATE.IDLE,
  activeQuestId: null,
  activeStep: 0,
  questTimer: 0,
  collectedItems: new Set(),
  lastRoom: null,
  _pollTimer: 0,
  _stepToken: 0,
  _card: null,
  _marker: null,
  _markerTarget: null,

  init() {
    window.__questState__ = window.__questState__ || {};
    window.__QUEST_SYSTEM__ = this;

    registerUpdate((delta, elapsed) => this.update(delta, elapsed));

    window.addEventListener(EVENTS.QUEST_START, (e) => this.startQuest(e.detail.questId));

    // Game baru ("Abenteuer beginnen"): reset total, lalu mulai Quest 1
    window.addEventListener('game:start', () => {
      window.__questState__ = {};
      this.activeQuestId = null;
      this.activeStep = 0;
      this.currentState = STATE.IDLE;
      this.collectedItems = new Set();
      if (window.__sceneTriggers__) {
        Object.values(window.__sceneTriggers__).forEach(t => { if (t) t.triggered = false; });
      }
      Journal.reset();
      this.showOnboardingBanner();
      setTimeout(() => {
        if (this.activeQuestId) return;
        this.startQuest('quest_1');
      }, 800);
    });

    // Efek dialog → langkah / quest
    window.addEventListener('quest:progress', (e) => {
      const stepId = e.detail && e.detail.stepId;
      if (stepId) this.progressStep(stepId);
    });
    window.addEventListener('quest:complete', (e) => {
      const qid = e.detail && e.detail.questId;
      if (qid) this.completeQuest(qid);
    });

    window.addEventListener(EVENTS.DIALOG_OPEN, (e) => {
      this._lastOpenedDialogId = e.detail?.dialogId || null;
      if (this.currentState !== STATE.CUTSCENE && this.currentState !== STATE.CARD) {
        this.currentState = STATE.DIALOG;
      }
      this.hideOnboardingBanner();
    });
    window.addEventListener(EVENTS.DIALOG_CLOSE, () => this.onDialogClosed());

    // Pindah zona: barang, NPC, penanda ikut diperbarui
    window.addEventListener('zone:enter', () => {
      this.syncItems();
      this.updateMarker(true);
      setTimeout(() => this.refreshNPCs(), 900);   // setelah fade-in zona selesai
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.currentState === STATE.CARD || this.currentState === STATE.CUTSCENE) return;
        Journal.toggle();
      } else if (this._card && CARD_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this._card.continue();
      }
    }, true);

    const hintBtn = document.getElementById('hint-button');
    if (hintBtn && !hintBtn._wired) {
      hintBtn._wired = true;
      hintBtn.addEventListener('click', () => this.showStepHint());
    }

    // Kolom panel kiri selalu tepat di bawah kartu quest (tingginya berubah)
    const tracker = document.getElementById('quest-tracker');
    if (tracker && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.layoutLeftColumn()).observe(tracker);
    }
    window.addEventListener('resize', () => this.layoutLeftColumn());

    Journal.init(this);
  },

  // ═════════════════════════════════════════════════════════════════
  // SIMPANAN
  // ═════════════════════════════════════════════════════════════════

  restoreProgress(data) {
    window.__questState__ = { ...(data.questState || {}) };
    this.collectedItems = new Set(Array.isArray(data.collectedItems) ? data.collectedItems : []);
    this.lastRoom = data.lastRoom || null;
    this.questTimer = 0;
    this.closeCard();

    const qs = window.__questState__;
    let active = data.activeQuestId && getQuest(data.activeQuestId) ? data.activeQuestId : null;
    if (active && qs[active] === 'completed') active = null;

    if (!active) {
      // Disimpan saat kartu "Quest selesai" tampil → lanjut ke quest berikutnya
      const next = QUEST_ORDER.find(id => qs[id] !== 'completed') || null;
      this.activeQuestId = null;
      this.activeStep = 0;
      this.currentState = STATE.IDLE;
      if (next) this.startQuest(next, { silent: true });
      else { this.hideQuestUI(); }
      return;
    }

    const quest = getQuest(active);
    this.activeQuestId = active;
    this.activeStep = Math.min(quest.steps.length - 1,
      Math.max(0, Number.isFinite(data.activeStep) ? data.activeStep : 0));
    qs[active] = 'active';
    if (quest.city) window.__stadtVariant__ = quest.city;
    this.currentState = STATE.EXPLORATION;
    Journal.onQuestStart(quest);
    this.enterStep({ restored: true });
  },

  // ═════════════════════════════════════════════════════════════════
  // ALUR QUEST
  // ═════════════════════════════════════════════════════════════════

  startQuest(questId, { silent = false } = {}) {
    const quest = getQuest(questId);
    if (!quest) return;

    this.closeCard();
    this.activeQuestId = questId;
    this.activeStep = 0;
    this.collectedItems = new Set();
    window.__questState__[questId] = 'active';
    this.questTimer = 0;
    this.currentState = Dialog.isOpen ? STATE.DIALOG : STATE.EXPLORATION;

    // Varian tata letak kota (nama jalan) untuk quest ini — js/stadt.js
    if (quest.city) window.__stadtVariant__ = quest.city;

    Journal.onQuestStart(quest);
    if (questId !== 'quest_1') this.hideOnboardingBanner();
    if (!silent) this.showQuestBanner(quest);
    this.enterStep({ fresh: true });
    window.dispatchEvent(new CustomEvent('save:request'));
  },

  /** Langkah aktif dimulai: HUD, panel, barang, NPC, aksi otomatis. */
  enterStep({ fresh = false, restored = false } = {}) {
    const quest = getQuest(this.activeQuestId);
    if (!quest) return;
    const step = quest.steps[this.activeStep];
    if (!step) return;
    const token = ++this._stepToken;

    this.updateHUD(quest, step, { pulse: !fresh });
    this.showStepPanels(step);
    this.showHintButton();
    this.syncItems();
    this.refreshNPCs();
    this.updateMarker(true);
    Journal.refresh();

    // Telepon berdering lagi (Tante menelepon) — pemicu harus bisa aktif ulang
    if (step.kind === 'reach_trigger' && window.__sceneTriggers__?.[step.target]) {
      window.__sceneTriggers__[step.target].triggered = false;
      if (step.target === 'wired_phone' && this.activeQuestId !== 'quest_1' && !restored) {
        this.ringPhoneAnimation();
      }
    }

    const hook = STEP_ENTER[step.id];
    if (hook) hook.call(this, { restored });
    // Musik latar memilih lagu sesuai quest & langkah (js/music.js)
    window.dispatchEvent(new CustomEvent('quest:step', { detail: { questId: this.activeQuestId, stepId: step.id } }));

    if (step.kind === 'auto') {
      // Dialog pembuka langkah 1 boleh berasal dari quest.intro_dialog
      const dialogId = step.dialog || (this.activeStep === 0 ? quest.intro_dialog : null);
      const delay = fresh ? 1400 : 700;
      this.whenFree(token, () => this.runAuto(step, dialogId), delay);
    }
  },

  /** Jalankan fn setelah dialog/cutscene/kartu selesai — batal bila langkah berubah. */
  whenFree(token, fn, delay = 600) {
    const tick = () => {
      if (token !== this._stepToken) return;
      const busy = Dialog.isOpen || this.currentState === STATE.CUTSCENE ||
        this.currentState === STATE.CARD || window.__zoneTransitionBusy__ ||
        !Game.isRunning || Game.isPaused;
      if (busy) { setTimeout(tick, 200); return; }
      fn();
    };
    setTimeout(tick, delay);
  },

  runAuto(step, dialogId) {
    if (step.action) {
      this.runAction(step);
      return;
    }
    if (!dialogId) return;
    const dlg = getDialog(dialogId);
    if (!dlg) {
      console.warn('[quest] dialog tidak ada:', dialogId);
      this.progressStep(step.id);
      return;
    }
    const quest = getQuest(this.activeQuestId);
    const speakerId = step.speaker || quest?.giver || 'lukas';
    const speaker = SPEAKERS[speakerId] || window.__NPC_DATA__?.[speakerId] || { id: speakerId, name: 'Lukas' };
    this.hideOnboardingBanner();
    this.currentState = STATE.DIALOG;
    openDialog(dlg, speaker);
  },

  runAction(step) {
    const action = step.action;
    if (action === 'sms') { this.showSmsModal(); return; }
    if (action === 'brief') { this.showBriefModal(); return; }
    if (action.startsWith('cutscene:')) {
      const name = action.slice('cutscene:'.length);
      this.currentState = STATE.CUTSCENE;
      this.hideQuestUI(true);
      Cutscene.play(name)
        .catch(err => console.error('[quest] cutscene error', err))
        .then(() => {
          this.currentState = STATE.EXPLORATION;
          this.showQuestUI();
          this.progressStep(step.id);
        });
    }
  },

  /**
   * Dialog ditutup. Dialog milik langkah aktif yang belum memajukan langkah
   * (mis. efek terlewat) memajukannya sekarang — dialog selesai = langkah selesai.
   */
  onDialogClosed() {
    if (this.currentState === STATE.DIALOG) {
      this.currentState = this.activeQuestId ? STATE.EXPLORATION : STATE.IDLE;
    }
    const closedId = this._lastOpenedDialogId;
    this._lastOpenedDialogId = null;
    const quest = getQuest(this.activeQuestId);
    const step = quest?.steps[this.activeStep];
    if (!step || !closedId) return;
    const stepDialog = step.dialog || (this.activeStep === 0 ? quest.intro_dialog : null) ||
      (step.action === 'brief' ? 'lukas_brief_quiz' : null);
    if (closedId === stepDialog && (step.kind === 'auto' || step.kind === 'talk_npc')) {
      this.progressStep(step.id);
    }
  },

  /** Dipanggil efek dialog 'progress_quest' & pemicu. Boleh melompati langkah. */
  progressStep(stepId) {
    const quest = getQuest(this.activeQuestId);
    if (!quest) return;
    const idx = quest.steps.findIndex(s => s.id === stepId);
    if (idx < 0 || idx < this.activeStep) return;
    this.activeStep = idx + 1;
    window.dispatchEvent(new CustomEvent('save:request'));

    if (this.activeStep >= quest.steps.length) {
      this.completeQuest(this.activeQuestId);
      return;
    }
    const next = quest.steps[this.activeStep];
    // Di layar sempit toast menutupi kartu quest — kartu sendiri sudah berkedip & berganti
    if (window.innerWidth > 768) showToast({
      title: `${next.icon || '➡️'} Nächster Schritt`,
      body: next.description,
      type: 'info', icon: '✅', duration: 4500,
    });
    this.enterStep();
  },

  /** Quest selesai (idempoten): skor, jurnal, kartu → quest berikutnya. */
  completeQuest(qid) {
    const quest = getQuest(qid);
    if (!quest || window.__questState__[qid] === 'completed') return;
    window.__questState__[qid] = 'completed';
    if (this.activeQuestId === qid) {
      this.activeQuestId = null;
      this.activeStep = 0;
    }
    this._stepToken++;
    this.collectedItems = new Set();

    const reward = quest.reward || {};
    if (reward.score) {
      window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, {
        detail: { points: reward.score, label: `${quest.title} abgeschlossen!` },
      }));
    }
    Journal.onQuestComplete(quest);
    this.hideSummaryPanel();
    this.hideQuestListPanel();
    this.hideMarker();
    this.syncItems();
    window.dispatchEvent(new CustomEvent('save:request'));

    const hook = QUEST_COMPLETE[qid];
    if (hook) hook.call(this);

    // Kartu muncul setelah dialog terakhir ditutup
    const token = this._stepToken;
    const show = () => {
      if (token !== this._stepToken) return;
      if (Dialog.isOpen || this.currentState === STATE.CUTSCENE || window.__zoneTransitionBusy__) {
        setTimeout(show, 200);
        return;
      }
      this.showCompletionCard(quest);
    };
    setTimeout(show, 500);
  },

  /** Lanjut setelah kartu: transisi waktu (bila ada), lalu quest berikutnya. */
  async continueAfter(quest) {
    if (!quest.next) {
      this.currentState = STATE.CUTSCENE;
      this.hideQuestUI(true);
      await Cutscene.play('finale');
      this.currentState = STATE.IDLE;
      return;
    }
    if (quest.transition) {
      this.currentState = STATE.CUTSCENE;
      this.hideQuestUI(true);
      try { await Cutscene.transition(quest.transition); }
      catch (err) { console.error('[quest] transition error', err); }
      this.currentState = STATE.IDLE;
      this.showQuestUI();
    }
    this.startQuest(quest.next);
  },

  // ═════════════════════════════════════════════════════════════════
  // PEMICU
  // ═════════════════════════════════════════════════════════════════

  update(delta) {
    if (this.currentState === STATE.EXPLORATION) this.questTimer += delta;
    this._pollTimer += delta;
    if (this._pollTimer >= 0.2) {
      this._pollTimer = 0;
      this.checkStepTriggers();
      this.updateMarker(false);
    }
    if (this._marker && this._marker.visible) {
      const t = performance.now() / 1000;
      this._marker.userData.arrow.position.y = this._marker.userData.baseY + Math.sin(t * 3) * 0.18;
      this._marker.userData.arrow.rotation.y = t * 1.6;
      const s = 1 + Math.sin(t * 3) * 0.08;
      this._marker.userData.ring.scale.set(s, s, s);
    }
  },

  checkStepTriggers() {
    if (!Game.player || !this.activeQuestId) return;
    if (this.currentState !== STATE.EXPLORATION && this.currentState !== STATE.IDLE) return;
    if (Dialog.isOpen || window.__zoneTransitionBusy__) return;
    const quest = getQuest(this.activeQuestId);
    const step = quest?.steps[this.activeStep];
    if (!step) return;

    const px = Game.player.position.x;
    const pz = Game.player.position.z;

    if (step.kind === 'reach_trigger') {
      const trig = window.__sceneTriggers__?.[step.target];
      if (trig && !trig.triggered && window.__currentZoneId__ === (trig.zone || ZONES.HAUS_INTERIOR) &&
          Math.hypot(px - trig.x, pz - trig.z) <= trig.radius) {
        trig.triggered = true;
        this.progressStep(step.id);
      }
    } else if (step.kind === 'reach_zone') {
      if (window.__currentZoneId__ === step.target) this.progressStep(step.id);
    } else if (step.kind === 'reach_building') {
      if (window.__currentZoneId__ !== ZONES.STADT) return;
      const b = window.__stadtBuildings__?.[step.target];
      const inside = b && (b.hw
        ? Math.abs(px - b.x) <= b.hw && Math.abs(pz - b.z) <= b.hd
        : Math.hypot(px - b.x, pz - b.z) <= (b.r || 3.5));
      if (inside) this.progressStep(step.id);
    } else if (step.kind === 'collect_auto') {
      const PICKUP_RADIUS = 1.6;
      const needed = step.target || [];
      for (const child of Game.itemsGroup.children) {
        const name = child.userData?.itemName;
        if (!name || !needed.includes(name) || this.collectedItems.has(name) || !child.visible) continue;
        if (Math.hypot(px - child.position.x, pz - child.position.z) <= PICKUP_RADIUS) {
          this.autoCollectItem(child, name, step);
        }
      }
    }
    // talk_npc: maju lewat efek dialog langkah (lihat dialogForNPC)
  },

  /** Dialog yang dibuka saat pemain bicara dengan NPC (dipakai dialog.js). */
  dialogForNPC(npcId) {
    const quest = getQuest(this.activeQuestId);
    const step = quest?.steps[this.activeStep];
    if (step && step.kind === 'talk_npc' && step.target === npcId && step.dialog) return step.dialog;
    return null;
  },

  autoCollectItem(mesh, itemName, step) {
    this.collectedItems.add(itemName);
    mesh.visible = false;
    if (mesh.userData.labelSprite) mesh.userData.labelSprite.visible = false;

    this.spawnConfetti();
    window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, {
      detail: { points: 50, label: `Gefunden: ${itemName}` },
    }));
    const desc = ITEM_DESCRIPTIONS[itemName];
    if (desc) showCenterPopup(desc.text, desc.emoji, 3000);
    this.markItemFoundInPanel(itemName);
    window.dispatchEvent(new CustomEvent('save:request'));

    const total = (step.target || []).length;
    const got = step.target.filter(n => this.collectedItems.has(n)).length;
    if (got >= total) {
      const stepId = step.id;
      setTimeout(() => this.progressStep(stepId), 1400);
    } else {
      const label = (step.items || []).find(i => i.id === itemName)?.label || itemName;
      showToast({ title: `Gefunden: ${label}`, body: `${got} / ${total}`, type: 'success', icon: '🧺', duration: 1800 });
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // BARANG & NPC
  // ═════════════════════════════════════════════════════════════════

  /**
   * Barang quest hanya terlihat saat masuk akal:
   *   Quest 1: ada di dapur sampai Quest 1 selesai.
   *   Quest lain: hanya saat quest itu aktif dan langkah mengumpulkan sudah tiba.
   */
  syncItems() {
    if (!Game.itemsGroup) return;
    const qs = window.__questState__ || {};
    const quest = getQuest(this.activeQuestId);
    const collectIdx = quest ? quest.steps.findIndex(s => s.kind === 'collect_auto') : -1;
    Game.itemsGroup.children.forEach(c => {
      const ud = c.userData;
      if (!ud?.itemName) return;
      const q = ud.questTarget;
      let vis = qs[q] !== 'completed';
      if (vis && q === this.activeQuestId && this.collectedItems.has(ud.itemName)) vis = false;
      if (vis && q !== 'quest_1') vis = q === this.activeQuestId && collectIdx >= 0 && this.activeStep >= collectIdx;
      c.visible = vis;
      if (ud.labelSprite) ud.labelSprite.visible = vis;
    });
  },

  /** Samakan NPC di zona ini dengan aturan cerita (tanpa memuat ulang zona). */
  refreshNPCs() {
    const zoneId = window.__currentZoneId__;
    if (!zoneId || window.__zoneTransitionBusy__ || !Game.npcGroup) return;
    const wanted = getNPCsInZone(zoneId);
    const wantedIds = new Set(wanted.map(n => n.id));
    for (const npc of getAllNPCs()) {
      const rec = getNPCRecord(npc.id);
      if (!wantedIds.has(npc.id) && !rec?._following && !rec?._scriptTarget && !rec?._keep) despawnNPC(npc.id);
    }
    for (const npc of wanted) {
      if (!getNPCRecord(npc.id)) spawnNPC(npc);
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // PENANDA TUJUAN (panah emas di atas NPC / benda / pintu)
  // ═════════════════════════════════════════════════════════════════

  ensureMarker() {
    if (this._marker) return this._marker;
    const g = new THREE.Group();
    g.name = 'quest-marker';
    const gold = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.95, depthTest: false });
    const arrow = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 4), gold);
    cone.rotation.x = Math.PI;               // ujung ke bawah
    arrow.add(cone);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.16), gold);
    stem.position.y = 0.45;
    arrow.add(stem);
    arrow.renderOrder = 999;
    cone.renderOrder = stem.renderOrder = 999;
    g.add(arrow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
    g.userData = { arrow, ring, baseY: 2.6 };
    g.visible = false;
    Game.scene.add(g);
    this._marker = g;
    return g;
  },

  hideMarker() {
    if (this._marker) this._marker.visible = false;
  },

  /** Posisi tujuan langkah aktif di zona sekarang (atau null). */
  markerTarget() {
    const quest = getQuest(this.activeQuestId);
    const step = quest?.steps[this.activeStep];
    const zone = window.__currentZoneId__;
    if (!step || !zone || !Game.player) return null;
    const p = Game.player.position;

    if (step.kind === 'talk_npc') {
      const rec = getNPCRecord(step.target);
      if (rec) return { x: rec.group.position.x, z: rec.group.position.z, y: 2.7, ring: false, follow: rec.group };
      return null;
    }
    if (step.kind === 'reach_trigger') {
      const trig = window.__sceneTriggers__?.[step.target];
      if (trig && zone === (trig.zone || ZONES.HAUS_INTERIOR) && !trig.triggered) return { x: trig.x, z: trig.z, y: 2.4, ring: true };
      return null;
    }
    if (step.kind === 'reach_building' && zone === ZONES.STADT) {
      const b = window.__stadtBuildings__?.[step.target];
      if (!b) return null;
      const d = b.door || b;
      if (Math.hypot(p.x - d.x, p.z - d.z) > BUILDING_MARKER_RANGE) return null;
      return { x: d.x, z: d.z, y: 2.6, ring: true };
    }
    if (step.kind === 'reach_zone') {
      // Pintu/gerbang di zona ini yang menuju tujuan (atau jalan keluar)
      const defs = window.__ZONE_DEFS__ || {};
      const portals = defs[zone]?.portals || [];
      let portal = portals.find(pt => pt.target === step.target);
      if (!portal && zone !== ZONES.STADT) portal = portals.find(pt => pt.target === ZONES.STADT) || portals[0];
      if (!portal) return null;
      if (zone === ZONES.STADT && Math.hypot(p.x - portal.x, p.z - portal.z) > BUILDING_MARKER_RANGE) return null;
      return { x: portal.x, z: portal.z, y: 2.8, ring: true };
    }
    return null;
  },

  updateMarker() {
    if (!Game.scene) return;
    const busy = this.currentState === STATE.CUTSCENE || this.currentState === STATE.CARD;
    const target = busy ? null : this.markerTarget();
    if (!target) { this.hideMarker(); return; }
    const m = this.ensureMarker();
    m.visible = true;
    m.position.set(target.x, 0, target.z);
    m.userData.baseY = target.y;
    m.userData.ring.visible = target.ring;
  },

  // ═════════════════════════════════════════════════════════════════
  // HUD
  // ═════════════════════════════════════════════════════════════════

  updateHUD(quest, step, { pulse = true } = {}) {
    const tracker = document.getElementById('quest-tracker');
    const label = document.getElementById('quest-label');
    const title = document.getElementById('quest-title');
    const name = document.getElementById('quest-name');
    const hint = document.getElementById('quest-hint');
    const num = document.getElementById('quest-step-num');
    const icon = document.getElementById('quest-icon');
    const fill = document.getElementById('quest-progress-fill');
    const total = quest.steps.length;

    if (label) label.textContent = `Quest ${questNumber(quest.id)} / ${QUEST_ORDER.length}`;
    if (title) title.textContent = quest.title;
    if (icon) icon.textContent = step.icon || '📜';
    if (num) num.textContent = `Schritt ${this.activeStep + 1}/${total}`;
    if (name) name.textContent = step.description || quest.title;
    if (hint) hint.textContent = step.hint || '';
    if (fill) fill.style.width = `${Math.round((this.activeStep / total) * 100)}%`;
    if (tracker) {
      tracker.classList.remove('hud-hidden');
      if (pulse) {
        tracker.classList.remove('quest-step-new');
        void tracker.offsetWidth;
        tracker.classList.add('quest-step-new');
      }
    }
    if (name && pulse) {
      name.classList.remove('pulse');
      void name.offsetWidth;
      name.classList.add('pulse');
    }
    this.layoutLeftColumn();
  },

  layoutLeftColumn() {
    const tracker = document.getElementById('quest-tracker');
    const col = document.querySelector('.hud-left-column');
    if (!tracker || !col) return;
    if (tracker.classList.contains('hud-hidden')) { col.style.top = ''; return; }
    const r = tracker.getBoundingClientRect();
    if (r.height > 0) col.style.top = `${Math.round(r.bottom + 12)}px`;
  },

  showStepPanels(step) {
    if (step.panel) this.showSummaryPanel(step.panel.html, step.panel.title);
    else this.hideSummaryPanel();
    if (step.items) {
      this.showQuestListPanel(step.items, step.kind === 'collect_auto' ? 'Finde:' : 'Liste:');
      step.items.forEach(it => { if (this.collectedItems.has(it.id)) this.markItemFoundInPanel(it.id); });
    } else {
      this.hideQuestListPanel();
    }
  },

  hideQuestUI(keepTracker = false) {
    if (!keepTracker) document.getElementById('quest-tracker')?.classList.add('hud-hidden');
    document.body.classList.add('quest-ui-hidden');
    this.hideMarker();
  },

  showQuestUI() {
    document.body.classList.remove('quest-ui-hidden');
  },

  showQuestBanner(quest) {
    let el = document.getElementById('quest-start-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'quest-start-banner';
      el.className = 'quest-start-banner';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="qsb-kicker">Neue Quest · ${questNumber(quest.id)} / ${QUEST_ORDER.length}</div>
      <div class="qsb-title">${quest.title}</div>
      <div class="qsb-sub">${quest.subtitle || ''}</div>`;
    el.classList.remove('visible');
    void el.offsetWidth;
    el.classList.add('visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), 3600);
  },

  showStepHint() {
    const quest = getQuest(this.activeQuestId);
    const step = quest?.steps[this.activeStep];
    if (!step) {
      showCenterPopup('Schau dich um!', '💡', 2500);
      return;
    }
    const extra = step.panel ? '<br><small>📓 TAB: Wegbeschreibung im Reisetagebuch nochmal lesen.</small>' : '';
    showCenterPopup(`<b>${step.description}</b><br>${step.hint || ''}${extra}`, '💡', 6000);
  },

  showHintButton() { document.getElementById('hint-button')?.classList.remove('hud-hidden'); },
  hideHintButton() { document.getElementById('hint-button')?.classList.add('hud-hidden'); },

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
    document.getElementById('onboarding-banner')?.classList.add('hud-hidden');
  },

  // ═════════════════════════════════════════════════════════════════
  // KARTU "QUEST SELESAI"
  // ═════════════════════════════════════════════════════════════════

  showCompletionCard(quest) {
    this.closeCard();
    this.currentState = STATE.CARD;
    playJingle('jingle_complete');
    setInputEnabled(false, 'card');
    this.hideMarker();

    const next = quest.next ? getQuest(quest.next) : null;
    const n = questNumber(quest.id);
    const score = quest.reward?.score || 0;
    const TRANSITION_NOTE = {
      dinner:  '🍲 Zeit für das Abendessen … danach wird es Nacht.',
      nextday: '🌙 Lukas schläft … am nächsten Morgen geht es weiter.',
      evening: '🌇 Die Sonne geht unter … es wird Abend.',
    };

    const el = document.createElement('div');
    el.id = 'quest-complete-card';
    el.className = 'quest-complete-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="qcc-card">
        <div class="qcc-badge">✓</div>
        <div class="qcc-kicker">Quest ${n} / ${QUEST_ORDER.length} abgeschlossen</div>
        <h2 class="qcc-title">${quest.title}</h2>
        <p class="qcc-done">${quest.done?.de || ''}</p>
        <p class="qcc-done-id">${quest.done?.id || ''}</p>
        <div class="qcc-rewards">
          ${score ? `<span>⭐ +${score} Punkte</span>` : ''}
          <span>📓 Tagebuch aktualisiert</span>
        </div>
        ${next ? `
          <div class="qcc-next">
            ${quest.transition ? `<div class="qcc-transition">${TRANSITION_NOTE[quest.transition] || ''}</div>` : ''}
            <div class="qcc-next-label">Nächste Quest ${questNumber(next.id)} / ${QUEST_ORDER.length}</div>
            <div class="qcc-next-title">${next.title}</div>
            <div class="qcc-next-sub">${next.subtitle || ''}</div>
          </div>` : `
          <div class="qcc-next">
            <div class="qcc-next-label">Das war die letzte Quest!</div>
            <div class="qcc-next-title">Lukas' Reise ist zu Ende 💛</div>
          </div>`}
        <button type="button" class="qcc-btn">${next ? 'Weiter zur nächsten Quest' : 'Zum Abschluss'} <span class="qcc-key">E</span></button>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));

    let done = false;
    const cont = () => {
      if (done) return;
      done = true;
      this._card = null;
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 350);
      setInputEnabled(true, 'card');
      this.currentState = STATE.IDLE;
      this.continueAfter(quest);
    };
    el.querySelector('.qcc-btn').addEventListener('click', cont);
    // Tombol baru aktif setelah sebentar — supaya E dari dialog tidak langsung melewati kartu
    this._card = { continue: () => {} };
    setTimeout(() => { if (!done) this._card = { continue: cont, el }; }, 900);
    setTimeout(() => el.querySelector('.qcc-btn')?.focus({ preventScroll: true }), 950);
  },

  closeCard() {
    const el = document.getElementById('quest-complete-card');
    if (el) el.remove();
    if (this._card) {
      this._card = null;
      setInputEnabled(true, 'card');
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // TELEPON, SURAT, SMS
  // ═════════════════════════════════════════════════════════════════

  ringPhoneAnimation() {
    const phone = window.__sceneTriggers__?.wired_phone?.mesh;
    showToast({ title: '📞 Das Telefon klingelt!', body: 'Geh schnell zum Telefon im Flur.', type: 'info', icon: '📞', duration: 5000 });
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
      const t = elapsed / 1000;
      phone.rotation.y = origY + Math.sin(t * 30) * 0.12;
      phone.position.y = Math.abs(Math.sin(t * 18)) * 0.08;
      requestAnimationFrame(ringTick);
    };
    requestAnimationFrame(ringTick);
  },

  /** Quest 4: surat Oma di tengah layar → klik → kuis isi surat. */
  showBriefModal() {
    if (document.getElementById('brief-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'brief-modal';
    overlay.className = 'brief-modal';
    overlay.innerHTML = `
      <div class="brief-paper">
        <div class="brief-stamp">✉️</div>
        <p><i>Lieber Lukas,</i></p>
        <p>ich bin heute bei meiner Freundin. Heute Abend kochen wir zusammen! Bitte geh zum
          Supermarkt „EDEKA“ und kauf die Zutaten ein. Der Supermarkt ist nicht weit.</p>
        <p>Geh aus dem Haus <b>nach rechts</b> in die <b>Blumenstraße</b>. Dann geh <b>geradeaus</b>
          bis zur <b>Kreuzung</b>. An der Kreuzung siehst du eine <b>Bank</b>. Nimm dort <b>nach rechts</b>
          in die <b>Wolfgangstraße</b>. Der Supermarkt liegt <b>gegenüber</b> dem Mall.</p>
        <p>Bitte kauf: <b>Kartoffeln, Fleisch, Salat</b> und <b>Butter</b>. Das Geld liegt neben dem Brief.
          Bezahl an der Kasse und bring alles nach Hause. Ich bin um fünf Uhr zurück.</p>
        <p class="brief-sign">Bis später!<br><i>Deine Oma</i></p>
        <div class="brief-cta">— Klick oder drück E, um weiterzumachen —</div>
      </div>`;
    document.body.appendChild(overlay);
    setInputEnabled(false, 'brief');
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      setInputEnabled(true, 'brief');
      setTimeout(() => {
        const dlg = getDialog('lukas_brief_quiz');
        if (dlg) {
          openDialog(dlg, SPEAKERS.lukas);
        }
      }, 300);
    };
    const onKey = (e) => {
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    setTimeout(() => {
      overlay.addEventListener('click', close, { once: true });
      window.addEventListener('keydown', onKey, true);
    }, 600);
  },

  showSmsModal() {
    this.hideQuestListPanel();
    this.hideSummaryPanel();
    const modal = document.getElementById('sms-modal');
    const container = document.getElementById('sms-cards');
    if (!modal || !container) return;

    const SMS_VARIANTS = [
      { correct: false, lines: [
        { icon: '🧦', text: 'Die Socken sind AUF dem Schrank.' },
        { icon: '📄', text: 'Das Papier liegt AUF dem Tisch.' },
        { icon: '🧸', text: 'Das Spielzeug ist UNTER dem Esstisch.' } ] },
      { correct: false, lines: [
        { icon: '🧦', text: 'Die Socken sind IM Schrank.' },
        { icon: '📄', text: 'Das Papier liegt UNTER dem Tisch.' },
        { icon: '🧸', text: 'Das Spielzeug ist UNTER dem Esstisch.' } ] },
      { correct: true, lines: [
        { icon: '🧦', text: 'Die Socken sind IM Schrank.' },
        { icon: '📄', text: 'Das Papier liegt AUF dem Tisch.' },
        { icon: '🧸', text: 'Das Spielzeug ist UNTER dem Esstisch.' } ] },
    ];
    const shuffled = [...SMS_VARIANTS].sort(() => Math.random() - 0.5);

    container.innerHTML = '';
    shuffled.forEach((variant, idx) => {
      const card = document.createElement('div');
      card.className = 'sms-card';
      card.dataset.correct = variant.correct ? 'true' : 'false';
      const linesHtml = variant.lines.map(l =>
        `<div class="sms-line"><span class="icon">${l.icon}</span><span>${l.text}</span></div>`).join('');
      card.innerHTML = `
        <div class="sms-greeting"><span class="sms-label">${String.fromCharCode(65 + idx)}</span> Hallo Tante! Ich habe alles gefunden:</div>
        ${linesHtml}`;
      card.addEventListener('click', () => this.handleSmsChoice(variant.correct, card));
      container.appendChild(card);
    });
    modal.classList.remove('hud-hidden');
  },

  handleSmsChoice(isCorrect, cardEl) {
    if (isCorrect) {
      cardEl.classList.add('correct');
      document.querySelectorAll('.sms-card').forEach(c => { c.style.pointerEvents = 'none'; });
      window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, { detail: { points: 100, label: 'Richtige Nachricht!' } }));
      showToast({ title: '✅ Gesendet!', body: 'Tante Maria: „Danke, Lukas! Jetzt weiß ich alles. 💕"', type: 'success', icon: '💌', duration: 4000 });
      setTimeout(() => {
        document.getElementById('sms-modal')?.classList.add('hud-hidden');
        this.progressStep('step4_send_message');
      }, 1500);
    } else {
      cardEl.classList.add('wrong');
      showToast({ title: '❌ Falsch!', body: 'Lies nochmal sorgfältig. Wo waren die Sachen wirklich?', type: 'error', icon: '📖', duration: 3500 });
      window.dispatchEvent(new CustomEvent(EVENTS.SCORE_ADD, { detail: { points: -10, label: 'Das ist falsch.' } }));
      setTimeout(() => cardEl.classList.remove('wrong'), 500);
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // PANEL KIRI
  // ═════════════════════════════════════════════════════════════════

  showSummaryPanel(html, title = null) {
    const panel = document.getElementById('summary-panel');
    const body = document.getElementById('summary-content');
    if (!panel || !body) return;
    body.innerHTML = html;
    const titleEl = panel.querySelector('.summary-title');
    const iconEl = panel.querySelector('.summary-icon');
    // Judul data berbentuk "📞 Oma sagt:" → ikon & teks dipisah
    const m = (title || '').match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    if (iconEl) iconEl.textContent = m ? m[1] : '📜';
    if (titleEl) titleEl.textContent = m ? m[2] : (title || 'Aufgabe:');
    panel.classList.remove('hud-hidden');
  },
  hideSummaryPanel() {
    document.getElementById('summary-panel')?.classList.add('hud-hidden');
  },

  showQuestListPanel(items, title = 'Finde:') {
    const panel = document.getElementById('quest-list-panel');
    const ul = document.getElementById('quest-list-items');
    const counter = document.getElementById('quest-list-count');
    if (!panel || !ul) return;
    const titleEl = panel.querySelector('.quest-list-title');
    if (titleEl) titleEl.textContent = title;
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
    this._questListTotal = items.length;
    if (counter) counter.textContent = `0 / ${items.length}`;
    panel.classList.remove('hud-hidden');
  },
  hideQuestListPanel() {
    document.getElementById('quest-list-panel')?.classList.add('hud-hidden');
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
    const colors = ['#f4c430', '#ff6b35', '#5dc26b', '#4a9bd4', '#e85a5a'];
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
  },
};

// ═══════════════════════════════════════════════════════════════════
// KAIT LANGKAH & QUEST (hal yang tidak bisa dinyatakan sebagai data)
// ═══════════════════════════════════════════════════════════════════

const STEP_ENTER = {
  // Quest 3: Leni ikut pulang
  step5_return_home({ restored }) {
    if (getNPCRecord('leni')) setNPCFollowing('leni', true);
    if (!restored) showToast({ title: '👧 Leni folgt dir!', body: 'Bring Leni zurück zu Omas Haus.', type: 'success', icon: '👧', duration: 5000 });
  },
  // Quest 9: Felix & Leni berjalan bersama Lukas di sepanjang Elbe
  step2_walk_elbe() {
    if (getNPCRecord('felix')) setNPCFollowing('felix', true, 1.7);
    if (getNPCRecord('leni_elbe')) setNPCFollowing('leni_elbe', true, 2.9);
  },
  step3_sunset_talk() {
    for (const id of ['felix', 'leni_elbe']) {
      const rec = getNPCRecord(id);
      if (!rec) continue;
      setNPCFollowing(id, false);
      rec._keep = true;
    }
  },
};

const QUEST_COMPLETE = {
  // Quest 3: Leni berlari masuk ke rumah Oma
  quest_3() {
    setTimeout(() => {
      if (window.__currentZoneId__ !== ZONES.HAUS || !window.__spawnNPCAt__) return;
      if (getNPCRecord('leni')) despawnNPC('leni');
      const p = Game.player.position;
      window.__spawnNPCAt__('leni', p.x - 1.2, p.z + 0.4, Math.PI / 2).then(() => {
        const rec = getNPCRecord('leni');
        if (rec) rec._keep = true;
        window.__walkNPCTo__?.('leni', 0, 2.6, () => despawnNPC('leni'));
      });
    }, 300);
  },
};

if (typeof window !== 'undefined') window.__QUEST_ENGINE_STATES__ = STATE;
if (CONFIG.DEBUG) window.__QuestSystem = QuestSystem;
