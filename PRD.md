# Product Requirements Document (PRD)
## Lukas Abenteuer: Belajar Bahasa Jerman di Hamburg

**Versi:** 2.0  
**Tanggal:** 17 Mei 2026  
**Status:** Final Draft  
**Konteks:** Skripsi / Penelitian Pengembangan Media Pembelajaran  
**Pendekatan Pedagogis:** Contextual Teaching and Learning (CTL)

---

## 1. Ringkasan Eksekutif

**Lukas Abenteuer** adalah game edukasi berbasis 3D isometric browser yang dirancang untuk membantu siswa SMA kelas XI Indonesia mempelajari Bahasa Jerman secara kontekstual. Game ini mengimplementasikan pendekatan *Contextual Teaching and Learning* (CTL), di mana pemain menjelajahi Hamburg, Jerman melalui karakter Lukas — seorang remaja Indonesia berusia 18 tahun yang kembali mengunjungi kota masa kecilnya.

Game terbagi menjadi **2 Stage utama** dengan total **7 Quest inti** yang dirancang sesuai modul pembelajaran Bahasa Jerman SMA Kelas XI, ditambah **3 Quest penutup**. Setiap stage menargetkan kompetensi linguistik yang berbeda: Stage 1 berfokus pada **preposisi letak benda** (in, auf, unter), dan Stage 2 berfokus pada **menyebutkan letak tempat** (Ortsangaben) melalui pemahaman selektif dan umum.

---

## 2. Latar Belakang & Pernyataan Masalah

### 2.1 Masalah yang Diidentifikasi

| # | Masalah | Dampak |
|---|---------|--------|
| 1 | Pembelajaran Bahasa Jerman di SMA masih tekstual dan non-kontekstual | Siswa sulit memahami penggunaan preposisi dan arah dalam situasi nyata |
| 2 | Tidak ada simulasi lingkungan berbahasa Jerman yang dapat diakses siswa | Kesulitan membentuk *language awareness* secara kontekstual |
| 3 | Rendahnya motivasi belajar Bahasa Jerman di kalangan siswa SMA | Tingkat retensi kosakata rendah |
| 4 | Media pembelajaran Bahasa Jerman interaktif berbahasa Indonesia sangat terbatas | Ketergantungan pada buku teks yang monoton |

### 2.2 Solusi yang Diusulkan

Game edukasi berbasis browser yang:
- Menempatkan siswa dalam situasi komunikatif nyata di Hamburg
- Mengajarkan preposisi (*in, auf, unter*) melalui aktivitas mencari benda di rumah
- Mengajarkan arah (*geradeaus, links, rechts*) melalui navigasi kota secara langsung
- Mengintegrasikan penilaian (kuis selektif & umum) ke dalam alur cerita game

---

## 3. Tujuan & Sasaran

### 3.1 Tujuan Produk

1. Meningkatkan penguasaan kosakata dan struktur kalimat Bahasa Jerman siswa kelas XI SMA
2. Melatih kemampuan membaca **selektif** (informasi spesifik) dan **umum** (informasi keseluruhan) melalui dialog berbahasa Jerman
3. Meningkatkan motivasi dan *engagement* siswa melalui game berbasis cerita

### 3.2 Sasaran Terukur

| Metrik | Target |
|--------|--------|
| Peningkatan skor kosakata pre-test vs post-test | ≥ 20% |
| Penyelesaian minimal Stage 1 (Quest 1–2) | ≥ 80% siswa |
| Penyelesaian minimal Stage 2 (Quest 3–7) | ≥ 60% siswa |
| Rata-rata sesi bermain | ≥ 15 menit per sesi |
| Rating kepuasan siswa (skala Likert 1–5) | ≥ 4.0 |
| Akurasi kuis dialog (benar pada percobaan pertama) | ≥ 65% siswa |

---

## 4. Target Pengguna

### 4.1 Pengguna Utama

**Siswa SMA Kelas XI**
- Usia: 16–17 tahun
- Mengambil mata pelajaran Bahasa Jerman (pilihan/wajib)
- Level bahasa target: A1–A2 (CEFR)
- Familiar dengan game digital dan perangkat layar sentuh

### 4.2 Pengguna Sekunder

**Guru Bahasa Jerman SMA** — sebagai alat suplemen pembelajaran atau tugas mandiri siswa

### 4.3 User Persona

**Persona 1 — Nadia (16 tahun, pemula Bahasa Jerman)**
> "Aku susah ingat preposisi Jerman. Kalau ada situasinya kayak 'cari wajan di atas kompor', pasti lebih mudah diingat."

