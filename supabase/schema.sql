-- ═══════════════════════════════════════════════════════════════════
-- supabase/schema.sql — Lukas Abenteuer · Akun, Save Online, Latihan Soal
--
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
-- Aman dijalankan ulang (idempotent) — data yang sudah ada tidak dihapus.
--
-- Prinsip keamanan:
--   • Semua tabel RLS aktif TANPA policy → anon key tidak bisa membaca /
--     menulis tabel secara langsung.
--   • Browser hanya memanggil fungsi RPC di bawah (SECURITY DEFINER).
--   • Kunci jawaban (quiz_key) TIDAK PERNAH dikirim ke browser siswa;
--     penilaian terjadi di quiz_submit().
--   • Fungsi admin_* memerlukan password admin (dicek dengan SHA-256,
--     sama dengan password admin di dalam game).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net   with schema extensions;


-- ── TABEL ──────────────────────────────────────────────────────────

create table if not exists public.players (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  name_key          text not null unique,          -- huruf kecil, spasi tunggal
  created_at        timestamptz not null default now(),
  last_seen         timestamptz not null default now(),
  progress_reset_at bigint not null default 0,     -- epoch ms; save lebih lama dibuang
  quiz_reset_at     bigint not null default 0      -- epoch ms; draft lebih lama dibuang
);

