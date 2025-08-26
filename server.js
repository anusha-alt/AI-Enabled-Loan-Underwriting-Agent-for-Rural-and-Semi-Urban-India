const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({limit: '5mb'}));

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
function scoreFeatures(f){
  const w = { income_avg: 0.00008, inflow_std: -0.00003, bounce_count: -0.6, min_bal_ratio: 0.9, cashflow_stability: 1.2, txn_density: 0.03 };
  const b = -0.5;
  const z = (w.income_avg*(f.income_avg||0)) + (w.inflow_std*(f.inflow_std||0)) + (w.bounce_count*(f.bounce_count||0))
          + (w.min_bal_ratio*(f.min_bal_ratio||0)) + (w.cashflow_stability*(f.cashflow_stability||0)) + (w.txn_density*(f.txn_density||0)) + b;
  return sigmoid(z);
}
function offerFromP(p){
  const limit = Math.round(5000 + p * 45000);
  const apr = Math.round(28 - p * 16);
  const tenure = p > 0.6 ? 6 : 3;
  return {limit, apr, tenure};
}

app.post('/llm/voice_intent', (req,res)=>{
  const { utterance } = req.body;
  let amount = 20000, tenure = 6, purpose = "personal";
  const mAmt = (utterance||"").match(/\b(\d{4,6})\b/);
  if(mAmt) amount = parseInt(mAmt[1],10);
  if(/6\s*month|6\s*mahina|6\s*months/i.test(utterance||"")) tenure = 6;
  else if(/3\s*month|3\s*mahina|3\s*months/i.test(utterance||"")) tenure = 3;
  if(/business|shop|dukaan/i.test(utterance||"")) purpose = "business";
  res.json({ fields: { amount, tenure, purpose }, followUps: amount?[]:["How much do you need?"], confidence: 0.82 });
});

app.post('/underwrite', (req,res)=>{
  const { features, requested } = req.body;
  const f = features || { income_avg: 22000, inflow_std: 4500, bounce_count: 0, min_bal_ratio: 0.18, cashflow_stability: 0.72, txn_density: 38 };
  const p = scoreFeatures(f);
  const offer = offerFromP(p);
  if (req.body && req.body.kycId) {
    offer.limit = Math.round(offer.limit * 1.1);
    offer.apr = Math.max(12, offer.apr - 1);
    offer.note = (offer.note ? offer.note + " " : "") + "KYC verified → improved offer.";
  }
  if(requested && requested.amount){
    if(requested.amount > offer.limit) offer.note = `Requested ₹${requested.amount}. Based on current data, we can safely offer up to ₹${offer.limit}.`;
    else offer.note = `Requested ₹${requested.amount}. We can approve this.`;
  }
  const reasons = [];
  if(f.cashflow_stability >= 0.6) reasons.push('R1_STABLE_INCOME');
  if(f.bounce_count === 0) reasons.push('R2_LOW_BOUNCE');
  if(f.min_bal_ratio >= 0.15) reasons.push('R3_HEALTHY_MIN_BAL');
  if(f.txn_density >= 30) reasons.push('R4_HIGH_ACTIVITY');
  if(f.inflow_std > f.income_avg*0.5) reasons.push('R5_VOLATILE_INFLOW');
  res.json({ probability: Number(p.toFixed(3)), offer, reasons, features: f });
});

