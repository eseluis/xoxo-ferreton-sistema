const fs=require('node:fs');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
   create table auth.users(id uuid primary key);
   insert into auth.users select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,16)i;
   select set_config('test.clock','2026-11-04 10:15:00',false);`);
  for(const f of ['supabase-setup.sql','supabase-stage2-modules.sql','supabase-fix-shared-sync.sql'])await db.exec(fs.readFileSync(f,'utf8').replace('create extension if not exists pgcrypto;',''));
  await db.exec(`insert into profiles(user_id,employee_number,display_name,role,branch) values
   ('00000000-0000-0000-0000-000000000003','003','Dirección','GERENTE_GENERAL','Matriz'),
   ('00000000-0000-0000-0000-000000000005','005','Daniel','GERENTE_TIENDA','Sucursal Centro'),
   ('00000000-0000-0000-0000-000000000006','006','Jan','JEFE_AREA','Matriz'),
   ('00000000-0000-0000-0000-000000000007','007','Anubis','CAJERO','Matriz'),
   ('00000000-0000-0000-0000-000000000008','008','Sabina','JEFE_AREA','Matriz'),
   ('00000000-0000-0000-0000-000000000009','009','Julio','JEFE_AREA','Matriz'),
   ('00000000-0000-0000-0000-000000000010','010','Celina','JEFE_AREA','Matriz'),
   ('00000000-0000-0000-0000-000000000011','011','Ruben','JEFE_AREA','Sucursal Centro'),
   ('00000000-0000-0000-0000-000000000013','013','Auxiliar','AUXILIAR','Matriz'),
   ('00000000-0000-0000-0000-000000000014','014','Zalma','AUXILIAR','Matriz'),
   ('00000000-0000-0000-0000-000000000015','015','Citlali','JEFE_AREA','Matriz');
   insert into app_state(key,value) values ('xoxo.collaborators','[{"id":"013","area":"Plomeria","supervisorId":"015"},{"id":"014","area":"Electricidad","supervisorId":"008"}]'),('xoxo.workLocations','[]');
   select set_config('test.user','00000000-0000-0000-0000-000000000003',false);`);

  for(const f of ['supabase-fix-assignments.sql','supabase-fix-cleaning-evaluations.sql','supabase-centro-operation.sql','supabase-operation-calendar.sql','supabase-centro-activity-hierarchy.sql'])await db.exec(fs.readFileSync(f,'utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp"));
  await db.exec(`create function work_branch(person text,day date) returns text language sql stable security definer as $$select coalesce((select w->>'location' from app_state s cross join lateral jsonb_array_elements(s.value)w where s.key='xoxo.workLocations' and w->>'employeeId'=person and w->>'date'=day::text limit 1),(select branch from profiles where employee_number=person))$$;select set_config('test.clock','2026-11-06 08:09:00',false);`);
  await db.exec(fs.readFileSync('supabase-weekly-permissions.sql','utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp"));
  await db.exec(`update app_state set value='[{"id":"015","name":"Citlali","shift":"B"},{"id":"008","name":"Sabina","shift":"A"},{"id":"005","name":"Daniel","shift":"A"},{"id":"011","name":"Ruben","shift":"B"}]' where key='xoxo.collaborators';insert into app_state(key,value) values('xoxo.shiftConfigs','[{"key":"A","start":"08:00","end":"17:30"},{"key":"B","start":"08:00","end":"19:00"}]'),('xoxo.cleaningRole','[{"branch":"Matriz","activity":"Barrer atrás","start":"08:10","end":"08:30","details":"Barrer toda la zona","assignments":{"Viernes":"Citlali"}}]');insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values('cit','015','Matriz','2026-11-06','{"employeeId":"015","date":"2026-11-06","in":"08:00"}',auth.uid()),('dan','005','Sucursal Centro','2026-11-06','{"employeeId":"005","date":"2026-11-06","in":"08:00"}',auth.uid()),('rub','011','Sucursal Centro','2026-11-06','{"employeeId":"011","date":"2026-11-06","in":"08:00"}',auth.uid());grant usage on schema public,auth to authenticated;`);
  const migration=fs.readFileSync('supabase-cleaning-deadline.sql','utf8').replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");await db.exec(migration);await db.exec(migration);
  const planned=fs.readFileSync('supabase-centro-planned-staff.sql','utf8').replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");await db.exec(planned);await db.exec(planned);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const clock=async value=>db.query("select set_config('test.clock',$1,false)",[value]);
  const context=async()=> (await db.query("select cleaning_deadline_context('2026-11-06') c")).rows[0].c;
  const action=async(a,phase=null,photo=null)=>(await db.query('select cleaning_run_action($1,$2,$3,$4) c',['Aseo-Barrer atrás',a,phase,photo===null?null:JSON.stringify(photo)])).rows[0].c;
  await who(15);let c=await context();assert.equal(c.gates.length,1);assert.equal(c.gates[0].blocked,true);assert.equal(c.gates[0].exitTime,'19:00');await assert.rejects(action('start'),/08:10/);
  await clock('2026-11-06 08:10:00');let r=await action('start');assert.equal(r.status,'En curso');assert.equal(Date.parse(r.startedAt),Date.parse('2026-11-06T14:10:00Z'));
  const photo={dataUrl:'data:image/jpeg;base64,YWJj',capturedAt:'1900-01-01T00:00:00Z'};await action('photo','before',photo);
  await clock('2026-11-06 08:30:01');c=await context();r=c.gates[0].run;assert.equal(c.gates[0].blocked,true);assert.equal(r.status,'Pausada');assert.equal(Date.parse(r.pausedAt),Date.parse('2026-11-06T14:30:00Z'));assert.equal(r.beforeEvidenceCapture.dataUrl,photo.dataUrl);
  await assert.rejects(action('complete'),/19:00/);await assert.rejects(action('start'),/19:00/);await assert.rejects(db.query("update activity_run_records set payload=payload||'{\"completedAt\":\"2026-11-06T14:20:00Z\"}'"),/control de horario/);
  await clock('2026-11-06 17:30:00');assert.equal((await context()).gates[0].blocked,true);
  await db.exec(`reset role;update app_state set value='[{"employeeId":"015","date":"2026-11-06","location":"Matriz","start":"08:00","end":"17:30"}]' where key='xoxo.workLocations';`);await who(15);assert.equal((await context()).gates[0].blocked,false);
  r=await action('start');assert.ok(r.cleaningRecoveryStartedAt);assert.equal(r.pausedMinutes,540);
  await assert.rejects(action('complete'),/Faltan/);await action('photo','after',photo);await clock('2026-11-06 17:40:00');r=await action('complete');assert.equal(r.status,'Completada con retraso');assert.equal(r.onTime,false);assert.equal(Date.parse(r.completedAt),Date.parse('2026-11-06T23:40:00Z'));assert.deepEqual(await action('complete'),r);
  // Unknown employee cannot use another person's assignment.
  await who(8);await assert.rejects(action('start'),/no asignado/);
  // Centro keeps canonical ownership after shift end and allows recovery through the same process.
  await clock('2026-11-06 09:10:00');await who(5);c=(await db.query("select centro_context('2026-11-06') c")).rows[0].c;const own=c.records.find(r=>r.owner_id==='005'&&r.task_id.startsWith('aseo-'));assert.ok(own);
  const ca=async(a,version,data={})=>(await db.query("select centro_update_task('2026-11-06',$1,$2,$3,$4,'') c",[own.task_id,version,a,JSON.stringify(data)])).rows[0].c;
  r=await ca('start',own.version);await clock('2026-11-06 09:31:00');c=(await db.query("select centro_context('2026-11-06') c")).rows[0].c;r=c.records.find(x=>x.task_id===own.task_id);assert.equal(r.status,'Pausada');assert.equal(c.cleaningGates.find(g=>g.taskId===own.task_id).blocked,true);
  await assert.rejects(ca('resume',r.version,r.data),/17:30/);
  await clock('2026-11-06 17:30:00');c=(await db.query("select centro_context('2026-11-06') c")).rows[0].c;assert.equal(c.assignments.find(a=>a.taskId===own.task_id).ownerId,'005');r=c.records.find(x=>x.task_id===own.task_id);r=await ca('resume',r.version,r.data);assert.equal(r.status,'En curso');
  c=(await db.query("select centro_context('2026-11-06') c")).rows[0].c;r=c.records.find(x=>x.task_id===own.task_id);assert.equal(r.status,'En curso');
  r=await ca('submit',r.version,{...r.data,fotoAntes:photo.dataUrl,fotoDespues:photo.dataUrl,realizado:true});assert.equal(r.status,'Por validar');assert.equal(r.data.cleaningOnTime,false);assert.ok(r.history.some(h=>h.note.includes('Horario de aseo vencido')));

  // Attendance remains usable: its trigger can pause Centro without bypassing the controlled writes.
  await db.exec(`reset role;update attendance_records set payload=payload||'{"lunchOut":"17:30"}' where employee_number='011';`);await who(15);
  await assert.rejects(db.query("delete from activity_run_records where employee_number='015'"),/historial/);
  await db.exec(`reset role;insert into activity_run_records(record_id,employee_number,branch,record_date,payload,updated_by) values('normal','015','Matriz','2026-11-06','{"itemType":"Actividad","itemId":"venta","status":"Pendiente"}',auth.uid());`);await who(15);await db.exec(`update activity_run_records set payload=payload||'{"status":"En curso"}' where record_id='normal';`);
  // The recovery never earns punctuality points in the current weekly report.
  await clock('2026-11-06 17:45:00');const report=(await db.query("select staff_permission_context('015') c")).rows[0].c.report;assert.equal(report.cleaningEarned,1);
  await db.exec(`reset role;select set_config('test.clock','2026-11-06 09:20:00',false);update app_state set value='[{"key":"A","start":"08:00","end":"17:30"},{"key":"B","start":"09:30","end":"19:00"}]' where key='xoxo.shiftConfigs';`);
  const future=(await db.query("select centro_task_assignments('2026-11-06') a")).rows[0].a;
  assert.ok(future.some(a=>a.ownerId==='011'&&a.taskId==='cierre'));
  assert.ok(future.some(a=>a.ownerId==='011'&&a.taskId.startsWith('inventario-')));
  assert.ok((await db.query("select centro_roster('2026-11-06') r")).rows[0].r.some(p=>p.id==='011'&&p.arrived&&!p.present));
  await db.exec(`update app_state set value='[]' where key='xoxo.workLocations';update app_state set value=(select jsonb_agg(c||jsonb_build_object('branch',p.branch)) from jsonb_array_elements(value)c join profiles p on p.employee_number=c->>'id') where key='xoxo.collaborators';`);
  const centroShift=fs.readFileSync('supabase-centro-work-shift.sql','utf8').replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");await db.exec(centroShift);await db.exec(centroShift);
  const fixedRoster=(await db.query("select centro_roster('2026-11-06') r")).rows[0].r;
  assert.ok(fixedRoster.every(p=>p.start==='08:45'&&p.end==='18:00'));
  assert.ok(fixedRoster.some(p=>p.id==='011'&&p.start==='08:45'));
  assert.equal((await db.query("select cleaning_exit_time('011','2026-11-06') t")).rows[0].t,'18:00');
  console.log('PASS aseo: ventana configurada, pausa automática, bloqueo servidor, reactivación a salida A/B y cambio diario, fotos, tiempos reales, Centro canónico y recuperación tardía');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message,e.where,e.internalQuery,e.position);process.exitCode=1;});

