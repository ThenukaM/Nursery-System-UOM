/**
 * NURSERY SYSTEM - MAIN CONTROL SCRIPT
 * Architecture: Asynchronous real-time streaming alongside query indexing protocols.
 */

// --- 1. LIVE TIME DISPLAY ---
function updateLiveTime() {
    const now = new Date();
    const options = { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true 
    };
    let formattedDate = now.toLocaleString('en-US', options).replace(/,([^,]*)$/, ' •$1');
    const dateElement = document.getElementById('currentDate');
    if (dateElement) dateElement.textContent = formattedDate;
}
setInterval(updateLiveTime, 1000);
updateLiveTime();

// --- 2. GLOBAL VARIABLES & STATE ---
let apexChartInstances = { temp: null, hum: null, mois: null };
let currentReadings = { temp: null, hum: null, mois: null };

let trayData = [];
for (let i = 1; i <= 10; i++) {
    trayData.push({ id: i, crop: null, plantedDate: null, status: "Empty" });
}

// --- 3. FIREBASE INDEXED LOG COMPILATION & TIMELINE RENDERING ---
function fetchHistoryFromFirebase(type, days) {
    if (!window.firebaseDb) return;

    const { query, ref, orderByChild, startAt, onFirebaseValue } = window;
    const historyRef = ref(window.firebaseDb, '/Nursery/History');
    const timeThreshold = Date.now() - (days * 24 * 60 * 60 * 1000);
    const historyQuery = query(historyRef, orderByChild('timestamp'), startAt(timeThreshold));

    if (apexChartInstances[type]) {
        apexChartInstances[type].updateOptions({
            series: [],
            noData: { text: 'Loading data timeline fields...' }
        });
    }

    onFirebaseValue(historyQuery, (snapshot) => {
        const data = snapshot.val();
        const dataPoints = [];

        if (data) {
            Object.keys(data).forEach(key => {
                const node = data[key];
                let value = 0;
                if (type === 'temp') value = node.temperature;
                else if (type === 'hum') value = node.humidity;
                else if (type === 'mois') value = node.moisture;

                dataPoints.push([node.timestamp, value]);
            });
        }
        renderApexChart(type, dataPoints);
    }, { onlyOnce: true });
}

function renderApexChart(type, dataPoints) {
    const elementId = `${type}ApexChart`;
    const titles = { temp: 'Temperature (°C)', hum: 'Humidity (%)', mois: 'Moisture (%)' };
    const colors = { temp: '#e67e22', hum: '#3498db', mois: '#27ae60' };

    const options = {
        chart: {
            type: 'area',
            height: 300,
            zoom: { enabled: true },
            toolbar: { show: true }
        },
        colors: [colors[type]],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        series: [{ name: titles[type], data: dataPoints }],
        xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
        tooltip: { x: { format: 'dd MMM yyyy HH:mm' } },
        noData: { text: 'No metrics stored inside database boundaries for this time interval.' }
    };

    if (!apexChartInstances[type]) {
        apexChartInstances[type] = new ApexCharts(document.getElementById(elementId), options);
        apexChartInstances[type].render();
    } else {
        apexChartInstances[type].updateOptions(options);
    }
}

function openModal(type) {
    document.getElementById(`${type}Modal`).style.display = "block";
    const selectedDays = document.getElementById(`${type}Filter`).value;
    fetchHistoryFromFirebase(type, parseInt(selectedDays));
}

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.onclick = () => btn.closest('.modal').style.display = "none";
});

window.onclick = (event) => {
    if (event.target.classList.contains('modal')) event.target.style.display = "none";
};

