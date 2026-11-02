-- Run once in Supabase SQL Editor on a fresh project.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  role text not null default 'executive' check (role in ('executive', 'manager')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'Team member'), 100), 'executive');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Covers users created before the migration. Never trust a role from user metadata.
insert into public.profiles(id, display_name)
select id, left(coalesce(nullif(raw_user_meta_data->>'display_name', ''), 'Team member'), 100)
from auth.users on conflict (id) do nothing;

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (char_length(reference) between 3 and 40 and reference ~ '^[A-Za-z0-9_-]+$'),
  supplier text not null check (char_length(trim(supplier)) between 2 and 160),
  created_by uuid not null references public.profiles(id),
  status text not null default 'draft' check (status in ('draft','processing','needs_review')),
  created_at timestamptz not null default now()
);
create index shipments_owner_idx on public.shipments(created_by);
create index shipments_created_idx on public.shipments(created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  kind text not null check (kind in ('invoice','packing_list','bill_of_lading')),
  filename text not null check (char_length(filename) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(shipment_id, kind),
  check (storage_path like 'shipments/' || shipment_id::text || '/%')
);
create index documents_shipment_idx on public.documents(shipment_id);

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  model text not null,
  status text not null check (status in ('processing','completed','failed')),
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or result is not null)
);
create unique index one_active_extraction_per_document on public.extraction_runs(document_id) where status = 'processing';
create index extraction_document_time_idx on public.extraction_runs(document_id, created_at desc);

create function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'manager');
$$;
create function public.can_access_shipment(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.shipments where id = target_id
    and (created_by = (select auth.uid()) or public.is_manager()));
$$;
revoke all on function public.is_manager() from public;
revoke all on function public.can_access_shipment(uuid) from public;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.can_access_shipment(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.shipments enable row level security;
alter table public.documents enable row level security;
alter table public.extraction_runs enable row level security;

-- Reset Supabase default privileges explicitly. Internal AI writes use the server secret key.
revoke all on public.profiles, public.shipments, public.documents, public.extraction_runs from anon, authenticated;
grant select on public.profiles, public.shipments, public.documents, public.extraction_runs to authenticated;
grant insert(id, reference, supplier, created_by) on public.shipments to authenticated;
grant insert(id, shipment_id, kind, filename, storage_path, mime_type, size_bytes, created_by) on public.documents to authenticated;
grant all on public.profiles, public.shipments, public.documents, public.extraction_runs to service_role;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_manager());
create policy shipments_read on public.shipments for select to authenticated using (created_by = (select auth.uid()) or public.is_manager());
create policy shipments_create on public.shipments for insert to authenticated with check (created_by = (select auth.uid()) and status = 'draft');
create policy documents_read on public.documents for select to authenticated using (public.can_access_shipment(shipment_id));
create policy documents_create on public.documents for insert to authenticated with check (created_by = (select auth.uid()) and public.can_access_shipment(shipment_id));
create policy extractions_read on public.extraction_runs for select to authenticated using (exists(select 1 from public.documents d where d.id = document_id and public.can_access_shipment(d.shipment_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('shipment-documents','shipment-documents',false,10485760,array['application/pdf','image/jpeg','image/png']);

-- CASE protects the UUID cast from invalid or hostile object paths.
create function public.can_access_document_path(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when object_name ~ '^shipments/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    then public.can_access_shipment(split_part(object_name, '/', 2)::uuid) else false end;
$$;
revoke all on function public.can_access_document_path(text) from public;
grant execute on function public.can_access_document_path(text) to authenticated;
create policy documents_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'shipment-documents' and public.can_access_document_path(name));
create policy documents_storage_create on storage.objects for insert to authenticated
  with check (bucket_id = 'shipment-documents' and public.can_access_document_path(name));
-- Allow cleanup of an upload only when its document record was not saved.
create policy documents_storage_cleanup on storage.objects for delete to authenticated
  using (bucket_id = 'shipment-documents' and owner_id = (select auth.uid())::text
    and public.can_access_document_path(name)
    and not exists(select 1 from public.documents d where d.storage_path = name));

-- Serializes per-shipment status updates, including concurrent extraction attempts.
create function public.sync_extraction_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  select shipment_id into target_id from public.documents where id = new.document_id;
  perform 1 from public.shipments where id = target_id for update;
  update public.shipments set status = case
    when exists(select 1 from public.extraction_runs r join public.documents d on d.id = r.document_id
      where d.shipment_id = target_id and r.status = 'processing') then 'processing'
    when exists(select 1 from public.documents d join lateral (
      select r.status from public.extraction_runs r where r.document_id = d.id order by r.created_at desc limit 1
    ) latest on true where d.shipment_id = target_id and latest.status = 'completed') then 'needs_review'
    else 'draft' end
  where id = target_id;
  return new;
end;
$$;
create trigger extraction_status_changed after insert or update of status on public.extraction_runs
for each row execute procedure public.sync_extraction_status();
revoke all on function public.handle_new_user() from public;
revoke all on function public.sync_extraction_status() from public;

commit;