**Persona 2 — Rizky (17 tahun, suka game & budaya Jerman)**
> "Aku mau tahu gimana orang Jerman kasih arah di jalanan. Kalau ada game yang simulasikan itu, seru banget."

---

## 5. Ruang Lingkup

### 5.1 Dalam Lingkup (In Scope)

- Game berbasis browser (desktop-first, mobile-responsive)
- 2 Stage pembelajaran + 3 Quest penutup = **10 Quest total**
- 11 zona eksplorasi bertema lokasi Hamburg
- Dialog berbahasa Jerman dengan kuis pilihan ganda (selektif & umum)
- Sistem kosakata kontekstual dengan tooltip terjemahan
- Jurnal perjalanan (*Reisetagebuch*) sebagai media belajar mandiri
- Sistem skor, streak, dan rating bintang (★★★)

### 5.2 Di Luar Lingkup (Out of Scope)

- Multiplayer / fitur sosial
- Backend server / leaderboard global
- Audio dialog (text-only)
- Konten di luar level A1–A2 (B1+)
- Aplikasi mobile native (Android/iOS)

---

## 6. Struktur Konten Pembelajaran

### 6.1 Peta Stage dan Quest

```
STAGE 1 — Omas Haus
  Tema: Aktivitäten in der Wohnung
  Materi: Preposisi letak benda (in, auf, unter)
  Zona: HAUS
  │
  ├── Quest 1: "Lukas macht Frühstück!"
  │    Lukas lapar → cari 5 benda dapur dengan petunjuk Oma
  │
  └── Quest 2: "Tantens Anruf!"
       Tante telepon → cari mainan sepupu di ruang tamu

STAGE 2 — Reise (Ortsangaben nennen)
  Tema: Menyebutkan letak tempat (bangunan/Orte)
  Materi: Arah jalan — selektif (3 quest) & umum (2 quest)
  Zona: Luar Rumah Oma → Kota Hamburg
  │
  ├── Quest 3: "Leni abholen!" [SELEKTIF 1]
  │    Tante beri arahan tidak jelas → jemput Leni di sekolah
  │
  ├── Quest 4: "Einkaufen für Oma!" [SELEKTIF 2]
  │    Lukas lupa tanya alamat Supermarkt → tanya orang di jalan
  │
  ├── Quest 5: "Eis kaufen!" [SELEKTIF 3]
  │    Lukas ingin es krim → tanya lokasi Eisstand
  │
  ├── Quest 6: "Wo bin ich?" [UMUM 1]
  │    Lukas tersesat → tanya jalan pulang ke rumah Oma
  │
  └── Quest 7: "Ins Kino!" [UMUM 2]
       Lukas nyasar ke Stadtpark → tanya jalan ke bioskop

PENUTUP (Quest 8–10)
  Quest 8: Restaurant Deichstraße
  Quest 9: Spaziergang an der Elbe
  Quest 10: Abschiedsabend (Malam Perpisahan)
```

### 6.2 Kompetensi Bahasa per Stage

| Stage | Kompetensi | Kosakata Inti |
|-------|-----------|--------------|
| Stage 1 | Memahami informasi terperinci tentang letak benda | in, auf, unter, der Herd, der Kühlschrank, die Schublade, das Regal, das Sofa, der Tisch |
| Stage 2 (Selektif) | Memahami informasi spesifik dari teks tulis tentang letak tempat | geradeaus, links abbiegen, rechts abbiegen, an der Ampel, an der Ecke, entlang, gegenüber |
| Stage 2 (Umum) | Memahami informasi umum dari teks tulis tentang letak tempat | überqueren, die Brücke, zurück, in der Nähe von, die Hauptstraße, die Allee, sich verirren |

---

## 7. Fitur & Persyaratan

### 7.1 F-01: Eksplorasi Dunia 3D Isometric

**Deskripsi:** Pemain bergerak bebas di zona menggunakan keyboard (WASD) atau layar sentuh, dengan tampilan kamera isometric 45° tetap.

**Persyaratan Fungsional:**
- Gerakan 4 arah relatif kamera isometric (W/A/S/D)
- Shift untuk berlari (1.8× kecepatan normal)
- Collision detection mencegah menembus objek
- Camera follow smooth (lerp interpolation)
- Mobile: analog joystick on-screen

**Acceptance Criteria:**
- [ ] Karakter bergerak responsif di ≥ 30 FPS
- [ ] Karakter tidak menembus dinding/objek
- [ ] Kontrol berfungsi di desktop dan mobile

---

### 7.2 F-02: Sistem Zona & Portal

