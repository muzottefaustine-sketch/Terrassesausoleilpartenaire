import {createHash,randomUUID} from 'node:crypto';
export const VERSION='CGV-PARTENAIRES-2026-10-20-v2';
const offers={monthly:{description:'19,90 €/mois, six mois minimum (119,40 €), puis poursuite mensuelle jusqu’à résiliation.',amount:1990,minTotal:11940},annual:{description:'220 € en une fois pour douze mois, sans renouvellement automatique.',amount:22000,minTotal:22000}};
const payments={monthly:'https://pay.qonto.com/payment-links/01a11bcb-f770-7a6a-90ad-5aea27584771?resource_id=01a11bcb-f771-796c-a38a-17e5011146a1',annual:'https://pay.qonto.com/payment-links/01a11bcf-35b4-7ded-80a3-7a7bdfd736f0?resource_id=01a11bcf-35b6-74ca-a4e5-1aea1b4c2fb6'};
export class InputError extends Error {}
export async function recordOrder(input,{save,terms,now=()=>new Date().toISOString(),id=randomUUID,testMode=false}) {
 if(!input || typeof input!=='object' || input.website)throw new InputError('Demande invalide.');
 if(!Object.hasOwn(offers,input.plan)||!['distance','place','incertain'].includes(input.context))throw new InputError('Vérifiez la formule et le contexte.');
 const customer={};
 for(const name of ['restaurant','email']){
  const v=input[name];if(typeof v!=='string'||!v.trim()||v.length>250||/[\r\n\x00-\x1f]/.test(v))throw new InputError('Vérifiez vos coordonnées.');customer[name]=v.trim();
 }
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))throw new InputError('E-mail incorrect.');
 const accepted=input.context==='distance';
 if(accepted&&(input.accept!==true||input.commitment!==true||input.version!==VERSION))throw new InputError('Consultez et acceptez les conditions et votre engagement.');
 if(!terms.includes(VERSION))throw Error('Version des conditions indisponible');
 let record={testMode,id:id(),receivedAt:now(),status:accepted?'accepted_awaiting_payment':'review_required',customer,plan:input.plan,offer:offers[input.plan],context:input.context,acceptance:accepted?{conditions:true,priceAndDuration:true,version:VERSION}:null,terms,termsSha256:createHash('sha256').update(terms).digest('hex'),paymentStatus:'not_verified'};
 // The payment URL must never be returned before durable private storage succeeds.
 const persisted=await save(record);
 if(persisted?.existingRecord)record=persisted.existingRecord;
 const receipt=[...(testMode?['TEST TECHNIQUE — AUCUN CONTRAT RÉEL']:[]),accepted?'CONFIRMATION DE SOUSCRIPTION - PAIEMENT À EFFECTUER':'DEMANDE REÇUE - AUCUNE COMMANDE CONCLUE',`Référence : ${record.id}`,`Reçu le : ${record.receivedAt}`,`Restaurant : ${customer.restaurant}`,`E-mail : ${customer.email}`,offers[input.plan].description,accepted?'Conditions et engagement acceptés. Ce document ne confirme aucun paiement et ne constitue pas une facture.':'Formalités à vérifier avant signature éventuelle et paiement.',`Version : ${VERSION}`,`Empreinte des conditions : ${record.termsSha256}`,'',terms].join('\n');
 return {id:record.id,status:record.status,receipt,paymentUrl:accepted?payments[input.plan]:null};
}
