// food-scan.js - camera capture, TF.js MobileNet classification, and QR bill generation
(function(){
  const video = document.getElementById('video');
  const startBtn = document.getElementById('startBtn');
  const captureBtn = document.getElementById('captureBtn');
  const canvas = document.getElementById('snapshot');
  const resultArea = document.getElementById('resultArea');
  const billArea = document.getElementById('billArea');
  const qrcodeEl = document.getElementById('qrcode');
  const scanStatus = document.getElementById('scanStatus');
  const scanStage = document.getElementById('scanStage');

  if (!video || !startBtn || !captureBtn || !canvas || !resultArea || !billArea || !qrcodeEl || !scanStatus || !scanStage) {
    return;
  }

  let stream = null;
  

  function setScanState(state, message) {
    scanStatus.className = 'scan-status-pill';
    scanStage.className = 'scan-stage';
    if (state) {
      scanStatus.classList.add(`is-${state}`);
      scanStage.classList.add(`is-${state}`);
    }
    scanStatus.innerHTML = `<span class="scan-dot"></span>${message}`;
  }

  async function startCamera() {
    try {
      setScanState('scanning', 'Camera live. Point at the food and capture.');
      startBtn.disabled = true;
      captureBtn.disabled = false;
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      setScanState('error', 'Camera access denied or unavailable.');
      alert('Camera access denied or not available.');
      startBtn.disabled = false;
      captureBtn.disabled = true;
    }
  }
``

  function snapshotToCanvas() {
  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    video,
    0,
    0,
    videoWidth,
    videoHeight
  );

  console.log(
    "CAPTURE FULL RESOLUTION:",
    canvas.width,
    "x",
    canvas.height
  );

  return canvas;
}
  function updateControls() {
    captureBtn.disabled = !stream;
    startBtn.disabled = !!stream;
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
      updateControls();
      setScanState('idle', 'Camera stopped. Start again to scan.');
    }
  }

  function normalize(v){
    return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  }

  function findBestMatch(predictions) {
    const menu = window.MENU_ITEMS || [];
    for (const p of predictions) {
      const label = normalize(p.className || p.label || '');
      // try direct name match
      const exact = menu.find(item => normalize(item.name) === label || label.includes(normalize(item.name)));
      if (exact) return { item: exact, score: p.probability || p.prob || 0 };
    }
    // fallback: try partial matches
    for (const item of menu) {
      for (const p of predictions) {
        if (normalize(p.className).includes(normalize(item.name))) return { item: item, score: p.probability || p.prob || 0 };
      }
    }
    return null;
  }

 async function captureAndDetect() {

  const c = snapshotToCanvas();
  console.log("DETECTION CANVAS:", c.width, "x", c.height);

  setScanState('detecting', 'Analyzing the food item...');

  resultArea.innerHTML = `
    <div class="scan-result-card">
      <strong>Detecting food...</strong>
      <div class="text-muted">Please wait.</div>
    </div>
  `;

  try {

    // Canvas image → Blob
    const blob = await new Promise(resolve => {
      c.toBlob(resolve, 'image/jpeg', 0.9);
    });

    console.log("CAPTURED IMAGE:", c.width, "x", c.height);
    console.log("BLOB SIZE:", blob ? blob.size : 0);

    // Prepare image for backend
    const formData = new FormData();
    formData.append('image', blob, 'food.jpg');

    // Send image to Node.js backend
    const response = await fetch('http://127.0.0.1:5000/api/detect', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Detection failed');
    }

    console.log('YOLO Result:', data);

    const detectionText = (data.detection || '').trim();

    if (!detectionText) {
      setScanState('error', 'No food detected.');

      resultArea.innerHTML = `
        <div class="scan-result-card">
          <strong>No food detected.</strong>
          <div class="text-muted">
            Please point the camera clearly at a food item.
          </div>
        </div>
      `;

      return;
    }

    // First detected item
    const firstDetection = detectionText.split('\n').filter(line => line.includes('|')).pop() || '';

    const parts = firstDetection.split('|');

    const foodName = parts[0].trim();
    const confidence = parts[1] ? parseFloat(parts[1]) : 0;

    resultArea.innerHTML = `
      <div class="scan-result-card">
        <strong>Food Detected</strong>
        <div style="margin-top:8px;font-size:18px;">
          ${foodName}
        </div>
        <div class="text-muted">
          Confidence: ${(confidence * 100).toFixed(1)}%
        </div>
      </div>
    `;

    // Use food details returned by backend database
    const menu = window.MENU_ITEMS || [];

    const normalizedFood = normalize(foodName);

    let item = menu.find(
     x => normalize(x.name) === normalizedFood
   );

   // If backend returned database price, use it
   if (item) {
     item = {
     ...item,
     price: data.price ?? item.price,
     available: data.available
   };
 }

    if (item) {

      showDetected(item, confidence);

    } else {

      setScanState(
        'detected',
        'Food detected, but menu item not found.'
      );

      billArea.innerHTML = `
        <div class="scan-result-card">
          <strong>${foodName}</strong>
          <div class="text-muted">
            Food detected successfully, but this item is not available in the current menu.
          </div>
        </div>
      `;
    }

  } catch (error) {

    console.error('Detection Error:', error);

    setScanState(
      'error',
      'Detection failed.'
    );

    resultArea.innerHTML = `
      <div class="scan-result-card">
        <strong>Backend connection failed.</strong>
        <div class="text-muted">
          ${error.message}
        </div>
      </div>
    `;
  }
}

  function showDetected(item, score) {
    setScanState('detected', 'Food detected. Ready for checkout.');
    billArea.innerHTML = `
      <div class="scan-detected-card">
        <div style="font-size:13px;color:var(--ink-500);margin-bottom:8px;">Detected Item</div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:84px;height:84px;border-radius:12px;background:linear-gradient(135deg,#fff3e6,#ffe0b2);display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:var(--brand-600)">🍽️</div>
          <div>
            <div style="font-weight:700;font-size:1.05rem">${item.name}</div>
            <div>${item.desc}</div>
            <div style="margin-top:6px">Price: <strong>${formatINR(item.price)}</strong></div>
          </div>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button id="addToCart" class="btn">Add to Cart</button>
        <button id="generateQR" class="btn btn-ghost">Generate Payment QR (₹${item.price})</button>
        <button id="checkoutBtn" class="btn btn-primary">Checkout & Generate QR (₹${item.price})</button>
      </div>
    `;
    document.getElementById('addToCart').addEventListener('click', ()=>{
      Cart.add(item, 1);
      Toast.show('Added to cart. Redirecting...', 'success');
      setTimeout(() => location.href = 'cart.html', 700);
    });
    document.getElementById('generateQR').addEventListener('click', ()=>goToPaymentFlow(item));
    document.getElementById('checkoutBtn').addEventListener('click', ()=>goToPaymentFlow(item));
  }

  function showSuggestions(predictions){
    setScanState('scanning', 'No confident match yet. Choose from menu.');
    const menu = window.MENU_ITEMS || [];
    const list = menu.slice(0,6).map(i=>`<li style="margin:6px 0;display:flex;align-items:center;gap:8px"><span style="width:36px;height:36px;border-radius:4px;background:linear-gradient(135deg,#fff3e6,#ffe0b2);display:flex;align-items:center;justify-content:center;font-size:1rem">🍽️</span> <button class='btn btn-ghost btn-sm' data-id='${i.id}'>${i.name} — ${formatINR(i.price)}</button></li>`).join('');
    billArea.innerHTML = `<div class="scan-result-card"><strong>Choose item:</strong><ul>${list}</ul></div>`;
    billArea.querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click', e=>{
      const id = parseInt(e.currentTarget.getAttribute('data-id'));
      const item = menu.find(x=>x.id===id);
      showDetected(item, 1);
    }));
  }

  function goToPaymentFlow(item) {
    const tempBill = {
      items: [{ id: item.id, name: item.name, price: item.price, qty: 1 }],
      total: item.price
    };
    Store.set('tempBill', tempBill);
    location.href = 'upi-payment.html';
  }

  startBtn.addEventListener('click', async () => {
    await startCamera();
    updateControls();
  });
  captureBtn.addEventListener('click', async () => {
    await captureAndDetect();
    updateControls();
  });

  updateControls();
})();
