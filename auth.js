import { db, collection, query, where, getDocs, limit } from './config.js';

export const Auth = {
    user: null,
    async login(u, p) {
        if (u === "adel" && p === "123123") {
            this.user = { name: "م. عادل جعاروة", role: "superadmin" };
            localStorage.setItem('delta_sys', JSON.stringify(this.user));
            return true;
        }
        const q = query(collection(db, "users"), where("user", "==", u), where("pass", "==", p), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const userData = snap.docs[0].data();
            if(userData.status === "frozen") {
                Swal.fire('تنبيه أمني', 'هذا الحساب مجمد من قبل الإدارة!', 'error');
                return false;
            }
            this.user = { id: snap.docs[0].id, ...userData };
            localStorage.setItem('delta_sys', JSON.stringify(this.user));
            return true;
        }
        return false;
    },
    check() {
        const data = localStorage.getItem('delta_sys');
        if (data) { this.user = JSON.parse(data); return true; }
        return false;
    },
    logout() { localStorage.removeItem('delta_sys'); location.reload(); }
};