import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { loadLayout } from './layout.js';

document.addEventListener('DOMContentLoaded', () => {
    loadLayout('لوحة المراقبة المالية', 'dash');
    loadDashboardData();
});

window.saveExpense = async () => {
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const desc = document.getElementById('exp-desc').value.trim();
    if(!amount || !desc) return Swal.fire('خطأ', 'أدخل المبلغ والتفاصيل', 'error');
    
    await addDoc(collection(db, "expenses"), { amount, desc, user: "المدير", time: serverTimestamp() });
    
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    Swal.fire({icon:'success', title:'تم التسجيل', timer:1500, showConfirmButton:false});
};

function loadDashboardData() {
    const todayStr = new Date().toDateString();
    let invoices = [];
    let expenses = [];

    // سحب المبيعات
    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        invoices = s.docs.map(d => d.data()).filter(i => i.time?.toDate().toDateString() === todayStr);
        renderLedger(invoices, expenses);
    });

    // سحب المصروفات
    onSnapshot(query(collection(db, "expenses"), orderBy("time", "desc")), (s) => {
        expenses = s.docs.map(d => d.data()).filter(e => e.time?.toDate().toDateString() === todayStr);
        renderLedger(invoices, expenses);
    });
}

function renderLedger(invoices, expenses) {
    let totalSales = 0, totalPaid = 0, totalDues = 0, totalExpenses = 0;
    let combined = [];

    invoices.forEach(i => {
        totalSales += Number(i.total || 0); totalPaid += Number(i.paid || 0); totalDues += Number(i.due || 0);
        combined.push({ 
            timeObj: i.time?.toDate(), 
            timeStr: i.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}), 
            desc: `مبيعات: ${i.pName}`, 
            val: `<span class="en-num" style="color:var(--success); font-weight:bold;">+ ${Number(i.paid||0).toFixed(2)}</span>` 
        });
    });

    expenses.forEach(e => {
        totalExpenses += Number(e.amount || 0);
        combined.push({ 
            timeObj: e.time?.toDate(), 
            timeStr: e.time?.toDate().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}), 
            desc: `مصروف: ${e.desc}`, 
            val: `<span class="en-num" style="color:var(--danger); font-weight:bold;">- ${Number(e.amount||0).toFixed(2)}</span>` 
        });
    });

    combined.sort((a,b) => (b.timeObj?.getTime() || 0) - (a.timeObj?.getTime() || 0));

    let html = '';
    combined.forEach(r => html += `<tr><td class="en-num">${r.timeStr}</td><td style="font-weight:bold;">${r.desc}</td><td>${r.val}</td></tr>`);
    
    document.getElementById('tb-daily-ledger').innerHTML = html || '<tr><td colspan="3" style="text-align:center;">لا يوجد حركات اليوم</td></tr>';
    document.getElementById('kpi-sales').innerText = totalSales.toFixed(2);
    document.getElementById('kpi-profits').innerText = totalPaid.toFixed(2);
    document.getElementById('kpi-dues').innerText = totalDues.toFixed(2);
    document.getElementById('kpi-expenses').innerText = totalExpenses.toFixed(2);
    document.getElementById('kpi-netbox').innerText = (totalPaid - totalExpenses).toFixed(2);
}
