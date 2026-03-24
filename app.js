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

// ================== الحسابات الشاملة (آلة حاسبة ذكية) والطباعة ==================
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
    const due = finalTotal - paid;
    
    document.getElementById('u-due').value = due.toFixed(2);
    document.getElementById('u-due-display').innerText = due.toFixed(2) + " JOD";
};

window.saveUnifiedRecord = async () => {
    const name = document.getElementById('u-name').value;
    const phone = document.getElementById('u-phone').value;
    
    if (!name) return Swal.fire('خطأ', 'اسم المراجع إجباري', 'error');

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

    const subtotal = parseFloat(document.getElementById('u-subtotal').value) || 0;
    const discountPercent = parseFloat(document.getElementById('u-discount').value) || 0;
    const total = parseFloat(document.getElementById('u-total').value) || 0;
    const paid = parseFloat(document.getElementById('u-paid').value) || 0;
    const due = parseFloat(document.getElementById('u-due').value) || 0;
    
    const invId = 'DLT-' + Math.floor(Math.random() * 90000 + 10000);
    const doctorName = Auth.user ? Auth.user.name : 'موظف النظام';

    let prodDesc = [];
    if(salesData.frame.type) prodDesc.push("إطار");
    if(salesData.lenses.type) prodDesc.push("عدسات");
    if(salesData.cl.type) prodDesc.push("لاصق");
    if(salesData.extras.type) prodDesc.push("أخرى");
    const fullProdName = prodDesc.join(' + ') || 'فحص طبي';

    const currentTime = new Date();

    try {
        await addDoc(collection(db, "invoices"), {
            invId, pName: name, phone: phone, prodName: fullProdName, 
            subtotal, discountPercent, total, paid, due, 
            labStatus: 'انتظار', time: serverTimestamp(),
            isUnified: true, rx: rxData, detailedSales: salesData, doctor: doctorName 
        });

        logAudit(`إصدار ملف شامل: ${name} (خصم ${discountPercent}%)`);
        Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'جاري تجهيز الفاتورة للطباعة...', timer: 1500, showConfirmButton: false });

        printUnifiedInvoice({
            invId, pName: name, phone, time: currentTime, doctor: doctorName,
            rx: rxData, detailedSales: salesData, subtotal, discountPercent, total, paid, due
        });

        document.getElementById('u-name').value = ''; document.getElementById('u-phone').value = '';
        document.querySelectorAll('.rx-input').forEach(inp => inp.value = '');
        document.querySelectorAll('.sales-row input').forEach(inp => inp.value = '');
        document.getElementById('u-discount').value = "0"; document.getElementById('u-paid').value = '';
        calcUnifiedTotal();

    } catch (e) { console.error(e); Swal.fire('خطأ', 'تأكد من اتصالك بالإنترنت', 'error'); }
};

window.printFromData = (dataObj) => {
    const printData = { ...dataObj, time: dataObj.time?.toDate() || new Date() };
    printUnifiedInvoice(printData);
};