**Deskripsi:** Dunia game dibagi menjadi 11 zona yang terhubung via portal glowing.

**Daftar Zona:**

| # | ID | Nama | Digunakan di |
|---|----|------|-------------|
| 1 | `haus` | Haus der Großeltern | Stage 1 (Quest 1, 2), Quest 6 |
| 2 | `supermarkt` | Area Kota A | Quest 4, 5 |
| 3 | `supermarket_interior` | EDEKA (dalam) | Quest 4 |
| 4 | `schule` | Sekolah & Area | Quest 3 |
| 5 | `stadtpark` | Taman Kota | Quest 7 |
| 6 | `hafen` | Pelabuhan Elbe | Quest 7 (Kino), Quest 8 |
| 7 | `wochenmarkt` | Pasar Mingguan | Quest 6 (tersesat) |
| 8 | `buecherei` | Perpustakaan | — |
| 9 | `apotheke` | Apotek | — |
| 10 | `restaurant` | Deichstraße | Quest 8 |
| 11 | `elbe` | Tepi Sungai Elbe | Quest 9 |
| 12 | `haus_night` | Rumah Malam Hari | Quest 10 |

**Acceptance Criteria:**
- [ ] Transisi zona dengan fade-to-black (0.5 detik)
- [ ] Pemain muncul di spawn point yang benar per zona
- [ ] Toast notifikasi muncul saat masuk zona baru

---

### 7.3 F-03: Sistem Quest — Stage 1

#### Quest 1 — "Lukas macht Frühstück!"

**Tujuan Pembelajaran:** Peserta didik dapat memahami informasi terperinci tentang letak suatu benda menggunakan preposisi *in, auf, unter*.

**Latar:** Di dalam Rumah Oma (zona HAUS)

**Alur:**
1. Pemain berbicara dengan Oma Helga
2. Oma memberi petunjuk lokasi benda dapur dalam Bahasa Jerman:
   - *"Die Pfanne liegt **auf** dem Herd."* (Wajan ada di atas kompor)
   - *"Die Wurst ist **im** Kühlschrank."* (Sosis ada di dalam kulkas)
   - *"Die Eier findest du **in** der Schublade."* (Telur ada di dalam laci)
   - *"Der Teller ist **auf** dem Regal."* (Piring ada di atas rak)
   - *"Das Besteck liegt **unter** dem Kochbuch."* (Garpu-pisau ada di bawah buku masak)
3. Petunjuk tersimpan otomatis di **Reisetagebuch** (tekan TAB)
4. Pemain menemukan 5 item di area dapur HAUS zone
5. Setelah semua terkumpul → Oma kembali → **Kuis Refleksi** 2 pertanyaan

**Kuis Refleksi:**
> *"Wo lag die Pfanne?"*
> a) Unter dem Kühlschrank | b) **Auf dem Herd** ✓ | c) In der Schublade
>
> *"Wo waren die Eier?"*
> a) Auf dem Regal | b) Unter dem Kochbuch | c) **In der Schublade** ✓

**Item yang Dicari:**

| Item | Bahasa Indonesia | Warna | Lokasi di Zona |
|------|-----------------|-------|---------------|
| `pfanne` | Wajan | Abu-abu 🍳 | Dekat area kompor (x:0.5, z:-1.5) |
| `wurst` | Sosis | Merah 🌭 | Dekat area kulkas (x:-1.5, z:-2.0) |
| `ei` | Telur | Kuning muda 🥚 | Dekat area laci (x:1.5, z:-1.0) |
| `teller` | Piring | Biru muda 🍽 | Dekat area rak (x:0, z:0.5) |
| `besteck` | Garpu & Pisau | Perak 🍴 | Dekat area buku (x:-1, z:-0.5) |

**Reward:** 500 poin + unlock 12 kosakata dapur + journal entry *"Omas Hinweise für die Küche"*

---

#### Quest 2 — "Tantens Anruf!"

**Tujuan Pembelajaran:** Peserta didik dapat memahami informasi terperinci tentang letak suatu benda di ruang tamu menggunakan preposisi *auf, unter, neben*.

**Latar:** Ruang Tamu Rumah Oma (zona HAUS)

**Alur:**
1. Pemain berbicara dengan Tante Maria (representasi panggilan telepon)
2. Tante menjelaskan mainan mungkin ada *auf dem Sofa* atau *unter dem Tisch*
3. Kuis selektif: Mana yang dicek duluan? (*Auf dem Sofa* ✓)
4. Pemain menemukan `spielzeug` (🧸) di area sofa HAUS zone
5. Quest selesai → notifikasi berhasil

