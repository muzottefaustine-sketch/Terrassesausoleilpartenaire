import {put,get} from '@vercel/blob';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {recordOrder,InputError} from '../lib/orders.mjs';
const windows=new Map();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non autorisée.'});}
 const preview=process.env.VERCEL_ENV==='preview';
 const origins=new Set([process.env.PUBLIC_ORIGIN||'https://terrassesausoleilpartenaire.vercel.app']);
 if(preview){for(const key of ['VERCEL_URL','VERCEL_BRANCH_URL'])if(process.env[key])origins.add('https://'+process.env[key]);}
 if(!origins.has(req.headers.origin))return res.status(403).json({error:'Origine non autorisée.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return res.status(415).json({error:'Format incorrect.'});
 // Short, bounded, in-memory abuse protection; no IP address is archived.
 const now=Date.now();for(const [k,v] of windows)if(v.until<now)windows.delete(k);
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown');
 const key=createHash('sha256').update(ip).digest('hex');const window=windows.get(key)||{until:now+60000,count:0};
 if(windows.size>=10000||++window.count>10){res.setHeader('Retry-After','60');return res.status(429).json({error:'Trop de tentatives. Réessayez dans une minute.'});}windows.set(key,window);
 if(!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID)return res.status(503).json({error:'La souscription est momentanément indisponible. Aucun accord ni paiement n’a été enregistré.'});
 try{
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(!raw||Buffer.byteLength(raw)>6000)return res.status(413).json({error:'Demande trop volumineuse.'});
  const input=JSON.parse(raw);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input?.requestId||''))throw new InputError('Référence de demande invalide. Rechargez la page.');
  const terms=await readFile(new URL('../conditions-partenaires-v2.txt',import.meta.url),'utf8');
  const result=await recordOrder(input,{terms,testMode:preview,id:()=>input.requestId,save:async record=>{
   const path=`${preview?'tests':'accords'}/${record.id}.json`;
   const options={access:'private',token:process.env.BLOB_READ_WRITE_TOKEN};
   try{return await put(path,JSON.stringify(record),{...options,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});}
   catch(error){
    // Recover a saved acknowledgement after a lost response, without a second order.
    const existing=await get(path,options);if(!existing||existing.statusCode!==200)throw error;
    const previous=JSON.parse(await new Response(existing.stream).text());
    const comparable=r=>JSON.stringify([r.customer,r.plan,r.context,r.acceptance,r.termsSha256,r.testMode]);
    if(comparable(previous)!==comparable(record))throw new InputError('Cette référence a déjà été utilisée. Rechargez la page avant une nouvelle demande.');
    return {existingRecord:previous};
   }
  }});
  return res.status(201).json(result);
 }catch(e){return res.status(e instanceof InputError||e instanceof SyntaxError?400:503).json({error:e instanceof InputError?e.message:'Impossible de confirmer l’enregistrement. Aucun lien de paiement n’a été ouvert. Contactez contact@soleilenterrasse.com avant de réessayer.'});}
}
