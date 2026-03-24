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

window.exportToCSV = (tableId, filename) => {
    let csv = [];
    const rows = document.querySelectorAll(`#${tableId} tr`);
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length - 1; j++) row.push(cols[j].innerText); 
        csv.push(row.join(","));
    }
    const csvFile = new Blob(["\uFEFF" + csv.join("\n")], {type: "text/csv;charset=utf-8;"});
    const link = document.createElement("a"); link.href = URL.createObjectURL(csvFile); link.download = filename; link.click();
    logAudit(`تصدير جدول: ${filename}`);
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

// ================== نظام المراقبة المالية (الصندوق والمصروفات) ==================
window.saveExpense = async () => {
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const desc = document.getElementById('exp-desc').value.trim();
    if(!amount || !desc) return Swal.fire('خطأ', 'أدخل المبلغ وتفاصيل المصروف', 'error');
    
    try {
        await addDoc(collection(db, "expenses"), {
            amount, desc, user: Auth.user.name, time: serverTimestamp()
        });
        document.getElementById('exp-amount').value = '';
        document.getElementById('exp-desc').value = '';
        Swal.fire({icon:'success', title:'تم التسجيل', text:'تم خصم المبلغ من الصندوق', timer:1500, showConfirmButton:false});
        logAudit(`تسجيل مصروف: ${desc} بقيمة ${amount}`);
    } catch(e) { console.error(e); Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};

window.renderDailyLedger = () => {
    let combined = [];
    let totalSales = 0, totalPaid = 0, totalDues = 0, totalExpenses = 0;

    todayInvoicesData.forEach(i => {
        if (i.time?.toDate().toDateString() === new Date().toDateString()) {
            totalSales += Number(i.total || 0);
            totalPaid += Number(i.paid || 0);
            totalDues += Number(i.due || 0);
            combined.push({
                timeObj: i.time?.toDate(),
                timeStr: i.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || '--',
                type: 'مبيعات',
                desc: i.isUnified ? `ملف عيادة: ${i.pName}` : `بيع سريع: ${i.pName}`,
                user: i.doctor || 'موظف',
                in: Number(i.paid || 0),
                out: 0
            });
        }
    });

    todayExpensesData.forEach(e => {
        if (e.time?.toDate().toDateString() === new Date().toDateString()) {
            totalExpenses += Number(e.amount || 0);
            combined.push({
                timeObj: e.time?.toDate(),
                timeStr: e.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || '--',
                type: 'مصروف',
                desc: e.desc,
                user: e.user || 'موظف',
                in: 0,
                out: Number(e.amount || 0)
            });
        }
    });

    combined.sort((a,b) => (b.timeObj?.getTime() || 0) - (a.timeObj?.getTime() || 0));

    let html = '';
    combined.forEach(r => {
        const inStr = r.in > 0 ? `<span class="en-num" style="color:var(--success); font-weight:bold;">+ ${r.in.toFixed(2)}</span>` : '-';
        const outStr = r.out > 0 ? `<span class="en-num" style="color:var(--danger); font-weight:bold;">- ${r.out.toFixed(2)}</span>` : '-';
        const typeBadge = r.type === 'مبيعات' ? `<span class="badge" style="background:#d1fae5; color:var(--success); padding:5px 8px;"><i class="fas fa-arrow-up"></i> إيداع</span>` : `<span class="badge" style="background:#fee2e2; color:var(--danger); padding:5px 8px;"><i class="fas fa-arrow-down"></i> سحب</span>`;
        
        html += `<tr><td class="en-num">${r.timeStr}</td><td>${typeBadge}</td><td>${r.desc}</td><td><span class="badge" style="background:#f1f5f9; color:#475569;">${r.user}</span></td><td>${inStr}</td><td>${outStr}</td></tr>`;
    });

    if(combined.length === 0) html = '<tr><td colspan="6" style="text-align:center; color:gray; padding:20px;">لا توجد حركات مالية مسجلة اليوم</td></tr>';

    if(document.getElementById('tb-daily-ledger')) document.getElementById('tb-daily-ledger').innerHTML = html;
    
    const netCash = totalPaid - totalExpenses;

    if(document.getElementById('kpi-sales')) document.getElementById('kpi-sales').innerText = totalSales.toFixed(2);
    if(document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalPaid.toFixed(2);
    if(document.getElementById('kpi-dues')) document.getElementById('kpi-dues').innerText = totalDues.toFixed(2);
    if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').innerText = totalExpenses.toFixed(2);
    if(document.getElementById('kpi-netbox')) document.getElementById('kpi-netbox').innerText = netCash.toFixed(2);
};

// ================== الآلة الحاسبة الذكية ==================
window.calcUnifiedTotal = () => {
    const frame = parseFloat(document.getElementById('u-frame-price').value) || 0;
    const lenses = parseFloat(document.getElementById('u-lenses-price').value) || 0;
    const cl = parseFloat(document.getElementById('u-cl-price').value) || 0;
    const extras = parseFloat(document.getElementById('u-extras-price').value) || 0;
    const subtotal = frame + lenses + cl + extras;
    document.getElementById('u-subtotal').value = subtotal.toFixed(2);
    const discountPercent = parseFloat(document.getElementById('u-discount').value) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const finalTotal = subtotal - discountAmount;
    document.getElementById('u-total').value = finalTotal.toFixed(2);
    const paid = parseFloat(document.getElementById('u-paid').value) || 0;
    let due = finalTotal - paid;
    if (due < 0) due = 0; 
    document.getElementById('u-due').value = due.toFixed(2);
    document.getElementById('u-due-display').innerText = due.toFixed(2);
};

window.saveUnifiedRecord = async () => {
    const name = document.getElementById('u-name').value.trim();
    const phone = document.getElementById('u-phone').value;
    if (!name) return Swal.fire('خطأ', 'اسم المراجع إجباري لإنشاء الملف', 'error');

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
    const currentTime = new Date();

    try {
        await addDoc(collection(db, "invoices"), {
            invId, pName: name, phone: phone, prodName: fullProdName, 
            subtotal, discountPercent, total, paid, due, paymentMethod,
            labStatus: 'انتظار', time: serverTimestamp(),
            isUnified: true, rx: rxData, detailedSales: salesData, doctor: doctorName 
        });

        logAudit(`إصدار ملف: ${name}`);
        Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'جاري الطباعة...', timer: 1500, showConfirmButton: false });

        printUnifiedInvoice({ invId, pName: name, phone, time: currentTime, doctor: doctorName, rx: rxData, detailedSales: salesData, subtotal, discountPercent, total, paid, due, paymentMethod });

        document.getElementById('u-name').value = ''; document.getElementById('u-phone').value = '';
        document.querySelectorAll('.clinical-table input, .grid-2 input').forEach(inp => inp.value = '');
        document.querySelectorAll('.product-item input').forEach(inp => inp.value = '');
        document.getElementById('u-discount').value = "0"; document.getElementById('u-paid').value = '';
        calcUnifiedTotal();

    } catch (e) { console.error(e); Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};

window.printFromData = (invId) => {
    const record = window.allUnifiedRecords.find(r => r.invId === invId);
    if(record) {
        const printData = { ...record, time: record.time?.toDate() || new Date() };
        printUnifiedInvoice(printData);
    }
};

window.printPatientHistory = () => {
    const pName = document.getElementById('history-patient-name').innerText;
    const records = window.allUnifiedRecords.filter(r => r.pName === pName);
    if(records.length === 0) return;
    
    let rowsHtml = ''; let totalSpent = 0;
    records.forEach(r => {
        totalSpent += Number(r.total);
        const dObj = r.time?.toDate();
        const dateStr = dObj ? dObj.toLocaleDateString('en-GB') : '--';
        rowsHtml += `<tr><td><span class="en-num-print">${dateStr}</span></td><td><span class="en-num-print">${r.invId}</span></td><td style="font-family: 'Tajawal', sans-serif;">${r.prodName}</td><td><span class="en-num-print">${parseFloat(r.total).toFixed(2)}</span></td></tr>`;
    });

    document.getElementById('pr-content').innerHTML = `
        <div class="print-card">
            <div class="print-header">
                <div style="text-align: left;">
                    <h2 style="margin:0; font-size:1.4rem; font-weight:900; font-family: 'Segoe UI', Arial, sans-serif;">Delta Optics</h2>
                    <h4 style="margin:0; font-size: 0.85rem; font-family: 'Segoe UI', Arial, sans-serif; color: #475569;">Patient History | كشف سجل مريض</h4>
                </div>
            </div>
            <div style="margin-bottom: 20px; font-size: 1rem; border-bottom: 1px dashed #000; padding-bottom: 10px;">
                <b>اسم المراجع:</b> ${pName}<br>
                <div style="margin-top: 5px;"><b>تاريخ الطباعة:</b> <span class="en-num-print">${new Date().toLocaleDateString('en-GB')}</span> &nbsp; <span class="en-num-print">${new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}</span></div>
            </div>
            <table class="print-table"><tr><th>التاريخ (Date)</th><th>الملف (Record No)</th><th>التفاصيل (Details)</th><th>القيمة (JOD)</th></tr>${rowsHtml}</table>
            <div style="text-align: left; font-size: 1.1rem; font-weight: bold; margin-top: 15px; border: 2px solid #000; padding: 10px; border-radius: 6px;">
                إجمالي الإنفاق (Total Spent): <span class="en-num-print" style="font-size: 1.3rem;">${totalSpent.toFixed(2)}</span> JOD
            </div>
        </div>
    `;
    window.print();
};

function printUnifiedInvoice(data) {
    const rx = data.rx; const s = data.detailedSales;
    const dateStr = data.time.toLocaleDateString('en-GB'); 
    const timeStr = data.time.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
    const pMethod = data.paymentMethod || 'كاش';

    document.getElementById('pr-content').innerHTML = `
        <div class="print-card">
            <div class="print-header">
                <div style="text-align: left;">
                    <h2 style="margin:0; font-size:1.4rem; font-weight:900; font-family: 'Segoe UI', Arial, sans-serif;">Delta Optics</h2>
                    <h4 style="margin:0; font-size: 0.85rem; font-family: 'Segoe UI', Arial, sans-serif; color: #475569;">Medical Rx & Receipt | وصفة طبية وفاتورة</h4>
                </div>
            </div>

            <div style="font-size: 0.9rem; margin-bottom: 12px; line-height: 1.5; border-bottom: 1px dashed #000; padding-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span><b>No:</b> <span class="en-num-print">${data.invId}</span></span>
                    <span><b>Date:</b> <span class="en-num-print">${dateStr} ${timeStr}</span></span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span><b>المراجع:</b> ${data.pName}</span>
                    <span><b>Tel:</b> <span class="en-num-print">${data.phone || '---'}</span></span>
                </div>
            </div>
            
            <div style="font-weight: bold; text-align: center; font-size: 0.85rem; border: 1px solid #000; margin-bottom: 4px; background: #f0f0f0 !important; -webkit-print-color-adjust: exact;">القياسات (Optical Rx)</div>
            <table class="print-table">
                <tr><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr>
                <tr><th>R (OD)</th><td><span class="en-num-print">${rx.od.s||'-'}</span></td><td><span class="en-num-print">${rx.od.c||'-'}</span></td><td><span class="en-num-print">${rx.od.a||'-'}</span></td><td><span class="en-num-print">${rx.od.add||'-'}</span></td></tr>
                <tr><th>L (OS)</th><td><span class="en-num-print">${rx.os.s||'-'}</span></td><td><span class="en-num-print">${rx.os.c||'-'}</span></td><td><span class="en-num-print">${rx.os.a||'-'}</span></td><td><span class="en-num-print">${rx.os.add||'-'}</span></td></tr>
            </table>
            <div style="font-size:0.85rem; margin-bottom:15px;"><b>PD:</b> <span class="en-num-print">${rx.pd||'-'}</span> | <b>ملاحظة:</b> ${rx.notes||'-'}</div>

            ${data.subtotal > 0 ? `
            <div style="font-weight: bold; text-align: center; font-size: 0.85rem; border: 1px solid #000; margin-bottom: 4px; background: #f0f0f0 !important; -webkit-print-color-adjust: exact;">المشتريات (Purchases)</div>
            <table class="print-table">
                <tr><th>البيان (Desc)</th><th style="width:70px;">JOD</th></tr>
                ${s.frame.type ? `<tr><td style="font-family: 'Tajawal', sans-serif;">إطار: ${s.frame.type}</td><td><span class="en-num-print">${s.frame.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.lenses.type ? `<tr><td style="font-family: 'Tajawal', sans-serif;">عدسات: ${s.lenses.type}</td><td><span class="en-num-print">${s.lenses.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.cl.type ? `<tr><td style="font-family: 'Tajawal', sans-serif;">لاصق: ${s.cl.type}</td><td><span class="en-num-print">${s.cl.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.extras.type ? `<tr><td style="font-family: 'Tajawal', sans-serif;">أخرى: ${s.extras.type}</td><td><span class="en-num-print">${s.extras.price.toFixed(2)}</span></td></tr>` : ''}
            </table>
            
            <div style="border: 2px solid #000; border-radius: 4px; padding: 8px; font-size: 0.95rem;">
                <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span> <span><b class="en-num-print">${data.subtotal.toFixed(2)}</b></span></div>
                ${data.discountPercent > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Discount ${data.discountPercent}%:</span> <span><b class="en-num-print">- ${(data.subtotal * (data.discountPercent/100)).toFixed(2)}</b></span></div>` : ''}
                <div style="display:flex; justify-content:space-between; font-weight: 900; font-size: 1.1rem; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;"><span>Total:</span> <span><b class="en-num-print">${data.total.toFixed(2)}</b></span></div>
                <div style="display:flex; justify-content:space-between;"><span>Paid (${pMethod}):</span> <span><b class="en-num-print">${data.paid.toFixed(2)}</b></span></div>
                <div style="display:flex; justify-content:space-between;"><span>Due الباقي:</span> <span><b class="en-num-print">${data.due.toFixed(2)}</b></span></div>
            </div>
            ` : ''}
            
            <div style="text-align:center; margin-top:20px; font-weight:bold; font-size: 0.8rem; border-top: 1px dashed #000; padding-top: 10px;">
                <p style="margin: 0; font-family: 'Tajawal', sans-serif;">بواسطة: ${data.doctor || 'موظف'} | ✨ نتمنى لكم رؤية واضحة ✨</p>
            </div>
        </div>
    `;
    window.print();
}

window.showPatientHistory = (patientName) => {
    const modal = document.getElementById('history-modal');
    const tbody = document.getElementById('tb-patient-history');
    document.getElementById('history-patient-name').innerText = patientName;
    tbody.innerHTML = '';
    const records = window.allUnifiedRecords.filter(r => r.pName === patientName);
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:gray;">لا توجد سجلات</td></tr>';
    } else {
        records.forEach(r => {
            const dateStr = r.time?.toDate().toLocaleDateString('en-GB') || '--';
            tbody.innerHTML += `<tr><td class="en-num">${dateStr}</td><td class="en-num">${r.invId}</td><td>${r.prodName}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${parseFloat(r.total).toFixed(2)}</td><td><button class="btn btn-dark" style="padding: 5px 10px;" onclick="printFromData('${r.invId}')"><i class="fas fa-print"></i> طباعة</button></td></tr>`;
        });
    }
    modal.style.display = 'flex';
};

// ================== المبيعات السريعة ==================
window.updatePosPrice = () => { document.getElementById('pos-total').value = document.getElementById('pos-product').options[document.getElementById('pos-product').selectedIndex]?.dataset.price || 0; calcPosTotal(); };
window.calcPosTotal = () => {
    const price = parseFloat(document.getElementById('pos-price').value) || 0;
    const discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0;
    const discountAmount = price * (discountPercent / 100);
    const finalTotal = price - discountAmount;
    document.getElementById('pos-total').value = finalTotal.toFixed(2);
    const paid = parseFloat(document.getElementById('pos-paid').value) || 0;
    let due = finalTotal - paid; if (due < 0) due = 0; 
    document.getElementById('pos-due').value = due.toFixed(2); document.getElementById('pos-due-display').innerText = due.toFixed(2);
};
window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').value.trim(), prodSel = document.getElementById('pos-product'), prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const subtotal = parseFloat(document.getElementById('pos-price').value) || 0, discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0, total = parseFloat(document.getElementById('pos-total').value) || 0, paid = parseFloat(document.getElementById('pos-paid').value) || 0, due = parseFloat(document.getElementById('pos-due').value) || 0, paymentMethod = document.getElementById('pos-payment-method').value || 'كاش';
    if (!pName || !prodName || !prodSel.value) return Swal.fire('خطأ', 'يرجى إدخال اسم الزبون واختيار المنتج', 'error');
    const invId = 'POS-' + Math.floor(Math.random() * 90000 + 10000); const doctorName = Auth.user ? Auth.user.name : 'موظف'; const currentTime = new Date();
    try {
        await addDoc(collection(db, "invoices"), { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod, labStatus: 'تم التسليم', time: serverTimestamp(), isUnified: false, doctor: doctorName });
        const currentQty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty);
        if (currentQty > 0) await updateDoc(doc(db, "products", prodSel.value), { qty: currentQty - 1 });
        logAudit(`بيع سريع: ${invId}`); Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'جاري الطباعة...', timer: 1500, showConfirmButton: false });
        printPosInvoice({ invId, pName, prodName, time: currentTime, subtotal, discountPercent, total, paid, due, paymentMethod, doctor: doctorName });
        document.getElementById('pos-patient').value = ''; prodSel.value = ''; document.getElementById('pos-price').value = '0.00'; document.getElementById('pos-discount').value = '0'; document.getElementById('pos-paid').value = ''; calcPosTotal();
    } catch(e) { console.error(e); Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};
