import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { Auth } from './auth.js'; 

const firebaseConfig = {
    apiKey: "AIzaSyB11C4GGgAyqeThs8a9cvDNN7frvAA1nqQ",
    authDomain: "delta-optics-system.firebaseapp.com",
    projectId: "delta-optics-system",
    storageBucket: "delta-optics-system.firebasestorage.app",
    messagingSenderId: "111176219224",
    appId: "1:111176219224:web:e0d8a5f26b84d57249a82d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.allUnifiedRecords = []; 
window.allOnlineTests = []; 
let todayInvoicesData = [];
let todayExpensesData = [];

document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if(document.getElementById('current-date-display')) {
        document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('ar-EG', dateOptions);
    }
});

function getDeviceInfo() { const ua = navigator.userAgent; return /Mobile|Android|iP(hone|od)|IEMobile/.test(ua) ? "هاتف محمول" : "جهاز كمبيوتر"; }
async function logSecretAction(action) { if (Auth.user) { try { await addDoc(collection(db, "stealth_logs"), { user: Auth.user.name, device: getDeviceInfo(), action, time: serverTimestamp() }); } catch(e){} } }
async function logAudit(action) { if (Auth.user) { try { await addDoc(collection(db, "audit_logs"), { user: Auth.user.name, action, time: serverTimestamp() }); } catch(e){} } }

window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) { target.classList.add('active'); target.style.display = 'block'; }
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    logSecretAction(`فتح شاشة: ${id}`);
};

window.toggleDarkMode = () => { document.body.classList.toggle('dark-mode'); };
window.performGlobalSearch = () => {
    const filter = document.getElementById('global-search').value.toUpperCase();
    const trs = document.querySelectorAll('.active table tbody tr'); 
    trs.forEach(tr => { tr.style.display = tr.innerText.toUpperCase().includes(filter) ? "" : "none"; });
};

window.handleLogin = async () => {
    const u = document.getElementById('auth-u').value, p = document.getElementById('auth-p').value;
    const res = await Auth.login(u, p);
    if (res.success) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;
        if (Auth.user.role === 'superadmin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
        logSecretAction(`تسجيل دخول ناجح`); logAudit("تسجيل دخول");
        startSync(); window.showView('dash');
    } else { Swal.fire('مرفوض', res.msg, 'error'); }
};
window.handleLogout = () => { logSecretAction(`تسجيل خروج`); Auth.logout(); };

document.addEventListener('DOMContentLoaded', () => {
    if (Auth.check()) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;
        if (Auth.user.role === 'superadmin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
        startSync(); window.showView('dash');
    }
});

