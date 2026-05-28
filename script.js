
// ==================== VISIT CARD QR LOGIC ====================
// Build a self-contained URL that points to THIS same page with ?card=1&... params
// Works on any device as long as they can reach the same server
function buildVisitCardURL(d) {
    const base = window.location.origin + window.location.pathname;
    // NOTE: photo is NOT included in URL — base64 images are huge and break QR codes.
    // Photo is stored in localStorage and looked up by doctor ID on the visit card page.
    const params = new URLSearchParams({
        card: '1',
        id: d.id || '',
        n: d.fName + ' ' + d.lName,
        s: d.specialty,
        p: d.paid ? '1' : '0',
        m: d.mobile,
        h: d.hospital || '',
        c: d.city || '',
        r: d.regNo || '',
        dt: d.regDate || ''
    });
    return base + '?' + params.toString();
}

// ==================== CHECK IF QR SCAN (URL has ?card=1) ====================
(function checkVisitCardMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('card') !== '1') return;

    // Hide main site, show visit card
    document.getElementById('mainSite').style.display = 'none';
    document.getElementById('visitCardPage').classList.add('active');

    const name = params.get('n') || 'Doctor';
    const id = params.get('id') || '';
    const spec = params.get('s') || '';
    const paid = params.get('p') === '1';
    const mobile = params.get('m') || '';
    const hospital = params.get('h') || '';
    const city = params.get('c') || '';
    const regNo = params.get('r') || '';
    const regDate = params.get('dt') || '';
    // Look up photo from localStorage by doctor ID (photo is NOT in URL — too large for QR)
    let photo = '';
    try {
        const allDoctors = JSON.parse(localStorage.getItem('medconf_doctors') || '[]');
        const match = allDoctors.find(function (d) { return d.id === id; });
        if (match && match.photo) photo = match.photo;
    } catch (e) { }

    document.title = 'Dr. ' + name + ' – MedConf 2026';

    // Photo
    const vcPhoto = document.getElementById('vcPhoto');
    if (photo && photo.startsWith('data:image')) {
        const img = document.createElement('img');
        img.src = photo;
        img.className = 'vc-photo';
        img.alt = name;
        vcPhoto.parentNode.replaceChild(img, vcPhoto);
    } else {
        vcPhoto.textContent = '👤';
    }

    document.getElementById('vcName').textContent = 'Dr. ' + name;
    document.getElementById('vcSpec').textContent = spec;
    document.getElementById('vcHospital').textContent = hospital || '';
    document.getElementById('vcId').textContent = id;

    const statusEl = document.getElementById('vcStatus');
    statusEl.textContent = paid ? '✓ Confirmed & Paid' : '⏳ Payment Pending';
    statusEl.className = 'vc-status ' + (paid ? 'paid' : 'pending');

    const infoGrid = document.getElementById('vcInfoGrid');
    const rows = [
        { label: 'Mobile', value: mobile },
        { label: 'Registration No.', value: regNo || '—' },
        { label: 'City', value: city || '—' },
        { label: 'Registered On', value: regDate || '—' }
    ];
    infoGrid.innerHTML = rows.map(r => `
        <div class="vc-info-row">
          <span class="label">${r.label}</span>
          <span class="value">${r.value}</span>
        </div>
      `).join('');
})();

// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = 'https://jdpkejxyzrpgdrmlbhtm.supabase.co';   // 🔴 Replace this
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkcGtlanh5enJwZ2RybWxiaHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDc2MTAsImV4cCI6MjA5NTI4MzYxMH0.DMIbKPm8r9TZiCpyjD1a8rI_6PI-z99VRVqzLmvqqDo'; // 🔴 Replace this
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== DATA STORE ====================
let doctors = [];
let currentDoctor = null;

async function loadDoctors() {
    const { data, error } = await db.from('doctors').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Load error:', error.message); return []; }
    return data.map(function (d) {
        return {
            id: d.id, fName: d.first_name, lName: d.last_name,
            mobile: d.mobile, email: d.email, specialty: d.specialty,
            regNo: d.reg_no, hospital: d.hospital, city: d.city,
            photo: d.photo, paid: d.paid, regDate: d.reg_date
        };
    });
}

async function saveDoctor(doc) {
    const { error } = await db.from('doctors').upsert({
        id: doc.id, first_name: doc.fName, last_name: doc.lName,
        mobile: doc.mobile, email: doc.email, specialty: doc.specialty,
        reg_no: doc.regNo || '', hospital: doc.hospital || '',
        city: doc.city || '', photo: doc.photo || '',
        paid: doc.paid, reg_date: doc.regDate
    });
    if (error) { console.error('Save error:', error.message); alert('❌ Save failed: ' + error.message); }
}