// --- 4. ACTUATOR UI SYSTEM RENDERING ---
function updateActuatorUI(type, isOn) {
    const card = document.getElementById(`${type}Card`);
    if (!card) return;

    if (isOn) {
        card.classList.add('spinning');
        card.style.backgroundColor = "#e0f2fe"; 
    } else {
        card.classList.remove('spinning');
        card.style.backgroundColor = "rgba(255, 255, 255, 0.6)"; 
    }

    if (type === 'mister') {
        const mistingProgress = document.getElementById('mistingProgress');
        const mistingProgressBar = document.getElementById('mistingProgressBar');
        if (isOn) {
            mistingProgress.style.display = 'block';
            mistingProgressBar.classList.remove('animate');
            void mistingProgressBar.offsetWidth; 
            mistingProgressBar.classList.add('animate');
        } else {
            mistingProgress.style.display = 'none';
            mistingProgressBar.classList.remove('animate');
        }
    }
}

// --- 5. INTERFACE GRAPHICS MODULATORS ---
function updateUI(type, value) {
    currentReadings[type] = value;
    const display = document.getElementById(`current-${type}`);
    const status = document.getElementById(`${type}-status`);
    const unit = type === 'temp' ? '°C' : '%';

    if (display) display.innerHTML = `${value.toFixed(1)}<span>${unit}</span>`;
    
    if (status) {
        status.className = 'status-badge';
        if (type === 'temp') {
            if (value > 24) { status.innerText = "🔥 HIGH"; status.classList.add('high'); }
            else if (value < 18) { status.innerText = "❄️ LOW"; status.classList.add('low'); }
            else { status.innerText = "✅ OPTIMAL"; status.classList.add('optimal'); }
        } else if (type === 'hum') {
            if (value > 85) { status.innerText = "🌧️ HIGH"; status.classList.add('high'); }
            else if (value < 70) { status.innerText = "🪫 LOW"; status.classList.add('low'); }
            else { status.innerText = "✅ OPTIMAL"; status.classList.add('optimal'); }
        } else if (type === 'mois') {
            if (value < 40) { status.innerText = "🌵 DRY"; status.classList.add('low'); }
            else if (value > 70) { status.innerText = "🌊 WET"; status.classList.add('high'); }
            else { status.innerText = "✅ OPTIMAL"; status.classList.add('optimal'); }
        }
    }
}

document.getElementById('tempCard')?.addEventListener('click', () => openModal('temp'));
document.getElementById('humCard')?.addEventListener('click', () => openModal('hum'));
document.getElementById('moisCard')?.addEventListener('click', () => openModal('mois'));

document.getElementById('tempFilter')?.addEventListener('change', (e) => fetchHistoryFromFirebase('temp', parseInt(e.target.value)));
document.getElementById('humFilter')?.addEventListener('change', (e) => fetchHistoryFromFirebase('hum', parseInt(e.target.value)));
document.getElementById('moisFilter')?.addEventListener('change', (e) => fetchHistoryFromFirebase('mois', parseInt(e.target.value)));

// --- 6. USER HYBRID OVERRIDE COMMAND STREAM PROCESSING ---
const toggleBtn = document.getElementById('toggleBtn');
const modeText = document.getElementById('modeText');

toggleBtn?.addEventListener('change', function() {
    const isManual = this.checked;
    const mode = isManual ? "Manual" : "Auto";
    modeText.textContent = mode;

    if (window.firebaseDb && window.firebaseRef && window.firebaseSet) {
        const modeRef = window.firebaseRef(window.firebaseDb, '/Nursery/ControlMode');
        window.firebaseSet(modeRef, mode);
    }

    // Dynamic UI visibility toggle for manual intervention buttons
    const buttonsDisplay = isManual ? "flex" : "none";
    document.getElementById('pumpManualButtons').style.display = buttonsDisplay;
    document.getElementById('misterManualButtons').style.display = buttonsDisplay;
    document.getElementById('fanManualButtons').style.display = buttonsDisplay;
});

// Sends the manual state switch command to the database without forcing immediate UI animation
function sendManualCommand(actuator, state) {
    if (window.firebaseDb && window.firebaseRef && window.firebaseSet) {
        const commandRef = window.firebaseRef(window.firebaseDb, `/Nursery/ManualCommands/${actuator}`);
        window.firebaseSet(commandRef, state);
    }
}
window.sendManualCommand = sendManualCommand;

