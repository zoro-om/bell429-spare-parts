import { json } from "../../_lib/auth.js";

function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hashPassword(password){
 const iterations=210000,salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);
 return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}
export async function onRequestPost(context){
 const token=context.request.headers.get("X-Setup-Token")||"";
 if(!context.env.SETUP_TOKEN || token!==context.env.SETUP_TOKEN)return json({error:"Not found"},404);
 const count=await context.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
 if(Number(count?.n||0)!==0)return json({error:"Setup already completed"},409);
 const b=await context.request.json().catch(()=>null);
 const username=String(b?.username||"").trim();const password=String(b?.password||"");
 if(!/^[A-Za-z0-9._-]{3,40}$/.test(username)||password.length<12)return json({error:"Invalid username or password"},400);
 const id=crypto.randomUUID();
 await context.env.DB.prepare("INSERT INTO users(id,username,password_hash,role,permissions,enabled) VALUES(?,?,?,?,?,1)").bind(id,username,await hashPassword(password),"designer","{}").run();
 await context.env.DB.prepare("INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)").bind(id,"initial_setup",id).run();
 return json({ok:true,username},201);
}