**Kosakata yang Diajarkan:** das Wohnzimmer, das Spielzeug, das Sofa, der Tisch, das Regal, neben, zwischen, auf dem Sofa, unter dem Tisch

**Reward:** 350 poin + unlock 9 kosakata ruang tamu + journal entry *"Das Wohnzimmer"*

---

### 7.4 F-04: Sistem Quest — Stage 2

#### Quest 3 — "Leni abholen!" (Selektif 1)

**Tujuan Pembelajaran:** Peserta didik dapat memahami informasi selektif tentang letak suatu tempat dari teks tulis sederhana.

**Latar:** Luar Rumah Oma → Schule

**Alur:**
1. Tante Maria memberikan petunjuk arah ke sekolah *(tidak terlalu jelas)*:
   > *"Geh geradeaus diese Straße entlang. An der Ampel biegst du links ab. Dann gehst du noch zwei Straßen weiter. Die Grundschule ist das große rote Gebäude auf der rechten Seite, neben dem Park."*
2. **Kuis Selektif:** *"An der Ampel soll Lukas..."*
   - a) Rechts abbiegen ✗
   - b) **Links abbiegen** ✓ (+100)
   - c) Geradeaus weitergehen ✗
3. Pemain navigasi ke zona SCHULE
4. Bertemu Leni → kembali ke HAUS

**Reward:** 450 poin + unlock 8 kosakata arah

---

#### Quest 4 — "Einkaufen für Oma!" (Selektif 2)

**Tujuan Pembelajaran:** Peserta didik dapat memahami informasi selektif tentang letak tempat dari percakapan dengan orang asing.

**Latar:** Dari HAUS → Area Supermarkt

**Alur:**
1. Oma meminta Lukas belanja: *Fleisch, Gemüse, Brot*
2. Lukas pergi tanpa tanya alamat — menyadari diri tidak tahu lokasi Supermarkt
3. Tanya **Passant 1 (Herr Bauer)** di jalan:
   > *"Gehen Sie diese Straße entlang, dann biegen Sie rechts an der Kirche ab. Der Supermarkt ist das große Gebäude gegenüber dem Parkhaus."*
4. **Kuis Selektif:** *"Der Supermarkt liegt gegenüber von..."*
   - a) Der Kirche ✗
   - b) **Dem Parkhaus** ✓ (+100)
   - c) Der Schule ✗
5. Pemain navigasi ke SUPERMARKET_INTERIOR → beli 3 item → kembali ke Oma

**Item Belanjaan:**

| Item | Bahasa Indonesia | Lokasi |
|------|-----------------|--------|
| `fleisch` | Daging | Rak pendingin EDEKA |
| `gemuese` | Sayuran | Rak sayur EDEKA |
| `brot` | Roti | Rak tengah EDEKA |

**Reward:** 500 poin + unlock 8 kosakata arah & supermarket

---

#### Quest 5 — "Eis kaufen!" (Selektif 3)

**Tujuan Pembelajaran:** Memahami informasi selektif tentang posisi relatif suatu tempat (*zwischen, neben*).

**Latar:** Area Supermarkt

**Alur:**
1. Tanya **Passant 2 (Frau Schmidt)**:
   > *"Der Eisstand ist zwischen dem Blumenladen und dem Café, neben der Bäckerei."*
2. **Kuis Selektif:** *"Zwischen welchen zwei Geschäften liegt der Eisstand?"*
   - a) Bäckerei und Kirche ✗
   - b) **Blumenladen und Café** ✓ (+100)
   - c) Park und Schule ✗
3. Pemain temukan dan ambil `eis` (🍦) di area yang benar

**Reward:** 300 poin + unlock 7 kosakata posisi relatif

---

#### Quest 6 — "Wo bin ich?" (Umum 1)

**Tujuan Pembelajaran:** Peserta didik dapat memahami informasi umum tentang letak tempat untuk menemukan jalan pulang.

**Latar:** Wochenmarkt (Lukas tersesat) → kembali ke HAUS

**Alur:**
1. Lukas tersesat setelah berkeliling terlalu jauh
2. Tanya **Passant 3 (Herr Fischer)**:
   > *"Gehen Sie zurück zur Hauptstraße, dann links bis zur Brücke. Überqueren Sie die Brücke, dann nehmen Sie die dritte Straße rechts. Das Haus ist das einzige mit dem roten Tor."*
3. **Kuis Umum:** *"Was muss Lukas überqueren?"*
   - a) Den Park ✗
   - b) **Die Brücke** ✓ (+100)
   - c) Die Hauptstraße ✗
