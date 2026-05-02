// ═══════════════════════════════════════════════════════════════════
// js/dialog.js — SISTEM DIALOG (Step 8)
//
// Menangani:
//   - Render dialog node ke DOM
//   - Typewriter effect per karakter
//   - Multiple choice A/B/C dengan scoring
//   - Vocab highlight + tooltip terjemahan
//   - Side effects: progress_quest, add_score, dll
//   - Integrasi dengan quest.js dan scoring.js
// ═══════════════════════════════════════════════════════════════════

import { Game }             from './main.js';
import { CONFIG, EVENTS }   from './config.js';
import { setInputEnabled }  from './player.js';
import { getDialog, NPC_DEFAULT_DIALOG } from './data/dialogs.js';
import { showToast }        from './ui.js';

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════

const Dialog = {
  isOpen:        false,
  currentDialog: null,     // { id, start, nodes }
  currentNodeId: null,
  currentNPC:    null,     // data NPC (dari npcs.js)

  // Typewriter
  typeTimer:     null,
  typeIndex:     0,
  typeText:      '',       // full text yg sedang di-type
  isTyping:      false,

  // Pilihan ganda
  choicesShown:  false,
  attempts:      0,        // berapa kali coba soal ini
};

export { Dialog };

// DOM elements — di-cache saat init
let $box, $avatar, $name, $text, $choices, $continueBtn;

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function initDialog() {
  $box         = document.getElementById('dialog-box');
  $avatar      = document.getElementById('dialog-avatar-img');
  $name        = document.getElementById('dialog-name');
  $text        = document.getElementById('dialog-text');
  $choices     = document.getElementById('dialog-choices');
  $continueBtn = document.getElementById('dialog-continue');

  if (!$box) {
    console.error('[dialog] #dialog-box tidak ditemukan di DOM');
    return;
  }

  // Continue button (klik atau tekan E/Space saat tidak ada choices)
  $continueBtn.addEventListener('click', onContinue);

  // Keyboard shortcut: E / Space → continue, 1/2/3 → pilih choice
  window.addEventListener('keydown', onDialogKey);

  // Listen NPC_INTERACT event (dari npc.js atau mobile button)
  window.addEventListener(EVENTS.NPC_INTERACT, (e) => {
    const { npc } = e.detail || {};
    if (npc) openDialogForNPC(npc);
  });
}


// ═══════════════════════════════════════════════════════════════════
// BUKA DIALOG UNTUK NPC
// ═══════════════════════════════════════════════════════════════════

export function openDialogForNPC(npcData) {
  if (Dialog.isOpen) return;

  // Cari dialog yang relevan:
  // 1. Kalau ada quest aktif yang givernya NPC ini → pakai intro_dialog quest tsb
  // 2. Fallback ke greeting dialog default
  const questDialogId = getActiveQuestDialogForNPC(npcData.id);
  const dialogId = questDialogId || NPC_DEFAULT_DIALOG[npcData.id] || null;

  if (!dialogId) {
    if (CONFIG.DEBUG) console.log(`[dialog] No dialog for ${npcData.id}`);
    return;
  }

  const dialogData = getDialog(dialogId);
  if (!dialogData) {
    if (CONFIG.DEBUG) console.warn(`[dialog] Dialog not found: ${dialogId}`);
    return;
  }

  openDialog(dialogData, npcData);
}


function getActiveQuestDialogForNPC(npcId) {
  // Ambil dari quest manager (window.__questState__ di-set oleh quest.js nanti)
  const qs = window.__questState__;
  if (!qs) return null;

  // Cari quest yang sedang aktif dengan giver = npcId
  for (const [questId, state] of Object.entries(qs)) {
    if (state === 'active' && window.__questData__) {
      const q = window.__questData__[questId];
      if (q && q.giver === npcId && q.intro_dialog) {
        return q.intro_dialog;
      }
    }
  }
  return null;
}


// ═══════════════════════════════════════════════════════════════════
// BUKA / TUTUP DIALOG
// ═══════════════════════════════════════════════════════════════════

