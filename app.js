/* ==========================================================================
   Delta Optics - Enterprise SaaS Theme (Clean & Minimalist)
   ========================================================================== */

/* --- الألوان الأساسية والمتغيرات (Palette) --- */
:root {
    --primary: #10b981; /* أخضر زمردي أنيق وهادئ */
    --primary-hover: #059669;
    --primary-light: #d1fae5;
    
    --bg-main: #f8fafc; /* خلفية الصفحة - رمادي فاتح جداً مائل للأزرق */
    --bg-card: #ffffff; /* خلفية البطاقات - أبيض ناصع */
    
    --text-strong: #0f172a; /* نصوص العناوين - كحلي غامق جداً (قريب للأسود) */
    --text-body: #334155; /* نصوص عادية */
    --text-muted: #64748b; /* نصوص ثانوية وملاحظات */
    
    --border-light: #e2e8f0; /* حدود ناعمة للبطاقات والجداول */
    --border-focus: #cbd5e1;
    
    --danger: #ef4444; /* أحمر للتنبيهات والمصروفات */
    --danger-light: #fee2e2;
    --warning: #f59e0b; /* برتقالي للمختبر والملاحظات */
    
    /* ظلال ناعمة (Soft Shadows) تعطي عمق بدون إزعاج */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
    
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
}

/* --- إعدادات عامة (Base) --- */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: var(--bg-main);
    color: var(--text-body);
    line-height: 1.5;
    font-size: 14px; /* حجم خط أساسي أصغر وأرتب */
    overflow-x: hidden;
}

/* الأرقام الإنجليزية الإجبارية */
.en-num, input[type="number"] {
    font-family: 'Inter', -apple-system, sans-serif !important;
    direction: ltr !important;
    text-align: center; /* توسيط الأرقام */
}

/* --- الهيكل الرئيسي (Layout) --- */
.main {
    transition: all 0.3s ease;
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.content {
    padding: 24px;
    flex: 1;
    max-width: 1400px; /* تحديد عرض أقصى لعدم تشتت العين بالشاشات الكبيرة */
    margin: 0 auto;
    width: 100%;
}

/* --- الترويسة العلوية (Header) --- */
.header {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border-light);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-strong);
    display: flex;
    align-items: center;
    gap: 8px;
}

/* شريط البحث */
.search-bar {
    padding: 10px 16px;
    border: 1px solid var(--border-light);
    border-radius: 50px; /* دائري بالكامل لأناقة أكثر */
    background: var(--bg-main);
    width: 250px;
    font-family: 'Tajawal', sans-serif;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    color: var(--text-body);
}

.search-bar:focus {
    width: 300px;
    background: var(--bg-card);
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(226, 232, 240, 0.5);
    outline: none;
}

/* أيقونة المستخدم بالهيدر */
.user-profile-badge {
    background: var(--primary-light);
    color: var(--primary-hover);
    padding: 6px 12px;
    border-radius: 50px;
    font-size: 0.85rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* --- القائمة الجانبية (Sidebar) --- */
.sidebar {
    position: fixed;
    right: -280px; /* عرض مناسب */
    top: 0;
    width: 280px;
    height: 100vh;
    background: var(--bg-card);
    border-left: 1px solid var(--border-light);
    z-index: 1000;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
}

.sidebar.active {
    right: 0;
}

.sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    backdrop-filter: blur(2px);
    z-index: 999;
    display: none;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.sidebar-overlay.active {
    display: block;
    opacity: 1;
}

.menu-toggle-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-sm);
    transition: background 0.2s;
}

.menu-toggle-btn:hover {
    background: var(--bg-main);
    color: var(--text-strong);
}

/* أزرار القائمة الجانبية */
.nav-label {
    padding: 20px 24px 8px;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    color: var(--text-muted);
}

.nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 24px;
    background: transparent;
    border: none;
    text-align: right;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-body);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.nav-link i {
    font-size: 1.1rem;
    color: var(--text-muted);
    width: 20px;
    text-align: center;
    transition: color 0.2s ease;
}

.nav-link:hover {
    background: var(--bg-main);
    color: var(--text-strong);
}

.nav-link:hover i {
    color: var(--primary);
}

.nav-link.active {
    background: var(--primary-light);
    color: var(--primary-hover);
    font-weight: 700;
}

