const API = 'http://localhost:3001';

function goto(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo(0,0);
}

/* ---------- Helpers ---------- */
function formatINR(n){ try { return Number(n).toLocaleString('en-IN'); } catch { return n; } }
function calcEMI(P, apr, n){
  const r = (apr/100) / 12;
  if (!r) return Math.round(P / n);
  const pow = Math.pow(1+r, n);
  return Math.round(P * r * pow / (pow - 1));
}
function nextEmiDateString(){
  const d = new Date();
  const day = 10;
  let m = d.getMonth(), y = d.getFullYear();
  if (d.getDate() >= day) { m += 1; if (m > 11){ m = 0; y += 1; } }
  const due = new Date(y, m, day);
  const dd = due.getDate().toString().padStart(2,'0');
  const mon = due.toLocaleString('en-IN', { month: 'short' });
  return `${dd} ${mon}`;
}
function advanceDueString(ds){
  const [dd, mon] = (ds || nextEmiDateString()).split(' ');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const i = months.indexOf(mon);
  const next = months[(i+1) % 12];
  return `${dd} ${next}`;
}

/* ---------- Voice: Web Speech API (Speak) ---------- */
function setSpeechLang(code){ window.__SPEECH_LANG__ = code; }

function startSpeechInput() {
  const input = document.getElementById('utterance');
  if (!('webkitSpeechRecognition' in window)) {
    alert("Speech recognition not supported in this browser. Please use Google Chrome or Microsoft Edge.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = (window.__SPEECH_LANG__ || 'hi-IN');
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    voiceIntent();
  };

  recognition.onerror = (e) => {
    console.error("Speech error:", e);
    alert("Speech recognition error: " + e.error);
  };

  recognition.start();
}

/* ---------- Voice co-pilot ---------- */
async function voiceIntent(){
  const utterance = document.getElementById('utterance').value || "Mujhe 20000 loan chahiye 6 months ke liye";
  const r = await fetch(API + '/llm/voice_intent', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ utterance })
  });
  const data = await r.json();
  document.getElementById('amount').value = data.fields.amount;
  document.getElementById('tenure').value = data.fields.tenure;
  document.getElementById('purpose').value = data.fields.purpose;
}

/* ---------- Underwriting ---------- */
async function underwrite(){
  const requested = {
    amount: Number(document.getElementById('amount').value),
    tenure: Number(document.getElementById('tenure').value),
    purpose: document.getElementById('purpose').value
  };
  const payload = { requested };
  if (window.__KYC_ID__) payload.kycId = window.__KYC_ID__;

  const r = await fetch(API + '/underwrite', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const data = await r.json();

  document.getElementById('offer').innerHTML = `
    <p><b>Offer</b>: ₹${formatINR(data.offer.limit)} • ${data.offer.tenure} months • ~${data.offer.apr}% p.a.</p>
    ${data.offer.note ? `<p>${data.offer.note}</p>` : ''}
    <p>Probability: <b>${data.probability}</b></p>
  `;

  const r2 = await fetch(API + '/llm/explain', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ reasons: data.reasons, offer: data.offer, lang: 'HI' })
  });
  const exp = await r2.json();
  document.getElementById('explain').innerHTML = `<p>${exp.text}</p>`;

  // Compute EMI and prime Repayment screen
  const emi = calcEMI(data.offer.limit, data.offer.apr, data.offer.tenure);
  const nextDate = nextEmiDateString();
  window.__EMI_AMOUNT__ = emi;
  window.__EMI_DUE_STR__ = nextDate;

  const repay = document.getElementById('repaycard');
  if (repay) {
    repay.innerHTML = `
      <p>Next EMI: <b>₹${formatINR(emi)} on ${nextDate}</b></p>
      <p>Auto-debit: <b>Enabled</b></p>
    `;
  }

  goto('screen-decision');
}

/* ---------- Sync Center demo ---------- */
function simulateRetry(){
  const bars = ['bar1','bar2','bar3'].map(id=>document.getElementById(id));
  let w1 = 66, w2 = 20, w3 = 0;
  const t = setInterval(()=>{
    w1 = Math.min(100, w1+8);
    w2 = Math.min(100, w2+12);
    w3 = Math.min(100, w3+18);
    bars[0].style.width = w1 + '%';
    bars[1].style.width = w2 + '%';
    bars[2].style.width = w3 + '%';
    if(w1===100 && w2===100 && w3===100){ clearInterval(t); }
  }, 300);
}
function liteUpload(){ alert('Lite upload enabled: media compressed and chunk size reduced.'); }

/* ---------- KYC helpers (show/hide cards) ---------- */
function show(id){ document.getElementById(id).classList.remove('hidden'); }
function hide(id){ document.getElementById(id).classList.add('hidden'); }

function openDocKyc(){ show('dlg-doc'); hide('dlg-face'); hide('dlg-digi'); }
function openFace(){ show('dlg-face'); hide('dlg-doc'); hide('dlg-digi'); }
function startDigi(){ show('dlg-digi'); hide('dlg-doc'); hide('dlg-face'); }

