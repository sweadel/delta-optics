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
    if (due < 0) due = 0; // منع الباقي السالب
    
    document.getElementById('u-due').value = due.toFixed(2);
    document.getElementById('u-due-display').innerText = due.toFixed(2) + " JOD";
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
        document.querySelectorAll('.rx-table-modern input, .grid-2 input').forEach(inp => inp.value = '');
        document.querySelectorAll('.product-row input').forEach(inp => inp.value = '');
        document.getElementById('u-discount').value = "0"; document.getElementById('u-paid').value = '';
        calcUnifiedTotal();

    } catch (e) { console.error(e); Swal.fire('خطأ', 'مشكلة بالاتصال بالإنترنت', 'error'); }
};

window.printFromData = (dataObj) => {
    const printData = { ...dataObj, time: dataObj.time?.toDate() || new Date() };
    printUnifiedInvoice(printData);
};

// ================== تصميم الطباعة (عيادة A5 مرتبة جداً) ==================
function printUnifiedInvoice(data) {
    const rx = data.rx; const s = data.detailedSales;
    const dateStr = data.time.toLocaleDateString('en-GB'); 
    const pMethod = data.paymentMethod || 'كاش';

    document.getElementById('pr-content').innerHTML = `
        <div class="print-card">
            <div class="print-header">
                <div style="text-align: left;">
                    <h2 style="margin:0; font-size:1.4rem; font-weight:900;">Delta Optics</h2>
                    <h4 style="margin:0; font-size: 0.85rem;">وصفة طبية وفاتورة</h4>
                </div>
                <img src="logo.jpg" class="print-logo" alt="Logo">
            </div>

            <div style="font-size: 0.9rem; margin-bottom: 12px; line-height: 1.5; border-bottom: 1px dashed #000; padding-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span><b>No:</b> <span class="en-num-print">${data.invId}</span></span>
                    <span><b>Date:</b> <span class="en-num-print">${dateStr}</span></span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span><b>المراجع:</b> ${data.pName}</span>
                    <span><b>Tel:</b> <span class="en-num-print">${data.phone || '---'}</span></span>
                </div>
            </div>
            
            <div style="font-weight: bold; text-align: center; font-size: 0.85rem; border: 1px solid #000; margin-bottom: 4px;">القياسات (Optical Rx)</div>
            <table class="print-table">
                <tr style="background:#f1f1f1;"><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr>
                <tr><th>R (OD)</th><td><span class="en-num-print">${rx.od.s||'-'}</span></td><td><span class="en-num-print">${rx.od.c||'-'}</span></td><td><span class="en-num-print">${rx.od.a||'-'}</span></td><td><span class="en-num-print">${rx.od.add||'-'}</span></td></tr>
                <tr><th>L (OS)</th><td><span class="en-num-print">${rx.os.s||'-'}</span></td><td><span class="en-num-print">${rx.os.c||'-'}</span></td><td><span class="en-num-print">${rx.os.a||'-'}</span></td><td><span class="en-num-print">${rx.os.add||'-'}</span></td></tr>
            </table>
            <div style="font-size:0.85rem; margin-bottom:15px;"><b>PD:</b> <span class="en-num-print">${rx.pd||'-'}</span> | <b>ملاحظة:</b> ${rx.notes||'-'}</div>

            ${data.subtotal > 0 ? `
            <div style="font-weight: bold; text-align: center; font-size: 0.85rem; border: 1px solid #000; margin-bottom: 4px;">المشتريات (Purchases)</div>
            <table class="print-table">
                <tr style="background:#f1f1f1;"><th>البيان</th><th style="width:70px;">JOD</th></tr>
                ${s.frame.type ? `<tr><td>إطار: ${s.frame.type}</td><td><span class="en-num-print">${s.frame.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.lenses.type ? `<tr><td>عدسات: ${s.lenses.type}</td><td><span class="en-num-print">${s.lenses.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.cl.type ? `<tr><td>لاصق: ${s.cl.type}</td><td><span class="en-num-print">${s.cl.price.toFixed(2)}</span></td></tr>` : ''}
                ${s.extras.type ? `<tr><td>أخرى: ${s.extras.type}</td><td><span class="en-num-print">${s.extras.price.toFixed(2)}</span></td></tr>` : ''}
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
                <p style="margin: 0;">بواسطة: ${data.doctor || 'موظف'} | ✨ نتمنى لكم رؤية واضحة ✨</p>
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
            tbody.innerHTML += `<tr><td class="erp-num">${dateStr}</td><td class="erp-num">${r.invId}</td><td>${r.prodName}</td><td class="erp-num" style="font-weight:bold; color:var(--primary);">${parseFloat(r.total).toFixed(2)} JOD</td><td><button class="btn btn-dark" style="padding: 5px 10px;" onclick='printFromData(${JSON.stringify(r).replace(/'/g, "\\'")})'><i class="fas fa-print"></i> طباعة</button></td></tr>`;
        });
    }
    modal.style.display = 'flex';
};

