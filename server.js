import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app=express();
app.use(cors({origin:true,credentials:false}));
app.use(express.json({limit:'1mb'}));

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url||!key) throw new Error('SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY ausentes');

const anon=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const authed=(token)=>createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:`Bearer ${token}`}}
});
const tokenOf=req=>{
  const h=req.headers.authorization||'';
  return h.startsWith('Bearer ')?h.slice(7):'';
};

app.get('/health',(_req,res)=>res.json({ok:true,service:'iqa-facil-api'}));

app.post('/auth/signup',async(req,res)=>{
  const {email,password}=req.body||{};
  const {data,error}=await anon().auth.signUp({email,password});
  if(error) return res.status(400).json({error:error.message});
  res.json({user:data.user,session:data.session});
});

app.post('/auth/login',async(req,res)=>{
  const {email,password}=req.body||{};
  const {data,error}=await anon().auth.signInWithPassword({email,password});
  if(error) return res.status(400).json({error:error.message});
  res.json({user:data.user,session:data.session});
});

app.post('/auth/reset',async(req,res)=>{
  const {email,redirectTo}=req.body||{};
  const {error}=await anon().auth.resetPasswordForEmail(email,redirectTo?{redirectTo}:undefined);
  if(error) return res.status(400).json({error:error.message});
  res.json({ok:true});
});

app.get('/me',async(req,res)=>{
  const token=tokenOf(req); if(!token) return res.status(401).json({error:'Não autenticado'});
  const {data,error}=await anon().auth.getUser(token);
  if(error||!data.user) return res.status(401).json({error:'Sessão inválida'});
  res.json({user:data.user});
});

app.get('/measurements',async(req,res)=>{
  const token=tokenOf(req); if(!token) return res.status(401).json({error:'Não autenticado'});
  const db=authed(token);
  const {data,error}=await db.from('iqa_measurements').select('*').order('collected_at',{ascending:false});
  if(error) return res.status(400).json({error:error.message});
  res.json({items:data||[]});
});

app.post('/measurements',async(req,res)=>{
  const token=tokenOf(req); if(!token) return res.status(401).json({error:'Não autenticado'});
  const base=anon();
  const {data:u,error:ue}=await base.auth.getUser(token);
  if(ue||!u.user) return res.status(401).json({error:'Sessão inválida'});
  const h=req.body||{};
  const payload={
    user_id:u.user.id,
    local:h.local||'Ponto não informado',
    collected_at:h.collected_at||new Date().toISOString(),
    responsible:h.responsible||null,
    notes:h.notes||null,
    latitude:Number.isFinite(h.latitude)?h.latitude:null,
    longitude:Number.isFinite(h.longitude)?h.longitude:null,
    altitude_m:Number.isFinite(h.altitude_m)?h.altitude_m:null,
    iqa:Number(h.iqa),
    class:h.class||null,
    manual:!!h.manual,
    values:h.values||{},
    qis:h.qis||{}
  };
  const db=authed(token);
  const {data,error}=await db.from('iqa_measurements').insert(payload).select().single();
  if(error) return res.status(400).json({error:error.message});
  res.status(201).json(data);
});

app.delete('/measurements/:id',async(req,res)=>{
  const token=tokenOf(req); if(!token) return res.status(401).json({error:'Não autenticado'});
  const db=authed(token);
  const {error}=await db.from('iqa_measurements').delete().eq('id',req.params.id);
  if(error) return res.status(400).json({error:error.message});
  res.json({ok:true});
});

app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(500).json({error:'Erro interno'});
});

const port=process.env.PORT||10000;
app.listen(port,'0.0.0.0',()=>console.log(`IQA-Fácil API na porta ${port}`));
