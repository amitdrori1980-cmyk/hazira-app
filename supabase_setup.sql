-- =============================================
-- הזירה — Supabase SQL Setup
-- הדבק והרץ ב-SQL Editor של Supabase
-- =============================================

-- 1. טבלת פרופילי משתמשים
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text,
  dept text,
  is_manager boolean default false,
  created_at timestamptz default now()
);

-- 2. טבלת אירועים
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time time,
  type text default 'rehearsal',
  description text,
  depts text[] default '{}',
  created_at timestamptz default now()
);

-- 3. טבלת משימות
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority text default 'רגיל',
  done boolean default false,
  assignee_id uuid references profiles(id) on delete set null,
  dept text,
  created_at timestamptz default now()
);

-- 4. טבלת הודעות
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  sender_id uuid references profiles(id) on delete set null,
  to_user uuid references profiles(id) on delete cascade,
  to_dept text,
  read boolean default false,
  created_at timestamptz default now()
);

-- 5. טבלת ציוד
create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity text,
  location text,
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- הרשאות (RLS)
-- =============================================
alter table profiles  enable row level security;
alter table events    enable row level security;
alter table tasks     enable row level security;
alter table messages  enable row level security;
alter table equipment enable row level security;

-- כל משתמש מחובר יכול לקרוא הכל
create policy "auth_read_profiles"  on profiles  for select using (auth.role() = 'authenticated');
create policy "auth_read_events"    on events    for select using (auth.role() = 'authenticated');
create policy "auth_all_tasks"      on tasks     for all    using (auth.role() = 'authenticated');
create policy "auth_all_messages"   on messages  for all    using (auth.role() = 'authenticated');
create policy "auth_all_equipment"  on equipment for all    using (auth.role() = 'authenticated');
create policy "auth_insert_profiles" on profiles for insert with check (auth.role() = 'authenticated');
create policy "auth_update_profiles" on profiles for update using (auth.uid() = id);

-- =============================================
-- נתוני דוגמה — אירועים
-- =============================================
insert into events (title, date, time, type, description, depts) values
  ('המלט — חזרה כללית',          '2026-05-25', '15:00', 'rehearsal', 'כל הצוות הטכני חייב להיות נוכח', array['ניהול','תאורה','צליל','תפאורה','תלבושות']),
  ('המלט — הצגת בכורה',          '2026-05-28', '19:30', 'show',      '', array['ניהול','תאורה','צליל','תפאורה','תלבושות']),
  ('פירוק תפאורה ואיפוס',         '2026-05-30', '10:00', 'crew',      '', array['תפאורה','ניהול']),
  ('חלום ליל קיץ — קריאה ראשונה', '2026-06-03', '11:00', 'rehearsal', '', array['ניהול','תאורה','צליל','תפאורה','תלבושות']),
  ('עיצוב תאורה',                 '2026-06-05', '14:00', 'technical', '', array['תאורה']);

-- =============================================
-- נתוני דוגמה — ציוד
-- =============================================
insert into equipment (name, quantity, location, notes) values
  ('פרזנל ספוטים',       '×8',    'מחסן תאורה, מדף 3',     ''),
  ('מיקרופוני רדיו',     '×12',   'חדר צליל, ארון A',       'לבדוק טעינה לפני כל הצגה'),
  ('תלבושות תקופה המלט', '1 סט',  'חדר תלבושות, מוט 2',    ''),
  ('פלטות תפאורה',       '×20',   'מחסן תפאורה, תא 1',     ''),
  ('מערכת הגברה',        '1',     'חדר צליל, ראק B',        ''),
  ('איפור ופרוסתטיקה',   '1 ערכה','חדר הלבשה B2',           'לחדש מלאי');
