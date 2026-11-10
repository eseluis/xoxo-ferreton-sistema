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

  for(const f of ['supabase-fix-assignments.sql','supabase-fix-cleaning-evaluations.sql','supabase-centro-operation.sql','supabase-operation-calendar.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  await db.exec(`create function work_branch(person text,day date) returns text language sql stable security definer as $$select branch from profiles where employee_number=person$$;select set_config('test.clock','2026-11-06 10:15:00',false);`);
  const sql=fs.readFileSync('supabase-weekly-permissions.sql','utf8').replaceAll("now()","(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");await db.exec(sql);await db.exec(sql);
  const lockFix=fs.readFileSync('supabase-fix-cycle-lock-order.sql','utf8');await db.exec(lockFix);await db.exec(lockFix);
  assert.match((await db.query("select pg_get_functiondef('staff_close_cycles(text)'::regprocedure) d")).rows[0].d,/staff_lock_cycle_set\(person\)/);
  assert.match((await db.query("select pg_get_functiondef('staff_lock_cycle_set(text)'::regprocedure) d")).rows[0].d,/order by 1/);

  await db.exec(`grant usage on schema public,auth to authenticated;`);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const ctx=async target=>(await db.query('select staff_permission_context($1) c',[target??null])).rows[0].c;
  await who(8);let c=await ctx();assert.equal(c.cycle.start,'2026-11-06');assert.equal(c.cycle.end,'2026-11-07');assert.equal(c.cycle.restDay,6);assert.equal(c.supervisorId,'003');
  await assert.rejects(ctx('005'),/Sin permiso/);
  const task={id:'t1',employeeId:'008',title:'Revisar inventario',date:'2026-11-06',start:'08:00',end:'09:00',status:'Completada',completedAt:'2026-11-06T15:00:00Z',approvalStatus:'Aprobada',validatedById:'008'};
  await db.exec('reset role');await db.query("insert into daily_task_records(record_id,employee_number,branch,record_date,payload,updated_by) values('t1','008','Matriz','2026-11-06',$1,auth.uid())",[JSON.stringify(task)]);
  await who(8);c=await ctx();assert.equal(c.report.total,1);assert.equal(c.report.validated,0);assert.equal(c.report.percent,0); // self-written approval never counts
  const item=c.report.items[0];assert.equal((await db.query('select staff_activity_proof($1,$2,$3) c',['008',item.key,item.fingerprint])).rows[0].c.title,'Revisar inventario');await assert.rejects(db.query('select staff_review_activity($1,$2,$3,$4)',['008',item.key,item.fingerprint,'Revisada']),/autovalidación/);
  const request=async(kind='Permiso',date='2026-11-06',orig=null,token='first')=>(await db.query('select staff_request_permission($1,$2,$3,$4,$5) id',[kind,date,'Necesito permiso de una hora',orig,token])).rows[0].id;
  const id=await request();assert.equal(await request(),id);assert.equal((await ctx()).requests.length,1);
  await who(5);assert.equal((await ctx()).requests.length,0);await assert.rejects(db.query('select staff_activity_proof($1,$2,$3)',['008',item.key,item.fingerprint]),/Sin permiso/);await assert.rejects(db.query('select staff_respond_permission($1,true,$2,0)',[id,'Autorizo la excepción urgente']),/superior/);
  await who(3);c=await ctx('008');assert.equal(c.canReview,true);await db.query('select staff_review_activity($1,$2,$3,$4)',['008',item.key,item.fingerprint,'Evidencia y resultado revisados']);c=await ctx('008');assert.equal(c.report.percent,100);
  // Original request retains 0%; decision records current 100%.
  await db.query('select staff_respond_permission($1,true,$2,0)',[id,'Autorizo este permiso solicitado']);c=await ctx('008');assert.equal(c.requests[0].compliance.percent,0);assert.equal(c.requests[0].decision_compliance.percent,100);
  await assert.rejects(db.query('select staff_respond_permission($1,false,$2,0)',[id,'Ya la había respondido antes']),/otra sesión/);
  // Editing evidence invalidates the supervisor's prior validation.
  await db.exec(`reset role;update daily_task_records set payload=payload||'{"notes":"Entrega corregida"}' where record_id='t1';`);await who(8);assert.equal((await ctx()).report.validated,0);
  const low=await request('Falta por urgencia','2026-11-06',null,'urgent');await who(3);await db.query('select staff_respond_permission($1,true,$2,0)',[low,'Excepción por urgencia, pese al cumplimiento menor al 80%']);
  // Only a future authorized change affects the rest calendar; pending/rejected requests never do.
  await who(8);const swap=await request('Cambio de descanso','2026-11-08','2026-11-07','swap');assert.equal((await ctx()).cycle.end,'2026-11-07');await who(3);await db.query('select staff_respond_permission($1,true,$2,0)',[swap,'Autorizo mover el descanso por acuerdo']);assert.equal((await ctx('008')).cycle.end,'2026-11-08');
  // Required cleaning includes a not-started saved slot, and no duplicate alias.
  await db.exec(`reset role;insert into operation_day_plans values('009','2026-11-06','Matriz','[{"key":"Aseo-Mostrador","kind":"Aseo","itemId":"Mostrador","title":"Limpiar mostrador","start":"08:00","end":"09:00","evidence":"photo","slaMinutes":60,"aliases":["Actividad-alias"]}]',now());`);
  await who(9);c=await ctx();assert.equal(c.report.cleaningExpected,2);assert.equal(c.report.cleaningEarned,0);
  await who(3);const board=(await db.query("select staff_cleaning_scoreboard('2026-11-06','2026-11-06') c")).rows[0].c;assert.equal(board.find(r=>r.employeeId==='009').report.cleaningExpected,2);

  await db.exec(`reset role;insert into activity_run_records(record_id,employee_number,branch,record_date,payload,updated_by) values('alias-run','009','Matriz','2026-11-06','{"itemType":"Actividad","itemId":"alias","status":"Completada","startedAt":"2026-11-06T14:00:00Z","completedAt":"2026-11-06T14:30:00Z","beforeEvidenceCapture":{"dataUrl":"data:image/jpeg;base64,YWJj"},"afterEvidenceCapture":{"dataUrl":"data:image/jpeg;base64,YWJj"}}',auth.uid());`);
  await who(9);c=await ctx();assert.equal(c.report.cleaningExpected,2);assert.equal(c.report.items.length,1);assert.equal(c.report.cleaningEarned,2);const aliasItem=c.report.items[0];assert.equal((await db.query('select staff_activity_proof($1,$2,$3) c',['009',aliasItem.key,aliasItem.fingerprint])).rows[0].c.pictures.length,2);
  await who(11);assert.equal((await ctx()).supervisorId,'005');await who(14);assert.equal((await ctx()).supervisorId,'008'); // auxiliary follows actual head

  await db.exec(`reset role;insert into centro_operation_records(day,task_id,owner_id,status,data,history) values('2026-11-06','inventario-1','011','Validada','{"evidence":"https://pos.alegra.com/report"}','[{"action":"submit","at":"2026-11-06T16:00:00Z"}]');`);await who(11);c=await ctx();assert.equal(c.report.validated,1);assert.equal(c.report.items[0].evidenceComplete,true);assert.equal((await db.query('select staff_activity_proof($1,$2,$3) c',['011',c.report.items[0].key,c.report.items[0].fingerprint])).rows[0].c.links.length,1);
  // Reset after changed rest, freeze previous evidence, never silently recreate it.
  await db.exec(`reset role;select set_config('test.clock','2026-11-09 08:00:00',false);`);await who(8);c=await ctx();assert.equal(c.cycle.start,'2026-11-09');assert.equal(c.report.total,0);assert.equal(c.history.length,1);assert.equal(c.history[0].cycle_end,'2026-11-08');assert.equal(c.history[0].payload.validated,0);
  await db.exec(`reset role;update daily_task_records set payload=payload||'{"status":"Pendiente"}' where record_id='t1';`);await who(8);assert.deepEqual((await ctx()).history,c.history);
  await assert.rejects(db.query("update staff_permission_requests set status='Autorizada'"),/permission denied/);
  const metrics=(await db.query("select staff_permission_metrics('2026-11-01','2026-11-10') c")).rows[0].c;assert.ok(!JSON.stringify(metrics).includes('Necesito permiso'));assert.equal(metrics.staff_cycle_records.rows.length,1);


  await db.exec(`reset role;insert into profiles(user_id,employee_number,display_name,role,branch) values('00000000-0000-0000-0000-000000000002','002','Director','DIRECTOR','Corporativo');update app_state set value=value||'[{"id":"003","supervisorId":"002"}]' where key='xoxo.collaborators';`);await who(3);assert.equal((await ctx()).supervisorId,'002');await assert.rejects(ctx('002'),/Sin permiso/);
  // Today's plan is captured for absent people too, matches canonical aliases, skips rest.
  const ts=require('typescript'),vm=require('node:vm');const data={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:data});
  await db.exec('reset role');await db.query("insert into app_state(key,value) values('xoxo.activitySchedules',$1),('xoxo.cleaningRole',$2) on conflict(key) do update set value=excluded.value",[JSON.stringify(data.defaultActivitySchedules),JSON.stringify(data.defaultCleaningRole)]);
  await who(3);await ctx();await db.exec('reset role');const plans=(await db.query("select * from operation_day_plans where day='2026-11-09'")).rows;assert.ok(plans.some(p=>p.employee_number==='009'&&p.slots.length>0));
  assert.equal(plans.some(p=>p.employee_number==='007'),true);
  await db.exec(`select set_config('test.clock','2026-11-13 10:00:00',false);`);await who(3);await ctx();await db.exec('reset role');assert.equal((await db.query("select * from operation_day_plans where employee_number='007' and day='2026-11-13'")).rows.length,0);
  console.log('PASS permisos: descansos individuales, reset, snapshot inmutable, validación superior, riesgo sin bloqueo, excepciones, jerarquía, idempotencia y privacidad');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message,e.where,e.internalQuery,e.position);process.exitCode=1;});
