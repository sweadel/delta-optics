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

window.allUnifiedRecords = []; 
window.allOnlineTests = []; 
let todayInvoicesData = []; 
let todayExpensesData = []; 
let allStaffData = [];

// ================== ربط الأزرار والواجهة الأساسية ==================
window.toggleSidebar = () => { 
    const s = document.getElementById('main-sidebar'); 
    const o = document.getElementById('sidebar-overlay'); 
    if(s) s.classList.toggle('active'); 
    if(o) o.classList.toggle('active'); 
};

window.showView = (id) => { 
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; }); 
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active')); 
    const target = document.getElementById(id); 
    if(target) { target.classList.add('active'); target.style.display = 'block'; } 
    if(event && event.currentTarget) event.currentTarget.classList.add('active'); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
};

window.performGlobalSearch = () => { 
    const f = document.getElementById('global-search').value.toUpperCase(); 
    document.querySelectorAll('.active table tbody tr').forEach(tr => { 
        tr.style.display = tr.innerText.toUpperCase().includes(f) ? "" : "none"; 
    }); 
};

// ================== تسجيل الدخول ==================
window.handleLogin = async () => {
    const u = document.getElementById('auth-u').value;
    const p = document.getElementById('auth-p').value;
    
    if (!u || !p) {
        return Swal.fire('تنبيه', 'الرجاء إدخال اسم المستخدم وكلمة المرور', 'warning');
    }

    try {
        const res = await Auth.login(u, p);
        if (res.success) { 
            document.getElementById('login-modal').style.display = 'none'; 
            document.getElementById('display-user').innerText = Auth.user.name; 
            applyRoles(Auth.user.role); 
            startSync(); 
            window.showView('dash'); 
        } else { 
            Swal.fire('مرفوض', res.msg, 'error'); 
        }
    } catch (error) {
        console.error("Login Error: ", error);
        Swal.fire('خطأ', 'حدثت مشكلة أثناء تسجيل الدخول', 'error');
    }
};

window.handleLogout = () => { Auth.logout(); };

function applyRoles(role) {
    let roleName = "موظف"; 
    document.querySelectorAll('.admin-only, .developer-only').forEach(el => el.style.display = 'none');
    if (role === 'manager' || role === 'superadmin' || role === 'developer') { 
        roleName = "مدير"; 
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex'); 
    }
    if (role === 'developer' || role === 'superadmin') { 
        roleName = "مطور / مسؤول"; 
        document.querySelectorAll('.admin-only, .developer-only').forEach(el => el.style.display = 'flex'); 
    }
    if (document.getElementById('display-role')) document.getElementById('display-role').innerText = roleName;
}

// التحقق التلقائي عند فتح الصفحة
document.addEventListener('DOMContentLoaded', () => { 
    if (Auth.check()) { 
        document.getElementById('login-modal').style.display = 'none'; 
        if(document.getElementById('display-user')) document.getElementById('display-user').innerText = Auth.user.name; 
        applyRoles(Auth.user.role); 
        startSync(); 
        window.showView('dash'); 
    } 
    
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if(document.getElementById('current-date-display')) {
        document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('ar-EG', dateOptions);
    }
});

// ================== سلة المحذوفات ==================
window.universalSoftDelete = async (colName, id, dataObj, displayName, typeLabel) => {
    if (confirm(`حذف (${displayName})؟ سيتم نقله لسلة المحذوفات.`)) {
        try { 
            await addDoc(collection(db, "recycle_bin"), { originalCol: colName, originalId: id, data: dataObj, displayName: displayName, typeLabel: typeLabel, deletedBy: Auth.user.name, deletedAt: serverTimestamp() }); 
            await deleteDoc(doc(db, colName, id)); 
            Swal.fire({ icon: 'success', title: 'تم الحذف', text: 'تم النقل بنجاح إلى سلة المحذوفات.', timer: 1500, showConfirmButton: false }); 
        } catch (e) { Swal.fire('خطأ', 'مشكلة بالحذف', 'error'); }
    }
};

window.universalRestore = async (recycleId, colName, originalId, dataObj, displayName, typeLabel) => {
    try { 
        await setDoc(doc(db, colName, originalId), dataObj); 
        await deleteDoc(doc(db, "recycle_bin", recycleId)); 
        Swal.fire({ icon: 'success', title: 'تم الاسترجاع', timer: 1500, showConfirmButton: false }); 
    } catch (e) { Swal.fire('خطأ', 'مشكلة بالاسترجاع', 'error'); }
};

// ================== إدارة الحسابات (RBAC) ==================
window.resetStaffForm = () => { 
    document.getElementById('s-id').value = ""; document.getElementById('s-name').value = ""; 
    document.getElementById('s-user').value = ""; document.getElementById('s-pass').value = ""; 
    document.getElementById('s-role').value = "employee"; 
};

