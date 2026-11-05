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
  const sql=fs.readFileSync('supabase-matriz-orders-uniform.sql','utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp");
  await db.exec(sql);await db.exec(sql);
  const weeklySql=fs.readFileSync('supabase-weekly-uniform-photo.sql','utf8').replaceAll("now() at time zone 'America/Mexico_City'","current_setting('test.clock')::timestamp");await db.exec(weeklySql);await db.exec(weeklySql); // rerunnable, doesn't replace existing preferences
  await db.exec(`update matriz_order_settings set activated_on='2026-11-02';grant usage on schema public,auth to authenticated;`);
  const who=async id=>db.exec(`reset role;select set_config('test.user','00000000-0000-0000-0000-${String(id).padStart(12,'0')}',false);set role authenticated;`);
  const rpc=async(q,args=[])=>((await db.query(q,args)).rows[0]);
  const context=async()=> (await rpc("select matriz_orders_context(current_setting('test.clock')::timestamp::date) c")).c;
  const ready=async()=> (await rpc('select work_readiness_context() c')).c;
  const fails=async(q,args,match)=>{await assert.rejects(db.query(q,args),match);};
  const action=async(id,action,note='Revisión completa sin incidencias',ref='')=>db.query('select matriz_order_action($1,$2,$3,$4)',[id,action,note,ref]);
  await who(3);let ctx=await context();assert.equal(ctx.rows.length,5);assert.ok(ctx.rows.every(r=>r.area==='Plomería'));assert.equal(ctx.rows[0].employeeId,'015');
  // Auxiliar activo recibe sólo detección, nunca revisiones ni autorizaciones del jefe.
  await db.exec(`reset role;insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values('aux','013','Matriz','2026-11-04','{"employeeId":"013","date":"2026-11-04","in":"08:00"}',auth.uid());`);
  await who(13);ctx=await context();assert.equal(ctx.rows.length,1);assert.equal(ctx.rows[0].step,1);
  const id='2026-11-04-plomeria-1';await action(id,'start');
  await fails("select matriz_order_action('2026-11-04-plomeria-2','start')",[],/responsable/);
  await fails("select matriz_order_action($1,'complete','corto')",[id],/Describe/);
  // Si sale a comida, el jefe absorbe el paso sin perder inicio.
  await db.exec(`reset role;update attendance_records set payload=payload||'{"lunchOut":"10:20"}' where record_id='aux';`);
  await who(15);ctx=await context();assert.equal(ctx.rows.length,3);assert.ok(ctx.rows[0].startedAt);assert.equal(ctx.rows[0].employeeId,'015');
  await fails("select matriz_order_action('2026-11-04-plomeria-2','start')",[],/anterior/);
  await action(id,'complete');await action('2026-11-04-plomeria-2','start');await action('2026-11-04-plomeria-2','complete');await action('2026-11-04-plomeria-3','start');
  await fails("select matriz_order_action('2026-11-04-plomeria-3','complete','Lista formal terminada','')",[],/folio/);
  await action('2026-11-04-plomeria-3','complete','Sin faltantes, no es necesario solicitar compra','Sin pedido');
  await fails("select matriz_order_action('2026-11-04-plomeria-4','start')",[],/responsable/);
  assert.equal((await db.query('select * from matriz_order_records')).rows.length,3);
  await who(3);await action('2026-11-04-plomeria-4','start');await action('2026-11-04-plomeria-4','complete','PRIVATE_MANAGER_NOTE validación');await action('2026-11-04-plomeria-5','start');await action('2026-11-04-plomeria-5','complete','Autorización con revisión de gerente');
  await who(15);assert.ok(!JSON.stringify(await context()).includes('PRIVATE_MANAGER_NOTE'));
  let metrics=(await rpc("select work_preparation_metrics('2026-11-02','2026-11-07') c")).c;
  assert.equal(metrics.matriz_order_records.rows.length,3);assert.ok(!JSON.stringify(metrics).includes('PRIVATE_MANAGER_NOTE'));assert.ok(!JSON.stringify(metrics).includes('Sin pedido'));
  await who(5);assert.equal((await context()).rows.length,0);assert.equal((await rpc("select work_preparation_evidence('2026-11-02','2026-11-07') c")).c.length,0);
  // Semana completa, sábado incluye las cinco áreas, domingos sin nuevos pedidos.
  await who(3);await db.exec(`reset role;select set_config('test.clock','2026-11-07 10:15:00',false);`);ctx=await context();assert.equal(ctx.rows.length,10);assert.equal(new Set(ctx.rows.map(r=>r.area)).size,5);
  await db.exec(`select set_config('test.clock','2026-11-08 10:15:00',false);`);assert.equal((await context()).rows.length,0);
  // Herramientas y uniforme: una muestra aleatoria semanal, sin exponer selección futura.
  await db.exec(`select set_config('test.clock','2026-11-04 08:00:00',false);`);await who(13);let r=await ready();assert.equal(r.toolsRequired,true);assert.ok(!('selected_day' in r));
  await db.exec(`reset role;update work_photo_weeks set selected_day='2026-11-03',selected_phase='in' where employee_number='013';delete from attendance_records where record_id='aux';`);await who(13);r=await ready();assert.equal(r.entryPhotoRequired,true);assert.equal(r.exitPhotoRequired,false);assert.equal(r.weeklyEvidenceMet,false);
  await fails("select save_work_readiness('in','{}')",[],/todos/);
  const checks={cutter:true,flexometro:true,guantes:true,uniform:true};const image='data:image/jpeg;base64,YWJj';
  await fails('select save_work_readiness($1,$2::jsonb)',['in',JSON.stringify(checks)],/foto semanal/);
  await fails("select register_prepared_attendance('in')",[],/checklist/);
  await fails("select save_work_readiness('in',$1::jsonb,'','not-an-image')",[JSON.stringify(checks)],/foto JPG/);
  await db.query("select save_work_readiness('in',$1::jsonb,'',$2)",[JSON.stringify(checks),image]);r=await ready();assert.equal(r.entryPhotoRequired,false);assert.equal(r.exitPhotoRequired,false);assert.equal(r.weeklyEvidenceMet,true);
  await db.query("select register_prepared_attendance('in')");
  await fails("select save_work_readiness('in',$1::jsonb,'',$2)",[JSON.stringify(checks),image],/ya no puede/);
  await fails("select save_work_readiness('out',$1::jsonb,'',$2)",[JSON.stringify({...checks,cutter:false}),image],/faltante/);
  await db.query("select save_work_readiness('out',$1::jsonb,'Cutter extraviado, reportado a gerencia',$2)",[JSON.stringify({...checks,cutter:false}),image]);
  await db.query("select register_prepared_attendance('out')");r=await ready();assert.equal(r.exitPhotoRequired,false);assert.equal(r.rows.find(r=>r.phase==='out').status,'Incidencia');
  metrics=(await rpc("select work_preparation_metrics('2026-11-02','2026-11-07') c")).c;assert.ok(!JSON.stringify(metrics).includes(image));assert.equal(metrics.work_readiness_records.rows.length,2);assert.equal(metrics.work_readiness_records.rows[1].toolsOk,false);
  const evidence=(await rpc("select work_preparation_evidence('2026-11-02','2026-11-07') c")).c;assert.equal(evidence.length,2);assert.ok(evidence[0].single.dataUrl);assert.ok(evidence.every(e=>e.description&&e.branch==='Matriz'));
  await db.exec(`reset role;select set_config('test.clock','2026-11-06 08:00:00',false);`);await who(13);r=await ready();assert.equal(r.entryPhotoRequired,false);assert.equal(r.exitPhotoRequired,false);assert.equal(r.weeklyEvidenceMet,true);
  await db.query("select save_work_readiness('in',$1::jsonb)",[JSON.stringify(checks)]);
  await db.exec(`reset role;select set_config('test.clock','2026-11-11 08:00:00',false);`);await who(13);await ready();
  await db.exec(`reset role;update work_photo_weeks set selected_day='2026-11-10',selected_phase='out' where employee_number='013' and week_start='2026-11-09';`);await who(13);r=await ready();assert.equal(r.weeklyEvidenceMet,false);assert.equal(r.entryPhotoRequired,false);assert.equal(r.exitPhotoRequired,true);
  await db.exec(`reset role;select set_config('test.clock','2026-11-04 08:00:00',false);`);
  await who(14);assert.equal((await ready()).variant,'Mujeres');await fails("select set_work_uniform('013','Hombres')",[],/permiso/);
  await who(6);assert.equal((await ready()).variant,'Hombres');await fails("select set_work_uniform('006','Mujeres')",[],/permiso/);
  assert.equal((await rpc("select work_uniform_color('Hombres','2026-11-05') c")).c,'Verde');assert.equal((await rpc("select work_uniform_color('Mujeres','2026-11-05') c")).c,'Negro');
  // No se puede brincar checklist mediante el guardado modular de una asistencia propia.
  await fails("insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values('bypass','006','Matriz','2026-11-04','{\"in\":\"08:00\"}',auth.uid())",[],/checklist/);
  console.log('Pedidos/checadas: calendario, secuencia, apoyo y reasignación, privacidad, fotos, incidencias y uniforme verificados.');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message, e.where??"", e.internalQuery??"");process.exitCode=1;});
