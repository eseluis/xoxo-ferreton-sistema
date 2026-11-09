import type {DailyTask} from './data';
export function taskCompletionProblems(task:DailyTask):string[]{
 const problems:string[]=[];if(!task.startedAt)problems.push('Primero inicia la tarea para registrar su realización.');if(task.paused)problems.push('La tarea está pausada. Retómala o solicita la autorización pendiente del superior.');
 if(task.requiresPhoto){if(!task.beforeEvidenceCapture?.dataUrl)problems.push('Falta la foto de antes de realizar la tarea.');if(!task.afterEvidenceCapture?.dataUrl)problems.push('Falta la foto del resultado final.');}
 if((task.processId||task.workflowKind)&&(task.deliveryNote??'').trim().length<10)problems.push('Falta registrar el resultado o folio de entrega con al menos 10 caracteres.');
 if(task.workflowKind==='lummi-review'&&!task.reviewConfirmed)problems.push('Confirma la revisión física y documenta faltantes e incidencias.');
 if(task.workflowKind==='lummi-entry'){if((task.invoiceReference??'').trim().length<3)problems.push('Falta el folio de factura ingresada en Invewin.');if(!task.pricesConfirmed)problems.push('Confirma el ingreso de productos y actualización de precios en Invewin.');}
 if(task.workflowKind==='lummi-display'){const a=task.exhibitedQuantity??'',b=task.storedQuantity??'';if(!/^[0-9]+$/.test(a)||!/^[0-9]+$/.test(b))problems.push('Registra cantidades enteras exhibidas y almacenadas.');else if(Number(a)+Number(b)<=0||Number(a)<0.8*(Number(a)+Number(b)))problems.push('Debes cumplir mínimo 80% en exhibición y máximo 20% almacenado.');}
 if(task.workflowKind==='lummi-demo'&&((task.demoProduct1??'').trim().length<3||(task.demoProduct2??'').trim().length<3||(task.demoProduct1??'').trim().toLowerCase()===(task.demoProduct2??'').trim().toLowerCase()))problems.push('Registra dos productos distintos y la solución que demuestra cada uno.');return problems;
}