.nav-link.active i {
    color: var(--primary-hover);
}

/* مؤشر جانبي للزر النشط */
.nav-link.active::before {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--primary);
    border-radius: 4px 0 0 4px;
}

/* --- البطاقات (Cards) --- */
.clean-card, .clinic-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
    margin-bottom: 24px;
    overflow: hidden; /* لاحتواء الـ Header */
}

/* ترويسة البطاقة */
.clean-card-header, .clinic-card-header {
    padding: 16px 24px;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-light);
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-strong);
    display: flex;
    align-items: center;
    gap: 8px;
}

.clean-card-header i, .clinic-card-header i {
    color: var(--text-muted);
}

.clean-card-body, .clinic-card-body {
    padding: 24px;
}

/* --- مؤشرات الأداء (KPIs) في الرئيسية --- */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
}

.kpi-card {
    background: var(--bg-card);
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
    text-align: right;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.kpi-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
}

.kpi-val {
    font-size: 1.75rem; /* حجم مناسب غير مبالغ فيه */
    font-weight: 800;
    line-height: 1.2;
}

/* ألوان مخصصة لأرقام الـ KPI */
#kpi-sales { color: var(--text-strong); }
#kpi-profits { color: var(--primary); }
#kpi-expenses { color: var(--danger); }
#kpi-netbox { color: var(--primary); }
#kpi-dues { color: var(--warning); }

/* --- الحقول والنماذج (Forms & Inputs) --- */
.input-group {
    margin-bottom: 16px;
}

.input-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-body);
    margin-bottom: 6px;
}

.clean-input, .form-input-pro {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    font-family: inherit;
    font-size: 0.95rem;
    color: var(--text-strong);
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
}

.clean-input:hover, .form-input-pro:hover {
    border-color: var(--border-focus);
}

.clean-input:focus, .form-input-pro:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
}

.clean-input::placeholder, .form-input-pro::placeholder {
    color: #94a3b8;
    font-weight: 400;
}

/* تنسيق خاص للقوائم المنسدلة (Select) */
select.clean-input, select.form-input-pro {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: left 12px top 50%;
    background-size: 10px auto;
    padding-left: 30px; /* مساحة للسهم */
}

/* --- الأزرار (Buttons) --- */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.btn-primary {
    background-color: var(--primary);
    color: white;
    box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
    background-color: var(--primary-hover);
}

.btn-danger {
    background-color: #fff;
    color: var(--danger);
    border-color: var(--danger-light);
}

.btn-danger:hover {
    background-color: var(--danger-light);
}

/* الزر الكبير للحفظ (تخفيف حجمه ليكون أنيق) */
.btn-massive {
    width: 100%;
    padding: 14px;
    font-size: 1rem;
    font-weight: 700;
    background-color: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    justify-content: center;
    gap: 8px;
    box-shadow: var(--shadow-sm);
}

.btn-massive:hover {
    background-color: var(--primary-hover);
}

/* --- جدول القياسات الطبية (Rx Table) --- */
.rx-table, .clinical-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
}

.rx-table th, .clinical-table th {
    background-color: var(--bg-main);
    padding: 10px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    border-bottom: 1px solid var(--border-light);
}

.rx-table td, .clinical-table td {
    padding: 4px;
    border-bottom: 1px solid var(--border-light);
}

.rx-input, .clinical-input {
    width: 100%;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    text-align: center;
    font-size: 1rem;
    color: var(--text-strong);
    background: transparent;
    transition: all 0.2s;
}

.rx-input:hover, .clinical-input:hover {
    background: var(--bg-main);
}

.rx-input:focus, .clinical-input:focus {
    background: #fff;
    border-color: var(--border-focus);
    outline: none;
}

.eye-label {
    font-size: 0.95rem;
    font-weight: 700;
    text-align: left;
    padding-left: 8px;
}

/* --- المشتريات (Sales Rows) --- */
.sales-row, .product-item {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    align-items: center;
}

.sales-row .clean-input, .product-item .clean-input {
    flex: 2;
}

.sales-row .price-input, .product-item .price-input {
    flex: 1;
    max-width: 120px;
    color: var(--text-strong);
}

/* --- الحاسبة المالية (Calc Wrapper) --- */
.calc-wrapper, .financial-box {
    background: var(--bg-main);
    border-radius: var(--radius-md);
    padding: 20px;
    border: 1px solid var(--border-light);
}

