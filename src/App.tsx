import React from 'react';
import { useCoworkingState } from './hooks/useCoworkingState';
import { RightSidebar } from './components/RightSidebar';
import { CalendarTab } from './components/CalendarTab';
import { ReportsTab } from './components/ReportsTab';
import { ProfileTab } from './components/ProfileTab';
import { ShiftsTable } from './components/ShiftsTable';
import { BackupTab } from './components/BackupTab';
import { AlertCircle, ShieldAlert } from 'lucide-react';

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
    localHistory,
    setLocalHistory,
    dialogError,
    closeErrorDialog,
  } = useCoworkingState();

  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(null);

  // Render the proper tab content based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'calendar':
        return (
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
        );
      case 'reports':
        return (
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
        );
      case 'profile':
        return (
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
        );
      case 'shifts':
        return (
          <ShiftsTable
            shifts={shifts}
            addShift={addShift}
            updateShift={updateShift}
            deleteShift={deleteShift}
          />
        );
      default:
        return (
          <div className="text-center font-bold text-slate-500 py-12">
            بخش مورد نظر پیدا نشد
          </div>
        );
    }
  };

  return (
    <div id="app-root-layout" className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans" dir="rtl">
      
      {/* 1. Sidebar on the RIGHT (Traditional RTL flow) */}
      <RightSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. Main Content Container on the LEFT */}
      <main id="main-content-flow" className={`flex-1 h-full flex flex-col p-[10px] w-full max-w-7xl mx-auto ${
        (activeTab === 'profile' || activeTab === 'reports' || activeTab === 'calendar' || activeTab === 'backup') ? 'overflow-hidden pb-0' : 'overflow-y-auto'
      }`}>
        
        {/* Render Selected View */}
        <div className={(activeTab === 'profile' || activeTab === 'reports' || activeTab === 'calendar' || activeTab === 'backup') ? 'flex-1 min-h-0 flex flex-col' : 'flex-1'}>
          {activeTab !== 'backup' && renderTabContent()}

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

    </div>
  );
}
