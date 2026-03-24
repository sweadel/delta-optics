import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// إعدادات Firebase الخاصة بنظام Delta
const firebaseConfig = {
    apiKey: "AIzaSyB11C4GGgAyqeThs8a9cvDNN7frvAA1nqQ",
    authDomain: "delta-optics-system.firebaseapp.com",
    projectId: "delta-optics-system",
    storageBucket: "delta-optics-system.firebasestorage.app",
    messagingSenderId: "111176219224",
    appId: "1:111176219224:web:e0d8a5f26b84d57249a82d"
};

// تهيئة النظام
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// مراقبة حالة المستخدم (للتأكد من تسجيل الدخول)
onAuthStateChanged(auth, (user) => {
    // مؤقتاً سنقوم بتشغيل النظام فوراً لتسهيل التطوير
    // لاحقاً سنفعل شاشة تسجيل الدخول
    document.getElementById('user-name-display').innerText = user?.displayName || "مهندس عادل";
    startSmartSync();
});

// دالة تسجيل الخروج (مربوطة بالواجهة)
window.handleLogout = () => {
    /* signOut(auth).then(() => {
        window.location.reload();
    }); 
    */
    Swal.fire('معلومة', 'تم الضغط على تسجيل الخروج', 'info');
};

// المزامنة الذكية للبيانات (Real-time)
function startSmartSync() {
    // 1. حساب مبيعات اليوم بشكل لحظي للوحة القيادة
    const invoicesRef = collection(db, "invoices");
    
    onSnapshot(invoicesRef, (snapshot) => {
        let todaySales = 0;
        const today = new Date().toDateString();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // نجمع مبيعات اليوم الحالي فقط
            if (data.time && data.time.toDate().toDateString() === today) {
                todaySales += Number(data.total) || 0;
            }
        });
        
        // تحديث الواجهة الديناميكية
        const salesElement = document.getElementById('today-sales');
        if(salesElement) {
            salesElement.innerText = todaySales + " JOD";
        }
    });

    console.log("⚡ النظام الذكي متصل ويعمل بنجاح...");
}

// تشغيل البحث الذكي السريع
document.getElementById('smart-search')?.addEventListener('input', (e) => {
    const term = e.target.value;
    // سيتم ربطها بفلترة الجداول لاحقاً
    console.log("جاري البحث عن:", term);
});
