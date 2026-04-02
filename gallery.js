import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { loadLayout } from './layout.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. تحميل القائمة الجانبية واسم الصفحة
    loadLayout('إدارة المعرض الخارجي');
    // 2. سحب البيانات والصور
    loadGalleryData();
});

// معالجة الصورة وتحويلها لنص لتخزينها
window.handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('ext-col-base64').value = e.target.result;
        document.getElementById('img-preview').src = e.target.result;
        document.getElementById('img-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
};

// حفظ البيانات في Firebase
window.saveExtCollection = async () => {
    const name = document.getElementById('ext-col-name').value;
    const type = document.getElementById('ext-col-type').value;
    const img = document.getElementById('ext-col-base64').value;

    if (!name || !img) return Swal.fire('تنبيه', 'يجب إدخال الاسم واختيار صورة', 'warning');

    await addDoc(collection(db, "brands"), { 
        name, type, imageUrl: img, timestamp: serverTimestamp() 
    });

    Swal.fire('تم', 'تم الإضافة والنشر بنجاح', 'success');
    document.getElementById('ext-col-name').value = '';
    document.getElementById('ext-col-base64').value = '';
    document.getElementById('img-preview').style.display = 'none';
};

// الحذف
window.deleteCollection = async (id) => {
    if(confirm("هل أنت متأكد من الحذف؟")) {
        await deleteDoc(doc(db, "brands", id));
    }
};

// جلب البيانات وعرض الصور بالشكل الصحيح
function loadGalleryData() {
    onSnapshot(query(collection(db, "brands"), orderBy("timestamp", "desc")), (snapshot) => {
        let html = "";
        snapshot.forEach(d => {
            const data = d.data();
            // هنا تم حل مشكلة الصورة لتظهر بوضوح وبحجم ممتاز
            const imgSrc = data.imageUrl 
                ? `<img src="${data.imageUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">` 
                : `<span style="color:red; font-weight:bold;">لا توجد صورة</span>`;
            
            const typeLabel = data.type === 'sun' ? '<span class="role-badge role-mgr">شمسي</span>' : '<span class="role-badge role-dev">طبي</span>';

            html += `<tr>
                <td>${imgSrc}</td>
                <td style="font-weight:900; font-size:1.15rem; color:var(--text-main);">${data.name}</td>
                <td>${typeLabel}</td>
                <td>
                    <button class="btn-massive" style="background:#ef4444; padding:10px 20px; width:auto; box-shadow:none;" onclick="deleteCollection('${d.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>`;
        });
        document.getElementById('tb-ext-collections').innerHTML = html;
    });
}
