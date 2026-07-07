import React from 'react';
import { useCoworkingState } from './hooks/useCoworkingState';
import { RightSidebar } from './components/RightSidebar';
import { CalendarTab } from './components/CalendarTab';
import { ReportsTab } from './components/ReportsTab';
import { ProfileTab } from './components/ProfileTab';
import { ShiftsTable } from './components/ShiftsTable';
import { BackupTab } from './components/BackupTab';
import { AlertCircle, ShieldAlert, CheckCircle2, X, Download, WifiOff, RefreshCw } from 'lucide-react';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    todayDate,
    config,
    updateConfig,
    shifts,
    addShift,
    updateShift,
    deleteShift,
    members,
    addMember,
    updateMember,
    deleteMember,
    terms,
    addTerm,
    updateTerm,
    deleteTerm,
    calendarOverrides,
    toggleDayStatus,
    sessionNotes,
    saveSessionNote,
    sessionAttendance,
    saveSessionAttendance,
    importBackupData,
    wipeAllData,
    dialogError,
    closeErrorDialog,
    isSyncing,
    lastSyncedTime,
    manualSync,
    uploadStatus,
    queueCount,
  } = useCoworkingState();

  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isInstallable, setIsInstallable] = React.useState(false);
  const [showInstallGuide, setShowInstallGuide] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCheckConnection = () => {
    setIsOffline(!navigator.onLine);
    if (navigator.onLine) {
      showToast('success', 'اتصال اینترنت شما با موفقیت برقرار شد.');
    } else {
      showToast('error', 'هنوز اتصالی به اینترنت برقرار نشده است.');
    }
  };

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
        showToast('success', 'برنامه با موفقیت روی دستگاه شما نصب شد.');
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((curr) => curr?.text === text ? null : curr);
    }, 4500);
  };

  React.useEffect(() => {
    const checkVersion = async () => {
      try {
        // Trigger background service worker update check if available
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            registration.update().catch(() => {});
          }
        }

        const response = await fetch(`/api/version?t=${Date.now()}`);
        if (!response.ok) return;
        const data = await response.json();
        const serverVersion = data.version;
        if (!serverVersion) return;

        const localVersion = localStorage.getItem('app_client_version');
        if (localVersion && localVersion !== serverVersion) {
          console.log(`نسخه جدید کلاینت یافت شد: ${serverVersion}. نسخه فعلی: ${localVersion}. در حال بروزرسانی خودکار...`);
          
          // Unregister any active service worker registrations
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
            }
          }
          
          // Clear entire cache storage
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          
          // Save the new version ID
          localStorage.setItem('app_client_version', serverVersion);
          
          showToast('success', 'نسخه جدید نرم‌افزار آماده است. در حال بروزرسانی و راه‌اندازی مجدد...');
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else if (!localVersion) {
          localStorage.setItem('app_client_version', serverVersion);
        }
      } catch (err) {
        console.warn('Could not check app client version:', err);
      }
    };

    // Check on startup
    checkVersion();

    // Check periodically every 2.5 minutes
    const intervalId = setInterval(checkVersion, 2.5 * 60 * 1000);

    // Also check whenever user focuses/returns to the window/tab
    window.addEventListener('focus', checkVersion);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  // Dynamic Title, Favicon & Apple Touch Icon Synchronization based on config
  React.useEffect(() => {
    if (config?.academyName) {
      document.title = `سامانه مدیریت ${config.academyName}`;
    } else {
      document.title = 'سامانه مدیریت آموزشگاه پرستو';
    }

    if (config?.academyLogo) {
      const updateIcon = (rel: string) => {
        let link = document.querySelector(`link[rel*='${rel}']`) as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = config.academyLogo!;
      };
      updateIcon('icon');
      updateIcon('shortcut icon');
      updateIcon('apple-touch-icon');
    }
  }, [config?.academyName, config?.academyLogo]);

  const handleManualSync = async () => {
    const success = await manualSync(false);
    if (success) {
      showToast('success', `همگام‌سازی دستی داده‌ها با سرور با موفقیت انجام شد.`);
    } else {
      showToast('error', `خطا در برقراری ارتباط با سرور برای همگام‌سازی.`);
    }
    return success;
  };

  React.useEffect(() => {
    const handleGlobalTabShortcuts = (e: KeyboardEvent) => {
      if (e.altKey) {
        const key = e.key;
        if (key === '1' || key === '۱') {
          e.preventDefault();
          setActiveTab('reports');
        } else if (key === '2' || key === '۲') {
          e.preventDefault();
          setActiveTab('calendar');
        } else if (key === '3' || key === '۳') {
          e.preventDefault();
          setActiveTab('profile');
        } else if (key === '4' || key === '۴') {
          e.preventDefault();
          setActiveTab('shifts');
        } else if (key === '5' || key === '۵') {
          e.preventDefault();
          setActiveTab('backup');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalTabShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalTabShortcuts);
  }, [setActiveTab]);

  if (isOffline) {
    return (
      <div id="offline-screen" className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-100 p-6 font-sans text-center" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl flex flex-col items-center gap-6">
          {/* Pulsing visual icon */}
          <div className="relative flex items-center justify-center w-20 h-20 bg-red-950/40 border border-red-500/30 rounded-2xl">
            <WifiOff className="w-10 h-10 text-red-500" />
            <span className="absolute inset-0 rounded-2xl bg-red-500/10 animate-ping"></span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              عدم اتصال به شبکه
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              برای استفاده از سامانه مدیریت {config?.academyName || "آموزشگاه پرستو"}، اتصال به اینترنت الزامی است. لطفاً ارتباط دستگاه خود با اینترنت را بررسی کنید و دوباره تلاش نمایید.
            </p>
          </div>

          <button
            id="retry-connection-btn"
            onClick={handleCheckConnection}
            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-900/20 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            بررسی مجدد اتصال
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root-layout" className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans" dir="rtl">
      
      {/* 1. Sidebar on the RIGHT (Traditional RTL flow) */}
      <RightSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSyncing={isSyncing}
        lastSyncedTime={lastSyncedTime}
        manualSync={handleManualSync}
        isInstallable={isInstallable}
        onInstall={handleInstallApp}
        uploadStatus={uploadStatus}
        queueCount={queueCount}
        academyName={config?.academyName}
        academyLogo={config?.academyLogo}
      />

      {/* 2. Main Content Container on the LEFT */}
      <main id="main-content-flow" className={`flex-1 h-full flex flex-col p-[10px] w-full max-w-7xl mx-auto ${
        (activeTab === 'profile' || activeTab === 'reports' || activeTab === 'calendar' || activeTab === 'backup') ? 'overflow-hidden pb-0' : 'overflow-y-auto'
      }`}>
        
        {/* Render Selected View with state preservation (tabs do not unmount, so filters/states remain intact) */}
        <div className={(activeTab === 'profile' || activeTab === 'reports' || activeTab === 'calendar' || activeTab === 'backup') ? 'flex-1 min-h-0 flex flex-col' : 'flex-1'}>
          
          {/* Calendar Tab Component Container */}
          <div className={activeTab === 'calendar' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <CalendarTab
              todayDate={todayDate}
              calendarOverrides={calendarOverrides}
              toggleDayStatus={toggleDayStatus}
              members={members}
              terms={terms}
              sessionNotes={sessionNotes}
              saveSessionNote={saveSessionNote}
              sessionAttendance={sessionAttendance}
              saveSessionAttendance={saveSessionAttendance}
            />
          </div>

          {/* Reports Tab Component Container */}
          <div className={activeTab === 'reports' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <ReportsTab
              terms={terms}
              members={members}
              shifts={shifts}
              todayDate={todayDate}
              sessionNotes={sessionNotes}
              saveSessionNote={saveSessionNote}
              sessionAttendance={sessionAttendance}
              saveSessionAttendance={saveSessionAttendance}
              onSelectMember={(memberId, termId) => {
                setSelectedMemberId(memberId);
                setSelectedTermId(termId || null);
                setActiveTab('profile');
              }}
            />
          </div>

          {/* Profile/Members Tab Component Container */}
          <div className={activeTab === 'profile' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <ProfileTab
              members={members}
              terms={terms}
              shifts={shifts}
              todayDate={todayDate}
              sessionNotes={sessionNotes}
              calendarOverrides={calendarOverrides}
              saveSessionNote={saveSessionNote}
              sessionAttendance={sessionAttendance}
              saveSessionAttendance={saveSessionAttendance}
              addMember={addMember}
              updateMember={updateMember}
              deleteMember={deleteMember}
              addTerm={addTerm}
              updateTerm={updateTerm}
              deleteTerm={deleteTerm}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              initialTermId={selectedTermId}
              setInitialTermId={setSelectedTermId}
            />
          </div>

          {/* Shifts/Configuration Tab Component Container */}
          <div className={activeTab === 'shifts' ? 'flex-1' : 'hidden'}>
            <ShiftsTable
              shifts={shifts}
              addShift={addShift}
              updateShift={updateShift}
              deleteShift={deleteShift}
              terms={terms}
              todayDate={todayDate}
            />
          </div>

          {/* Always render BackupTab as a background worker, visual state controlled by activeTab */}
          <div className={activeTab === 'backup' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <BackupTab
              config={config}
              updateConfig={updateConfig}
              shifts={shifts}
              members={members}
              terms={terms}
              sessionNotes={sessionNotes}
              sessionAttendance={sessionAttendance}
              calendarOverrides={calendarOverrides}
              saveSessionNote={saveSessionNote}
              saveSessionAttendance={saveSessionAttendance}
              importBackupData={importBackupData}
              wipeAllData={wipeAllData}
            />
          </div>
        </div>

        {/* Footer Area - No tech bloat as per constraints */}
        {!(activeTab === 'profile' || activeTab === 'reports' || activeTab === 'calendar' || activeTab === 'backup') && (
          <footer className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 font-sans">
            <span>{config?.academyName || "آموزشگاه پرستو"}</span>
            <span className="font-mono">۱۴۰۵ © نسخه اتوماسیون سازمانی</span>
          </footer>
        )}

      </main>

      {/* 3. Logical Validation Dialog Modal - Custom dialog as per specifications */}
      {dialogError.isOpen && (
        <div id="validation-dialog" className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-905/40 backdrop-blur-xs animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-right animate-slide-up">
            
            {/* Warning symbol and title */}
            <div className="flex items-center gap-3 pr-1 pb-3 border-b border-slate-100">
              <ShieldAlert className="w-6 h-6 text-rose-600 animate-bounce" />
              <h3 className="text-md font-extrabold text-slate-800">
                {dialogError.title}
              </h3>
            </div>

            {/* Error Message */}
            <p className="text-xs text-slate-600 leading-relaxed mt-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {dialogError.message}
            </p>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                id="close-dialog-btn"
                onClick={closeErrorDialog}
                className="px-5 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl cursor-pointer transition-colors"
              >
                متوجه شدم
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Elegant Toast Notification Banner */}
      {toast && (
        <div 
          id="global-toast-notification" 
          className="fixed bottom-5 right-5 z-[200] max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-xl p-4 shadow-2xl flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100"
          dir="rtl"
        >
          {toast.type === 'success' ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
              <AlertCircle className="w-4.5 h-4.5 text-rose-400" />
            </div>
          )}
          <div className="flex-1 min-w-0 text-right">
            <h4 className="text-xs font-bold text-slate-200">
              {toast.type === 'success' ? 'عملیات موفقیت‌آمیز' : 'بروز خطا'}
            </h4>
            <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed font-semibold">
              {toast.text}
            </p>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. PWA Install Guide Dialog Modal */}
      {showInstallGuide && (
        <div id="install-guide-dialog" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-right animate-slide-up">
            
            {/* Title */}
            <div className="flex items-center gap-3 pr-1 pb-3 border-b border-slate-100">
              <Download className="w-6 h-6 text-blue-600" />
              <h3 className="text-md font-extrabold text-slate-800">
                راهنمای نصب نرم‌افزار (PWA)
              </h3>
            </div>

            {/* Guide Content */}
            <div className="text-xs text-slate-600 leading-relaxed mt-4 flex flex-col gap-3">
              <p>این سامانه به عنوان وب‌اپلیکیشن پیشرونده (PWA) طراحی شده است و بدون نیاز به دانلود از مارکت‌ها، مستقیماً روی دستگاه شما نصب می‌شود:</p>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                <div className="font-bold text-slate-800">۱. در سیستم‌عامل اندروید و مرورگر کروم:</div>
                <div className="pr-3 text-[11px] text-slate-500">روی دکمه آبی رنگ نصب در منوی کناری کلیک کنید یا از منوی سه نقطه مرورگر، گزینه <span className="font-bold text-slate-700">Add to Home screen</span> یا <span className="font-bold text-slate-700">Install app</span> را انتخاب نمایید.</div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                <div className="font-bold text-slate-800">۲. در آیفون و آیپد (مرورگر Safari):</div>
                <div className="pr-3 text-[11px] text-slate-500">در پایین صفحه روی دکمه اشتراک‌گذاری <span className="font-bold text-slate-700">Share</span> (آیکون مربع با فلش رو به بالا) بزنید و از منوی باز شده، گزینه <span className="font-bold text-slate-700">Add to Home Screen</span> را انتخاب کنید.</div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                <div className="font-bold text-slate-800">۳. در کامپیوتر و لپ‌تاپ (Chrome / Edge):</div>
                <div className="pr-3 text-[11px] text-slate-500">در نوار آدرس بالای مرورگر، روی آیکون نصب (شبیه مانیتور یا علامت مثبت) کلیک کنید.</div>
              </div>
            </div>

            {/* Close button */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                id="close-install-guide-btn"
                onClick={() => setShowInstallGuide(false)}
                className="px-5 py-2 text-xs font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl cursor-pointer transition-colors"
              >
                متوجه شدم
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
