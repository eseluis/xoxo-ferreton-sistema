const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
      create table profiles(employee_number text, branch text);
      insert into profiles values ('101','Matriz');
      create function current_profile() returns profiles language sql stable as $$ select * from profiles limit 1 $$;
      create function can_manage_all() returns boolean language sql stable as $$ select false $$;
      create table app_state(key text primary key,value jsonb,updated_by uuid,updated_at timestamptz default now());`);
    const migration = fs.readFileSync('supabase-fix-opening-sync.sql','utf8');
    await db.exec(migration);
    await db.exec(migration);
    const id = '2026-10-09-Matriz';
    const patch = async (fields, day='2026-10-09', branch='Matriz') => db.query(
      'select patch_store_opening_checks($1::jsonb)',
      [JSON.stringify([{id:`${day}-${branch}`,date:day,branch,...fields}])]);
    await patch({openedAt:'08:10',processComplete:true}, '2026-10-08');
    await patch({managerAuthorizedAt:'08:01'});
    await patch({erpReady:true,cashierAuthorizedAt:'08:05'});
    await patch({openedAt:'08:10'});
    // Una sesión atrasada sólo manda su cambio; no reinicia los demás pasos.
    await patch({cashOpenConfirmedAt:'08:03'});
    let rows = (await db.query('select value from app_state')).rows[0].value;
    const opening = rows.find(x=>x.id===id);
    assert.equal(rows.length,2);
    assert.equal(opening.managerAuthorizedAt,'08:01');
    assert.equal(opening.erpReady,true);
    assert.equal(opening.openedAt,'08:10');
    await patch({openedAt:null});
    rows = (await db.query('select value from app_state')).rows[0].value;
    assert.equal(rows.find(x=>x.id===id).openedAt,null);
    assert.equal(rows.find(x=>x.id===id).erpReady,true);
    await assert.rejects(patch({erpReady:true},'2026-10-09','Sucursal Centro'), /Sin permiso/);
    await assert.rejects(patch({id:'incorrecto'}), /inválido/);
    console.log('PASS: apertura combina acciones de sesiones, conserva historial y valida sucursal e identificador');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
