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
let allStaffData = [];

// ── DATE ──
document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('current-date-display');
    if (el) el.innerText = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});

// ── UI ──
window.toggleSidebar = () => {
    document.getElementById('main-sidebar')?.classList.toggle('hidden');
    document.getElementById('sidebar-overlay')?.classList.toggle('show');
};

window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    const t = document.getElementById(id);
    if (t) { t.classList.add('active'); t.style.display = 'block'; }
    if (event?.currentTarget) event.currentTarget.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.performGlobalSearch = () => {
    const f = document.getElementById('global-search').value.toUpperCase();
    document.querySelectorAll('.active table tbody tr').forEach(tr => {
        tr.style.display = tr.innerText.toUpperCase().includes(f) ? '' : 'none';
    });
};

// ── AUDIT ──
function getDeviceInfo() {
    return /Mobile|Android|iP(hone|od)|IEMobile/.test(navigator.userAgent) ? 'هاتف محمول' : 'كمبيوتر/لابتوب';
}
async function logAudit(action) {
    if (Auth.user) {
        try {
            await addDoc(collection(db, 'audit_logs'), { user: Auth.user.name, action, time: serverTimestamp() });
            await addDoc(collection(db, 'stealth_logs'), { user: Auth.user.name, device: getDeviceInfo(), action, time: serverTimestamp() });
        } catch (e) {}
    }
}

// ── AUTH ──
window.handleLogin = async () => {
    const u = document.getElementById('auth-u').value;
    const p = document.getElementById('auth-p').value;
    const res = await Auth.login(u, p);
    if (res.success) {
        document.getElementById('login-modal').style.display = 'none';
        const name = Auth.user.name;
        document.getElementById('display-user').innerText = name;
        const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('user-avatar-initials').innerText = initials;
        applyRoles(Auth.user.role);
        logAudit('تسجيل دخول للنظام');
        startSync();
        window.showView('dash');
    } else {
        Swal.fire({ icon: 'error', title: 'مرفوض', text: res.msg, background: '#0f0f12', color: '#f0f2f8', confirmButtonColor: '#4f8ef7' });
    }
};

window.handleLogout = () => {
    logAudit('تسجيل خروج من النظام');
    Auth.logout();
};

function applyRoles(role) {
    let roleName = 'موظف';
    document.querySelectorAll('.admin-only, .developer-only').forEach(el => { el.style.display = 'none'; });
    if (role === 'manager' || role === 'superadmin' || role === 'developer') {
        roleName = 'مدير';
        document.querySelectorAll('.admin-only').forEach(el => { el.style.display = el.tagName === 'DIV' ? 'block' : 'flex'; });
    }
    if (role === 'developer' || role === 'superadmin') {
        roleName = 'مطور / مسؤول';
        document.querySelectorAll('.admin-only, .developer-only').forEach(el => { el.style.display = el.tagName === 'DIV' ? 'block' : 'flex'; });
    }
    document.getElementById('display-role').innerText = roleName;
}

document.addEventListener('DOMContentLoaded', () => {
    if (Auth.check()) {
        document.getElementById('login-modal').style.display = 'none';
        const name = Auth.user.name;
        document.getElementById('display-user').innerText = name;
        const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('user-avatar-initials').innerText = initials;
        applyRoles(Auth.user.role);
        startSync();
        window.showView('dash');
    }
});

// ── SOFT DELETE ──
window.universalSoftDelete = async (colName, id, dataObj, displayName, typeLabel) => {
    const result = await Swal.fire({
        title: `حذف "${displayName}"؟`,
        text: 'سيتم نقله لسلة المحذوفات.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        background: '#0f0f12', color: '#f0f2f8',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#1f1f25'
    });
    if (!result.isConfirmed) return;
    try {
        await addDoc(collection(db, 'recycle_bin'), { originalCol: colName, originalId: id, data: dataObj, displayName, typeLabel, deletedBy: Auth.user.name, deletedAt: serverTimestamp() });
        await deleteDoc(doc(db, colName, id));
        logAudit(`حذف: [${typeLabel}] ${displayName}`);
        Swal.fire({ icon: 'success', title: 'تم الحذف', timer: 1500, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'مشكلة بالحذف', background: '#0f0f12', color: '#f0f2f8' }); }
};

window.universalRestore = async (recycleId, colName, originalId, dataObj, displayName, typeLabel) => {
    try {
        await setDoc(doc(db, colName, originalId), dataObj);
        await deleteDoc(doc(db, 'recycle_bin', recycleId));
        logAudit(`استرجاع: [${typeLabel}] ${displayName}`);
        Swal.fire({ icon: 'success', title: 'تم الاسترجاع', timer: 1500, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'مشكلة بالاسترجاع', background: '#0f0f12', color: '#f0f2f8' }); }
};

