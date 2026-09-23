const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/centroOperation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const sql = exportsObject.CENTRO_TASKS.map(task => `insert into public.centro_task_templates(task_id,definition) values ('${task.id}', '${JSON.stringify(task).replaceAll("'", "''")}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;`).join('\n');
const path = 'supabase-centro-operation.sql';
const source = fs.readFileSync(path, 'utf8');
const next = source.replace(/-- TEMPLATE_SEED:[\s\S]*?\ncommit;/, `-- TEMPLATE_SEED: generated from src/centroOperation.ts by scripts/centro-templates.cjs.\n${sql}\ncommit;`);
if (process.argv.includes('--check')) {
  if (source !== next) throw new Error('Centro SQL templates are out of date. Run node scripts/centro-templates.cjs');
  console.log('PASS: SQL templates match the operation engine');
} else fs.writeFileSync(path, next);
