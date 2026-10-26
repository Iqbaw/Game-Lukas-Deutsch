# Setup Online: Akun, Save Progress, Latihan Soal & Google Sheets

Panduan ini menyambungkan game ke **Supabase** (database gratis) dan **Google Sheets**.
Waktu yang dibutuhkan kira-kira **15 menit** dan cukup dilakukan **sekali**.

Hasil akhirnya:

- Siswa masuk hanya dengan **nama** (tanpa password). Progress tersimpan online,
  jadi siswa bisa lanjut bermain dari komputer atau HP lain.
- Setelah Quest 10, siswa mengerjakan **Latihan Soal** (20 soal). Jawaban **dinilai
  otomatis di server**. Siswa **tidak** melihat nilai atau benar/salah.
- Guru melihat nilai semua siswa di **halaman Admin** (bisa reset) dan di
  **Google Sheets** yang rapi dan terisi otomatis.

> Kalau langkah ini belum dilakukan, game tetap berjalan normal dalam **mode lokal**:
> akun dan progress hanya tersimpan di browser itu, dan nilai tidak bisa dilihat guru.

---

## Bagian A — Supabase (database)

### 1. Buat project
1. Buka <https://supabase.com>, lalu daftar atau masuk (bisa pakai akun GitHub/Google).
2. Klik **New project**. Isi nama (misal `lukas-abenteuer`), buat *database password*
   (simpan, tapi tidak dipakai di game), lalu pilih region **Southeast Asia (Singapore)**.
3. Tunggu sekitar 1–2 menit sampai project siap.

### 2. Jalankan schema
1. Di menu kiri, buka **SQL Editor**, lalu klik **New query**.
2. Buka file [`supabase/schema.sql`](supabase/schema.sql) dari repo ini, salin **seluruh**
   isinya, tempel di editor, lalu klik **Run**.
3. Pastikan muncul `Success. No rows returned`. File ini aman dijalankan ulang.

Schema ini membuat tabel pemain, save, dan jawaban, plus **kunci jawaban 20 soal**.
Kunci jawaban hanya ada di database dan tidak pernah dikirim ke browser siswa.

### 3. Password admin
Password admin di database **sama dengan password admin di dalam game**
(menu tersembunyi: `Ctrl + Shift + A`, atau ketuk judul game 5×).
Kalau mau menggantinya, jalankan ini di SQL Editor:

```sql
update public.admin_config
   set password_sha256 = encode(extensions.digest('PasswordBaru', 'sha256'), 'hex');
```

Setelah itu, ganti juga `PASSWORD_HASH` di `js/admin.js` dengan hasil dari query ini:
`select encode(extensions.digest('PasswordBaru','sha256'),'hex');`

### 4. Ambil URL & key
Buka **Project Settings → API Keys** (atau **Connect**):
- **Project URL**, contoh: `https://abcdxyz.supabase.co`
- **anon / publishable key** (key ini memang boleh publik)

> ⚠️ **Jangan** pakai `service_role` / `secret` key di game.

### 5. Isi di game
Buka [`js/config.js`](js/config.js) dan isi:

```js
SUPABASE_URL:        'https://abcdxyz.supabase.co',
SUPABASE_ANON_KEY:   'eyJhbGciOi…',      // anon / publishable key
SHEETS_URL:          '',                 // diisi di Bagian B
```

Commit, lalu deploy ulang game. Coba buka game, ketik nama, lalu klik **Los geht's**.
Di Supabase → **Table Editor → players**, nama tersebut seharusnya muncul.

---

## Bagian B — Google Sheets (rekap nilai)

### 1. Buat spreadsheet & script
1. Buat Google Spreadsheet baru, misal **"Rekap Nilai Lukas Abenteuer"**.
2. Buka menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs`, lalu tempel seluruh isi
   [`google-sheets/Code.gs`](google-sheets/Code.gs) dan simpan (ikon 💾).

### 2. Isi Script properties
Di Apps Script, buka **Project Settings (⚙️) → Script properties → Add script property**,
lalu tambahkan tiga property ini:

| Property | Isi |
|---|---|
| `SUPABASE_URL` | Project URL dari Bagian A.4 |
| `SUPABASE_ANON_KEY` | anon / publishable key |
| `ADMIN_PASSWORD` | password admin game |

### 3. Coba sekali
1. Kembali ke spreadsheet dan muat ulang halamannya. Menu **🎓 Lukas** akan muncul.
2. Klik **🎓 Lukas → Einrichtung prüfen**. Google akan meminta izin; pilih akunmu →
   *Advanced* → *Go to … (unsafe)* → **Allow**. Ini script milikmu sendiri.
3. Klik **🎓 Lukas → Jetzt aktualisieren**. Sheet **Rekap**, **Detail Jawaban**, dan
   **Analisis Soal** akan terbentuk.
4. (Disarankan) Klik **🎓 Lukas → Aktualisierung alle 5 Min. einschalten** supaya progress
   quest siswa juga ikut diperbarui secara berkala.

### 4. Update instan saat siswa mengirim (webhook)
1. Di Apps Script, klik **Deploy → New deployment**, lalu pilih type **Web app**.
2. Isi *Execute as*: **Me**, dan *Who has access*: **Anyone**. Klik **Deploy**, lalu salin
   **Web app URL** (berakhiran `/exec`).
3. Di Supabase → SQL Editor, jalankan:

   ```sql
   update public.admin_config
      set sheets_webhook = 'https://script.google.com/macros/s/XXXX/exec'
    where id = 1;
   ```

Sekarang setiap kali siswa menekan **Abgeben** (atau admin melakukan reset), spreadsheet
langsung dibangun ulang.

### 5. Link di halaman Admin
Salin link spreadsheet, tempel di `SHEETS_URL` pada `js/config.js`, lalu deploy ulang.
Tombol **📗 Google Sheets** akan muncul di halaman *Ergebnisse*.

---

## Cara pakai (guru)

| Mau apa | Caranya |
|---|---|
| Lihat nilai semua siswa | Admin (`Ctrl+Shift+A`) → **📊 Ergebnisse aller Spieler** |
| Lihat jawaban per soal | Klik baris siswa: jawaban benar ditandai ✓ hijau, salah ✗ merah |
| Siswa boleh mengulang Latihan Soal | Buka baris siswa → **↺ Reset Latihan** |
| Siswa mulai game dari awal | Buka baris siswa → **↺ Reset Progress** |
| Hapus satu siswa | Buka baris siswa → **🗑 Hapus** |
| Hapus semua data (kelas baru) | **🗑 Alle zurücksetzen**, lalu ketik `RESET` |
| Unduh ke Excel | **⬇ CSV** |

**Nilai** = jumlah benar ÷ 20 × 100. Di Sheets, nilai ≥ 80 berwarna hijau,
60–79 kuning, dan < 60 merah.

## Catatan

- **Tanpa password berarti nama = akun.** Siapa pun yang mengetik nama yang sama
  (huruf besar/kecil dan spasi tidak berpengaruh) akan masuk ke akun yang sama.
  Minta siswa memakai **nama lengkap**.
- Komputer lab bisa dipakai bergantian: setiap nama punya save sendiri.
  Klik **"Nicht du? Wechseln"** di menu untuk ganti siswa.
- Kalau internet putus, progress tetap tersimpan di browser dan dikirim ulang otomatis.
  Pengiriman Latihan Soal yang gagal bisa diulang dengan menekan **Abgeben** lagi.
