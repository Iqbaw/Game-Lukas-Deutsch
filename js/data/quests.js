// ═══════════════════════════════════════════════════════════════════
// js/data/quests.js — DATA SEMUA QUEST
//
// Setiap quest punya:
//   id, title (Jerman), subtitle (Indonesia), description (Indonesia)
//   giver        : NPC pemberi quest
//   zone         : zona utama
//   city         : varian tata letak kota (A/B/C, lihat js/stadt.js)
//   prerequisites: quest yang harus selesai dulu
//   intro_dialog : dialog yang dibuka otomatis sesaat setelah quest mulai
//   steps        : langkah berurutan — setiap langkah punya:
//       id, kind, target   — jenis pemicu (lihat QuestSystem.checkStepTriggers)
//       description        — instruksi singkat berbahasa Jerman (HUD)
//       hint               — penjelasan berbahasa Indonesia (HUD, baris kedua)
//       icon               — emoji di HUD
//       dialog, speaker    — dialog untuk langkah 'auto' / 'talk_npc'
//       action             — aksi khusus untuk langkah 'auto' (sms, brief, cutscene:*)
//       panel              — { title, html } panel instruksi kiri selama langkah aktif
//       items              — daftar centang untuk langkah 'collect_auto'
//   done         : kalimat penutup (Jerman + Indonesia) untuk kartu "Quest selesai"
//   next         : quest berikutnya; transition: cutscene waktu sebelum quest berikutnya
//   reward       : { score, journal_entry, vocab_unlock }
//
// Jenis langkah:
//   auto          — langsung berjalan (dialog / aksi), maju lewat efek dialog
//   reach_trigger — mendekati pemicu di scene (telepon, surat)
//   reach_zone    — masuk ke zona tertentu
//   reach_building— masuk area di depan pintu gedung kota (registry js/stadt.js)
//   talk_npc      — bicara dengan NPC (tekan E); dialog langkah ini yang dibuka
//   collect_auto  — mendekati barang-barang (terambil otomatis)
// ═══════════════════════════════════════════════════════════════════

import { ZONES } from '../config.js';

const kw = (t) => `<span class="kw">${t}</span>`;

