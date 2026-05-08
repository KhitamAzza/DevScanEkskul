const API_URL = "https://script.google.com/macros/s/AKfycbzwgwoKQNXSWn7BrwlzZe1XmVlY0JnGgA6CKY7cjVUXols6Oo_7IyBIiuVDmoQh__wO/exec";

const OPERATORS = {
"azkiahasna": { name: "Chusnul Khitam Azza", ekstra: "MASTER", isMaster: true },
 "devkoord1": { name: "Prihanto Wahyu", ekstra: "MASTER", isMaster: true },
 "devtatib1": { name: "Syamsul Arif", ekstra: "MASTER", isMaster: true },
"eksesport": { name: "Masduki Zen", ekstra: "E-Sport" },
"eksfutsal": { name: "Rizky", ekstra: "Futsal" },
"ekspakbola": { name: "Rico Yoga", ekstra: "Sepakbola" },
"eksperdiri": { name: "Yudi Setiono", ekstra: "Perisai diri" },
"eksmusik": { name: "M ismail", ekstra: "Musik" },
"eksminton": { name: "Deni Affandi", ekstra: "Badminton" },
"eksbasket": { name: "Syamsul Arif", ekstra: "Basket" },
"eksbvoli": { name: "Achamd Wahyudi", ekstra: "Bola Voli" },
"eksbanjari": { name: "Rahmad Hidayat", ekstra: "Al-Banjari" },
 "ekstari": { name: "Nila", ekstra: "Seni tari" },
 "ekstabog": { name: "M Iqbal", ekstra: "Tata Boga" },
 "eksarias": { name: "Dina", ekstra: "Tata rias" },
 "ekstapmr": { name: "Nur Khozinatul", ekstra: "PMR" },
 "ekswondo": { name: "jalupaka", ekstra: "Taekwondo" },
 "eksdance": { name: "Ocha", ekstra: "Dance" },
 "ekscinalam": { name: "Ergananta", ekstra: "Pecinta Alam" }
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
    updateQueueBadge();
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
    const op = OPERATORS[password];
    currentOperator = op.name;
    currentEkstra = op.ekstra;
    
    operatorNameEl.textContent = op.name;
    
    // ⭐ MASTER MODE styling
    if (op.isMaster) {
      operatorEkstraEl.textContent = "MASTER MODE - ALL ACCESS";
      operatorEkstraEl.classList.add("master-mode");
    } else {
      operatorEkstraEl.textContent = op.ekstra;
      operatorEkstraEl.classList.remove("master-mode");
    }
    
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
    
    // ⭐ MASTER MODE: Send "ALL" to get all students
    const isMaster = currentEkstra === "MASTER";
    const ekstraParam = isMaster ? "ALL" : currentEkstra;
    
    const res = await fetch(API_URL + "?action=getStudentsByEkstra&ekstra=" + encodeURIComponent(ekstraParam) + "&date=" + encodeURIComponent(today));
    const data = await res.json();
    
    if (data.status === "ok") {
      allStudents = data.data;
      
      if (data.isPagiPeriod) {
        // ⭐ MASTER MODE: Show master styling even in pagi period
        if (isMaster) {
          operatorEkstraEl.textContent = "MASTER MODE - PAGI (GLOBAL)";
          operatorEkstraEl.classList.add("master-mode");
          modeTileValue.textContent = "MASTER";
          modeTileValue.className = "tile-value tile-mode-master";
        } else {
          operatorEkstraEl.textContent = "MODE PAGI (GLOBAL)";
          operatorEkstraEl.classList.remove("master-mode");
          modeTileValue.textContent = "PAGI";
          modeTileValue.className = "tile-value tile-mode-pagi";
        }
      } else {
        // ⭐ MASTER MODE: Show master styling in ekstra period
        if (isMaster) {
          operatorEkstraEl.textContent = "MASTER MODE - ALL EKSTRA";
          operatorEkstraEl.classList.add("master-mode");
          modeTileValue.textContent = "MASTER";
          modeTileValue.className = "tile-value tile-mode-master";
        } else {
          operatorEkstraEl.textContent = currentEkstra;
          operatorEkstraEl.classList.remove("master-mode");
          modeTileValue.textContent = "EKSTRA";
          modeTileValue.className = "tile-value tile-mode-ekstra";
        }
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
// REPLACE updateMissingDisplay function
function updateMissingDisplay() {
  const notScanned = getNotScannedStudents();
  const scanned = getScannedStudents();
  const illegal = getIllegalStudents();
  
  const tileValue = document.getElementById('missingTileValue');
  
  if (notScanned.length === 0) {
    tileValue.innerHTML = '<span style="color: #4CAF50">Scan selesai</span>';
  } else {
    tileValue.innerHTML = `<span style="color: #f44336">${notScanned.length}</span> | <span style="color: #4CAF50">${scanned.length}</span>`;
  }
  
  window.notScannedStudents = notScanned;
  window.scannedStudents = scanned;
  window.illegalStudents = illegal;
}

// ADD these helper functions
function getNotScannedStudents() {
  const now = new Date();
const hour = now.getHours();
const minutes = now.getMinutes();
const timeValue = hour + (minutes / 100);
const isEkstraPeriod = (timeValue >= 9.50 && timeValue < 21.00);
const isPagiPeriod = (timeValue >= 5.00 && timeValue < 8.00);
  
  return allStudents.filter(s => {
    const status = s.status || "";
    if (status === "ILLEGAL") return false;
    if (["HADIR", "EKSTRA", "TERLAMBAT"].includes(status)) return false;
    if (isEkstraPeriod && status === "PAGI") return true;
    if (!status) return true;
    return false;
  });
}

function getScannedStudents() {
  const now = new Date();
const hour = now.getHours();
const minutes = now.getMinutes();
const timeValue = hour + (minutes / 100);
const isEkstraPeriod = (timeValue >= 9.50 && timeValue < 21.00);
const isPagiPeriod = (timeValue >= 5.00 && timeValue < 8.00);
  
  return allStudents.filter(s => {
    const status = s.status || "";
    if (status === "ILLEGAL") return false;
    if (["HADIR", "EKSTRA", "TERLAMBAT"].includes(status)) return true;
    if (!isEkstraPeriod && status === "PAGI") return true;
    return false;
  });
}

function getIllegalStudents() {
  return allStudents.filter(s => s.status === "ILLEGAL");
}

// REPLACE showMissingList function
function showMissingList() {
  const notScanned = window.notScannedStudents || [];
  const scanned = window.scannedStudents || [];
  const illegal = window.illegalStudents || [];
  
  let html = '';
  
  // NOT SCANNED
  if (notScanned.length > 0) {
    html += `<div style="color: #f44336; font-weight: bold; margin: 10px 0;">BELUM SCAN (${notScanned.length})</div>`;
    html += notScanned.map(s => `
      <div class="missing-item" style="border-left: 3px solid #f44336; padding-left: 10px; margin: 5px 0;">
        <div style="font-weight: bold;">${s.nama}</div>
        <div style="font-size: 12px; color: #666;">Kelas ${s.kelas}${s.status === "PAGI" ? ' (PAGI saja)' : ''}</div>
      </div>
    `).join("");
  }
  
  // SEPARATOR
  if (scanned.length > 0 && notScanned.length > 0) {
    html += `<div style="border-top: 1px solid #ccc; margin: 15px 0;"></div>`;
  }
  
  // SCANNED
  if (scanned.length > 0) {
    html += `<div style="color: #4CAF50; font-weight: bold; margin: 10px 0;">SUDAH SCAN (${scanned.length})</div>`;
    html += scanned.map(s => `
      <div class="missing-item" style="border-left: 3px solid #4CAF50; padding-left: 10px; margin: 5px 0; opacity: 0.8;">
        <div style="font-weight: bold;">${s.nama}</div>
        <div style="font-size: 12px; color: #666;">Kelas ${s.kelas} - ${s.status}</div>
      </div>
    `).join("");
  }
  
  // ILLEGAL (BOTTOM)
  if (illegal.length > 0) {
    html += `<div style="color: #d32f2f; font-weight: bold; margin: 15px 0 10px;">ILLEGAL (${illegal.length})</div>`;
    html += illegal.map(s => `
      <div class="missing-item" style="border-left: 3px solid #ffffff; padding-left: 10px; margin: 5px 0; background: #ff0000;">
        <div style="font-weight: bold; color: #eaff00;">${s.nama}</div>
        <div style="font-size: 12px;">Kelas ${s.kelas}</div>
      </div>
    `).join("");
  }
  
  // Empty state
  if (notScanned.length === 0 && scanned.length === 0 && illegal.length === 0) {
    html = '<div style="text-align: center; padding: 20px;">Tidak ada data</div>';
  }
  
  missingListEl.innerHTML = html;
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
  
  const dt = new Date();  // ← CHANGED: was "const now"
  const hour = dt.getHours();  // ← CHANGED: was "now.getHours()"
  const minutes = dt.getMinutes();
  const timeValue = hour + (minutes / 100);

  if (timeValue < 5.00 || timeValue >= 21.00) {
    statusEl.textContent = "❌ Di luar jam absensi";
    statusEl.className = "error";
    playSound("errorSound");
    return;
  }
  
  const student = allStudents.find(s => s.id === decodedText);
  if (!student) {
    statusEl.textContent = "❌ Siswa tidak ditemukan";
    statusEl.className = "error";
    playSound("errorSound");
    return;
  }

  const isMaster = currentEkstra === "MASTER";
  if (!isMaster) {
    const isPagiPeriod = (timeValue >= 5.00 && timeValue < 8.00);
    
    if (!isPagiPeriod && student.ekstra && student.ekstra.toLowerCase() !== currentEkstra.toLowerCase()) {
      statusEl.textContent = "❌ Siswa tidak terdaftar di " + currentEkstra;
      statusEl.className = "error";
      playSound("errorSound");
      return;
    }
  }
  
  const isPagiPeriod = (timeValue >= 5.00 && timeValue < 8.00);
  const isEkstraPeriod = (timeValue >= 9.50 && timeValue < 21.00);

  if (!isPagiPeriod && !isEkstraPeriod) {
    statusEl.textContent = "❌ Di luar jam absensi";
    statusEl.className = "error";
    playSound("errorSound");
    return;
  }

  let scanType = isEkstraPeriod ? "EKSTRA" : "PAGI";
  
  let scans = JSON.parse(localStorage.getItem("scanQueue") || "[]");
  
  const illegalInQueue = scans.some(s => s.id === decodedText && s.type === "ILLEGAL");
  if (illegalInQueue) {
    statusEl.textContent = "❌ " + student.nama + " sudah ditandai ILLEGAL (menunggu sinkronisasi)";
    statusEl.className = "error";
    playSound("errorSound");
    return;
  }
  
  const existsInQueue = scans.some(s => s.id === decodedText && s.type === scanType);
  if (existsInQueue) {
    statusEl.textContent = "❌ " + student.nama + " sudah di queue";
    statusEl.className = "error";
    return;
  }
  
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
  
  scans.push({ id: decodedText, type: scanType, time: now, operator: currentOperator });
  localStorage.setItem("scanQueue", JSON.stringify(scans));
  updateQueueBadge();
  
  playSound("beepSound");
  statusEl.textContent = "✔ " + student.nama + " (" + scanType + ")";
  statusEl.className = "ok";
  
  reader.classList.remove("scanning");
  reader.classList.add("success");
  setTimeout(() => reader.classList.remove("success"), 300);
  
    showStudentCard(student, scanType);
  clearTimeout(sendTimer);

  if (scans.length >= 25) {
    sendQueue();
  } else {
    sendTimer = setTimeout(sendQueue, 30000);
  }
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
    updateQueueBadge();
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

/* UPDATE HOURS RIBBON VISIBILITY */
function updateHoursRibbon() {
  const ribbon = document.getElementById("hoursRibbon");
  if (!ribbon) return;
  
  const dt = new Date();
  const hour = dt.getHours();
  const minutes = dt.getMinutes();
  const timeValue = hour + (minutes / 100);
  
  // Check if outside hours (before 5:00 or after 11:00, or in gap 8:00-9:50)
  const isOutsideHours = timeValue < 5.00 || timeValue >= 21.00 || (timeValue >= 8.00 && timeValue < 9.50);
  
  ribbon.style.display = isOutsideHours ? "block" : "none";
}

/* UPDATE CLOCK WITH DATE */
function updateClock() {
  const now = new Date();
  
  // Format time
  const timeStr = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
  timeTileValue.textContent = timeStr;
  const timeBig = document.getElementById("timeBig");
  if (timeBig) timeBig.textContent = timeStr;
  
  // Format date for the tile label
  const dateStr = now.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
  const timeTile = document.querySelector('.info-tile.time-tile .tile-label');
  if (timeTile) {
    timeTile.innerHTML = `Tanggal <span style="color: var(--text-secondary); font-size: 10px; display: block; margin-top: 2px;">${dateStr}</span>`;
  }
  
  // Update ribbon visibility
  updateHoursRibbon();
}
/* ============================================
   MANUAL SYNC FUNCTIONS
   ============================================ */

// Update queue badge display
function updateQueueBadge() {
  const scans = JSON.parse(localStorage.getItem("scanQueue") || "[]");
  const badge = document.getElementById("syncQueueBadge");
  const btnText = document.getElementById("syncBtnText");
  
  if (badge) {
    badge.textContent = scans.length;
    if (scans.length > 0) {
      badge.classList.add("visible");
      if (btnText) btnText.textContent = window.innerWidth < 768 ? `Sync (${scans.length})` : `Sync (${scans.length})`;
    } else {
      badge.classList.remove("visible");
      if (btnText) btnText.textContent = window.innerWidth < 768 ? "Sync" : "Sync Data";
    }
  }
}

// Main manual sync function
async function manualSync() {
  const btn = document.getElementById("manualSyncBtn");
  const btnText = document.getElementById("syncBtnText");
  const btnIcon = document.getElementById("syncBtnIcon");
  const statusText = document.getElementById("syncStatus");
  
  if (isSending) {
    statusText.textContent = "Mengirim...";
    statusText.className = "sync-status-text error";
    return;
  }
  
  const scans = JSON.parse(localStorage.getItem("scanQueue") || "[]");
  const hasData = scans.length > 0;
  
  btn.disabled = true;
  btn.classList.add("sending");
  if (btnIcon) btnIcon.style.animation = "spin 1s linear infinite";
  
  if (!hasData) {
    // Just refresh data
    statusText.textContent = "Memperbarui...";
    statusText.className = "sync-status-text";
    
    try {
      // Stop and restart scanner
      if (qr && scanMode === "camera") {
        await qr.stop().catch(() => {});
      }
      
      await loadStudentsAndUpdateCount();
      
      if (scanMode === "camera") {
        await startScanner();
      }
      
      statusText.textContent = "✓ Diperbarui";
      statusText.className = "sync-status-text success";
      
      setTimeout(() => {
        statusText.textContent = "";
        statusText.className = "sync-status-text";
      }, 2000);
      
    } catch (err) {
      statusText.textContent = "✗ Gagal";
      statusText.className = "sync-status-text error";
    } finally {
      btn.disabled = false;
      btn.classList.remove("sending");
      if (btnIcon) btnIcon.style.animation = "";
    }
    return;
  }
  
  // Send data
  const queueLength = scans.length;
  statusText.textContent = `Mengirim ${queueLength}...`;
  statusText.className = "sync-status-text";
  
  isSending = true;
  
  try {
    // Stop scanner
    if (qr && scanMode === "camera") {
      await qr.stop().catch(() => {});
    }
    
    // Send
    const encodedData = encodeURIComponent(JSON.stringify(scans));
    const response = await fetch(API_URL + "?action=bulkScan&data=" + encodedData);
    const data = await response.json();
    
    if (data.status === "ok") {
      localStorage.removeItem("scanQueue");
      updateQueueBadge();
      
      statusText.textContent = `✓ ${queueLength} terkirim`;
      statusText.className = "sync-status-text success";
      
      await loadStudentsAndUpdateCount();
      playSound("beepSound");
      
    } else {
      throw new Error(data.message || "Error");
    }
    
  } catch (err) {
    console.error("Sync error:", err);
    statusText.textContent = "✗ Gagal, coba lagi";
    statusText.className = "sync-status-text error";
    playSound("errorSound");
    
  } finally {
    isSending = false;
    btn.disabled = false;
    btn.classList.remove("sending");
    if (btnIcon) btnIcon.style.animation = "";
    
    if (scanMode === "camera") {
      await startScanner();
    }
    
    setTimeout(() => {
      updateQueueBadge();
      statusText.textContent = "";
      statusText.className = "sync-status-text";
    }, 3000);
  }
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
  
  updateQueueBadge(); // Init queue badge
  updateHoursRibbon(); 
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
    const dt = new Date();
    const hour = dt.getHours();
    const minutes = dt.getMinutes();
    const timeValue = hour + (minutes / 100);
    
    const scanType = (timeValue >= 5.00 && timeValue < 8.00) ? "PAGI" : 
                     (timeValue >= 9.50 && timeValue < 21.00) ? "EKSTRA" : null;

    if (!scanType) {
      const kodeStatus = document.getElementById("kodeStatus");
      if (kodeStatus) {
        kodeStatus.textContent = "❌ Di luar jam absensi";
        kodeStatus.style.color = "var(--red)";
      }
      playSound("errorSound");
      isSubmittingKode = false;
      showLoading(false);
      return;
    }
    
    const res = await fetch(`${API_URL}?action=useSpecialCode&code=${kode}&operator=${currentOperator}&scanType=${scanType}`)
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