// ================== باقي الوظائف ==================

window.compressImage = (event, targetInputId, previewImgId = null) => {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image(); img.onload = () => {
            const canvas = document.createElement('canvas'); const MAX = 600; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            document.getElementById(targetInputId).value = canvas.toDataURL('image/jpeg', 0.6);
            if(previewImgId) { document.getElementById(previewImgId).src = document.getElementById(targetInputId).value; document.getElementById(previewImgId).style.display = 'block'; }
            Swal.fire({ icon: 'success', title: 'تم التجهيز', showConfirmButton: false, timer: 1000 });
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
};

window.updatePosPrice = () => { document.getElementById('pos-total').value = document.getElementById('pos-product').options[document.getElementById('pos-product').selectedIndex]?.dataset.price || 0; };
window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').options[document.getElementById('pos-patient').selectedIndex]?.text, prodSel = document.getElementById('pos-product'), prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const total = parseFloat(document.getElementById('pos-total').value) || 0, paid = parseFloat(document.getElementById('pos-paid').value) || 0, due = total - paid;
    if (!pName || !prodName || !total) return Swal.fire('خطأ', 'أكمل الفاتورة', 'error');
    const invId = 'POS-' + Math.floor(Math.random() * 9000 + 1000);
    await addDoc(collection(db, "invoices"), { invId, pName, prodName, total, paid, due, labStatus: 'انتظار', time: serverTimestamp(), isUnified: false });
    const currentQty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty);
    if (currentQty > 0) await updateDoc(doc(db, "products", prodSel.value), { qty: currentQty - 1 });
    logAudit(`بيع سريع: ${invId}`);
    document.getElementById('pr-content').innerHTML = `<div class="print-card" style="text-align:center;"><h2>Delta Optics</h2><p>فاتورة مبيعات: <span class="en-num-print">${invId}</span></p><p>التاريخ: <span class="en-num-print">${new Date().toLocaleDateString('en-GB')}</span></p><hr><p><b>المراجع:</b> ${pName}</p><p><b>المنتج:</b> ${prodName}</p><hr><h3 style="margin:5px;">الإجمالي: <span class="en-num-print">${total.toFixed(2)}</span> JOD</h3><p style="margin:2px;">المدفوع: <span class="en-num-print">${paid.toFixed(2)}</span> | الباقي: <span class="en-num-print">${due.toFixed(2)}</span></p></div>`;
    window.print();
};

