import {useEffect,useRef,useState} from 'react';
export type ActionProblem={title?:string;message?:string;problems?:string[]};
export function showActionError(message:string|string[],title='No se puede completar todavía'){
 const problems=Array.isArray(message)?message:[message];window.dispatchEvent(new CustomEvent<ActionProblem>('xoxo-action-error',{detail:{title,problems}}));
}
export function ActionFeedback(){
 const [problem,setProblem]=useState<ActionProblem>();const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const show=(e:Event)=>setProblem((e as CustomEvent<ActionProblem>).detail);window.addEventListener('xoxo-action-error',show);
 const invalid=(e:Event)=>{const input=e.target as HTMLInputElement;if(!input.validationMessage)return;e.preventDefault();const label=input.labels?.[0]?.textContent?.trim()||input.getAttribute('placeholder')||'Campo obligatorio';showActionError(`${label}: ${input.validationMessage}`,'Faltan datos para continuar');};document.addEventListener('invalid',invalid,true);
 const seen=new WeakMap<Element,string>();const inspect=(element:Element)=>{if(element.closest('[data-action-feedback], [aria-label="Entrega diaria de mostradores y zonas libres"]'))return;const message=element.textContent?.trim();if(!message||seen.get(element)===message)return;seen.set(element,message);setProblem({title:'Revisa lo que falta para continuar',problems:[message]});};
 const scan=(root:Element)=>{if(root.matches('.loginError,[role="alert"]'))inspect(root);root.querySelectorAll('.loginError,[role="alert"]').forEach(inspect);};
 const observer=new MutationObserver(records=>{for(const record of records){if(record.target instanceof Element){const target=record.target.closest('.loginError,[role="alert"]');if(target)inspect(target);}for(const node of record.addedNodes)if(node instanceof Element)scan(node);}});scan(document.body);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 return()=>{window.removeEventListener('xoxo-action-error',show);document.removeEventListener('invalid',invalid,true);observer.disconnect();};},[]);
 useEffect(()=>{if(problem&&!dialog.current?.open)dialog.current?.showModal();else if(!problem&&dialog.current?.open)dialog.current.close();},[problem]);
 return <dialog ref={dialog} className="actionFeedback" data-action-feedback aria-labelledby="actionFeedbackTitle" onCancel={e=>{e.preventDefault();setProblem(undefined);}}><div><h2 id="actionFeedbackTitle">{problem?.title}</h2><ul>{(problem?.problems??[problem?.message??'Revisa los datos requeridos.']).map((p,i)=><li key={i}>{p}</li>)}</ul><p>Corrige lo indicado y vuelve a intentar. Tu captura permanece en la actividad; el sistema no la da por entregada si falta algún requisito.</p><button type="button" className="primary" autoFocus onClick={()=>setProblem(undefined)}>Entendido · volver a mi actividad</button></div></dialog>;
}