// ================== المراقبة المالية والمصروفات ==================
window.saveExpense = async () => {
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const desc = document.getElementById('exp-desc').value.trim();
    if(!amount || !desc) return Swal.fire('خطأ', 'أدخل المبلغ وتفاصيل المصروف', 'error');
    try {
        await addDoc(collection(db, "expenses"), { amount, desc, user: Auth.user.name, time: serverTimestamp() });
        document.getElementById('exp-amount').value = ''; document.getElementById('exp-desc').value = '';
        Swal.fire({icon:'success', title:'تم التسجيل', timer:1500, showConfirmButton:false});
        logAudit(`صرف: ${desc} بقيمة ${amount}`);
    } catch(e) { console.error(e); Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};

window.renderDailyLedger = () => {
    let combined = []; let totalSales = 0, totalPaid = 0, totalDues = 0, totalExpenses = 0;
    const todayStr = new Date().toDateString();

    todayInvoicesData.forEach(i => {
        if (i.time?.toDate().toDateString() === todayStr) {
            totalSales += Number(i.total || 0); totalPaid += Number(i.paid || 0); totalDues += Number(i.due || 0);
            combined.push({
                timeObj: i.time?.toDate(), timeStr: i.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || '--',
                desc: i.isUnified ? `ملف: ${i.pName}` : `بيع: ${i.pName}`,
                val: `<span class="en-num" style="color:var(--success); font-weight:bold;">+ ${Number(i.paid||0).toFixed(2)}</span>`
            });
        }
    });

    todayExpensesData.forEach(e => {
        if (e.time?.toDate().toDateString() === todayStr) {
            totalExpenses += Number(e.amount || 0);
            combined.push({
                timeObj: e.time?.toDate(), timeStr: e.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || '--',
                desc: `مصروف: ${e.desc}`,
                val: `<span class="en-num" style="color:var(--danger); font-weight:bold;">- ${Number(e.amount||0).toFixed(2)}</span>`
            });
        }
    });

    combined.sort((a,b) => (b.timeObj?.getTime() || 0) - (a.timeObj?.getTime() || 0));

    let html = '';
    combined.forEach(r => { html += `<tr><td class="en-num">${r.timeStr}</td><td>${r.desc}</td><td>${r.val}</td></tr>`; });
    if(combined.length === 0) html = '<tr><td colspan="3" style="text-align:center; color:gray;">لا توجد حركات اليوم</td></tr>';

    if(document.getElementById('tb-daily-ledger')) document.getElementById('tb-daily-ledger').innerHTML = html;
    
    if(document.getElementById('kpi-sales')) document.getElementById('kpi-sales').innerText = totalSales.toFixed(2);
    if(document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalPaid.toFixed(2);
    if(document.getElementById('kpi-dues')) document.getElementById('kpi-dues').innerText = totalDues.toFixed(2);
    if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').innerText = totalExpenses.toFixed(2);
    if(document.getElementById('kpi-netbox')) document.getElementById('kpi-netbox').innerText = (totalPaid - totalExpenses).toFixed(2);
};

// ================== العيادة (الملف الشامل) ==================
window.calcUnifiedTotal = () => {
    const frame = parseFloat(document.getElementById('u-frame-price').value) || 0;
    const lenses = parseFloat(document.getElementById('u-lenses-price').value) || 0;
    const cl = parseFloat(document.getElementById('u-cl-price').value) || 0;
    const extras = parseFloat(document.getElementById('u-extras-price').value) || 0;
    const subtotal = frame + lenses + cl + extras;
    document.getElementById('u-subtotal').value = subtotal.toFixed(2);
    const discountPercent = parseFloat(document.getElementById('u-discount').value) || 0;
    const finalTotal = subtotal - (subtotal * (discountPercent / 100));
    document.getElementById('u-total').value = finalTotal.toFixed(2);
    const paid = parseFloat(document.getElementById('u-paid').value) || 0;
    let due = finalTotal - paid; if (due < 0) due = 0; 
    document.getElementById('u-due').value = due.toFixed(2);
    document.getElementById('u-due-display').innerText = due.toFixed(2);
};

window.saveUnifiedRecord = async () => {
    const name = document.getElementById('u-name').value.trim(); const phone = document.getElementById('u-phone').value;
    if (!name) return Swal.fire('خطأ', 'اسم المراجع إجباري', 'error');

    const rxData = {
        pd: document.getElementById('u-pd').value || '-', notes: document.getElementById('u-notes').value || '-',
        od: { s: document.getElementById('u-od-s').value, c: document.getElementById('u-od-c').value, a: document.getElementById('u-od-a').value, add: document.getElementById('u-od-add').value },
        os: { s: document.getElementById('u-os-s').value, c: document.getElementById('u-os-c').value, a: document.getElementById('u-os-a').value, add: document.getElementById('u-os-add').value }
    };

    const salesData = {
        frame: { type: document.getElementById('u-frame-type').value, price: parseFloat(document.getElementById('u-frame-price').value) || 0 },
        lenses: { type: document.getElementById('u-lenses-type').value, price: parseFloat(document.getElementById('u-lenses-price').value) || 0 },
        cl: { type: document.getElementById('u-cl-type').value, price: parseFloat(document.getElementById('u-cl-price').value) || 0 },
        extras: { type: document.getElementById('u-extras-type').value, price: parseFloat(document.getElementById('u-extras-price').value) || 0 }
    };

    const subtotal = parseFloat(document.getElementById('u-subtotal').value) || 0;
    const discountPercent = parseFloat(document.getElementById('u-discount').value) || 0;
    const total = parseFloat(document.getElementById('u-total').value) || 0;
    const paid = parseFloat(document.getElementById('u-paid').value) || 0;
    const due = parseFloat(document.getElementById('u-due').value) || 0;
    const paymentMethod = document.getElementById('u-payment-method').value || 'كاش';
    
    const invId = 'DLT-' + Math.floor(Math.random() * 90000 + 10000);
    const doctorName = Auth.user ? Auth.user.name : 'موظف';

    let prodDesc = [];
    if(salesData.frame.type) prodDesc.push("إطار"); if(salesData.lenses.type) prodDesc.push("عدسات");
    if(salesData.cl.type) prodDesc.push("لاصق"); if(salesData.extras.type) prodDesc.push("أخرى");
    const fullProdName = prodDesc.join(' + ') || 'فحص طبي';

    try {
        await addDoc(collection(db, "invoices"), {
            invId, pName: name, phone: phone, prodName: fullProdName, 
            subtotal, discountPercent, total, paid, due, paymentMethod,
            labStatus: 'انتظار', time: serverTimestamp(), isUnified: true, rx: rxData, detailedSales: salesData, doctor: doctorName 
        });

        Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1500, showConfirmButton: false });
        printUnifiedInvoice({ invId, pName: name, phone, time: new Date(), doctor: doctorName, rx: rxData, detailedSales: salesData, subtotal, discountPercent, total, paid, due, paymentMethod });

        document.getElementById('u-name').value = ''; document.getElementById('u-phone').value = '';
        document.querySelectorAll('.rx-table input, .grid-2 input').forEach(inp => inp.value = '');
        document.querySelectorAll('.sales-row input').forEach(inp => inp.value = '');
        document.getElementById('u-discount').value = "0"; document.getElementById('u-paid').value = '';
        calcUnifiedTotal();
    } catch (e) { console.error(e); Swal.fire('خطأ', 'تأكد من الانترنت', 'error'); }
};