.calc-item, .fin-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border-light);
    font-size: 0.95rem;
    color: var(--text-body);
}

.calc-item:last-child, .fin-row:last-child {
    border-bottom: none;
}

.calc-item span:first-child, .fin-row span:first-child {
    font-weight: 600;
}

.calc-val, .fin-val {
    background: transparent;
    border: none;
    color: var(--text-strong);
    text-align: left;
    font-size: 1.1rem;
    font-weight: 700;
    width: 100px;
    outline: none;
}

/* تنسيق الإجمالي */
.calc-total-row, .fin-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 16px 0;
    padding-top: 16px;
    border-top: 1px solid var(--border-focus);
}

.calc-total-row span:first-child, .fin-total-row span:first-child {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-strong);
}

.calc-total-val, .fin-total-val {
    background: transparent;
    border: none;
    color: var(--text-strong);
    text-align: left;
    font-size: 1.5rem;
    font-weight: 800;
    width: 120px;
}

/* تنسيق المدفوع والباقي */
.fin-paid-box {
    background: #fff;
    padding: 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
    margin-bottom: 12px;
}

.fin-paid-input {
    border: 1px solid var(--border-focus);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--primary);
    text-align: center;
    padding: 8px;
    margin-top: 8px;
    background: #fff;
}

.calc-due, .fin-due-row {
    color: var(--danger);
    background: var(--danger-light);
    padding: 12px;
    border-radius: var(--radius-sm);
    border: none;
}

.calc-due span:first-child, .fin-due-row span:first-child {
    color: var(--danger);
}

#u-due-display, #pos-due-display {
    font-size: 1.4rem;
}

/* --- الجداول العامة (Data Grids) --- */
.table-wrapper {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: right;
    font-size: 0.9rem;
}

.data-table th {
    background: var(--bg-main);
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-focus);
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
}

.data-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-light);
    color: var(--text-body);
    vertical-align: middle;
}

.data-table tr:hover td {
    background: var(--bg-main);
}

/* --- النوافذ المنبثقة (Modals) --- */
.modal {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(4px);
    z-index: 4000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-content {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

/* شبكات التخطيط */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

@media (max-width: 768px) {
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
    .content { padding: 16px; }
}

/* --- تنسيق الطباعة الأنيق (A5) --- */
@media print {
    body { background: #fff; margin: 0; padding: 0; font-family: 'Tajawal', sans-serif; font-size: 11pt; color: #000; }
    .sidebar, .header, .content, .modal, .sidebar-overlay { display: none !important; }
    #print-report { display: block !important; width: 100%; }
    
    .print-card { 
        width: 148mm; /* عرض A5 */
        margin: 0 auto; 
        padding: 10mm; 
    }
    
    .print-header {
        border-bottom: 1.5px solid #000;
        padding-bottom: 8px;
        margin-bottom: 12px;
        text-align: left;
    }
    
    .print-header h2 { margin: 0; font-size: 16pt; font-weight: 700; font-family: 'Inter', sans-serif; }
    .print-header h4 { margin: 2px 0 0 0; font-size: 9pt; color: #555; }
    
    .print-info-box {
        font-size: 9pt;
        margin-bottom: 12px;
        line-height: 1.4;
    }
    
    .print-info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    
    .print-section-title {
        font-weight: 700;
        text-align: center;
        font-size: 9pt;
        background: #f4f4f4 !important;
        -webkit-print-color-adjust: exact;
        padding: 4px;
        border: 1px solid #ddd;
        margin-bottom: 4px;
    }
    
    .print-table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-bottom: 12px; 
        font-size: 9pt; 
    }
    
    .print-table th, .print-table td { 
        border: 1px solid #ddd; 
        padding: 4px 6px; 
        text-align: center; 
    }
    
    .print-table th { background: #fafafa !important; font-weight: 600; }
    
    .print-totals-box {
        border: 1.5px solid #000;
        border-radius: 4px;
        padding: 8px;
        font-size: 9pt;
    }
    
    .print-total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .print-total-row.final { font-weight: 700; font-size: 10pt; border-top: 1px solid #ccc; padding-top: 4px; margin-top: 4px; }
    
    .en-num-print { font-family: 'Inter', sans-serif !important; direction: ltr !important; display: inline-block; font-weight: 600;}
}
