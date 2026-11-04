const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const vm = require('node:vm');
(async () => {
 const exportsObject = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
 const people=exportsObject.employees ?? exportsObject.defaultEmployees;
 const daniel=people.find(p=>p.id==='005'), director=people.find(p=>p.id==='003');
 assert.equal(exportsObject.canViewAll(daniel),false);
 assert.equal(exportsObject.canGovern(daniel),false);
 assert.equal(exportsObject.canManageStore(daniel),true);
 assert.equal(exportsObject.canViewAll(director),true);
 assert.equal(exportsObject.canAssign(daniel,people.find(p=>p.id==='007')),false);
 assert.equal(exportsObject.recordInBranch({branch:'Matriz'},'Sucursal Centro',people),false);
 assert.equal(exportsObject.recordInBranch({employeeId:'006',date:'2026-10-15'},'Matriz',people,[{employeeId:'006',date:'2026-10-15',location:'Matriz'}]),true);
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
   create table auth.users(id uuid primary key);
   insert into auth.users values ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000005'),('00000000-0000-0000-0000-000000000006'),('00000000-0000-0000-0000-000000000007');`);
  for(const file of ['supabase-setup.sql','supabase-stage2-modules.sql','supabase-fix-shared-sync.sql','supabase-fix-assignments.sql','supabase-fix-cleaning-evaluations.sql','supabase-fix-opening-sync.sql','supabase-centro-operation.sql','supabase-operation-calendar.sql','supabase-branch-isolation.sql']) {
   await db.exec(fs.readFileSync(file,'utf8').replace('create extension if not exists pgcrypto;',''));
  }
  await db.exec(fs.readFileSync('supabase-branch-isolation.sql','utf8'));
  await db.exec(`insert into profiles(user_id,employee_number,display_name,role,branch) values
   ('00000000-0000-0000-0000-000000000003','003','Dirección','GERENTE_GENERAL','Matriz'),
   ('00000000-0000-0000-0000-000000000005','005','Daniel','GERENTE_TIENDA','Sucursal Centro'),
   ('00000000-0000-0000-0000-000000000006','006','Jan','JEFE_AREA','Sucursal Centro'),
   ('00000000-0000-0000-0000-000000000007','007','Caja Matriz','CAJERO','Matriz');
   select set_config('test.user','00000000-0000-0000-0000-000000000003',false);`);

  const day=(await db.query("select (now() at time zone 'America/Mexico_City')::date::text as day")).rows[0].day;
  const migration=fs.readFileSync('supabase-system-kpis.sql','utf8');await db.exec(migration);await db.exec(migration);
  await db.exec(`create table new_feature_records(record_id text,employee_number text,branch text,record_date date,payload jsonb);
    alter table new_feature_records enable row level security;
    create policy read_fixture on new_feature_records for select to authenticated using(true);
    grant select on new_feature_records to authenticated;
    create table attendance_exit_requests(id text,employee_number text,day date,status text,requested_at timestamptz,responded_at timestamptz,reason text);
    alter table attendance_exit_requests enable row level security;
    create policy exit_read on attendance_exit_requests for select to authenticated using ((public.current_profile()).employee_number in (employee_number,'003'));
    grant select on attendance_exit_requests to authenticated;
    grant usage on schema public,auth to authenticated;`);
  for(const [id,employee,branch] of [['own','006','Sucursal Centro'],['manager','005','Sucursal Centro'],['other-store','007','Matriz']]) {
    await db.query('insert into new_feature_records values($1,$2,$3,$4::date,$5::jsonb)',[id,employee,branch,day,JSON.stringify({status:'Activo',notes:'PRIVATE_DESCRIPTION',evidence:'data:image/jpeg;base64,PRIVATE_PHOTO',evidenceCapture:{dataUrl:'PRIVATE_PHOTO'},startedAt:day+'T15:00:00Z'})]);
  }
  await db.query("insert into attendance_exit_requests values('exit-own','006',$1::date,'Pendiente',now(),null,'PRIVATE_EXIT_REASON'),('exit-manager','005',$1::date,'Autorizada',now(),now(),'PRIVATE_EXIT_REASON')",[day]);
  for(const [task,owner,data] of [['inventario-1','005',{pendientes:'Sin incidencias',private:'MANAGER_SECRET'}],['inventario-2','006',{evidence:'https://pos.alegra.com/inventory/own'}]]) {
   await db.query("insert into centro_operation_records(day,task_id,owner_id,status,data,history) values($1::date,$2,$3,'Validada',$4::jsonb,$5::jsonb)",[day,task,owner,JSON.stringify(data),JSON.stringify([{action:'submit',at:day+'T16:00:00Z'}])]);
  }
  for(const [id,recipient,confidentiality] of [['incoming-visible','006','Normal'],['private-other','005','Confidencial']]) {
    await db.query("insert into internal_request_records(record_id,employee_number,branch,record_date,payload,updated_by) values($1,'007','Matriz',$2::date,$3::jsonb,auth.uid())",[id,day,JSON.stringify({id,requestedById:'007',recipientId:recipient,date:day,status:'Abierta',confidentiality,message:'PRIVATE_MESSAGE'})]);
  }
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  await who(6);
  const own=(await db.query('select system_kpi_snapshot($1::date,$1::date) as result',[day])).rows[0].result;
  assert.deepEqual(own.sources.new_feature_records.rows.map(r=>r.id),['own']);
  assert.ok(own.sources.internal_request_records.rows.some(r=>r.id==='incoming-visible'));assert.ok(!own.sources.internal_request_records.rows.some(r=>r.id==='private-other'));assert.ok(!JSON.stringify(own).includes('PRIVATE_MESSAGE'));
  assert.equal(own.sources.attendance_exit_requests.rows.length,1);assert.equal(own.sources.attendance_exit_requests.rows[0].id,'exit-own');assert.ok(!JSON.stringify(own).includes('PRIVATE_EXIT_REASON'));
  assert.ok(!JSON.stringify(own).includes('PRIVATE_DESCRIPTION'));assert.ok(!JSON.stringify(own).includes('PRIVATE_PHOTO'));
  const centro=(await db.query('select centro_kpi_snapshot($1::date,$1::date) as result',[day])).rows[0].result;
  assert.equal(centro.length,1);assert.equal(centro[0].employeeId,'006');
  const evidence=(await db.query('select system_centro_evidence($1::date,$1::date) as result',[day])).rows[0].result;
  assert.equal(evidence.length,1);assert.equal(evidence[0].branch,'Sucursal Centro');assert.ok(evidence[0].description);assert.ok(evidence[0].submittedAt);
  assert.ok(!JSON.stringify(evidence).includes('MANAGER_SECRET'));
  await who(5);
  const team=(await db.query('select system_kpi_snapshot($1::date,$1::date) as result',[day])).rows[0].result;
  assert.equal(team.sources.new_feature_records.rows.length,2);assert.ok(!team.sources.new_feature_records.rows.some(r=>r.id==='other-store'));
  const teamEvidence=(await db.query('select system_centro_evidence($1::date,$1::date) as result',[day])).rows[0].result;
  assert.equal(teamEvidence.length,2);assert.ok(teamEvidence.some(e=>e.comment==='Sin incidencias'&&e.commentAccepted&&e.evidenceComplete));
  await who(3);const all=(await db.query('select system_kpi_snapshot($1::date,$1::date) as result',[day])).rows[0].result;
  assert.equal(all.sources.new_feature_records.rows.length,3);assert.ok(!all.sources.internal_request_records.rows.some(r=>r.id==='private-other'));
  await assert.rejects(()=>db.query("select system_kpi_snapshot('2026-01-01','2026-12-31')"),/63 días/);
  console.log('PASS: live SQL KPI/evidence APIs, automatic discovery, no photographs/private text in KPIs, own/team/store hierarchy and inventory comments');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
