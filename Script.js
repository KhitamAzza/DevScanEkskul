const API_URL = "https://script.google.com/macros/s/AKfycbzwgwoKQNXSWn7BrwlzZe1XmVlY0JnGgA6CKY7cjVUXols6Oo_7IyBIiuVDmoQh__wO/exec";

const OPERATORS = {
  "ekstabog": { name: "Enggarsari", ekstra: "Tata Boga" },
  "eksapmr": { name: "Pak Budi", ekstra: "PMR" },
  "eksbasket": { name: "Bu Siti", ekstra: "Basket" },
  "eksfutsal": { name: "Pak Agus", ekstra: "Futsal" }
};

let currentOperator = null;
let currentEkstra = null;
let allStudents = [];
let lastScan = 0;
let sendTimer = null;
let qr = null;
let currentScanId = null;
let isSending = false;

// BARCODE SCANNER VARIABLES
let barcodeBuffer = "";
let lastKeyTime = 0;
const BARCODE_TIMEOUT = 50;
const MIN_BARCODE_LENGTH = 5;

// LAYOUT MODE
let scanMode = localStorage.getItem("scanMode") || "camera";

// DOM ELEMENTS - Existing
const loginScreen = document.getElementById("loginScreen");
const mainApp = document.getElementById("mainApp");
const missingScreen = document.getElementById("missingScreen");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const operatorNameEl = document.getElementById("operatorName");
const operatorEkstraEl = document.getElementById("operatorEkstra");
const statusEl = document.getElementById("status");
const missingListEl = document.getElementById("missingList");

// NEW DOM ELEMENTS for Bento Layout
const emptyState = document.getElementById("emptyState");
const studentInfo = document.getElementById("studentInfo");
const cardActions = document.getElementById("cardActions");
const studentPhoto = document.getElementById("studentPhoto");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const studentName = document.getElementById("studentName");
const studentClass = document.getElementById("studentClass");
const studentID = document.getElementById("studentID");
const scanTime = document.getElementById("scanTime");
const pelanggaranBtn = document.getElementById("pelanggaranBtn");
const pelanggaranStatus = document.getElementById("pelanggaranStatus");
const studentCard = document.getElementById("studentCard");
const missingFab = document.getElementById("missingFab");
const fabCount = document.getElementById("fabCount");
const missingTileValue = document.getElementById("missingTileValue");
const modeTileValue = document.getElementById("modeTileValue");
const timeTileValue = document.getElementById("timeTileValue");
const reader = document.getElementById("reader");

function playSound(soundId) {
  const sound = document.getElementById(soundId);
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(e => console.log("Sound blocked:", e));
  }
}

/* BARCODE SCANNER DETECTION */
document.addEventListener("keydown", function(e) {
  // Space key for ILLEGAL (when student card is shown)
  if (e.code === "Space" && currentScanId && studentCard.classList.contains("visible")) {
    e.preventDefault();
    markPelanggaran();
    return;
  }
  
  // Barcode detection
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (!currentOperator || mainApp.style.display === "none") return;
  
  const now = Date.now();
  const timeDiff = now - lastKeyTime;
  lastKeyTime = now;
  
  if (timeDiff > BARCODE_TIMEOUT) {
    barcodeBuffer = "";
  }
  
  if (e.key.length === 1) {
    barcodeBuffer += e.key;
  } else if (e.key === "Enter") {
    if (barcodeBuffer.length >= MIN_BARCODE_LENGTH) {
      e.preventDefault();
      handleBarcodeScan(barcodeBuffer);
    }
    barcodeBuffer = "";
  }
});

function handleBarcodeScan(scannedId) {
  console.log("Barcode scanned:", scannedId);
  const cleanId = scannedId.trim();
  
  if (isSending) {
    statusEl.textContent = "⏳ Tunggu pengiriman selesai...";
    statusEl.className = "error";
    return;
  }
  
  processStudentScan(cleanId);
}

/* MODE TOGGLE FUNCTIONS */
function toggleMode() {
  if (scanMode === "camera") {
    scanMode = "scanner";
    localStorage.setItem("scanMode", "scanner");
    if (qr) qr.stop();
    applyLayout();
  } else {
    scanMode = "camera";
    localStorage.setItem("scanMode", "camera");
    startScanner();
    applyLayout();
  }
  updateModeButton();
}

function updateModeButton() {
  const btn = document.getElementById("modeToggle");
  if (btn) {
    btn.textContent = scanMode === "camera" ? "📷 Camera" : "⌨️ Scan";
  }
}

