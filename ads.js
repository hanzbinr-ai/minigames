// Placeholder iklan. TIDAK ada kode jaringan iklan asli.
// Aturan: banner hanya di beranda & layar game over; tidak pernah saat bermain.
(function(){
const L=localStorage, off=()=>!navigator.onLine;
function upd(){document.body.classList.toggle('offline',off())}
addEventListener('online',upd);addEventListener('offline',upd);
document.addEventListener('DOMContentLoaded',()=>{upd();if(!document.getElementById('offline')){const d=document.createElement('div');d.id='offline';d.textContent='Mode offline · iklan & game baru muncul saat online';document.body.prepend(d)}});
function slot(cls,txt){const d=document.createElement('div');d.className='ad '+cls;d.textContent=txt||'IKLAN';return d}
function modal(inner){const m=document.createElement('div');m.className='modal';inner.forEach(e=>m.append(e));document.body.append(m);return m}
window.Ads={
  // banner bawah halaman (beranda)
  bottomBanner(){if(!document.querySelector('.ad-bottom'))document.body.append(slot('ad-bottom','IKLAN · banner 320×50'))},
  // banner di dalam layar game over
  inlineBanner(parent){parent.append(slot('ad-inline','IKLAN · banner'))},
  // video berhadiah (opsional, dipilih pemain). Simulasi 3 detik.
  rewarded(done){if(off())return done(false);let n=3;const a=slot('','IKLAN VIDEO · '+n);const m=modal([a]);
    const t=setInterval(()=>{n--;a.textContent='IKLAN VIDEO · '+n;if(n<=0){clearInterval(t);m.remove();done(true)}},1000)},
  // dipanggil tiap game over; interstisial maks 1x / 3 game over & jeda >= 3 menit
  gameOver(){const c=(+L.adGo||0)+1;L.adGo=c;const last=+L.adLast||0;
    if(off()||c<3||Date.now()-last<180000)return false;L.adGo=0;L.adLast=Date.now();
    const b=document.createElement('button');b.className='btn alt';b.textContent='✕ Tutup';
    const m=modal([slot('','IKLAN · layar penuh'),b]);b.onclick=()=>m.remove();return true}
};
if('serviceWorker' in navigator){const s=document.currentScript.src.replace(/ads\.js.*$/,'sw.js');addEventListener('load',()=>navigator.serviceWorker.register(s).catch(e=>console.warn('SW',e)))}
})();
