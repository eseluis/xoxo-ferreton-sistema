const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('src/transactionRetry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const api={};vm.runInNewContext(compiled,{exports:api,setTimeout,Math});
(async()=>{
 let calls=0;const delays=[];
 const success=await api.retryTransaction(async()=>++calls<3?{error:{code:'40P01'}}:{error:null,data:'confirmed'},async ms=>delays.push(ms));
 assert.equal(success.data,'confirmed');assert.equal(calls,3);assert.equal(delays.length,2);
 calls=0;await api.retryTransaction(async()=>{calls++;return {error:{code:'40P01'}};},async()=>{});assert.equal(calls,3);
 for(const code of ['42501','NETWORK','23505']){calls=0;await api.retryTransaction(async()=>{calls++;return {error:{code}};},async()=>{});assert.equal(calls,1);}
 calls=0;await assert.rejects(api.retryTransaction(async()=>{calls++;throw Error('fetch failed');},async()=>{}),/fetch failed/);assert.equal(calls,1);
 calls=0;await api.retryTransaction(async()=>++calls===1?{error:{code:'40001'}}:{error:null},async()=>{});assert.equal(calls,2);
 console.log('PASS: reintentos limitados sólo para transacciones canceladas; no repite errores de red ni de permisos');
})().catch(e=>{console.error(e);process.exitCode=1;});