function applyLayout() {
  const body = document.body;
  const isMobile = window.innerWidth < 768;
  
  // Remove all mode classes
  body.classList.remove("pc-camera-mode", "pc-scanner-mode", "mobile-scanner-mode");
  
  if (isMobile) {
    if (scanMode === "scanner") {
      body.classList.add("mobile-scanner-mode");
    }
  } else {
    if (scanMode === "camera") {
      body.classList.add("pc-camera-mode");
    } else {
      body.classList.add("pc-scanner-mode");
    }
  }
}

/* MARK PELANGGARAN */
function markPelanggaran() {
  if (!currentScanId) return;
  if (isSending) {
    statusEl.textContent = "⏳ Tunggu pengiriman selesai...";
    statusEl.className = "error";
    return;
  }
  
  let scans = JSON.parse(localStorage.getItem("scanQueue") || "[]");
  
  let found = false;
  for (let i = scans.length - 1; i >= 0; i--) {
    if (scans[i].id === currentScanId && scans[i].type !== "ILLEGAL") {
      scans[i].type = "ILLEGAL";
      found = true;
      break;
    }
  }
  
  if (!found) {
    statusEl.textContent = "Tidak dapat menandai - data sudah terkirim atau sudah ditandai";
    statusEl.className = "error";
    return;
  }
  
  localStorage.setItem("scanQueue", JSON.stringify(scans));
  playSound("illegalSound");
  
  pelanggaranBtn.classList.remove("visible");
  pelanggaranBtn.style.display = "none";
  pelanggaranStatus.classList.add("visible");
  statusEl.className = "error";
  statusEl.textContent = "✔ SISWA TELAH DITANDAI ILLEGAL";
  
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendQueue, 10000);
}

/* AUTO LOGIN */
function checkAutoLogin() {
  const password = passwordInput.value.trim().toLowerCase();
  if (OPERATORS[password]) {
    doLogin();
  }
}

/* LOGIN */
function doLogin() {
  const password = passwordInput.value.trim().toLowerCase();
  
  if (OPERATORS[password]) {
    currentOperator = OPERATORS[password].name;
    currentEkstra = OPERATORS[password].ekstra;
    
    operatorNameEl.textContent = currentOperator;
    operatorEkstraEl.textContent = currentEkstra;
    
    loginScreen.style.display = "none";
    mainApp.style.display = "block";
    loginError.style.display = "none";
    
    // Apply layout before loading
    applyLayout();
    updateModeButton();
    
    // Start clock
    startClock();
    
    loadStudentsAndUpdateCount();
    
    // Only start camera if in camera mode
    if (scanMode === "camera") {
      startScanner();
    }
  } else {
    loginError.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
  }
}

/* LOGOUT */
function doLogout() {
  if (qr) qr.stop().catch(() => {});
  currentOperator = null;
  currentEkstra = null;
  allStudents = [];
  currentScanId = null;
  stopClock();
  mainApp.style.display = "none";
  missingScreen.style.display = "none";
  loginScreen.style.display = "flex";
  passwordInput.value = "";
}

/* LOAD STUDENTS */
async function loadStudentsAndUpdateCount() {
  showLoading(true);
  try {
    const today = new Date().toLocaleDateString("id-ID");
    const res = await fetch(API_URL + "?action=getStudentsByEkstra&ekstra=" + encodeURIComponent(currentEkstra) + "&date=" + encodeURIComponent(today));
    const data = await res.json();
    
    if (data.status === "ok") {
      allStudents = data.data;
      
      // Update mode tile
      if (data.isPagiPeriod) {
        operatorEkstraEl.textContent = "MODE PAGI (GLOBAL)";
        operatorEkstraEl.classList.add("pagi-mode");
        modeTileValue.textContent = "PAGI";
        modeTileValue.className = "tile-value tile-mode-pagi";
      } else {
        operatorEkstraEl.textContent = currentEkstra;
        operatorEkstraEl.classList.remove("pagi-mode");
        modeTileValue.textContent = "EKSTRA";
        modeTileValue.className = "tile-value tile-mode-ekstra";
      }
      
      updateMissingDisplay();
    } else {
      statusEl.textContent = "Gagal memuat data";
      statusEl.className = "error";
    }
  } catch (err) {
    console.error("Error:", err);
    statusEl.textContent = "Error koneksi";
    statusEl.className = "error";
  }
  showLoading(false);
}

/* MISSING FUNCTIONS */
function updateMissingDisplay() {
  const missing = getMissingStudents();
  
  // Update tile value
  const tileValue = document.getElementById('missingTileValue');
  if (tileValue) tileValue.textContent = missing.length;
  
  // Store for list view
  window.missingStudents = missing;
}