// --- 7. CLOUD SYNCHRONIZATION PIPELINES (REAL HARDWARE FEEDBACK) ---
setTimeout(() => {
    if (window.onFirebaseValue) {
        
        // Dynamic animation properties are only triggered by incoming physical relay states verified by the ESP32
        if (window.firebasePumpRef) {
            window.onFirebaseValue(window.firebasePumpRef, (snap) => {
                if (snap.val() !== null) updateActuatorUI('pump', snap.val());
            });
        }
        
        if (window.firebaseMisterRef) {
            window.onFirebaseValue(window.firebaseMisterRef, (snap) => {
                if (snap.val() !== null) updateActuatorUI('mister', snap.val());
            });
        }
        
        if (window.firebaseFanRef) {
            window.onFirebaseValue(window.firebaseFanRef, (snap) => {
                if (snap.val() !== null) updateActuatorUI('fan', snap.val());
            });
        }

        // Continuous streaming tracking metric channels
        window.onFirebaseValue(window.firebaseTempRef, (snap) => { if(snap.val() !== null) updateUI('temp', snap.val()); });
        window.onFirebaseValue(window.firebaseHumRef, (snap) => { if(snap.val() !== null) updateUI('hum', snap.val()); });
        window.onFirebaseValue(window.firebaseMoisRef, (snap) => { if(snap.val() !== null) updateUI('mois', snap.val()); });

        // Tray Matrix configurations syncing
        if (window.firebaseTraysRef) {
            window.onFirebaseValue(window.firebaseTraysRef, (snapshot) => {
                const val = snapshot.val();
                if (val !== null) {
                    trayData = Object.values(val);
                    renderTrays(); 
                } else {
                    initializeDefaultTrays();
                }
            });
        }
    }
}, 1500);

function initializeDefaultTrays() {
    trayData = [];
    for (let i = 1; i <= 10; i++) {
        trayData.push({ id: i, crop: null, plantedDate: null, status: "Empty" });
    }
    renderTrays(); 
    if (window.firebaseSet && window.firebaseTraysRef) {
        window.firebaseSet(window.firebaseTraysRef, trayData);
    }
}

// --- 8. TAB NAVIGATION LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const overviewLink = document.querySelector('a[href="#overview"]');
    const trayLink = document.querySelector('a[href="#tray"]');
    const traySection = document.getElementById('tray-management');

    if (trayLink && overviewLink) {
        trayLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.card_grid, .functions, .main-heading').forEach(el => {
                if(el) el.style.display = 'none';
            });
            if(traySection) traySection.style.display = 'block';
            overviewLink.classList.remove('active');
            trayLink.classList.add('active');
        });

        overviewLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.card_grid, .functions, .main-heading').forEach(el => {
                if (el.classList.contains('card_grid') || el.classList.contains('functions')) {
                    el.style.display = 'grid';
                } else {
                    el.style.display = 'block';
                }
            });
            if(traySection) traySection.style.display = 'none';
            trayLink.classList.remove('active');
            overviewLink.classList.add('active');
        });
    }
    renderTrays();
});

// --- 9. TRAY MANAGEMENT MATRIX ---
function formatDate(dateString) {
    if (!dateString) return "--";
    const date = new Date(dateString);
    const options = { month: 'short', day: '2-digit' };
    return date.toLocaleDateString('en-US', options);
}