let currentEditProductId = null;
window.loadProductForEdit = (id, dataObj) => { currentEditProductId = id; document.getElementById('p-name').value = dataObj.name; document.getElementById('p-price').value = dataObj.price; document.getElementById('p-qty').value = dataObj.qty; document.getElementById('p-type').value = dataObj.type; document.getElementById('p-base64').value = dataObj.img || ""; Swal.fire({ icon: 'info', title: 'تعديل', timer: 2000, showConfirmButton: false }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
window.saveProduct = async () => {
    const name = document.getElementById('p-name').value, price = document.getElementById('p-price').value, type = document.getElementById('p-type').value, qty = document.getElementById('p-qty').value, img = document.getElementById('p-base64').value;
    if (!name || !price || !type) return Swal.fire('تنبيه', 'أكمل البيانات', 'warning');
    if (currentEditProductId) { await updateDoc(doc(db, "products", currentEditProductId), { name, price: Number(price), type, qty: Number(qty), img: img || "" }); logAudit(`تعديل منتج: ${name}`); Swal.fire('نجاح', 'تم التعديل', 'success'); currentEditProductId = null; } 
    else { await addDoc(collection(db, "products"), { name, price: Number(price), type, qty: Number(qty), img: img || "", time: serverTimestamp() }); logAudit(`إضافة منتج: ${name}`); Swal.fire('نجاح', 'تم الإضافة', 'success'); }
    document.getElementById('p-name').value = ''; document.getElementById('p-price').value = ''; document.getElementById('p-qty').value = ''; document.getElementById('p-base64').value = '';
};

window.softDeleteProduct = async (id, data) => { if (confirm('نقل للمحذوفات؟')) { await addDoc(collection(db, "recycle_bin"), { ...data, deletedAt: serverTimestamp(), deletedBy: Auth.user.name }); await deleteDoc(doc(db, "products", id)); logAudit(`حذف منتج: ${data.name}`); } };
window.restoreProduct = async (id, data) => { await addDoc(collection(db, "products"), { name: data.name, price: data.price, type: data.type, qty: data.qty, img: data.img, time: serverTimestamp() }); await deleteDoc(doc(db, "recycle_bin", id)); logAudit(`استرجاع منتج: ${data.name}`); };

window.resetExtColForm = () => { document.getElementById('ext-col-id').value = ""; document.getElementById('ext-col-name').value = ""; document.getElementById('ext-col-type').value = "medical"; document.getElementById('ext-col-base64').value = ""; document.getElementById('ext-col-preview').style.display = "none"; };
window.loadExtCollectionForEdit = (id, name, type, img) => { document.getElementById('ext-col-id').value = id; document.getElementById('ext-col-name').value = name; document.getElementById('ext-col-type').value = type || "medical"; document.getElementById('ext-col-base64').value = img || ""; if(img) { document.getElementById('ext-col-preview').src = img; document.getElementById('ext-col-preview').style.display = "block"; } window.scrollTo({ top: 0, behavior: 'smooth' }); Swal.fire({ icon: 'info', title: 'تعديل', timer: 2000, showConfirmButton: false }); };
window.saveExtCollection = async () => { const id = document.getElementById('ext-col-id').value, name = document.getElementById('ext-col-name').value, type = document.getElementById('ext-col-type').value, img = document.getElementById('ext-col-base64').value; if (!name || !img) return Swal.fire('تنبيه', 'إجباري!', 'warning'); if (id) { await updateDoc(doc(db, "brands", id), { name, type, imageUrl: img }); Swal.fire('تم', 'تم التحديث', 'success'); } else { await addDoc(collection(db, "brands"), { name, type, imageUrl: img, timestamp: serverTimestamp() }); Swal.fire('تم', 'تم الإضافة', 'success'); } resetExtColForm(); };
window.deleteExtCollection = async (id, name) => { if (confirm(`حذف الموديل "${name}"؟`)) { await deleteDoc(doc(db, "brands", id)); } };

window.saveStaff = async () => { const name = document.getElementById('s-name').value, user = document.getElementById('s-user').value, pass = document.getElementById('s-pass').value, role = document.getElementById('s-role').value; await addDoc(collection(db, "users"), { name, user, pass, role, status: "active", time: serverTimestamp() }); logAudit(`إنشاء حساب: ${name}`); Swal.fire('نجاح', 'تم الحفظ', 'success'); };
window.changeUserPassword = async (id) => { const { value: newPass } = await Swal.fire({ title: 'الباسوورد الجديد', input: 'text' }); if (newPass) { await updateDoc(doc(db, "users", id), { pass: newPass }); Swal.fire('تم', 'تغير الباسوورد', 'success'); } };
window.toggleUserFreeze = async (id, currentStatus) => { const newStatus = currentStatus === "frozen" ? "active" : "frozen"; await updateDoc(doc(db, "users", id), { status: newStatus }); };
window.deleteUserAccount = async (id) => { if (confirm('حذف الحساب نهائياً؟')) await deleteDoc(doc(db, "users", id)); };

window.updateLabStatus = async (id, status) => { await updateDoc(doc(db, "invoices", id), { labStatus: status }); };
window.sendChat = async () => { const text = document.getElementById('chat-input').value; if (text) { await addDoc(collection(db, "chat"), { sender: Auth.user.name, text, time: serverTimestamp() }); document.getElementById('chat-input').value = ""; }};

window.saveCMS = async () => { 
    await setDoc(doc(db, "settings", "cms"), { 
        topbar: document.getElementById('cms-topbar').value, openTime: document.getElementById('cms-open-time').value, closeTime: document.getElementById('cms-close-time').value, statusMode: document.getElementById('cms-status-mode').value
    }); 
    Swal.fire('نجاح', 'تم التحديث', 'success'); 
};
window.processOnlineRx = async (id, name) => { await updateDoc(doc(db, "online_rx_requests"), { status: 'مكتمل' }); Swal.fire('تم', 'مراجعة الطلب', 'success'); };

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
            invHtml += `<tr><td>${imgSrc}</td><td>${p.name}</td><td><span class="badge">${p.type}</span></td><td class="erp-num">${p.qty}</td><td class="erp-num">${p.price}</td><td style="display:flex; gap:5px; justify-content:center;"><button class="btn btn-warning" onclick='loadProductForEdit("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-edit"></i></button><button class="btn btn-danger" onclick='softDeleteProduct("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-trash"></i></button></td></tr>`; 
            if (p.qty > 0) posProdHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`; 
        });
        document.getElementById('tb-inv').innerHTML = invHtml; document.getElementById('pos-product').innerHTML = posProdHtml;
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", tbLab = "", totalSales = 0, totalProfits = 0;
        let posPatientHtml = "<option value=''>-- اختر المراجع --</option>";
        window.allUnifiedRecords = []; let uniquePatients = {}; 

        s.forEach(d => { 
            const i = d.data(); 
            if (i.time?.toDate().toDateString() === new Date().toDateString()) { totalSales += Number(i.total); totalProfits += Number(i.paid); } 
            if (!i.isUnified) { tbInvoices += `<tr><td class="erp-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td class="erp-num" style="font-weight:bold; color:var(--primary);">${parseFloat(i.total).toFixed(2)}</td><td class="erp-num" style="color:var(--danger); font-weight:bold;">${parseFloat(i.due).toFixed(2)}</td></tr>`; }
            if (i.labStatus !== 'تم التسليم') { tbLab += `<tr><td class="erp-num">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td><select onchange="updateLabStatus('${d.id}', this.value)"><option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option><option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option><option value="تم التسليم">تسليم</option></select></td></tr>`; }

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
            tbUnifiedHTML += `<tr><td style="font-weight:bold; color:var(--primary); font-size:1.1rem;">${pName}</td><td class="erp-num">${dateStr}</td><td class="erp-num" style="font-weight:bold;">${uniquePatients[pName].totalSpent.toFixed(2)} JOD</td><td><button class="btn btn-primary" onclick="showPatientHistory('${pName}')"><i class="fas fa-folder-open"></i> السجل</button></td></tr>`;
            posPatientHtml += `<option value="${pName}">${pName}</option>`;
        });

        document.getElementById('tb-invc').innerHTML = tbInvoices; document.getElementById('tb-lab').innerHTML = tbLab; 
        if(document.getElementById('tb-unified-rx')) document.getElementById('tb-unified-rx').innerHTML = tbUnifiedHTML;
        if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = posPatientHtml;
        document.getElementById('kpi-sales').innerText = totalSales.toFixed(2) + " JOD"; 
        if (document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalProfits.toFixed(2) + " JOD";
    });

    onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(10)), (s) => {
        if(document.getElementById('live-activity-feed')) document.getElementById('live-activity-feed').innerHTML = s.docs.map(d => `<div class="activity-item"><strong>${d.data().user}</strong>: ${d.data().action} <br><small style="color:var(--warning)" class="erp-num">${d.data().time?.toDate().toLocaleTimeString()}</small></div>`).join('');
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
                return `<tr><td>${d.data().name}</td><td class="erp-num">${d.data().user}</td><td><span class="badge">${d.data().role}</span></td><td>${d.data().status==='frozen'?'<span style="color:red">مجمد</span>':'نشط'}</td><td>${statusBtn} <button class="btn btn-danger" onclick="deleteUserAccount('${d.id}')">حذف</button></td></tr>`;
            }).join('');
        });
        onSnapshot(query(collection(db, "stealth_logs"), orderBy("time", "desc")), (s) => { if (document.getElementById('tb-secret-audit')) document.getElementById('tb-secret-audit').innerHTML = s.docs.map(d => `<tr><td>${d.data().user}</td><td>${d.data().device||'--'}</td><td>${d.data().action}</td><td class="erp-num">${d.data().time?.toDate().toLocaleString()}</td></tr>`).join(''); });
        onSnapshot(query(collection(db, "recycle_bin"), orderBy("deletedAt", "desc")), (s) => { if (document.getElementById('tb-recycle')) document.getElementById('tb-recycle').innerHTML = s.docs.map(d => { const p = d.data(); return `<tr><td>${p.name}</td><td>${p.deletedBy}</td><td><button class="btn btn-success" onclick='restoreProduct("${d.id}", ${JSON.stringify(p)})'>استرجاع</button></td></tr>`; }).join(''); });
    }
}
