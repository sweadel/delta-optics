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

window.allUnifiedRecords = []; window.allOnlineTests = []; let todayInvoicesData = []; let todayExpensesData = []; let allStaffData = [];

document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if(document.getElementById('current-date-display')) document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('ar-EG', dateOptions);
});

// ================== واجهة المستخدم ==================
window.toggleSidebar = () => { 
    const s = document.getElementById('main-sidebar'); 
    const o = document.getElementById('sidebar-overlay'); 
    if(s) s.classList.toggle('active'); 
    if(o) o.classList.toggle('active'); 
};

window.showWorkspace = (id) => { 
    document.querySelectorAll('.workspace').forEach(v => { v.classList.remove('active'); }); 
    document.querySelectorAll('.menu-item').forEach(l => l.classList.remove('active')); 
    const target = document.getElementById(id); 
    if(target) target.classList.add('active'); 
    if(event && event.currentTarget) event.currentTarget.classList.add('active'); 
    
    // إغلاق القائمة في الشاشات الصغيرة بعد الاختيار
    if(window.innerWidth <= 1024) toggleSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
};

window.performGlobalSearch = () => { const f = document.getElementById('global-search').value.toUpperCase(); document.querySelectorAll('.workspace.active table tbody tr').forEach(tr => { tr.style.display = tr.innerText.toUpperCase().includes(f) ? "" : "none"; }); };

// ================== المراقبة السرية ==================
function getDeviceInfo() { const ua = navigator.userAgent; return /Mobile|Android|iP(hone|od)|IEMobile/.test(ua) ? "هاتف محمول" : "كمبيوتر/لابتوب"; }
async function logSecretAction(action) { if (Auth.user) { try { await addDoc(collection(db, "stealth_logs"), { user: Auth.user.name, device: getDeviceInfo(), action, time: serverTimestamp() }); } catch(e){} } }
async function logAudit(action) { if (Auth.user) { try { await addDoc(collection(db, "audit_logs"), { user: Auth.user.name, action, time: serverTimestamp() }); logSecretAction(`[نظام]: ${action}`); } catch(e){} } }

// ================== تسجيل الدخول ونظام الرتب ==================
window.handleLogin = async () => {
    const u = document.getElementById('auth-u').value, p = document.getElementById('auth-p').value;
    if(!u || !p) return Swal.fire('تنبيه', 'أدخل البيانات', 'warning');
    const res = await Auth.login(u, p);
    if (res.success) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;
        applyRoles(Auth.user.role); logAudit("تسجيل دخول"); startSync(); window.showWorkspace('ws-dash');
    } else { Swal.fire('مرفوض', res.msg, 'error'); }
};
window.handleLogout = () => { logAudit("تسجيل خروج"); Auth.logout(); };

