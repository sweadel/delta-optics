import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, setDoc } from './config.js';
import { AuthSystem } from './auth.js';

export const AppLogic = {
    init() {
        this.syncInventory();
        this.syncRx();
    },

    async saveRx(data) {
        try {
            await addDoc(collection(db, "rx_records"), { ...data, timestamp: serverTimestamp(), doctor: AuthSystem.currentUser.name });
            AuthSystem.logAudit(`إضافة فحص للمراجع: ${data.patient}`);
            return true;
        } catch(e) { return false; }
    },

    syncInventory() {
        onSnapshot(query(collection(db, "inventory"), orderBy("timestamp", "desc")), (snap) => {
            const table = document.getElementById('inv-table');
            if(table) {
                table.innerHTML = snap.docs.map(d => {
                    const item = d.data();
                    return `<tr><td>${item.code}</td><td>${item.brand}</td><td>${item.type}</td><td>${item.qty}</td><td>${item.price}</td></tr>`;
                }).join('');
            }
        });
    }
};
