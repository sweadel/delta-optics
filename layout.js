export function loadLayout(pageTitle, activePage) {
    const sidebarHTML = `
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
        <aside class="sidebar" id="main-sidebar">
            <div style="padding: 35px 30px; border-bottom: 1px solid var(--glass-border);">
                <h2 style="font-weight: 900; color: var(--primary); margin:0; font-size: 2rem;">Delta<span style="color:var(--text-main);">.</span></h2>
            </div>
            <div style="padding: 20px 0; overflow-y:auto; flex:1;">
                <div style="padding: 10px 30px; font-weight: 900; color: #94a3b8; font-size: 0.8rem;">العمليات اليومية</div>
                <a href="dashboard.html" class="nav-link ${activePage === 'dash' ? 'active' : ''}"><i class="fas fa-chart-pie w-6"></i> المراقبة</a>
                <a href="clinic.html" class="nav-link ${activePage === 'clinic' ? 'active' : ''}"><i class="fas fa-notes-medical w-6"></i> العيادة</a>
                <a href="pos.html" class="nav-link ${activePage === 'pos' ? 'active' : ''}"><i class="fas fa-cash-register w-6"></i> الكاشير</a>
                
                <div style="padding: 25px 30px 10px; font-weight: 900; color: #94a3b8; font-size: 0.8rem;">اللوجستيات</div>
                <a href="inventory.html" class="nav-link ${activePage === 'inv' ? 'active' : ''}"><i class="fas fa-boxes w-6"></i> المخزون</a>
                <a href="gallery.html" class="nav-link ${activePage === 'gallery' ? 'active' : ''}"><i class="fas fa-images w-6"></i> المعرض</a>
            </div>
        </aside>
    `;

    const headerHTML = `
        <div style="display: flex; gap: 20px; align-items: center;">
            <button onclick="toggleSidebar()" style="background: #fff; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 12px; cursor:pointer;"><i class="fas fa-bars"></i></button>
            <h2 style="margin:0; font-weight:900; font-size:1.5rem;">${pageTitle}</h2>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    document.getElementById('main-header').innerHTML = headerHTML;
}

window.toggleSidebar = () => {
    document.getElementById('main-sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
};
