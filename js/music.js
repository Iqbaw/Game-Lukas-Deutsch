// ═══════════════════════════════════════════════════════════════════
// js/music.js — HINTERGRUNDMUSIK (YouTube IFrame Player API)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Eine einzige Player-Instanz lebt für die gesamte Sitzung: Hauptmenü,
// Story-Intro und Gameplay teilen sie sich, die Musik läuft also
// ununterbrochen durch und wiederholt die Playlist endlos.
//
// Autoplay-Regeln der Browser: Ton ohne Nutzergeste ist gesperrt.
// Deshalb startet der Player stumm und wird beim ersten Klick /
// Tastendruck / Touch entstummt (siehe attachUnlock).
//
// Fällt YouTube aus (kein Netz, Schul-Firewall, Einbetten deaktiviert),
// versucht das Modul eine lokale Datei aus FALLBACK_SRC und bleibt
// sonst einfach still — der Rest des Spiels läuft unverändert weiter.
// ═══════════════════════════════════════════════════════════════════

// Playlist (YouTube-Video-IDs, in Abspielreihenfolge)
const TRACKS = [
  'l7lEk_sdCmU',
  'zIVKbXQ9Vnk',
];

// Optionaler lokaler Notnagel, falls YouTube nicht erreichbar ist
const FALLBACK_SRC = ['assets/audio/bgm.mp3', 'assets/audio/bgm.ogg'];

const API_SRC     = 'https://www.youtube.com/iframe_api';
const API_TIMEOUT = 7000;   // ms, danach gilt YouTube als nicht verfügbar


export const Music = {
  player:    null,
  audio:     null,    // HTMLAudioElement des Fallbacks
  mode:      'idle',  // 'idle' | 'youtube' | 'fallback' | 'unavailable'
  enabled:   true,
  volume:    0.7,
  isUnlocked: false,  // Nutzergeste erfolgt → Ton darf hörbar sein
  _started:  false,
  _trackIdx: 0,
};


// ═══════════════════════════════════════════════════════════════════
// YOUTUBE IFRAME API
// ═══════════════════════════════════════════════════════════════════

function loadApi() {
  return new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve();

    const timer = setTimeout(() => reject(new Error('YouTube API timeout')), API_TIMEOUT);

    // Der Callback-Name ist von der API fest vorgegeben
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof prev === 'function') prev();
      resolve();
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const tag = document.createElement('script');
      tag.src   = API_SRC;
      tag.async = true;
      tag.onerror = () => { clearTimeout(timer); reject(new Error('YouTube API blocked')); };
      document.head.appendChild(tag);
    }
  });
}


function mountHost() {
  // Der YT-Player ERSETZT sein Ziel-Element durch ein <iframe>, deshalb
  // liegt das Styling auf einem Wrapper darum herum.
  if (document.getElementById('music-player')) return;

  const host = document.createElement('div');
  host.className = 'music-player-host';
  host.setAttribute('aria-hidden', 'true');

  const slot = document.createElement('div');
  slot.id = 'music-player';
  host.appendChild(slot);

  document.body.appendChild(host);
}


function createPlayer() {
  mountHost();

  Music.player = new window.YT.Player('music-player', {
    width:  '320',
    height: '180',
    videoId: TRACKS[0],
    playerVars: {
      autoplay:        1,
      mute:            1,          // stumm starten — sonst blockt der Browser
      controls:        0,
      disablekb:       1,
      fs:              0,
      modestbranding:  1,
      playsinline:     1,
      rel:             0,
      iv_load_policy:  3,
      loop:            1,
      playlist:        TRACKS.join(','),   // Playlist-Loop über alle Titel
    },
    events: {
      onReady:       onPlayerReady,
      onStateChange: onPlayerState,
      onError:       onPlayerError,
    },
  });
}


function onPlayerReady() {
  Music.mode    = 'youtube';
  Music._started = true;
  applyVolume();
  try {
    Music.player.setLoop(true);
    Music.player.playVideo();
  } catch (_) {}
  if (Music.isUnlocked) applyMute();
}


function onPlayerState(e) {
  // ENDED trotz loop → selbst weiterschalten (passiert bei Playlist-Fehlern)
  if (e.data === window.YT?.PlayerState?.ENDED) {
    nextTrack();
  }
}


function onPlayerError() {
  // Video nicht einbettbar / nicht verfügbar → nächsten Titel versuchen
  if (Music._trackIdx < TRACKS.length - 1) {
    nextTrack();
  } else {
    startFallback();
  }
}


function nextTrack() {
  Music._trackIdx = (Music._trackIdx + 1) % TRACKS.length;
  try {
    Music.player.loadVideoById(TRACKS[Music._trackIdx]);
    if (!Music.isUnlocked || !Music.enabled) Music.player.mute();
  } catch (_) {}
}


// ═══════════════════════════════════════════════════════════════════
// LOKALER FALLBACK
// ═══════════════════════════════════════════════════════════════════

function startFallback() {
  if (Music.mode === 'fallback') return;

  const audio = document.createElement('audio');
  audio.id    = 'bgm';
  audio.loop  = true;
  audio.preload = 'auto';
  FALLBACK_SRC.forEach((src) => {
    const s = document.createElement('source');
    s.src = src;
    audio.appendChild(s);
  });

  audio.addEventListener('error', () => { Music.mode = 'unavailable'; }, { once: true });

  document.body.appendChild(audio);
  Music.audio = audio;
  Music.mode  = 'fallback';
  applyVolume();
  if (Music.isUnlocked) audio.play().catch(() => {});
}


// ═══════════════════════════════════════════════════════════════════
// LAUTSTÄRKE / STUMMSCHALTUNG
// ═══════════════════════════════════════════════════════════════════

function applyVolume() {
  if (Music.mode === 'youtube' && Music.player?.setVolume) {
    try { Music.player.setVolume(Math.round(Music.volume * 100)); } catch (_) {}
  } else if (Music.audio) {
    Music.audio.volume = Music.volume;
  }
}

function applyMute() {
  const audible = Music.enabled && Music.isUnlocked && Music.volume > 0;

  if (Music.mode === 'youtube' && Music.player?.mute) {
    try {
      if (audible) { Music.player.unMute(); Music.player.playVideo(); }
      else         { Music.player.mute(); }
    } catch (_) {}
  } else if (Music.audio) {
    if (audible) Music.audio.play().catch(() => {});
    else         Music.audio.pause();
  }
}


// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function setMusicVolume(v) {
  Music.volume = Math.max(0, Math.min(1, v));
  applyVolume();
  applyMute();
}

export function setMusicEnabled(on) {
  Music.enabled = !!on;
  applyMute();
}

/**
 * Beim ersten echten Nutzer-Input aufrufen: erst dann darf der Browser
 * Ton abspielen.
 */
export function unlockMusic() {
  if (Music.isUnlocked) return;
  Music.isUnlocked = true;
  applyMute();
}

export async function initMusic({ volume = 0.7, enabled = true } = {}) {
  Music.volume  = volume;
  Music.enabled = enabled;

  try {
    await loadApi();
    createPlayer();
  } catch (_) {
    // YouTube nicht erreichbar → lokale Datei probieren
    startFallback();
  }
  return Music;
}