export function openDialog(dialogData, npcData = null) {
  if (Dialog.isOpen) closeDialog();

  Dialog.isOpen        = true;
  Dialog.currentDialog = dialogData;
  Dialog.currentNPC    = npcData;
  Dialog.currentNodeId = dialogData.start;
  Dialog.attempts      = 0;

  // Freeze player input
  setInputEnabled(false);

  // Avatar & nama
  const npc = npcData;
  if ($avatar) {
    $avatar.src = npc?.avatarUrl || '';
    $avatar.alt = npc?.name || '';
    // Fallback emoji jika gambar tidak ada
    const parent = $avatar.parentElement;
    if (parent && !npc?.avatarUrl) {
      parent.dataset.emoji = getNPCEmoji(npc?.id);
    }
  }
  if ($name) {
    $name.textContent = npc?.name || 'NPC';
  }

  // Tampilkan box
  $box.classList.remove('hud-hidden');
  $box.classList.add('dialog-in');
  setTimeout(() => $box.classList.remove('dialog-in'), 400);

  // Mulai node pertama
  showNode(Dialog.currentNodeId);

  // Dispatch event
  window.dispatchEvent(new CustomEvent(EVENTS.DIALOG_OPEN, {
    detail: { dialogId: dialogData.id, npc: npcData }
  }));
}


export function closeDialog() {
  if (!Dialog.isOpen) return;

  Dialog.isOpen        = false;
  Dialog.currentDialog = null;
  Dialog.currentNodeId = null;
  Dialog.currentNPC    = null;
  stopTypewriter();

  // Animasi tutup
  $box.classList.add('dialog-out');
  setTimeout(() => {
    $box.classList.remove('dialog-out');
    $box.classList.add('hud-hidden');
    $choices.innerHTML = '';
    $text.textContent  = '';
    if ($continueBtn) $continueBtn.classList.remove('hud-hidden');
  }, 250);

  // Restore player input
  setInputEnabled(true);

  // Dispatch event
  window.dispatchEvent(new CustomEvent(EVENTS.DIALOG_CLOSE));
}


// ═══════════════════════════════════════════════════════════════════
// RENDER NODE
// ═══════════════════════════════════════════════════════════════════

function showNode(nodeId) {
  const dialog = Dialog.currentDialog;
  if (!dialog) return;

  const node = dialog.nodes[nodeId];
  if (!node) {
    closeDialog();
    return;
  }

  Dialog.currentNodeId = nodeId;
  Dialog.choicesShown  = false;
  Dialog.attempts      = 0;

  // Update nama speaker jika berubah (mis. Lukas ngomong)
  if (node.speaker === 'lukas') {
    $name.textContent = 'Lukas';
    $name.style.color = '#88ccff';
    if ($avatar?.parentElement) $avatar.parentElement.dataset.emoji = '🧑';
  } else if (Dialog.currentNPC) {
    $name.textContent = Dialog.currentNPC.name;
    $name.style.color = '';
    if ($avatar?.parentElement) $avatar.parentElement.dataset.emoji = getNPCEmoji(Dialog.currentNPC?.id);
  }

  // Proses tag <vocab> sebelum typewriter
  const processedText = processVocabTags(node.text);

  // Sembunyikan choices dulu
  $choices.innerHTML = '';
  if ($continueBtn) $continueBtn.classList.remove('hud-hidden');

  // Jalankan typewriter
  startTypewriter(processedText, () => {
    // Selesai ngetik
    if (node.choices && node.choices.length > 0) {
      // Ada pilihan → tampilkan
      showChoices(node.choices);
      if ($continueBtn) $continueBtn.classList.add('hud-hidden');
    } else if (node.end) {
      // Akhir dialog — ubah button jadi "Schließen"
      if ($continueBtn) {
        $continueBtn.innerHTML = 'Schließen <span class="arrow">×</span>';
      }
    }
    // Eksekusi side effects saat node selesai di-type
    if (node.onEnter) executeEffects(node.onEnter);
  });
}


// ═══════════════════════════════════════════════════════════════════
// TYPEWRITER EFFECT
// ═══════════════════════════════════════════════════════════════════

