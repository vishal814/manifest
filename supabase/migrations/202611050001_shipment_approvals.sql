create table public.shipment_decisions (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  revision text not null check (revision ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('approved', 'returned')),
  note text not null default '' check (char_length(note) <= 1000 and (decision <> 'returned' or trim(note) <> '')),
  decided_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index shipment_decisions_latest_idx
  on public.shipment_decisions(shipment_id, created_at desc, id desc);

alter table public.shipment_decisions enable row level security;
revoke all on public.shipment_decisions from anon, authenticated;
grant select on public.shipment_decisions to authenticated;
grant insert(shipment_id, revision, decision, note, decided_by) on public.shipment_decisions to authenticated;

create policy shipment_decisions_read on public.shipment_decisions for select to authenticated
  using (public.can_access_shipment(shipment_id));
create policy shipment_decisions_manager_insert on public.shipment_decisions for insert to authenticated
  with check (public.is_manager() and decided_by = (select auth.uid()));
