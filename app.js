import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { Auth } from './auth.js'; 

// إعدادات قاعدة بياناتك (Firebase Config)
const firebaseConfig = {
  apiKey: "AIzaSyB11C4GGgAyqeThs8a9cvDNN7frvAA1nqQ",
  authDomain: "delta-optics-system.firebaseapp.com",
  projectId: "delta-optics-system",
  storageBucket: "delta-optics-system.firebasestorage.app",
  messagingSenderId: "111176219224",
  appId: "1:111176219224:web:e0d8a5f26b84d57249a82d"
};

// تشغيل النظام والاتصال بالقاعدة
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================== دوال أساسية وأمان ==================
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

// ================== الميزات المتقدمة (البحث، ليلي، تصدير) ==================
window.toggleDarkMode = () => { document.body.classList.toggle('dark-mode'); };

window.performGlobalSearch = () => {
    const filter = document.getElementById('global-search').value.toUpperCase();
    const trs = document.querySelectorAll('.active table tbody tr'); 
    trs.forEach(tr => {
        const text = tr.innerText.toUpperCase();
        tr.style.display = text.includes(filter) ? "" : "none";
    });
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
    logAudit(`قام بتصدير بيانات الجدول: ${filename}`);
};

// ================== تسجيل الدخول ==================
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

// ================== ضغط الصور المتطور ==================
window.compressImage = (event, targetInputId, previewImgId = null) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image(); img.onload = () => {
            const canvas = document.createElement('canvas'); const MAX = 600; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const b64 = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById(targetInputId).value = b64;
            if(previewImgId) { document.getElementById(previewImgId).src = b64; document.getElementById(previewImgId).style.display = 'block'; }
            Swal.fire({ icon: 'success', title: 'تم تجهيز الصورة بنجاح', showConfirmButton: false, timer: 1000 });
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
};

// ================== العمليات اليومية وإدارة المنتجات ==================
window.updatePosPrice = () => { document.getElementById('pos-total').value = document.getElementById('pos-product').options[document.getElementById('pos-product').selectedIndex]?.dataset.price || 0; };
window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').options[document.getElementById('pos-patient').selectedIndex]?.text, prodSel = document.getElementById('pos-product'), prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const total = document.getElementById('pos-total').value, paid = document.getElementById('pos-paid').value, due = total - paid;
    if (!pName || !prodName || !total) return Swal.fire('خطأ', 'أكمل الفاتورة', 'error');
    const invId = 'INV-' + Math.floor(Math.random() * 9000 + 1000);
    await addDoc(collection(db, "invoices"), { invId, pName, prodName, total: Number(total), paid: Number(paid), due: Number(due), labStatus: 'انتظار', time: serverTimestamp() });
    const currentQty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty);
    if (currentQty > 0) await updateDoc(doc(db, "products", prodSel.value), { qty: currentQty - 1 });
    logAudit(`إصدار فاتورة: ${invId}`);
    document.getElementById('pr-title').innerText = "فاتورة مبيعات";
    document.getElementById('pr-content').innerHTML = `<p>رقم الفاتورة: ${invId} | التاريخ: ${new Date().toLocaleDateString()}</p><hr><p>المراجع: ${pName} | المنتج: ${prodName}</p><hr><h3>الإجمالي: ${total} JOD</h3><p>المدفوع: ${paid} JOD | المتبقي: ${due} JOD</p>`;
    window.print();
};

window.saveRx = async () => {
    const name = document.getElementById('rx-name').value, phone = document.getElementById('rx-phone').value;
    if (!name) return Swal.fire('خطأ', 'الاسم إجباري', 'error');
    await addDoc(collection(db, "rx_records"), { name, phone, pd: document.getElementById('rx-pd').value, notes: document.getElementById('rx-notes').value, od: { s: document.getElementById('od-s').value, c: document.getElementById('od-c').value, a: document.getElementById('od-a').value, add: document.getElementById('od-add').value }, os: { s: document.getElementById('os-s').value, c: document.getElementById('os-c').value, a: document.getElementById('os-a').value, add: document.getElementById('os-add').value }, time: serverTimestamp(), doctor: Auth.user.name });
    logAudit(`تسجيل فحص: ${name}`); Swal.fire('نجاح', 'تم الحفظ', 'success');
};

// متغير عالمي لمعرفة إذا كنا بنعدل منتج موجود أو بنضيف جديد
let currentEditProductId = null;