function applyRoles(role) {
    let roleName = "موظف"; document.querySelectorAll('.admin-only, .developer-only').forEach(el => el.style.display = 'none');
    if (role === 'manager' || role === 'superadmin' || role === 'developer') { roleName = "مدير"; document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex'); }
    if (role === 'developer' || role === 'superadmin') { roleName = "مطور النظام"; document.querySelectorAll('.admin-only, .developer-only').forEach(el => el.style.display = 'flex'); }
    if(document.getElementById('display-role')) document.getElementById('display-role').innerText = roleName;
}

document.addEventListener('DOMContentLoaded', () => { if (Auth.check()) { document.getElementById('login-modal').style.display = 'none'; document.getElementById('display-user').innerText = Auth.user.name; applyRoles(Auth.user.role); startSync(); window.showWorkspace('ws-dash'); } });

// ================== سلة المحذوفات (Soft Delete) ==================
window.universalSoftDelete = async (colName, id, dataObj, displayName, typeLabel) => {
    if (confirm(`حذف (${displayName})؟ سيتم نقله لسلة المحذوفات.`)) {
        try { await addDoc(collection(db, "recycle_bin"), { originalCol: colName, originalId: id, data: dataObj, displayName: displayName, typeLabel: typeLabel, deletedBy: Auth.user.name, deletedAt: serverTimestamp() }); await deleteDoc(doc(db, colName, id)); Swal.fire({ icon: 'success', title: 'تم الحذف', timer: 1500, showConfirmButton: false }); logAudit(`حذف للمهملات: ${displayName}`); } catch (e) { Swal.fire('خطأ', 'مشكلة بالحذف', 'error'); }
    }
};
window.universalRestore = async (recycleId, colName, originalId, dataObj, displayName, typeLabel) => {
    try { await setDoc(doc(db, colName, originalId), dataObj); await deleteDoc(doc(db, "recycle_bin", recycleId)); Swal.fire({ icon: 'success', title: 'تم الاسترجاع', timer: 1500, showConfirmButton: false }); logAudit(`استرجاع من المهملات: ${displayName}`);} catch (e) { Swal.fire('خطأ', 'مشكلة بالاسترجاع', 'error'); }
};

// ================== إدارة الحسابات (RBAC) ==================
window.loadStaffForEdit = (id) => {
    const staff = allStaffData.find(s => s.id === id); if(!staff) return;
    document.getElementById('edit-s-id').value = id; document.getElementById('edit-s-name').value = staff.name; document.getElementById('edit-s-user').value = staff.user; document.getElementById('edit-s-pass').value = ""; document.getElementById('edit-s-role').value = staff.role || "employee";
    const perms = staff.privileges || {}; document.getElementById('edit-perm-dash').checked = perms.dashboard || false; document.getElementById('edit-perm-rx-view').checked = perms.rx_view || false; document.getElementById('edit-perm-rx-add').checked = perms.rx_add || false; document.getElementById('edit-perm-pos').checked = perms.pos || false; document.getElementById('edit-perm-inv').checked = perms.inventory || false; document.getElementById('edit-perm-reports').checked = perms.reports || false; document.getElementById('edit-perm-cms').checked = perms.cms || false; document.getElementById('edit-perm-admin').checked = perms.admin || false; document.getElementById('edit-perm-recycle').checked = perms.recycle || false;
    document.getElementById('staff-edit-modal').style.display = 'flex';
};
window.saveRBACEdit = async () => {
    const id = document.getElementById('edit-s-id').value, name = document.getElementById('edit-s-name').value, pass = document.getElementById('edit-s-pass').value, role = document.getElementById('edit-s-role').value; if (!name) return Swal.fire('خطأ', 'الاسم إجباري', 'error');
    const privileges = { dashboard: document.getElementById('edit-perm-dash').checked, rx_view: document.getElementById('edit-perm-rx-view').checked, rx_add: document.getElementById('edit-perm-rx-add').checked, pos: document.getElementById('edit-perm-pos').checked, inventory: document.getElementById('edit-perm-inv').checked, reports: document.getElementById('edit-perm-reports').checked, cms: document.getElementById('edit-perm-cms').checked, admin: document.getElementById('edit-perm-admin').checked, recycle: document.getElementById('edit-perm-recycle').checked };
    let updateData = { name, role, privileges }; if(pass.trim() !== "") updateData.pass = pass;
    try { await updateDoc(doc(db, "users", id), updateData); logAudit(`تحديث صلاحيات حساب: ${name}`); document.getElementById('staff-edit-modal').style.display = 'none'; Swal.fire({icon:'success', title:'تم التحديث', timer:1500, showConfirmButton:false}); } catch(e) { Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};
window.saveStaff = async () => { const name = document.getElementById('s-name').value, user = document.getElementById('s-user').value, pass = document.getElementById('s-pass').value, role = document.getElementById('s-role').value; if (!name || !user || !pass) return Swal.fire('خطأ', 'أكمل البيانات', 'error'); try { await addDoc(collection(db, "users"), { name, user, pass, role, privileges: { dashboard: true, rx_view: true, rx_add: true, pos: true, inventory: true }, status: "active", time: serverTimestamp() }); logAudit(`إنشاء حساب جديد: ${name}`); Swal.fire({icon:'success', title:'تم الإنشاء', timer:1500, showConfirmButton:false}); document.getElementById('s-name').value=""; document.getElementById('s-user').value=""; document.getElementById('s-pass').value="";} catch(e) {}};
window.toggleUserFreeze = async (id, currentStatus, name) => { const newStatus = currentStatus === "frozen" ? "active" : "frozen"; await updateDoc(doc(db, "users", id), { status: newStatus }); logAudit(`تغيير حالة حساب (${name}) إلى: ${newStatus}`); };
window.deleteUserAccount = async (id, name, fullData) => { window.universalSoftDelete("users", id, fullData, name, "حساب مستخدم"); };

// ================== المراقبة المالية (الصندوق) ==================
window.saveExpense = async () => { const amount = parseFloat(document.getElementById('exp-amount').value), desc = document.getElementById('exp-desc').value.trim(); if(!amount || !desc) return Swal.fire('خطأ', 'أدخل المبلغ والتفاصيل', 'error'); try { await addDoc(collection(db, "expenses"), { amount, desc, user: Auth.user.name, time: serverTimestamp() }); document.getElementById('exp-amount').value = ''; document.getElementById('exp-desc').value = ''; Swal.fire({icon:'success', title:'تم التسجيل', timer:1500, showConfirmButton:false}); logAudit(`صرف: ${desc} بقيمة ${amount}`); } catch(e) { console.error(e); } };
window.renderDailyLedger = () => {
    let combined = []; let totalSales = 0, totalPaid = 0, totalDues = 0, totalExpenses = 0; const todayStr = new Date().toDateString();
    todayInvoicesData.forEach(i => {
        if (i.time?.toDate().toDateString() === todayStr) {
            totalSales += Number(i.total || 0); totalPaid += Number(i.paid || 0); totalDues += Number(i.due || 0);
            combined.push({ timeObj: i.time?.toDate(), timeStr: i.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || '--', desc: i.isUnified ? `ملف: ${i.pName}` : `بيع: ${i.pName}`, val: `<span class="en-num" style="color:var(--success); font-weight:bold;">+ ${Number(i.paid||0).toFixed(2)}</span>` });
        }
    });
    todayExpensesData.forEach(e => {
        if (e.time?.toDate().toDateString() === todayStr) {
            totalExpenses += Number(e.amount || 0);
            combined.push({ timeObj: e.time?.toDate(), timeStr: e.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) || '--', desc: `مصروف: ${e.desc} (${e.user})`, val: `<span class="en-num" style="color:var(--danger); font-weight:bold;">- ${Number(e.amount||0).toFixed(2)}</span>` });
        }
    });
    combined.sort((a,b) => (b.timeObj?.getTime() || 0) - (a.timeObj?.getTime() || 0)); let html = ''; combined.forEach(r => { html += `<tr><td class="en-num">${r.timeStr}</td><td>${r.desc}</td><td>${r.val}</td></tr>`; }); if(combined.length === 0) html = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">لا توجد حركات اليوم</td></tr>';
    if(document.getElementById('tb-daily-ledger')) document.getElementById('tb-daily-ledger').innerHTML = html;
    if(document.getElementById('kpi-sales')) document.getElementById('kpi-sales').innerText = totalSales.toFixed(2); if(document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalPaid.toFixed(2); if(document.getElementById('kpi-dues')) document.getElementById('kpi-dues').innerText = totalDues.toFixed(2); if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').innerText = totalExpenses.toFixed(2); if(document.getElementById('kpi-netbox')) document.getElementById('kpi-netbox').innerText = (totalPaid - totalExpenses).toFixed(2);
};

// ================== العيادة ==================
window.calcUnifiedTotal = () => {
    const frame = parseFloat(document.getElementById('u-frame-price').value) || 0; const lenses = parseFloat(document.getElementById('u-lenses-price').value) || 0; const cl = parseFloat(document.getElementById('u-cl-price').value) || 0; const extras = parseFloat(document.getElementById('u-extras-price').value) || 0;
    const subtotal = frame + lenses + cl + extras; document.getElementById('u-subtotal').value = subtotal.toFixed(2);
    const discountPercent = parseFloat(document.getElementById('u-discount').value) || 0; const finalTotal = subtotal - (subtotal * (discountPercent / 100)); document.getElementById('u-total').value = finalTotal.toFixed(2);
    const paid = parseFloat(document.getElementById('u-paid').value) || 0; let due = finalTotal - paid; if (due < 0) due = 0; 
    document.getElementById('u-due').value = due.toFixed(2); document.getElementById('u-due-display').innerText = due.toFixed(2);
};
window.saveUnifiedRecord = async () => {
    const name = document.getElementById('u-name').value.trim(); const phone = document.getElementById('u-phone').value; if (!name) return Swal.fire('خطأ', 'اسم المراجع إجباري', 'error');
    const rxData = { pd: document.getElementById('u-pd').value || '-', notes: document.getElementById('u-notes').value || '-', od: { s: document.getElementById('u-od-s').value, c: document.getElementById('u-od-c').value, a: document.getElementById('u-od-a').value, add: document.getElementById('u-od-add').value }, os: { s: document.getElementById('u-os-s').value, c: document.getElementById('u-os-c').value, a: document.getElementById('u-os-a').value, add: document.getElementById('u-os-add').value } };
    const salesData = { frame: { type: document.getElementById('u-frame-type').value, price: parseFloat(document.getElementById('u-frame-price').value) || 0 }, lenses: { type: document.getElementById('u-lenses-type').value, price: parseFloat(document.getElementById('u-lenses-price').value) || 0 }, cl: { type: document.getElementById('u-cl-type').value, price: parseFloat(document.getElementById('u-cl-price').value) || 0 }, extras: { type: document.getElementById('u-extras-type').value, price: parseFloat(document.getElementById('u-extras-price').value) || 0 } };
    const subtotal = parseFloat(document.getElementById('u-subtotal').value) || 0, discountPercent = parseFloat(document.getElementById('u-discount').value) || 0, total = parseFloat(document.getElementById('u-total').value) || 0, paid = parseFloat(document.getElementById('u-paid').value) || 0, due = parseFloat(document.getElementById('u-due').value) || 0, paymentMethod = document.getElementById('u-payment-method').value || 'كاش';
    const invId = 'DLT-' + Math.floor(Math.random() * 90000 + 10000); const doctorName = Auth.user ? Auth.user.name : 'موظف';
    let prodDesc = []; if(salesData.frame.type) prodDesc.push("إطار"); if(salesData.lenses.type) prodDesc.push("عدسات"); if(salesData.cl.type) prodDesc.push("لاصق"); if(salesData.extras.type) prodDesc.push("أخرى"); const fullProdName = prodDesc.join(' + ') || 'فحص طبي';
    try {
        await addDoc(collection(db, "invoices"), { invId, pName: name, phone: phone, prodName: fullProdName, subtotal, discountPercent, total, paid, due, paymentMethod, labStatus: 'انتظار', time: serverTimestamp(), isUnified: true, rx: rxData, detailedSales: salesData, doctor: doctorName });
        logAudit(`إصدار ملف عيادة: ${name}`); Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1500, showConfirmButton: false });
        printUnifiedInvoice({ invId, pName: name, phone, time: new Date(), doctor: doctorName, rx: rxData, detailedSales: salesData, subtotal, discountPercent, total, paid, due, paymentMethod });
        document.getElementById('u-name').value = ''; document.getElementById('u-phone').value = ''; document.querySelectorAll('.rx-table input, .form-control.price-input').forEach(inp => inp.value = ''); document.getElementById('u-discount').value = "0"; document.getElementById('u-paid').value = ''; calcUnifiedTotal();
    } catch (e) { console.error(e); }
};

