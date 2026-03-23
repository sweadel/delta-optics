// auth.js
import { db, collection, query, where, getDocs, limit, addDoc, serverTimestamp } from './config.js';

export const Auth = {
    user: null,

    async login(username, password) {
        if(username === "adel" && password === "123123") {
            this.user = { name: "المهندس عادل", role: "superadmin" };
            localStorage.setItem('delta_erp_user', JSON.stringify(this.user));
            this.logAudit("دخول النظام - Master Key");
            return true;
        }

        const q = query(collection(db, "users"), where("username", "==", username), where("password", "==", password), limit(1));
        const snap = await getDocs(q);
        
        if(!snap.empty) {
            this.user = snap.docs[0].data();
            localStorage.setItem('delta_erp_user', JSON.stringify(this.user));
            this.logAudit("تسجيل دخول للنظام");
            return true;
        }
        return false;
    },

    checkSession() {
        const saved = localStorage.getItem('delta_erp_user');
        if(saved) {
            this.user = JSON.parse(saved);
            this.applyRoles();
            return true;
        }
        return false;
    },

    applyRoles() {
        if(this.user && this.user.role === 'superadmin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
            document.querySelectorAll('.admin-block').forEach(el => el.style.display = 'block');
        }
    },

    logout() {
        this.logAudit("تسجيل خروج");
        localStorage.removeItem('delta_erp_user');
        location.reload();
    },

    async logAudit(action) {
        if(!this.user) return;
        try { await addDoc(collection(db, "audit_logs"), { user: this.user.name, action: action, time: serverTimestamp() }); } catch(e){}
    }
};