4. Lukas juga berbicara dengan Opa Klaus untuk konfirmasi *Wahrzeichen* (tanda pengenal) dekat rumah
5. Navigasi kembali ke zona HAUS

**Reward:** 400 poin + unlock 6 kosakata navigasi umum + journal entry

---

#### Quest 7 — "Ins Kino!" (Umum 2)

**Tujuan Pembelajaran:** Peserta didik dapat memahami informasi umum tentang letak tempat dalam situasi mendesak/darurat.

**Latar:** Stadtpark (Lukas nyasar saat menuju bioskop) → Hafen/Kino

**Alur:**
1. Lukas tiba di Stadtpark (salah jalan menuju bioskop)
2. Tanya **Passant 4 (Frau Müller)** dengan tergesa-gesa:
   > *"Gehen Sie diese Allee geradeaus entlang bis zum Ende. Dann biegen Sie rechts auf die Hauptstraße ab. Das Kino ist das große Gebäude mit den bunten Lichtern auf der linken Seite."*
3. **Kuis Umum:** *"In welche Richtung biegt Lukas nach der Allee ab?"*
   - a) Links ✗
   - b) Geradeaus ✗
   - c) **Rechts** ✓ (+100)
4. Navigasi ke zona tujuan sebelum film mulai

**Reward:** 450 poin + unlock 7 kosakata navigasi darurat + journal entry

---

### 7.5 F-05: Sistem Dialog & Kuis

**Deskripsi:** Dialog berbahasa Jerman berbasis pohon (*tree-based*) dengan kuis pilihan ganda terintegrasi.

**Persyaratan Fungsional:**
- Teks dialog muncul dengan efek typewriter (karakter per karakter)
- Kata kosakata penting dibungkus tag `<vocab title="terjemahan">` → tooltip melayang saat diklik/hover
- Pilihan jawaban (max 3 opsi) dipilih via tombol 1/2/3 atau klik
- Feedback langsung: ✓ benar (poin +) atau ✗ salah (poin -, pertanyaan diulang)
- Avatar NPC tampil di sudut dialog box
- Dialog dapat dilanjutkan dengan E / Spasi

**Tipe Kuis:**

| Tipe | Stage | Deskripsi |
|------|-------|-----------|
| Selektif | Stage 1 & 2 Quest 3–5 | Jawaban spesifik dari teks (detail tertentu) |
| Umum | Stage 2 Quest 6–7 | Jawaban berdasarkan keseluruhan makna teks |
| Refleksi | Stage 1 | Kuis setelah semua item dikumpulkan |

**Acceptance Criteria:**
- [ ] Semua kosakata `<vocab>` menampilkan tooltip terjemahan saat diklik
- [ ] Jawaban salah tidak melanjutkan dialog — pertanyaan diulang
- [ ] Jawaban benar memicu efek positif (suara, partikel, poin)
- [ ] Avatar NPC tampil sesuai NPC yang berbicara

---

### 7.6 F-06: Sistem NPC

**Daftar NPC Lengkap:**

| # | ID | Nama | Peran | Zona | Quest |
|---|----|------|-------|------|-------|
| 1 | `oma_helga` | Oma Helga | Nenek Lukas | HAUS | 1, 4 |
| 2 | `opa_klaus` | Opa Klaus | Kakek Lukas | HAUS | 6, 8 |
| 3 | `tante_maria` | Tante Maria | Tante Lukas | HAUS | 2, 3 |
| 4 | `onkel_andre` | Onkel Andre | Paman Lukas | HAUS | — |
| 5 | `leni` | Leni | Sepupu Lukas | SCHULE | 3 |
| 6 | `felix` | Felix | Teman lama | STADTPARK | 9 |
| 7 | `nachbar_hans` | Nachbar Hans | Tetangga | HAUS | Hint |
| 8 | `passant_1` | Herr Bauer | Orang di jalan | HAUS | 4 |
| 9 | `passant_2` | Frau Schmidt | Orang di jalan | SUPERMARKT | 5 |
| 10 | `passant_3` | Herr Fischer | Orang di jalan | WOCHENMARKT | 6 |
| 11 | `passant_4` | Frau Müller | Orang di taman | STADTPARK | 7 |

**Persyaratan NPC:**
- Deteksi proximity: prompt "Press E" muncul dalam radius 2.5 unit
- Idle animation: gentle bobbing & head movement
- Label nama melayang di atas kepala (CSS2D)
- Tanda "!" merah pada NPC yang membawa quest aktif

---

### 7.7 F-07: Sistem Item Kolektif

**Deskripsi:** Item interaktif yang tersebar di zona, dikumpulkan dengan menekan E saat berada dalam radius interaksi.