async function updatePaidInDB(id) {
    const { error } = await db.from('doctors').update({ paid: true }).eq('id', id);
    if (error) { console.error('Update error:', error.message); }
}

// ==================== QR CODE GENERATION ====================
function generateQR(elementId, text, size) {
    size = size || 128;
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    new QRCode(el, { text: text, width: size, height: size, colorDark: '#0a1628', colorLight: '#ffffff' });
}

// ==================== INIT ====================
window.addEventListener('load', async function () {
    const url = window.location.origin + window.location.pathname;
    document.getElementById('siteUrl').textContent = url;
    generateQR('websiteQR', url, 160);
    generateQR('paymentQR', 'upi://pay?pa=medconf2026@hdfc&pn=MedConf2026&am=2500&cu=INR&tn=ConferenceRegistration', 160);
    doctors = await loadDoctors();
    updateAdminStats();
    renderAdminTables();
});

// ==================== REGISTRATION FLOW ====================
function openRegistration() {
    document.getElementById('regModal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function previewPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('imgPreviewUpload');
            preview.src = e.target.result;
            preview.style.display = 'block';
            document.getElementById('uploadText').textContent = '✓ Photo uploaded';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function submitRegistration() {
    const fName = document.getElementById('fName').value.trim();
    const lName = document.getElementById('lName').value.trim();
    const mobile = document.getElementById('mobile').value.trim();
    const email = document.getElementById('email').value.trim();
    const specialty = document.getElementById('specialty').value;

    if (!fName || !lName || !mobile || !email || !specialty) {
        alert('Please fill all required fields (*)');
        return;
    }
    if (!/^[0-9+\s\-]{10,15}$/.test(mobile)) {
        alert('Please enter a valid mobile number');
        return;
    }

    const preview = document.getElementById('imgPreviewUpload');
    currentDoctor = {
        fName: fName, lName: lName, mobile: mobile, email: email, specialty: specialty,
        regNo: document.getElementById('regNo').value,
        hospital: document.getElementById('hospital').value,
        city: document.getElementById('city').value,
        photo: (preview && preview.style.display !== 'none') ? preview.src : '',
        paid: false,
        regDate: new Date().toLocaleDateString('en-IN'),
        id: null
    };

    closeModal('regModal');
    setTimeout(function () { document.getElementById('payModal').classList.add('active'); }, 300);
}

async function confirmPayment() {
    if (!currentDoctor) return;
    const num = String(doctors.length + 1).padStart(4, '0');
    currentDoctor.id = 'MC-2026-' + num;
    currentDoctor.paid = true;
    doctors.push(Object.assign({}, currentDoctor));
    await saveDoctor(currentDoctor);
    updateAdminStats();
    renderAdminTables();
    closeModal('payModal');
    setTimeout(function () { showSuccess(currentDoctor); }, 300);
}

function showSuccess(doc) {
    document.getElementById('displayDoctorId').textContent = doc.id;
    document.getElementById('waNumber').textContent = doc.mobile;
    document.getElementById('waMessage').textContent =
        'Dear Dr. ' + doc.fName + ' ' + doc.lName + ',\n\n' +
        '✅ Your registration for MedConf 2026 is CONFIRMED!\n\n' +
        '🆔 Doctor ID: ' + doc.id + '\n' +
        '📅 Event: Oct 3–4, 2026\n' +
        '📍 Venue: Nagpur, Maharashtra\n\n' +
        'Scan your personal QR code for digital visit card & entry.\n\n' +
        '– MedConf 2026 Team';

    const successQREl = document.getElementById('successQR');
    successQREl.innerHTML = '';
    const cardUrl = buildVisitCardURL(doc);
    new QRCode(successQREl, { text: cardUrl, width: 150, height: 150, colorDark: '#0a1628', colorLight: '#ffffff' });

    document.getElementById('successModal').classList.add('active');
}

// ==================== ADMIN ====================
async function showAdmin() {
    const password = prompt('Enter Admin Password');
    if (password !== 'admin123') { alert('❌ Wrong Password'); return; }
    doctors = await loadDoctors();
    document.getElementById('mainSite').style.display = 'none';
    document.getElementById('adminPage').style.display = 'block';
    updateAdminStats();
    renderAdminTables();
}

function hideAdmin() {
    document.getElementById('adminPage').style.display = 'none';
    document.getElementById('mainSite').style.display = 'block';
}

function switchAdminTab(tab, evt) {
    ['Dashboard', 'Doctors', 'Payments', 'QRCodes'].forEach(function (t) {
        document.getElementById('admin' + t).style.display = 'none';
    });
    document.querySelectorAll('.admin-nav-item').forEach(function (el) { el.classList.remove('active'); });
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
    var titles = { dashboard: 'Dashboard', doctors: 'Registered Doctors', payments: 'Payment Status', qrcodes: 'Doctor QR Codes' };
    document.getElementById('adminTabTitle').textContent = titles[tab];
    document.getElementById('admin' + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = 'block';
    if (tab === 'qrcodes') renderQRCodes();
}

function updateAdminStats() {
    const paid = doctors.filter(function (d) { return d.paid; }).length;
    document.getElementById('statTotal').textContent = doctors.length;
    document.getElementById('statPaid').textContent = paid;
    document.getElementById('statPending').textContent = doctors.length - paid;
    document.getElementById('statRevenue').textContent = '₹' + (paid * 2500).toLocaleString('en-IN');
}

function renderAdminTables() {
    const dbody = document.getElementById('dashboardBody');
    const docBody = document.getElementById('doctorsBody');
    const payBody = document.getElementById('paymentsBody');
    dbody.innerHTML = ''; docBody.innerHTML = ''; payBody.innerHTML = '';

    if (doctors.length === 0) {
        const empty = '<tr><td colspan="10" style="text-align:center;padding:40px;color:gray">No Doctors Registered Yet</td></tr>';
        dbody.innerHTML = empty; docBody.innerHTML = empty; payBody.innerHTML = empty;
        return;
    }

    doctors.forEach(function (d, i) {
        const payBadge = d.paid
            ? '<span class="status-badge status-paid">✓ Paid</span>'
            : '<span class="status-badge status-pending">Pending</span>';
        const photo = d.photo ? '<img src="' + d.photo + '" style="width:45px;height:45px;border-radius:50%;object-fit:cover">' : '👤';

        dbody.innerHTML += '<tr><td>' + (i + 1) + '</td><td>' + photo + '</td><td>' + d.id + '</td><td>Dr. ' + d.fName + ' ' + d.lName + '</td><td>' + d.mobile + '</td><td>' + d.specialty + '</td><td>' + payBadge + '</td><td><div class="admin-actions"><button class="action-btn action-view" onclick="viewIdCard(' + i + ')">View ID</button>' + (!d.paid ? '<button class="action-btn action-verify" onclick="markPaid(' + i + ')">Mark Paid</button>' : '') + '</div></td></tr>';

        docBody.innerHTML += '<tr><td>' + (i + 1) + '</td><td>' + photo + '</td><td>' + d.id + '</td><td>Dr. ' + d.fName + ' ' + d.lName + '</td><td>' + d.mobile + '</td><td>' + d.email + '</td><td>' + d.specialty + '</td><td>' + (d.hospital || '-') + '</td><td>' + (d.city || '-') + '</td><td>' + d.regDate + '</td></tr>';

        payBody.innerHTML += '<tr><td>' + (i + 1) + '</td><td>' + d.id + '</td><td>Dr. ' + d.fName + ' ' + d.lName + '</td><td>₹2500</td><td>' + payBadge + '</td><td>' + (!d.paid ? '<button class="action-btn action-verify" onclick="markPaid(' + i + ')">Verify Payment</button>' : '<span style="color:green;font-weight:bold">Confirmed</span>') + '</td></tr>';
    });
}

async function markPaid(index) {
    doctors[index].paid = true;
    await updatePaidInDB(doctors[index].id);
    updateAdminStats();
    renderAdminTables();
    alert('✅ Payment confirmed for Dr. ' + doctors[index].fName + ' ' + doctors[index].lName);
}

function renderQRCodes() {
    const grid = document.getElementById('qrCodesGrid');
    grid.innerHTML = '';
    if (doctors.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray);grid-column:1/-1;text-align:center;padding:40px">No doctors registered yet</p>';
        return;
    }
    doctors.forEach(function (d, i) {
        const card = document.createElement('div');
        card.style.cssText = 'background:white;border-radius:12px;padding:24px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)';
        card.innerHTML = '<div style="font-weight:700;color:var(--navy);font-size:0.9rem;margin-bottom:4px">Dr. ' + d.fName + ' ' + d.lName + '</div><div style="color:var(--gold);font-size:0.75rem;margin-bottom:12px">' + d.id + '</div><div id="adminQR_' + i + '"></div><div style="color:var(--gray);font-size:0.75rem;margin-top:8px">' + d.specialty + '</div><div style="margin-top:8px">' + (d.paid ? '<span class="status-badge status-paid">✓ Paid</span>' : '<span class="status-badge status-pending">Pending</span>') + '</div>';
        grid.appendChild(card);
        setTimeout(function () {
            const el = document.getElementById('adminQR_' + i);
            if (el) {
                el.innerHTML = '';
                new QRCode(el, { text: buildVisitCardURL(d), width: 120, height: 120, colorDark: '#0a1628', colorLight: '#ffffff' });
            }
        }, 50 * (i + 1));
    });
}

function viewIdCard(index) {
    const d = doctors[index];
    const card = document.getElementById('idCardContent');
    const photo = d.photo ? '<img class="id-card-photo" src="' + d.photo + '" alt="photo">' : '<div class="id-card-photo">👤</div>';
    card.innerHTML = '<div class="id-card-logo">✦ MEDCONF 2026</div>' + photo +
        '<div class="id-card-name">Dr. ' + d.fName + ' ' + d.lName + '</div>' +
        '<div class="id-card-spec">' + d.specialty.toUpperCase() + '</div>' +
        '<div class="id-card-info">' +
        '<div class="id-info-row"><span>Mobile</span><span>' + d.mobile + '</span></div>' +
        '<div class="id-info-row"><span>Hospital</span><span>' + (d.hospital || '—') + '</span></div>' +
        '<div class="id-info-row"><span>Reg. No.</span><span>' + (d.regNo || '—') + '</span></div>' +
        '<div class="id-info-row"><span>City</span><span>' + (d.city || '—') + '</span></div>' +
        '<div class="id-info-row"><span>Status</span><span style="color:' + (d.paid ? '#4caf50' : '#f59e0b') + '">' + (d.paid ? '✓ Paid' : 'Pending') + '</span></div>' +
        '</div><div class="id-card-qr"><div id="idCardQR"></div></div>' +
        '<div class="id-card-id">' + d.id + '</div>';

    document.getElementById('idCardModal').classList.add('active');
    setTimeout(function () {
        const qrEl = document.getElementById('idCardQR');
        if (qrEl) {
            qrEl.innerHTML = '';
            new QRCode(qrEl, { text: buildVisitCardURL(d), width: 100, height: 100, colorDark: '#0a1628', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
        }
    }, 300);
}

// ==================== EXPORT EXCEL ====================
function exportExcel() {
    if (doctors.length === 0) { alert('No Data Available'); return; }
    const data = doctors.map(function (d, i) {
        return {
            'S.No': i + 1, 'Doctor ID': d.id, 'First Name': d.fName, 'Last Name': d.lName,
            'Mobile': d.mobile, 'Email': d.email, 'Specialty': d.specialty,
            'Medical Registration No': d.regNo, 'Hospital': d.hospital, 'City': d.city,
            'Payment Status': d.paid ? 'Paid' : 'Pending', 'Amount': d.paid ? '2500' : '0',
            'Registration Date': d.regDate
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registered Doctors');
    XLSX.writeFile(wb, 'MedConf_Doctors_' + Date.now() + '.xlsx');
}

// ==================== COUNTDOWN ====================
(function () {
    var target = new Date('2026-10-02T08:00:00+05:30').getTime();

    function pad(n) { return String(n).padStart(2, '0'); }

    function tick() {
        var now = Date.now();
        var diff = target - now;

        if (diff <= 0) {
            var grid = document.getElementById('countdownGrid');
            if (grid) grid.innerHTML = '<div class="countdown-ended">🎉 The Conference Has Begun!</div>';
            return;
        }

        var days = Math.floor(diff / 86400000);
        var hours = Math.floor((diff % 86400000) / 3600000);
        var mins = Math.floor((diff % 3600000) / 60000);
        var secs = Math.floor((diff % 60000) / 1000);

        function update(id, val) {
            var el = document.getElementById(id);
            if (!el) return;
            var newVal = pad(val);
            if (el.textContent !== newVal) {
                el.textContent = newVal;
                el.classList.remove('flip');
                void el.offsetWidth;
                el.classList.add('flip');
                setTimeout(function () { el.classList.remove('flip'); }, 220);
            }
        }

        update('cd-days', days);
        update('cd-hours', hours);
        update('cd-mins', mins);
        update('cd-secs', secs);
    }

    // Run immediately once DOM is ready, then every second
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { tick(); setInterval(tick, 1000); });
    } else {
        tick();
        setInterval(tick, 1000);
    }
})();
