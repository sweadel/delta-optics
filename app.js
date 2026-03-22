import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. نظام المخزون
export const Inventory = {
    async add(item) { return await addDoc(collection(db, "stock"), { ...item, date: serverTimestamp() }); },
    listen(cb) { onSnapshot(query(collection(db, "stock")), (s) => cb(s.docs.map(d => ({id:d.id, ...d.data()})))); }
};

// 2. نظام مبيعات وفواتير POS
export const POS = {
    async sell(invoice) {
        const id = await addDoc(collection(db, "sales"), { ...invoice, date: serverTimestamp() });
        // تقليل الكمية من المخزون تلقائياً
        invoice.items.forEach(async item => {
            const ref = doc(db, "stock", item.id);
            await updateDoc(ref, { qty: item.newQty });
        });
        return id;
    }
};

// 3. فحص النظر Rx (الأهم للأدمن)
export const Optometry = {
    async saveRx(data) { return await addDoc(collection(db, "rx_records"), { ...data, date: serverTimestamp() }); },
    async getHistory(pName) { /* جلب تاريخ المراجع */ }
};

// 4. السجل الأمني (Audit Logs)
export const Security = {
    async log(user, action) { await addDoc(collection(db, "system_logs"), { user, action, time: serverTimestamp() }); }
};
