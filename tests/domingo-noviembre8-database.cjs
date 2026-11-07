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


 await db.exec('reset role');await clock('2026-11-07 10:00:00');const freeze=s=>s.replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");
 await db.exec(freeze(fs.readFileSync('supabase-weekly-reports.sql','utf8')));
 await db.exec(freeze(fs.readFileSync('supabase-area-handover.sql','utf8')));
 await db.exec(freeze(fs.readFileSync('supabase-assigned-task-workflow.sql','utf8')));await db.exec(freeze(fs.readFileSync('supabase-assigned-task-workflow.sql','utf8')));
 await db.exec(freeze(fs.readFileSync('domingo-2026-11-08.sql','utf8')));await db.exec(freeze(fs.readFileSync('domingo-2026-11-08.sql','utf8')));
 assert.equal((await db.query("select count(*) n from daily_task_records where record_date='2026-11-08'")).rows[0].n,16);
 assert.equal((await db.query("select work_branch('011','2026-11-08') b")).rows[0].b,'Matriz');assert.equal((await db.query("select work_branch('011','2026-11-09') b")).rows[0].b,'Sucursal Centro');
 assert.equal((await db.query("select cleaning_exit_time('011','2026-11-08') t")).rows[0].t,'15:00');
 assert.equal((await db.query("select staff_is_rest('015','2026-11-08') r")).rows[0].r,false);assert.equal((await db.query("select staff_is_rest('015','2026-11-09') r")).rows[0].r,true);assert.equal((await db.query("select staff_is_rest('015','2026-11-01') r")).rows[0].r,true);
 assert.equal((await db.query("select weekly_report_dates('015','2026-11-08') d")).rows[0].d.some(d=>d.due==='2026-11-08'),true);
 const change=async(id,patch)=>db.query('update daily_task_records set payload=payload||$1::jsonb,updated_by=auth.uid() where record_id=$2',[JSON.stringify(patch),id]);
 const dependencyContext=async()=>(await db.query('select assigned_task_dependency_context() c')).rows[0].c;
 await clock('2026-11-08 10:50:00');await who(7);await assert.rejects(change('domingo-2026-11-08-007-1',{status:'En proceso',startedAt:'2026-11-08T16:50:00Z'}),/etapa anterior/);assert.equal((await dependencyContext())[0].ready,false);assert.equal((await dependencyContext()).length,1);
 await who(8);await assert.rejects(change('domingo-2026-11-08-008-2',{status:'Completada',completedAt:'2026-11-08T16:50:00Z',deliveryNote:'Recibido completo, sin incidencias.'}),/revisión física/);await change('domingo-2026-11-08-008-2',{status:'Completada',completedAt:'2026-11-08T16:50:00Z',deliveryNote:'Recibido completo, sin incidencias.',reviewConfirmed:true});
 await who(7);assert.equal((await dependencyContext())[0].ready,true);await assert.rejects(change('domingo-2026-11-08-007-1',{status:'Completada',completedAt:'2026-11-08T17:20:00Z',deliveryNote:'Factura ingresada y precios revisados.'}),/folio/);await change('domingo-2026-11-08-007-1',{status:'Completada',completedAt:'2026-11-08T17:20:00Z',deliveryNote:'Factura ingresada y precios revisados.',invoiceReference:'LUMMI-123',pricesConfirmed:true});
 await who(8);assert.equal((await dependencyContext()).find(t=>t.taskId==='domingo-2026-11-08-008-3').ready,true);await assert.rejects(change('domingo-2026-11-08-008-3',{status:'Completada',completedAt:'2026-11-08T19:20:00Z',deliveryNote:'Mercancía acomodada y etiquetada.',exhibitedQuantity:'79',storedQuantity:'21'}),/80%/);await change('domingo-2026-11-08-008-3',{status:'Completada',completedAt:'2026-11-08T19:20:00Z',deliveryNote:'Mercancía acomodada y etiquetada.',exhibitedQuantity:'80',storedQuantity:'20'});
 await assert.rejects(change('domingo-2026-11-08-008-4',{status:'Completada',completedAt:'2026-11-08T21:00:00Z',deliveryNote:'Dos productos listos con precio y solución.',demoProduct1:'Mismo producto',demoProduct2:'Mismo producto'}),/dos productos distintos/);await change('domingo-2026-11-08-008-4',{status:'Completada',completedAt:'2026-11-08T21:00:00Z',deliveryNote:'Dos productos listos con precio y solución.',demoProduct1:'Lámpara: iluminar espacio',demoProduct2:'Sensor: encendido automático'});
 await who(11);assert.equal((await dependencyContext()).length,0,'No workflow details of other collaborators');
 console.log('PASS: 16 Sunday tasks, one-day Ruben transfer, 09–15 exit, Citlali Monday rest and preserved prior rest history, Sunday weekly report, team dependency gating/notifications, invoice/prices, enforced 80/20 and two distinct demonstrations');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