app.post('/llm/explain', (req,res)=>{
  const { reasons, lang="EN", offer } = req.body;
  const map = {
    R1_STABLE_INCOME: {EN:"Your income appears steady over months.", HI:"Aapki aay kai mahino se sahi aur sthir lag rahi hai."},
    R2_LOW_BOUNCE: {EN:"We found no recent payment bounces.", HI:"Hamen koi recent bounce nahi mila."},
    R3_HEALTHY_MIN_BAL: {EN:"You keep a healthy minimum bank balance.", HI:"Aap apne khate me accha minimum balance rakhte hain."},
    R4_HIGH_ACTIVITY: {EN:"Your account shows regular digital activity.", HI:"Aapke khate me niyamit digital transaction dikhte hain."},
    R5_VOLATILE_INFLOW: {EN:"Your inflows vary a lot month to month.", HI:"Aapki aamdani mahine dar mahine kaafi badalti rehti hai."}
  };
  const lines = (reasons||[]).map(r => (map[r]||{})[lang] || r);
  const summaryEN = `Offer: ₹${offer?.limit} for ${offer?.tenure} months at ~${offer?.apr}% p.a.`;
  const summaryHI = `Prastav: ₹${offer?.limit}, ${offer?.tenure} mahine, lagbhag ${offer?.apr}% varshik.`;
  res.json({ text: lang==="HI" ? [summaryHI, ...lines].join(" ") : [summaryEN, ...lines].join(" ") });
});

app.post('/kyc/digilocker/session', (req,res)=>{
  res.json({
    authUrl: 'http://localhost:3001/kyc/digilocker/mock-auth?session=abc',
    sessionId: 'abc',
    expireAt: new Date(Date.now()+10*60000).toISOString()
  });
});

app.get('/kyc/digilocker/mock-auth', (req,res)=>{
  const session = req.query.session || 'abc';
  res.set('Content-Type','text/html').send(`
    <html><body style="font-family:Arial;padding:20px">
      <h3>DigiLocker (Mock)</h3>
      <p>Simulating user consent...</p>
      <a href="http://localhost:3001/kyc/digilocker/mock-callback?code=demo_code&session=${session}">
        Click to Approve
      </a>
    </body></html>
  `);
});

app.get('/kyc/digilocker/mock-callback', (req,res)=>{
  const { code, session } = req.query;
  res.set('Content-Type','text/html').send(`
    <html><body style="font-family:Arial;padding:20px">
      <h3>Approved ✅</h3>
      <p>Copy this code for the app to exchange: <b>${code}</b></p>
      <p>Now return to the app and hit "Exchange Code".</p>
    </body></html>
  `);
});

app.post('/kyc/digilocker/exchange', (req,res)=>{
  res.json({
    kycId: 'KYC123',
    person: { name: 'Anusha Venkatramanan', dob: '2004-01-01', gender: 'F' },
    ids: [{ type: 'AADHAAR', last4: '1234' }],
    address: { state: 'KA', pincode: '576104' },
    docs: [{ docType: 'AADHAAR_XML', storageKey: 'mock://aadhaar.xml' }],
    status: 'PASS'
  });
});

app.post('/kyc/doc/precheck', (req,res)=> res.json({ uploadId:'U1', chunkSize:262144, putUrl:'/kyc/doc/chunk' }));
app.post('/kyc/doc/chunk', (req,res)=> res.json({ ok:true, receivedIdx:req.body.idx ?? 0 }));
app.post('/kyc/doc/complete', (req,res)=> res.json({
  kycId:'KYC_DOC_1',
  type: req.body?.type || 'PAN',
  extracted:{ name:'Anusha', dob:'2004-01-01', idno:'ABCDE1234F', address:'Manipal' },
  quality:{ blur:0.1, glare:0.02 },
  verdict:'PASS'
}));

app.post('/kyc/face/liveness/start', (req,res)=> res.json({ sessionId:'F1', challenge:'blink-turn-left' }));

app.post('/kyc/face/liveness/submit', (req,res)=>{
  const frames = (req.body && req.body.frames) || [];
  if (!Array.isArray(frames) || frames.length < 5) {
    return res.json({ livenessScore: 0.2, verdict: 'RETRY', reason: 'INSUFFICIENT_FRAMES' });
  }
  res.json({ livenessScore: 0.88, verdict: 'PASS' });
});

app.post('/kyc/face/match', (req,res)=> res.json({ similarity:0.84, threshold:0.78, verdict:'PASS' }));

app.get('/health', (_,res)=>res.json({ok:true}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log(`Backend running on http://localhost:${PORT}`));