window.printFromData = (invId) => { const record = window.allUnifiedRecords.find(r => r.invId === invId); if(record) printUnifiedInvoice({ ...record, time: record.time?.toDate() || new Date() }); logAudit(`إعادة طباعة: ${invId}`); };
window.deleteInvoice = (id, data, invId) => { window.universalSoftDelete("invoices", id, data, invId, "ملف طبي"); };

function printUnifiedInvoice(data) {
    const rx = data.rx; const s = data.detailedSales; const dateStr = data.time.toLocaleDateString('en-GB'); const timeStr = data.time.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}); const pMethod = data.paymentMethod || 'كاش';
    document.getElementById('pr-content').innerHTML = `<div class="print-wrapper"><div class="print-header"><h2>Delta Optics</h2><p>Medical Rx & Receipt | وصفة طبية وفاتورة</p></div><div style="font-size:10pt; margin-bottom:15px;"><div class="print-info-row"><span><b>No:</b> <span class="en-num-print">${data.invId}</span></span><span><span class="en-num-print">${dateStr} ${timeStr}</span></span></div><div class="print-info-row"><span><b>المراجع:</b> ${data.pName}</span><span class="en-num-print">${data.phone || '---'}</span></div></div><div class="print-section-title">القياسات (Optical Rx)</div><table class="print-table"><tr><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr><tr><th>R (OD)</th><td><span class="en-num-print">${rx.od.s||'-'}</span></td><td><span class="en-num-print">${rx.od.c||'-'}</span></td><td><span class="en-num-print">${rx.od.a||'-'}</span></td><td><span class="en-num-print">${rx.od.add||'-'}</span></td></tr><tr><th>L (OS)</th><td><span class="en-num-print">${rx.os.s||'-'}</span></td><td><span class="en-num-print">${rx.os.c||'-'}</span></td><td><span class="en-num-print">${rx.os.a||'-'}</span></td><td><span class="en-num-print">${rx.os.add||'-'}</span></td></tr></table><div style="font-size:9.5pt; margin-bottom:15px;"><b>PD:</b> <span class="en-num-print">${rx.pd||'-'}</span> | <b>ملاحظة:</b> ${rx.notes||'-'}</div>${data.subtotal > 0 ? `<div class="print-section-title">المشتريات (Purchases)</div><table class="print-table"><tr><th>البيان</th><th style="width:70px;">JOD</th></tr>${s.frame.type ? `<tr><td>إطار: ${s.frame.type}</td><td><span class="en-num-print">${s.frame.price.toFixed(2)}</span></td></tr>` : ''}${s.lenses.type ? `<tr><td>عدسات: ${s.lenses.type}</td><td><span class="en-num-print">${s.lenses.price.toFixed(2)}</span></td></tr>` : ''}${s.cl.type ? `<tr><td>لاصق: ${s.cl.type}</td><td><span class="en-num-print">${s.cl.price.toFixed(2)}</span></td></tr>` : ''}${s.extras.type ? `<tr><td>أخرى: ${s.extras.type}</td><td><span class="en-num-print">${s.extras.price.toFixed(2)}</span></td></tr>` : ''}</table><div class="print-summary"><div class="print-summary-row"><span>Subtotal:</span><b class="en-num-print">${data.subtotal.toFixed(2)}</b></div>${data.discountPercent > 0 ? `<div class="print-summary-row"><span>Discount ${data.discountPercent}%:</span><b class="en-num-print">- ${(data.subtotal * (data.discountPercent/100)).toFixed(2)}</b></div>` : ''}<div class="print-summary-row total"><span>Total:</span><b class="en-num-print">${data.total.toFixed(2)}</b></div><div class="print-summary-row"><span>Paid (${pMethod}):</span><b class="en-num-print">${data.paid.toFixed(2)}</b></div><div class="print-summary-row"><span>Due الباقي:</span><b class="en-num-print">${data.due.toFixed(2)}</b></div></div>` : ''}<div style="text-align:center; margin-top:20px; font-weight:600; font-size:8.5pt; border-top:1px dashed #ccc; padding-top:10px;"><p style="margin:0;">بواسطة: ${data.doctor || 'موظف'} | ✨ نتمنى لكم رؤية واضحة ✨</p></div></div>`;
    window.print();
}

