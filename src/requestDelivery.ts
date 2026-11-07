import {supabase,cloudSave,markCloudPending,clearCloudPending} from "./cloudStore";
import type {InternalRequest} from "./requestOverview";
export async function confirmRequestDelivery(request:InternalRequest,current:InternalRequest[]):Promise<InternalRequest>{
 if(!supabase)throw new Error('Sin conexión para confirmar el envío. Conserva el texto y reintenta.');
 const key='xoxo.internalRequests',rows=[request,...current.filter(r=>r.id!==request.id)];
 const revision=markCloudPending(key,rows,[request]);
 try{
  await cloudSave(key,rows);
  const {data,error}=await supabase.from('internal_request_records').select('payload').eq('record_id',request.id).maybeSingle();
  if(error)throw error;
  if(!data?.payload?.receivedAt||data.payload.requestedById!==request.requestedById)throw new Error('El servidor aún no confirmó la recepción.');
  clearCloudPending(key,revision);
  const received=data.payload as InternalRequest;
  try{localStorage.setItem(key,JSON.stringify([received,...current.filter(r=>r.id!==received.id)]));}catch{/* La recepción ya fue confirmada por el servidor. */}
  window.dispatchEvent(new CustomEvent('xoxo-sync',{detail:{key,error:''}}));return received;
 }catch(e){throw new Error(`Envío sin confirmar: ${(e as Error).message}. El texto se conserva para reintentar; no se ha confirmado su entrega al destinatario.`);}
}
