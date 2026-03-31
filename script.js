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
let isSubmittingKode = false;

// BARCODE SCANNER VARIABLES
let barcodeBuffer = "";
let lastKeyTime = 0;
const BARCODE_TIMEOUT = 50;
const MIN_BARCODE_LENGTH = 5;

// LAYOUT MODE
let scanMode = localStorage.getItem("scanMode") || "camera";

// KODE KHUSUS VARIABLES
let currentKodeInput = "";

// DOM ELEMENTS
const loginScreen = document.getElementById("loginScreen");
const mainApp = document.getElementById("mainApp");
const missingScreen = document.getElementById("missingScreen");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const operatorNameEl = document.getElementById("operatorName");
const operatorEkstraEl = document.getElementById("operatorEkstra");
const statusEl = document.getElementById("status");
const missingListEl = document.getElementById("missingList");
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
  if (e.code === "Space" && currentScanId && studentCard.classList.contains("visible")) {
    e.preventDefault();
    markPelanggaran();
    return;
  }
  
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

/* MODE TOGGLE */
function toggleMode() {
  if (scanMode === "camera") {
    scanMode = "scanner";
    localStorage.setItem("scanMode", "scanner");
    if (qr) qr.stop().catch(() => {});
    applyLayout();
    statusEl.textContent = "⌨️ Mode Scanner Aktif";
    statusEl.className = "scanning";
  } else {
    scanMode = "camera";
    localStorage.setItem("scanMode", "camera");
    applyLayout();
    startScanner();
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
    
    applyLayout();
    updateModeButton();
    startClock();
    loadStudentsAndUpdateCount();
    
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
  const tileValue = document.getElementById('missingTileValue');
  if (tileValue) tileValue.textContent = missing.length;
  window.missingStudents = missing;
}

function getMissingStudents() {
  const hour = new Date().getHours();
  const isEkstraPeriod = hour >= 8 && hour < 22;
  
  return allStudents.filter(s => {
    const status = s.status || "";
    if (["ILLEGAL", "HADIR", "EKSTRA"].includes(status)) return false;
    if (isEkstraPeriod && status === "PAGI") return true;
    if (!status) return true;
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
  if (scanMode === "scanner") return;
  
  try {
    const devices = await Html5Qrcode.getCameras();
    
    if (!devices || devices.length === 0) {
      statusEl.textContent = "Kamera tidak ditemukan, gunakan mode scanner";
      statusEl.className = "error";
      return;
    }
    
    let cameraId = devices[devices.length - 1].id;
    for (const cam of devices) {
      const name = (cam.label || "").toLowerCase();
      if (name.includes("back") || name.includes("rear") || name.includes("environment")) {
        cameraId = cam.id;
        break;
      }
    }
    
    qr = new Html5Qrcode("reader");
    await qr.start(cameraId, { fps: 12, qrbox: { width: 250, height: 250 } }, onScanSuccess);
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
  
  scans.push({ id: decodedText, type: scanType, time: now, operator: currentOperator });
  localStorage.setItem("scanQueue", JSON.stringify(scans));
  
  playSound("beepSound");
  statusEl.textContent = "✔ " + student.nama + " (" + scanType + ")";
  statusEl.className = "ok";
  
  reader.classList.remove("scanning");
  reader.classList.add("success");
  setTimeout(() => reader.classList.remove("success"), 300);
  
  showStudentCard(student, scanType);
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendQueue, 15000);
}

/* SHOW STUDENT CARD */
function showStudentCard(student, scanType) {
  currentScanId = student.id;
  
  emptyState.style.display = "none";
  studentInfo.style.display = "grid";
  cardActions.style.display = "flex";
  
  if (student.foto) {
    studentPhoto.src = student.foto;
    studentPhoto.style.display = "block";
    photoPlaceholder.style.display = "none";
    studentPhoto.onerror = function() {
      studentPhoto.style.display = "none";
      photoPlaceholder.style.display = "flex";
    };
  } else {
    studentPhoto.style.display = "none";
    photoPlaceholder.style.display = "flex";
  }
  
  studentName.textContent = student.nama;
  studentClass.textContent = "Kelas " + student.kelas;
  studentID.textContent = student.id;
  
  const timeStr = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  scanTime.textContent = scanType + " " + timeStr;
  scanTime.className = scanType === "EKSTRA" ? "late" : "";
  
  pelanggaranBtn.style.display = "block";
  pelanggaranBtn.classList.add("visible");
  pelanggaranBtn.disabled = false;
  pelanggaranStatus.style.display = "none";
  pelanggaranStatus.classList.remove("visible");
  
  studentCard.style.display = "block";
  void studentCard.offsetWidth;
  studentCard.classList.add("visible");
}

/* CLOSE STUDENT CARD */
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
    }).catch(() => doSend(scans));
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
      if (scanMode === "camera") startScanner();
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

window.addEventListener("resize", () => {
  if (currentOperator) applyLayout();
});

/* CLOCK */
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
  const timeStr = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
  timeTileValue.textContent = timeStr;
  const timeBig = document.getElementById("timeBig");
  if (timeBig) timeBig.textContent = timeStr;
}

