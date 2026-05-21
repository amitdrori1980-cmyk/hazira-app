create table if not exists production_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  date date,
  day text,
  venue text,
  created_at timestamptz default now()
);

create table if not exists production_people (
  id uuid primary key default gen_random_uuid(),
  production_event_id uuid references production_events(id) on delete cascade,
  name text not null,
  status text default 'white',
  notes text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table production_events enable row level security;
alter table production_people enable row level security;

create policy "auth_all_production_events" on production_events for all using (auth.role() = 'authenticated');
create policy "auth_all_production_people" on production_people for all using (auth.role() = 'authenticated');
