/**
 * NURSERY SYSTEM - MAIN CONTROL SCRIPT
 */

// --- 1. LIVE TIME DISPLAY ---
function updateLiveTime() {
    const now = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    let formattedDate = now.toLocaleString('en-US', options).replace(/,([^,]*)$/, ' •$1');
    const dateElement = document.getElementById('currentDate');
    if (dateElement) dateElement.textContent = formattedDate;
}
setInterval(updateLiveTime, 1000);
updateLiveTime();

// --- 2. GLOBAL STATE ---
let apexChartInstances = { temp: null, hum: null };
let chartDataSeries = { temp: [], hum: [] };
const MAX_CHART_POINTS = 40; 

let currentReadings = { temp: null, hum: null, mois: null };
let actuatorStates = { Flow: false, Mister: false, Light: false };

let trayData = [];
for (let i = 1; i <= 10; i++) { trayData.push({ id: i, crop: null, plantedDate: null, status: "Empty" }); }

// --- 3. REALTIME LIVE CHARTS ---
function initLiveCharts() {
    const createOptions = (title, colorHex) => ({
        chart: {
            type: 'area',
            height: '100%',
            width: '100%',
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: { speed: 1000 }
            },
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        colors: [colorHex],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100]
            }
        },
        series: [{ name: title, data: [] }],
        xaxis: {
            type: 'datetime',
            labels: {
                datetimeUTC: false,
                format: 'HH:mm:ss',
                style: { colors: '#8ff7d4', fontSize: '11px' }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#8ff7d4', fontSize: '11px' }
            }
        },
        grid: {
            borderColor: 'rgba(42, 183, 137, 0.15)',
            strokeDashArray: 3
        },
        tooltip: {
            theme: 'dark',
            x: { format: 'HH:mm:ss' }
        },
        noData: {
            text: 'Waiting for live data...',
            style: { color: '#8ff7d4', fontSize: '14px' }
        }
    });

    const tempEl = document.getElementById('tempApexChart');
    const humEl = document.getElementById('humApexChart');

    if (tempEl && !apexChartInstances.temp) {
        apexChartInstances.temp = new ApexCharts(tempEl, createOptions('Temperature (°C)', '#e67e22'));
        apexChartInstances.temp.render();
    }
    if (humEl && !apexChartInstances.hum) {
        apexChartInstances.hum = new ApexCharts(humEl, createOptions('Humidity (%)', '#3498db'));
        apexChartInstances.hum.render();
    }
}

function updateLiveChartData(type, value) {
    if (!apexChartInstances[type]) return;

    const timestamp = Date.now();
    chartDataSeries[type].push([timestamp, Number(value)]);

    // උපරිම readings 40ක් පමණක් තබා ගනී (Rolling window)
    if (chartDataSeries[type].length > MAX_CHART_POINTS) {
        chartDataSeries[type].shift();
    }

    apexChartInstances[type].updateSeries([{
        data: chartDataSeries[type]
    }], false);
}

// --- 4. ACTUATOR CARD ANIMATION ---
function updateActuatorUI(type, isOn) {
    const card = document.getElementById(`${type}Card`);
    if (!card) return;

    card.classList.toggle('spinning', isOn);
    card.classList.toggle('active', isOn);

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

// --- 5. SENSOR CARD DISPLAY ---
function updateUI(type, value) {
    currentReadings[type] = value;
    const display = document.getElementById(`current-${type}`);
    const status = document.getElementById(`${type}-status`);
    const unit = type === 'temp' ? '°C' : '%';

    if (display) display.innerHTML = `${Number(value).toFixed(1)}<span>${unit}</span>`;

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

// --- 6. MANUAL / AUTO MODE TOGGLE ---
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

    const buttonsDisplay = isManual ? "flex" : "none";
    document.getElementById('flowManualButtons').style.display = buttonsDisplay;
    document.getElementById('misterManualButtons').style.display = buttonsDisplay;
    document.getElementById('lightManualButtons').style.display = buttonsDisplay;
});

// --- 7. MANUAL COMMANDS ---
function sendManualCommand(actuator, state) {
    if (window.firebaseDb && window.firebaseRef && window.firebaseSet) {
        const commandRef = window.firebaseRef(window.firebaseDb, `/Nursery/ManualCommands/${actuator}`);
        window.firebaseSet(commandRef, state);
    }
}
window.sendManualCommand = sendManualCommand;

// --- 8. FIREBASE SYNC & CHART STREAMING ---
document.addEventListener('DOMContentLoaded', () => {
    initLiveCharts();
});

setTimeout(() => {
    if (window.onFirebaseValue) {
        if (window.firebaseFlowRef) {
            window.onFirebaseValue(window.firebaseFlowRef, (snap) => {
                const val = snap.val();
                if (val !== null) {
                    actuatorStates.Flow = val;
                    updateActuatorUI('flow', val);
                }
            });
        }

        if (window.firebaseMisterRef) {
            window.onFirebaseValue(window.firebaseMisterRef, (snap) => {
                const val = snap.val();
                if (val !== null) {
                    actuatorStates.Mister = val;
                    updateActuatorUI('mister', val);
                }
            });
        }

        if (window.firebaseLightRef) {
            window.onFirebaseValue(window.firebaseLightRef, (snap) => {
                const val = snap.val();
                if (val !== null) {
                    actuatorStates.Light = val;
                    updateActuatorUI('light', val);
                }
            });
        }

        // Realtime Temperature Listener & Live Chart Update
        window.onFirebaseValue(window.firebaseTempRef, (snap) => {
            const val = snap.val();
            if (val !== null) {
                updateUI('temp', val);
                updateLiveChartData('temp', val);
            }
        });

        // Realtime Humidity Listener & Live Chart Update
        window.onFirebaseValue(window.firebaseHumRef, (snap) => {
            const val = snap.val();
            if (val !== null) {
                updateUI('hum', val);
                updateLiveChartData('hum', val);
            }
        });

        window.onFirebaseValue(window.firebaseMoisRef, (snap) => {
            const val = snap.val();
            if (val !== null) updateUI('mois', val);
        });

        if (window.firebaseTraysRef) {
            window.onFirebaseValue(window.firebaseTraysRef, (snapshot) => {
                const val = snapshot.val();
                if (val !== null) { trayData = Object.values(val); renderTrays(); }
                else { initializeDefaultTrays(); }
            });
        }
    }
}, 1000);

