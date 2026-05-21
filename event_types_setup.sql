create table if not exists event_types (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,
  label text not null,
  color text not null default 'bg-[#FDEAEA] text-[#8B0000]',
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table event_types enable row level security;
create policy "auth_read_event_types" on event_types for select using (auth.role() = 'authenticated');
create policy "auth_all_event_types"  on event_types for all    using (auth.role() = 'authenticated');

insert into event_types (value, label, color, sort_order) values
  ('rehearsal', 'חזרה',   'bg-[#FDEAEA] text-[#8B0000]', 1),
  ('show',      'הצגה',   'bg-[#E1F5EE] text-[#085041]', 2),
  ('crew',      'צוות',   'bg-[#FAEEDA] text-[#633806]', 3),
  ('technical', 'טכני',   'bg-[#FAECE7] text-[#4A1B0C]', 4)
on conflict (value) do nothing;