window.showPatientHistory = (patientName) => {
    document.getElementById('history-patient-name').innerText = patientName; const tbody = document.getElementById('tb-patient-history'); tbody.innerHTML = '';
    const records = window.allUnifiedRecords.filter(r => r.pName === patientName);
    if (records.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات</td></tr>'; } 
    else { records.forEach(r => { tbody.innerHTML += `<tr><td class="en-num">${r.time?.toDate().toLocaleDateString('en-GB') || '--'}</td><td class="en-num">${r.invId}</td><td>${r.prodName}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${parseFloat(r.total).toFixed(2)}</td><td style="display:flex; gap:5px;"><button class="btn btn-outline" style="padding:6px 10px;" onclick="printFromData('${r.invId}')"><i class="fas fa-print"></i></button> <button class="btn btn-danger admin-only" style="padding:6px 10px;" onclick='deleteInvoice("${r.id}", ${JSON.stringify(r).replace(/'/g, "\\'")}, "${r.invId}")'><i class="fas fa-trash"></i></button></td></tr>`; }); }
    document.getElementById('history-modal').style.display = 'flex'; applyRoles(Auth.user ? Auth.user.role : 'employee');
};
window.printPatientHistory = () => {
    const pName = document.getElementById('history-patient-name').innerText; const records = window.allUnifiedRecords.filter(r => r.pName === pName); if(records.length === 0) return;
    let rowsHtml = ''; let totalSpent = 0; records.forEach(r => { totalSpent += Number(r.total); rowsHtml += `<tr><td><span class="en-num-print">${r.time?.toDate().toLocaleDateString('en-GB')||'--'}</span></td><td><span class="en-num-print">${r.invId}</span></td><td>${r.prodName}</td><td><span class="en-num-print">${parseFloat(r.total).toFixed(2)}</span></td></tr>`; });
    document.getElementById('pr-content').innerHTML = `<div class="print-wrapper"><div class="print-header"><h2>Delta Optics</h2><p>Patient History | كشف سجل</p></div><div style="margin-bottom:15px; font-size:10pt;"><b>المراجع:</b> ${pName}<br><b>تاريخ الطباعة:</b> <span class="en-num-print">${new Date().toLocaleDateString('en-GB')}</span></div><table class="print-table"><tr><th>التاريخ</th><th>الملف</th><th>التفاصيل</th><th>JOD</th></tr>${rowsHtml}</table><div class="print-summary"><div class="print-summary-row total"><span>Total Spent:</span><span class="en-num-print">${totalSpent.toFixed(2)}</span></div></div></div>`; window.print(); logAudit(`طباعة كشف: ${pName}`);
};

// ================== المبيعات السريعة ==================
window.updatePosPrice = () => { document.getElementById('pos-total').value = document.getElementById('pos-product').options[document.getElementById('pos-product').selectedIndex]?.dataset.price || 0; calcPosTotal(); };
window.calcPosTotal = () => { const price = parseFloat(document.getElementById('pos-price').value) || 0; const discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0; const finalTotal = price - (price * (discountPercent / 100)); document.getElementById('pos-total').value = finalTotal.toFixed(2); const paid = parseFloat(document.getElementById('pos-paid').value) || 0; let due = finalTotal - paid; if (due < 0) due = 0; document.getElementById('pos-due').value = due.toFixed(2); document.getElementById('pos-due-display').innerText = due.toFixed(2); };
window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').value.trim(), prodSel = document.getElementById('pos-product'), prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const subtotal = parseFloat(document.getElementById('pos-price').value) || 0, discountPercent = parseFloat(document.getElementById('pos-discount').value) || 0, total = parseFloat(document.getElementById('pos-total').value) || 0, paid = parseFloat(document.getElementById('pos-paid').value) || 0, due = parseFloat(document.getElementById('pos-due').value) || 0, paymentMethod = document.getElementById('pos-payment-method').value || 'كاش';
    if (!pName || !prodName || !prodSel.value) return Swal.fire('خطأ', 'أكمل البيانات', 'error'); const invId = 'POS-' + Math.floor(Math.random() * 90000 + 10000);
    try {
        await addDoc(collection(db, "invoices"), { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod, labStatus: 'تم التسليم', time: serverTimestamp(), isUnified: false, doctor: Auth.user ? Auth.user.name : 'موظف' });
        const currentQty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty); if (currentQty > 0) await updateDoc(doc(db, "products", prodSel.value), { qty: currentQty - 1 });
        logAudit(`بيع سريع: ${invId}`); Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1500, showConfirmButton: false }); printPosFromData(invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod);
        document.getElementById('pos-patient').value = ''; prodSel.value = ''; document.getElementById('pos-price').value = '0.00'; document.getElementById('pos-discount').value = '0'; document.getElementById('pos-paid').value = ''; calcPosTotal();
    } catch(e) { Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};
