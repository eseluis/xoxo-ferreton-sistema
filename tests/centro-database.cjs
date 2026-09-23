const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user', true),'')::uuid $$;
    create table public.profiles(user_id uuid,employee_number text,display_name text,role text,branch text,active boolean default true);
    create table public.app_state(key text primary key,value jsonb,updated_by uuid,updated_at timestamptz default now());
    create table public.attendance_records(payload jsonb);
    insert into profiles values ('00000000-0000-0000-0000-000000000003','003','Supervisor','GERENTE_GENERAL','Matriz',true),
      ('00000000-0000-0000-0000-000000000101','101','Auxiliar A','AUXILIAR','Sucursal Centro',true),
      ('00000000-0000-0000-0000-000000000102','102','Auxiliar B','AUXILIAR','Sucursal Centro',true),
      ('00000000-0000-0000-0000-000000000103','103','Matriz','AUXILIAR','Matriz',true);
  `);
  const migration = fs.readFileSync('supabase-centro-operation.sql','utf8');
  await db.exec(migration);
  await db.exec(migration); // reapplying must be safe
  const { rows:[{day}] } = await db.query("select (now() at time zone 'America/Mexico_City')::date::text as day");
  const who = async n => db.exec(`select set_config('test.user','00000000-0000-0000-0000-${String(n).padStart(12,'0')}',false)`);
  const call = async (task, version, action, data={}, note='') => (await db.query('select centro_update_task($1::date,$2,$3::integer,$4,$5::jsonb,$6) as result',[day,task,version,action,JSON.stringify(data),note])).rows[0].result;
  await who(3);
  for (const id of ['101','102']) {
    await db.query("select centro_assign_day($1,$2::date,'Sucursal Centro','00:00','23:59')",[id,day]);
    await db.query('insert into attendance_records values ($1::jsonb)',[JSON.stringify({employeeId:id,date:day,in:'00:00'})]);
  }
  await who(103);
  await assert.rejects(()=>db.query('select centro_context($1::date)',[day]),/No estás asignado/);
  await assert.rejects(()=>call('experiencia',0,'start'),/presente/);
  await who(101);
  let context=(await db.query('select centro_context($1::date) as result',[day])).rows[0].result;
  assert.equal(context.roster.length,2);
  assert.equal(context.roster.filter(p=>p.present).length,2);
  let rec = await call('experiencia',0,'start'); assert.equal(rec.status,'En curso');
  await assert.rejects(()=>call('experiencia',0,'save'),/Otro usuario/);
  await assert.rejects(()=>call('experiencia',1,'approve'),/Solo dirección/);
  await assert.rejects(()=>call('experiencia',1,'submit'),/Falta/);
  rec=await call('experiencia',1,'pause',{mejora:'Etiquetas',solucion:'Precios legibles'},'Cliente');
  assert.equal(rec.status,'Pausada');
  rec=await call('experiencia',2,'resume',rec.data);
  rec=await call('experiencia',3,'submit',rec.data); assert.equal(rec.status,'Por validar');
  await who(3);
  await assert.rejects(()=>call('experiencia',4,'reject',{},''),/motivo/);
  rec=await call('experiencia',4,'reject',{},'Falta aclarar la mejora'); assert.equal(rec.status,'Corrección');
  await who(101);
  rec=await call('experiencia',5,'submit',{mejora:'Colocadas diez etiquetas',solucion:'Precios legibles'});
  await who(3); rec=await call('experiencia',6,'approve'); assert.equal(rec.status,'Validada');
  await who(101);
  await assert.rejects(()=>call('experiencia',7,'save'),/cerrada/);
  await assert.rejects(()=>call('apertura',0,'submit'),/apertura/);
  await assert.rejects(()=>call('inventario-1',0,'submit'),/25/);
  const proposal={propuesta:'Visitar talleres cercanos',herramientas:'QR WhatsApp',metaContactos:5};
  await assert.rejects(()=>call('trafico-1',0,'start'),/Antes de prospectar/);
  const first=await call('trafico-1',0,'start',proposal); assert.equal(first.data.mode,'Exterior');
  await who(102);
  await assert.rejects(()=>call('trafico-2',0,'start',proposal),/afuera/);
  await assert.rejects(()=>call('trafico-1',1,'save'),/otro colaborador/);
  await db.query("update attendance_records set payload=payload||'{\"out\":\"12:00\"}'::jsonb where payload->>'employeeId'='101'");
  const paused=(await db.query('select centro_context($1::date) as result',[day])).rows[0].result.records.find(r=>r.task_id==='trafico-1');
  assert.equal(paused.status,'Pausada'); assert.equal(paused.data.mode,'Digital / interior');
  const transfer=await call('trafico-1',paused.version,'save',{...proposal,propuesta:'Seguimiento por WhatsApp'});
  assert.equal(transfer.owner_id,'102'); assert.ok(transfer.history.some(h=>h.action==='reassign'));
  // Pausing and resuming after coverage loss must switch to digital.
  const reduced=await call('trafico-1',transfer.version,'resume',transfer.data); assert.equal(reduced.data.mode,'Digital / interior');
  await who(101);
  await assert.rejects(()=>db.query("select centro_assign_day('103',$1::date,'Sucursal Centro','00:00','23:59')",[day]),/Solo dirección/);
  console.log('PASS: PostgreSQL migration, auth, live roster, version conflicts, review, coverage, transfers and reduced mode');
  await db.close();
})().catch(error=>{ console.error(error); process.exitCode=1; });
