alter table messages add column if not exists to_crew_id uuid references crew_members(id) on delete set null;