/* ---------- Document KYC (mock) ---------- */
async function docPrecheck(type){
  const r = await fetch(API + '/kyc/doc/precheck', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({type})
  });
  const data = await r.json();
  document.getElementById('docStatus').innerText =
    `UploadId ${data.uploadId} • chunk ${Math.round(data.chunkSize/1024)}KB. Uploading 3 chunks...`;
  for(let i=0;i<3;i++){
    await fetch(API + '/kyc/doc/chunk', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ uploadId:data.uploadId, idx:i, bytesBase64:'', sha256:'demo' })
    });
  }
  const fin = await fetch(API + '/kyc/doc/complete', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ uploadId:data.uploadId, type })
  });
  const done = await fin.json();
  window.__KYC_ID__ = done.kycId;
  document.getElementById('docStatus').innerText =
    `Doc ${done.type}: ${done.verdict}. Extracted name ${done.extracted.name}. kycId=${window.__KYC_ID__}`;
}

/* ---------- Face KYC with camera ---------- */
let __STREAM__ = null;
let __FRAMES__ = [];

async function startCamera(){
  try{
    __STREAM__ = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const v = document.getElementById('cam');
    v.srcObject = __STREAM__;
    document.getElementById('faceStatus').innerText = 'Camera started. Look at the screen.';
    const r = await fetch(API + '/kyc/face/liveness/start', { method:'POST' });
    const data = await r.json();
    window.__FACE_SESSION__ = data.sessionId;
  }catch(e){
    document.getElementById('faceStatus').innerText = 'Camera permission denied.';
  }
}

async function captureSequence(){
  const v = document.getElementById('cam');
  if(!v || !v.srcObject){
    document.getElementById('faceStatus').innerText = 'Start Camera first.';
    return;
  }
  __FRAMES__ = [];
  const c = document.createElement('canvas');
  c.width = 160; c.height = 120;
  const ctx = c.getContext('2d');
  let count = 0;
  const take = () => {
    if(count >= 10){ 
      document.getElementById('faceStatus').innerText = `Captured ${__FRAMES__.length} frames.`;
      return;
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    __FRAMES__.push(c.toDataURL('image/jpeg', 0.6));
    count++;
    setTimeout(take, 180);
  };
  take();
}

async function faceSubmit(){
  if(!__FRAMES__ || __FRAMES__.length < 5){
    document.getElementById('faceStatus').innerText = 'Capture Sequence first (need 5+ frames).';
    return;
  }
  const r = await fetch(API + '/kyc/face/liveness/submit', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ sessionId: window.__FACE_SESSION__ || 'F1', frames: __FRAMES__ })
  });
  const data = await r.json();
  document.getElementById('faceStatus').innerText =
    `Liveness ${data.verdict} (score ${data.livenessScore}${data.reason ? ', '+data.reason : ''})`;
}

async function faceMatch(){
  const r = await fetch(API + '/kyc/face/match', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ kycId: window.__KYC_ID__ || 'KYC_DOC_1' })
  });
  const data = await r.json();
  document.getElementById('faceStatus').innerText =
    `Face match ${data.verdict} (sim ${data.similarity})`;
}

/* ---------- DigiLocker (mock) ---------- */
let __DL__ = { sessionId:null };
async function digiCreate(){
  const r = await fetch(API + '/kyc/digilocker/session', { method:'POST' });
  const data = await r.json();
  __DL__.sessionId = data.sessionId;
  document.getElementById('digiInfo').innerText = `Session ${data.sessionId}. Opening DigiLocker...`;
  window.open(data.authUrl, '_blank');
}
async function digiExchange(){
  const code = 'demo_code';
  const r = await fetch(API + '/kyc/digilocker/exchange', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ code, sessionId: __DL__.sessionId || 'abc' })
  });
  const data = await r.json();
  window.__KYC_ID__ = data.kycId;
  document.getElementById('digiInfo').innerText =
    `DigiLocker ${data.status}. kycId=${data.kycId}, name=${data.person.name}`;
}

/* ---------- Repayment actions ---------- */
async function payNow(){
  const card = document.getElementById('repaycard');
  const amount = window.__EMI_AMOUNT__ || 0;

  card.innerHTML = `<p>Processing payment…</p><p>Amount: <b>₹${formatINR(amount)}</b></p>`;

  try {
    await fetch(API + '/repayment/initiate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ amount })
    });
  } catch {}

  setTimeout(async () => {
    try { await fetch(API + '/repayment/confirm', { method:'POST' }); } catch {}

    const next = advanceDueString(window.__EMI_DUE_STR__ || nextEmiDateString());
    window.__EMI_DUE_STR__ = next;

    card.innerHTML = `
      <p>✅ Payment received.</p>
      <p>Next EMI: <b>₹${formatINR(amount)} on ${next}</b></p>
      <p>Auto-debit: <b>Enabled</b></p>
    `;
  }, 1200);
}

function openReschedule(){
  const card = document.getElementById('repaycard');
  const amount = window.__EMI_AMOUNT__ || 0;
  const next = advanceDueString(window.__EMI_DUE_STR__ || nextEmiDateString());
  card.innerHTML = `
    <p>One-time reschedule selected.</p>
    <p>New due date: <b>${next}</b></p>
    <p>EMI stays: <b>₹${formatINR(amount)}</b></p>
  `;
}