create table if not exists public.saves (
  player_id  uuid primary key references public.players(id) on delete cascade,
  data       jsonb  not null,
  saved_at   bigint not null default 0,            -- data.savedAt (epoch ms)
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  player_id    uuid primary key references public.players(id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb, -- {"1": 3, "2": 4, ...}  (0 = A)
  status       text  not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  correct      int,
  total        int,
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.quiz_key (
  q             int primary key,
  part          int not null,                      -- 1 = Omas Haus, 2 = In der Stadt
  correct_index int not null check (correct_index between 0 and 4)
);

create table if not exists public.admin_config (
  id              int primary key default 1 check (id = 1),
  password_sha256 text not null,
  sheets_webhook  text                             -- URL Web App Google Apps Script
);

alter table public.players       enable row level security;
alter table public.saves         enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_key      enable row level security;
alter table public.admin_config  enable row level security;

revoke all on public.players, public.saves, public.quiz_attempts,
              public.quiz_key, public.admin_config from anon, authenticated;


-- ── KUNCI JAWABAN (dari SOAL.docx, ✅) — 0 = A … 4 = E ────────────

insert into public.quiz_key (q, part, correct_index) values
  ( 1, 1, 3), ( 2, 1, 4), ( 3, 1, 3), ( 4, 1, 3), ( 5, 1, 2),
  ( 6, 1, 4), ( 7, 1, 3), ( 8, 1, 3), ( 9, 1, 2), (10, 1, 3),
  (11, 2, 2), (12, 2, 3), (13, 2, 3), (14, 2, 3), (15, 2, 4),
  (16, 2, 3), (17, 2, 3), (18, 2, 4), (19, 2, 4), (20, 2, 4)
on conflict (q) do update set part = excluded.part, correct_index = excluded.correct_index;

-- Password admin awal = password admin yang sama dengan di dalam game
-- (js/admin.js → PASSWORD_HASH). Ganti dengan:
--   update public.admin_config
--      set password_sha256 = encode(extensions.digest('PasswordBaru', 'sha256'), 'hex');
insert into public.admin_config (id, password_sha256)
values (1, '33606b36c7aa4ac03db6d3c8266206c293178646bdae5c8b6be44990c7890c7e')
on conflict (id) do nothing;


-- ── HELPER ─────────────────────────────────────────────────────────

create or replace function public._clean_name(p_name text)
returns text language sql immutable as $$
  select regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')
$$;

create or replace function public._now_ms()
returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- Jumlah jawaban benar; p_part = null → semua bagian
create or replace function public._score(p_answers jsonb, p_part int default null)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.quiz_key k
   where (p_part is null or k.part = p_part)
     and jsonb_typeof(p_answers -> k.q::text) = 'number'
     and (p_answers ->> k.q::text)::int = k.correct_index
$$;

create or replace function public._admin_check(p_pass text)
returns void language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from public.admin_config
     where id = 1
       and password_sha256 = encode(extensions.digest(coalesce(p_pass, ''), 'sha256'), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Jawaban dibersihkan: hanya nomor soal yang ada & indeks 0–4
create or replace function public._clean_answers(p_answers jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k.q::text, (p_answers ->> k.q::text)::int), '{}'::jsonb)
    from public.quiz_key k
   where jsonb_typeof(p_answers -> k.q::text) = 'number'
     and (p_answers ->> k.q::text)::numeric in (0, 1, 2, 3, 4)
$$;


-- ── RPC PEMAIN ─────────────────────────────────────────────────────

-- Masuk dengan nama. Nama yang sama (tanpa beda huruf besar/spasi) = akun yang sama.
create or replace function public.player_login(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := public._clean_name(p_name);
  v_key  text := lower(public._clean_name(p_name));
  v_p    public.players;
  v_new  boolean := false;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  insert into public.players (name, name_key) values (v_name, v_key)
  on conflict (name_key) do nothing
  returning * into v_p;

  if found then
    v_new := true;
  else
    update public.players set last_seen = now() where name_key = v_key returning * into v_p;
  end if;

  return jsonb_build_object(
    'id',              v_p.id,
    'name',            v_p.name,
    'isNew',           v_new,
    'progressResetAt', v_p.progress_reset_at,
    'quizResetAt',     v_p.quiz_reset_at,
    'save',            (select s.data from public.saves s where s.player_id = v_p.id),
    'quiz',            (select jsonb_build_object('status', a.status, 'answers', a.answers)
                          from public.quiz_attempts a where a.player_id = v_p.id)
  );
end $$;

-- Simpan progress game. Save yang lebih lama dari yang tersimpan diabaikan.
create or replace function public.save_progress(p_id uuid, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_at    bigint;
  v_reset bigint;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 200000 then
    return false;
  end if;
  v_at := coalesce(nullif(p_data ->> 'savedAt', '')::bigint, public._now_ms());

  select progress_reset_at into v_reset from public.players where id = p_id;
  if not found or v_at < v_reset then return false; end if;

  insert into public.saves as s (player_id, data, saved_at, updated_at)
  values (p_id, p_data, v_at, now())
  on conflict (player_id) do update
     set data = excluded.data, saved_at = excluded.saved_at, updated_at = now()
   where s.saved_at <= excluded.saved_at;
  if not found then return false; end if;    -- yang tersimpan lebih baru

  update public.players set last_seen = now() where id = p_id;
  return true;
end $$;

-- Simpan jawaban sementara (selama mengerjakan). Tidak berlaku setelah dikirim.
create or replace function public.quiz_save_draft(p_id uuid, p_answers jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not exists (select 1 from public.players where id = p_id) then
    raise exception 'unknown_player' using errcode = '22023';
  end if;

  insert into public.quiz_attempts as a (player_id, answers)
  values (p_id, public._clean_answers(p_answers))
  on conflict (player_id) do update
     set answers = excluded.answers, updated_at = now()
   where a.status = 'in_progress';

  select status into v_status from public.quiz_attempts where player_id = p_id;
  return v_status;
end $$;

-- Kirim jawaban. Nilai dihitung di sini dan TIDAK dikembalikan ke siswa.
create or replace function public.quiz_submit(p_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_answers jsonb := public._clean_answers(p_answers);
  v_total   int   := (select count(*) from public.quiz_key);
  v_prev    text;
begin
  if not exists (select 1 from public.players where id = p_id) then
    raise exception 'unknown_player' using errcode = '22023';
  end if;

  select status into v_prev from public.quiz_attempts where player_id = p_id;
  if v_prev = 'submitted' then
    return jsonb_build_object('ok', true, 'alreadySubmitted', true);
  end if;

  insert into public.quiz_attempts as a (player_id, answers, status, correct, total, submitted_at, updated_at)
  values (p_id, v_answers, 'submitted', public._score(v_answers), v_total, now(), now())
  on conflict (player_id) do update
     set answers = excluded.answers, status = 'submitted', correct = excluded.correct,
         total = excluded.total, submitted_at = now(), updated_at = now();

  return jsonb_build_object('ok', true, 'alreadySubmitted', false);
end $$;


-- ── RPC ADMIN ──────────────────────────────────────────────────────

-- Semua pemain + progress + hasil latihan (dipakai halaman Admin & Google Sheets)
create or replace function public.admin_results(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check(p_pass);
  return jsonb_build_object(
    'generatedAt', now(),
    'key', (select coalesce(jsonb_agg(jsonb_build_object('q', q, 'part', part, 'correct', correct_index) order by q), '[]'::jsonb)
              from public.quiz_key),
    'players', (
      select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.name_key), '[]'::jsonb)
        from (
          select p.id, p.name, p.name_key, p.created_at, p.last_seen,
                 (select count(*) from jsonb_each_text(coalesce(s.data -> 'questState', '{}'::jsonb)) e
                   where e.value = 'completed')::int                    as quests_done,
                 s.data ->> 'activeQuestId'                              as active_quest,
                 nullif(s.data ->> 'score', '')::numeric::int            as game_score,
                 s.updated_at                                            as save_updated_at,
                 coalesce(a.status, 'none')                              as quiz_status,
                 coalesce(a.answers, '{}'::jsonb)                        as answers,
                 case when a.status = 'submitted' then a.correct end     as correct,
                 case when a.status = 'submitted' then public._score(a.answers, 1) end as part1,
                 case when a.status = 'submitted' then public._score(a.answers, 2) end as part2,
                 (select count(*) from jsonb_object_keys(coalesce(a.answers, '{}'::jsonb)))::int as answered,
                 coalesce(a.total, (select count(*) from public.quiz_key))::int as total,
                 a.started_at, a.submitted_at
            from public.players p
            left join public.saves s         on s.player_id = p.id
            left join public.quiz_attempts a on a.player_id = p.id
        ) r
    )
  );
end $$;

create or replace function public.admin_reset_quiz(p_pass text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check(p_pass);
  delete from public.quiz_attempts where player_id = p_id;
  update public.players set quiz_reset_at = public._now_ms() where id = p_id;
  return found;
end $$;

create or replace function public.admin_reset_progress(p_pass text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check(p_pass);
  delete from public.saves where player_id = p_id;
  delete from public.quiz_attempts where player_id = p_id;
  update public.players set progress_reset_at = public._now_ms(), quiz_reset_at = public._now_ms() where id = p_id;
  return found;
end $$;

create or replace function public.admin_delete_player(p_pass text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check(p_pass);
  delete from public.players where id = p_id;
  return found;
end $$;

-- Hapus SEMUA pemain, save, dan hasil latihan.
create or replace function public.admin_reset_all(p_pass text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  perform public._admin_check(p_pass);
  delete from public.players where true;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- URL Web App Google Sheets (lihat SETUP-ONLINE.md). null = matikan.
create or replace function public.admin_set_sheets_webhook(p_pass text, p_url text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check(p_pass);
  update public.admin_config set sheets_webhook = nullif(btrim(p_url), '') where id = 1;
  return true;
end $$;


-- ── GOOGLE SHEETS: kabari Apps Script saat hasil berubah ───────────

create or replace function public._notify_sheets()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
begin
  select sheets_webhook into v_url from public.admin_config where id = 1;
  if v_url is not null then
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('event', tg_op, 'table', tg_table_name, 'at', now()),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return null;
exception when others then
  -- Sheets tidak boleh menggagalkan penyimpanan nilai
  return null;
end $$;

drop trigger if exists trg_sheets_quiz_status on public.quiz_attempts;
create trigger trg_sheets_quiz_status
  after update on public.quiz_attempts
  for each row when (old.status is distinct from new.status)
  execute function public._notify_sheets();

drop trigger if exists trg_sheets_quiz_insert on public.quiz_attempts;
create trigger trg_sheets_quiz_insert
  after insert on public.quiz_attempts
  for each row when (new.status = 'submitted')
  execute function public._notify_sheets();

drop trigger if exists trg_sheets_quiz_delete on public.quiz_attempts;
create trigger trg_sheets_quiz_delete
  after delete on public.quiz_attempts
  for each statement execute function public._notify_sheets();

drop trigger if exists trg_sheets_players on public.players;
drop trigger if exists trg_sheets_players_insert on public.players;
create trigger trg_sheets_players_insert
  after insert on public.players
  for each row execute function public._notify_sheets();

drop trigger if exists trg_sheets_players_delete on public.players;
create trigger trg_sheets_players_delete
  after delete on public.players
  for each statement execute function public._notify_sheets();


-- ── HAK AKSES FUNGSI ───────────────────────────────────────────────

revoke execute on function public._score(jsonb, int)      from public, anon, authenticated;
revoke execute on function public._admin_check(text)      from public, anon, authenticated;
revoke execute on function public._clean_answers(jsonb)   from public, anon, authenticated;
revoke execute on function public._notify_sheets()        from public, anon, authenticated;

grant execute on function public.player_login(text)                  to anon, authenticated;
grant execute on function public.save_progress(uuid, jsonb)          to anon, authenticated;
grant execute on function public.quiz_save_draft(uuid, jsonb)        to anon, authenticated;
grant execute on function public.quiz_submit(uuid, jsonb)            to anon, authenticated;
grant execute on function public.admin_results(text)                 to anon, authenticated;
grant execute on function public.admin_reset_quiz(text, uuid)        to anon, authenticated;
grant execute on function public.admin_reset_progress(text, uuid)    to anon, authenticated;
grant execute on function public.admin_delete_player(text, uuid)     to anon, authenticated;
grant execute on function public.admin_reset_all(text)               to anon, authenticated;
grant execute on function public.admin_set_sheets_webhook(text, text) to anon, authenticated;
