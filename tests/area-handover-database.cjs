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

  for(const f of ['supabase-fix-assignments.sql','supabase-fix-cleaning-evaluations.sql','supabase-centro-operation.sql','supabase-operation-calendar.sql','supabase-centro-activity-hierarchy.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  await db.exec(`create function work_branch(person text,day date) returns text language sql stable security definer as $$select coalesce((select w->>'location' from app_state s cross join lateral jsonb_array_elements(s.value)w where s.key='xoxo.workLocations' and w->>'employeeId'=person and w->>'date'=day::text limit 1),(select branch from profiles where employee_number=person))$$;select set_config('test.clock','2026-11-06 08:09:00',false);`);
  await db.exec(fs.readFileSync('supabase-weekly-permissions.sql','utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp"));
  await db.exec(`update app_state set value='[{"id":"015","name":"Citlali","shift":"B"},{"id":"008","name":"Sabina","shift":"A"},{"id":"005","name":"Daniel","shift":"A"},{"id":"011","name":"Ruben","shift":"B"}]' where key='xoxo.collaborators';insert into app_state(key,value) values('xoxo.shiftConfigs','[{"key":"A","start":"08:00","end":"17:30"},{"key":"B","start":"08:00","end":"19:00"}]'),('xoxo.cleaningRole','[{"branch":"Matriz","activity":"Barrer atrás","start":"08:10","end":"08:30","details":"Barrer toda la zona","assignments":{"Viernes":"Citlali"}}]');insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values('cit','015','Matriz','2026-11-06','{"employeeId":"015","date":"2026-11-06","in":"08:00"}',auth.uid()),('dan','005','Sucursal Centro','2026-11-06','{"employeeId":"005","date":"2026-11-06","in":"08:00"}',auth.uid()),('rub','011','Sucursal Centro','2026-11-06','{"employeeId":"011","date":"2026-11-06","in":"08:00"}',auth.uid());grant usage on schema public,auth to authenticated;`);
  const migration=fs.readFileSync('supabase-cleaning-deadline.sql','utf8').replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");await db.exec(migration);await db.exec(migration);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const clock=async value=>db.query("select set_config('test.clock',$1,false)",[value]);
  const context=async()=> (await db.query("select cleaning_deadline_context('2026-11-06') c")).rows[0].c;
  const action=async(a,phase=null,photo=null)=>(await db.query('select cleaning_run_action($1,$2,$3,$4) c',['Aseo-Barrer atrás',a,phase,photo===null?null:JSON.stringify(photo)])).rows[0].c;

  await db.exec('reset role');await db.exec(fs.readFileSync('supabase-daily-agenda-policy.sql','utf8').match(/create or replace function cleaning_exit_time[\s\S]*?\$\$;/)[0]);await db.exec(fs.readFileSync('supabase-fix-task-schedule.sql','utf8'));await db.exec("insert into daily_task_records(record_id,employee_number,branch,record_date,payload,updated_by) values('existing-final-block','015','Matriz','2026-11-06','{\"employeeId\":\"015\",\"date\":\"2026-11-06\",\"start\":\"17:00\",\"end\":\"19:00\",\"status\":\"Pendiente\"}',auth.uid())");const freeze=s=>s.replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");
  await db.exec(freeze(fs.readFileSync('supabase-area-handover.sql','utf8')));await db.exec(freeze(fs.readFileSync('supabase-area-handover.sql','utf8')));
  const handover=async()=>(await db.query('select area_handover_context() c')).rows[0].c;
  await who(15);let ctx=await handover();let task=ctx.tasks.find(t=>t.employeeId==='015');assert.equal(task.start,'18:55');assert.equal(task.end,'19:00');assert.equal(task.requiresPhoto,true);assert.equal(ctx.tasks.length,1);
  const update=async patch=>db.query('update daily_task_records set payload=payload||$1::jsonb,updated_by=auth.uid() where record_id=$2',[JSON.stringify(patch),task.id]);
  await assert.rejects(update({status:'En proceso',startedAt:'2026-11-06T14:00:00Z',start:'00:00'}),/cinco minutos/);
  await db.exec('reset role');await db.exec(`update app_state set value='[{"employeeId":"015","date":"2026-11-06","location":"Matriz","end":"18:00"}]' where key='xoxo.workLocations'`);await who(15);ctx=await handover();task=ctx.tasks[0];assert.equal(task.start,'17:55');
  await clock('2026-11-06 17:55:00');await update({status:'En proceso',startedAt:'2026-11-06T23:55:00Z'});
  await assert.rejects(update({status:'Completada',completedAt:'2026-11-06T23:56:00Z',requiresPhoto:false}),/requiere fotos/);
  const evidence={dataUrl:'data:image/jpeg;base64,YWJj',capturedAt:'2026-11-06T23:55:30Z'};
  await assert.rejects(update({status:'Completada',beforeEvidenceCapture:evidence,afterEvidenceCapture:{...evidence,capturedAt:'2026-11-05T23:55:30Z'}}),/jornada/);
  await clock('2026-11-06 17:59:00');await update({status:'Completada',completedAt:'2026-11-06T23:59:00Z',beforeEvidenceCapture:evidence,afterEvidenceCapture:evidence});task=(await handover()).tasks[0];assert.equal(task.approvalStatus,'Pendiente');assert.ok(task.completedAt);
  await handover();assert.equal((await handover()).tasks.length,1);
  await who(3);ctx=await handover();assert.ok(ctx.tasks.every(t=>!['003','005','007','013','014'].includes(t.employeeId)));assert.ok(ctx.tasks.some(t=>t.employeeId==='011'));assert.equal(ctx.tasks.find(t=>t.employeeId==='015').status,'Completada');
  await db.exec('reset role');await clock('2026-11-07 10:00:00');await db.exec(`update app_state set value='[{"id":"015","shift":"A","weekdayShiftEnds":{"6":"18:00"}},{"id":"008","shift":"A"},{"id":"011","shift":"B"}]' where key='xoxo.collaborators'`);await who(15);task=(await handover()).tasks[0];assert.equal(task.date,'2026-11-07');assert.equal(task.start,'17:55');assert.equal(task.status,'Pendiente');assert.equal(task.beforeEvidenceCapture,undefined);
  await who(8);assert.equal((await handover()).tasks.length,0,'Sabina rests Saturday');
  await db.exec('reset role');assert.equal((await db.query("select count(*) n from daily_task_records where record_date='2026-11-06' and employee_number='015' and record_id like 'area-handover-%'")).rows[0].n,1);
  console.log('PASS: daily per-head handover, stores, configured/day exit changes, five-minute gate, photo enforcement, previous day evidence denied, validation pending, idempotence, rest days and preserved history');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