window.printPosFromData = (invId) => { const record = window.allUnifiedRecords.find(r => r.invId === invId); if(record) { const printData = { ...record, time: record.time?.toDate() || new Date() }; printPosInvoice(printData); } };
function printPosInvoice(data) {
    const dateStr = data.time.toLocaleDateString('en-GB'); const timeStr = data.time.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}); const pMethod = data.paymentMethod || 'كاش';
    document.getElementById('pr-content').innerHTML = `<div class="print-card" style="width: 100mm; margin: 0 auto;"><div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px;"><h2 style="margin:0; font-size:1.5rem; font-weight:900; font-family: 'Segoe UI', Arial, sans-serif;">Delta Optics</h2><h4 style="margin:0; font-size: 0.85rem; color: #475569;">فاتورة مبيعات (Sales Receipt)</h4></div><div style="font-size: 0.85rem; margin-bottom: 15px; line-height: 1.5;"><div><b>No:</b> <span class="en-num-print">${data.invId}</span></div><div><b>Date:</b> <span class="en-num-print">${dateStr} ${timeStr}</span></div><div><b>الزبون:</b> ${data.pName}</div></div><table style="width:100%; text-align:right; border-collapse: collapse; margin-bottom:15px; font-size:0.9rem; border-top: 1px solid #000; border-bottom: 1px solid #000;"><tr><th style="padding:5px 0; border-bottom: 1px solid #000;">المنتج (Item)</th></tr><tr><td style="padding:10px 0; font-weight:bold; font-family: 'Tajawal', sans-serif;">${data.prodName}</td></tr></table><div style="border: 1px solid #000; border-radius: 4px; padding: 10px; font-size: 0.9rem;"><div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Subtotal:</span> <span><b class="en-num-print">${(data.subtotal || data.total).toFixed(2)}</b></span></div>${data.discountPercent > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom: 4px; color: #ea580c;"><span>Discount ${data.discountPercent}%:</span> <span><b class="en-num-print">- ${((data.subtotal || data.total) * (data.discountPercent/100)).toFixed(2)}</b></span></div>` : ''}<div style="display:flex; justify-content:space-between; font-weight: 900; font-size: 1.2rem; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px;"><span>Total:</span> <span><b class="en-num-print">${data.total.toFixed(2)}</b></span></div><div style="display:flex; justify-content:space-between; margin-top: 5px;"><span>Paid (${pMethod}):</span> <span><b class="en-num-print">${data.paid.toFixed(2)}</b></span></div><div style="display:flex; justify-content:space-between;"><span>Due الباقي:</span> <span><b class="en-num-print">${data.due.toFixed(2)}</b></span></div></div><div style="text-align:center; margin-top:15px; font-weight:bold; font-size: 0.75rem;"><p style="margin: 0; font-family: 'Tajawal', sans-serif;">بواسطة: ${data.doctor || 'موظف'} | ✨ شكراً لزيارتكم ✨</p></div></div>`;
    window.print();
}

window.openOnlineReport = (testId) => {
    const record = window.allOnlineTests.find(t => t.id === testId);
    if (!record) return;
    document.getElementById('report-m-name').innerText = record.name || 'غير محدد'; document.getElementById('report-m-phone').innerText = record.phone || '---'; document.getElementById('report-m-details').innerText = record.details || 'لا توجد تفاصيل إضافية.';
    const waMsg = encodeURIComponent(`مرحباً ${record.name}، معك عيادة دلتا للبصريات. بخصوص فحص النظر اللي عملته على موقعنا...`);
    const cleanPhone = record.phone ? record.phone.replace(/^0/, '962') : '962775549700'; 
    document.getElementById('btn-wa-report').href = `https://wa.me/${cleanPhone}?text=${waMsg}`;
    const processBtn = document.getElementById('btn-process-report');
    if (record.isProcessed) { processBtn.style.display = 'none'; } 
    else { processBtn.style.display = 'flex'; processBtn.onclick = async () => { await updateDoc(doc(db, "tests", testId), { isProcessed: true }); document.getElementById('online-report-modal').style.display = 'none'; Swal.fire({ icon: 'success', title: 'تمت المراجعة', timer: 1500, showConfirmButton: false }); }; }
    document.getElementById('online-report-modal').style.display = 'flex';
};

