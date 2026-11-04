import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const users = {
  first: '11111111-1111-4111-8111-111111111111',
  second: '22222222-2222-4222-8222-222222222222',
  manager: '33333333-3333-4333-8333-333333333333',
};
const firstShipment = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondShipment = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let db: PGlite;

async function asUser<T>(id: string, action: () => Promise<T>) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    await db.exec('set local role authenticated');
    const result = await action();
    await db.exec('commit');
    return result;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to authenticated, service_role;
    grant select, insert, delete on storage.objects to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  const migration = await readFile(new URL('../supabase/migrations/202611020001_day_one.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(await readFile(new URL('../supabase/migrations/202611050001_shipment_approvals.sql', import.meta.url), 'utf8'));
  for (const id of Object.values(users)) await db.query('insert into auth.users(id) values ($1)', [id]);
  await db.query("update public.profiles set role = 'manager' where id = $1", [users.manager]);
  await db.query("insert into public.shipments(id,reference,supplier,created_by) values ($1,'SHP-ONE','Supplier B',$2),($3,'SHP-TWO','Supplier C',$4)", [firstShipment, users.first, secondShipment, users.second]);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values ('shipment-documents',$1,$2),('shipment-documents',$3,$4)", [`shipments/${firstShipment}/invoice.pdf`,users.first,`shipments/${secondShipment}/invoice.pdf`,users.second]);
}, 30000);

afterAll(async () => { await db?.close(); });

describe('database migration and real PostgreSQL access policies', () => {
  it('executive sees only their own shipment', async () => {
    const result = await asUser(users.first, () => db.query<{ reference: string }>('select reference from public.shipments'));
    expect(result.rows).toEqual([{ reference: 'SHP-ONE' }]);
  });
  it('manager sees both executive shipments', async () => {
    const result = await asUser(users.manager, () => db.query('select reference from public.shipments order by reference'));
    expect(result.rows).toHaveLength(2);
  });
  it('users cannot promote their own role', async () => {
    await expect(asUser(users.first, () => db.query("update public.profiles set role = 'manager' where id = $1", [users.first]))).rejects.toThrow(/permission denied/i);
  });
  it('executive cannot create a shipment for someone else', async () => {
    await expect(asUser(users.first, () => db.query("insert into public.shipments(reference,supplier,created_by) values ('SHP-SPOOF','Supplier',$1)", [users.second]))).rejects.toThrow(/row-level security/i);
  });
  it('users cannot bypass the backend and change processing status', async () => {
    await expect(asUser(users.first, () => db.query("update public.shipments set status = 'needs_review' where id = $1", [firstShipment]))).rejects.toThrow(/permission denied/i);
  });
  it('users cannot overwrite AI extraction results', async () => {
    await expect(asUser(users.first, () => db.query("update public.extraction_runs set result = '{}'"))).rejects.toThrow(/permission denied/i);
  });
  it('private storage reads are limited to accessible shipment paths', async () => {
    const result = await asUser(users.first, () => db.query<{ name: string }>('select name from storage.objects'));
    expect(result.rows).toEqual([{ name: `shipments/${firstShipment}/invoice.pdf` }]);
  });
  it('invalid storage paths return false without UUID cast errors', async () => {
    const result = await asUser(users.first, () => db.query<{ allowed: boolean }>("select public.can_access_document_path('shipments/not-a-uuid/private.pdf') as allowed"));
    expect(result.rows[0].allowed).toBe(false);
  });
  it('new users always become executives even if metadata claims manager', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    await db.query("insert into auth.users(id,raw_user_meta_data) values ($1,'{\"role\":\"manager\"}')", [id]);
    const result = await db.query<{ role: string }>('select role from public.profiles where id=$1',[id]);
    expect(result.rows[0].role).toBe('executive');
  });
});

it('only managers can record decisions and only shipment viewers can read them', async () => {
  const insert = 'insert into public.shipment_decisions(shipment_id, revision, decision, note, decided_by) values ($1,$2,$3,$4,$5)';
  const revision = 'a'.repeat(64);
  await expect(asUser(users.first, () => db.query(insert, [firstShipment, revision, 'approved', '', users.first]))).rejects.toThrow(/row-level security/i);
  await expect(asUser(users.manager, () => db.query(insert, [firstShipment, revision, 'approved', '', users.first]))).rejects.toThrow(/row-level security/i);
  await asUser(users.manager, () => db.query(insert, [firstShipment, revision, 'approved', '', users.manager]));
  expect((await asUser(users.first, () => db.query('select decision from public.shipment_decisions'))).rows).toEqual([{ decision: 'approved' }]);
  expect((await asUser(users.second, () => db.query('select decision from public.shipment_decisions'))).rows).toEqual([]);
});