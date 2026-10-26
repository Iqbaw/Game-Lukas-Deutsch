# Setup Online dengan Google Sheets

Game ini memakai **Google Sheets + Google Apps Script** sebagai server. Tidak perlu
Supabase atau layanan lain, cukup **satu akun Google**. Setup ini hanya perlu dilakukan
**sekali** dan memakan waktu kira-kira **10 menit**.

Hasil akhirnya:

- Siswa masuk hanya dengan **nama** (tanpa password). Progress tersimpan online,
  jadi siswa bisa lanjut bermain dari komputer atau HP lain.
- Setelah Quest 10, siswa mengerjakan **Latihan Soal** (20 soal). Jawaban **dinilai
  otomatis di server**. Siswa **tidak** melihat nilai atau benar/salah.
- Guru melihat nilai semua siswa di **halaman Admin** (bisa reset) dan di
  **Google Sheets**. Sheet **Rekap**, **Detail Jawaban**, dan **Analisis Soal** terisi
  dan diperbarui otomatis.

> Kalau setup ini belum dilakukan, game tetap berjalan normal dalam **mode lokal**:
> akun dan progress hanya tersimpan di browser itu, dan nilai tidak bisa dilihat guru.

---

## 1. Buat spreadsheet dan script

1. Buka <https://sheets.google.com>, lalu buat spreadsheet baru,
   misal **"Rekap Nilai Lukas Abenteuer"**.
2. Buka menu **Extensions → Apps Script**.
3. Hapus semua isi `Code.gs`, lalu tempel **seluruh** isi file
   [`google-sheets/Code.gs`](google-sheets/Code.gs) dari repo ini. Simpan dengan ikon 💾.

## 2. Jalankan `setup` sekali

1. Di toolbar Apps Script, pilih fungsi **`setup`** di dropdown, lalu klik **▶ Run**.
2. Google akan meminta izin. Pilih akunmu → **Advanced** →
   **Go to … (unsafe)** → **Allow**. Ini script milikmu sendiri, jadi aman.
3. Kembali ke spreadsheet. Sekarang ada sheet **Rekap**, **Detail Jawaban**, dan
   **Analisis Soal**, plus menu baru **🎓 Lukas**.

`setup` juga membuat sheet data tersembunyi (`_players`, `_saves`, `_quiz`) dan pemicu
otomatis yang memperbarui rekap setiap menit, tapi hanya kalau ada perubahan.

> ⚠️ Jangan edit atau hapus sheet `_players`, `_saves`, dan `_quiz`. Di situlah akun,
> progress, dan jawaban siswa disimpan.

## 3. Publikasikan sebagai Web App

1. Di Apps Script, klik **Deploy → New deployment**.
2. Klik ⚙️ di samping *Select type*, lalu pilih **Web app**.
3. Isi:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
4. Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

## 4. Isi di game

Buka [`js/config.js`](js/config.js), lalu isi:

```js
SHEETS_API_URL:      'https://script.google.com/macros/s/XXXX/exec',  // dari langkah 3
SHEETS_URL:          'https://docs.google.com/spreadsheets/d/YYYY',   // link spreadsheet-mu
```

Commit, lalu deploy ulang game (Vercel). Untuk mengetesnya, buka game, ketik nama,
lalu klik **Los geht's**. Dalam satu menit, nama itu akan muncul di sheet **Rekap**.

> Kalau `Code.gs` diubah nanti, buka **Deploy → Manage deployments → ✏️ Edit**,
> pilih *Version*: **New version**, lalu klik **Deploy**. URL-nya tetap sama.

---

## Password admin

Password admin di server **sama dengan password admin di dalam game**
(menu tersembunyi: `Ctrl + Shift + A`, atau ketuk judul game 5×).

Untuk menggantinya, buka spreadsheet → **🎓 Lukas → Admin-Passwort ändern**. Script
akan menampilkan *hash* baru. Tempel hash itu ke `PASSWORD_HASH` di `js/admin.js`
supaya login admin di game ikut berubah.

## Cara pakai (guru)

| Mau apa | Caranya |
|---|---|
| Lihat nilai semua siswa | Admin (`Ctrl+Shift+A`) → **📊 Ergebnisse aller Spieler**, atau buka sheet **Rekap** |
| Lihat jawaban per soal | Klik baris siswa di Admin (✓ hijau benar, ✗ merah salah), atau sheet **Detail Jawaban** |
| Soal mana yang paling sulit | Sheet **Analisis Soal** (% benar dan pengecoh terbanyak) |
| Siswa boleh mengulang Latihan Soal | Buka baris siswa → **↺ Reset Latihan** |
| Siswa mulai game dari awal | Buka baris siswa → **↺ Reset Progress** |
| Hapus satu siswa | Buka baris siswa → **🗑 Hapus** |
| Hapus semua data (kelas baru) | **🗑 Alle zurücksetzen**, lalu ketik `RESET` |
| Perbarui rekap sekarang juga | Spreadsheet → **🎓 Lukas → Jetzt aktualisieren** |
| Unduh ke Excel | **⬇ CSV** di halaman Admin, atau *File → Download* di Sheets |

**Nilai** = jumlah benar ÷ 20 × 100. Di Sheets, nilai ≥ 80 berwarna hijau,
60–79 kuning, dan < 60 merah.

## Catatan

- **Tanpa password berarti nama = akun.** Siapa pun yang mengetik nama yang sama
  (huruf besar/kecil dan spasi tidak berpengaruh) akan masuk ke akun yang sama.
  Minta siswa memakai **nama lengkap**. Nama harus diawali huruf, 2–40 karakter.
- Komputer lab bisa dipakai bergantian: setiap nama punya save sendiri.
  Klik **"Nicht du? Wechseln"** di menu untuk ganti siswa.
- Google Apps Script sedikit lebih lambat dari database biasa. Login dan **Abgeben**
  butuh sekitar 1–3 detik. Progress dikirim di latar belakang paling sering setiap
  30 detik, dan langsung saat quest selesai atau halaman ditutup. Ini cukup untuk
  satu kelas (±40 siswa bermain bersamaan).
- Kalau internet putus, progress tetap tersimpan di browser dan dikirim ulang otomatis.
  Pengiriman Latihan Soal yang gagal bisa diulang dengan menekan **Abgeben** lagi.
- Kunci jawaban hanya ada di `Code.gs` (server), tidak pernah dikirim ke browser siswa.