// ================== باقي الوظائف (منتجات، مستخدمين... الخ) ==================
window.compressImage = (event, targetInputId, previewImgId = null) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const MAX = 600; let w = img.width, h = img.height; if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } } canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); document.getElementById(targetInputId).value = canvas.toDataURL('image/jpeg', 0.6); if(previewImgId) { document.getElementById(previewImgId).src = document.getElementById(targetInputId).value; document.getElementById(previewImgId).style.display = 'block'; } Swal.fire({ icon: 'success', title: 'تم التجهيز', showConfirmButton: false, timer: 1000 }); }; img.src = e.target.result; }; reader.readAsDataURL(file); };
let currentEditProductId = null; window.loadProductForEdit = (id, dataObj) => { currentEditProductId = id; document.getElementById('p-name').value = dataObj.name; document.getElementById('p-price').value = dataObj.price; document.getElementById('p-qty').value = dataObj.qty; document.getElementById('p-type').value = dataObj.type; document.getElementById('p-base64').value = dataObj.img || ""; window.scrollTo({ top: 0, behavior: 'smooth' }); };
window.saveProduct = async () => { const name = document.getElementById('p-name').value, price = document.getElementById('p-price').value, type = document.getElementById('p-type').value, qty = document.getElementById('p-qty').value, img = document.getElementById('p-base64').value; if (!name || !price || !type) return Swal.fire('تنبيه', 'أكمل البيانات', 'warning'); if (currentEditProductId) { await updateDoc(doc(db, "products", currentEditProductId), { name, price: Number(price), type, qty: Number(qty), img: img || "" }); logAudit(`تعديل منتج: ${name}`); Swal.fire('نجاح', 'تم التعديل بنجاح', 'success'); currentEditProductId = null; } else { await addDoc(collection(db, "products"), { name, price: Number(price), type, qty: Number(qty), img: img || "", time: serverTimestamp() }); logAudit(`إضافة منتج: ${name}`); Swal.fire('نجاح', 'تم الإضافة', 'success'); } document.getElementById('p-name').value = ''; document.getElementById('p-price').value = ''; document.getElementById('p-qty').value = ''; document.getElementById('p-base64').value = ''; };
window.softDeleteProduct = async (id, data) => { if (confirm('نقل للمحذوفات؟')) { await addDoc(collection(db, "recycle_bin"), { ...data, deletedAt: serverTimestamp(), deletedBy: Auth.user.name }); await deleteDoc(doc(db, "products", id)); logAudit(`حذف منتج: ${data.name}`); } };
window.restoreProduct = async (id, data) => { await addDoc(collection(db, "products"), { name: data.name, price: data.price, type: data.type, qty: data.qty, img: data.img, time: serverTimestamp() }); await deleteDoc(doc(db, "recycle_bin", id)); logAudit(`استرجاع منتج: ${data.name}`); };
window.resetExtColForm = () => { document.getElementById('ext-col-id').value = ""; document.getElementById('ext-col-name').value = ""; document.getElementById('ext-col-type').value = "medical"; document.getElementById('ext-col-base64').value = ""; document.getElementById('ext-col-preview').style.display = "none"; };
window.loadExtCollectionForEdit = (id, name, type, img) => { document.getElementById('ext-col-id').value = id; document.getElementById('ext-col-name').value = name; document.getElementById('ext-col-type').value = type || "medical"; document.getElementById('ext-col-base64').value = img || ""; if(img) { document.getElementById('ext-col-preview').src = img; document.getElementById('ext-col-preview').style.display = "block"; } window.scrollTo({ top: 0, behavior: 'smooth' }); };
window.saveExtCollection = async () => { const id = document.getElementById('ext-col-id').value, name = document.getElementById('ext-col-name').value, type = document.getElementById('ext-col-type').value, img = document.getElementById('ext-col-base64').value; if (!name || !img) return Swal.fire('تنبيه', 'إجباري!', 'warning'); if (id) { await updateDoc(doc(db, "brands", id), { name, type, imageUrl: img }); Swal.fire('تم', 'تم التحديث', 'success'); } else { await addDoc(collection(db, "brands"), { name, type, imageUrl: img, timestamp: serverTimestamp() }); Swal.fire('تم', 'تم الإضافة', 'success'); } resetExtColForm(); };
window.deleteExtCollection = async (id, name) => { if (confirm(`حذف الموديل "${name}"؟`)) { await deleteDoc(doc(db, "brands", id)); } };
window.saveStaff = async () => { const name = document.getElementById('s-name').value, user = document.getElementById('s-user').value, pass = document.getElementById('s-pass').value, role = document.getElementById('s-role').value; await addDoc(collection(db, "users"), { name, user, pass, role, status: "active", time: serverTimestamp() }); logAudit(`إنشاء حساب: ${name}`); Swal.fire('نجاح', 'تم الحفظ', 'success'); };
window.changeUserPassword = async (id) => { const { value: newPass } = await Swal.fire({ title: 'الباسوورد الجديد', input: 'text' }); if (newPass) { await updateDoc(doc(db, "users", id), { pass: newPass }); Swal.fire('تم', 'تغير الباسوورد', 'success'); } };
window.toggleUserFreeze = async (id, currentStatus) => { const newStatus = currentStatus === "frozen" ? "active" : "frozen"; await updateDoc(doc(db, "users", id), { status: newStatus }); };
window.deleteUserAccount = async (id) => { if (confirm('حذف الحساب نهائياً؟')) await deleteDoc(doc(db, "users", id)); };
window.updateLabStatus = async (id, status) => { await updateDoc(doc(db, "invoices", id), { labStatus: status }); };
window.sendChat = async () => { const text = document.getElementById('chat-input').value; if (text) { await addDoc(collection(db, "chat"), { sender: Auth.user.name, text, time: serverTimestamp() }); document.getElementById('chat-input').value = ""; }};
window.saveCMS = async () => { await setDoc(doc(db, "settings", "cms"), { topbar: document.getElementById('cms-topbar').value, openTime: document.getElementById('cms-open-time').value, closeTime: document.getElementById('cms-close-time').value, statusMode: document.getElementById('cms-status-mode').value }); Swal.fire('نجاح', 'تم التحديث', 'success'); };

