async function post(url, body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json(); if(!r.ok||!j.ok) throw new Error(j.error||`Request failed (${r.status})`); return j;
}
export const controlPump=(on,source='dashboard')=>post('/api/control/pump',{on,source});