window.loadStaffForEdit = (id) => {
    const staff = allStaffData.find(s => s.id === id); if(!staff) return;
    document.getElementById('edit-s-id').value = id; 
    document.getElementById('edit-s-name').value = staff.name; 
    document.getElementById('edit-s-user').value = staff.user; 
    document.getElementById('edit-s-pass').value = ""; 
    document.getElementById('edit-s-role').value = staff.role || "employee";
    document.getElementById('staff-edit-modal').style.display = 'flex';
};

window.saveRBACEdit = async () => {
    const id = document.getElementById('edit-s-id').value;
    const name = document.getElementById('edit-s-name').value;
    const pass = document.getElementById('edit-s-pass').value;
    const role = document.getElementById('edit-s-role').value;
    
    if (!name) return Swal.fire('خطأ', 'الاسم إجباري', 'error');
    
    let updateData = { name, role }; 
    if(pass.trim() !== "") updateData.pass = pass;
    
    try { 
        await updateDoc(doc(db, "users", id), updateData); 
        document.getElementById('staff-edit-modal').style.display = 'none'; 
        Swal.fire({icon:'success', title:'تم التحديث', timer:1500, showConfirmButton:false}); 
    } catch(e) { Swal.fire('خطأ', 'مشكلة بالاتصال', 'error'); }
};

window.saveStaff = async () => { 
    const name = document.getElementById('s-name').value;
    const user = document.getElementById('s-user').value;
    const pass = document.getElementById('s-pass').value;
    const role = document.getElementById('s-role').value;
    
    if (!name || !user || !pass) return Swal.fire('خطأ', 'أكمل البيانات', 'error'); 
    try { 
        await addDoc(collection(db, "users"), { name, user, pass, role, status: "active", time: serverTimestamp() }); 
        Swal.fire({icon:'success', title:'تم الإنشاء', timer:1500, showConfirmButton:false}); 
        resetStaffForm(); 
    } catch(e) { Swal.fire('خطأ', 'مشكلة بالإنشاء', 'error'); }
};

window.deleteUserAccount = async (id, name, fullData) => { window.universalSoftDelete("users", id, fullData, name, "حساب مستخدم"); };

// ================== المزامنة החية (Sync) ==================
function startSync() {
    console.log("System Sync Started..."); // لفحص عمل النظام
    
    // سحب الحسابات
    onSnapshot(collection(db, "users"), (s) => {
        allStaffData = []; s.forEach(d => allStaffData.push({id: d.id, ...d.data()}));
        if (document.getElementById('tb-staff')) {
            document.getElementById('tb-staff').innerHTML = allStaffData.map(d => {
                const roleBadge = d.role === 'developer' ? '<span class="role-badge role-dev">مطور</span>' : d.role === 'manager' ? '<span class="role-badge role-mgr">مدير</span>' : '<span class="role-badge role-emp">موظف</span>';
                return `<tr><td style="font-weight:bold;">${d.name}</td><td class="en-num">${d.user}</td><td>${roleBadge}</td><td>نشط</td><td style="display:flex; gap:5px;"><button class="btn-pro" style="background:#f1f5f9; color:var(--text-main); padding:6px 12px; font-size:0.9rem;" onclick="loadStaffForEdit('${d.id}')"><i class="fas fa-edit"></i> تعديل</button><button class="btn-pro" style="background:#fef2f2; color:var(--danger); padding:6px 12px; font-size:0.9rem;" onclick='deleteUserAccount("${d.id}", "${d.name}", ${JSON.stringify(d).replace(/'/g, "\\'")})'><i class="fas fa-trash"></i></button></td></tr>`;
            }).join('');
        }
    });

    // سحب سلة المحذوفات
    onSnapshot(query(collection(db, "recycle_bin"), orderBy("deletedAt", "desc")), (s) => {
        if (document.getElementById('tb-recycle')) document.getElementById('tb-recycle').innerHTML = s.docs.map(d => { 
            const p = d.data(); const dStr = p.deletedAt?.toDate().toLocaleString('en-GB') || '--'; 
            return `<tr><td style="font-weight:bold; color:var(--danger);">${p.typeLabel}</td><td>${p.displayName}</td><td><span style="font-weight:bold; color:var(--text-muted);">${p.deletedBy}</span></td><td class="en-num">${dStr}</td><td><button class="btn-pro btn-primary" style="padding:8px 15px; font-size:0.9rem;" onclick='universalRestore("${d.id}", "${p.originalCol}", "${p.originalId}", ${JSON.stringify(p.data).replace(/'/g, "\\'")}, "${p.displayName}", "${p.typeLabel}")'><i class="fas fa-undo"></i> استرجاع</button></td></tr>`; 
        }).join(''); 
    });
}
