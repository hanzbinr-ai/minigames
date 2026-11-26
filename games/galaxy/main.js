// Blackhole Throne: boot, title screen, fixed-step loop, local save.
(function () {
const S = self.NTSim, D = S.D, R = self.NTRender, U = self.NTUI, SPR = self.SPR, KEY = 'bt-save-v1';
const G = { st: null, speed: 1, version: '0.1.0', running: false };
const $ = id => document.getElementById(id);
document.title = D.TITLE + ' · Mini Game';
$('title-text').textContent = D.TITLE; $('ver').textContent = 'v' + G.version + ' · prototype';
// optional painted logo / icon (falls back to text + portal icon)
SPR.preload();
SPR.ready('logo').then(logo => { if (logo) { $('logo').src = logo.src; $('logo').alt = D.TITLE; $('logo').hidden = false; $('title-text').hidden = true; } });
SPR.ready('logo-icon').then(icon => { if (icon) $('favicon').href = icon.src; });
G.save = () => { try { localStorage.setItem(KEY, S.save(G.st)); } catch (e) { console.warn('save failed', e); } };
G.newGame = seed => { G.st = S.newGame(seed || (Date.now() % 1e9)); afterLoad(true); G.save(); };
function afterLoad(fresh) {
  $('title').classList.add('hidden');
  const home = S.byId(G.st, G.st.emp.player.home); R.cam.x = home.x + 8; R.cam.y = home.y - 10; R.cam.z = 1;
  U.ui.sel = null; U.ui.fleet = null; U.closeSheet(); U.markSeen(fresh); U.refresh(true); G.running = true;
}
let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
if (saved) { $('t-continue').hidden = false; $('t-continue').onclick = () => { try { G.st = S.load(saved); afterLoad(false); } catch (e) { G.newGame(); } }; }
$('t-new').onclick = () => G.newGame();
R.init($('map')); U.init(G);
addEventListener('resize', () => R.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && G.st) G.save(); });
let last = performance.now(), acc = 0, hudT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(.25, (now - last) / 1000); last = now;
  try { if (G.running) {
    acc += dt * G.speed; let n = 0;
    while (acc >= S.DT && n++ < 64) { S.step(G.st); acc -= S.DT; }
    if ((hudT += dt) > .25) { hudT = 0; U.refresh(); }
    if ((saveT += dt) > 10) { saveT = 0; G.save(); }
    R.draw(G.st, U.ui, now / 1000, Math.min(1, acc / S.DT));
  } } catch (e) { console.error(e); acc = 0; } // one bad frame must never kill the loop
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
self.BTG = { G, S, R, U, get st() { return G.st; } };
})();