/* INIT */
window.addEventListener("DOMContentLoaded", () => {
  updateModeButton();
  if (passwordInput) passwordInput.focus();
  
  // Desktop input handler for Kode Khusus
  const desktopInput = document.getElementById("desktopKodeInput");
  if (desktopInput) {
    desktopInput.addEventListener("input", function(e) {
      e.target.value = e.target.value.replace(/[^0-9]/g, "");
      currentKodeInput = e.target.value;
      updateKodeDisplay();
      if (currentKodeInput.length === 5) {
        submitKodeKhusus();
      }
    });
  }
  
  // Escape key to close modal
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      const modal = document.getElementById("kodeKhususModal");
      if (modal && modal.style.display === "flex") {
        closeKodeKhususModal();
      }
    }
  });
});

/* ============================================
   KODE KHUSUS FUNCTIONS
   ============================================ */

function showKodeKhususModal() {
  currentKodeInput = "";
  updateKodeDisplay();
  const modal = document.getElementById("kodeKhususModal");
  const status = document.getElementById("kodeStatus");
  if (modal) modal.style.display = "flex";
  if (status) {
    status.textContent = "";
    status.style.color = "";
  }
  
  if (window.innerWidth >= 768) {
    const input = document.getElementById("desktopKodeInput");
    if (input) {
      input.value = "";
      input.focus();
    }
  }
}

function closeKodeKhususModal() {
  const modal = document.getElementById("kodeKhususModal");
  if (modal) modal.style.display = "none";
  currentKodeInput = "";
}

function inputDigit(digit) {
  if (currentKodeInput.length < 5) {
    currentKodeInput += digit;
    updateKodeDisplay();
    
    if (currentKodeInput.length === 5) {
      setTimeout(() => submitKodeKhusus(), 300);
    }
  }
}

function backspaceKode() {
  currentKodeInput = currentKodeInput.slice(0, -1);
  updateKodeDisplay();
}

function clearKode() {
  currentKodeInput = "";
  updateKodeDisplay();
}

function updateKodeDisplay() {
  const display = document.getElementById("kodeDisplay");
  if (display) {
    const padded = currentKodeInput.padEnd(5, "_").split("").join(" ");
    display.textContent = padded;
  }
}

async function submitKodeKhusus() {
  const kode = window.innerWidth >= 768 
    ? document.getElementById("desktopKodeInput")?.value 
    : currentKodeInput;
  
  if (!kode || kode.length !== 5) return;
  
  if (isSubmittingKode) return;
  isSubmittingKode = true;
  
  showLoading(true);
  
  try {
    const hour = new Date().getHours();
    const scanType = (hour >= 5 && hour < 8) ? "PAGI" : "EKSTRA";
    
    const res = await fetch(API_URL + "?action=useSpecialCode&code=" + kode + "&operator=" + encodeURIComponent(currentOperator) + "&type=" + scanType);
    const data = await res.json();
    
    const kodeStatus = document.getElementById("kodeStatus");
    
    if (data.status === "ok") {
      playSound("beepSound");
      closeKodeKhususModal();
      
      const student = {
        id: data.studentId,
        nama: data.studentName,
        kelas: data.studentClass,
        foto: data.studentFoto || ""
      };
      
      showStudentCard(student, scanType);
      statusEl.textContent = "✔ " + data.studentName + " (" + scanType + ") - Kode Khusus";
      statusEl.className = "ok";
      
      loadStudentsAndUpdateCount();
      
    } else if (data.status === "already_used") {
      if (kodeStatus) {
        kodeStatus.textContent = "❌ Kode sudah digunakan";
        kodeStatus.style.color = "var(--red)";
      }
      playSound("errorSound");
      currentKodeInput = "";
      updateKodeDisplay();
      const input = document.getElementById("desktopKodeInput");
      if (input) input.value = "";
      
    } else if (data.status === "not_found") {
      if (kodeStatus) {
        kodeStatus.textContent = "❌ Kode tidak ditemukan";
        kodeStatus.style.color = "var(--red)";
      }
      playSound("errorSound");
      currentKodeInput = "";
      updateKodeDisplay();
      const input = document.getElementById("desktopKodeInput");
      if (input) input.value = "";
      
    } else if (data.status === "illegal") {
      if (kodeStatus) {
        kodeStatus.textContent = "❌ Siswa sudah ILLEGAL";
        kodeStatus.style.color = "var(--red)";
      }
      playSound("errorSound");
      
    } else if (data.status === "duplicate") {
      if (kodeStatus) {
        kodeStatus.textContent = "❌ Sudah absen " + scanType;
        kodeStatus.style.color = "var(--red)";
      }
      playSound("errorSound");
      
    } else {
      if (kodeStatus) {
        kodeStatus.textContent = "❌ " + (data.message || "Error");
        kodeStatus.style.color = "var(--red)";
      }
    }
    
  } catch (err) {
    const kodeStatus = document.getElementById("kodeStatus");
    if (kodeStatus) {
      kodeStatus.textContent = "❌ Network error";
      kodeStatus.style.color = "var(--red)";
    }
  }
  
  isSubmittingKode = false;
  showLoading(false);
}
