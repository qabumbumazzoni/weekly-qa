let cloudSession=null, cloudRevision=0, cloudConfirmed=null, cloudBusy=false, cloudReady=false;
const cloudConfig=window.QA_CONFIG;
const emptyDB=()=>({version:1,tasks:[],meetings:[],categories:[...cats]});
function cloudStatus(text){$('#saved').textContent=text}
async function cloudRequest(path,body,method='POST'){
 const headers={'apikey':cloudConfig.key,'Content-Type':'application/json'};
 if(cloudSession)headers.Authorization='Bearer '+cloudSession.access_token;
 const response=await fetch(cloudConfig.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const raw=await response.text();let result;try{result=raw?JSON.parse(raw):null}catch{throw Error('Respons server tidak valid')}
 if(!response.ok)throw Error(result?.msg||result?.message||result?.error_description||'Koneksi gagal ('+response.status+')');return result;
}
async function cloudRefreshSession(){if(!cloudSession)throw Error('Silakan login kembali');if(Date.now()<cloudSession.expiresAt-60000)return;const r=await cloudRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:cloudSession.refresh_token});cloudSession={...r,expiresAt:Date.now()+r.expires_in*1000}}
function cloudLock(locked){document.querySelectorAll('main button,main input,main select,#modal button,#modal input,#modal textarea,#modal select').forEach(x=>x.disabled=locked)}
async function cloudRead(){await cloudRefreshSession();const rows=await cloudRequest('/rest/v1/qa_workspace?id=eq.mazzoni&select=data,revision',undefined,'GET');if(!rows?.length)throw Error('Akses QA belum diizinkan atau setup database belum dijalankan.');if(!valid(rows[0].data))throw Error('Format data server tidak valid');return rows[0]}
function cloudApply(row){db=structuredClone(row.data);cloudConfirmed=structuredClone(row.data);cloudRevision=row.revision;render();cloudStatus('● Tersimpan di Supabase')}
async function cloudSave(){
 if(!cloudReady||cloudBusy){alert('Tunggu koneksi / penyimpanan selesai.');return false}
 cloudBusy=true;cloudLock(true);cloudStatus('◌ Menyimpan ke Supabase…');
 try{await cloudRefreshSession();const rows=await cloudRequest('/rest/v1/rpc/qa_save',{expected_revision:cloudRevision,new_data:structuredClone(db)});if(!rows?.length){const draft=structuredClone(db);download('qa-draft-konflik-'+Date.now()+'.json',JSON.stringify(draft,null,2),'application/json');cloudApply(await cloudRead());alert('Ada perubahan dari perangkat lain. Draft Anda diunduh sebagai cadangan; data terbaru sudah dimuat. Tinjau ulang sebelum mengubahnya.');return false}cloudApply(rows[0]);return true}
 catch(e){download('qa-draft-belum-tersimpan-'+Date.now()+'.json',JSON.stringify(db,null,2),'application/json');if(cloudConfirmed)db=structuredClone(cloudConfirmed);render();cloudStatus('⚠ Belum tersimpan: '+e.message);alert('Perubahan belum tersimpan: '+e.message+'\nDraft diunduh sebagai cadangan. Form tetap terbuka bila tersedia. Coba lagi setelah koneksi pulih.');return false}
 finally{cloudBusy=false;cloudLock(false)}
}
function cloudGate(message=''){
 cloudReady=false;cloudSession=null;db=emptyDB();cloudConfirmed=null;render();cloudLock(true);$('#content').innerHTML='';cloudStatus('Login diperlukan');
 $('#cloud-gate').hidden=false;$('#cloud-message').textContent=message;$('#cloud-password').value='';$('#cloud-email').focus();
}
async function cloudLogin(e){e.preventDefault();const button=$('#cloud-login');button.disabled=true;$('#cloud-message').textContent='Menghubungkan…';try{const r=await cloudRequest('/auth/v1/token?grant_type=password',{email:$('#cloud-email').value.trim(),password:$('#cloud-password').value});cloudSession={...r,expiresAt:Date.now()+r.expires_in*1000};const row=await cloudRead();cloudApply(row);cloudReady=true;$('#cloud-gate').hidden=true;$('#cloud-password').value='';$('#cloud-account').textContent=r.user.email;cloudLock(false)}catch(e){cloudSession=null;$('#cloud-message').textContent=e.message}finally{button.disabled=false}}
async function cloudSync(){if(!cloudReady||cloudBusy||$('#modal').open)return;cloudBusy=true;try{const row=await cloudRead();if(row.revision!==cloudRevision)cloudApply(row);else cloudStatus('● Tersinkron · '+new Date().toLocaleTimeString('id-ID'))}catch(e){cloudStatus('⚠ Sinkronisasi tertunda: '+e.message)}finally{cloudBusy=false}}
$('#cloud-form').onsubmit=cloudLogin;
$('#cloud-logout').onclick=async()=>{if(cloudBusy)return;if($('#modal').open)$('#modal').close();try{if(cloudSession)await cloudRequest('/auth/v1/logout',{})}catch{}cloudGate('Anda telah keluar.');$('#cloud-account').textContent=''};
$('#cloud-refresh').onclick=cloudSync;
setInterval(cloudSync,15000);window.addEventListener('focus',cloudSync);window.addEventListener('beforeunload',e=>{if(cloudBusy){e.preventDefault();e.returnValue=''}});
cloudGate();
