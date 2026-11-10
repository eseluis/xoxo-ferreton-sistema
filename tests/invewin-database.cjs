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
  const migration=freeze(fs.readFileSync('supabase-invewin-matriz.sql','utf8'));await db.exec(migration);await db.exec(migration);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const clock=async t=>db.query("select set_config('test.clock',$1,false)",[t]);
  const ctx=async day=>(await db.query('select invewin_context($1) c',[day??null])).rows[0].c;
  let version=0;const act=async(action,changes={},person='008',day='2026-11-06',v=version)=>{const r=(await db.query('select invewin_action($1,$2,$3,$4,$5) c',[day,person,action,v,JSON.stringify(changes)])).rows[0].c;if(person==='008')version=r.version;return r;};
  const products=(count,start=0)=>Array.from({length:count},(_,i)=>({code:String(i+start).padStart(5,'0'),description:'Producto '+(i+start),price:25.50,saleQuantity:1}));
  await who(8);let c=await ctx();assert.equal(c.eligible,true);assert.equal(c.rows.length,1);assert.equal(c.rows[0].employee_number,'008');assert.equal(c.deadline,'2026-12-01');await assert.rejects(act('start'),/11:00/);
  await clock('2026-11-06 11:00:00');let r=await act('start');assert.equal(r.payload.status,'En curso');
  const oldRun=(await db.query("select payload from activity_run_records where employee_number='008' and record_date='2026-11-06'")).rows[0].payload;
  const sync=rows=>db.query("select sync_module_records('activityRuns',$1::jsonb)",[JSON.stringify(rows)]);
  await assert.rejects(sync([{...oldRun,status:'Vencida',escalated:true}]),/proceso Invewin/);
  await db.exec('reset role');const upsertFix=fs.readFileSync('supabase-fix-invewin-upsert.sql','utf8');await db.exec(upsertFix);await db.exec(upsertFix);await who(8);
  await sync([{...oldRun,status:'Vencida',escalated:true}]);
  assert.equal((await db.query("select payload->>'escalated' value from activity_run_records where record_id=$1",[oldRun.id])).rows[0].value,'true');
  await assert.rejects(sync([{...oldRun,completedAt:'2026-11-06T18:00:00Z'}]),/proceso Invewin/);
  await assert.rejects(sync([{...oldRun,id:'forged-invewin'}]),/proceso Invewin/);

  await assert.rejects(act('submit',{reference:'Reporte 01',confirmedInErp:true}),/50/);
  r=await act('save',{zoneType:'Anaquel',zone:'Electricidad 1',products:products(20),closed:false});const batch=r.payload.batches[0].id;assert.equal(r.payload.codeCount,20);
  await assert.rejects(act('save',{zoneType:'Muestrario',zone:'Electricidad 2',products:products(30,20),closed:true}),/Termina/);
  await assert.rejects(act('save',{batchId:batch,zoneType:'Anaquel',zone:'Electricidad 1',products:[...products(20),products(1)[0]],closed:true}),/repetido/);
  await act('save',{batchId:batch,zoneType:'Anaquel',zone:'Electricidad 1',products:products(20),closed:true});r=await act('save',{zoneType:'Muestrario',zone:'Electricidad 2',products:products(30,20),closed:true});assert.equal(r.payload.codeCount,50);
  await assert.rejects(act('submit',{reference:'Reporte 01',confirmedInErp:false}),/Confirma/);await assert.rejects(act('submit',{reference:'Reporte 01',confirmedInErp:true},'008','2026-11-06',0),/otra sesión/);
  await clock('2026-11-06 12:20:00');r=await act('submit',{reference:'Exportación Invewin folio 01',confirmedInErp:true,areaComplete:false});assert.equal(r.payload.status,'Por validar');assert.equal(r.payload.onTime,true);
  await assert.rejects(act('approve',{note:'Todo revisado en el sistema'}),/superior/);await assert.rejects(db.exec("update activity_run_records set payload=payload||'{\"approvalStatus\":\"Aprobada\"}'"),/proceso Invewin/);
  await who(11);c=await ctx();assert.equal(c.eligible,false);assert.equal(c.rows.length,0);await assert.rejects(act('start',{},'011'),/no asignada/);
  await who(7);assert.equal((await ctx()).eligible,false);await who(5);assert.equal((await ctx()).rows.length,0);await assert.rejects(act('approve',{note:'Validación de otra sucursal'}),/superior/);
  await who(3);r=await act('approve',{note:'Comprobados 50 códigos, precios y cantidades con la exportación Invewin'});assert.equal(r.payload.status,'Validada');assert.equal((await ctx()).validatedCodes,50);
  await who(8);c=(await db.query("select staff_permission_context('008') c")).rows[0].c;assert.equal(c.report.items.filter(i=>i.title.includes('Invewin')).length,1);assert.equal(c.report.items.find(i=>i.title.includes('Invewin')).validated,true);
  const evidence=(await db.query("select invewin_evidence('2026-11-06','2026-11-06') c")).rows[0].c;assert.equal(evidence.length,1);assert.equal(evidence[0].branch,'Matriz');assert.ok(evidence[0].comment.includes('50 códigos'));
  // Saturday rest excludes Sabina; different heads cannot claim already validated codes.
  await clock('2026-11-07 11:10:00');await who(9);c=await ctx();let own=c.rows.find(x=>x.employee_number==='009');r=await act('start',{},'009','2026-11-07',own.version);await assert.rejects(act('save',{zoneType:'Anaquel',zone:'Zona 3',products:products(50),closed:true},'009','2026-11-07',r.version),/ya fue validado/);
  await who(8);assert.equal((await ctx()).eligible,false);assert.equal((await ctx()).rows.length,0);
  await clock('2026-12-02 11:00:00');await who(9);c=await ctx();assert.equal(c.active,false);assert.equal(c.rows.length,0);await assert.rejects(act('start',{},'009','2026-12-02',0),/no asignada/);
  await db.exec('reset role');await db.query("insert into app_state(key,value) values('xoxo.activitySchedules',$1) on conflict(key) do update set value=excluded.value",[JSON.stringify([{id:'matriz-operacion-programada',name:'Operación',branch:'Matriz',ownerRoles:['JEFE_AREA'],start:'11:00',end:'16:30',durationMinutes:330,evidence:'none'},JSON.parse(fs.readFileSync('supabase-invewin-matriz.sql','utf8').match(/jsonb_build_array\('(.*?)'::jsonb\)/s)[1])])]);await who(3);await db.query("select staff_permission_context('003')");await db.exec('reset role');const plan=(await db.query("select slots from operation_day_plans where employee_number='009' and day='2026-12-02'")).rows[0].slots;assert.ok(!plan.some(s=>s.itemId==='matriz-invewin-configuracion'));assert.equal(plan.find(s=>s.itemId==='matriz-operacion-programada').start,'11:00');
  console.log('PASS Invewin: Matriz/jefes, vigencia, descanso, 11:00, zonas secuenciales, 50 códigos, campos, duplicados, validación superior, agenda única, evidencia e historial');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message,e.where,e.internalQuery,e.position);process.exitCode=1;});