window.printPosFromData = (invId, pName, prodName, subtotal, discountPercent, total, paid, due, pMethod) => {
    let d = { invId, pName, prodName, subtotal, discountPercent, total, paid, due, paymentMethod: pMethod, doctor: Auth.user ? Auth.user.name : 'موظف', time: new Date() };
    if(!pName) { const record = window.allUnifiedRecords.find(r => r.invId === invId); if(record) d = { ...record, time: record.time?.toDate() || new Date() }; else return; }
    document.getElementById('pr-content').innerHTML = `<div class="print-wrapper" style="width:90mm; text-align:center;"><h2 style="margin:0; font-family:Arial; font-size:16pt; font-weight:900;">Delta Optics</h2><p style="font-size:9pt; margin-bottom:10px;">Sales Receipt</p><div style="text-align:left; font-size:9pt; margin-bottom:10px; border-bottom:1px dashed #ccc; padding-bottom:5px;"><div>No: <span class="en-num-print">${d.invId}</span></div><div>Date: <span class="en-num-print">${d.time.toLocaleDateString('en-GB')}</span></div></div><div style="text-align:left; font-size:9.5pt; margin-bottom:10px;"><b>الزبون:</b> ${d.pName}<br><b>المنتج:</b> ${d.prodName}</div><div style="border: 1px solid #000; padding: 8px; font-size: 9.5pt; text-align:left;"><div style="display:flex; justify-content:space-between; font-weight:800; font-size:12pt; border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:5px;"><span>Total:</span> <span class="en-num-print">${d.total.toFixed(2)}</span></div><div style="display:flex; justify-content:space-between;"><span>Paid:</span> <span class="en-num-print">${d.paid.toFixed(2)}</span></div><div style="display:flex; justify-content:space-between;"><span>Due:</span> <span class="en-num-print">${d.due.toFixed(2)}</span></div></div><p style="font-size:8pt; margin-top:10px;">✨ شكراً لزيارتكم ✨</p></div>`; window.print();
};

