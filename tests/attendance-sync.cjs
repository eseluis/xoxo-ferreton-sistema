const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let rows=[],rpcResult={data:null,error:null},queries=[],rpcCalls=0;
const client={from:table=>({select:columns=>({eq:(field,value)=>({abortSignal:async()=>{queries.push({table,columns,field,value});return {data:rows,error:null};}})})}),rpc:()=>({abortSignal:async()=>{rpcCalls++;return rpcResult;}})};
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/attendanceSync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api,require:()=>({supabase:client}),AbortController,setTimeout,clearTimeout,Error});
const day='2026-11-05',record={employeeId:'011',date:day,in:'08:32',branch:'Sucursal Centro'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {resolve,reject,promise};};
(async()=>{
 rows=[{payload:record,branch:'Sucursal Centro'},{payload:{...record,date:'2026-11-04'},branch:'Matriz'}];
 let result=await api.readAttendanceDay(day);assert.equal(result.length,1);assert.equal(queries[0].field,'record_date');assert.equal(queries[0].value,day);
 rpcResult={data:record,error:null};queries=[];result=await api.confirmAttendancePunch('011',day,'in',null);assert.equal(result.in,'08:32');assert.equal(queries.length,0);
 // Mobile lost the HTTP response after the server committed. A direct read
 // confirms the original punch without submitting it again or replacing time.
 rpcResult={data:null,error:{message:'Failed to fetch'}};queries=[];const before=rpcCalls;
 result=await api.confirmAttendancePunch('011',day,'in',null);assert.equal(result.in,'08:32');assert.equal(rpcCalls-before,1);assert.equal(queries.length,1);
 rows=[];await assert.rejects(api.confirmAttendancePunch('011',day,'in',null),/Failed to fetch/);
 rpcResult={data:{...record,employeeId:'005'},error:null};await assert.rejects(api.confirmAttendancePunch('011',day,'in',null),/no devolvió/);
 const old=deferred(),fresh=deferred(),applied=[],errors=[];let count=0;
 const reader=api.attendanceReader(()=>++count===1?old.promise:fresh.promise,r=>applied.push(r),e=>errors.push(e));
 const reading=reader.refresh();reader.invalidate();await reader.refresh();old.resolve(['cached']);await reading;await new Promise(setImmediate);
 assert.equal(count,2);assert.equal(applied.length,0,'Una lectura anterior a la checada no puede sustituir su confirmación');
 fresh.resolve(['confirmed']);await new Promise(setImmediate);assert.deepEqual(applied,[['confirmed']]);reader.stop();
 const late=deferred();const stopped=api.attendanceReader(()=>late.promise,r=>applied.push(r),e=>errors.push(e));const waiting=stopped.refresh();stopped.stop();late.resolve(['old session']);await waiting;assert.equal(applied.length,1);
 const failed=api.attendanceReader(async()=>{throw Error('offline');},r=>applied.push(r),e=>errors.push(e));await failed.refresh();assert.equal(applied.length,1,'Una falla de red conserva la última asistencia confirmada');assert.equal(errors.length,1);
 const app=fs.readFileSync('src/App.tsx','utf8');const bulk=app.slice(app.indexOf('let refreshing = false;'),app.indexOf('  const user = collaborators.find'));
 assert.ok(!bulk.includes('cloudRefresh<Attendance[]>'),'La consulta de cinco minutos ya no repone una asistencia local pendiente');
 assert.ok(app.includes('document.addEventListener("visibilitychange",refresh)'));assert.ok(app.includes('window.setInterval(refresh,15000)'));
 console.log('PASS: mobile confirmation, lost responses, no local false success, daily lightweight reads, race protection, offline retention and visible-tab resume');
})().catch(e=>{console.error(e);process.exitCode=1;});
