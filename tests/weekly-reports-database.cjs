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

  const freeze=s=>s.replaceAll('now()',"(current_setting('test.clock')::timestamp at time zone 'America/Mexico_City')");
  await db.exec(freeze(fs.readFileSync('supabase-weekly-permissions.sql','utf8')));await db.exec('grant usage on schema public,auth to authenticated;');

  const migration=freeze(fs.readFileSync('supabase-weekly-reports.sql','utf8'));await db.exec(migration);await db.exec(migration);
  await db.exec(freeze(fs.readFileSync('supabase-matriz-orders-uniform.sql','utf8')));
  await db.exec(freeze(fs.readFileSync('supabase-daily-agenda-policy.sql','utf8')));await db.exec(freeze(fs.readFileSync('supabase-daily-agenda-policy.sql','utf8')));
  await db.exec(`insert into work_readiness_records(record_id,employee_number,branch,record_date,payload) values('ready-in','008','Matriz','2026-11-06','{"phase":"in","status":"Conforme"}'),('ready-out','008','Matriz','2026-11-06','{"phase":"out","status":"Conforme"}')`);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const clock=async t=>db.query("select set_config('test.clock',$1,false)",[t]);
  const ctx=async person=>(await db.query('select weekly_report_context($1,null) c',[person??null])).rows[0].c;
  const evidence=[{description:'Evidencia semanal de la sucursal',url:'https://example.test/folio'}];
  const submit=async(due='2026-11-06',ev=evidence)=>(await db.query('select submit_weekly_report($1,$2,$3,$4,$5) c',[due,'Realicé las actividades programadas, atendí clientes y reporté los resultados.','Sin incidencias ni pendientes.',JSON.stringify(ev),'[]'])).rows[0].c;
  await who(8);let c=await ctx();assert.equal(c.blocked,true);assert.equal(c.due,'2026-11-06');assert.equal(c.restDate,'2026-11-07');assert.ok(c.people.every(p=>['008','014'].includes(p.id)));
  await assert.rejects(ctx('005'),/Sin permiso/);await assert.rejects(submit('2026-11-07'),/última jornada/);await assert.rejects(submit('2026-11-06',[]),/al menos una evidencia/);await assert.rejects(submit('2026-11-06',[{description:'Mal enlace',url:'javascript:alert(1)'}]),/enlace/);
  const punch=()=>db.exec(`insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values('008-2026-11-06','008','Matriz','2026-11-06','{"employeeId":"008","date":"2026-11-06","in":"08:00","out":"17:30"}','00000000-0000-0000-0000-000000000008')`);
  await assert.rejects(punch(),/Salida no registrada/);assert.equal((await db.query('select count(*) n from attendance_records')).rows[0].n,0);
  await db.exec(`insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values('008-2026-11-06','008','Matriz','2026-11-06','{"employeeId":"008","date":"2026-11-06","in":"08:00"}','00000000-0000-0000-0000-000000000008')`);
  await assert.rejects(db.exec("update attendance_records set payload=payload||'{\"out\":\"17:30\"}'"),/Salida no registrada/);
  let r=await submit();assert.equal(r.payload.status,'Entregado');assert.equal(r.payload.onTime,true);assert.equal(r.payload.openings[0].missing,true);assert.equal((await submit()).record_id,r.record_id);assert.equal((await ctx()).blocked,false);await db.exec("update attendance_records set payload=payload||'{\"out\":\"17:30\"}'");
  await assert.rejects(db.query('select review_weekly_report($1,$2,0)',[r.record_id,'Revisado por mi mismo']),/superior/);
  await who(5);await assert.rejects(db.query('select weekly_report_detail($1)',[r.record_id]),/Sin permiso/);
  await who(3);assert.ok((await ctx('008')).canReview);await db.query('select review_weekly_report($1,$2,0)',[r.record_id,'Revisé las evidencias y la apertura.']);let detail=(await db.query('select weekly_report_detail($1) c',[r.record_id])).rows[0].c;assert.equal(detail.payload.status,'Revisado');assert.equal(detail.payload.summary,r.payload.summary);assert.equal(detail.payload.reviewHistory.length,1);
  await assert.rejects(db.query('select review_weekly_report($1,$2,0)',[r.record_id,'Segundo intento desde sesión vieja']),/Otra sesión/);
  await who(14);c=await ctx();assert.equal(c.due,'2026-11-08');assert.equal(c.blocked,false);await db.exec('reset role');assert.equal((await db.query("select staff_is_rest('014','2026-11-09') r")).rows[0].r,true);assert.equal((await db.query("select staff_is_rest('014','2026-11-08') r")).rows[0].r,false);
  await clock('2026-11-09 10:00:00');await who(9);assert.equal((await ctx()).blocked,true);r=await submit('2026-11-07');assert.equal(r.payload.onTime,false);assert.equal((await ctx()).blocked,false);
  await who(5);c=await ctx();assert.equal(c.due,'2026-11-07');assert.ok(c.openings.every(o=>o.branch==='Sucursal Centro'));assert.ok(!c.people.some(p=>p.id==='008'));

  await db.exec('reset role');
  const ts=require('typescript'),vm=require('node:vm'),data={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:data});
  const agenda={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/operationalAgenda.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:agenda,Date});
  await db.query("update app_state set value=$1::jsonb where key='xoxo.activitySchedules'",[JSON.stringify(data.defaultActivitySchedules)]);
  const collaborators=data.defaultEmployees.map(p=>({...p,...(['006','015'].includes(p.id)?{branch:'Matriz'}:{}),...(p.id==='011'?{branch:'Sucursal Centro'}:{}),...(p.id==='015'?{weekdayShiftEnds:{2:'19:00',3:'19:00',5:'19:00'}}:{}),...(p.id==='014'?{workdays:[5,6,0]}:{})}));
  await db.query("update app_state set value=$1::jsonb where key='xoxo.collaborators'",[JSON.stringify(collaborators)]);
  assert.equal((await db.query("select cleaning_exit_time('015','2026-11-10') t")).rows[0].t,'19:00');
  await db.exec("delete from operation_day_plans where day>='2026-11-09'");
  for(const day of ['2026-11-09','2026-11-10','2026-11-11','2026-11-13']){
   await clock(day+' 09:00:00');await db.query('select staff_capture_today_plans()');
   for(const id of ['006','008','009','010','015','014']){
    if((await db.query('select staff_is_rest($1,$2) r',[id,day])).rows[0].r)continue;
    const employee=collaborators.find(p=>p.id===id);const client=agenda.buildRoutine(employee,data.defaultActivitySchedules,[],'Matriz',day).map(s=>s.key).sort();
    const server=(await db.query('select slots from operation_day_plans where employee_number=$1 and day=$2',[id,day])).rows[0].slots.map(s=>s.key).sort();assert.equal(JSON.stringify(server),JSON.stringify(client),id+' '+day+' agenda cliente/servidor');
   }
  }
  await clock('2026-11-11 09:00:00');await who(15);let orders=(await db.query("select matriz_orders_context('2026-11-11') c")).rows[0].c;assert.ok(orders.rows.length);assert.ok(orders.rows.every(r=>r.start==='09:00'&&r.end==='09:30'));const step=orders.rows.find(r=>r.step===1);await db.query("select matriz_order_action($1,'start','','')",[step.id]);await clock('2026-11-11 09:31:00');await db.query("select matriz_order_action($1,'complete','Se revisaron faltantes y existencia.','')",[step.id]);orders=(await db.query("select matriz_orders_context('2026-11-11') c")).rows[0].c;assert.equal(orders.rows.find(r=>r.step===1).onTime,false);
  const metrics=(await db.query("select weekly_report_metrics('2026-11-06','2026-11-11') c")).rows[0].c;assert.ok(metrics.staff_weekly_reports.rows.every(r=>r.employeeId==='015'||r.employeeId==='013'));assert.ok(!JSON.stringify(metrics).includes('Evidencia semanal de la sucursal'));
  console.log('PASS reportes: descanso individual, Zalma viernes-domingo, evidencias, salida insert/update, entrega idempotente, atraso persistente, apertura sin inventar, revisión y jerarquía');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