function initializeDefaultTrays() {
    trayData = [];
    for (let i = 1; i <= 10; i++) { trayData.push({ id: i, crop: null, plantedDate: null, status: "Empty" }); }
    renderTrays();
    if (window.firebaseSet && window.firebaseTraysRef) window.firebaseSet(window.firebaseTraysRef, trayData);
}

// --- 9. TAB NAVIGATION ---
document.addEventListener('DOMContentLoaded', () => {
    const overviewLink = document.querySelector('a[href="#overview"]');
    const trayLink = document.querySelector('a[href="#tray"]');
    const traySection = document.getElementById('tray-management');

    if (trayLink && overviewLink) {
        trayLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.card_grid, .functions, .main-heading, #charts-section').forEach(el => { if(el) el.style.display = 'none'; });
            if(traySection) traySection.style.display = 'block';
            overviewLink.classList.remove('active'); trayLink.classList.add('active');
        });

        overviewLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.card_grid, .functions, .main-heading, #charts-section').forEach(el => {
                if (el.classList.contains('card_grid') || el.classList.contains('functions')) { el.style.display = 'grid'; }
                else { el.style.display = 'block'; }
            });
            if(traySection) traySection.style.display = 'none';
            trayLink.classList.remove('active'); overviewLink.classList.add('active');
        });
    }
    renderTrays();
});

// --- 10. TRAY MANAGEMENT ---
function formatDate(dateString) {
    if (!dateString) return "--";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function renderTrays() {
    const trayGrid = document.getElementById('trayGrid');
    if (!trayGrid) return;
    trayGrid.innerHTML = '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let htmlContent = ''; let dataChanged = false;

    trayData.forEach((tray, index) => {
        let plantedStr = "--"; let transplantStr = "--"; let daysLeftHTML = "";
        if (tray.status === "Active" && tray.plantedDate) {
            const plantedDateObj = new Date(tray.plantedDate);
            const transplantDateObj = new Date(tray.plantedDate);
            transplantDateObj.setDate(transplantDateObj.getDate() + 14);
            const diffTime = transplantDateObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                trayData[index].status = "Empty"; trayData[index].crop = null; trayData[index].plantedDate = null;
                tray.status = "Empty"; tray.crop = null; dataChanged = true;
            } else {
                plantedStr = formatDate(tray.plantedDate); transplantStr = formatDate(transplantDateObj);
                if (diffDays > 0) { daysLeftHTML = `<h1>${diffDays}</h1><span>Days</span>`; }
                else if (diffDays === 0) { daysLeftHTML = `<h1>0</h1><span>Today!</span>`; }
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
    if (dataChanged && window.firebaseSet && window.firebaseTraysRef) window.firebaseSet(window.firebaseTraysRef, trayData);
}

let selectedTraysForUpdate = [];
document.addEventListener('DOMContentLoaded', () => {
    const updateModal = document.getElementById('trayUpdateModal');
    const openBtn = document.getElementById('openTrayUpdateBtn');
    const closeBtn = document.getElementById('closeTrayModal');
    const selectorGrid = document.getElementById('traySelectorGrid');
    const submitBtn = document.getElementById('submitTrayUpdate');

    if(selectorGrid) {
        selectorGrid.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const box = document.createElement('div');
            box.className = 'tray-select-box'; box.innerText = i;
            box.onclick = function() {
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) { selectedTraysForUpdate.push(i); }
                else { selectedTraysForUpdate = selectedTraysForUpdate.filter(id => id !== i); }
            };
            selectorGrid.appendChild(box);
        }
    }
    openBtn?.addEventListener('click', () => {
        updateModal.style.display = 'block'; selectedTraysForUpdate = [];
        document.querySelectorAll('.tray-select-box').forEach(b => b.classList.remove('selected'));
        document.getElementById('cropNameInput').value = ''; document.getElementById('plantedDateInput').value = '';
    });
    closeBtn?.addEventListener('click', () => { updateModal.style.display = 'none'; });
    submitBtn?.addEventListener('click', () => {
        const cropName = document.getElementById('cropNameInput').value.trim();
        const plantedDate = document.getElementById('plantedDateInput').value;
        if (selectedTraysForUpdate.length === 0) { alert("Please select at least one tray."); return; }
        if (!cropName || !plantedDate) { alert("Please enter crop name and planted date."); return; }

        trayData.forEach(tray => {
            if (selectedTraysForUpdate.includes(tray.id)) { tray.crop = cropName; tray.plantedDate = plantedDate; tray.status = "Active"; }
        });
        if (window.firebaseSet && window.firebaseTraysRef) window.firebaseSet(window.firebaseTraysRef, trayData);
        updateModal.style.display = 'none';
    });
});