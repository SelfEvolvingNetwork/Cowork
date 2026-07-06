import React from 'react';
import { useCoworkingState } from './hooks/useCoworkingState';
import { RightSidebar } from './components/RightSidebar';
import { CalendarTab } from './components/CalendarTab';
import { ReportsTab } from './components/ReportsTab';
import { ProfileTab } from './components/ProfileTab';
import { ShiftsTable } from './components/ShiftsTable';
import { BackupTab } from './components/BackupTab';
import { AlertCircle, ShieldAlert, CheckCircle2, X } from 'lucide-react';

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
    localHistory,
    setLocalHistory,
    dialogError,
    closeErrorDialog,
    isSyncing,
    lastSyncedTime,
    manualSync,
  } = useCoworkingState();

  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((curr) => curr?.text === text ? null : curr);
    }, 4500);
  };

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

  return (
    <div id="app-root-layout" className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans" dir="rtl">
      
      {/* 1. Sidebar on the RIGHT (Traditional RTL flow) */}
      <RightSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSyncing={isSyncing}
        lastSyncedTime={lastSyncedTime}
        manualSync={handleManualSync}
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
              localHistory={localHistory}
              setLocalHistory={setLocalHistory}
            />
          </div>
        </div>

        {/* Footer Area - No tech bloat as per constraints */}
        {!(activeTab === 'profile' || activeTab === 'reports' || activeTab === 'calendar' || activeTab === 'backup') && (
          <footer className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 font-sans">
            <span>سامانه مدیریت فضای کار اشتراکی</span>
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

    </div>
  );
}