function printUnifiedInvoice(data) {
    const rx = data.rx;
    const s = data.detailedSales;
    const dateStr = data.time.toLocaleDateString('en-GB'); 
    const timeStr = data.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('pr-title').innerHTML = "<span style='font-size: 1.2rem; color: #555;'>Medical Prescription & Receipt | وصفة طبية وفاتورة</span>";
    document.getElementById('pr-content').innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size: 1rem; border-bottom: 2px solid #333; padding-bottom: 10px;">
            <div style="text-align: left;" dir="ltr">
                <b>Invoice No:</b> ${data.invId}<br>
                <b>Date:</b> ${dateStr}<br>
                <b>Time:</b> ${timeStr}
            </div>
            <div style="text-align: right;" dir="rtl">
                <b>اسم المراجع:</b> ${data.pName}<br>
                <b>رقم الهاتف:</b> <span dir="ltr">${data.phone || '---'}</span><br>
                <b>بواسطة:</b> ${data.doctor || '---'}
            </div>
        </div>
        
        <h3 style="background:#f1f5f9; padding:8px; border-radius: 6px; border:1px solid #cbd5e1; margin-bottom:15px; text-align: center;">القياسات الطبية (Optical Prescription)</h3>
        <table style="width:100%; text-align:center; border-collapse: collapse; margin-bottom:20px; font-size: 1.1rem; font-weight: bold;" border="1" dir="ltr">
            <tr style="background:#e2e8f0;"><th style="padding:10px;">Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr>
            <tr><th style="padding:10px;">Right (OD)</th><td>${rx.od.s || '-'}</td><td>${rx.od.c || '-'}</td><td>${rx.od.a || '-'}</td><td>${rx.od.add || '-'}</td></tr>
            <tr><th style="padding:10px;">Left (OS)</th><td>${rx.os.s || '-'}</td><td>${rx.os.c || '-'}</td><td>${rx.os.a || '-'}</td><td>${rx.os.add || '-'}</td></tr>
        </table>
        <div style="display: flex; justify-content: space-between; margin-bottom:25px; padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; font-weight: bold;">
            <span dir="ltr">PD: ${rx.pd || '-'}</span>
            <span>ملاحظات: ${rx.notes || '-'}</span>
        </div>

        <h3 style="background:#f1f5f9; padding:8px; border-radius: 6px; border:1px solid #cbd5e1; margin-bottom:15px; text-align: center;">تفاصيل المشتريات (Purchases)</h3>
        <table style="width:100%; text-align:right; border-collapse: collapse; margin-bottom:20px;" border="1">
            <tr style="background:#e2e8f0;">
                <th style="padding:10px;">البيان (Description)</th>
                <th style="padding:10px; text-align:center; width: 140px;">السعر (JOD)</th>
            </tr>
            ${s.frame.type ? `<tr><td style="padding:10px;">إطار (Frame): ${s.frame.type}</td><td style="text-align:center; font-weight:bold; font-family:monospace; font-size:1.1rem;" dir="ltr">${s.frame.price.toFixed(2)}</td></tr>` : ''}
            ${s.lenses.type ? `<tr><td style="padding:10px;">عدسات (Lenses): ${s.lenses.type}</td><td style="text-align:center; font-weight:bold; font-family:monospace; font-size:1.1rem;" dir="ltr">${s.lenses.price.toFixed(2)}</td></tr>` : ''}
            ${s.cl.type ? `<tr><td style="padding:10px;">لاصق (Contact Lenses): ${s.cl.type}</td><td style="text-align:center; font-weight:bold; font-family:monospace; font-size:1.1rem;" dir="ltr">${s.cl.price.toFixed(2)}</td></tr>` : ''}
            ${s.extras.type ? `<tr><td style="padding:10px;">أخرى (Extras): ${s.extras.type}</td><td style="text-align:center; font-weight:bold; font-family:monospace; font-size:1.1rem;" dir="ltr">${s.extras.price.toFixed(2)}</td></tr>` : ''}
        </table>
        
        <div style="width: 55%; margin-right: auto; border: 2px solid #0f172a; border-radius: 8px; padding: 15px; background: #f8fafc; font-family: monospace; font-size: 1.1rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                <span style="font-family: 'Tajawal', sans-serif;">المجموع (Subtotal):</span> <span dir="ltr"><b>${data.subtotal.toFixed(2)}</b></span>
            </div>
            ${data.discountPercent > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; color: #ea580c;">
                <span style="font-family: 'Tajawal', sans-serif;">خصم (Discount ${data.discountPercent}%):</span> <span dir="ltr"><b>- ${ (data.subtotal * (data.discountPercent/100)).toFixed(2) }</b></span>
            </div>
            ` : ''}
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size: 1.3rem; font-weight: 900; border-top: 2px solid #cbd5e1; padding-top: 8px;">
                <span style="font-family: 'Tajawal', sans-serif;">الإجمالي (Total JOD):</span> <span dir="ltr"><b>${data.total.toFixed(2)}</b></span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; color: #10b981;">
                <span style="font-family: 'Tajawal', sans-serif;">المدفوع (Paid JOD):</span> <span dir="ltr"><b>${data.paid.toFixed(2)}</b></span>
            </div>
            <div style="display:flex; justify-content:space-between; color: #ef4444; font-weight: bold;">
                <span style="font-family: 'Tajawal', sans-serif;">المتبقي (Due JOD):</span> <span dir="ltr"><b>${data.due.toFixed(2)}</b></span>
            </div>
        </div>
        
        <div style="text-align:center; margin-top:40px; font-weight:bold; color: #475569; border-top: 1px dashed #94a3b8; padding-top: 20px;">
            <p style="margin: 0;">✨ شكراً لثقتكم بـ Delta Optics ✨</p>
            <p style="margin: 5px 0 0 0; font-size: 0.9rem;" dir="ltr">Contact: +962 775 549 700</p>
        </div>
    `;
    window.print();
}

// ================== الوظائف الأساسية ==================

window.compressImage = (event, targetInputId, previewImgId = null) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image(); img.onload = () => {
            const canvas = document.createElement('canvas'); const MAX = 600; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            document.getElementById(targetInputId).value = canvas.toDataURL('image/jpeg', 0.6);
            if(previewImgId) { document.getElementById(previewImgId).src = document.getElementById(targetInputId).value; document.getElementById(previewImgId).style.display = 'block'; }
            Swal.fire({ icon: 'success', title: 'تم تجهيز الصورة', showConfirmButton: false, timer: 1000 });
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
    document.getElementById('pr-title').innerText = "فاتورة بيع سريع (POS)";
    document.getElementById('pr-content').innerHTML = `<p>رقم الفاتورة: ${invId} | التاريخ: ${new Date().toLocaleDateString()}</p><hr><p>المراجع: ${pName} | المنتج: ${prodName}</p><hr><h3>الإجمالي: ${total.toFixed(2)} JOD</h3><p>المدفوع: ${paid.toFixed(2)} JOD | المتبقي: ${due.toFixed(2)} JOD</p>`;
    window.print();
};

let currentEditProductId = null;
window.loadProductForEdit = (id, dataObj) => { currentEditProductId = id; document.getElementById('p-name').value = dataObj.name; document.getElementById('p-price').value = dataObj.price; document.getElementById('p-qty').value = dataObj.qty; document.getElementById('p-type').value = dataObj.type; document.getElementById('p-base64').value = dataObj.img || ""; Swal.fire({ icon: 'info', title: 'وضع التعديل', timer: 2000, showConfirmButton: false }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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
window.loadExtCollectionForEdit = (id, name, type, img) => { document.getElementById('ext-col-id').value = id; document.getElementById('ext-col-name').value = name; document.getElementById('ext-col-type').value = type || "medical"; document.getElementById('ext-col-base64').value = img || ""; if(img) { document.getElementById('ext-col-preview').src = img; document.getElementById('ext-col-preview').style.display = "block"; } window.scrollTo({ top: 0, behavior: 'smooth' }); Swal.fire({ icon: 'info', title: 'وضع التعديل', timer: 2000, showConfirmButton: false }); };
window.saveExtCollection = async () => { const id = document.getElementById('ext-col-id').value, name = document.getElementById('ext-col-name').value, type = document.getElementById('ext-col-type').value, img = document.getElementById('ext-col-base64').value; if (!name || !img) return Swal.fire('تنبيه', 'الاسم والصورة إجباريات!', 'warning'); if (id) { await updateDoc(doc(db, "brands", id), { name, type, imageUrl: img }); Swal.fire('تم', 'تم التحديث', 'success'); logAudit(`تحديث تشكيلة: ${name}`); } else { await addDoc(collection(db, "brands"), { name, type, imageUrl: img, timestamp: serverTimestamp() }); Swal.fire('تم', 'تم الإضافة', 'success'); logAudit(`إضافة تشكيلة: ${name}`); } resetExtColForm(); };
window.deleteExtCollection = async (id, name) => { if (confirm(`حذف التشكيلة ${name}؟`)) { await deleteDoc(doc(db, "brands", id)); logAudit(`حذف تشكيلة: ${name}`); } };

window.saveStaff = async () => { const name = document.getElementById('s-name').value, user = document.getElementById('s-user').value, pass = document.getElementById('s-pass').value, role = document.getElementById('s-role').value; await addDoc(collection(db, "users"), { name, user, pass, role, status: "active", time: serverTimestamp() }); logAudit(`إنشاء حساب: ${name}`); Swal.fire('نجاح', 'تم الحفظ', 'success'); };
window.changeUserPassword = async (id) => { const { value: newPass } = await Swal.fire({ title: 'الباسوورد الجديد', input: 'text' }); if (newPass) { await updateDoc(doc(db, "users", id), { pass: newPass }); Swal.fire('تم', 'تغير الباسوورد', 'success'); } };
window.toggleUserFreeze = async (id, currentStatus) => { const newStatus = currentStatus === "frozen" ? "active" : "frozen"; await updateDoc(doc(db, "users", id), { status: newStatus }); logAudit(`تغيير حالة حساب: ${newStatus}`); };
window.deleteUserAccount = async (id) => { if (confirm('حذف الحساب نهائياً؟')) await deleteDoc(doc(db, "users", id)); };

window.updateLabStatus = async (id, status) => { await updateDoc(doc(db, "invoices", id), { labStatus: status }); };
window.sendChat = async () => { const text = document.getElementById('chat-input').value; if (text) { await addDoc(collection(db, "chat"), { sender: Auth.user.name, text, time: serverTimestamp() }); document.getElementById('chat-input').value = ""; }};

window.saveCMS = async () => { 
    await setDoc(doc(db, "settings", "cms"), { 
        topbar: document.getElementById('cms-topbar').value, 
        openTime: document.getElementById('cms-open-time').value,
        closeTime: document.getElementById('cms-close-time').value,
        statusMode: document.getElementById('cms-status-mode').value
    }); 
    logAudit("تحديث إعدادات الموقع"); Swal.fire('نجاح', 'تم التحديث', 'success'); 
};
window.processOnlineRx = async (id, name) => { await updateDoc(doc(db, "online_rx_requests"), { status: 'مكتمل' }); Swal.fire('تم', 'مراجعة الطلب', 'success'); logSecretAction(`عالج طلب أونلاين: ${name}`); };

function startSync() {
    onSnapshot(query(collection(db, "brands"), orderBy("timestamp", "desc")), (s) => {
        let html = "";
        s.forEach(d => {
            const data = d.data(); const imgSrc = data.imageUrl ? `<img src="${data.imageUrl}" class="img-preview" style="width:40px; border-radius:4px;">` : '<span class="badge">لا يوجد صورة</span>';
            const typeLabel = data.type === 'sun' ? '<span class="badge" style="background:#f59e0b; color:white;">شمسي</span>' : '<span class="badge" style="background:#0e7490; color:white;">طبي</span>';
            html += `<tr><td>${imgSrc}</td><td>${data.name}</td><td>${typeLabel}</td><td><button class="btn btn-warning" onclick='loadExtCollectionForEdit("${d.id}", "${data.name}", "${data.type}", "${data.imageUrl||''}")'><i class="fas fa-edit"></i> تعديل</button> <button class="btn btn-danger" onclick="deleteExtCollection('${d.id}', '${data.name}')"><i class="fas fa-trash"></i> حذف</button></td></tr>`;
        });
        if(document.getElementById('tb-ext-collections')) document.getElementById('tb-ext-collections').innerHTML = html;
    });

    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let invHtml = "", posProdHtml = "<option value=''>-- اختر المنتج --</option>";
        s.forEach(d => { 
            const p = d.data(); const imgSrc = p.img ? `<img src="${p.img}" class="img-preview" style="width:40px; border-radius:4px;">` : 'بدون'; 
            invHtml += `<tr><td>${imgSrc}</td><td>${p.name}</td><td><span class="badge">${p.type}</span></td><td dir="ltr">${p.qty}</td><td dir="ltr">${p.price}</td><td style="display:flex; gap:5px; justify-content:center;"><button class="btn btn-warning" onclick='loadProductForEdit("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-edit"></i></button><button class="btn btn-danger" onclick='softDeleteProduct("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-trash"></i></button></td></tr>`; 
            if (p.qty > 0) posProdHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`; 
        });
        document.getElementById('tb-inv').innerHTML = invHtml; document.getElementById('pos-product').innerHTML = posProdHtml;
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", tbLab = "", tbUnified = "", totalSales = 0, totalProfits = 0;
        let posPatientHtml = "<option value=''>-- اختر المراجع --</option>";

        s.forEach(d => { 
            const i = d.data(); 
            if (i.time?.toDate().toDateString() === new Date().toDateString()) { totalSales += Number(i.total); totalProfits += Number(i.paid); } 
            
            if (!i.isUnified) {
                tbInvoices += `<tr><td dir="ltr">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td dir="ltr" style="font-weight:bold; color:var(--primary);">${parseFloat(i.total).toFixed(2)}</td><td dir="ltr" style="color:var(--danger); font-weight:bold;">${parseFloat(i.due).toFixed(2)}</td></tr>`; 
            }

            if (i.labStatus !== 'تم التسليم') {
                tbLab += `<tr><td dir="ltr">${i.invId}</td><td style="font-weight:bold;">${i.pName}</td><td>${i.prodName}</td><td><select onchange="updateLabStatus('${d.id}', this.value)"><option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option><option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option><option value="تم التسليم">تسليم</option></select></td></tr>`; 
            }

            if (i.isUnified && i.rx) {
                const dateStr = i.time?.toDate().toLocaleDateString('en-GB') || '--';
                tbUnified += `<tr>
                    <td dir="ltr">${i.invId}</td>
                    <td style="font-weight:bold;">${i.pName}</td>
                    <td><span class="badge" style="background:#e2e8f0; color:#333;">${i.doctor || 'موظف'}</span></td>
                    <td dir="ltr">${dateStr}</td>
                    <td style="color:var(--primary); font-weight:bold; font-family:monospace; font-size:1.1rem;" dir="ltr">${parseFloat(i.total).toFixed(2)} JOD</td>
                    <td><button class="btn btn-dark" onclick='printFromData(${JSON.stringify(i).replace(/'/g, "\\'")})'><i class="fas fa-print"></i> أرشيف</button></td>
                </tr>`;
                posPatientHtml += `<option value="${d.id}">${i.pName}</option>`;
            }
        });
        
        document.getElementById('tb-invc').innerHTML = tbInvoices; 
        document.getElementById('tb-lab').innerHTML = tbLab; 
        if(document.getElementById('tb-unified-rx')) document.getElementById('tb-unified-rx').innerHTML = tbUnified;
        if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = posPatientHtml;
        document.getElementById('kpi-sales').innerText = totalSales.toFixed(2) + " JOD"; 
        if (document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalProfits.toFixed(2) + " JOD";
    });

    onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(10)), (s) => {
        if(document.getElementById('live-activity-feed')) document.getElementById('live-activity-feed').innerHTML = s.docs.map(d => `<div class="activity-item"><strong>${d.data().user}</strong>: ${d.data().action} <br><small style="color:var(--warning)" dir="ltr">${d.data().time?.toDate().toLocaleTimeString()}</small></div>`).join('');
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
                const statusBtn = d.data().status === 'frozen' ? `<button class="btn btn-success" onclick="toggleUserFreeze('${d.id}', 'frozen')">فك التجميد</button>` : `<button class="btn btn-warning" onclick="toggleUserFreeze('${d.id}', 'active')">تجميد (Kill)</button>`;
                return `<tr><td>${d.data().name}</td><td dir="ltr">${d.data().user}</td><td><span class="badge">${d.data().role}</span></td><td>${d.data().status==='frozen'?'<span style="color:red">مجمد</span>':'نشط'}</td><td>${statusBtn} <button class="btn btn-danger" onclick="deleteUserAccount('${d.id}')">حذف</button></td></tr>`;
            }).join('');
        });
        onSnapshot(query(collection(db, "stealth_logs"), orderBy("time", "desc")), (s) => { if (document.getElementById('tb-secret-audit')) document.getElementById('tb-secret-audit').innerHTML = s.docs.map(d => `<tr><td>${d.data().user}</td><td>${d.data().device||'--'}</td><td>${d.data().action}</td><td dir="ltr">${d.data().time?.toDate().toLocaleString()}</td></tr>`).join(''); });
        onSnapshot(query(collection(db, "recycle_bin"), orderBy("deletedAt", "desc")), (s) => { if (document.getElementById('tb-recycle')) document.getElementById('tb-recycle').innerHTML = s.docs.map(d => { const p = d.data(); return `<tr><td>${p.name}</td><td>${p.deletedBy}</td><td><button class="btn btn-success" onclick='restoreProduct("${d.id}", ${JSON.stringify(p)})'>استرجاع</button></td></tr>`; }).join(''); });
    }
}