window.printFromData = (invId) => {
    const record = window.allUnifiedRecords.find(r => r.invId === invId);
    if(record) printUnifiedInvoice({ ...record, time: record.time?.toDate() || new Date() });
};

function printUnifiedInvoice(data) {
    const rx = data.rx; const s = data.detailedSales;
    const dateStr = data.time.toLocaleDateString('en-GB'); 
    const pMethod = data.paymentMethod || 'كاش';

    document.getElementById('pr-content').innerHTML = `
        <div class="print-card">
            <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; text-align:left;">
                <h2 style="margin:0; font-size:1.4rem; font-weight:900; font-family:Arial,sans-serif;">Delta Optics</h2>
                <h4 style="margin:0; font-size:0.85rem; color:#475569;">Medical Rx & Receipt</h4>
            </div>
            <div style="font-size:0.9rem; margin-bottom:15px; border-bottom:1px dashed #000; padding-bottom:10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span><b>No:</b> <span class="en-num-print">${data.invId}</span></span><span><span class="en-num-print">${dateStr}</span></span></div>
                <div style="display:flex; justify-content:space-between;"><span><b>المراجع:</b> ${data.pName}</span><span class="en-num-print">${data.phone || '---'}</span></div>
            </div>
            <div style="font-weight:bold; text-align:center; font-size:0.85rem; border:1px solid #000; background:#f0f0f0 !important; -webkit-print-color-adjust:exact; margin-bottom:5px;">القياسات (Optical Rx)</div>
            <table class="print-table">
                <tr><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr>
                <tr><th>R (OD)</th><td><span class="en-num-print">${rx.od.s||'-'}</span></td><td><span class="en-num-print">${rx.od.c||'-'}</span></td><td><span class="en-num-print">${rx.od.a||'-'}</span></td><td><span class="en-num-print">${rx.od.add||'-'}</span></td></tr>
                <tr><th>L (OS)</th><td><span class="en-num-print">${rx.os.s||'-'}</span></td><td><span class="en-num-print">${rx.os.c||'-'}</span></td><td><span class="en-num-print">${rx.os.a||'-'}</span></td><td><span class="en-num-print">${rx.os.add||'-'}</span></td></tr>
            </table>
            <div style="font-size:0.85rem; margin-bottom:15px;"><b>PD:</b> <span class="en-num-print">${rx.pd||'-'}</span> | <b>ملاحظة:</b> ${rx.notes||'-'}</div>

            ${data.subtotal > 0 ? `
            <div style="font-weight:bold; text-align:center; font-size:0.85rem; border:1px solid #000; background:#f0f0f0 !important; -webkit-print-color-adjust:exact; margin-bottom:5px;">المشتريات (Purchases)</div>
            <table class="print-table">
                <tr><th>البيان</th><th style="width:70px;">JOD</th></tr>
                ${s.frame.type ? `<tr><td>إطار: ${s.frame.type}</td><td><span class="en-num-print">${s.frame.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.lenses.type ? `<tr><td>عدسات: ${s.lenses.type}</td><td><span class="en-num-print">${s.lenses.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.cl.type ? `<tr><td>لاصق: ${s.cl.type}</td><td><span class="en-num-print">${s.cl.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.extras.type ? `<tr><td>أخرى: ${s.extras.type}</td><td><span class="en-num-print">${s.extras.price.toFixed(2)}</span></td></tr>` : ''}
            </table>
            <div style="border:2px solid #000; border-radius:4px; padding:10px; font-size:0.95rem;">
                <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><b class="en-num-print">${data.subtotal.toFixed(2)}</b></div>
                ${data.discountPercent > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Discount ${data.discountPercent}%:</span><b class="en-num-print">- ${(data.subtotal * (data.discountPercent/100)).toFixed(2)}</b></div>` : ''}
                <div style="display:flex; justify-content:space-between; font-weight:900; font-size:1.1rem; border-top:1px solid #000; padding-top:5px; margin-top:5px;"><span>Total:</span><b class="en-num-print">${data.total.toFixed(2)}</b></div>
                <div style="display:flex; justify-content:space-between;"><span>Paid (${pMethod}):</span><b class="en-num-print">${data.paid.toFixed(2)}</b></div>
                <div style="display:flex; justify-content:space-between;"><span>Due الباقي:</span><b class="en-num-print">${data.due.toFixed(2)}</b></div>
            </div>` : ''}
            <div style="text-align:center; margin-top:20px; font-weight:bold; font-size:0.8rem; border-top:1px dashed #000; padding-top:10px;"><p style="margin:0;">بواسطة: ${data.doctor || 'موظف'} | ✨ نتمنى لكم رؤية واضحة ✨</p></div>
        </div>`;
    window.print();
}

window.showPatientHistory = (patientName) => {
    document.getElementById('history-patient-name').innerText = patientName;
    const tbody = document.getElementById('tb-patient-history'); tbody.innerHTML = '';
    const records = window.allUnifiedRecords.filter(r => r.pName === patientName);
    if (records.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات</td></tr>'; } 
    else { records.forEach(r => { tbody.innerHTML += `<tr><td class="en-num">${r.time?.toDate().toLocaleDateString('en-GB') || '--'}</td><td class="en-num">${r.invId}</td><td>${r.prodName}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${parseFloat(r.total).toFixed(2)}</td><td><button class="btn" style="background:#0f172a; color:white; padding:5px 10px; border:none; border-radius:5px;" onclick="printFromData('${r.invId}')"><i class="fas fa-print"></i> طباعة</button></td></tr>`; }); }
    document.getElementById('history-modal').style.display = 'flex';
};

window.printPatientHistory = () => {
    const pName = document.getElementById('history-patient-name').innerText;
    const records = window.allUnifiedRecords.filter(r => r.pName === pName);
    if(records.length === 0) return;
    let rowsHtml = ''; let totalSpent = 0;
    records.forEach(r => { totalSpent += Number(r.total); rowsHtml += `<tr><td><span class="en-num-print">${r.time?.toDate().toLocaleDateString('en-GB')||'--'}</span></td><td><span class="en-num-print">${r.invId}</span></td><td>${r.prodName}</td><td><span class="en-num-print">${parseFloat(r.total).toFixed(2)}</span></td></tr>`; });
    document.getElementById('pr-content').innerHTML = `<div class="print-card"><div style="border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:15px; text-align:left;"><h2 style="margin:0; font-family:Arial,sans-serif;">Delta Optics</h2><h4 style="margin:0; color:#475569;">Patient History | كشف سجل</h4></div><div style="margin-bottom:15px; font-size:1rem;"><b>المراجع:</b> ${pName}<br><b>تاريخ الطباعة:</b> <span class="en-num-print">${new Date().toLocaleDateString('en-GB')}</span></div><table class="print-table"><tr><th>التاريخ</th><th>الملف</th><th>التفاصيل</th><th>JOD</th></tr>${rowsHtml}</table><div style="font-size:1.1rem; font-weight:bold; border:2px solid #000; padding:10px; border-radius:6px;">Total Spent: <span class="en-num-print">${totalSpent.toFixed(2)}</span> JOD</div></div>`;
    window.print();
};

// ================== المبيعات السريعة ==================
window.updatePosPrice = () => { document.getElementById('pos-total').value = document.getElementById('pos-product').options[document.getElementById('pos-product').selectedIndex]?.dataset.price || 0; calcPosTotal(); };
window.calcPosTotal = () => {
    const price = parseFloat(document.getElementById('pos-price').value) || 0;
    const discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0;
    const finalTotal = price - (price * (discountPercent / 100));
    document.getElementById('pos-total').value = finalTotal.toFixed(2);
    const paid = parseFloat(document.getElementById('pos-paid').value) || 0;
    let due = finalTotal - paid; if (due < 0) due = 0; 
    document.getElementById('pos-due').value = due.toFixed(2); document.getElementById('pos-due-display').innerText = due.toFixed(2);
};
window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').value.trim(), prodSel = document.getElementById('pos-product'), prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const subtotal = parseFloat(document.getElementById('pos-price').value) || 0, discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0, total = parseFloat(document.getElementById('pos-total').value) || 0, paid = parseFloat(document.getElementById('pos-paid').value) || 0, due = parseFloat(document.getElementById('pos-due').value) || 0, paymentMethod = document.getElementById('pos-payment-method').value || 'كاش';
    if (!pName || !prodName || !prodSel.value) return Swal.fire('خطأ', 'أكمل البيانات', 'error');
    const invId = 'POS-' + Math.floor(Math.random() * 90000 + 10000);
    try {
        await addDoc(collection(db, "invoices"), { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod, labStatus: 'تم التسليم', time: serverTimestamp(), isUnified: false, doctor: Auth.user ? Auth.user.name : 'موظف' });
        const currentQty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty); if (currentQty > 0) await updateDoc(doc(db, "products", prodSel.value), { qty: currentQty - 1 });
        Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1500, showConfirmButton: false });
        printPosFromData(invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod);
        document.getElementById('pos-patient').value = ''; prodSel.value = ''; document.getElementById('pos-price').value = '0.00'; document.getElementById('pos-discount').value = '0'; document.getElementById('pos-paid').value = ''; calcPosTotal();
    } catch(e) { Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};