function startTypewriter(htmlText, onDone) {
  stopTypewriter();
  Dialog.isTyping = true;
  Dialog.typeText = htmlText;

  $text.classList.add('dialog-typing');

  // Untuk HTML yang mengandung tag, kita render langsung tapi reveal karakter per karakter
  // Strategi: strip semua tag dulu → type plain text → lalu replace dengan HTML
  // (sederhana dan tidak ada bug karena "memotong tag" di tengah)

  // Tampilkan full HTML tapi dengan mask opacity
  $text.innerHTML = htmlText;

  // Semua text nodes di dalam $text → wrap di span tersembunyi
  const plainText = $text.innerText;
  $text.innerHTML = ''; // bersihkan dulu

  let i = 0;
  const SPEED = 28; // karakter per detik

  const INTERVAL_MS = Math.max(12, 1000 / SPEED);

  function tick() {
    if (!Dialog.isTyping) return;
    i++;
    if (i >= plainText.length) {
      // Selesai — tampilkan full HTML dengan vocab highlight
      $text.innerHTML = htmlText;
      $text.classList.remove('dialog-typing');
      attachVocabListeners();
      Dialog.isTyping = false;
      if (onDone) onDone();
      return;
    }
    // Tampilkan karakter biasa (tanpa HTML saat typewriting untuk performance)
    $text.textContent = plainText.substring(0, i);
    Dialog.typeTimer = setTimeout(tick, INTERVAL_MS);
  }

  Dialog.typeTimer = setTimeout(tick, INTERVAL_MS);
}


function stopTypewriter() {
  if (Dialog.typeTimer) {
    clearTimeout(Dialog.typeTimer);
    Dialog.typeTimer = null;
  }
  Dialog.isTyping = false;
}


function skipTypewriter() {
  if (!Dialog.isTyping) return false;
  stopTypewriter();
  // Tampilkan full text langsung
  $text.innerHTML = Dialog.typeText;
  $text.classList.remove('dialog-typing');
  attachVocabListeners();

  // Jalankan choices kalau ada
  const node = Dialog.currentDialog?.nodes[Dialog.currentNodeId];
  if (node?.choices?.length > 0) {
    showChoices(node.choices);
    if ($continueBtn) $continueBtn.classList.add('hud-hidden');
  } else if (node?.end) {
    if ($continueBtn) $continueBtn.innerHTML = 'Schließen <span class="arrow">×</span>';
  }
  if (node?.onEnter) executeEffects(node.onEnter);
  return true;
}


// ═══════════════════════════════════════════════════════════════════
// VOCAB HIGHLIGHT
// ═══════════════════════════════════════════════════════════════════

/**
 * Proses tag <vocab title="terjemahan">kata</vocab> dalam teks
 * → buat span dengan class vocab + data-translation
 */
function processVocabTags(text) {
  return text.replace(
    /<vocab title="([^"]+)">([^<]+)<\/vocab>/g,
    (_, translation, word) =>
      `<span class="vocab" data-translation="${translation}" tabindex="0">${word}</span>`
  );
}

function attachVocabListeners() {
  $text.querySelectorAll('.vocab').forEach(el => {
    // Tooltip on click (mobile-friendly, tidak hanya hover)
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showVocabTooltip(el);
    });
    // Keyboard accessible
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') showVocabTooltip(el);
    });
  });
}

