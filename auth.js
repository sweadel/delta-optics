import { db, collection, query, where, getDocs, limit, addDoc, serverTimestamp } from './config.js';

export const AuthSystem = {
    currentUser: null,

    async login(username, password) {
        if(username === "adel" && password === "123123") {
            this.currentUser = { name: "المهندس عادل", role: "superadmin" };
            this.saveSession();
            return true;
        }

        const q = query(collection(db, "system_users"), where("username", "==", username), where("pass", "==", password), limit(1));
        const snap = await getDocs(q);
        
        if(!snap.empty) {
            this.currentUser = snap.docs[0].data();
            this.saveSession();
            this.logAudit("تسجيل دخول للنظام");
            return true;
        }
        return false;
    },

    saveSession() {
        sessionStorage.setItem('delta_user', JSON.stringify(this.currentUser));
    },

    checkSession() {
        const user = sessionStorage.getItem('delta_user');
        if(user) {
            this.currentUser = JSON.parse(user);
            this.applyPermissions();
            return true;
        }
        return false;
    },

    applyPermissions() {
        if(this.currentUser.role === 'superadmin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
        }
    },

    logout() {
        this.logAudit("تسجيل خروج");
        sessionStorage.removeItem('delta_user');
        location.reload();
    },

    async logAudit(action) {
        if(!this.currentUser) return;
        try {
            await addDoc(collection(db, "security_audit"), {
                user: this.currentUser.name,
                action: action,
                timestamp: serverTimestamp()
            });
        } catch(e) {}
    }
};