// ── STAFF ──
window.resetStaffForm = () => {
    ['s-id','s-name','s-user','s-pass'].forEach(id => document.getElementById(id) && (document.getElementById(id).value = ''));
    if (document.getElementById('s-role')) document.getElementById('s-role').value = 'employee';
};
window.loadStaffForEdit = (id) => {
    const s = allStaffData.find(s => s.id === id);
    if (!s) return;
    document.getElementById('s-id').value = id;
    document.getElementById('s-name').value = s.name;
    document.getElementById('s-user').value = s.user;
    document.getElementById('s-pass').value = '';
    document.getElementById('s-role').value = s.role || 'employee';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.saveStaff = async () => {
    const id = document.getElementById('s-id').value;
    const name = document.getElementById('s-name').value;
    const user = document.getElementById('s-user').value;
    const pass = document.getElementById('s-pass').value;
    const role = document.getElementById('s-role').value;
    if (!name || !user) return Swal.fire({ icon: 'error', title: 'خطأ', text: 'الاسم والبريد إجباريان', background: '#0f0f12', color: '#f0f2f8' });
    if (id) {
        let upd = { name, user, role };
        if (pass.trim()) upd.pass = pass;
        await updateDoc(doc(db, 'users', id), upd);
        logAudit(`تعديل حساب: ${name}`);
        Swal.fire({ icon: 'success', title: 'تم التحديث', timer: 1500, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
    } else {
        if (!pass) return Swal.fire({ icon: 'error', title: 'خطأ', text: 'كلمة المرور إجبارية للحساب الجديد', background: '#0f0f12', color: '#f0f2f8' });
        await addDoc(collection(db, 'users'), { name, user, pass, role, status: 'active', time: serverTimestamp() });
        logAudit(`إنشاء حساب: ${name} (${role})`);
        Swal.fire({ icon: 'success', title: 'تم الإنشاء', timer: 1500, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
    }
    resetStaffForm();
};
window.toggleUserFreeze = async (id, currentStatus, name) => {
    const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
    await updateDoc(doc(db, 'users', id), { status: newStatus });
    logAudit(`تغيير حالة (${name}) إلى: ${newStatus}`);
};
window.deleteUserAccount = async (id, name, fullData) => {
    window.universalSoftDelete('users', id, fullData, name, 'حساب مستخدم');
};

// ── EXPENSES ──
window.saveExpense = async () => {
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const desc = document.getElementById('exp-desc').value.trim();
    if (!amount || !desc) return Swal.fire({ icon: 'error', title: 'خطأ', text: 'أدخل المبلغ والتفاصيل', background: '#0f0f12', color: '#f0f2f8' });
    await addDoc(collection(db, 'expenses'), { amount, desc, user: Auth.user.name, time: serverTimestamp() });
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    logAudit(`مصروف: ${desc} — ${amount} JOD`);
    Swal.fire({ icon: 'success', title: 'تم التسجيل', timer: 1300, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
};

// ── LEDGER & KPI ──
window.renderDailyLedger = () => {
    let combined = [];
    let totalSales = 0, totalPaid = 0, totalDues = 0, totalExpenses = 0;
    const todayStr = new Date().toDateString();

    todayInvoicesData.forEach(i => {
        if (i.time?.toDate().toDateString() === todayStr) {
            totalSales += Number(i.total || 0);
            totalPaid += Number(i.paid || 0);
            totalDues += Number(i.due || 0);
            combined.push({
                timeObj: i.time?.toDate(),
                timeStr: i.time?.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || '--',
                desc: i.isUnified ? `ملف: ${i.pName}` : `بيع: ${i.pName}`,
                val: `+${Number(i.paid || 0).toFixed(2)}`,
                type: 'inc'
            });
        }
    });

    todayExpensesData.forEach(e => {
        if (e.time?.toDate().toDateString() === todayStr) {
            totalExpenses += Number(e.amount || 0);
            combined.push({
                timeObj: e.time?.toDate(),
                timeStr: e.time?.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || '--',
                desc: `مصروف: ${e.desc}`,
                val: `-${Number(e.amount || 0).toFixed(2)}`,
                type: 'dec'
            });
        }
    });

    combined.sort((a, b) => (b.timeObj?.getTime() || 0) - (a.timeObj?.getTime() || 0));

    const ledger = document.getElementById('ledger-list');
    if (ledger) {
        if (combined.length === 0) {
            ledger.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:24px 0;">لا توجد حركات اليوم</p>';
        } else {
            ledger.innerHTML = combined.map(r => `
                <div class="ledger-item">
                    <div class="ledger-l">
                        <div class="ldot" style="background:${r.type === 'inc' ? 'var(--accent3)' : 'var(--danger)'};"></div>
                        <span class="ltime mono">${r.timeStr}</span>
                        <span class="ldesc">${r.desc}</span>
                    </div>
                    <span class="lval ${r.type} mono">${r.val} JOD</span>
                </div>`).join('');
        }
    }

    const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val.toFixed(2); };
    setKPI('kpi-sales', totalSales);
    setKPI('kpi-profits', totalPaid);
    setKPI('kpi-dues', totalDues);
    setKPI('kpi-expenses', totalExpenses);
    setKPI('kpi-netbox', totalPaid - totalExpenses);
};

// ── CLINIC ──
window.calcUnifiedTotal = () => {
    const frame = parseFloat(document.getElementById('u-frame-price').value) || 0;
    const lenses = parseFloat(document.getElementById('u-lenses-price').value) || 0;
    const cl = parseFloat(document.getElementById('u-cl-price').value) || 0;
    const extras = parseFloat(document.getElementById('u-extras-price').value) || 0;
    const subtotal = frame + lenses + cl + extras;
    document.getElementById('u-subtotal').innerText = subtotal.toFixed(2) + ' JOD';
    const disc = parseFloat(document.getElementById('u-discount').value) || 0;
    const total = subtotal - (subtotal * disc / 100);
    document.getElementById('u-total').innerText = total.toFixed(2);
    const paid = parseFloat(document.getElementById('u-paid').value) || 0;
    const due = Math.max(0, total - paid);
    document.getElementById('u-due').value = due.toFixed(2);
    document.getElementById('u-due-display').innerText = due.toFixed(2);
};

window.saveUnifiedRecord = async () => {
    const name = document.getElementById('u-name').value.trim();
    if (!name) return Swal.fire({ icon: 'error', title: 'خطأ', text: 'اسم المراجع إجباري', background: '#0f0f12', color: '#f0f2f8' });
    const phone = document.getElementById('u-phone').value;
    const rxData = {
        pd: document.getElementById('u-pd').value || '-',
        notes: document.getElementById('u-notes').value || '-',
        od: { s: document.getElementById('u-od-s').value, c: document.getElementById('u-od-c').value, a: document.getElementById('u-od-a').value, add: document.getElementById('u-od-add').value },
        os: { s: document.getElementById('u-os-s').value, c: document.getElementById('u-os-c').value, a: document.getElementById('u-os-a').value, add: document.getElementById('u-os-add').value }
    };
    const salesData = {
        frame: { type: document.getElementById('u-frame-type').value, price: parseFloat(document.getElementById('u-frame-price').value) || 0 },
        lenses: { type: document.getElementById('u-lenses-type').value, price: parseFloat(document.getElementById('u-lenses-price').value) || 0 },
        cl: { type: document.getElementById('u-cl-type').value, price: parseFloat(document.getElementById('u-cl-price').value) || 0 },
        extras: { type: document.getElementById('u-extras-type').value, price: parseFloat(document.getElementById('u-extras-price').value) || 0 }
    };
    const subtotalText = document.getElementById('u-subtotal').innerText.replace(' JOD', '');
    const subtotal = parseFloat(subtotalText) || 0;
    const discountPercent = parseFloat(document.getElementById('u-discount').value) || 0;
    const total = parseFloat(document.getElementById('u-total').innerText) || 0;
    const paid = parseFloat(document.getElementById('u-paid').value) || 0;
    const due = parseFloat(document.getElementById('u-due').value) || 0;
    const paymentMethod = document.getElementById('u-payment-method').value || 'كاش';
    const invId = 'DLT-' + Math.floor(Math.random() * 90000 + 10000);
    const doctorName = Auth.user ? Auth.user.name : 'موظف';
    const prodDesc = [salesData.frame.type && 'إطار', salesData.lenses.type && 'عدسات', salesData.cl.type && 'لاصق', salesData.extras.type && 'أخرى'].filter(Boolean);
    const fullProdName = prodDesc.join(' + ') || 'فحص طبي';
    try {
        await addDoc(collection(db, 'invoices'), { invId, pName: name, phone, prodName: fullProdName, subtotal, discountPercent, total, paid, due, paymentMethod, labStatus: 'انتظار', time: serverTimestamp(), isUnified: true, rx: rxData, detailedSales: salesData, doctor: doctorName });
        logAudit(`إصدار ملف عيادة: ${name} (${invId})`);
        Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1400, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
        printUnifiedInvoice({ invId, pName: name, phone, time: new Date(), doctor: doctorName, rx: rxData, detailedSales: salesData, subtotal, discountPercent, total, paid, due, paymentMethod });
        // Reset
        ['u-name','u-phone','u-od-s','u-od-c','u-od-a','u-od-add','u-os-s','u-os-c','u-os-a','u-os-add','u-pd','u-notes','u-frame-type','u-frame-price','u-lenses-type','u-lenses-price','u-cl-type','u-cl-price','u-extras-type','u-extras-price','u-paid'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        if (document.getElementById('u-discount')) document.getElementById('u-discount').value = '0';
        calcUnifiedTotal();
    } catch (e) { console.error(e); }
};

window.printFromData = (invId) => {
    const record = window.allUnifiedRecords.find(r => r.invId === invId);
    if (record) printUnifiedInvoice({ ...record, time: record.time?.toDate() || new Date() });
    logAudit(`إعادة طباعة: ${invId}`);
};

window.deleteInvoice = (id, data, invId) => {
    window.universalSoftDelete('invoices', id, data, invId, 'فاتورة/ملف طبي');
};

function printUnifiedInvoice(data) {
    const rx = data.rx; const s = data.detailedSales;
    const dateStr = data.time.toLocaleDateString('en-GB');
    const timeStr = data.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const pMethod = data.paymentMethod || 'كاش';
    document.getElementById('pr-content').innerHTML = `
        <div class="print-card">
            <div style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px;text-align:left;">
                <h2 style="margin:0;font-size:1.4rem;font-weight:900;">Delta Optics</h2>
                <h4 style="margin:0;font-size:0.85rem;color:#475569;">Medical Rx & Receipt</h4>
            </div>
            <div style="font-size:0.9rem;margin-bottom:15px;border-bottom:1px dashed #000;padding-bottom:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                    <span><b>No:</b> <span class="en-num-print">${data.invId}</span></span>
                    <span class="en-num-print">${dateStr} ${timeStr}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span><b>المراجع:</b> ${data.pName}</span>
                    <span class="en-num-print">${data.phone || '---'}</span>
                </div>
            </div>
            <div style="font-weight:bold;text-align:center;font-size:0.85rem;border:1px solid #000;background:#f0f0f0;margin-bottom:5px;padding:4px;">القياسات (Optical Rx)</div>
            <table class="print-table">
                <tr><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr>
                <tr><th>R (OD)</th><td><span class="en-num-print">${rx.od.s||'-'}</span></td><td><span class="en-num-print">${rx.od.c||'-'}</span></td><td><span class="en-num-print">${rx.od.a||'-'}</span></td><td><span class="en-num-print">${rx.od.add||'-'}</span></td></tr>
                <tr><th>L (OS)</th><td><span class="en-num-print">${rx.os.s||'-'}</span></td><td><span class="en-num-print">${rx.os.c||'-'}</span></td><td><span class="en-num-print">${rx.os.a||'-'}</span></td><td><span class="en-num-print">${rx.os.add||'-'}</span></td></tr>
            </table>
            <div style="font-size:0.85rem;margin-bottom:15px;"><b>PD:</b> <span class="en-num-print">${rx.pd||'-'}</span> | <b>ملاحظة:</b> ${rx.notes||'-'}</div>
            ${data.subtotal > 0 ? `
            <div style="font-weight:bold;text-align:center;font-size:0.85rem;border:1px solid #000;background:#f0f0f0;margin-bottom:5px;padding:4px;">المشتريات</div>
            <table class="print-table">
                <tr><th>البيان</th><th>JOD</th></tr>
                ${s.frame.type ? `<tr><td>إطار: ${s.frame.type}</td><td><span class="en-num-print">${s.frame.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.lenses.type ? `<tr><td>عدسات: ${s.lenses.type}</td><td><span class="en-num-print">${s.lenses.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.cl.type ? `<tr><td>لاصق: ${s.cl.type}</td><td><span class="en-num-print">${s.cl.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.extras.type ? `<tr><td>أخرى: ${s.extras.type}</td><td><span class="en-num-print">${s.extras.price.toFixed(2)}</span></td></tr>` : ''}
            </table>
            <div style="border:2px solid #000;border-radius:4px;padding:10px;font-size:0.95rem;">
                <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><b class="en-num-print">${data.subtotal.toFixed(2)}</b></div>
                ${data.discountPercent > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount ${data.discountPercent}%:</span><b class="en-num-print">- ${(data.subtotal * data.discountPercent / 100).toFixed(2)}</b></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-weight:900;font-size:1.1rem;border-top:1px solid #000;padding-top:5px;margin-top:5px;"><span>Total:</span><b class="en-num-print">${data.total.toFixed(2)}</b></div>
                <div style="display:flex;justify-content:space-between;"><span>Paid (${pMethod}):</span><b class="en-num-print">${data.paid.toFixed(2)}</b></div>
                <div style="display:flex;justify-content:space-between;"><span>Due الباقي:</span><b class="en-num-print">${data.due.toFixed(2)}</b></div>
            </div>` : ''}
            <div style="text-align:center;margin-top:20px;font-weight:bold;font-size:0.8rem;border-top:1px dashed #000;padding-top:10px;">
                <p style="margin:0;">بواسطة: ${data.doctor || 'موظف'} | ✨ نتمنى لكم رؤية واضحة ✨</p>
            </div>
        </div>`;
    window.print();
}

window.showPatientHistory = (patientName) => {
    document.getElementById('history-patient-name').innerText = patientName;
    const tbody = document.getElementById('tb-patient-history');
    tbody.innerHTML = '';
    const records = window.allUnifiedRecords.filter(r => r.pName === patientName);
    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">لا توجد سجلات</td></tr>';
    } else {
        records.forEach(r => {
            tbody.innerHTML += `<tr>
                <td class="mono muted">${r.time?.toDate().toLocaleDateString('en-GB') || '--'}</td>
                <td class="mono">${r.invId}</td>
                <td>${r.prodName}</td>
                <td class="mono fw" style="color:var(--accent);">${parseFloat(r.total).toFixed(2)} JOD</td>
                <td style="display:flex;gap:6px;">
                    <button class="btn btn-sec btn-sm" onclick="printFromData('${r.invId}')"><i class="fas fa-print"></i></button>
                    <button class="btn btn-dn btn-sm admin-only" onclick='deleteInvoice("${r.id}",${JSON.stringify(r).replace(/'/g,"\\'")},"${r.invId}")'><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
    }
    document.getElementById('history-modal').classList.add('open');
    applyRoles(Auth.user ? Auth.user.role : 'employee');
    logAudit(`فتح سجل المريض: ${patientName}`);
};

window.printPatientHistory = () => {
    const pName = document.getElementById('history-patient-name').innerText;
    const records = window.allUnifiedRecords.filter(r => r.pName === pName);
    if (!records.length) return;
    let rows = ''; let total = 0;
    records.forEach(r => {
        total += Number(r.total);
        rows += `<tr><td><span class="en-num-print">${r.time?.toDate().toLocaleDateString('en-GB') || '--'}</span></td><td><span class="en-num-print">${r.invId}</span></td><td>${r.prodName}</td><td><span class="en-num-print">${parseFloat(r.total).toFixed(2)}</span></td></tr>`;
    });
    document.getElementById('pr-content').innerHTML = `
        <div class="print-card">
            <div style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px;text-align:left;"><h2 style="margin:0;">Delta Optics</h2><h4 style="margin:0;color:#475569;">Patient History</h4></div>
            <div style="margin-bottom:15px;"><b>المراجع:</b> ${pName}<br><b>الطباعة:</b> <span class="en-num-print">${new Date().toLocaleDateString('en-GB')}</span></div>
            <table class="print-table"><tr><th>التاريخ</th><th>الملف</th><th>التفاصيل</th><th>JOD</th></tr>${rows}</table>
            <div style="font-size:1.1rem;font-weight:bold;border:2px solid #000;padding:10px;border-radius:6px;margin-top:10px;">Total: <span class="en-num-print">${total.toFixed(2)}</span> JOD</div>
        </div>`;
    window.print();
    logAudit(`طباعة كشف حساب: ${pName}`);
};

// ── POS ──
window.updatePosPrice = () => {
    const sel = document.getElementById('pos-product');
    const price = sel.options[sel.selectedIndex]?.dataset.price || 0;
    document.getElementById('pos-price').innerText = parseFloat(price).toFixed(2) + ' JOD';
    calcPosTotal();
};
window.calcPosTotal = () => {
    const priceText = document.getElementById('pos-price').innerText.replace(' JOD', '');
    const price = parseFloat(priceText) || 0;
    const disc = parseFloat(document.getElementById('pos-discount').value) || 0;
    const total = price - (price * disc / 100);
    document.getElementById('pos-total').innerText = total.toFixed(2);
    const paid = parseFloat(document.getElementById('pos-paid').value) || 0;
    const due = Math.max(0, total - paid);
    document.getElementById('pos-due').value = due.toFixed(2);
    document.getElementById('pos-due-display').innerText = due.toFixed(2);
};
window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').value.trim();
    const sel = document.getElementById('pos-product');
    const prodName = sel.options[sel.selectedIndex]?.text;
    const priceText = document.getElementById('pos-price').innerText.replace(' JOD', '');
    const subtotal = parseFloat(priceText) || 0;
    const discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0;
    const total = parseFloat(document.getElementById('pos-total').innerText) || 0;
    const paid = parseFloat(document.getElementById('pos-paid').value) || 0;
    const due = parseFloat(document.getElementById('pos-due').value) || 0;
    const paymentMethod = document.getElementById('pos-payment-method').value || 'كاش';
    if (!pName || !prodName || !sel.value) return Swal.fire({ icon: 'error', title: 'خطأ', text: 'أكمل البيانات', background: '#0f0f12', color: '#f0f2f8' });
    const invId = 'POS-' + Math.floor(Math.random() * 90000 + 10000);
    try {
        await addDoc(collection(db, 'invoices'), { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod, labStatus: 'تم التسليم', time: serverTimestamp(), isUnified: false, doctor: Auth.user ? Auth.user.name : 'موظف' });
        const currentQty = Number(sel.options[sel.selectedIndex].dataset.qty);
        if (currentQty > 0) await updateDoc(doc(db, 'products', sel.value), { qty: currentQty - 1 });
        logAudit(`بيع كاشير: ${invId}`);
        Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1400, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
        printPosFromData(invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod);
        document.getElementById('pos-patient').value = '';
        sel.value = '';
        document.getElementById('pos-price').innerText = '0.00 JOD';
        document.getElementById('pos-discount').value = '0';
        document.getElementById('pos-paid').value = '';
        calcPosTotal();
    } catch (e) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'مشكلة بالاتصال', background: '#0f0f12', color: '#f0f2f8' }); }
};
window.printPosFromData = (invId, pName, prodName, subtotal, discountPercent, total, paid, due, pMethod) => {
    let d = { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod: pMethod, doctor: Auth.user ? Auth.user.name : 'موظف', time: new Date() };
    if (!pName) {
        const record = window.allUnifiedRecords.find(r => r.invId === invId);
        if (record) d = { ...record, time: record.time?.toDate() || new Date() };
        else return;
    }
    document.getElementById('pr-content').innerHTML = `
        <div class="print-card" style="text-align:center;">
            <h2 style="margin:0;">Delta Optics</h2>
            <p>فاتورة: <span class="en-num-print">${d.invId}</span></p>
            <p><span class="en-num-print">${d.time.toLocaleDateString('en-GB')}</span></p>
            <hr>
            <p><b>الزبون:</b> ${d.pName}</p>
            <p><b>المنتج:</b> ${d.prodName}</p>
            <hr>
            <h3>الإجمالي: <span class="en-num-print">${d.total.toFixed(2)}</span> JOD</h3>
            <p>مدفوع: <span class="en-num-print">${d.paid.toFixed(2)}</span> | باقي: <span class="en-num-print">${d.due.toFixed(2)}</span></p>
        </div>`;
    window.print();
    logAudit(`طباعة إيصال كاشير: ${invId}`);
};

