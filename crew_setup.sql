-- טבלת אנשי צוות (ללא קשר לחשבון משתמש)
create table if not exists crew_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text,
  dept text,
  phone text,
  email text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table crew_members enable row level security;
create policy "auth_all_crew" on crew_members for all using (auth.role() = 'authenticated');

-- טבלת שיוך צוות לאירועים
create table if not exists event_crew (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  crew_member_id uuid references crew_members(id) on delete cascade,
  note text,
  created_at timestamptz default now(),
  unique(event_id, crew_member_id)
);

alter table event_crew enable row level security;
create policy "auth_all_event_crew" on event_crew for all using (auth.role() = 'authenticated');

-- עמודת הערות לאירועים (אם לא קיימת)
alter table events add column if not exists crew_notes text;
