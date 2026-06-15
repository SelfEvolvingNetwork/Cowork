import React from 'react';
import { 
  Calendar, 
  FileSpreadsheet, 
  User, 
  Clock, 
  HardDrive,
  Building2
} from 'lucide-react';

interface RightSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export function RightSidebar({ activeTab, setActiveTab }: RightSidebarProps) {
  const menuItems = [
    { id: 'reports', icon: FileSpreadsheet, title: 'گزارش‌ها' },
    { id: 'calendar', icon: Calendar, title: 'تقویم کاری' },
    { id: 'profile', icon: User, title: 'مشترکین' },
    { id: 'shifts', icon: Clock, title: 'سانس‌ها' },
    { id: 'backup', icon: HardDrive, title: 'بکاپ' },
  ];

  return (
    <aside id="main-sidebar" className="w-16 h-full bg-slate-900 border-l border-slate-800 flex flex-col items-center py-5 gap-5 shrink-0 select-none">
      {/* App Logo Emblem - Clean, flat icon matching standard design guidelines */}
      <div className="w-10 h-10 rounded-xl bg-slate-800/80 text-blue-400 flex items-center justify-center font-bold text-lg mb-2">
        <Building2 className="w-5 h-5 stroke-[1.8]" />
      </div>

      {/* Main Navigation - STRICTLY ICON ONLY as per requirements */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-1.5" aria-label="منوی عمیق ناوبری2">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`tab-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all duration-250 relative group cursor-pointer border ${
                isActive 
                  ? 'bg-slate-850 text-blue-400 border-slate-800 shadow-inner' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
              }`}
              title={item.title}
            >
              {/* Highlight Bar */}
              {isActive && (
                <div className="absolute right-0 top-1/4 bottom-1/4 w-0.5 rounded-l-full bg-blue-500" />
              )}
              
              <IconComponent className="w-5 h-5 stroke-[1.8]" />

              {/* Floating Tooltip Indicator - Minimal styling */}
              <div className="invisible group-hover:visible absolute right-14 bg-slate-950 text-slate-100 text-[10px] font-bold py-1 px-2 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans text-right scale-95 origin-left group-hover:scale-100 transition-all pointer-events-none duration-150">
                {item.title}
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