window.openOnlineReport = (testId) => {
    const record = window.allOnlineTests.find(t => t.id === testId); if (!record) return;
    document.getElementById('report-m-name').innerText = record.name || 'غير محدد'; document.getElementById('report-m-phone').innerText = record.phone || '---'; document.getElementById('report-m-details').innerText = record.details || 'لا توجد تفاصيل';
    const waMsg = encodeURIComponent(`مرحباً ${record.name}، معك عيادة دلتا للبصريات...`); document.getElementById('btn-wa-report').href = `https://wa.me/${record.phone ? record.phone.replace(/^0/, '962') : '962775549700'}?text=${waMsg}`;
    const processBtn = document.getElementById('btn-process-report');
    if (record.isProcessed) { processBtn.style.display = 'none'; } else { processBtn.style.display = 'flex'; processBtn.onclick = async () => { await updateDoc(doc(db, "tests", testId), { isProcessed: true }); document.getElementById('online-report-modal').style.display = 'none'; logAudit(`مراجعة فحص أونلاين: ${record.name}`); Swal.fire({ icon: 'success', title: 'تم', timer: 1500, showConfirmButton: false }); }; }
    document.getElementById('online-report-modal').style.display = 'flex';
};

// ================== المخزون والإعدادات ==================
window.compressImage = (event, targetInputId) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const MAX = 600; let w = img.width, h = img.height; if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } } canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); document.getElementById(targetInputId).value = canvas.toDataURL('image/jpeg', 0.6); Swal.fire({ icon: 'success', title: 'تم الرفع', showConfirmButton: false, timer: 1000 }); }; img.src = e.target.result; }; reader.readAsDataURL(file); };
let currentEditProductId = null; window.loadProductForEdit = (id, dataObj) => { currentEditProductId = id; document.getElementById('p-name').value = dataObj.name; document.getElementById('p-price').value = dataObj.price; document.getElementById('p-qty').value = dataObj.qty; document.getElementById('p-type').value = dataObj.type; document.getElementById('p-base64').value = dataObj.img || ""; window.scrollTo({ top: 0, behavior: 'smooth' }); };
window.saveProduct = async () => { const name = document.getElementById('p-name').value, price = document.getElementById('p-price').value, type = document.getElementById('p-type').value, qty = document.getElementById('p-qty').value, img = document.getElementById('p-base64').value; if (!name || !price || !type) return Swal.fire('تنبيه', 'أكمل البيانات', 'warning'); if (currentEditProductId) { await updateDoc(doc(db, "products", currentEditProductId), { name, price: Number(price), type, qty: Number(qty), img: img || "" }); logAudit(`تعديل منتج: ${name}`); Swal.fire('نجاح', 'تم التعديل', 'success'); currentEditProductId = null; } else { await addDoc(collection(db, "products"), { name, price: Number(price), type, qty: Number(qty), img: img || "", time: serverTimestamp() }); logAudit(`إضافة منتج: ${name}`); Swal.fire('نجاح', 'تم الإضافة', 'success'); } document.getElementById('p-name').value = ''; document.getElementById('p-price').value = ''; document.getElementById('p-qty').value = ''; document.getElementById('p-base64').value = ''; };
window.softDeleteProduct = async (id, data) => { window.universalSoftDelete("products", id, data, data.name, "منتج من المخزون"); };

