// IQA-Fácil API (Render + Supabase)
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  (obrigatórias)
//   ALLOWED_ORIGINS  (opcional) lista separada por vírgula, ex.:
//                    https://ernandes-sobreira.github.io,http://localhost:5500
//                    Quando definida, só essas origens passam no CORS e no redirectTo.
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url||!key) throw new Error('SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY ausentes');

const ALLOWED=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);
const originOk=o=>!ALLOWED.length||ALLOWED.includes(String(o||'').replace(/\/$/,''));

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(cors({
  origin:(origin,cb)=>cb(null,!origin||originOk(origin)),
  credentials:false,
  methods:['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders:['Content-Type','Authorization']
}));
app.use((_req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cache-Control','no-store');
  next();
});
app.use(express.json({limit:'100kb'}));

// ---------- utilidades ----------
const anon=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const authed=token=>createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:`Bearer ${token}`}}
});
const tokenOf=req=>{
  const h=req.headers.authorization||'';
  return h.startsWith('Bearer ')?h.slice(7):'';
};
const str=(v,max)=>{const s=String(v??'').trim().slice(0,max);return s||null;};
const numIn=(v,min,max)=>{const n=Number(v);return v!==null&&v!==''&&Number.isFinite(n)&&n>=min&&n<=max?n:null;};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASS=8;

// Limite simples de tentativas por IP (memória do processo).
const hits=new Map();
const limit=(max,windowMs)=>(req,res,next)=>{
  const k=req.ip+'|'+req.path, now=Date.now();
  const arr=(hits.get(k)||[]).filter(t=>now-t<windowMs);
  if(arr.length>=max) return res.status(429).json({error:'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'});
  arr.push(now);hits.set(k,arr);next();
};
setInterval(()=>{const now=Date.now();for(const [k,a] of hits){if(!a.some(t=>now-t<900000))hits.delete(k);}},600000).unref();

// redirectTo só é aceito se pertencer a uma origem permitida.
const safeRedirect=v=>{
  try{
    const u=new URL(String(v||''));
    if(!/^https?:$/.test(u.protocol)) return undefined;
    return originOk(u.origin)?u.href:undefined;
  }catch{return undefined;}
};

// Chamada direta à API de autenticação do Supabase com o token do usuário.
async function gotrue(path,{method='GET',token,body}={}){
  const r=await fetch(`${url}/auth/v1${path}`,{
    method,
    headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    body:body?JSON.stringify(body):undefined
  });
  const data=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,data};
}
async function userOf(req,res){
  const token=tokenOf(req);
  if(!token){res.status(401).json({error:'Não autenticado'});return null;}
  const {data,error}=await anon().auth.getUser(token);
  if(error||!data.user){res.status(401).json({error:'Sessão inválida'});return null;}
  return {token,user:data.user};
}
const publicUser=u=>u?{id:u.id,email:u.email,profile:u.user_metadata?.iqa_profile||null}:null;
const publicSession=s=>s?{access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in,expires_at:s.expires_at,token_type:s.token_type}:null;

const PROFILE_FIELDS={nome:120,instituicao:160,funcao:120,registro:60,municipio:100,uf:2,telefone:30,sobre:1000};
const cleanProfile=p=>{
  const out={};
  for(const [f,max] of Object.entries(PROFILE_FIELDS)){const v=str(p?.[f],max);if(v)out[f]=v;}
  out.updated_at=new Date().toISOString();
  return out;
};

// ---------- rotas ----------
app.get('/health',(_req,res)=>res.json({ok:true,service:'iqa-facil-api',version:'2.1.0'}));

app.post('/auth/signup',limit(5,15*60*1000),async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  const password=String(req.body?.password||'');
  if(!email) return res.status(400).json({error:'Digite seu e-mail.'});
  if(!EMAIL.test(email)||email.length>254) return res.status(400).json({error:'Digite um e-mail válido.'});
  if(password.length<MIN_PASS) return res.status(400).json({error:`A senha precisa ter pelo menos ${MIN_PASS} caracteres.`});
  if(password.length>72) return res.status(400).json({error:'A senha pode ter no máximo 72 caracteres.'});
  const redirectTo=safeRedirect(req.body?.redirectTo);
  const options=redirectTo?{emailRedirectTo:redirectTo}:undefined;
  const {data,error}=await anon().auth.signUp({email,password,options});
  if(error){
    let msg='Não foi possível criar a conta agora. Tente novamente em instantes.';
    if(/rate limit/i.test(error.message)) msg='Muitas tentativas em pouco tempo. Aguarde alguns minutos. Se a conta já foi criada, use Entrar.';
    else if(/already registered|already exists/i.test(error.message)) msg='Este e-mail já possui uma conta. Use Entrar ou Esqueci minha senha.';
    else if(/password/i.test(error.message)) msg='Senha recusada. Use uma senha mais longa e menos comum.';
    return res.status(400).json({error:msg});
  }
  res.json({user:publicUser(data.user),session:publicSession(data.session)});
});

app.post('/auth/login',limit(10,15*60*1000),async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  const password=String(req.body?.password||'');
  if(!email) return res.status(400).json({error:'Digite seu e-mail.'});
  if(!password) return res.status(400).json({error:'Digite sua senha.'});
  const {data,error}=await anon().auth.signInWithPassword({email,password});
  if(error){
    if(/not confirmed/i.test(error.message)) return res.status(400).json({error:'Confirme seu e-mail pelo link que enviamos antes de entrar.'});
    return res.status(400).json({error:'E-mail ou senha incorretos.'});
  }
  res.json({user:publicUser(data.user),session:publicSession(data.session)});
});

