create table if not exists crew_constraints (
  id uuid primary key default gen_random_uuid(),
  crew_member_id uuid references crew_members(id) on delete cascade,
  crew_name text, -- fallback if no match
  date date not null,
  hours text,
  notes text,
  available boolean default false, -- false = not available
  created_at timestamptz default now()
);

alter table crew_constraints enable row level security;
create policy "auth_all_constraints"
  on crew_constraints for all
  using (auth.role() = 'authenticated');
