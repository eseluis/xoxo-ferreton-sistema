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
  const evidenceMigration=fs.readFileSync('supabase-fix-centro-inventory-evidence.sql','utf8');
  await db.exec(evidenceMigration); await db.exec(evidenceMigration);
  const { rows:[{day}] } = await db.query("select (now() at time zone 'America/Mexico_City')::date::text as day");
  const who = async n => db.exec(`select set_config('test.user','00000000-0000-0000-0000-${String(n).padStart(12,'0')}',false)`);
  const call = async (task, version, action, data={}, note='') => (await db.query('select centro_update_task($1::date,$2,$3::integer,$4,$5::jsonb,$6) as result',[day,task,version,action,JSON.stringify(data),note])).rows[0].result;
  await who(3);
  for (const id of ['101','102']) {
    await db.query("select centro_assign_day($1,$2::date,'Sucursal Centro','00:00','23:59')",[id,day]);
    await db.query('insert into attendance_records values ($1::jsonb)',[JSON.stringify({employeeId:id,date:day,in:'00:00'})]);
  }
  await db.exec(`
    create function current_profile() returns profiles language sql stable security definer set search_path=public as $$ select p from profiles p where user_id=auth.uid() and active limit 1 $$;
    create function can_manage_all() returns boolean language sql stable as $$ select (current_profile()).role='GERENTE_GENERAL' $$;
    create function can_manage_branch(b text) returns boolean language sql stable as $$ select can_manage_all() or ((current_profile()).role='GERENTE_TIENDA' and b=(current_profile()).branch) $$;
    grant usage on schema public,auth to authenticated;
    update profiles set role='JEFE_AREA',display_name='Ruben' where employee_number='101';
    update profiles set role='GERENTE_TIENDA',display_name='Daniel' where employee_number='102';
    insert into profiles values ('00000000-0000-0000-0000-000000000104','104','Auxiliar','AUXILIAR','Sucursal Centro',true);
  `);
  await db.query("select centro_assign_day('104',$1::date,'Sucursal Centro','00:00','23:59')",[day]);
  await db.query('insert into attendance_records values ($1::jsonb)',[JSON.stringify({employeeId:'104',date:day,in:'00:00'})]);
  await db.exec(fs.readFileSync('supabase-operation-calendar.sql','utf8'));
  const hierarchy=fs.readFileSync('supabase-centro-activity-hierarchy.sql','utf8');
  await db.exec(hierarchy); await db.exec(hierarchy);
  const ts=require('typescript'), vm=require('node:vm'), model={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/centroOperation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:model});
  const compare=async()=>{
    const roster=(await db.query('select centro_roster($1::date) as roster',[day])).rows[0].roster;
    const records=(await db.query('select to_jsonb(r) as record from centro_operation_records r where day=$1::date',[day])).rows.map(r=>r.record);
    const now=(await db.query("select to_char(now() at time zone 'America/Mexico_City','HH24:MI') as clock")).rows[0].clock;
    const expected=Array.from(model.buildCentroAgenda(day,roster,records,now),i=>({taskId:i.id,ownerId:i.ownerId??null}));
    const actual=(await db.query('select centro_task_assignments($1::date) as assignments',[day])).rows[0].assignments;
    if (JSON.stringify(actual)!==JSON.stringify(expected)) console.log('assignment differences',actual.filter((a,i)=>JSON.stringify(a)!==JSON.stringify(expected[i])),expected.filter((a,i)=>JSON.stringify(a)!==JSON.stringify(actual[i])));
    assert.deepEqual(actual,expected,'server and client must assign the same activities');
    return actual;
  };
  await compare();
  for(const [task,owner,secret] of [['apertura','102','manager-secret'],['inventario-1','101','ruben-evidence'],['inventario-2','104','aux-evidence']]) {
    await db.query("insert into centro_operation_records(day,task_id,owner_id,status,data) values($1::date,$2,$3,'Validada',$4::jsonb)",[day,task,owner,JSON.stringify({private:secret})]);
  }
  await db.query(`insert into centro_operation_records(day,task_id,owner_id,status,data) values($1::date-1,'experiencia','102','Corrección','{"private":"manager-history"}')`,[day]);
  await compare();
  // An old worker snapshot must not disclose the new owner's record or history.
  await db.query(`insert into operation_day_plans(employee_number,day,branch,slots) values('101',$1::date,'Sucursal Centro','[{"key":"Centro-apertura"}]')`,[day]);
  const read=async id=>{
    await who(id); await db.exec('set role authenticated');
    const value=(await db.query('select centro_context($1::date) as context',[day])).rows[0].context;
    await db.exec('reset role'); return value;
  };
  const lead=await read(101), aux=await read(104), manager=await read(102);
  assert.ok(lead.assignments.length>0 && aux.assignments.length>0);
  assert.ok(lead.assignments.every(a=>a.ownerId==='101'));
  assert.ok(aux.assignments.every(a=>a.ownerId==='104'));
  assert.ok(!JSON.stringify(lead).includes('manager-secret'));
  assert.ok(!JSON.stringify(lead).includes('manager-history'));
  assert.ok(!JSON.stringify(lead).includes('aux-evidence'));
  assert.ok(!JSON.stringify(aux).includes('ruben-evidence'));
  assert.ok(JSON.stringify(manager).includes('ruben-evidence'));
  assert.ok(JSON.stringify(manager).includes('aux-evidence'));
  assert.ok(JSON.stringify(manager).includes('manager-history'));
  await who(101); await db.exec('set role authenticated');
  const calendar=(await db.query("select operation_calendar_centro($1::date,$1::date,'101') as records",[day])).rows[0].records;
  assert.ok(!calendar.some(r=>r.owner_id!=='101'));
  await assert.rejects(()=>db.query('select centro_task_assignments($1::date)',[day]),/permission denied/);
  await assert.rejects(()=>db.query('select * from centro_operation_records'),/permission denied/);
  await db.exec('reset role');
  await who(103); await assert.rejects(()=>db.query('select centro_context($1::date)',[day]),/No estás asignado/);
  // UI scoping remains strict even with a stale filter or an older test API.
  const all=model.buildCentroAgenda(day,manager.roster,manager.records,'12:00');
  const leadUser={id:'101',role:'JEFE_AREA',branch:'Sucursal Centro'};
  assert.ok(model.visibleCentroAgenda(leadUser,all).every(i=>i.ownerId==='101'));
  assert.ok(model.visibleCentroAgenda(leadUser,all,lead.assignments).every(i=>i.ownerId==='101'));
  assert.equal(model.visibleCentroAgenda({id:'102',role:'GERENTE_TIENDA',branch:'Sucursal Centro'},all).length,all.length);
  console.log('PASS: hierarchy protects lead/aux activities, manager team access, history, calendar, direct SQL and server/client ownership parity');
  await db.close();
})().catch(error=>{ console.error(error); process.exitCode=1; });
