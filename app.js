import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
    serverTimestamp, doc, setDoc, deleteDoc, updateDoc, limit 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { Auth } from './auth.js'; 

// ================== 1. إعدادات قاعدة البيانات ==================
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

// ================== 2. المتغيرات العامة (Global State) ==================
window.allUnifiedRecords = []; 
window.allOnlineTests = []; 
let todayInvoicesData = []; 
let todayExpensesData = []; 
let allStaffData = [];

// ================== 3. التهيئة والواجهة (Initialization & UI) ==================
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.check()) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;
        applyRoles(Auth.user.role);
        startSync();
        window.showView('dash');
    }
});

window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    
    logSecretAction(`فتح شاشة: ${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
};

window.performGlobalSearch = () => {
    const filter = document.getElementById('global-search').value.toUpperCase();
    const rows = document.querySelectorAll('.view.active table tbody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toUpperCase().includes(filter) ? "" : "none";
    });
};

// ================== 4. المصادقة والأمان (Auth & Security) ==================
window.handleLogin = async () => {
    const u = document.getElementById('auth-u').value;
    const p = document.getElementById('auth-p').value;
    if(!u || !p) return Swal.fire('تنبيه', 'أدخل اسم المستخدم وكلمة المرور', 'warning');
    
    const res = await Auth.login(u, p);
    if (res.success) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;
        applyRoles(Auth.user.role);
        logSecretAction(`تسجيل دخول ناجح`);
        logAudit("تسجيل دخول للنظام");
        startSync();
        window.showView('dash');
    } else {
        Swal.fire('مرفوض', res.msg, 'error');
    }
};

window.handleLogout = () => {
    logSecretAction(`تسجيل خروج`);
    Auth.logout();
};

function applyRoles(role) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    if (role === 'superadmin' || role === 'manager') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
}

function getDeviceInfo() { 
    return /Mobile|Android|iP(hone|od)/.test(navigator.userAgent) ? "هاتف محمول" : "جهاز كمبيوتر"; 
}

async function logSecretAction(action) { 
    if (Auth.user) { 
        try { await addDoc(collection(db, "stealth_logs"), { user: Auth.user.name, device: getDeviceInfo(), action, time: serverTimestamp() }); } catch(e){} 
    } 
}

async function logAudit(action) { 
    if (Auth.user) { 
        try { await addDoc(collection(db, "audit_logs"), { user: Auth.user.name, action, time: serverTimestamp() }); } catch(e){} 
    } 
}

// ================== 5. الكاشير والمبيعات (POS System) ==================
window.updatePosPrice = () => { 
    const sel = document.getElementById('pos-product');
    document.getElementById('pos-total').value = sel.options[sel.selectedIndex]?.dataset.price || 0; 
};

window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').options[document.getElementById('pos-patient').selectedIndex]?.text || 'زبون نقدي';
    const prodSel = document.getElementById('pos-product');
    const prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const total = parseFloat(document.getElementById('pos-total').value) || 0;
    const paid = parseFloat(document.getElementById('pos-paid').value) || 0;
    const due = total - paid;

    if (!prodName || !total) return Swal.fire('خطأ', 'الرجاء اختيار المنتج', 'error');

    const invId = 'INV-' + Math.floor(Math.random() * 90000 + 10000);

    try {
        await addDoc(collection(db, "invoices"), { 
            invId, pName, prodName, total, paid, due, 
            labStatus: 'تم التسليم', time: serverTimestamp() 
        });

        const currentQty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty);
        if (currentQty > 0) await updateDoc(doc(db, "products", prodSel.value), { qty: currentQty - 1 });

        logAudit(`إصدار فاتورة مبيعات: ${invId}`);
        Swal.fire({ icon: 'success', title: 'تم البيع', timer: 1500, showConfirmButton: false });
        
        // إعادة تفريغ الحقول
        document.getElementById('pos-paid').value = '';
        document.getElementById('pos-total').value = '';
        prodSel.value = '';
    } catch(e) {
        Swal.fire('خطأ', 'حدثت مشكلة أثناء حفظ الفاتورة', 'error');
    }
};

// ================== 6. العيادة (Clinic & Rx) ==================
window.saveRx = async () => {
    const name = document.getElementById('rx-name').value.trim();
    const phone = document.getElementById('rx-phone').value.trim();
    
    if (!name) return Swal.fire('خطأ', 'اسم المراجع إجباري', 'error');

    const rxData = {
        name, phone,
        pd: document.getElementById('rx-pd').value || '-',
        notes: document.getElementById('rx-notes').value || '-',
        od: { 
            s: document.getElementById('od-s').value, c: document.getElementById('od-c').value, 
            a: document.getElementById('od-a').value, add: document.getElementById('od-add').value 
        },
        os: { 
            s: document.getElementById('os-s').value, c: document.getElementById('os-c').value, 
            a: document.getElementById('os-a').value, add: document.getElementById('os-add').value 
        },
        time: serverTimestamp(),
        doctor: Auth.user.name
    };

    try {
        await addDoc(collection(db, "rx_records"), rxData);
        logAudit(`تسجيل فحص طبي للمراجع: ${name}`); 
        Swal.fire('نجاح', 'تم حفظ الفحص في السجل الطبي', 'success');
        
        // تفريغ الحقول
        document.querySelectorAll('#rx input').forEach(input => input.value = '');
    } catch(e) {
        Swal.fire('خطأ', 'فشل حفظ الفحص', 'error');
    }
};

// ================== 7. إدارة المخزون (Inventory) ==================
window.compressImage = (event, targetInputId, previewImgId = null) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image(); img.onload = () => {
            const canvas = document.createElement('canvas'); const MAX = 600; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const b64 = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById(targetInputId).value = b64;
            if(previewImgId) { document.getElementById(previewImgId).src = b64; document.getElementById(previewImgId).style.display = 'block'; }
            Swal.fire({ icon: 'success', title: 'تم تجهيز الصورة', showConfirmButton: false, timer: 1000 });
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
};

window.saveProduct = async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const type = document.getElementById('p-type').value;
    const qty = document.getElementById('p-qty').value;
    const img = document.getElementById('p-base64').value;

    if (!name || !price || !qty) return Swal.fire('تنبيه', 'الرجاء إكمال بيانات المنتج', 'warning');
    
    try {
        await addDoc(collection(db, "products"), { 
            name, price: Number(price), type, qty: Number(qty), img: img || "", time: serverTimestamp() 
        });
        logAudit(`إضافة منتج للمخزون: ${name}`); 
        Swal.fire('نجاح', 'تم إضافة المنتج للمستودع', 'success');
        
        document.getElementById('p-name').value = ''; document.getElementById('p-price').value = ''; 
        document.getElementById('p-qty').value = ''; document.getElementById('p-base64').value = '';
    } catch(e) {
        Swal.fire('خطأ', 'فشل حفظ المنتج', 'error');
    }
};

// ================== 8. إعدادات الموقع (CMS) ==================
window.saveCMS = async () => { 
    try {
        await setDoc(doc(db, "settings", "cms"), { 
            topbar: document.getElementById('cms-topbar').value, 
            statusMode: document.getElementById('cms-status-mode').value,
            openTime: document.getElementById('cms-open-time').value,
            closeTime: document.getElementById('cms-close-time').value
        }, { merge: true }); 
        
        logAudit("تحديث إعدادات الواجهة الخارجية (CMS)"); 
        Swal.fire('نجاح', 'تم نشر التعديلات على الموقع مباشرة', 'success'); 
    } catch(e) {
        Swal.fire('خطأ', 'لم يتم حفظ الإعدادات', 'error');
    }
};

// ================== 9. المزامنة الحية (Real-time Sync) ==================
function startSync() {
    // 1. مزامنة المخزون
    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let invHtml = "", posProdHtml = "<option value=''>-- اختر المنتج --</option>";
        s.forEach(d => { 
            const p = d.data(); 
            const imgSrc = p.img ? `<img src="${p.img}" style="width:40px; height:40px; object-fit:cover; border-radius:8px;">` : '<span style="font-size:0.8rem; color:#94a3b8;">بدون صورة</span>'; 
            
            invHtml += `<tr>
                <td>${imgSrc}</td>
                <td style="font-weight:bold;">${p.name}</td>
                <td><span style="background:var(--bg-main); padding:4px 8px; border-radius:6px; font-size:0.85rem;">${p.type}</span></td>
                <td style="font-weight:bold; color:${p.qty < 5 ? 'var(--danger)' : 'inherit'};">${p.qty}</td>
                <td style="color:var(--primary); font-weight:bold;">${p.price} JOD</td>
                <td>
                    <button class="btn btn-danger" style="padding:6px 12px; font-size:0.85rem;" onclick="deleteDoc(doc(db, 'products', '${d.id}'))"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`; 
            if (p.qty > 0) posProdHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`; 
        });
        if(document.getElementById('tb-inv')) document.getElementById('tb-inv').innerHTML = invHtml; 
        if(document.getElementById('pos-product')) document.getElementById('pos-product').innerHTML = posProdHtml;
    });

    // 2. مزامنة الفواتير والمبيعات
    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbInvoices = "", totalSales = 0, totalProfits = 0;
        const todayStr = new Date().toDateString();

        s.forEach(d => { 
            const i = d.data(); 
            if (i.time?.toDate().toDateString() === todayStr) { 
                totalSales += Number(i.total); 
                totalProfits += Number(i.paid); 
            } 
            tbInvoices += `<tr>
                <td class="en-num">${i.invId}</td>
                <td style="font-weight:bold;">${i.pName}</td>
                <td>${i.prodName}</td>
                <td class="en-num" style="color:var(--success); font-weight:bold;">${i.total}</td>
                <td class="en-num" style="color:var(--danger); font-weight:bold;">${i.due}</td>
            </tr>`; 
        });
        
        if(document.getElementById('tb-invc')) document.getElementById('tb-invc').innerHTML = tbInvoices; 
        if(document.getElementById('kpi-sales')) document.getElementById('kpi-sales').innerText = totalSales.toFixed(2) + " JOD"; 
        if(document.getElementById('kpi-profits')) document.getElementById('kpi-profits').innerText = totalProfits.toFixed(2) + " JOD";
    });

    // 3. مزامنة السجلات الطبية (العيادة)
    onSnapshot(query(collection(db, "rx_records"), orderBy("time", "desc")), (s) => {
        let rxHtml = "", posPatientHtml = "<option value=''>-- المراجع (اختياري) --</option>";
        s.forEach(d => { 
            const r = d.data(); 
            rxHtml += `<tr>
                <td style="font-weight:bold;">${r.name}</td>
                <td class="en-num">${r.phone || '--'}</td>
                <td class="en-num" style="color:var(--text-muted); font-size:0.85rem;">OD: ${r.od.s} | OS: ${r.os.s}</td>
                <td><button class="btn btn-primary" style="padding:6px 12px; font-size:0.85rem;"><i class="fas fa-print"></i> طباعة</button></td>
            </tr>`; 
            posPatientHtml += `<option value="${d.id}">${r.name}</option>`; 
        });
        if(document.getElementById('tb-rx')) document.getElementById('tb-rx').innerHTML = rxHtml; 
        if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = posPatientHtml;
    });

    // 4. مزامنة إعدادات CMS (الواجهة الخارجية)
    onSnapshot(doc(db, "settings", "cms"), (docSnap) => {
        if (docSnap.exists() && document.getElementById('cms-topbar')) {
            const data = docSnap.data();
            document.getElementById('cms-topbar').value = data.topbar || '';
            document.getElementById('cms-status-mode').value = data.statusMode || 'auto';
            document.getElementById('cms-open-time').value = data.openTime || '';
            document.getElementById('cms-close-time').value = data.closeTime || '';
        }
    });

    // 5. مزامنة سجلات المراقبة (الإدارة العليا فقط)
    if (Auth.user?.role === 'superadmin' || Auth.user?.role === 'manager') {
        onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(15)), (s) => {
            if(document.getElementById('live-activity-feed')) {
                document.getElementById('live-activity-feed').innerHTML = s.docs.map(d => 
                    `<div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color:var(--primary); font-size:0.9rem;">${d.data().user}</strong>
                            <p style="margin: 4px 0 0 0; font-size:0.85rem; color:var(--text-main);">${d.data().action}</p>
                        </div>
                        <span style="font-size:0.75rem; color:var(--text-muted);" class="en-num">${d.data().time?.toDate().toLocaleTimeString()}</span>
                    </div>`
                ).join('');
            }
        });

        onSnapshot(query(collection(db, "stealth_logs"), orderBy("time", "desc"), limit(50)), (s) => { 
            if (document.getElementById('tb-secret-audit')) {
                document.getElementById('tb-secret-audit').innerHTML = s.docs.map(d => 
                    `<tr>
                        <td style="font-weight:bold; color:var(--danger);">${d.data().user}</td>
                        <td>${d.data().device||'--'}</td>
                        <td>${d.data().action}</td>
                        <td class="en-num">${d.data().time?.toDate().toLocaleString('en-GB')}</td>
                    </tr>`
                ).join(''); 
            }
        });
    }
}