window.saveExtCollection = async () => { const id = document.getElementById('ext-col-id').value, name = document.getElementById('ext-col-name').value, type = document.getElementById('ext-col-type').value, img = document.getElementById('ext-col-base64').value; if (!name || !img) return Swal.fire('تنبيه', 'إجباري!', 'warning'); if (id) { await updateDoc(doc(db, "brands", id), { name, type, imageUrl: img }); Swal.fire('تم', 'تم التحديث', 'success'); logAudit(`تعديل موديل: ${name}`);} else { await addDoc(collection(db, "brands"), { name, type, imageUrl: img, timestamp: serverTimestamp() }); Swal.fire('تم', 'تم الإضافة', 'success'); logAudit(`إضافة موديل: ${name}`);} document.getElementById('ext-col-id').value=""; document.getElementById('ext-col-name').value=""; document.getElementById('ext-col-base64').value=""; };
window.deleteExtCollection = async (id, data) => { window.universalSoftDelete("brands", id, data, data.name, "تشكيلة من الموقع"); };

window.updateLabStatus = async (id, status) => { await updateDoc(doc(db, "invoices", id), { labStatus: status }); logAudit(`تحديث حالة مختبر: ${status}`); };
window.saveCMS = async () => { await setDoc(doc(db, "settings", "cms"), { topbar: document.getElementById('cms-topbar').value, openTime: document.getElementById('cms-open-time').value, closeTime: document.getElementById('cms-close-time').value, statusMode: document.getElementById('cms-status-mode').value }); Swal.fire('نجاح', 'تم النشر', 'success'); logAudit('تحديث إعدادات الموقع'); };