window.loadProductForEdit = (id, dataObj) => {
    currentEditProductId = id;
    document.getElementById('p-name').value = dataObj.name;
    document.getElementById('p-price').value = dataObj.price;
    document.getElementById('p-qty').value = dataObj.qty;
    document.getElementById('p-type').value = dataObj.type;
    document.getElementById('p-base64').value = dataObj.img || "";
    Swal.fire({ icon: 'info', title: 'وضع التعديل', text: 'تم تجهيز البيانات، عدل واضغط حفظ للمستودع', timer: 2000, showConfirmButton: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.saveProduct = async () => {
    const name = document.getElementById('p-name').value, price = document.getElementById('p-price').value, type = document.getElementById('p-type').value, qty = document.getElementById('p-qty').value, img = document.getElementById('p-base64').value;
    if (!name || !price || !type) return Swal.fire('تنبيه', 'أكمل البيانات', 'warning');
    
    if (currentEditProductId) {
        // تحديث منتج موجود
        await updateDoc(doc(db, "products", currentEditProductId), { name, price: Number(price), type, qty: Number(qty), img: img || "" });
        logAudit(`تعديل منتج: ${name}`); Swal.fire('نجاح', 'تم التعديل بنجاح', 'success');
        currentEditProductId = null; // تفريغ بعد التعديل
    } else {
        // إضافة منتج جديد
        await addDoc(collection(db, "products"), { name, price: Number(price), type, qty: Number(qty), img: img || "", time: serverTimestamp() });
        logAudit(`إضافة منتج: ${name}`); Swal.fire('نجاح', 'تم الإضافة', 'success');
    }
    
    // تفريغ الحقول
    document.getElementById('p-name').value = ''; document.getElementById('p-price').value = ''; document.getElementById('p-qty').value = ''; document.getElementById('p-base64').value = '';
};

window.softDeleteProduct = async (id, data) => { if (confirm('نقل للمحذوفات؟')) { await addDoc(collection(db, "recycle_bin"), { ...data, deletedAt: serverTimestamp(), deletedBy: Auth.user.name }); await deleteDoc(doc(db, "products", id)); logAudit(`حذف منتج: ${data.name}`); } };
window.restoreProduct = async (id, data) => { await addDoc(collection(db, "products"), { name: data.name, price: data.price, type: data.type, qty: data.qty, img: data.img, time: serverTimestamp() }); await deleteDoc(doc(db, "recycle_bin", id)); logAudit(`استرجاع منتج: ${data.name}`); };

// ================== تشكيلات الموقع الخارجي (الصور والتعديل) ==================
window.resetExtColForm = () => {
    document.getElementById('ext-col-id').value = ""; document.getElementById('ext-col-name').value = ""; document.getElementById('ext-col-desc').value = ""; 
    document.getElementById('ext-col-base64').value = ""; document.getElementById('ext-col-preview').style.display = "none";
};
window.loadExtCollectionForEdit = (id, name, desc, img) => {
    document.getElementById('ext-col-id').value = id; document.getElementById('ext-col-name').value = name; document.getElementById('ext-col-desc').value = desc || ""; 
    document.getElementById('ext-col-base64').value = img || ""; 
    if(img) { document.getElementById('ext-col-preview').src = img; document.getElementById('ext-col-preview').style.display = "block"; }
    window.scrollTo({ top: 0, behavior: 'smooth' }); Swal.fire({ icon: 'info', title: 'وضع التعديل', text: 'قم بتغيير الصورة أو البيانات ثم اضغط حفظ', timer: 2000, showConfirmButton: false });
};
window.saveExtCollection = async () => {
    const id = document.getElementById('ext-col-id').value, name = document.getElementById('ext-col-name').value, desc = document.getElementById('ext-col-desc').value, img = document.getElementById('ext-col-base64').value;
    if (!name) return Swal.fire('تنبيه', 'الاسم إجباري', 'warning');
    if (id) { await updateDoc(doc(db, "ext_collections", id), { name, desc, img }); Swal.fire('تم', 'تم تحديث بيانات التشكيلة والصورة', 'success'); logAudit(`تحديث تشكيلة: ${name}`); } 
    else { await addDoc(collection(db, "ext_collections"), { name, desc, img, time: serverTimestamp() }); Swal.fire('تم', 'تم إضافة التشكيلة للموقع', 'success'); logAudit(`إضافة تشكيلة: ${name}`); }
    resetExtColForm();
};
window.deleteExtCollection = async (id, name) => { if (confirm(`حذف التشكيلة ${name} بصورتها نهائياً؟`)) { await deleteDoc(doc(db, "ext_collections", id)); logAudit(`حذف تشكيلة: ${name}`); } };

// ================== الحسابات (إضافة وتجميد) ==================
window.saveStaff = async () => { const name = document.getElementById('s-name').value, user = document.getElementById('s-user').value, pass = document.getElementById('s-pass').value, role = document.getElementById('s-role').value; await addDoc(collection(db, "users"), { name, user, pass, role, status: "active", time: serverTimestamp() }); logAudit(`إنشاء حساب: ${name}`); Swal.fire('نجاح', 'تم الحفظ', 'success'); };
window.changeUserPassword = async (id) => { const { value: newPass } = await Swal.fire({ title: 'الباسوورد الجديد', input: 'text' }); if (newPass) { await updateDoc(doc(db, "users", id), { pass: newPass }); Swal.fire('تم', 'تغير الباسوورد', 'success'); } };
window.toggleUserFreeze = async (id, currentStatus) => { const newStatus = currentStatus === "frozen" ? "active" : "frozen"; await updateDoc(doc(db, "users", id), { status: newStatus }); logAudit(`تغيير حالة حساب موظف إلى: ${newStatus}`); };
window.deleteUserAccount = async (id) => { if (confirm('حذف الحساب نهائياً؟')) await deleteDoc(doc(db, "users", id)); };

// ميزات أخرى
window.updateLabStatus = async (id, status) => { await updateDoc(doc(db, "invoices", id), { labStatus: status }); };
window.sendChat = async () => { const text = document.getElementById('chat-input').value; if (text) { await addDoc(collection(db, "chat"), { sender: Auth.user.name, text, time: serverTimestamp() }); document.getElementById('chat-input').value = ""; }};
window.saveCMS = async () => { await setDoc(doc(db, "settings", "cms"), { topbar: document.getElementById('cms-topbar').value, phone: document.getElementById('cms-phone').value, hero: document.getElementById('cms-hero').value, sub: document.getElementById('cms-sub').value }); logAudit("تحديث الموقع"); Swal.fire('نجاح', 'تم النشر', 'success'); };
window.processOnlineRx = async (id, name) => { await updateDoc(doc(db, "online_rx_requests"), { status: 'مكتمل' }); Swal.fire('تم', 'مراجعة الطلب', 'success'); logSecretAction(`عالج طلب أونلاين: ${name}`); };

// ================== المزامنة الحية الموحدة ==================
function startSync() {
    // التشكيلات (مع الصور)
    onSnapshot(query(collection(db, "ext_collections"), orderBy("time", "desc")), (s) => {
        let html = "", pTypeHtml = "<option value='طبي'>طبي (أساسي)</option><option value='شمسي'>شمسي (أساسي)</option>";
        s.forEach(d => {
            const data = d.data(); const imgSrc = data.img ? `<img src="${data.img}" class="img-preview">` : '<span class="badge">لا يوجد صورة</span>';
            html += `<tr><td>${imgSrc}</td><td>${data.name}</td><td>${data.desc || '--'}</td><td><button class="btn btn-warning" onclick='loadExtCollectionForEdit("${d.id}", "${data.name}", "${data.desc||''}", "${data.img||''}")'><i class="fas fa-edit"></i> تعديل</button> <button class="btn btn-danger" onclick="deleteExtCollection('${d.id}', '${data.name}')"><i class="fas fa-trash"></i> حذف</button></td></tr>`;
            pTypeHtml += `<option value="${data.name}">${data.name}</option>`;
        });
        if(document.getElementById('tb-ext-collections')) document.getElementById('tb-ext-collections').innerHTML = html;
        if(document.getElementById('p-type')) document.getElementById('p-type').innerHTML = pTypeHtml;
    });

    onSnapshot(query(collection(db, "rx_records"), orderBy("time", "desc")), (s) => {
        let rxHtml = "", posHtml = "<option value=''>-- اختر المراجع --</option>";
        s.forEach(d => { const r = d.data(); rxHtml += `<tr><td>${r.name}</td><td dir="ltr">${r.phone}</td><td dir="ltr">OD: ${r.od.s} | OS: ${r.os.s}</td><td><button class="btn btn-dark" onclick="console.log('طباعة')"><i class="fas fa-print"></i></button></td></tr>`; posHtml += `<option value="${d.id}">${r.name}</option>`; });
        document.getElementById('tb-rx').innerHTML = rxHtml; document.getElementById('pos-patient').innerHTML = posHtml;
    });

    // سحب المنتجات (المخزون) مع إضافة زر التعديل
    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let invHtml = "", posProdHtml = "<option value=''>-- اختر المنتج --</option>";
        s.forEach(d => { 
            const p = d.data(); 
            const imgSrc = p.img ? `<img src="${p.img}" class="img-preview" style="width:40px; border-radius:4px;">` : 'بدون'; 
            // تم إضافة زر التعديل هنا بجانب زر الحذف
            invHtml += `<tr>
                <td>${imgSrc}</td>
                <td>${p.name}</td>
                <td><span class="badge">${p.type}</span></td>
                <td>${p.qty}</td>
                <td>${p.price}</td>
                <td style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn btn-warning" onclick='loadProductForEdit("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" onclick='softDeleteProduct("${d.id}", ${JSON.stringify(p).replace(/'/g, "\\'")})'><i class="fas fa-trash"></i></button>
                </td>
            </tr>`; 
            if (p.qty > 0) posProdHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`; 
        });
        document.getElementById('tb-inv').innerHTML = invHtml; 
        document.getElementById('pos-product').innerHTML = posProdHtml;
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", tbLab = "", totalSales = 0, totalProfits = 0;
        s.forEach(d => { const i = d.data(); if (i.time?.toDate().toDateString() === new Date().toDateString()) { totalSales += Number(i.total); totalProfits += Number(i.paid); } tbInvoices += `<tr><td>${i.invId}</td><td>${i.pName}</td><td>${i.prodName}</td><td>${i.total}</td><td style="color:var(--danger)">${i.due}</td></tr>`; if (i.labStatus !== 'تم التسليم') tbLab += `<tr><td>${i.invId}</td><td>${i.pName}</td><td>${i.prodName}</td><td><select onchange="updateLabStatus('${d.id}', this.value)"><option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option><option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option><option value="تم التسليم">تسليم</option></select></td></tr>`; });
        document.getElementById('tb-invc').innerHTML = tbInvoices; document.getElementById('tb-lab').innerHTML = tbLab; document.getElementById('kpi-sales').innerText = totalSales + " JOD"; if (document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalProfits + " JOD";
    });

    // النشاط الحي بالداشبورد
    onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(10)), (s) => {
        if(document.getElementById('live-activity-feed')) {
            document.getElementById('live-activity-feed').innerHTML = s.docs.map(d => `<div class="activity-item"><strong>${d.data().user}</strong>: ${d.data().action} <br><small style="color:var(--warning)">${d.data().time?.toDate().toLocaleTimeString()}</small></div>`).join('');
        }
    });

    if (Auth.user?.role === 'superadmin') {
        onSnapshot(collection(db, "users"), (s) => {
            if (document.getElementById('tb-staff')) document.getElementById('tb-staff').innerHTML = s.docs.map(d => {
                const statusBtn = d.data().status === 'frozen' ? `<button class="btn btn-success" onclick="toggleUserFreeze('${d.id}', 'frozen')">فك التجميد</button>` : `<button class="btn btn-warning" onclick="toggleUserFreeze('${d.id}', 'active')">تجميد (Kill)</button>`;
                return `<tr><td>${d.data().name}</td><td>${d.data().user}</td><td><span class="badge">${d.data().role}</span></td><td>${d.data().status==='frozen'?'<span style="color:red">مجمد</span>':'نشط'}</td><td>${statusBtn} <button class="btn btn-danger" onclick="deleteUserAccount('${d.id}')">حذف</button></td></tr>`;
            }).join('');
        });
        onSnapshot(query(collection(db, "stealth_logs"), orderBy("time", "desc")), (s) => { if (document.getElementById('tb-secret-audit')) document.getElementById('tb-secret-audit').innerHTML = s.docs.map(d => `<tr><td>${d.data().user}</td><td>${d.data().device||'--'}</td><td>${d.data().action}</td><td dir="ltr">${d.data().time?.toDate().toLocaleString()}</td></tr>`).join(''); });
        onSnapshot(query(collection(db, "recycle_bin"), orderBy("deletedAt", "desc")), (s) => { if (document.getElementById('tb-recycle')) document.getElementById('tb-recycle').innerHTML = s.docs.map(d => { const p = d.data(); return `<tr><td>${p.name}</td><td>${p.deletedBy}</td><td><button class="btn btn-success" onclick='restoreProduct("${d.id}", ${JSON.stringify(p)})'>استرجاع</button></td></tr>`; }).join(''); });
    }
}