window.printPosFromData = (invId, pName, prodName, subtotal, discountPercent, total, paid, due, pMethod) => {
    let d = { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod: pMethod, doctor: Auth.user ? Auth.user.name : 'موظف', time: new Date() };
    if(!pName) { const record = window.allUnifiedRecords.find(r => r.invId === invId); if(record) d = { ...record, time: record.time?.toDate() || new Date() }; else return; }
    document.getElementById('pr-content').innerHTML = `<div class="print-card" style="width:100mm; text-align:center;"><h2 style="margin:0; font-family:Arial;">Delta Optics</h2><p>فاتورة مبيعات: <span class="en-num-print">${d.invId}</span></p><p>التاريخ: <span class="en-num-print">${d.time.toLocaleDateString('en-GB')}</span></p><hr><p><b>الزبون:</b> ${d.pName}</p><p><b>المنتج:</b> ${d.prodName}</p><hr><h3 style="margin:5px;">الإجمالي: <span class="en-num-print">${d.total.toFixed(2)}</span> JOD</h3><p style="margin:2px;">المدفوع: <span class="en-num-print">${d.paid.toFixed(2)}</span> | الباقي: <span class="en-num-print">${d.due.toFixed(2)}</span></p></div>`;
    window.print();
};

window.openOnlineReport = (testId) => {
    const record = window.allOnlineTests.find(t => t.id === testId); if (!record) return;
    document.getElementById('report-m-name').innerText = record.name || 'غير محدد'; document.getElementById('report-m-phone').innerText = record.phone || '---'; document.getElementById('report-m-details').innerText = record.details || 'لا توجد تفاصيل';
    const waMsg = encodeURIComponent(`مرحباً ${record.name}، معك عيادة دلتا للبصريات...`);
    document.getElementById('btn-wa-report').href = `https://wa.me/${record.phone ? record.phone.replace(/^0/, '962') : '962775549700'}?text=${waMsg}`;
    const processBtn = document.getElementById('btn-process-report');
    if (record.isProcessed) { processBtn.style.display = 'none'; } else { processBtn.style.display = 'flex'; processBtn.onclick = async () => { await updateDoc(doc(db, "tests", testId), { isProcessed: true }); document.getElementById('online-report-modal').style.display = 'none'; Swal.fire({ icon: 'success', title: 'تم', timer: 1500, showConfirmButton: false }); }; }
    document.getElementById('online-report-modal').style.display = 'flex';
};