**Item per Quest:**

| Quest | Items | Zona | Jumlah |
|-------|-------|------|--------|
| Quest 1 | pfanne, wurst, ei, teller, besteck | HAUS | 5 |
| Quest 2 | spielzeug | HAUS | 1 |
| Quest 4 | fleisch, gemuese, brot | SUPERMARKET_INTERIOR | 3 |
| Quest 5 | eis | SUPERMARKT | 1 |

**Mekanik Koleksi:**
- Item di-render sebagai kubus berwarna dengan ikon emoji di atas
- Item hanya "benar" jika `questTarget` cocok dengan quest yang sedang aktif
- Mengambil item salah: efek shake + poin -10
- Mengambil item benar: efek confetti + poin berdasarkan percobaan ke-n
- Progress toast: "2/5 Küchenutensilien gefunden"

---

### 7.8 F-08: Reisetagebuch (Jurnal Perjalanan)

**Deskripsi:** Buku catatan digital yang berisi petunjuk quest dan kosakata yang sudah dipelajari.

**Entri Journal per Quest:**

| Quest | Judul Entri | Isi Utama |
|-------|------------|-----------|
| Quest 1 | Omas Hinweise für die Küche | Petunjuk lokasi benda dapur (in/auf/unter) |
| Quest 2 | Das Wohnzimmer | Kosakata ruang tamu + preposisi |
| Quest 3 | Wegbeschreibung zur Schule | Rute ke sekolah (geradeaus, links) |
| Quest 4 | Omas Einkaufsliste | Daftar belanja + arah ke Supermarkt |
| Quest 6 | Ich habe mich verlaufen! | Arah pulang ke rumah Oma |
| Quest 7 | Zum Kino! | Rute ke bioskop dari Stadtpark |

**Persyaratan:**
- Dibuka/ditutup dengan tombol TAB
- Entri terbaru selalu di atas
- Preposisi dan kata arah di-highlight: `<span class="prep-highlight">AUF</span>`
- Hint quest aktif selalu tampil di bagian bawah

---

### 7.9 F-09: Sistem Skor & Penilaian

**Tabel Poin:**

| Aksi | Poin |
|------|------|
| Jawaban kuis benar (percobaan 1) | +100 |
| Jawaban kuis benar (percobaan 2) | +50 |
| Jawaban kuis benar (percobaan 3) | +20 |
| Jawaban kuis salah | -10 |
| Klik kosakata (vocab tooltip) | +15 |
| Berbicara dengan NPC | +10 |
| Menemukan area tersembunyi | +30 |
| Hint digunakan | -20 |

**Sistem Streak (Combo):**

| Jawaban Benar Berturut-turut | Multiplier | Tampilan |
|-----------------------------|------------|---------|
| 3 | 1.5× | 🔥 |
| 5 | 2.0× | 🔥🔥 |
| 7 | 2.5× | 🔥🔥🔥 |

**Rating Bintang:**

| Kondisi | Rating |
|---------|--------|
| Akurasi ≥ 85%, tanpa hint | ★★★ |
| Akurasi 65–84% | ★★ |
| Akurasi < 65% | ★ |

---

### 7.10 F-10: HUD & Antarmuka

**Komponen HUD:**

| Posisi | Komponen |
|--------|----------|
| Kiri atas | Quest tracker + progress bar |
| Kanan atas | Skor + indikator streak (🔥) |
| Kiri bawah | Minimap + hint kontrol keyboard |
| Tengah bawah | Dialog box (saat interaksi NPC) |
| Tengah layar | Prompt "Press E to speak" |

**Layar Khusus:**
- **Loading screen:** Progress bar + tips bahasa Jerman
- **Story intro:** 4 slide sinematik latar cerita Lukas
- **Pause menu:** Resume, bantuan, restart
- **Reisetagebuch:** Jurnal perjalanan + daftar kosakata
- **End screen:** Rating bintang + ringkasan kosakata yang dipelajari

---

## 8. Alur Permainan

