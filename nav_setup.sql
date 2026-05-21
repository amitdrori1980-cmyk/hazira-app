-- טבלת פריטי תפריט
create table if not exists nav_items (
  id uuid primary key default gen_random_uuid(),
  href text not null unique,
  icon text not null,
  label text not null,
  manager_only boolean default false,
  sort_order int default 0,
  enabled boolean default true,
  created_at timestamptz default now()
);

alter table nav_items enable row level security;
create policy "auth_read_nav" on nav_items for select using (auth.role() = 'authenticated');
create policy "auth_all_nav"  on nav_items for all    using (auth.role() = 'authenticated');

-- פריטי ברירת מחדל
insert into nav_items (href, icon, label, manager_only, sort_order, enabled) values
  ('/dashboard',             'ti-layout-dashboard', 'סקירה אישית',  false, 1,  true),
  ('/dashboard/calendar',   'ti-calendar-month',   'יומן',          false, 2,  true),
  ('/dashboard/tasks',      'ti-checkbox',         'משימות שלי',    false, 3,  true),
  ('/dashboard/equipment',  'ti-tool',             'ציוד',          false, 4,  true),
  ('/dashboard/messages',   'ti-bell',             'הודעות',        false, 5,  true),
  ('/dashboard/team',       'ti-users',            'צוות',          true,  6,  true),
  ('/dashboard/events',     'ti-calendar-plus',    'ניהול אירועים', true,  7,  true),
  ('/dashboard/departments','ti-building',         'מחלקות',        true,  8,  true)
on conflict (href) do nothing;