function getMissingStudents() {
  const hour = new Date().getHours();
  const isEkstraPeriod = hour >= 8 && hour < 22;
  
  return allStudents.filter(s => {
    const status = s.status || "";
    
    if (["ILLEGAL", "HADIR", "EKSTRA"].includes(status)) {
      return false;
    }
    
    if (isEkstraPeriod && status === "PAGI") {
      return true;
    }
    
    if (!status) {
      return true;
    }
    
    return false;
  });
}

function showMissingList() {
  const hour = new Date().getHours();
  const isEkstraPeriod = hour >= 8 && hour < 22;
  const missing = window.missingStudents || [];
  
  if (missing.length === 0) {
    missingListEl.innerHTML = `
      <div class="missing-empty">
        <div class="emoji">🎉</div>
        <div>Semua siswa sudah absen!</div>
      </div>
    `;
  } else {
    missingListEl.innerHTML = missing.map(s => {
      let statusNote = "";
      if (isEkstraPeriod && s.status === "PAGI") {
        statusNote = '<div class="missing-status-note">(PAGI saja)</div>';
      }
      
      return `
        <div class="missing-item">
          <div>
            <div class="missing-name">${s.nama}</div>
            <div class="missing-kelas">Kelas ${s.kelas}</div>
            ${statusNote}
          </div>
        </div>
      `;
    }).join("");
  }
  
  mainApp.style.display = "none";
  missingScreen.style.display = "flex";
}

function hideMissingList() {
  missingScreen.style.display = "none";
  mainApp.style.display = "block";
}

/* CAMERA SCANNER */
async function startScanner() {
  // Don't start if in scanner mode
  if (scanMode === "scanner") return;
  
  try {
    qr = new Html5Qrcode("reader");
    const devices = await Html5Qrcode.getCameras();
    
    if (!devices || devices.length === 0) {
      statusEl.textContent = "Kamera tidak ditemukan";
      statusEl.className = "error";
      return;
    }
    
    let cameraId = devices[0].id;
    for (const cam of devices) {
      const name = (cam.label || "").toLowerCase();
      if (name.includes("back") || name.includes("rear") || name.includes("environment")) {
        cameraId = cam.id;
        break;
      }
    }
    
    await qr.start(cameraId, { fps: 12, qrbox: { width: 250, height: 250 } }, onScanSuccess);
    //statusEl.textContent = "Arahkan QR ke kamera";
    statusEl.className = "scanning";
    reader.classList.add("scanning");
    
  } catch (err) {
    statusEl.textContent = "Error kamera: " + err.message;
    statusEl.className = "error";
  }
}

/* UNIFIED SCAN HANDLER */
function onScanSuccess(decodedText) {
  processStudentScan(decodedText);
}

function processStudentScan(decodedText) {
  if (isSending) {
    statusEl.textContent = "⏳ Tunggu pengiriman selesai...";
    statusEl.className = "error";
    return;
  }
  
  const now = Date.now();
  if (now - lastScan < 2000) return;
  lastScan = now;
  
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 22) {
    statusEl.textContent = "❌ Di luar jam absensi";
    statusEl.className = "error";
    playSound("errorSound");
    return;
  }
  
  const student = allStudents.find(s => s.id === decodedText);
  if (!student) {
    statusEl.textContent = "❌ Siswa tidak terdaftar di " + currentEkstra;
    statusEl.className = "error";
    playSound("errorSound");
    return;
  }
  
  const isEkstraPeriod = hour >= 8 && hour < 22;
  let scanType = isEkstraPeriod ? "EKSTRA" : "PAGI";
  
  if (student.status === "ILLEGAL") {
    statusEl.textContent = "❌ " + student.nama + " sudah ditandai ILLEGAL";
    statusEl.className = "error";
    return;
  }
  
  if (scanType === "PAGI" && student.status === "PAGI") {
    statusEl.textContent = "❌ " + student.nama + " sudah scan PAGI";
    statusEl.className = "error";
    return;
  }
  
  if (scanType === "EKSTRA" && (student.status === "EKSTRA" || student.status === "HADIR" || student.status === "TERLAMBAT")) {
    statusEl.textContent = "❌ " + student.nama + " sudah scan EKSTRA";
    statusEl.className = "error";
    return;
  }
  
  let scans = JSON.parse(localStorage.getItem("scanQueue") || "[]");
  const existsInQueue = scans.some(s => s.id === decodedText && s.type === scanType);
  if (existsInQueue) {
    statusEl.textContent = "❌ " + student.nama + " sudah di queue";
    statusEl.className = "error";
    return;
  }
  
  scans.push({
    id: decodedText,
    type: scanType,
    time: now,
    operator: currentOperator
  });
  localStorage.setItem("scanQueue", JSON.stringify(scans));
  
  playSound("beepSound");
  statusEl.textContent = "✔ " + student.nama + " (" + scanType + ")";
  statusEl.className = "ok";
  
  // Visual feedback on camera
  reader.classList.remove("scanning");
  reader.classList.add("success");
  setTimeout(() => reader.classList.remove("success"), 300);
  
  showStudentCard(student, scanType);
  
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendQueue, 15000);
}

