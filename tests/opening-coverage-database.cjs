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

  const sql=fs.readFileSync('supabase-matriz-opening-team.sql','utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp");
  await db.exec(`create function work_branch(person text,day date) returns text language sql stable security definer as $$select branch from profiles where employee_number=person$$;select set_config('test.clock','2026-11-06 08:01:00',false);`);
  await db.exec(sql);await db.exec(sql);
  await db.exec(`grant usage on schema public,auth to authenticated;`);

  await db.exec(`insert into profiles(user_id,employee_number,display_name,role,branch) values
 ('00000000-0000-0000-0000-000000000001','001','Directora','APODERADA_LEGAL','Corporativo'),
 ('00000000-0000-0000-0000-000000000002','002','Director','DIRECTOR','Corporativo'),
 ('00000000-0000-0000-0000-000000000012','012','Administradora Centro','ADMIN_TIENDA','Sucursal Centro')`);
  for(const f of ['supabase-fix-cleaning-evaluations.sql','supabase-centro-operation.sql','supabase-operation-calendar.sql','supabase-branch-isolation.sql'])await db.exec(fs.readFileSync(f,'utf8')); 
  const coverage=fs.readFileSync('supabase-opening-coverage.sql','utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp");await db.exec(coverage);await db.exec(coverage);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const context=async()=> (await db.query("select matriz_opening_context(current_setting('test.clock')::timestamp::date) c")).rows[0].c;
  const mark=async(s,v=0)=>db.query('select mark_matriz_opening_step($1,$2)',[s,v]);
  await who(6);await assert.rejects(mark('computers'),/encargado/);await who(9);let c=await context();assert.equal(c.canCover,true);await assert.rejects(mark('shutters'),/autorización/);await mark('authorization');await mark('computers');c=await context();assert.equal(c.steps.find(s=>s.step==='computers').completedById,'009');assert.equal(c.steps.find(s=>s.step==='computers').assignedEmployeeId,'008');assert.equal(c.steps.find(s=>s.step==='computers').employeeId,'009');
  await who(1);assert.equal((await context()).applicable,true);await mark('entrance');
  await who(12);assert.equal((await context()).canCover,true);await mark('shutters');await mark('shutters');
  const patch=async(fields)=>db.query('select patch_store_opening_checks($1::jsonb)',[JSON.stringify([{id:'2026-11-06-Matriz',date:'2026-11-06',branch:'Matriz',...fields}])]);
  await assert.rejects(patch({closedAt:'illegal'}),/Solo puedes|Solo dirección|Sucursal no autorizada|Sin permiso|Sólo|fuera|configuración/i);
  await who(9);await assert.rejects(patch({openedAt:'forged'}),/personal/);await patch({minimumStaff:true,processComplete:true,cashOpenConfirmedAt:'2026-11-06T14:00:00Z',openedAt:'forged'});c=await context();assert.equal(c.opening.openedById,'009');assert.notEqual(c.opening.openedAt,'forged');
  await who(3);assert.equal((await context()).canCover,true);await who(2);assert.equal((await context()).canCover,true);
  await db.exec(`reset role;select set_config('test.clock','2026-11-07 07:44:00',false);`);await who(9);await assert.rejects(mark('computers'),/Todavía/);const owners={entrance:'009',authorization:'009',computers:'010',shutters:'006'};await db.query('select save_matriz_opening_owners($1,1)',[JSON.stringify(owners)]);c=await context();assert.equal(c.steps.find(s=>s.step==='computers').employeeId,'010');await assert.rejects(db.query('select save_matriz_opening_owners($1,1)',[JSON.stringify(owners)]),/otra sesión/);
  await who(8);assert.equal((await context()).canCover,false);await assert.rejects(mark('computers',1),/encargado/);
  console.log('PASS suplencia apertura: 001/002/003, Julio y administrador, encargado original/ejecutor real, autorización antes de cortinas, horarios, reasignación y cierre no ampliado');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