function showVocabTooltip(el) {
  // Hapus tooltip sebelumnya
  document.querySelectorAll('.vocab-tooltip-popup').forEach(t => t.remove());

  const translation = el.dataset.translation;
  if (!translation) return;

  const tt = document.createElement('div');
  tt.className = 'vocab-tooltip-popup';
  tt.innerHTML = `
    <span class="vocab-tooltip-word">${el.textContent}</span>
    <span class="vocab-tooltip-arrow">→</span>
    <span class="vocab-tooltip-trans">${translation}</span>
  `;

  // Posisi di bawah element
  const rect = el.getBoundingClientRect();
  tt.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 8}px;
    left: ${rect.left + rect.width/2}px;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
  `;
  document.body.appendChild(tt);

  // Auto-hide setelah 2.5 detik
  setTimeout(() => tt.remove(), 2500);

  // Tambah skor kecil untuk klik vocab
  addScore(CONFIG.VOCAB_CLICKED || 5, '📖 Vokabel');
}


// ═══════════════════════════════════════════════════════════════════
// MULTIPLE CHOICE
// ═══════════════════════════════════════════════════════════════════

function showChoices(choices) {
  Dialog.choicesShown = true;
  $choices.innerHTML  = '';

  const KEYS = ['A', 'B', 'C', 'D'];

  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'dialog-choice';
    btn.innerHTML = `
      <span class="dialog-choice-key">${KEYS[i] || (i+1)}</span>
      <span class="dialog-choice-text">${choice.text}</span>
    `;
    btn.addEventListener('click', () => onChoiceSelected(choice, btn, choices));
    $choices.appendChild(btn);
  });
}

function onChoiceSelected(choice, btn, allChoices) {
  // Disable semua pilihan setelah pilih
  $choices.querySelectorAll('.dialog-choice').forEach(b => {
    b.disabled = true;
  });

  Dialog.attempts++;

  if (choice.correct === true) {
    // Benar
    btn.classList.add('dialog-choice-correct');
    $box.classList.add('dialog-correct');
    setTimeout(() => $box.classList.remove('dialog-correct'), 600);

    // Skor berdasarkan percobaan ke-berapa
    const scoreMap = { 1: CONFIG.CORRECT_FIRST, 2: CONFIG.CORRECT_SECOND, 3: CONFIG.CORRECT_THIRD };
    const points = scoreMap[Dialog.attempts] || CONFIG.CORRECT_THIRD;
    if (choice.score !== undefined) {
      addScore(choice.score, '✅ Richtig!');
    } else {
      addScore(points, Dialog.attempts === 1 ? '⭐ Erster Versuch!' : '✅ Richtig!');
    }

    // Konfetti kalau pertama kali benar
    if (Dialog.attempts === 1) spawnConfetti();

    // Lanjut ke node berikutnya setelah delay
    setTimeout(() => {
      $choices.innerHTML = '';
      btn.classList.remove('dialog-choice-correct');
      if (choice.next) {
        showNode(choice.next);
      } else {
        closeDialog();
      }
    }, 1200);

  } else if (choice.correct === false) {
    // Salah
    btn.classList.add('dialog-choice-wrong');
    $box.classList.add('dialog-wrong');
    setTimeout(() => {
      $box.classList.remove('dialog-wrong');
      btn.classList.remove('dialog-choice-wrong');
    }, 600);

    if (choice.score !== undefined) addScore(choice.score, '❌ Falsch');
    else addScore(CONFIG.WRONG_ANSWER || -10, '❌ Falsch');

    // Re-enable semua setelah feedback
    setTimeout(() => {
      $choices.querySelectorAll('.dialog-choice').forEach(b => { b.disabled = false; });
    }, 700);

    // Lanjut ke node yg di-specify (biasanya node "wrong feedback")
    if (choice.next) {
      setTimeout(() => {
        $choices.innerHTML = '';
        showNode(choice.next);
      }, 1500);
    }

  } else {
    // Pilihan biasa (bukan benar/salah) — langsung lanjut
    if (choice.score) addScore(choice.score, '');
    $choices.innerHTML = '';
    if (choice.next) showNode(choice.next);
    else closeDialog();
  }
}


// ═══════════════════════════════════════════════════════════════════
// KEYBOARD HANDLER
// ═══════════════════════════════════════════════════════════════════

function onDialogKey(e) {
  if (!Dialog.isOpen) return;

  if (e.code === 'KeyE' || e.code === 'Space') {
    e.preventDefault();
    e.stopImmediatePropagation();
    onContinue();
    return;
  }

  // Pilih dengan angka 1/2/3
  if (Dialog.choicesShown && $choices.children.length > 0) {
    const idx = parseInt(e.key) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < $choices.children.length) {
      const btn = $choices.children[idx];
      if (btn && !btn.disabled) btn.click();
    }
    // A/B/C/D key — intercept so they don't trigger player movement
    const keyMap = { KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 };
    if (keyMap[e.code] !== undefined) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const btn = $choices.children[keyMap[e.code]];
      if (btn && !btn.disabled) btn.click();
    }
  }
}

function onContinue() {
  // Kalau masih ngetik — skip typewriter dulu
  if (Dialog.isTyping) {
    skipTypewriter();
    return;
  }

  // Kalau ada pilihan ganda — jangan lanjut (harus pilih dulu)
  if (Dialog.choicesShown && $choices.children.length > 0) return;

  const node = Dialog.currentDialog?.nodes[Dialog.currentNodeId];
  if (!node) { closeDialog(); return; }

  if (node.end) {
    closeDialog();
    return;
  }

  if (node.next) {
    // Reset tombol continue jika berubah jadi "Schließen"
    if ($continueBtn) $continueBtn.innerHTML = 'Weiter <span class="arrow">→</span>';
    showNode(node.next);
  } else {
    closeDialog();
  }
}


// ═══════════════════════════════════════════════════════════════════
// SIDE EFFECTS
// ═══════════════════════════════════════════════════════════════════

function executeEffects(effects) {
  if (!Array.isArray(effects)) return;

  effects.forEach(fx => {
    switch (fx.type) {

      case 'progress_quest':
        progressQuest(fx.step);
        break;

      case 'complete_quest':
        completeQuest(fx.questId);
        break;

      case 'show_quest':
        showQuestTracker(fx.questId);
        break;

      case 'add_score':
        addScore(fx.delta || 0, fx.label || '');
        break;

      case 'add_journal':
        addJournalEntry(fx.entry);
        break;

      case 'unlock_vocab':
        unlockVocab(fx.words || []);
        break;

      default:
        if (CONFIG.DEBUG) console.log('[dialog] Unknown effect:', fx.type);
    }
  });
}

function progressQuest(stepId) {
  window.dispatchEvent(new CustomEvent('quest:progress', { detail: { stepId } }));
}

function completeQuest(questId) {
  window.dispatchEvent(new CustomEvent('quest:complete', { detail: { questId } }));
  showToast({
    title: 'Quest abgeschlossen!',
    body: `+${window.__questData__?.[questId]?.reward?.score || 0} Punkte`,
    type: 'success',
    icon: '⭐',
    duration: 4000,
  });
}

function showQuestTracker(questId) {
  const questData = window.__questData__?.[questId];
  if (!questData) return;

  const nameEl = document.getElementById('quest-name');
  const tracker = document.getElementById('quest-tracker');
  if (nameEl) nameEl.textContent = questData.title;
  if (tracker) {
    tracker.classList.remove('hud-hidden');
    tracker.classList.add('quest-tracker-new');
    setTimeout(() => tracker.classList.remove('quest-tracker-new'), 600);
  }

  // Toast notification
  showToast({
    title: 'Neue Aufgabe!',
    body: questData.title,
    type: 'info',
    icon: '📜',
  });
}

function addScore(delta, label) {
  if (delta === 0) return;

  // Update global score
  window.__score__ = (window.__score__ || 0) + delta;

  // Update UI
  const scoreEl = document.getElementById('score-value');
  if (scoreEl) {
    scoreEl.textContent = window.__score__;
    scoreEl.classList.add('score-bump');
    setTimeout(() => scoreEl.classList.remove('score-bump'), 500);

    // Floating delta
    const scoreContainer = document.getElementById('score-display');
    if (scoreContainer && delta !== 0) {
      const deltaEl = document.createElement('div');
      deltaEl.className = `score-delta${delta < 0 ? ' score-delta-negative' : ''}`;
      deltaEl.textContent = (delta > 0 ? '+' : '') + delta;
      scoreContainer.style.position = 'relative';
      scoreContainer.appendChild(deltaEl);
      setTimeout(() => deltaEl.remove(), 1300);
    }
  }

  // Tampilkan score HUD kalau belum terlihat
  const scoreDisplay = document.getElementById('score-display');
  if (scoreDisplay) scoreDisplay.classList.remove('hud-hidden');

  if (label && delta > 0) {
    showToast({ title: label, body: `+${delta} Punkte`, type: 'success', duration: 2000 });
  }
}

function addJournalEntry(entryId) {
  // Tambah entry ke Reisetagebuch (diisi di Step 29 nanti)
  window.dispatchEvent(new CustomEvent('journal:add', { detail: { entryId } }));
  showToast({ title: 'Reisetagebuch aktualisiert!', type: 'info', icon: '📓', duration: 2500 });
}

function unlockVocab(words) {
  words.forEach(w => {
    window.dispatchEvent(new CustomEvent('vocab:unlock', { detail: { word: w } }));
  });
  if (words.length > 0) {
    showToast({
      title: `${words.length} neue Vokabeln!`,
      body: words.slice(0, 4).join(' • ') + (words.length > 4 ? ' …' : ''),
      type: 'vocab',
      icon: '📖',
    });
  }
}


// ═══════════════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════════════

function spawnConfetti() {
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


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function getNPCEmoji(id) {
  const map = {
    oma_helga:   '👵',
    opa_klaus:   '👴',
    onkel_andre: '👨',
    tante_maria: '👩',
    leni:        '👧',
    felix:       '🧑',
  };
  return map[id] || '🧑';
}
