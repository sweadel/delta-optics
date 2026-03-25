import "./globals.css";
import { Home, Users, DollarSign, Settings, Search } from "lucide-react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-900 font-sans">
        <div className="flex h-screen overflow-hidden">
          
          {/* القائمة الجانبية */}
          <aside className="w-64 border-l bg-white flex flex-col shadow-sm">
            <div className="p-6 border-b text-2xl font-bold text-sky-600 tracking-tight">Delta Optics</div>
            <nav className="flex-1 p-4 space-y-2">
              <NavItem icon={<Home size={20}/>} label="الرئيسية" active />
              <NavItem icon={<Users size={20}/>} label="العيادة (EMR)" />
              <NavItem icon={<DollarSign size={20}/>} label="المبيعات (POS)" />
              <NavItem icon={<Settings size={20}/>} label="الإدارة" />
            </nav>
          </aside>

          {/* المحتوى الرئيسي */}
          <div className="flex-1 flex flex-col">
            <header className="h-16 bg-white border-b px-8 flex items-center justify-between shadow-sm">
              <div className="relative w-96">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input placeholder="بحث سريع عن مريض..." className="w-full bg-slate-100 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium bg-sky-100 text-sky-700 px-3 py-1 rounded-full">المهندس عادل</span>
              </div>
            </header>
            
            <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
              {children}
            </main>
          </div>

        </div>
      </body>
    </html>
  );
}

function NavItem({ icon, label, active = false }: any) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-sky-50 text-sky-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
      {icon} <span>{label}</span>
    </div>
  );
}