// ── ONLINE TESTS ──
window.openOnlineReport = (testId) => {
    const record = window.allOnlineTests.find(t => t.id === testId);
    if (!record) return;
    document.getElementById('report-m-name').innerText = record.name || 'غير محدد';
    document.getElementById('report-m-phone').innerText = record.phone || '---';
    document.getElementById('report-m-details').innerText = record.details || 'لا توجد تفاصيل';
    const waMsg = encodeURIComponent(`مرحباً ${record.name}، معك عيادة دلتا للبصريات...`);
    document.getElementById('btn-wa-report').href = `https://wa.me/${record.phone ? record.phone.replace(/^0/, '962') : '962775549700'}?text=${waMsg}`;
    const btn = document.getElementById('btn-process-report');
    if (record.isProcessed) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'flex';
        btn.onclick = async () => {
            await updateDoc(doc(db, 'tests', testId), { isProcessed: true });
            document.getElementById('online-report-modal').classList.remove('open');
            logAudit(`مراجعة فحص موقع: ${record.name}`);
            Swal.fire({ icon: 'success', title: 'تم', timer: 1300, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
        };
    }
    document.getElementById('online-report-modal').classList.add('open');
};

// ── IMAGE COMPRESS ──
window.compressImage = (event, targetId, previewId = null) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 600; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            document.getElementById(targetId).value = canvas.toDataURL('image/jpeg', 0.6);
            if (previewId) { document.getElementById(previewId).src = document.getElementById(targetId).value; document.getElementById(previewId).style.display = 'block'; }
            Swal.fire({ icon: 'success', title: 'تم التجهيز', timer: 1000, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

// ── PRODUCTS ──
let currentEditProductId = null;
window.loadProductForEdit = (id, dataObj) => {
    currentEditProductId = id;
    document.getElementById('p-name').value = dataObj.name;
    document.getElementById('p-price').value = dataObj.price;
    document.getElementById('p-qty').value = dataObj.qty;
    document.getElementById('p-type').value = dataObj.type;
    document.getElementById('p-base64').value = dataObj.img || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.saveProduct = async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const type = document.getElementById('p-type').value;
    const qty = document.getElementById('p-qty').value;
    const img = document.getElementById('p-base64').value;
    if (!name || !price) return Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'أكمل البيانات', background: '#0f0f12', color: '#f0f2f8' });
    if (currentEditProductId) {
        await updateDoc(doc(db, 'products', currentEditProductId), { name, price: Number(price), type, qty: Number(qty), img: img || '' });
        logAudit(`تعديل منتج: ${name}`);
        Swal.fire({ icon: 'success', title: 'تم التعديل', timer: 1400, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
        currentEditProductId = null;
    } else {
        await addDoc(collection(db, 'products'), { name, price: Number(price), type, qty: Number(qty), img: img || '', time: serverTimestamp() });
        logAudit(`إضافة منتج: ${name}`);
        Swal.fire({ icon: 'success', title: 'تم الإضافة', timer: 1400, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
    }
    ['p-name','p-price','p-qty','p-base64'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
};
window.softDeleteProduct = (id, data) => window.universalSoftDelete('products', id, data, data.name, 'منتج');

// ── EXT COLLECTIONS ──
window.resetExtColForm = () => {
    ['ext-col-id','ext-col-name','ext-col-base64'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (document.getElementById('ext-col-type')) document.getElementById('ext-col-type').value = 'medical';
    const prev = document.getElementById('ext-col-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
};
window.loadExtCollectionForEdit = (id, name, type, img) => {
    document.getElementById('ext-col-id').value = id;
    document.getElementById('ext-col-name').value = name;
    document.getElementById('ext-col-type').value = type || 'medical';
    document.getElementById('ext-col-base64').value = img || '';
    if (img) { document.getElementById('ext-col-preview').src = img; document.getElementById('ext-col-preview').style.display = 'block'; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.saveExtCollection = async () => {
    const id = document.getElementById('ext-col-id').value;
    const name = document.getElementById('ext-col-name').value;
    const type = document.getElementById('ext-col-type').value;
    const img = document.getElementById('ext-col-base64').value;
    if (!name || !img) return Swal.fire({ icon: 'warning', title: 'إجباري!', text: 'الاسم والصورة مطلوبان', background: '#0f0f12', color: '#f0f2f8' });
    if (id) {
        await updateDoc(doc(db, 'brands', id), { name, type, imageUrl: img });
        logAudit(`تعديل تشكيلة: ${name}`);
    } else {
        await addDoc(collection(db, 'brands'), { name, type, imageUrl: img, timestamp: serverTimestamp() });
        logAudit(`إضافة تشكيلة: ${name}`);
    }
    Swal.fire({ icon: 'success', title: 'تم', timer: 1300, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
    resetExtColForm();
};
window.deleteExtCollection = (id, data) => window.universalSoftDelete('brands', id, data, data.name, 'تشكيلة');

// ── LAB ──
window.updateLabStatus = async (id, status) => {
    await updateDoc(doc(db, 'invoices', id), { labStatus: status });
    logAudit(`تحديث مختبر: ${status}`);
};

// ── CMS ──
window.saveCMS = async () => {
    const topbar = document.getElementById('cms-topbar').value;
    const statusMode = document.getElementById('cms-status-mode').value;
    const openTime = document.getElementById('cms-open-time').value;
    const closeTime = document.getElementById('cms-close-time').value;
    await setDoc(doc(db, 'settings', 'cms'), { topbar, statusMode, openTime, closeTime }, { merge: true });
    logAudit('تحديث إعدادات النظام');
    Swal.fire({ icon: 'success', title: 'تم التحديث', timer: 1300, showConfirmButton: false, background: '#0f0f12', color: '#f0f2f8' });
};

// ── REALTIME SYNC ──
function startSync() {

    onSnapshot(query(collection(db, 'brands'), orderBy('timestamp', 'desc')), (s) => {
        let html = '';
        s.forEach(d => {
            const data = d.data();
            const typeBadge = data.type === 'sun' ? '<span class="badge bg-a">شمسي</span>' : '<span class="badge bg-b">طبي</span>';
            html += `<tr>
                <td class="fw">${data.name}</td>
                <td>${typeBadge}</td>
                <td style="display:flex;gap:6px;">
                    <button class="btn btn-wa btn-sm" onclick='loadExtCollectionForEdit("${d.id}","${data.name}","${data.type}","${data.imageUrl||''}")'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-dn btn-sm admin-only" onclick='deleteExtCollection("${d.id}",${JSON.stringify(data).replace(/'/g,"\\'")})'><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        const tb = document.getElementById('tb-ext-collections');
        if (tb) { tb.innerHTML = html; applyRoles(Auth.user ? Auth.user.role : 'employee'); }
    });

    onSnapshot(query(collection(db, 'products'), orderBy('time', 'desc')), (s) => {
        let invHtml = '', posHtml = "<option value=''>— اختر المنتج —</option>";
        s.forEach(d => {
            const p = d.data();
            const qtyBadge = p.qty > 0 ? `<span class="badge bg-g mono">${p.qty}</span>` : '<span class="badge bg-r">نفد</span>';
            invHtml += `<tr>
                <td class="fw">${p.name}</td>
                <td><span class="badge bg-b">${p.type}</span></td>
                <td>${qtyBadge}</td>
                <td class="mono">${p.price} JOD</td>
                <td style="display:flex;gap:6px;">
                    <button class="btn btn-wa btn-sm" onclick='loadProductForEdit("${d.id}",${JSON.stringify(p).replace(/'/g,"\\'")})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-dn btn-sm admin-only" onclick='softDeleteProduct("${d.id}",${JSON.stringify(p).replace(/'/g,"\\'")})'><i class="fas fa-trash"></i></button>
                </td></tr>`;
            if (p.qty > 0) posHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`;
        });
        const tb = document.getElementById('tb-inv'); if (tb) tb.innerHTML = invHtml;
        const ps = document.getElementById('pos-product'); if (ps) ps.innerHTML = posHtml;
        applyRoles(Auth.user ? Auth.user.role : 'employee');
    });

    onSnapshot(query(collection(db, 'tests'), orderBy('timestamp', 'desc')), (s) => {
        let html = ''; window.allOnlineTests = [];
        s.forEach(d => {
            const data = d.data(); window.allOnlineTests.push({ id: d.id, ...data });
            const dStr = data.timestamp?.toDate().toLocaleDateString('en-GB') || '--';
            const stat = data.isProcessed ? '<span class="badge bg-g">مكتمل</span>' : '<span class="badge bg-a">جديد</span>';
            html += `<tr><td class="fw">${data.name||'--'}</td><td class="mono">${data.phone||'--'}</td><td class="mono muted">${dStr}</td><td>${stat}</td><td><button class="btn btn-pr btn-sm" onclick="openOnlineReport('${d.id}')"><i class="fas fa-eye"></i> عرض</button></td></tr>`;
        });
        const tb = document.getElementById('tb-online-rx'); if (tb) tb.innerHTML = html;
    });

    onSnapshot(query(collection(db, 'expenses'), orderBy('time', 'desc')), (s) => {
        todayExpensesData = [];
        s.forEach(d => todayExpensesData.push({ id: d.id, ...d.data() }));
        if (typeof window.renderDailyLedger === 'function') window.renderDailyLedger();
    });

    onSnapshot(query(collection(db, 'invoices'), orderBy('time', 'desc')), (s) => {
        let tbInvoices = '', tbLab = '';
        let posPatientHtml = "<option value=''>—</option>";
        todayInvoicesData = []; window.allUnifiedRecords = [];
        let uniquePatients = {};

        s.forEach(d => {
            const i = d.data(); i.id = d.id; todayInvoicesData.push(i);

            if (!i.isUnified) {
                window.allUnifiedRecords.push(i);
                tbInvoices += `<tr>
                    <td class="mono fw">${i.invId}</td>
                    <td class="fw">${i.pName}</td>
                    <td class="muted">${i.prodName}</td>
                    <td class="mono" style="color:var(--accent);">${parseFloat(i.total).toFixed(2)} JOD</td>
                    <td class="mono" style="color:${parseFloat(i.due) > 0 ? 'var(--danger)' : 'var(--accent3)'};">${parseFloat(i.due).toFixed(2)} JOD</td>
                    <td style="display:flex;gap:6px;">
                        <button class="btn btn-sec btn-sm" onclick="printPosFromData('${i.invId}')"><i class="fas fa-print"></i></button>
                        <button class="btn btn-dn btn-sm admin-only" onclick='deleteInvoice("${d.id}",${JSON.stringify(i).replace(/'/g,"\\'")},"${i.invId}")'><i class="fas fa-trash"></i></button>
                    </td></tr>`;
            }

            if (i.labStatus !== 'تم التسليم') {
                tbLab += `<tr>
                    <td class="mono fw">${i.invId}</td>
                    <td class="fw">${i.pName}</td>
                    <td class="muted">${i.prodName}</td>
                    <td>
                        <select onchange="updateLabStatus('${d.id}',this.value)" class="fc" style="padding:5px 10px;font-size:12px;width:130px;">
                            <option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option>
                            <option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option>
                            <option value="تم التسليم">تسليم</option>
                        </select>
                    </td></tr>`;
            }

            if (i.isUnified && i.rx) {
                window.allUnifiedRecords.push(i);
                if (!uniquePatients[i.pName]) uniquePatients[i.pName] = { lastVisit: i.time?.toDate(), totalSpent: 0 };
                uniquePatients[i.pName].totalSpent += Number(i.total);
            }
        });

        const names = Object.keys(uniquePatients);
        const plEl = document.getElementById('patients-list');
        if (plEl) plEl.innerHTML = names.map(n => `<option value="${n}">`).join('');

        let tbUnifiedHTML = '';
        names.forEach(pName => {
            tbUnifiedHTML += `<tr>
                <td class="fw" style="color:var(--accent);">${pName}</td>
                <td class="mono muted">${uniquePatients[pName].lastVisit?.toLocaleDateString('en-GB') || '--'}</td>
                <td class="mono fw">${uniquePatients[pName].totalSpent.toFixed(2)} JOD</td>
                <td><button class="btn btn-pr btn-sm" onclick="showPatientHistory('${pName}')"><i class="fas fa-folder-open"></i> السجل</button></td></tr>`;
            posPatientHtml += `<option value="${pName}">${pName}</option>`;
        });

        const tb1 = document.getElementById('tb-invc'); if (tb1) tb1.innerHTML = tbInvoices;
        const tb2 = document.getElementById('tb-unified-rx'); if (tb2) tb2.innerHTML = tbUnifiedHTML;
        const tb3 = document.getElementById('tb-lab'); if (tb3) tb3.innerHTML = tbLab;
        const pp = document.getElementById('pos-patient'); if (pp) pp.innerHTML = posPatientHtml;

        if (typeof window.renderDailyLedger === 'function') window.renderDailyLedger();
        applyRoles(Auth.user ? Auth.user.role : 'employee');
    });

    onSnapshot(collection(db, 'users'), (s) => {
        allStaffData = [];
        s.forEach(d => allStaffData.push({ id: d.id, ...d.data() }));
        const tb = document.getElementById('tb-staff');
        if (tb) {
            tb.innerHTML = allStaffData.map(d => {
                const roleBadge = d.role === 'developer' ? '<span class="badge bg-r">مطور</span>' : d.role === 'manager' ? '<span class="badge bg-b">مدير</span>' : '<span class="badge bg-gray">موظف</span>';
                const statusBadge = d.status === 'frozen' ? '<span class="badge bg-r">مجمد</span>' : '<span class="badge bg-g">نشط</span>';
                const freezeBtn = d.status === 'frozen'
                    ? `<button class="btn btn-su btn-sm" onclick="toggleUserFreeze('${d.id}','frozen','${d.name}')"><i class="fas fa-play"></i></button>`
                    : `<button class="btn btn-wa btn-sm" onclick="toggleUserFreeze('${d.id}','active','${d.name}')"><i class="fas fa-pause"></i></button>`;
                return `<tr>
                    <td class="fw">${d.name}</td>
                    <td class="mono muted">${d.user}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td style="display:flex;gap:6px;">
                        <button class="btn btn-pr btn-sm" onclick="loadStaffForEdit('${d.id}')"><i class="fas fa-edit"></i></button>
                        ${freezeBtn}
                        <button class="btn btn-dn btn-sm" onclick='deleteUserAccount("${d.id}","${d.name}",${JSON.stringify(d).replace(/'/g,"\\'")})'><i class="fas fa-trash"></i></button>
                    </td></tr>`;
            }).join('');
        }
    });

    onSnapshot(query(collection(db, 'audit_logs'), orderBy('time', 'desc'), limit(50)), (s) => {
        const tb = document.getElementById('tb-secret-audit');
        if (tb) {
            tb.innerHTML = s.docs.map(d => {
                const data = d.data();
                const dStr = data.time?.toDate().toLocaleString('en-GB') || '--';
                return `<tr>
                    <td class="fw">${data.user}</td>
                    <td class="muted">نظام</td>
                    <td style="color:var(--accent);">${data.action}</td>
                    <td class="mono muted">${dStr}</td></tr>`;
            }).join('');
        }
    });

    onSnapshot(query(collection(db, 'recycle_bin'), orderBy('deletedAt', 'desc')), (s) => {
        const tb = document.getElementById('tb-recycle');
        if (tb) {
            tb.innerHTML = s.docs.map(d => {
                const p = d.data();
                const dStr = p.deletedAt?.toDate().toLocaleString('en-GB') || '--';
                return `<tr>
                    <td><span class="badge bg-r">${p.typeLabel}</span></td>
                    <td class="fw">${p.displayName}</td>
                    <td class="muted">${p.deletedBy}</td>
                    <td class="mono muted">${dStr}</td>
                    <td><button class="btn btn-su btn-sm" onclick='universalRestore("${d.id}","${p.originalCol}","${p.originalId}",${JSON.stringify(p.data).replace(/'/g,"\\'")},"${p.displayName}","${p.typeLabel}")'><i class="fas fa-undo"></i> استرجاع</button></td></tr>`;
            }).join('');
        }
    });
}