// ================== المزامنة החية ==================
function startSync() {
    onSnapshot(query(collection(db, "tests"), orderBy("timestamp", "desc")), (s) => {
        let tbOnlineHtml = ""; window.allOnlineTests = []; s.forEach(d => { const data = d.data(); window.allOnlineTests.push({ id: d.id, ...data }); const dStr = data.timestamp?.toDate().toLocaleDateString('en-GB') || '--'; const stat = data.isProcessed ? '<span style="color:var(--success); font-weight:bold;">مكتمل</span>' : '<span style="color:var(--warning); font-weight:bold;">جديد</span>'; tbOnlineHtml += `<tr><td>${data.name||'--'}</td><td class="en-num">${data.phone||'--'}</td><td class="en-num">${dStr}</td><td>${stat}</td><td><button class="btn btn-outline" onclick="openOnlineReport('${d.id}')">عرض</button></td></tr>`; });
        if(document.getElementById('tb-online-rx')) document.getElementById('tb-online-rx').innerHTML = tbOnlineHtml;
    });

    onSnapshot(query(collection(db, "expenses"), orderBy("time", "desc")), (s) => { todayExpensesData = []; s.forEach(d => { todayExpensesData.push({ id: d.id, ...d.data() }); }); if(typeof window.renderDailyLedger === 'function') window.renderDailyLedger(); });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", tbLab = ""; let posPatientHtml = "<option value=''>-- المراجع --</option>"; todayInvoicesData = []; window.allUnifiedRecords = []; let uniquePatients = {}; 
        s.forEach(d => { 
            const i = d.data(); i.id = d.id; todayInvoicesData.push(i);
            if (!i.isUnified) { window.allUnifiedRecords.push(i); tbInvoices += `<tr><td class="en-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${parseFloat(i.total).toFixed(2)}</td><td class="en-num" style="color:var(--danger); font-weight:bold;">${parseFloat(i.due).toFixed(2)}</td><td style="display:flex; gap:8px;"><button class="btn btn-outline" onclick="printPosFromData('${i.invId}')"><i class="fas fa-print"></i></button> <button class="btn btn-danger admin-only" onclick='deleteInvoice("${d.id}", ${JSON.stringify(i).replace(/'/g, "\\'")}, "${i.invId}")'><i class="fas fa-trash"></i></button></td></tr>`; }
            if (i.labStatus !== 'تم التسليم') { tbLab += `<tr><td class="en-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td><select onchange="updateLabStatus('${d.id}', this.value)" class="form-control" style="padding:6px; font-size:0.9rem;"><option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option><option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option><option value="تم التسليم">تسليم</option></select></td></tr>`; }
            if (i.isUnified && i.rx) { window.allUnifiedRecords.push(i); if (!uniquePatients[i.pName]) { uniquePatients[i.pName] = { lastVisit: i.time?.toDate(), totalSpent: 0 }; } uniquePatients[i.pName].totalSpent += Number(i.total); }
        });
        const patientNames = Object.keys(uniquePatients); if(document.getElementById('patients-list')) { document.getElementById('patients-list').innerHTML = patientNames.map(name => `<option value="${name}">`).join(''); }
        let tbUnifiedHTML = ""; patientNames.forEach(pName => { tbUnifiedHTML += `<tr><td style="font-weight:bold; color:var(--text-strong); font-size:1.05rem;">${pName}</td><td class="en-num">${uniquePatients[pName].lastVisit?.toLocaleDateString('en-GB')||'--'}</td><td class="en-num" style="font-weight:bold; color:var(--primary);">${uniquePatients[pName].totalSpent.toFixed(2)}</td><td><button class="btn btn-outline" onclick="showPatientHistory('${pName}')"><i class="fas fa-folder-open"></i> السجل</button></td></tr>`; posPatientHtml += `<option value="${pName}">${pName}</option>`; });
        if(document.getElementById('tb-invc')) document.getElementById('tb-invc').innerHTML = tbInvoices; if(document.getElementById('tb-unified-rx')) document.getElementById('tb-unified-rx').innerHTML = tbUnifiedHTML; if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = posPatientHtml;
        if(typeof window.renderDailyLedger === 'function') window.renderDailyLedger(); applyRoles(Auth.user ? Auth.user.role : 'employee');
    });

    onSnapshot(collection(db, "users"), (s) => {
        allStaffData = []; s.forEach(d => allStaffData.push({id: d.id, ...d.data()}));
        if (document.getElementById('tb-staff')) {
            document.getElementById('tb-staff').innerHTML = allStaffData.map(d => {
                const statusStr = d.status === 'frozen' ? '<span style="color:var(--danger); font-weight:bold;">مجمد</span>' : '<span style="color:var(--success); font-weight:bold;">نشط</span>';
                const roleStr = d.role === 'developer' ? 'مطور' : d.role === 'manager' ? 'مدير' : 'موظف';
                return `<tr><td style="font-weight:bold;">${d.name}</td><td class="en-num">${d.user}</td><td><span style="background:var(--bg-main); padding:4px 8px; border-radius:4px;">${roleStr}</span></td><td>${statusStr}</td><td style="display:flex; gap:8px;"><button class="btn btn-outline" onclick="loadStaffForEdit('${d.id}')"><i class="fas fa-edit"></i> تعديل</button> <button class="btn btn-danger" onclick='deleteUserAccount("${d.id}", "${d.name}", ${JSON.stringify(d).replace(/'/g, "\\'")})'><i class="fas fa-trash"></i></button></td></tr>`;
            }).join('');
        }
    });

    onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(50)), (s) => {
        if(document.getElementById('tb-secret-audit')) document.getElementById('tb-secret-audit').innerHTML = s.docs.map(d => { const data = d.data(); const dStr = data.time?.toDate().toLocaleString('en-GB') || '--'; return `<tr><td><span style="font-weight:bold; color:var(--text-main);">${data.user}</span></td><td>جهاز نظام</td><td style="font-weight:600;">${data.action}</td><td class="en-num">${dStr}</td></tr>`; }).join('');
    });

    onSnapshot(query(collection(db, "recycle_bin"), orderBy("deletedAt", "desc")), (s) => {
        if (document.getElementById('tb-recycle')) document.getElementById('tb-recycle').innerHTML = s.docs.map(d => { const p = d.data(); const dStr = p.deletedAt?.toDate().toLocaleString('en-GB') || '--'; return `<tr><td style="font-weight:bold; color:var(--danger);">${p.typeLabel}</td><td>${p.displayName}</td><td><span style="font-weight:bold; color:var(--text-muted);">${p.deletedBy}</span></td><td class="en-num">${dStr}</td><td><button class="btn btn-outline" onclick='universalRestore("${d.id}", "${p.originalCol}", "${p.originalId}", ${JSON.stringify(p.data).replace(/'/g, "\\'")}, "${p.displayName}", "${p.typeLabel}")'><i class="fas fa-undo"></i> استرجاع</button></td></tr>`; }).join(''); 
    });
}
