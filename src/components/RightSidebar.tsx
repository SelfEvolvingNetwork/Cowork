import React from 'react';
import { 
  Calendar, 
  FileSpreadsheet, 
  User, 
  Clock, 
  HardDrive,
  RefreshCw,
  Download,
  Cloud,
  CloudOff
} from 'lucide-react';

interface RightSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isSyncing: boolean;
  lastSyncedTime: string;
  manualSync: (silent?: boolean) => Promise<boolean>;
  isInstallable: boolean;
  onInstall: () => void;
  uploadStatus: 'idle' | 'saving' | 'saved' | 'error';
  queueCount: number;
  academyName?: string;
  academyLogo?: string;
}

export function RightSidebar({ 
  activeTab, 
  setActiveTab, 
  isSyncing, 
  lastSyncedTime, 
  manualSync,
  isInstallable,
  onInstall,
  uploadStatus,
  queueCount,
  academyName = 'آموزشگاه پرستو',
  academyLogo
}: RightSidebarProps) {
  const menuItems = [
    { id: 'reports', icon: FileSpreadsheet, title: 'گزارش‌ها', keyHint: 'Alt + 1' },
    { id: 'calendar', icon: Calendar, title: 'تقویم کاری', keyHint: 'Alt + 2' },
    { id: 'profile', icon: User, title: 'مشترکین', keyHint: 'Alt + 3' },
    { id: 'shifts', icon: Clock, title: 'سانس‌ها', keyHint: 'Alt + 4' },
    { id: 'backup', icon: HardDrive, title: 'بکاپ', keyHint: 'Alt + 5' },
  ];

  return (
    <aside id="main-sidebar" className="w-16 h-full bg-slate-900 border-l border-slate-800 flex flex-col items-center py-5 gap-5 shrink-0 select-none">
      {/* App Logo Emblem - Clean, flat icon matching standard design guidelines */}
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-lg mb-2 overflow-hidden p-1 shadow-sm shrink-0">
        <img 
          src={academyLogo || "/parastu_logo.png"} 
          alt={academyName} 
          className="w-8 h-8 object-contain rounded-lg shrink-0" 
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = "/parastu_logo.png";
          }}
        />
      </div>

      {/* Main Navigation - Scrollable but no scrollbars */}
      <nav className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 w-full px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink" aria-label="منوی عمیق ناوبری2">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`tab-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all duration-250 relative group cursor-pointer border shrink-0 ${
                isActive 
                  ? 'bg-slate-850 text-blue-400 border-slate-800 shadow-inner' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
              }`}
              title={`${item.title} (${item.keyHint})`}
            >
              {/* Highlight Bar */}
              {isActive && (
                <div className="absolute right-0 top-1/4 bottom-1/4 w-0.5 rounded-l-full bg-blue-500 shrink-0" />
              )}
              
              <IconComponent className="w-5 h-5 stroke-[1.8] shrink-0" />

              {/* Floating Tooltip Indicator - Minimal styling */}
              <div className="invisible group-hover:visible absolute right-14 bg-slate-950 text-slate-100 text-[10px] font-bold py-1 px-2 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans text-right scale-95 origin-left group-hover:scale-100 transition-all pointer-events-none duration-150 flex items-center gap-1.5 shrink-0" dir="rtl">
                <span>{item.title}</span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-blue-400 px-1 py-0.5 rounded font-mono font-normal shrink-0">
                  {item.keyHint}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Manual Sync & PWA Install Buttons with Persian Tooltips */}
      <div className="w-full px-1.5 pt-4 border-t border-slate-800 flex flex-col items-center gap-3 shrink-0">
        {/* Server Upload / Sync Status Icon Indicator */}
        <div 
          id="server-upload-status-indicator"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative group border border-transparent shrink-0 ${
            queueCount > 0 || uploadStatus === 'saving' ? 'bg-amber-500/10' :
            uploadStatus === 'saved' ? 'bg-emerald-500/10' :
            uploadStatus === 'error' ? 'bg-red-500/10 border-red-500/20' : ''
          }`}
        >
          {queueCount > 0 && (
            <span id="sync-queue-badge" className="absolute -top-1 -left-1 bg-amber-500 text-slate-950 text-[9px] font-black w-[17px] h-[17px] rounded-full flex items-center justify-center shadow-md animate-pulse shrink-0">
              {queueCount}
            </span>
          )}

          {uploadStatus === 'error' ? (
            <CloudOff className="w-[18px] h-[18px] stroke-[1.8] text-red-500 animate-bounce shrink-0" />
          ) : (
            <Cloud className={`w-[18px] h-[18px] stroke-[1.8] shrink-0 ${
              queueCount > 0 || uploadStatus === 'saving' ? 'text-amber-500 animate-pulse' :
              uploadStatus === 'saved' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-400'
            }`} />
          )}

          {/* Floating Tooltip Indicator - Minimal styling */}
          <div className="invisible group-hover:visible absolute right-14 bg-slate-950 text-slate-100 text-[10px] font-bold py-1.5 px-2.5 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans text-right scale-95 origin-left group-hover:scale-100 transition-all pointer-events-none duration-150 flex flex-col gap-0.5 shrink-0" dir="rtl">
            <span className={`font-black shrink-0 ${
              queueCount > 0 || uploadStatus === 'saving' ? 'text-amber-400' :
              uploadStatus === 'saved' ? 'text-emerald-400' :
              uploadStatus === 'error' ? 'text-red-400' : 'text-slate-300'
            }`}>
              {queueCount > 0 ? `در حال ارسال تغییرات (${queueCount} مورد در صف)` :
               uploadStatus === 'saving' ? 'درحال ارسال به سرور...' :
               uploadStatus === 'saved' ? 'تغییرات ذخیره شد' :
               uploadStatus === 'error' ? 'خطا در ارسال داده!' : 'وضعیت اتصال سرور'}
            </span>
            <span className="text-[9px] text-slate-400 font-normal shrink-0">
              {queueCount > 0 ? 'تغییرات شما به صورت پس‌زمینه و غیرهمزمان ارسال می‌شوند' :
               uploadStatus === 'saving' ? 'در حال ثبت فایل‌های پایگاه داده' :
               uploadStatus === 'saved' ? 'تمامی اطلاعات روی سرور ثبت شدند' :
               uploadStatus === 'error' ? 'شبکه قطع است یا سرور پاسخ نمیدهد' : 'اتصال پایدار با پایگاه داده'}
            </span>
          </div>
        </div>

        <button
          id="manual-sync-btn"
          onClick={() => manualSync(false)}
          disabled={isSyncing}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative group cursor-pointer border shrink-0 ${
            isSyncing 
              ? 'bg-slate-850 text-amber-400 border-slate-800' 
              : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-blue-400 hover:border-slate-800/60'
          }`}
          title="همگام‌سازی دستی با سرور"
        >
          <RefreshCw className={`w-[18px] h-[18px] stroke-[1.8] shrink-0 ${isSyncing ? 'animate-spin' : 'hover:rotate-180 transition-transform duration-500'}`} />
          
          {/* Floating Tooltip Indicator - Minimal styling */}
          <div className="invisible group-hover:visible absolute right-14 bg-slate-950 text-slate-100 text-[10px] font-bold py-1.5 px-2.5 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans text-right scale-95 origin-left group-hover:scale-100 transition-all pointer-events-none duration-150 flex flex-col gap-0.5 shrink-0" dir="rtl">
            <span className="text-slate-200 font-medium shrink-0">همگام‌سازی دستی داده‌ها</span>
            <span className="text-[9px] text-slate-400 font-normal shrink-0">
              آخرین همگام‌سازی: <span className="font-mono text-blue-400">{lastSyncedTime}</span>
            </span>
          </div>
        </button>

        {/* PWA Install Button */}
        <button
          id="pwa-install-btn"
          onClick={onInstall}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative group cursor-pointer border shrink-0 ${
            isInstallable 
              ? 'bg-blue-600/15 text-blue-400 border-blue-500/45 hover:bg-blue-600/25' 
              : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-blue-400 hover:border-slate-800/60'
          }`}
          title="نصب نسخه وب‌اپلیکیشن (PWA)"
        >
          <Download className="w-[18px] h-[18px] stroke-[1.8] shrink-0" />
          
          {/* Floating Tooltip Indicator - Minimal styling */}
          <div className="invisible group-hover:visible absolute right-14 bg-slate-950 text-slate-100 text-[10px] font-bold py-1.5 px-2.5 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans text-right scale-95 origin-left group-hover:scale-100 transition-all pointer-events-none duration-150 flex flex-col gap-0.5 shrink-0" dir="rtl">
            <span className="text-slate-200 font-medium shrink-0">نصب نسخه اپلیکیشن (PWA)</span>
            <span className="text-[9px] text-slate-400 font-normal shrink-0">
              {isInstallable ? 'آماده نصب روی دستگاه' : 'راهنمای نصب برنامه'}
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
}
