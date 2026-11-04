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
  await db.query("insert into app_state(key,value,updated_by) values ('xoxo.collaborators',$1::jsonb,auth.uid())",[JSON.stringify(people)]);
  const day=(await db.query("select (now() at time zone 'America/Mexico_City')::date::text as day")).rows[0].day;
  await db.query("insert into app_state(key,value,updated_by) values ('xoxo.storeOpeningChecks',$1::jsonb,auth.uid())",[JSON.stringify([{id:`${day}-Matriz`,date:day,branch:'Matriz',openedAt:'08:10',privateEvidence:'hidden'},{id:`${day}-Sucursal Centro`,date:day,branch:'Sucursal Centro',openedAt:'08:45'}])]);
  for (const [employee,branch] of [['006','Sucursal Centro'],['007','Matriz']]) {
   await db.query('insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values ($1,$1,$2,$3,$4::jsonb,auth.uid())',[employee,branch,day,JSON.stringify({employeeId:employee,date:day,in:'08:45'})]);
  }
  await db.exec(`insert into cash_cut_records(record_id,employee_number,branch,payload,updated_by) values
   ('matriz','007','Matriz','{"date":"2026-10-15","secret":"matriz"}',auth.uid()),
   ('centro','005','Sucursal Centro','{"date":"2026-10-15","secret":"centro"}',auth.uid());
   grant usage on schema public,auth to authenticated;
   select set_config('test.user','00000000-0000-0000-0000-000000000005',false);
   set role authenticated;`);
  assert.equal((await db.query('select can_manage_all() as allowed')).rows[0].allowed,false);
  assert.equal((await db.query("select can_manage_branch('Sucursal Centro') as allowed")).rows[0].allowed,true);
  assert.equal((await db.query("select can_manage_branch('Matriz') as allowed")).rows[0].allowed,false);
  assert.deepEqual((await db.query('select record_id from cash_cut_records')).rows.map(r=>r.record_id),['centro']);
  assert.equal((await db.query("select * from app_state where key='xoxo.collaborators'")).rows.length,0);
  const directory=(await db.query('select store_collaborators() as people')).rows[0].people;
  assert.equal(directory.find(p=>p.id==='007').salaryMin,undefined);
  assert.equal(typeof directory.find(p=>p.id==='006').salaryMin,'number');
  await assert.rejects(db.exec("insert into cash_cut_records(record_id,employee_number,branch,payload,updated_by) values ('illegal','005','Matriz','{}',auth.uid())"),/row-level security/);
  await assert.rejects(db.exec("select centro_assign_day('007',current_date,'Sucursal Centro','08:45','18:00')"),/Solo dirección/);
  const editable=directory.map(p=>p.id==='006'?{...p,name:'Jan actualizado'}:p);
  await db.query('select save_store_collaborators($1::jsonb)',[JSON.stringify(editable)]);
  await assert.rejects(db.query('select save_store_collaborators($1::jsonb)',[JSON.stringify(editable.map(p=>p.id==='005'?{...p,role:'DIRECTOR'}:p))]),/reservado/);
  await db.exec('reset role');
  const saved=(await db.query("select value from app_state where key='xoxo.collaborators'")).rows[0].value;
  assert.equal(saved.find(p=>p.id==='007').salaryMin,people.find(p=>p.id==='007').salaryMin);
  await db.exec("select set_config('test.user','00000000-0000-0000-0000-000000000003',false); set role authenticated");
  assert.equal((await db.query('select record_id from cash_cut_records')).rows.length,2);
  const overview=(await db.query('select store_general_overview() as result')).rows[0].result;
  assert.equal(overview.length,2);
  assert.ok(overview.every(store=>store.status==='Operando'));
  assert.equal(overview.find(store=>store.branch==='Sucursal Centro').people[0].name,'Jan');
  assert.ok(!JSON.stringify(overview).includes('privateEvidence'));
  await db.exec("select set_config('test.user','00000000-0000-0000-0000-000000000005',false)");
  const openings=(await db.query('select store_opening_checks() as rows')).rows[0].rows;
  assert.equal(openings.length,1);
  assert.equal(openings[0].branch,'Sucursal Centro');
  assert.equal((await db.query("select * from app_state where key='xoxo.storeOpeningChecks'")).rows.length,0);
  assert.deepEqual(Object.keys(overview[0]).sort(),['branch','people','status']);
  await db.exec("reset role; select set_config('test.user','00000000-0000-0000-0000-000000000003',false)");
  const migration=fs.readFileSync('supabase-fix-store-transfers.sql','utf8');
  await db.exec(migration); await db.exec(migration);
  const before=(await db.query("select value from app_state where key='xoxo.collaborators'")).rows[0].value;
  const oldDay='2026-01-01';
  await db.query("insert into app_state(key,value,updated_by) values ('xoxo.workLocations',$1::jsonb,auth.uid())",[JSON.stringify([
    {id:day+'-006',employeeId:'006',date:day,location:'Sucursal Centro',start:'08:30',end:'18:00'},
    {id:oldDay+'-006',employeeId:'006',date:oldDay,location:'Sucursal Centro'},
    {id:day+'-007',employeeId:'007',date:day,location:'Matriz'}])]);
  await db.exec('set role authenticated');
  const transferred=before.map(p=>p.id==='006'?{...p,branch:'Matriz'}:p);
  await db.query('select save_store_collaborators($1::jsonb)',[JSON.stringify(transferred)]);
  await db.exec('reset role');
  assert.equal((await db.query("select branch from profiles where employee_number='006'")).rows[0].branch,'Matriz');
  const locations=(await db.query("select value from app_state where key='xoxo.workLocations'")).rows[0].value;
  assert.equal(locations.find(p=>p.id===day+'-006').location,'Matriz');
  assert.equal(locations.find(p=>p.id===day+'-006').start,'08:30');
  assert.equal(locations.find(p=>p.date===oldDay).location,'Sucursal Centro');
  assert.equal(locations.find(p=>p.employeeId==='007').location,'Matriz');
  const result=(await db.query('select store_general_overview() as result')).rows[0].result;
  assert.ok(result.find(s=>s.branch==='Matriz').people.some(p=>p.name==='Jan actualizado'));
  assert.ok(!(await db.query('select centro_roster($1::date) as roster',[day])).rows[0].roster.some(p=>p.id==='006'));
  await db.exec('set role authenticated');
  await db.query('select save_store_collaborators($1::jsonb)',[JSON.stringify(before)]);
  await db.exec('reset role');
  assert.ok((await db.query('select centro_roster($1::date) as roster',[day])).rows[0].roster.some(p=>p.id==='006'));
  console.log('PASS: transferencia de directorio sincroniza perfil, resumen y Centro; conserva horarios, otros colaboradores e historial');
  console.log('PASS: permisos por puesto, aislamiento RLS, director consolidado, catálogo protegido, administración Centro y proyección general');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