export const QUESTS = {

  // ════════════════════════════════════════════════════════════════
  // STAGE 1 — Omas Haus (Aktivitäten in der Wohnung)
  // Tujuan: Memahami letak benda (in, auf, unter)
  // ════════════════════════════════════════════════════════════════

  quest_1: {
    id:           'quest_1',
    title:        'Lukas macht Frühstück!',
    subtitle:     'Lukas Bikin Sarapan',
    description:  'Lukas baru bangun dan lapar! Telepon Oma untuk minta petunjuk letak benda, lalu kumpulkan semua alat masak di dapur.',
    giver:        'lukas',
    zone:         ZONES.HAUS_INTERIOR,
    prerequisites:[],
    intro_dialog: 'lukas_bedroom_monologue',

    steps: [
      { id: 'step1_wake_up', kind: 'auto', icon: '😴',
        description: 'Ich habe Hunger. Wo ist die Pfanne?',
        hint: 'Baca pikiran Lukas: dia lapar dan Oma sedang tidak di rumah.' },
      { id: 'step2_reach_phone', kind: 'reach_trigger', target: 'wired_phone', icon: '📞',
        description: 'Geh zum Telefon im Flur',
        hint: 'Keluar dari kamar ke lorong (Flur). Telepon ada di samping pintu kamar Oma.' },
      { id: 'step3_phone_call', kind: 'auto', icon: '☎️',
        dialog: 'oma_phone_call', speaker: 'oma_helga',
        description: 'Hör Omas Hinweise am Telefon',
        hint: 'Dengarkan Oma: di mana letak barang-barang dapur? Perhatikan kata in, auf, unter.' },
      { id: 'step4_collect_kitchen', kind: 'collect_auto', icon: '🧺',
        target: ['pfanne', 'wurst', 'eier', 'teller', 'besteck'],
        description: 'Sammle die 5 Sachen in der Küche',
        hint: 'Pergi ke dapur (Küche). Dekati kelima barang sesuai petunjuk Oma — barang terambil otomatis.',
        items: [
          { id: 'pfanne',  label: 'Pfanne',  emoji: '🍳' },
          { id: 'wurst',   label: 'Wurst',   emoji: '🌭' },
          { id: 'eier',    label: 'Eier',    emoji: '🥚' },
          { id: 'teller',  label: 'Teller',  emoji: '🍽' },
          { id: 'besteck', label: 'Besteck', emoji: '🍴' },
        ],
        panel: { title: '📞 Oma sagt:', html: `
          <ul>
            <li>Die <b>Pfanne</b> — ${kw('in')} dem Schrank</li>
            <li>Die <b>Wurst</b> — ${kw('auf')} dem Serviertisch</li>
            <li>Die <b>Eier</b> — ${kw('unter')} dem kleinen Tisch</li>
            <li>Der <b>Teller</b> — ${kw('auf')} dem Küchentisch</li>
            <li>Das <b>Besteck</b> — ${kw('in')} der Schublade</li>
          </ul>
          <div class="prep-info">
            <div class="prep-info-title">📘 Präpositionen</div>
            <div class="prep-info-row"><span class="pi-from">in dem</span><span class="pi-arrow">→</span><b class="pi-to">im</b><span class="pi-ex">im Schrank</span></div>
            <div class="prep-info-row"><span class="pi-from">in der</span><span class="pi-arrow">→</span><b class="pi-to pi-same">in der</b><span class="pi-ex">tidak disingkat</span></div>
            <div class="prep-info-legend"><b>in</b> = di dalam · <b>auf</b> = di atas · <b>unter</b> = di bawah</div>
          </div>` } },
      { id: 'step5_cook', kind: 'auto', icon: '🍳',
        dialog: 'lukas_cooking_timeskip', speaker: 'lukas',
        description: 'Koch dein Frühstück',
        hint: 'Semua barang lengkap — Lukas memasak sarapan.' },
    ],

    done: { de: 'Lukas hat alle Sachen gefunden und ein leckeres Frühstück gekocht.',
            id: 'Lukas menemukan semua barang dan memasak sarapan yang enak.' },
    next: 'quest_2',
    reward: {
      score:         500,
      journal_entry: 'frühstück_notiz',
      vocab_unlock:  ['die Küche', 'die Pfanne', 'der Teller', 'die Eier', 'die Wurst',
                      'das Besteck', 'in', 'auf', 'unter', 'der Schrank', 'die Schublade',
                      'der Küchentisch', 'der Serviertisch'],
    },
  },

  quest_2: {
    id:           'quest_2',
    title:        'Tantes Anruf!',
    subtitle:     'Mencari Benda untuk Tante',
    description:  'Tante Maria menelepon dari kantor! Cari kaus kaki, kertas, dan mainan Leni SENDIRI — Tante tidak tahu letaknya.',
    giver:        'tante_maria',
    zone:         ZONES.HAUS_INTERIOR,
    prerequisites:['quest_1'],

    steps: [
      { id: 'step1_reach_phone2', kind: 'reach_trigger', target: 'wired_phone', icon: '📞',
        description: 'Geh zum Telefon! Tante ruft an.',
        hint: 'Telepon berdering lagi! Pergi ke telepon di lorong (Flur).' },
      { id: 'step2_phone_call2', kind: 'auto', icon: '☎️',
        dialog: 'tante_quest2_intro', speaker: 'tante_maria',
        description: 'Hör Tantes Bitte am Telefon',
        hint: 'Dengarkan apa yang dibutuhkan Tante Maria.' },
      { id: 'step3_find_3_items', kind: 'collect_auto', icon: '🔎',
        target: ['socken', 'papier', 'spielzeug'],
        description: 'Such selbst: Socken, Papier, Spielzeug',
        hint: 'Cari sendiri di seluruh rumah (kamar, ruang tamu, dapur). Ingat DI MANA kamu menemukannya!',
        items: [
          { id: 'socken',    label: 'Socken',    emoji: '🧦' },
          { id: 'papier',    label: 'Papier',    emoji: '📄' },
          { id: 'spielzeug', label: 'Spielzeug', emoji: '🧸' },
        ],
        panel: { title: '📱 Tante Maria fragt:', html: `
          <ul>
            <li>Die <b>Socken</b> 🧦</li>
            <li>Das <b>Papier</b> 📄</li>
            <li>Das <b>Spielzeug</b> 🧸</li>
          </ul>
          <p class="panel-note">⚠️ Tante weiß nicht, wo sie sind. Merk dir den Ort!</p>` } },
      { id: 'step4_send_message', kind: 'auto', action: 'sms', icon: '📱',
        description: 'Schreib Tante, wo die Sachen sind',
        hint: 'Pilih SMS yang preposisinya benar (in / auf / unter).' },
    ],

    done: { de: 'Tante Maria weiß jetzt, wo Socken, Papier und Spielzeug sind.',
            id: 'Tante Maria sekarang tahu letak kaus kaki, kertas, dan mainan.' },
    next: 'quest_3',
    reward: {
      score:         500,
      journal_entry: 'wohnzimmer_notiz',
      vocab_unlock:  ['die Socken', 'das Papier', 'das Spielzeug', 'das Bett', 'der Tisch', 'auf', 'unter', 'in'],
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2 — Reise (Ortsangaben nennen)
  // Tujuan: Memahami letak tempat (selektif & umum)
  // ════════════════════════════════════════════════════════════════

  quest_3: {
    id:           'quest_3',
    title:        'Der Weg zur Schule von Leni',
    subtitle:     'Jemput Leni di Sekolah',
    description:  'Tante masih di kantor dan meminta Lukas menjemput Leni di sekolah. Dengarkan petunjuk jalannya baik-baik!',
    giver:        'tante_maria',
    zone:         ZONES.STADT,
    city:         'A',
    prerequisites:['quest_2'],

    steps: [
      { id: 'step1_reach_phone3', kind: 'reach_trigger', target: 'wired_phone', icon: '📞',
        description: 'Geh zum Telefon! Tante ruft an.',
        hint: 'Telepon berdering — Tante menelepon lagi dari kantor.' },
      { id: 'step2_get_directions3', kind: 'auto', icon: '☎️',
        dialog: 'tante_quest3_intro', speaker: 'tante_maria',
        description: 'Hör Tantes Wegbeschreibung zu',
        hint: 'Dengarkan rute ke sekolah: Ampel, Apotheke, kanan, gegenüber, neben.' },
      { id: 'step3_go_schule', kind: 'reach_building', target: 'grundschule', icon: '🏫',
        description: 'Folge Tantes Weg zum großen gelben Gebäude',
        hint: 'Keluar rumah, seberangi jembatan ke kota, lalu ikuti rute Tante sampai sekolah kuning.',
        panel: { title: '📞 Tante sagt:', html: `
          Geh zuerst ${kw('geradeaus')} bis zur ${kw('Ampel')}. Dort siehst du eine große
          ${kw('Apotheke')} — nimm ${kw('nach rechts')} in die ${kw('Gutenbergstraße')}.<br><br>
          Geh weiter geradeaus bis zum ${kw('Supermarkt')}. Direkt ${kw('gegenüber')} liegt die
          Schule: ein großes ${kw('gelbes Gebäude')} ${kw('neben')} einer kleinen Bäckerei.` } },
      { id: 'step4_meet_leni', kind: 'talk_npc', target: 'leni', icon: '👧',
        dialog: 'leni_quest3_greeting',
        description: 'Sprich mit Leni vor der Schule',
        hint: 'Leni menunggu di depan pintu sekolah — dekati dan tekan E.' },
      { id: 'step5_return_home', kind: 'reach_zone', target: ZONES.HAUS, icon: '🏡',
        description: 'Bring Leni nach Hause zu Oma',
        hint: 'Leni mengikutimu. Pulang lewat Alte Brücke di ujung selatan Schillerstraße.' },
    ],

    done: { de: 'Leni ist sicher bei Oma angekommen. Tante holt sie am Abend ab.',
            id: 'Leni sudah aman sampai di rumah Oma. Tante menjemputnya nanti malam.' },
    next: 'quest_4',
    reward: {
      score:         1000,
      journal_entry: 'leni_abholen_notiz',
      vocab_unlock:  ['geradeaus', 'nach rechts', 'die Ampel', 'gegenüber', 'neben', 'die Schule', 'das Gebäude', 'abholen'],
    },
  },

  quest_4: {
    id:           'quest_4',
    title:        'Ein Brief von Oma',
    subtitle:     'Surat dari Oma',
    description:  'Oma meninggalkan surat di meja makan: Lukas diminta belanja bahan makan malam di EDEKA. Baca rutenya, belanja, bayar, lalu bawa pulang ke Oma!',
    giver:        'oma_helga',
    zone:         ZONES.STADT,
    city:         'B',
    prerequisites:['quest_3'],

    steps: [
      { id: 'step1_enter_house', kind: 'reach_zone', target: ZONES.HAUS_INTERIOR, icon: '🚪',
        description: 'Geh ins Haus hinein',
        hint: 'Masuk ke rumah Oma lewat pintu depan.' },
      { id: 'step2_find_brief', kind: 'reach_trigger', target: 'brief_oma', icon: '✉️',
        description: 'Finde Omas Brief auf dem Esstisch',
        hint: 'Di meja makan di dapur ada surat dari Oma. Dekati suratnya.' },
      { id: 'step3_read_brief', kind: 'auto', action: 'brief', icon: '📜',
        description: 'Lies Omas Brief genau',
        hint: 'Baca surat Oma, lalu jawab dua pertanyaan tentang isinya.' },
      { id: 'step4_go_edeka', kind: 'reach_building', target: 'edeka', icon: '🛒',
        description: 'Folge dem Weg aus dem Brief zum EDEKA',
        hint: 'Keluar rumah, seberangi Alte Brücke, lalu ikuti rute di surat sampai EDEKA (seberang Mall).',
        panel: { title: '✉️ Omas Brief:', html: `
          Geh aus dem Haus ${kw('nach rechts')} in die ${kw('Blumenstraße')}. Dann ${kw('geradeaus')}
          bis zur ${kw('Kreuzung')} — dort siehst du eine ${kw('Bank')}. Nimm ${kw('nach rechts')} in die
          ${kw('Wolfgangstraße')}. Der Supermarkt liegt ${kw('gegenüber')} dem ${kw('Mall')}.` } },
      { id: 'step5_enter_edeka', kind: 'reach_zone', target: ZONES.SUPERMARKET_INTERIOR, icon: '🚪',
        description: 'Geh in den EDEKA hinein',
        hint: 'Itu EDEKA-nya! Masuk lewat pintu kaca di samping parkiran (alas bercahaya).' },
      { id: 'step6_shopping', kind: 'collect_auto', icon: '🧺',
        target: ['kartoffeln', 'fleisch', 'salat', 'butter'],
        description: 'Kauf ein: Kartoffeln, Fleisch, Salat, Butter',
        hint: 'Ambil keempat barang. Lihat papan rak: "Obst & Gemüse" dan "Fleisch & Kühlung".',
        items: [
          { id: 'kartoffeln', label: 'Kartoffeln', emoji: '🥔' },
          { id: 'fleisch',    label: 'Fleisch',    emoji: '🥩' },
          { id: 'salat',      label: 'Salat',      emoji: '🥬' },
          { id: 'butter',     label: 'Butter',     emoji: '🧈' },
        ],
        panel: { title: '🛒 Omas Einkaufsliste:', html: `
          <ul>
            <li><b>Kartoffeln</b> 🥔 &amp; <b>Salat</b> 🥬 — ${kw('bei')} „Obst &amp; Gemüse"</li>
            <li><b>Fleisch</b> 🥩 &amp; <b>Butter</b> 🧈 — ${kw('im')} Kühlregal</li>
          </ul>` } },
      { id: 'step7_pay', kind: 'talk_npc', target: 'kassiererin', icon: '💶',
        dialog: 'kasse_bezahlen',
        description: 'Bezahl an der Kasse',
        hint: 'Bayar di kasir dekat pintu keluar — dekati kasirnya dan tekan E.' },
      { id: 'step8_go_home', kind: 'reach_zone', target: ZONES.HAUS, icon: '🏡',
        description: 'Bring die Einkäufe nach Hause',
        hint: 'Keluar dari EDEKA dan pulang ke rumah Oma lewat Alte Brücke.' },
      { id: 'step9_give_oma', kind: 'talk_npc', target: 'oma_helga', icon: '👵',
        dialog: 'oma_einkauf_danke',
        description: 'Gib Oma die Einkäufe',
        hint: 'Oma sudah pulang dan menunggu di depan rumah — bicara dengannya (tekan E).' },
    ],

    done: { de: 'Lukas hat alles eingekauft und Oma die Tüte gebracht. Oma backt jetzt einen Apfelkuchen.',
            id: 'Lukas sudah belanja semua dan menyerahkannya ke Oma. Oma sekarang memanggang kue apel.' },
    next: 'quest_5',
    reward: {
      score:         1000,
      journal_entry: 'einkaufen_notiz',
      vocab_unlock:  ['der Brief', 'der Supermarkt', 'die Kreuzung', 'gegenüber', 'nach rechts',
                      'die Kartoffeln', 'das Fleisch', 'der Salat', 'die Butter', 'die Kasse', 'bezahlen'],
    },
  },

  quest_5: {
    id:           'quest_5',
    title:        'Lukas fragt nach dem Weg nach Tantes Haus',
    subtitle:     'Menanyakan Jalan ke Rumah Tante',
    description:  'Oma memanggang kue apel untuk Tante Maria. Lukas naik bus ke kota — tapi dari halte, ke mana jalannya? Tanya orang di sana!',
    giver:        'oma_helga',
    zone:         ZONES.STADT,
    city:         'C',
    prerequisites:['quest_4'],

    steps: [
      { id: 'step1_cake', kind: 'auto', icon: '🥧',
        dialog: 'oma_kuchen_bus', speaker: 'oma_helga',
        description: 'Hör Oma zu',
        hint: 'Oma memberimu kue apel untuk Tante Maria.' },
      { id: 'step2_bus', kind: 'auto', action: 'cutscene:bus', icon: '🚌',
        description: 'Fahr mit dem Bus in die Stadt',
        hint: 'Lukas naik bus ke kota.' },
      { id: 'step3_ask_frau', kind: 'talk_npc', target: 'frau_weber', icon: '🗣️',
        dialog: 'frau_weber_weg',
        description: 'Frag die Frau an der Haltestelle nach dem Weg',
        hint: 'Kamu tidak tahu jalan ke rumah Tante. Tanya Frau Weber di halte bus (tekan E).' },
      { id: 'step4_go_tantes_haus', kind: 'reach_building', target: 'tantes_haus', icon: '🏠',
        description: 'Folge dem Weg zu Tantes Haus',
        hint: 'Ikuti petunjuk Frau Weber: perempatan besar → kanan → jembatan → taman → perpustakaan tua.',
        panel: { title: '🗣️ Frau Weber sagt:', html: `
          Geh diese Straße ${kw('geradeaus')} bis zur großen ${kw('Kreuzung')}. Dann biegst du
          ${kw('nach rechts')} ab und gehst immer weiter. Nach der ${kw('Brücke')} siehst du einen
          ${kw('Park')}. Geh ${kw('durch')} den Park hindurch. Auf der anderen Seite steht die alte
          ${kw('Bibliothek')}. Das Haus deiner Tante ist gleich ${kw('daneben')}.` } },
      { id: 'step5_give_cake', kind: 'talk_npc', target: 'tante_maria_stadt', icon: '🎁',
        dialog: 'tante_kuchen',
        description: 'Gib Tante Maria den Apfelkuchen',
        hint: 'Tante Maria berdiri di depan rumahnya — bicara dengannya dan berikan kuenya (tekan E).' },
    ],

    done: { de: 'Tante Maria freut sich über Omas Apfelkuchen.',
            id: 'Tante Maria senang sekali menerima kue apel dari Oma.' },
    next: 'quest_6',
    reward: {
      score:         1000,
      journal_entry: 'tantes_haus_notiz',
      vocab_unlock:  ['die Brücke', 'der Park', 'die Bibliothek', 'die Kreuzung', 'geradeaus', 'nach rechts',
                      'hindurch', 'daneben', 'der Bus', 'die Haltestelle'],
    },
  },

  quest_6: {
    id:           'quest_6',
    title:        'Wo bin ich?',
    subtitle:     'Di Mana Aku Sekarang?',
    description:  'Bus terakhir sudah lewat dan hari mulai sore. Lukas harus berjalan pulang — tapi lewat mana? Tanya Herr Fischer, tetangga Tante.',
    giver:        'passant_3',
    zone:         ZONES.STADT,
    city:         'C',
    prerequisites:['quest_5'],

    steps: [
      { id: 'step1_ask_way_home', kind: 'talk_npc', target: 'passant_3', icon: '🗣️',
        dialog: 'passant3_quest6_intro',
        description: 'Frag Herrn Fischer nach dem Weg nach Hause',
        hint: 'Herr Fischer berdiri di taman dekat rumah Tante — tanya jalan pulang (tekan E).' },
      { id: 'step2_return_home', kind: 'reach_zone', target: ZONES.HAUS, icon: '🧭',
        description: 'Geh nach Hause — über die alte Brücke',
        hint: 'Ikuti petunjuknya: kembali ke Hauptstraße → kanan sampai Ampel → kiri ke Schillerstraße → seberangi Alte Brücke.',
        panel: { title: '🗣️ Herr Fischer sagt:', html: `
          Geh ${kw('zurück')} durch den Park bis zur ${kw('Hauptstraße')}. Dort ${kw('rechts')}
          bis zur ${kw('Ampel')}. An der Ampel ${kw('links')} in die Schillerstraße, immer geradeaus bis
          zum Fluss. ${kw('Überquere')} die alte ${kw('Brücke')} — dahinter wohnen deine Großeltern.` } },
      { id: 'step3_dinner', kind: 'talk_npc', target: 'oma_helga', icon: '🍲',
        dialog: 'oma_abendessen',
        description: 'Oma wartet mit dem Abendessen',
        hint: 'Kamu sampai di rumah! Bicara dengan Oma di depan rumah (tekan E).' },
    ],

    done: { de: 'Lukas hat den Weg allein gefunden. Jetzt gibt es Abendessen mit Oma und Opa.',
            id: 'Lukas menemukan jalan pulang sendiri. Sekarang waktunya makan malam bersama Oma dan Opa.' },
    next: 'quest_7',
    transition: 'dinner',
    reward: {
      score:         600,
      journal_entry: 'verloren_notiz',
      vocab_unlock:  ['sich verlaufen', 'zurück', 'die Brücke', 'überqueren', 'links', 'rechts', 'die Ampel'],
    },
  },

  quest_7: {
    id:           'quest_7',
    title:        'Ins Kino!',
    subtitle:     'Ke Bioskop!',
    description:  'Malam hari setelah makan malam. Felix menunggu di bioskop — tapi Lukas nyasar ke Stadtpark! Tanya orang, temukan Kino, lalu nonton filmnya.',
    giver:        'passant_4',
    zone:         ZONES.STADT,
    city:         'C',
    prerequisites:['quest_6'],

    steps: [
      { id: 'step1_plan', kind: 'auto', icon: '🎬',
        dialog: 'lukas_kino_plan', speaker: 'lukas',
        description: 'Felix wartet im Kino',
        hint: 'Felix mengirim pesan: filmnya mulai jam delapan!' },
      { id: 'step2_arrive_stadtpark', kind: 'reach_building', target: 'stadtpark', icon: '🌳',
        description: 'Geh in die Stadt — zum Stadtpark',
        hint: 'Seberangi Alte Brücke ke kota. Kamu tidak tahu letak bioskop dan masuk ke Stadtpark (di sebelah kanan jalan).' },
      { id: 'step3_ask_kino', kind: 'talk_npc', target: 'passant_4', icon: '🗣️',
        dialog: 'passant4_quest7_intro',
        description: 'Frag die Frau im Park nach dem Kino',
        hint: 'Frau Müller berdiri di ujung Allee di dalam taman — tanya jalan ke bioskop (tekan E).' },
      { id: 'step4_find_kino', kind: 'reach_building', target: 'kino', icon: '🍿',
        description: 'Geh schnell zum Kino und hinein',
        hint: 'Ikuti Allee lurus sampai ujung → belok kanan ke Hauptstraße → Kino ada di kiri (lampu warna-warni). Berdiri di depan pintunya.',
        panel: { title: '🗣️ Frau Müller sagt:', html: `
          Geh diese ${kw('Allee')} ${kw('geradeaus')} entlang bis zum Ende. Dann biegst du
          ${kw('rechts')} in die ${kw('Hauptstraße')} ab. Das Kino ist das große Gebäude mit den
          ${kw('bunten Lichtern')} auf der ${kw('linken Seite')}.` } },
      { id: 'step5_watch_film', kind: 'auto', action: 'cutscene:kino', icon: '🎞️',
        description: 'Kauf eine Karte und schau den Film',
        hint: 'Beli tiket, lalu nonton film bersama Felix.' },
    ],

    done: { de: 'Lukas und Felix haben den Film gesehen. Was für ein schöner Abend!',
            id: 'Lukas dan Felix sudah menonton filmnya. Malam yang menyenangkan!' },
    next: 'quest_8',
    transition: 'nextday',
    reward: {
      score:         700,
      journal_entry: 'kino_notiz',
      vocab_unlock:  ['das Kino', 'die Karte', 'der Film', 'die Allee', 'die Hauptstraße', 'die bunten Lichter', 'links'],
    },
  },


  // ════════════════════════════════════════════════════════════════
  // PENUTUP — Quest 8–10 (hari terakhir di Hamburg)
  // ════════════════════════════════════════════════════════════════

  quest_8: {
    id:           'quest_8',
    title:        'Restaurant Deichstraße',
    subtitle:     'Makan Siang di Deichstraße',
    description:  'Keesokan harinya Opa mengajak semua makan siang di restoran di Deichstraße, dekat sungai Elbe. Ikuti rute Opa dan pesan makanan dalam bahasa Jerman.',
    giver:        'opa_klaus',
    zone:         ZONES.STADT,
    city:         'C',
    prerequisites:['quest_7'],

    steps: [
      { id: 'step1_talk_opa', kind: 'talk_npc', target: 'opa_klaus', icon: '👴',
        dialog: 'opa_quest8_intro',
        description: 'Sprich mit Opa an der Windmühle',
        hint: 'Opa ada di dekat kincir angin di belakang rumah — bicara dengannya (tekan E).' },
      { id: 'step2_go_restaurant', kind: 'reach_building', target: 'restaurant', icon: '🍽️',
        description: 'Geh zum Restaurant in der Deichstraße',
        hint: 'Ikuti rute Opa: Ampel → kanan → perempatan besar → kanan ke Bachstraße → kiri ke Deichstraße. Restoran di kiri.',
        panel: { title: '👴 Opa sagt:', html: `
          Geh über die alte Brücke und die Schillerstraße ${kw('geradeaus')} bis zur ${kw('Ampel')}.
          Dort ${kw('rechts')} in die Hauptstraße bis zur großen Kreuzung. Dann ${kw('rechts')} in die
          Bachstraße und ${kw('links')} in die ${kw('Deichstraße')}. Das Restaurant ist auf der
          ${kw('linken Seite')}.` } },
      { id: 'step3_eat', kind: 'auto', action: 'cutscene:restaurant', icon: '🐟',
        description: 'Bestell dein Essen',
        hint: 'Pesan makanan dari daftar menu (Speisekarte).' },
    ],

    done: { de: 'Die ganze Familie hat im Restaurant Deichstraße zu Mittag gegessen.',
            id: 'Seluruh keluarga makan siang bersama di Restaurant Deichstraße.' },
    next: 'quest_9',
    reward: {
      score:         600,
      journal_entry: 'restaurant_notiz',
      vocab_unlock:  ['das Restaurant', 'die Speisekarte', 'bestellen', 'Ich hätte gern …', 'die Rechnung', 'lecker'],
    },
  },

  quest_9: {
    id:           'quest_9',
    title:        'Spaziergang an der Elbe',
    subtitle:     'Berjalan di Tepi Elbe',
    description:  'Setelah makan siang, Felix dan Leni mengajak Lukas berjalan-jalan di promenade tepi sungai Elbe sampai titik pandang.',
    giver:        'felix',
    zone:         ZONES.STADT,
    city:         'C',
    prerequisites:['quest_8'],

    steps: [
      { id: 'step1_talk_felix', kind: 'talk_npc', target: 'felix', icon: '😎',
        dialog: 'felix_quest9_intro',
        description: 'Sprich mit Felix an der Elbe',
        hint: 'Felix dan Leni menunggu di promenade tepi Elbe, di seberang Deichstraße — bicara dengan Felix (tekan E).' },
      { id: 'step2_walk_elbe', kind: 'reach_building', target: 'elbblick', icon: '🚶',
        description: 'Geh an der Elbe entlang zum Aussichtspunkt',
        hint: 'Berjalan ke arah timur di sepanjang promenade sampai titik pandang (Elbblick) dengan teropong.' },
      { id: 'step3_sunset_talk', kind: 'auto', icon: '🌇',
        dialog: 'felix_elbe_gespraech', speaker: 'felix',
        description: 'Genieß den Blick auf die Elbe',
        hint: 'Mengobrol dengan Felix dan Leni sambil melihat sungai.' },
    ],

    done: { de: 'Lukas, Felix und Leni haben an der Elbe über die Zukunft gesprochen.',
            id: 'Lukas, Felix, dan Leni berbincang tentang masa depan di tepi Elbe.' },
    next: 'quest_10',
    transition: 'evening',
    reward: {
      score:         500,
      journal_entry: 'elbe_notiz',
      vocab_unlock:  ['der Fluss', 'die Elbe', 'der Spaziergang', 'entlang', 'der Aussichtspunkt', 'die Zukunft'],
    },
  },

  quest_10: {
    id:           'quest_10',
    title:        'Abschiedsabend',
    subtitle:     'Malam Perpisahan',
    description:  'Malam terakhir di Hamburg. Seluruh keluarga berkumpul di taman rumah Oma untuk makan malam perpisahan.',
    giver:        'oma_helga',
    zone:         ZONES.HAUS,
    prerequisites:['quest_9'],

    steps: [
      { id: 'step1_go_home', kind: 'reach_zone', target: ZONES.HAUS, icon: '🏡',
        description: 'Geh nach Hause — dein letzter Abend',
        hint: 'Pulang ke rumah Oma lewat Alte Brücke. Keluarga sudah menunggu.' },
      { id: 'step2_farewell', kind: 'talk_npc', target: 'oma_helga', icon: '💛',
        dialog: 'oma_abschied',
        description: 'Feier mit der Familie',
        hint: 'Seluruh keluarga berkumpul di taman — bicara dengan Oma (tekan E).' },
    ],

    done: { de: 'Danke, Lukas! Du hast Hamburg entdeckt und viel Deutsch gelernt.',
            id: 'Terima kasih, Lukas! Kamu sudah menjelajahi Hamburg dan belajar banyak bahasa Jerman.' },
    next: null,
    reward: {
      score:         800,
      journal_entry: 'abschied_notiz',
      vocab_unlock:  ['der Abschied', 'die Familie', 'die Erinnerung', 'danke', 'auf Wiedersehen'],
    },
  },
};


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export const QUEST_ORDER = Object.keys(QUESTS);

export function getQuest(id) {
  return QUESTS[id] || null;
}

export function getAllQuests() {
  return Object.values(QUESTS);
}

export function getQuestsByGiver(npcId) {
  return Object.values(QUESTS).filter(q => q.giver === npcId);
}

/** Nomor urut quest (1-based) */
export function questNumber(id) {
  return QUEST_ORDER.indexOf(id) + 1;
}

/** Cek apakah quest siap dimulai (semua prereq selesai). */
export function isQuestUnlocked(questId, completedQuests) {
  const q = QUESTS[questId];
  if (!q) return false;
  return q.prerequisites.every(req => completedQuests.includes(req));
}

/**
 * Waktu di dunia game, diturunkan dari kemajuan quest:
 *   Quest 7 (setelah makan malam Quest 6) = malam,
 *   Quest 8–9 = hari berikutnya (siang/sore),
 *   Quest 10 dan sesudahnya = malam perpisahan.
 */
export function timeOfDay(questState = {}) {
  if (questState.quest_9 === 'completed') return 'night';
  if (questState.quest_7 === 'completed') return 'day';
  if (questState.quest_6 === 'completed') return 'night';
  return 'day';
}