app.post('/auth/refresh',limit(60,15*60*1000),async(req,res)=>{
  const refresh_token=String(req.body?.refresh_token||'');
  if(!refresh_token) return res.status(400).json({error:'Sessão ausente.'});
  const r=await gotrue('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token}});
  if(!r.ok) return res.status(401).json({error:'Sessão expirada. Entre novamente.'});
  res.json({user:publicUser(r.data.user),session:publicSession(r.data)});
});

app.post('/auth/reset',limit(3,15*60*1000),async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!email||!EMAIL.test(email)) return res.status(400).json({error:'Digite um e-mail válido.'});
  const redirectTo=safeRedirect(req.body?.redirectTo);
  // Resposta igual exista ou não a conta, para não revelar e-mails cadastrados.
  await anon().auth.resetPasswordForEmail(email,redirectTo?{redirectTo}:undefined).catch(()=>{});
  res.json({ok:true});
});

app.post('/auth/password',limit(5,15*60*1000),async(req,res)=>{
  const ctx=await userOf(req,res); if(!ctx) return;
  const password=String(req.body?.password||'');
  if(password.length<MIN_PASS) return res.status(400).json({error:`A senha precisa ter pelo menos ${MIN_PASS} caracteres.`});
  if(password.length>72) return res.status(400).json({error:'A senha pode ter no máximo 72 caracteres.'});
  const r=await gotrue('/user',{method:'PUT',token:ctx.token,body:{password}});
  if(!r.ok) return res.status(400).json({error:'Não foi possível alterar a senha. Peça um novo link de recuperação e tente de novo.'});
  res.json({ok:true});
});

app.get('/me',async(req,res)=>{
  const ctx=await userOf(req,res); if(!ctx) return;
  res.json({user:publicUser(ctx.user)});
});

app.put('/profile',limit(30,15*60*1000),async(req,res)=>{
  const ctx=await userOf(req,res); if(!ctx) return;
  const profile=cleanProfile(req.body?.profile||{});
  const r=await gotrue('/user',{method:'PUT',token:ctx.token,body:{data:{iqa_profile:profile}}});
  if(!r.ok) return res.status(400).json({error:'Não foi possível salvar o perfil.'});
  res.json({profile});
});

app.get('/measurements',async(req,res)=>{
  const ctx=await userOf(req,res); if(!ctx) return;
  const {data,error}=await authed(ctx.token).from('iqa_measurements')
    .select('*').eq('user_id',ctx.user.id).order('collected_at',{ascending:false}).limit(5000);
  if(error){console.error(error.message);return res.status(400).json({error:'Não foi possível ler as medições.'});}
  res.json({items:data||[]});
});

const PARAMS=['oxigenio','coliformes','ph','dbo','temperatura','nitrogenio','fosforo','turbidez','solidos'];
const cleanNums=o=>{
  const out={};
  for(const k of PARAMS){const n=numIn(o?.[k],0,1e9);if(n!==null)out[k]=n;}
  return out;
};

app.post('/measurements',limit(3000,15*60*1000),async(req,res)=>{
  const ctx=await userOf(req,res); if(!ctx) return;
  const h=req.body||{};
  const iqa=numIn(h.iqa,0,100);
  if(iqa===null) return res.status(400).json({error:'IQA inválido: informe um número entre 0 e 100.'});
  const when=new Date(h.collected_at||Date.now());
  if(Number.isNaN(when.getTime())) return res.status(400).json({error:'Data de coleta inválida.'});
  const values=cleanNums(h.values);
  const c=h.values?._coleta;
  if(c&&typeof c==='object'){
    const coleta={municipio:str(c.municipio,100),uf:str(c.uf,2),corpo:str(c.corpo,120),ambiente:str(c.ambiente,40)};
    if(Object.values(coleta).some(Boolean)) values._coleta=coleta;
  }
  const payload={
    user_id:ctx.user.id,
    local:str(h.local,160)||'Ponto não informado',
    collected_at:when.toISOString(),
    responsible:str(h.responsible,160),
    notes:str(h.notes,1000),
    latitude:numIn(h.latitude,-90,90),
    longitude:numIn(h.longitude,-180,180),
    altitude_m:numIn(h.altitude_m,0,9000),
    iqa,
    class:str(h.class,20),
    manual:!!h.manual,
    values,
    qis:cleanNums(h.qis)
  };
  const {data,error}=await authed(ctx.token).from('iqa_measurements').insert(payload).select().single();
  if(error){console.error(error.message);return res.status(400).json({error:'Não foi possível salvar a medição.'});}
  res.status(201).json(data);
});

app.delete('/measurements/:id',async(req,res)=>{
  const ctx=await userOf(req,res); if(!ctx) return;
  const id=String(req.params.id);
  if(!/^[\w-]{1,64}$/.test(id)) return res.status(400).json({error:'Identificador inválido.'});
  const {error}=await authed(ctx.token).from('iqa_measurements').delete().eq('id',id).eq('user_id',ctx.user.id);
  if(error){console.error(error.message);return res.status(400).json({error:'Não foi possível remover a medição.'});}
  res.json({ok:true});
});

app.use((_req,res)=>res.status(404).json({error:'Rota não encontrada'}));
app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(err?.type==='entity.too.large'?413:500).json({error:'Erro interno'});
});

const port=process.env.PORT||10000;
app.listen(port,'0.0.0.0',()=>console.log(`IQA-Fácil API na porta ${port}`));