```
[Loading Screen]
       ↓
[Story Intro — 4 slide: Lukas kembali ke Hamburg]
       ↓
[Mulai di Zona HAUS — Oma Helga menunggu]
       ↓
┌─────────────────────────────────────────────┐
│ STAGE 1 — Omas Haus                         │
│                                             │
│  Quest 1: Lukas macht Frühstück!            │
│  → Bicara Oma → Cari 5 item dapur           │
│  → Kuis refleksi preposisi (in/auf/unter)   │
│                                             │
│  Quest 2: Tantens Anruf!                    │
│  → Angkat telepon → Kuis selektif           │
│  → Cari mainan di ruang tamu                │
└─────────────────────────────────────────────┘
       ↓ Tante menyuruh Lukas keluar
┌─────────────────────────────────────────────┐
│ STAGE 2 — Reise (Ortsangaben nennen)        │
│                                             │
│  Quest 3: Leni abholen! [Selektif 1]        │
│  → Dengar arah Tante → Kuis → Ke Schule     │
│                                             │
│  Quest 4: Einkaufen für Oma! [Selektif 2]  │
│  → Tanya Passant arah → Kuis → Ke Supermarkt│
│                                             │
│  Quest 5: Eis kaufen! [Selektif 3]          │
│  → Tanya Passant Eisstand → Kuis → Temukan  │
│                                             │
│  Quest 6: Wo bin ich? [Umum 1]              │
│  → Tersesat → Tanya Passant → Kuis → Pulang │
│                                             │
│  Quest 7: Ins Kino! [Umum 2]               │
│  → Nyasar ke Park → Tanya Passant → Kuis    │
└─────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────┐
│ PENUTUP                                     │
│  Quest 8: Restaurant Deichstraße            │
│  Quest 9: Spaziergang an der Elbe           │
│  Quest 10: Abschiedsabend                   │
└─────────────────────────────────────────────┘
       ↓
[End Screen: Rating Bintang + Kosakata yang Dipelajari]
```

---

## 9. Karakter

### Lukas (Pemain)

- Remaja Indonesia, 18 tahun, 10 tahun di Hamburg, kembali liburan
- Tampilan: hoodie biru, celana khaki, sepatu putih, rambut hitam
- Animasi: idle (gentle bobbing), berjalan (ayun kaki & tangan), berlari (condong ke depan)
- Interaksi: tekan E untuk bicara dengan NPC / ambil item

### NPC Keluarga

| NPC | Ciri Khas | Kepribadian |
|-----|-----------|------------|
| Oma Helga | Kacamata, baju wol hijau, celemek | Hangat, sabar, penuh kasih |
| Opa Klaus | Topi pelaut, kumis tebal | Nostalgis, suka bercerita |
| Tante Maria | Blazer abu, rambut pirang | Rapi, praktis, sedikit terburu |
| Leni | Baju kuning, kuncir dua | Ceria, enerjik |

### Passant (NPC Orang Asing — Stage 2)

| NPC | Zona | Ciri Khas |
|-----|------|-----------|
| Herr Bauer | HAUS | Jaket hijau tua, kacamata |
| Frau Schmidt | SUPERMARKT | Baju ungu, rambut pirang |
| Herr Fischer | WOCHENMARKT | Jaket coklat, kumis |
| Frau Müller | STADTPARK | Baju biru dongker, kacamata |

---

## 10. Persyaratan Non-Fungsional

### 10.1 Performa

| Metrik | Target |
|--------|--------|
| Frame rate minimum | 30 FPS (hardware medium) |
| Waktu load awal | ≤ 10 detik |
| Waktu transisi zona | ≤ 2 detik (termasuk fade) |
| Ukuran total | ≤ 20 MB |

### 10.2 Kompatibilitas

| Platform | Target |
|----------|--------|
| Browser desktop | Chrome 90+, Firefox 90+, Edge 90+ |
| Resolusi minimum | 1280 × 720 |
| Mobile | Layar sentuh ≥ 5 inci |

### 10.3 Aksesibilitas

- Instruksi dalam Bahasa Indonesia; dialog dalam Bahasa Jerman
- Semua kosakata Jerman memiliki tooltip terjemahan Indonesia
- Hint kontrol selalu terlihat di HUD
- Warna item quest menggunakan palet kontras tinggi

### 10.4 Keandalan

- Berjalan penuh secara offline (tidak membutuhkan server)
- Progress tersimpan di `localStorage`
- Tidak ada external API dependency saat runtime

---

## 11. Arsitektur Teknis

### 11.1 Tech Stack

| Lapisan | Teknologi | Versi |
|---------|-----------|-------|
| Engine 3D | Three.js | 0.158.0 |
| Animasi UI | GSAP | 3.12.2 |
| Audio | Howler.js | 2.2.3 |
| Build Tool | Vite | Latest |
| Camera | OrthographicCamera (isometric 45°) | — |
| Post-processing | UnrealBloomPass + custom vignette shader | — |

### 11.2 Struktur Modul

