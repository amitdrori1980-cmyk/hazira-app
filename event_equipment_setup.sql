-- טבלת שיוך ציוד לאירועים
create table if not exists event_equipment (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete cascade,
  quantity_needed text,
  note text,
  created_at timestamptz default now(),
  unique(event_id, equipment_id)
);

alter table event_equipment enable row level security;
create policy "auth_all_event_equipment"
  on event_equipment for all
  using (auth.role() = 'authenticated');