/* SHOW STUDENT CARD - Updated for new structure */
function showStudentCard(student, scanType) {
  currentScanId = student.id;
  
  // Hide empty state, show info
  emptyState.style.display = "none";
  studentInfo.style.display = "grid";
  cardActions.style.display = "flex";
  
  // Update photo
  if (student.foto) {
    studentPhoto.src = student.foto;
    studentPhoto.style.display = "block";
    photoPlaceholder.style.display = "none";
  } else {
    studentPhoto.style.display = "none";
    photoPlaceholder.style.display = "flex";
  }
  
  // Update text
  studentName.textContent = student.nama;
  studentClass.textContent = "Kelas " + student.kelas;
  studentID.textContent = student.id;
  
  // Update time with type
  const timeStr = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  scanTime.textContent = scanType + " " + timeStr;
  scanTime.className = scanType === "EKSTRA" ? "late" : "";
  
  // Reset ILLEGAL button
  pelanggaranBtn.style.display = "block";
  pelanggaranBtn.classList.add("visible");
  pelanggaranBtn.disabled = false;
  pelanggaranStatus.style.display = "none";
  pelanggaranStatus.classList.remove("visible");
  
  // Show card with animation
  studentCard.style.display = "block";
  // Trigger reflow for animation
  void studentCard.offsetWidth;
  studentCard.classList.add("visible");
}

/* CLOSE STUDENT CARD MANUALLY */
function closeStudentCard() {
  studentCard.classList.remove("visible");
  setTimeout(() => {
    studentCard.style.display = "none";
    currentScanId = null;
  }, 200);
}

/* SEND QUEUE */
function sendQueue() {
  if (isSending) return;
  
  const scans = JSON.parse(localStorage.getItem("scanQueue") || "[]");
  if (scans.length === 0) return;
  
  isSending = true;
  
  if (qr) {
    qr.stop().then(() => {
      statusEl.textContent = "⏳ Mengirim " + scans.length + " data...";
      doSend(scans);
    }).catch(() => {
      doSend(scans);
    });
  } else {
    doSend(scans);
  }
}

function doSend(scans) {
  const encodedData = encodeURIComponent(JSON.stringify(scans));
  fetch(API_URL + "?action=bulkScan&data=" + encodedData)
    .then(r => r.json())
    .then(data => {
      if (data.status === "ok") {
        localStorage.removeItem("scanQueue");
        statusEl.textContent = "✔ " + scans.length + " data terkirim";
        statusEl.className = "ok";
        loadStudentsAndUpdateCount();
      } else {
        statusEl.textContent = "❌ Gagal mengirim";
        statusEl.className = "error";
      }
    })
    .catch(err => {
      statusEl.textContent = "❌ Network error";
      statusEl.className = "error";
    })
    .finally(() => {
      isSending = false;
      // Only restart camera if in camera mode
      if (scanMode === "camera") {
        startScanner();
      }
    });
}

/* UTILITIES */
function showLoading(show) {
  document.getElementById("loadingOverlay").style.display = show ? "flex" : "none";
}

passwordInput.addEventListener("keypress", function(e) {
  if (e.key === "Enter") doLogin();
});

window.addEventListener("online", () => {
  const status = document.getElementById("connectionStatus");
  status.textContent = "🟢 Online";
  status.className = "online";
});

window.addEventListener("offline", () => {
  const status = document.getElementById("connectionStatus");
  status.textContent = "🔴 Offline";
  status.className = "offline";
});

// HANDLE RESIZE
window.addEventListener("resize", () => {
  if (currentOperator) {
    applyLayout();
  }
});

/* ============================================
   NEW FUNCTIONS for Layout
   ============================================ */

// Initialize missing tile click handler
function initMissingTileClick() {
  const missingTile = document.getElementById('missingTile');
  if (missingTile) {
    missingTile.addEventListener('click', showMissingList);
    missingTile.style.cursor = 'pointer';
  }
}

// Clock for bottom tile
let clockInterval = null;

function startClock() {
  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  timeTileValue.textContent = timeStr;
  
  // Update big time if exists (desktop)
  const timeBig = document.getElementById("timeBig");
  if (timeBig) {
    timeBig.textContent = timeStr;
  }
}

// Auto-focus password on load and init click handlers
window.addEventListener("DOMContentLoaded", () => {
  updateModeButton();
  if (passwordInput) passwordInput.focus();
  initMissingTileClick(); // Added: Initialize missing tile click
});