```
js/
├── main.js        — Game loop, state global
├── player.js      — Kontrol karakter, input, animasi
├── npc.js         — Spawn, animasi, proximity detection
├── world.js       — Builder geometri per zona + spawn quest items
├── zone.js        — Manajer zona & portal
├── dialog.js      — Engine dialog tree + vocab tooltip
├── quest.js       — State machine quest + logika koleksi item
├── ui.js          — HUD, pause menu, mobile controls
├── scoring.js     — Poin, streak, rating bintang
├── config.js      — Konstanta, ZONES, EVENTS, COLORS
└── data/
    ├── quests.js  — Definisi 10 quest (Stage 1, 2, Penutup)
    ├── npcs.js    — 11 NPC (keluarga + 4 Passant)
    └── dialogs.js — Dialog trees + JOURNAL_ENTRIES + NPC_DEFAULT_DIALOG
```

### 11.3 State Machine Quest

```
IDLE → (player menekan E di NPC quest giver)
     → DIALOG (intro quest)
     → EXPLORATION (player mencari item / zona)
     → INTERACTION (player menekan E di item)
     → REFLECTION (kuis setelah semua item terkumpul / dialog selesai)
     → IDLE (quest selesai, quest berikutnya unlock)
```

---

## 12. Risiko & Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Siswa bingung membedakan selektif vs umum | Sedang | Tinggi | Label jelas di jurnal: "SELEKTIF / UMUM" |
| Dialog Jerman terlalu sulit untuk A1-A2 | Sedang | Tinggi | Validasi konten oleh guru Bahasa Jerman |
| Performa rendah pada PC lama | Sedang | Tinggi | Geometri low-poly, shadow dioptimalkan |
| Item quest sulit ditemukan di zona | Sedang | Sedang | Item diberi warna mencolok + ikon emoji + hint di jurnal |
| Passant NPC tidak muncul saat dibutuhkan | Rendah | Tinggi | Level-based spawning (NPC muncul sesuai `level` quest aktif) |
| WebGL tidak didukung browser lama | Rendah | Tinggi | Deteksi WebGL support + pesan error informatif |

---

## 13. Kriteria Rilis

### 13.1 Minimum Viable Product (MVP) — untuk Uji Coba

- [ ] Stage 1 Quest 1 & 2 dapat dimainkan penuh (item terkolleksi, kuis berfungsi)
- [ ] Stage 2 Quest 3–7 dialog + kuis berfungsi
- [ ] Semua 4 Passant NPC muncul dan bisa diinteraksi
- [ ] Reisetagebuch menampilkan journal entry yang benar per quest
- [ ] Sistem skor dan streak berfungsi
- [ ] Game berjalan di Chrome 90+ resolusi 1280×720 tanpa crash

### 13.2 Kriteria Kualitas Penelitian (Skripsi)

- [ ] Validasi konten Bahasa Jerman oleh ≥ 1 guru Bahasa Jerman
- [ ] Validasi media oleh ≥ 1 ahli teknologi pembelajaran
- [ ] Uji coba dengan ≥ 20 siswa kelas XI
- [ ] Instrumen pre-test & post-test mencakup kosakata dari Stage 1 & Stage 2
- [ ] Kuesioner UEQ (*User Experience Questionnaire*) skor ≥ Good
- [ ] Tidak ada *game-breaking bug* yang menghalangi penyelesaian Stage 1

---

## 14. Glosarium

| Istilah | Definisi |
|---------|----------|
| CTL | *Contextual Teaching and Learning* — pembelajaran melalui konteks nyata |
| Selektif | Kemampuan menemukan informasi **spesifik** dalam teks (contoh: belok kiri di mana?) |
| Umum | Kemampuan memahami **makna keseluruhan** teks (contoh: apa yang harus diseberangi?) |
| Passant | NPC orang asing di jalanan yang diminta petunjuk arah (Stage 2) |
| Reisetagebuch | "Buku harian perjalanan" — jurnal in-game tempat kosakata & hint quest dicatat |
| Ortsangaben | "Pernyataan tempat" — topik menyebutkan letak tempat dalam Bahasa Jerman |
| Streak | Rangkaian jawaban benar berturut-turut yang meningkatkan multiplier poin |
| Preposisi | Kata depan yang menunjukkan posisi: *in* (di dalam), *auf* (di atas), *unter* (di bawah) |
| Kuis Refleksi | Mini-kuis di akhir quest untuk menguji pemahaman kosakata yang baru dipelajari |
| NPC | *Non-Player Character* — karakter yang dikendalikan sistem |

---

*Dokumen ini merupakan living document yang diperbarui sesuai hasil pengembangan dan uji coba.*  
*Versi 2.0 — Mencerminkan struktur Stage 1 & Stage 2 sesuai Modul Pembelajaran Yemima.*