function renderTrays() {
    const trayGrid = document.getElementById('trayGrid');
    if (!trayGrid) return;
    
    trayGrid.innerHTML = ''; 
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let htmlContent = '';
    let dataChanged = false; 

    trayData.forEach((tray, index) => {
        let plantedStr = "--";
        let transplantStr = "--";
        let daysLeftHTML = "";

        if (tray.status === "Active" && tray.plantedDate) {
            const plantedDateObj = new Date(tray.plantedDate);
            const transplantDateObj = new Date(tray.plantedDate);
            transplantDateObj.setDate(transplantDateObj.getDate() + 14);

            const diffTime = transplantDateObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                trayData[index].status = "Empty";
                trayData[index].crop = null;
                trayData[index].plantedDate = null;
                tray.status = "Empty"; 
                tray.crop = null;
                dataChanged = true; 
            } else {
                plantedStr = formatDate(tray.plantedDate);
                transplantStr = formatDate(transplantDateObj);

                if (diffDays > 0) {
                    daysLeftHTML = `<h1>${diffDays}</h1><span>Days</span>`;
                } else if (diffDays === 0) {
                    daysLeftHTML = `<h1>0</h1><span>Today!</span>`;
                }
            }
        }

        htmlContent += `
            <div class="tray-card">
                <span class="tray-status status-${tray.status.toLowerCase()}">${tray.status.toUpperCase()}</span>
                <h3>Tray #${tray.id.toString().padStart(2, '0')}</h3>
                <div class="tray-details">
                    <p><strong>Crop:</strong> ${tray.crop || "--"}</p>
                    <p><strong>Planted:</strong> ${plantedStr}</p>
                    <p><strong>Transplant:</strong> ${transplantStr}</p>
                </div>
                ${tray.status === "Active" ? `<div class="days-left">${daysLeftHTML}</div>` : ''}
            </div>
        `;
    });
    
    trayGrid.innerHTML = htmlContent;
    if (dataChanged && window.firebaseSet && window.firebaseTraysRef) {
        window.firebaseSet(window.firebaseTraysRef, trayData);
    }
}

let selectedTraysForUpdate = [];

document.addEventListener('DOMContentLoaded', () => {
    const updateModal = document.getElementById('trayUpdateModal');
    const openBtn = document.getElementById('openTrayUpdateBtn');
    const closeBtn = document.getElementById('closeTrayModal');
    const selectorGrid = document.getElementById('traySelectorGrid');
    const submitBtn = document.getElementById('submitTrayUpdate');

    if(selectorGrid) {
        for (let i = 1; i <= 10; i++) {
            const box = document.createElement('div');
            box.className = 'tray-select-box';
            box.innerText = i;
            box.onclick = function() {
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) {
                    selectedTraysForUpdate.push(i);
                } else {
                    selectedTraysForUpdate = selectedTraysForUpdate.filter(id => id !== i);
                }
            };
            selectorGrid.appendChild(box);
        }
    }

    openBtn?.addEventListener('click', () => {
        updateModal.style.display = 'block';
        selectedTraysForUpdate = [];
        document.querySelectorAll('.tray-select-box').forEach(b => b.classList.remove('selected'));
        document.getElementById('cropNameInput').value = '';
        document.getElementById('plantedDateInput').value = '';
    });

    closeBtn?.addEventListener('click', () => {
        updateModal.style.display = 'none';
    });

    submitBtn?.addEventListener('click', () => {
        const cropName = document.getElementById('cropNameInput').value.trim();
        const plantedDate = document.getElementById('plantedDateInput').value;

        if (selectedTraysForUpdate.length === 0) {
            alert("Please select at least one tray.");
            return;
        }
        if (!cropName || !plantedDate) {
            alert("Please enter crop name and planted date.");
            return;
        }

        trayData.forEach(tray => {
            if (selectedTraysForUpdate.includes(tray.id)) {
                tray.crop = cropName;
                tray.plantedDate = plantedDate;
                tray.status = "Active";
            }
        });

        if (window.firebaseSet && window.firebaseTraysRef) {
            window.firebaseSet(window.firebaseTraysRef, trayData)
            .then(() => { console.log("Tray configuration backed up into cloud infrastructure mapping."); })
            .catch((error) => { console.error("Firebase handling exception: ", error); });
        }
        updateModal.style.display = 'none';
    });
});