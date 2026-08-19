import { requireSession, hasPermission, json } from "../../_lib/auth.js";

function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hashPassword(password){
  const iterations=210000,salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

export async function onRequestGet(context){
 const a=await requireSession(context.request,context.env,false);if(a.response)return a.response;
 if(a.session.role!=="designer")return json({error:"Forbidden"},403);
 const r=await context.env.DB.prepare("SELECT id,username,role,permissions,enabled,created_at FROM users ORDER BY created_at ASC").all();
 return json((r.results||[]).map(x=>({...x,permissions:JSON.parse(x.permissions||"{}"),password_hash:undefined})));
}
export async function onRequestPost(context){
 const a=await requireSession(context.request,context.env,true);if(a.response)return a.response;
 if(a.session.role!=="designer")return json({error:"Forbidden"},403);
 const b=await context.request.json().catch(()=>null);const u=String(b?.username||"").trim();const p=String(b?.password||"");
 if(!/^[A-Za-z0-9._-]{3,40}$/.test(u)||p.length<12||p.length>256)return json({error:"Invalid user or password"},400);
 const permissions={delete:!!b.permissions?.delete,trash:!!b.permissions?.trash,index:!!b.permissions?.index};
 const id=crypto.randomUUID();
 try{await context.env.DB.prepare("INSERT INTO users(id,username,password_hash,role,permissions,enabled) VALUES(?,?,?,?,?,1)").bind(id,u,await hashPassword(p),"supervisor",JSON.stringify(permissions)).run();}
 catch{return json({error:"Username already exists"},409)}
 await context.env.DB.prepare("INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)").bind(a.session.user_id,"create_supervisor",id).run();
 return json({ok:true,id,username:u,permissions},201);
}
export async function onRequestPut(context){
 const a=await requireSession(context.request,context.env,true);if(a.response)return a.response;
 if(a.session.role!=="designer")return json({error:"Forbidden"},403);
 const b=await context.request.json().catch(()=>null);const id=String(b?.id||"");
 if(!id)return json({error:"Missing id"},400);
 const permissions={delete:!!b.permissions?.delete,trash:!!b.permissions?.trash,index:!!b.permissions?.index};
 if(b.password){if(String(b.password).length<12)return json({error:"Password must be at least 12 characters"},400);await context.env.DB.prepare("UPDATE users SET permissions=?,password_hash=? WHERE id=? AND role='supervisor'").bind(JSON.stringify(permissions),await hashPassword(String(b.password)),id).run();}
 else await context.env.DB.prepare("UPDATE users SET permissions=? WHERE id=? AND role='supervisor'").bind(JSON.stringify(permissions),id).run();
 return json({ok:true});
}
export async function onRequestDelete(context){
 const a=await requireSession(context.request,context.env,true);if(a.response)return a.response;
 if(a.session.role!=="designer")return json({error:"Forbidden"},403);
 const id=new URL(context.request.url).searchParams.get("id");if(!id)return json({error:"Missing id"},400);
 await context.env.DB.prepare("DELETE FROM users WHERE id=? AND role='supervisor'").bind(id).run();
 return json({ok:true});
}
