import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let currentUser = { name: "غير مسجل", role: "employee" };

// تسجيل الدخول (محاكاة ذكية للسرعة)
window.handleLogin = () => {
    const u = document.getElementById('auth-u').value;
    const p = document.getElementById('auth-p').value;
    if(u && p) {
        currentUser = { name: u === "admin" ? "مهندس عادل" : u, role: u === "admin" ? "superadmin" : "employee" };
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = currentUser.name;
        if(currentUser.role === 'superadmin') document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        logAudit(`تسجيل دخول ناجح`);
        startSync();
    } else {
        Swal.fire('تنبيه', 'أدخل البيانات', 'warning');
    }
};

window.handleLogout = () => { location.reload(); };

// تسجيل المراقبة (Audit)
async function logAudit(action) {
    await addDoc(collection(db, "audit_logs"), { user: currentUser.name, action, time: serverTimestamp() });
}

// المبيعات (POS)
window.createInvoice = async () => {
    const prodSel = document.getElementById('pos-product');
    const prodName = prodSel.options[prodSel.selectedIndex]?.text;
    const total = document.getElementById('pos-total').value;
    const paid = document.getElementById('pos-paid').value || 0;
    
    if(!prodName || !total) return Swal.fire('خطأ', 'أكمل الفاتورة', 'error');
    
    const invId = 'INV-' + Math.floor(Math.random() * 9000 + 1000);
    await addDoc(collection(db, "invoices"), { invId, prodName, total: Number(total), paid: Number(paid), due: Number(total)-Number(paid), labStatus: 'انتظار', time: serverTimestamp() });
    
    // تقليل المخزون
    const prodId = prodSel.value;
    if(prodId) {
        const qty = Number(prodSel.options[prodSel.selectedIndex].dataset.qty);
        if(qty > 0) await updateDoc(doc(db, "products", prodId), { qty: qty - 1 });
    }
    
    logAudit(`إصدار فاتورة: ${invId}`);
    Swal.fire('تم', 'تم البيع', 'success');
    
    // الطباعة
    document.getElementById('print-area').style.display = 'block';
    document.getElementById('print-content').innerHTML = `<p>الفاتورة: ${invId}</p><p>المنتج: ${prodName}</p><h3>المبلغ: ${total} JOD</h3>`;
    window.print();
    document.getElementById('print-area').style.display = 'none';
};

// المخزون (Inventory)
window.saveProduct = async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const qty = document.getElementById('p-qty').value;
    const type = document.getElementById('p-type').value;
    
    if(!name || !price) return Swal.fire('خطأ', 'أكمل البيانات', 'error');
    await addDoc(collection(db, "products"), { name, price: Number(price), qty: Number(qty), type, time: serverTimestamp() });
    logAudit(`إضافة منتج: ${name}`);
    Swal.fire('تم', 'حفظ الصنف', 'success');
    document.getElementById('p-name').value = '';
};
window.deleteProduct = async (id, name) => {
    if(confirm('حذف نهائي؟')) { await deleteDoc(doc(db, "products", id)); logAudit(`حذف: ${name}`); }
};

// العيادة (RX)
window.saveRx = async () => {
    const name = document.getElementById('rx-name').value;
    if(!name) return;
    await addDoc(collection(db, "rx_records"), { name, phone: document.getElementById('rx-phone').value, time: serverTimestamp() });
    logAudit(`فحص للمراجع: ${name}`);
    Swal.fire('تم', 'حفظ الفحص', 'success');
};

// المختبر (Lab)
window.updateLabStatus = async (id, status) => { await updateDoc(doc(db, "invoices", id), { labStatus: status }); };

// الشات
window.sendChat = async () => {
    const t = document.getElementById('chat-input').value;
    if(t) { await addDoc(collection(db, "chat"), { sender: currentUser.name, text: t, time: serverTimestamp() }); document.getElementById('chat-input').value = ""; }
};

// الإدارة (CMS & Staff)
window.saveCMS = async () => { await setDoc(doc(db, "settings", "cms"), { topbar: document.getElementById('cms-topbar').value, open: document.getElementById('cms-open').value, close: document.getElementById('cms-close').value }); Swal.fire('تم', 'نشر التحديثات', 'success'); };
window.saveStaff = async () => { const n=document.getElementById('s-name').value, u=document.getElementById('s-user').value, p=document.getElementById('s-pass').value; if(n&&u) { await addDoc(collection(db, "users"), {name:n, user:u, pass:p, role:'employee'}); Swal.fire('تم','حفظ الموظف','success'); }};

