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

 await db.exec('reset role');
 await db.exec(`insert into profiles(user_id,employee_number,display_name,role,branch) values ('00000000-0000-0000-0000-000000000001','001','Admin1','ADMIN_GENERAL','Matriz'),('00000000-0000-0000-0000-000000000002','002','Admin2','ADMIN_GENERAL','Matriz'),('00000000-0000-0000-0000-000000000004','004','Otro admin','ADMIN_GENERAL','Matriz');`);
 for(const file of ['supabase-summary-directors.sql','supabase-request-delivery.sql']){await db.exec(freeze(fs.readFileSync(file,'utf8')));await db.exec(freeze(fs.readFileSync(file,'utf8')));}
 const send=async rows=>(await db.query('select sync_internal_request_records($1) r',[JSON.stringify(rows)])).rows[0].r;
 const request={id:'ruben-queja',type:'Queja',requestedById:'011',recipientId:'003',title:'Apoyo',message:'Solicitud de apoyo de prueba local',date:'2026-11-06',priority:'Alta',confidentiality:'Normal',status:'Abierta',response:''};
 await who(11);let result=await send([request]);assert.ok(result[0].receivedAt);assert.equal(result[0].branch,'Sucursal Centro');
 assert.equal((await send([request]))[0].id,request.id);assert.equal((await db.query('select count(*) n from internal_request_records')).rows[0].n,1);
 await assert.rejects(send([{...request,id:'forged',requestedById:'008'}]),/propio usuario/);
 await who(3);assert.equal((await db.query('select count(*) n from internal_request_records')).rows[0].n,1);
 await send([{...result[0],status:'Atendida',response:'Recibida por Dirección'}]);
 await who(11);let retry=await send([{...request,branch:'Sucursal Centro'}]);assert.equal(retry[0].status,'Atendida');assert.equal(retry[0].response,'Recibida por Dirección');
 let report=(await send([{...request,id:'resumen',type:'Reporte',recipientId:'005',confidentiality:'Confidencial'}]))[0];assert.equal(report.recipientId,'003');assert.deepEqual(report.recipientIds,['001','002','003']);
 for(const id of [1,2,3]){await who(id);assert.equal((await db.query("select count(*) n from internal_request_records where record_id='resumen'")).rows[0].n,1);assert.equal((await send([report]))[0].id,'resumen');}
 for(const id of [4,5,8]){await who(id);assert.equal((await db.query("select count(*) n from internal_request_records where record_id='resumen'")).rows[0].n,0);await assert.rejects(send([report]),/Sin permiso/);await assert.rejects(ctx('011'),/Sin permiso/);}
 await who(8);let weekly=await submit();
 for(const id of [1,2,3]){await who(id);assert.ok((await ctx('008')).canReview);assert.equal((await db.query('select weekly_report_detail($1) c',[weekly.record_id])).rows[0].c.record_id,weekly.record_id);assert.ok((await ctx()).incoming.some(r=>r.record_id===weekly.record_id));}
 for(const id of [4,5]){await who(id);await assert.rejects(db.query('select weekly_report_detail($1)',[weekly.record_id]),/Sin permiso/);assert.equal((await db.query('select count(*) n from staff_weekly_reports')).rows[0].n,0);}
 console.log('PASS: retries preserve server responses; confirmed receipt, sender identity, report routing and strict 001/002/003 database access');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