// ================== المزامنة (Sync) ==================
function startSync() {
    onSnapshot(query(collection(db, "brands"), orderBy("timestamp", "desc")), (s) => {
        let html = "";
        s.forEach(d => {
            const data = d.data(); const imgSrc = data.imageUrl ? `<img src="${data.imageUrl}" class="img-preview" style="width:40px; border-radius:4px;">` : '<span class="badge">لا يوجد صورة</span>';
            const typeLabel = data.type === 'sun' ? '<span class="badge" style="background:#f59e0b; color:white;">شمسي</span>' : '<span class="badge" style="background:#059669; color:white;">طبي</span>';
            html += `<tr><td>${imgSrc}</td><td>${data.name}</td><td>${typeLabel}</td><td><button class="btn btn-warning" onclick='loadExtCollectionForEdit("${d.id}", "${data.name}", "${data.type}", "${data.imageUrl||''}")'><i class="fas fa-edit"></i> تعديل</button> <button class="btn btn-danger" onclick="deleteExtCollection('${d.id}', '${data.name}')"><i class="fas fa-trash"></i> حذف</button></td></tr>`;
        });
        if(document.getElementById('tb-ext-collections')) document.getElementById('tb-ext-collections').innerHTML = html;
    });

    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let invHtml = "", posProdHtml = "<option value=''>-- اختر المنتج --</option>";
        s.forEach(d => { 
            const p = d.data(); const imgSrc = p.img ? `<img src="${p.img}" class="img-preview" style="width:40px; border-radius:4px;">` : 'بدون'; 
            invHtml += `<tr><td>${imgSrc}</td><td>${p.name}</td><td><span class="badge">${p.type}</span></td><td class="en-num">${p.qty}</td><td class="en-num">${p.price}</td><td style="display:flex; gap:5px; justify-content:center;"><button class="btn btn-warning" onclick='loadProductForEdit("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-edit"></i></button><button class="btn btn-danger" onclick='softDeleteProduct("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-trash"></i></button></td></tr>`; 
            if (p.qty > 0) posProdHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`; 
        });
        document.getElementById('tb-inv').innerHTML = invHtml; document.getElementById('pos-product').innerHTML = posProdHtml;
    });

    onSnapshot(query(collection(db, "tests"), orderBy("timestamp", "desc")), (s) => {
        let tbOnlineHtml = ""; window.allOnlineTests = [];
        s.forEach(d => {
            const data = d.data(); const testRecord = { id: d.id, ...data }; window.allOnlineTests.push(testRecord);
            const dateObj = data.timestamp?.toDate(); const dateStr = dateObj ? dateObj.toLocaleDateString('en-GB') : '--'; const timeStr = dateObj ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--';
            const statusLabel = data.isProcessed ? '<span class="badge" style="background:#10b981; color:white;">مكتمل</span>' : '<span class="badge" style="background:#f59e0b; color:white;">جديد</span>';
            const actionBtnClass = data.isProcessed ? 'btn-dark' : 'btn-primary';
            tbOnlineHtml += `<tr><td style="font-weight:bold; color:var(--text-main);">${data.name || '---'}</td><td class="en-num" style="color:var(--primary); font-weight:bold;">${data.phone || '---'}</td><td class="en-num">${dateStr} <small style="color:var(--text-muted);">${timeStr}</small></td><td>${statusLabel}</td><td><button class="btn ${actionBtnClass}" onclick="openOnlineReport('${d.id}')" style="padding: 5px 10px;"><i class="fas fa-microscope"></i> عرض</button></td></tr>`;
        });
        if(document.getElementById('tb-online-rx')) document.getElementById('tb-online-rx').innerHTML = tbOnlineHtml;
    });

    onSnapshot(query(collection(db, "expenses"), orderBy("time", "desc")), (s) => {
        todayExpensesData = [];
        s.forEach(d => { todayExpensesData.push({ id: d.id, ...d.data() }); });
        if(typeof window.renderDailyLedger === 'function') window.renderDailyLedger();
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", tbLab = "";
        let posPatientHtml = "<option value=''>-- اختر المراجع --</option>";
        todayInvoicesData = []; window.allUnifiedRecords = []; let uniquePatients = {}; 

        s.forEach(d => { 
            const i = d.data(); 
            todayInvoicesData.push(i);
            
            if (!i.isUnified) { 
                window.allUnifiedRecords.push(i);
                tbInvoices += `<tr><td class="en-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${parseFloat(i.total).toFixed(2)}</td><td class="en-num" style="color:var(--danger); font-weight:bold;">${parseFloat(i.due).toFixed(2)}</td><td><button class="btn btn-dark" onclick="printPosFromData('${i.invId}')" style="padding: 5px 10px;"><i class="fas fa-print"></i></button></td></tr>`; 
            }
            if (i.labStatus !== 'تم التسليم') { tbLab += `<tr><td class="en-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td><select onchange="updateLabStatus('${d.id}', this.value)" style="padding:5px; border-radius:5px;"><option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option><option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option><option value="تم التسليم">تسليم</option></select></td></tr>`; }

            if (i.isUnified && i.rx) {
                window.allUnifiedRecords.push(i);
                if (!uniquePatients[i.pName]) { uniquePatients[i.pName] = { lastVisit: i.time?.toDate(), totalSpent: 0 }; }
                uniquePatients[i.pName].totalSpent += Number(i.total);
            }
        });
        
        const patientNames = Object.keys(uniquePatients);
        if(document.getElementById('patients-list')) { document.getElementById('patients-list').innerHTML = patientNames.map(name => `<option value="${name}">`).join(''); }
        
        let tbUnifiedHTML = "";
        patientNames.forEach(pName => {
            const dateStr = uniquePatients[pName].lastVisit?.toLocaleDateString('en-GB') || '--';
            tbUnifiedHTML += `<tr><td style="font-weight:bold; color:var(--primary); font-size:1.1rem;">${pName}</td><td class="en-num">${dateStr}</td><td class="en-num" style="font-weight:bold;">${uniquePatients[pName].totalSpent.toFixed(2)} JOD</td><td><button class="btn btn-primary" onclick="showPatientHistory('${pName}')"><i class="fas fa-folder-open"></i> السجل</button></td></tr>`;
            posPatientHtml += `<option value="${pName}">${pName}</option>`;
        });

        document.getElementById('tb-invc').innerHTML = tbInvoices; document.getElementById('tb-lab').innerHTML = tbLab; 
        if(document.getElementById('tb-unified-rx')) document.getElementById('tb-unified-rx').innerHTML = tbUnifiedHTML;
        if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = posPatientHtml;
        
        if(typeof window.renderDailyLedger === 'function') window.renderDailyLedger();
    });

    onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(10)), (s) => {
        if(document.getElementById('live-activity-feed')) document.getElementById('live-activity-feed').innerHTML = s.docs.map(d => `<div style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size:0.95rem;"><strong>${d.data().user}</strong>: ${d.data().action} <br><small style="color:var(--warning); font-weight:bold;" class="en-num">${d.data().time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || ''}</small></div>`).join('');
    });

    onSnapshot(doc(db, "settings", "cms"), (docSnap) => {
        if (docSnap.exists() && document.getElementById('cms-topbar')) {
            const data = docSnap.data();
            document.getElementById('cms-topbar').value = data.topbar || '';
            if(document.getElementById('cms-open-time')) document.getElementById('cms-open-time').value = data.openTime || '';
            if(document.getElementById('cms-close-time')) document.getElementById('cms-close-time').value = data.closeTime || '';
            if(document.getElementById('cms-status-mode')) document.getElementById('cms-status-mode').value = data.statusMode || 'auto';
        }
    });

    if (Auth.user?.role === 'superadmin') {
        onSnapshot(collection(db, "users"), (s) => {
            if (document.getElementById('tb-staff')) document.getElementById('tb-staff').innerHTML = s.docs.map(d => {
                const statusBtn = d.data().status === 'frozen' ? `<button class="btn btn-success" onclick="toggleUserFreeze('${d.id}', 'frozen')">فك التجميد</button>` : `<button class="btn btn-warning" onclick="toggleUserFreeze('${d.id}', 'active')">تجميد</button>`;
                return `<tr><td>${d.data().name}</td><td class="en-num">${d.data().user}</td><td><span class="badge">${d.data().role}</span></td><td>${d.data().status==='frozen'?'<span style="color:red">مجمد</span>':'نشط'}</td><td>${statusBtn} <button class="btn btn-danger" onclick="deleteUserAccount('${d.id}')">حذف</button></td></tr>`;
            }).join('');
        });
        onSnapshot(query(collection(db, "stealth_logs"), orderBy("time", "desc")), (s) => { if (document.getElementById('tb-secret-audit')) document.getElementById('tb-secret-audit').innerHTML = s.docs.map(d => `<tr><td>${d.data().user}</td><td>${d.data().device||'--'}</td><td>${d.data().action}</td><td class="en-num">${d.data().time?.toDate().toLocaleString('en-GB') || ''}</td></tr>`).join(''); });
        onSnapshot(query(collection(db, "recycle_bin"), orderBy("deletedAt", "desc")), (s) => { if (document.getElementById('tb-recycle')) document.getElementById('tb-recycle').innerHTML = s.docs.map(d => { const p = d.data(); return `<tr><td>${p.name}</td><td>${p.deletedBy}</td><td><button class="btn btn-success" onclick='restoreProduct("${d.id}", ${JSON.stringify(p)})'>استرجاع</button></td></tr>`; }).join(''); });
    }
}