// المزامنة الشاملة (Syncing All Modules)
function startSync() {
    const todayStr = new Date().toDateString();

    // 1. المبيعات
    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let h="", lab="", tSales=0;
        s.forEach(d => {
            const i = d.data();
            if(i.time && i.time.toDate().toDateString() === todayStr) tSales += i.total;
            h += `<tr class="border-b dark:border-slate-700"><td class="p-2">${i.invId}</td><td class="p-2">${i.prodName}</td><td class="p-2 text-primary font-bold">${i.total}</td><td class="p-2 text-red-500">${i.due}</td></tr>`;
            if(i.labStatus !== 'تسليم') {
                lab += `<tr class="border-b dark:border-slate-700"><td class="p-3">${i.invId}</td><td class="p-3">--</td><td class="p-3">${i.prodName}</td><td class="p-3"><select onchange="updateLabStatus('${d.id}', this.value)" class="bg-slate-100 dark:bg-slate-800 p-1 rounded outline-none"><option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option><option value="جاهز" ${i.labStatus==='جاهز'?'selected':''}>جاهز</option><option value="تسليم">تسليم</option></select></td></tr>`;
            }
        });
        document.getElementById('tb-invc').innerHTML = h;
        document.getElementById('tb-lab').innerHTML = lab;
        document.getElementById('kpi-sales').innerText = tSales + " JOD";
    });

    // 2. المخزون
    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let h="", pOpts="<option value=''>-- اختر المنتج --</option>", count=0;
        s.forEach(d => {
            const p = d.data(); count++;
            h += `<tr class="border-b dark:border-slate-700"><td class="p-3">${p.name}</td><td class="p-3 text-xs text-slate-400">${p.type}</td><td class="p-3 font-bold">${p.qty}</td><td class="p-3 text-primary">${p.price}</td><td class="p-3"><button onclick="deleteProduct('${d.id}', '${p.name}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td></tr>`;
            if(p.qty > 0) pOpts += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`;
        });
        document.getElementById('tb-inv').innerHTML = h;
        document.getElementById('pos-product').innerHTML = pOpts;
        document.getElementById('kpi-inv').innerText = count;
    });

    // 3. العيادة
    onSnapshot(query(collection(db, "rx_records"), orderBy("time", "desc")), (s) => {
        let h="", count=0;
        s.forEach(d => {
            const r = d.data(); if(r.time && r.time.toDate().toDateString() === todayStr) count++;
            h += `<tr class="border-b dark:border-slate-700"><td class="p-3 font-bold">${r.name}</td><td class="p-3 text-sm">${r.phone||'--'}</td><td class="p-3 text-xs text-slate-500">${r.time?r.time.toDate().toLocaleDateString():''}</td></tr>`;
        });
        document.getElementById('tb-rx').innerHTML = h;
        document.getElementById('kpi-rx').innerText = count;
    });

    // 4. الشات
    onSnapshot(query(collection(db, "chat"), orderBy("time", "asc")), (s) => {
        const cb = document.getElementById('chat-box');
        cb.innerHTML = s.docs.map(d => {
            const c = d.data(), isMe = c.sender === currentUser.name;
            return `<div class="flex flex-col ${isMe?'items-start':'items-end'}"><span class="text-[10px] text-slate-400 mb-1 mx-2">${c.sender}</span><div class="${isMe?'bg-primary text-white':'bg-slate-100 dark:bg-slate-800 dark:text-white'} px-4 py-2 rounded-2xl max-w-[80%] text-sm">${c.text}</div></div>`;
        }).join('');
        cb.scrollTop = cb.scrollHeight;
    });

    // 5. الإدارة (Audit, Staff, CMS)
    if(currentUser.role === 'superadmin') {
        onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc")), (s) => {
            document.getElementById('tb-audit').innerHTML = s.docs.map(d => `<tr class="border-b dark:border-slate-700"><td class="p-2">${d.data().user}</td><td class="p-2 text-xs text-slate-500">${d.data().action}</td><td class="p-2 text-xs" dir="ltr">${d.data().time?d.data().time.toDate().toLocaleString():''}</td></tr>`).join('');
        });
        onSnapshot(collection(db, "users"), (s) => {
            document.getElementById('tb-staff').innerHTML = s.docs.map(d => `<tr class="border-b dark:border-slate-700"><td class="p-2">${d.data().name}</td><td class="p-2">${d.data().user}</td><td class="p-2 text-xs">${d.data().role}</td></tr>`).join('');
        });
        onSnapshot(doc(db, "settings", "cms"), (d) => {
            if(d.exists()) { document.getElementById('cms-topbar').value = d.data().topbar||''; document.getElementById('cms-open').value = d.data().open||''; document.getElementById('cms-close').value = d.data().close||''; }
        });
    }
}
