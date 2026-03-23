// app.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc, updateDoc } from './config.js';
import { Auth } from './auth.js';

// خوارزمية ضغط الصور (عشان ما تعتمد على Storage وتختفي الصور)
window.compressImage = (fileInputId, previewId, base64Id) => {
    const file = document.getElementById(fileInputId).files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 600; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const b64 = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById(previewId).src = b64;
            document.getElementById(base64Id).value = b64;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

// 1. المخزون (Inventory)
window.saveProduct = async () => {
    const n = document.getElementById('p-name').value, p = document.getElementById('p-price').value, t = document.getElementById('p-type').value, q = document.getElementById('p-qty').value, img = document.getElementById('p-base64').value;
    if(!n || !p || !img) return Swal.fire('خطأ', 'أكمل البيانات وارفع الصورة', 'error');
    await addDoc(collection(db, "products"), { name: n, price: Number(p), type: t, qty: Number(q), img: img, time: serverTimestamp() });
    Auth.logAudit(`إضافة منتج للمخزون: ${n}`);
    Swal.fire('تم', 'تم نشر المنتج عالموقع بنجاح', 'success');
    document.getElementById('modal-product').classList.remove('active');
};

window.deleteProduct = async (id, name) => {
    if(confirm('هل أنت متأكد من حذف المنتج؟')) {
        await deleteDoc(doc(db, "products", id));
        Auth.logAudit(`حذف منتج: ${name}`);
    }
};

// 2. فحص النظر (Rx) مع واتساب
window.saveRx = async () => {
    const name = document.getElementById('rx-name').value, phone = document.getElementById('rx-phone').value;
    if(!name) return Swal.fire('خطأ', 'اسم المراجع مطلوب', 'error');
    const rxData = {
        name, phone,
        od: { s: document.getElementById('od-s').value, c: document.getElementById('od-c').value, a: document.getElementById('od-a').value, add: document.getElementById('od-add').value },
        os: { s: document.getElementById('os-s').value, c: document.getElementById('os-c').value, a: document.getElementById('os-a').value, add: document.getElementById('os-add').value },
        pd: document.getElementById('rx-pd').value, notes: document.getElementById('rx-notes').value, time: serverTimestamp(), doctor: Auth.user.name
    };
    await addDoc(collection(db, "rx_records"), rxData);
    Auth.logAudit(`فحص مراجع جديد: ${name}`);
    Swal.fire('تم', 'تم حفظ الفحص الطبي', 'success');
};

window.sendWhatsApp = (phone) => {
    if(!phone) return Swal.fire('تنبيه', 'لا يوجد رقم هاتف مسجل', 'warning');
    window.open(`https://wa.me/962${phone.replace(/^0+/, '')}`, '_blank');
};

// 3. المبيعات (POS) وطباعة الفاتورة
window.updatePosPrice = () => {
    const sel = document.getElementById('pos-product');
    document.getElementById('pos-total').value = sel.options[sel.selectedIndex]?.dataset.price || 0;
    window.calcDue();
};
window.calcDue = () => { document.getElementById('pos-due').value = (Number(document.getElementById('pos-total').value) - Number(document.getElementById('pos-paid').value)).toFixed(2); };

window.createInvoice = async () => {
    const pName = document.getElementById('pos-patient').options[document.getElementById('pos-patient').selectedIndex]?.text;
    const prod = document.getElementById('pos-product');
    const prodName = prod.options[prod.selectedIndex]?.text;
    const total = document.getElementById('pos-total').value, paid = document.getElementById('pos-paid').value, due = document.getElementById('pos-due').value;
    
    if(!pName || !prodName) return Swal.fire('خطأ', 'اختر المراجع والمنتج', 'error');
    
    const invId = 'INV-' + Math.floor(1000 + Math.random() * 9000);
    await addDoc(collection(db, "invoices"), { invId, pName, prodName, total, paid, due, time: serverTimestamp(), labStatus: 'قيد التجهيز' });
    
    // خفض الكمية
    const currentQty = Number(prod.options[prod.selectedIndex].dataset.qty);
    if(currentQty > 0) await updateDoc(doc(db, "products", prod.value), { qty: currentQty - 1 });

    Auth.logAudit(`إصدار فاتورة: ${invId}`);
    
    // الطباعة (PDF/Print)
    document.getElementById('pr-id').innerText = invId; document.getElementById('pr-pat').innerText = pName; document.getElementById('pr-prod').innerText = prodName; document.getElementById('pr-tot').innerText = total; document.getElementById('pr-due').innerText = due;
    window.print();
};

// 4. التحكم بالموقع الرئيسي (CMS)
window.saveCMS = async () => {
    const data = {
        topbar: document.getElementById('cms-topbar').value,
        phone: document.getElementById('cms-phone').value,
        hero: document.getElementById('cms-hero').value,
        sub: document.getElementById('cms-sub').value,
    };
    await setDoc(doc(db, "cms_settings", "website"), data);
    Auth.logAudit("تعديل واجهة الموقع الرئيسية");
    Swal.fire('تم', 'تم تحديث الموقع الرئيسي للزبائن', 'success');
};

// 5. الموظفين
window.saveStaff = async () => {
    const name = document.getElementById('s-name').value, username = document.getElementById('s-user').value, password = document.getElementById('s-pass').value, role = document.getElementById('s-role').value;
    await addDoc(collection(db, "users"), { name, username, password, role, time: serverTimestamp() });
    Auth.logAudit(`إضافة موظف: ${name}`);
    Swal.fire('تم', 'تم إضافة الموظف', 'success');
};

// 6. الشات الداخلي
window.sendChat = async () => {
    const text = document.getElementById('chat-input').value;
    if(text) { await addDoc(collection(db, "chat"), { sender: Auth.user.name, text, time: serverTimestamp() }); document.getElementById('chat-input').value = ""; }
};

// المزامنة الحية للبيانات
export function startLiveSync() {
    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let tb = "", opt = "<option value=''>-- اختر منتج --</option>";
        s.forEach(d => { const p = d.data(); tb += `<tr><td><img src="${p.img}" width="40" style="border-radius:4px;"></td><td>${p.name}</td><td>${p.type}</td><td>${p.qty}</td><td>${p.price}</td><td><button class="btn-danger" onclick="deleteProduct('${d.id}', '${p.name}')">حذف</button></td></tr>`; opt += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name} (${p.price} JOD)</option>`; });
        if(document.getElementById('tb-inv')) document.getElementById('tb-inv').innerHTML = tb;
        if(document.getElementById('pos-product')) document.getElementById('pos-product').innerHTML = opt;
    });

    onSnapshot(query(collection(db, "rx_records"), orderBy("time", "desc")), (s) => {
        let tb = "", opt = "<option value=''>-- اختر مراجع --</option>";
        s.forEach(d => { const r = d.data(); tb += `<tr><td>${r.name}</td><td>${r.phone}</td><td dir="ltr">OD: ${r.od.s} | OS: ${r.os.s}</td><td>${r.time?.toDate().toLocaleDateString('ar-EG')}</td><td><button class="btn-success" onclick="sendWhatsApp('${r.phone}')"><i class="fab fa-whatsapp"></i></button></td></tr>`; opt += `<option value="${d.id}">${r.name}</option>`; });
        if(document.getElementById('tb-rx')) document.getElementById('tb-rx').innerHTML = tb;
        if(document.getElementById('pos-patient')) document.getElementById('pos-patient').innerHTML = opt;
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tb = ""; let todaySales = 0;
        s.forEach(d => { 
            const i = d.data(); 
            tb += `<tr><td>${i.invId}</td><td>${i.pName}</td><td>${i.total}</td><td style="color:var(--danger)">${i.due}</td><td><span class="badge" style="background:var(--warning); color:black;">${i.labStatus}</span></td></tr>`; 
            if(i.time?.toDate().toDateString() === new Date().toDateString()) todaySales += Number(i.total);
        });
        if(document.getElementById('tb-invc')) document.getElementById('tb-invc').innerHTML = tb;
        if(document.getElementById('kpi-sales')) document.getElementById('kpi-sales').innerText = todaySales + " JOD";
    });

    onSnapshot(query(collection(db, "chat"), orderBy("time", "asc")), (s) => {
        let chatHtml = "";
        s.forEach(d => { const c = d.data(); chatHtml += `<div style="background:#f1f5f9; padding:10px; border-radius:8px; margin-bottom:10px;"><strong>${c.sender}:</strong> ${c.text}</div>`; });
        if(document.getElementById('chat-box')) { document.getElementById('chat-box').innerHTML = chatHtml; document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight; }
    });

    if(Auth.user.role === 'superadmin') {
        onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc")), (s) => {
            if(document.getElementById('tb-audit')) document.getElementById('tb-audit').innerHTML = s.docs.map(d => `<tr><td>${d.data().user}</td><td>${d.data().action}</td><td dir="ltr">${d.data().time?.toDate().toLocaleString()}</td></tr>`).join('');
        });
        onSnapshot(doc(db, "cms_settings", "website"), (d) => {
            if(d.exists()) { const c = d.data(); document.getElementById('cms-topbar').value = c.topbar; document.getElementById('cms-phone').value = c.phone; document.getElementById('cms-hero').value = c.hero; document.getElementById('cms-sub').value = c.sub; }
        });
    }
}