function startSync() {
    onSnapshot(query(collection(db, "tests"), orderBy("timestamp", "desc")), (s) => {
        let tbOnlineHtml = ""; window.allOnlineTests = [];
        s.forEach(d => { const data = d.data(); window.allOnlineTests.push({ id: d.id, ...data }); const dStr = data.timestamp?.toDate().toLocaleDateString('en-GB') || '--'; const stat = data.isProcessed ? '<span style="color:var(--success); font-weight:bold;">مكتمل</span>' : '<span style="color:var(--warning); font-weight:bold;">جديد</span>'; tbOnlineHtml += `<tr><td>${data.name||'--'}</td><td class="en-num">${data.phone||'--'}</td><td class="en-num">${dStr}</td><td>${stat}</td><td><button class="btn btn-primary" onclick="openOnlineReport('${d.id}')" style="padding:5px 10px;">عرض</button></td></tr>`; });
        if(document.getElementById('tb-online-rx')) document.getElementById('tb-online-rx').innerHTML = tbOnlineHtml;
    });

    onSnapshot(query(collection(db, "expenses"), orderBy("time", "desc")), (s) => {
        todayExpensesData = []; s.forEach(d => { todayExpensesData.push({ id: d.id, ...d.data() }); });
        if(typeof window.renderDailyLedger === 'function') window.renderDailyLedger();
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", tbLab = ""; let posPatientHtml = "<option value=''>-- المراجع --</option>";
        todayInvoicesData = []; window.allUnifiedRecords = []; let uniquePatients = {}; 
        s.forEach(d => { 
            const i = d.data(); todayInvoicesData.push(i);
            if (!i.isUnified) { window.allUnifiedRecords.push(i); tbInvoices += `<tr><td class="en-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${parseFloat(i.total).toFixed(2)}</td><td class="en-num" style="color:var(--danger); font-weight:bold;">${parseFloat(i.due).toFixed(2)}</td><td><button class="btn btn-dark" onclick="printPosFromData('${i.invId}')" style="padding: 5px 10px;"><i class="fas fa-print"></i></button></td></tr>`; }
            if (i.isUnified && i.rx) { window.allUnifiedRecords.push(i); if (!uniquePatients[i.pName]) { uniquePatients[i.pName] = { lastVisit: i.time?.toDate(), totalSpent: 0 }; } uniquePatients[i.pName].totalSpent += Number(i.total); }
        });
        const patientNames = Object.keys(uniquePatients);
        if(document.getElementById('patients-list')) { document.getElementById('patients-list').innerHTML = patientNames.map(name => `<option value="${name}">`).join(''); }
        let tbUnifiedHTML = ""; patientNames.forEach(pName => { tbUnifiedHTML += `<tr><td style="font-weight:bold; color:var(--primary); font-size:1.1rem;">${pName}</td><td class="en-num">${uniquePatients[pName].lastVisit?.toLocaleDateString('en-GB')||'--'}</td><td class="en-num" style="font-weight:bold;">${uniquePatients[pName].totalSpent.toFixed(2)}</td><td><button class="btn btn-primary" style="padding:5px 10px;" onclick="showPatientHistory('${pName}')">السجل</button></td></tr>`; posPatientHtml += `<option value="${pName}">${pName}</option>`; });
        if(document.getElementById('tb-invc')) document.getElementById('tb-invc').innerHTML = tbInvoices; 
        if(document.getElementById('tb-unified-rx')) document.getElementById('tb-unified-rx').innerHTML = tbUnifiedHTML;
        if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = posPatientHtml;
        if(typeof window.renderDailyLedger === 'function') window.renderDailyLedger();
    });
}
