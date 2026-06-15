import React, { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Clock,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { Member, Shift, Term, SessionNotes, SessionAttendance, CalendarOverrides, CoworkingConfig } from '../types';
import { saveHandleToDB, getHandleFromDB, deleteHandleFromDB } from '../utils/backupIndexedDb';
import { BackupConflictDialog } from './BackupConflictDialog';
import { BackupHistoryTable, LocalHistoryItem } from './BackupHistoryTable';

interface BackupTabProps {
  config: CoworkingConfig;
  updateConfig: (cfg: CoworkingConfig) => void;
  shifts: Shift[];
  members: Member[];
  terms: Term[];
  sessionNotes: SessionNotes;
  sessionAttendance: SessionAttendance;
  calendarOverrides: CalendarOverrides;
  saveSessionNote: (termId: string, dateStr: string, note: string) => void;
  saveSessionAttendance: (termId: string, dateStr: string, status: 'present' | 'absent' | '') => void;
  importBackupData: (json: string) => boolean;
  localHistory: LocalHistoryItem[];
  setLocalHistory: React.Dispatch<React.SetStateAction<LocalHistoryItem[]>>;
}

export function BackupTab({
  config,
  shifts,
  members,
  terms,
  sessionNotes,
  sessionAttendance,
  calendarOverrides,
  importBackupData,
  localHistory,
  setLocalHistory,
}: BackupTabProps) {
  // File System Access API State
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autosave_enabled') !== 'false';
  });
  const [isWriting, setIsWriting] = useState<boolean>(false);
  
  // Directory Handle State for PWA Backup Folder
  const [dirHandle, setDirHandle] = useState<any>(null);
  const [dirName, setDirName] = useState<string>('');
  const [dirPermissionStatus, setDirPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isDirSupported, setIsDirSupported] = useState<boolean>(true);
  
  // Backup Conflict Resolution State
  const [conflictBackup, setConflictBackup] = useState<{
    handle: any;
    existingData: any;
    currentData: any;
  } | null>(null);
 
  const [notification, setNotification] = useState<{ type: 'success' | 'refused' | 'error'; text: string; } | null>(null);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load and check support
  useEffect(() => {
    setIsDirSupported('showDirectoryPicker' in window);

    // Load persisted Directory Handle from IndexedDB
    getHandleFromDB().then(async (handle) => {
      if (handle) {
        setDirHandle(handle);
        setDirName(handle.name || 'پوشه پیش‌فرض بکاپ');
        try {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          setDirPermissionStatus(perm);
          if (perm === 'granted') {
            // Check for existing backup in folder and handle safely instead of auto-overwriting
            await checkBackupConflictAndSync(handle);
          }
        } catch (e) {
          console.warn('Failed to query stored directory permission on mount:', e);
        }
      }
    }).catch(err => {
      console.warn('IndexedDB retrieval error:', err);
    });
  }, []);

  // Format the full system current state JSON
  const getFullBackupJSON = () => {
    const stateObj = {
      config,
      shifts,
      members,
      terms,
      notes: sessionNotes,
      attendance: sessionAttendance,
      overrides: calendarOverrides,
      exportedAt: new Date().toISOString(),
      appVersion: '1.2.0'
    };
    return JSON.stringify(stateObj, null, 2);
  };

  // Check if existing backup in the connected folder differs from current app state
  const checkBackupConflictAndSync = async (handle: any) => {
    if (!handle) return;
    try {
      // Non-destructively look for coworking_live_backup.json inside the connected folder
      const fileH = await handle.getFileHandle('coworking_live_backup.json', { create: false });
      const file = await fileH.getFile();
      const text = await file.text();
      let existingData;
      try {
        existingData = JSON.parse(text);
      } catch (parseErr) {
        console.warn('Parsing failed on existing directory backup, overwriting with fresh data:', parseErr);
        await writeCurrentStateToDir(handle, false);
        return;
      }

      const currentData = {
        config,
        shifts,
        members,
        terms,
        notes: sessionNotes,
        attendance: sessionAttendance,
        overrides: calendarOverrides,
      };

      // Check if data is exactly identical
      const isSame = 
        JSON.stringify(existingData.members || []) === JSON.stringify(currentData.members || []) &&
        JSON.stringify(existingData.shifts || []) === JSON.stringify(currentData.shifts || []) &&
        JSON.stringify(existingData.terms || []) === JSON.stringify(currentData.terms || []) &&
        JSON.stringify(existingData.notes || {}) === JSON.stringify(currentData.notes || {}) &&
        JSON.stringify(existingData.attendance || {}) === JSON.stringify(currentData.attendance || {}) &&
        JSON.stringify(existingData.overrides || {}) === JSON.stringify(currentData.overrides || {});

      if (isSame) {
        // Aligned and identical, no popups needed
        return;
      }

      // Populate conflict data and show safety popup
      setConflictBackup({
        handle,
        existingData,
        currentData,
      });

    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // No prior live backup exists in folder, safe to perform initial write
        await writeCurrentStateToDir(handle, false);
      } else {
        console.warn('Error reading existing directory backup:', err);
      }
    }
  };

  // Helper to trigger system file download (fallback & manual export)
  const triggerManualDownload = () => {
    try {
      const json = getFullBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const timeStr = `${now.getHours()}-${now.getMinutes()}`;
      a.href = url;
      a.download = `coworking-backup-1405-${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      triggerHistoryBackup(json);
      showToast('success', 'فایل پشتیبان با موفقیت دانلود شد.');
    } catch (err: any) {
      showToast('error', 'خطا در بارگذاری خروجی.');
    }
  };

  const triggerHistoryBackup = (jsonString: string) => {
    const now = new Date();
    const jalaliTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const jalaliDate = now.toLocaleDateString('fa-IR');
    const timestampStr = `${jalaliDate} - ${jalaliTime}`;

    setLocalHistory((prev) => {
      try {
        const currentData = JSON.parse(jsonString);
        
        // 1. Prevent automatic empty backup creations if there is no real user data
        if (
          (!currentData.members || currentData.members.length === 0) &&
          (!currentData.shifts || currentData.shifts.length === 0) &&
          (!currentData.terms || currentData.terms.length === 0)
        ) {
          return prev;
        }

        // 2. Prevent duplicate backup entries where data hasn't changed
        if (prev.length > 0) {
          const lastData = JSON.parse(prev[0].data);
          const isSame = 
            JSON.stringify(currentData.members) === JSON.stringify(lastData.members) &&
            JSON.stringify(currentData.shifts) === JSON.stringify(lastData.shifts) &&
            JSON.stringify(currentData.terms) === JSON.stringify(lastData.terms) &&
            JSON.stringify(currentData.notes) === JSON.stringify(lastData.notes) &&
            JSON.stringify(currentData.attendance) === JSON.stringify(lastData.attendance) &&
            JSON.stringify(currentData.overrides) === JSON.stringify(lastData.overrides);
          
          if (isSame) {
            return prev; // Skip duplicate history item
          }
        }
      } catch (e) {
        console.error("Error checking backup uniqueness:", e);
      }

      // Keep only up to 5 history items
      const updated = [
        {
          id: 'hist-' + Date.now(),
          timestamp: timestampStr,
          recordsCount: {
            members: members.length,
            terms: terms.length,
            attendance: Object.keys(sessionAttendance).filter(k => sessionAttendance[k]).length,
          },
          data: jsonString
        },
        ...prev.slice(0, 4)
      ];
      localStorage.setItem('coworking_backup_history', JSON.stringify(updated));
      return updated;
    });
  };

  const showToast = (type: 'success' | 'refused' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => curr?.text === text ? null : curr);
    }, 4500);
  };

  const handleRestoreFromHistory = (item: LocalHistoryItem) => {
    if (confirm('داده‌های فعلی جایگزین شوند؟')) {
      const success = importBackupData(item.data);
      if (success) {
        showToast('success', 'بازیابی با موفقیت انجام شد.');
      } else {
        showToast('error', 'خطا در بازیابی داده‌ها.');
      }
    }
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalHistory((prev) => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('coworking_backup_history', JSON.stringify(updated));
      return updated;
    });
    showToast('success', 'پشتیبان حذف شد.');
  };

  const handleJsonFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const success = importBackupData(text);
      if (success) {
        triggerHistoryBackup(text);
        showToast('success', 'بازیابی با موفقیت انجام شد.');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        showToast('error', 'فرمت فایل بارگذاری شده معتبر نیست.');
      }
    };
    reader.readAsText(file);
  };

  // Write Current State to Selected Directory
  const writeCurrentStateToDir = async (handle: any, isRolling = false) => {
    if (!handle) return;
    setIsWriting(true);
    try {
      const json = getFullBackupJSON();
      
      // Determine file name
      let fileName = 'coworking_live_backup.json';
      if (isRolling) {
        const now = new Date();
        const datePart = now.toLocaleDateString('fa-IR').replace(/\//g, '-');
        const timePart = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        fileName = `coworking_backup_${datePart}_${timePart}.json`;
      }

      const fileH = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileH.createWritable();
      await writable.write(json);
      await writable.close();

      triggerHistoryBackup(json);

      if (isRolling) {
        showToast('success', `فایل بکاپ زمان‌دار جدید در پوشه ایجاد شد.`);
      }
    } catch (err: any) {
      console.warn('Failed to write backup into selected directory:', err);
      // Fallback: silent store in history
      const json = getFullBackupJSON();
      triggerHistoryBackup(json);
      showToast('error', 'خطا در ذخیره خودکار در پوشه.');
    } finally {
      setIsWriting(false);
    }
  };

  // Select and persist backup folder
  const handleSelectSystemDir = async () => {
    try {
      if (!isDirSupported) {
        showToast('error', 'مرورگر شما از انتخاب پوشه پشتیبانی نمی‌کند.');
        return;
      }
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
      setDirName(handle.name || 'پوشه پشتیبان عمومی');
      setDirPermissionStatus('granted');
      await saveHandleToDB(handle);
      showToast('success', 'پوشه بکاپ متصل و با موفقیت ذخیره شد.');
      
      // Safety check for conflicts instead of immediate blind overwrite
      await checkBackupConflictAndSync(handle);
    } catch (err: any) {
      console.warn('Directory Picker disallowed or failed:', err);
      showToast('refused', 'پوشه انتخاب نشد یا دسترسی رد شد.');
    }
  };

  // Request directory permission (acting on user gesture / button click)
  const handleRequestDirPermission = async () => {
    if (!dirHandle) return;
    try {
      const status = await dirHandle.requestPermission({ mode: 'readwrite' });
      setDirPermissionStatus(status);
      if (status === 'granted') {
        showToast('success', 'دسترسی خواندن و نوشتن پوشه تایید شد.');
        // Safety check for conflicts after granting permission
        await checkBackupConflictAndSync(dirHandle);
      } else {
        showToast('refused', 'دسترسی رد شد.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'خطای تایید دسترسی.');
    }
  };

  // Conflict Resolution: Restore backup file from connected directory into React app
  const handleResolveRestore = () => {
    if (!conflictBackup) return;
    const success = importBackupData(JSON.stringify(conflictBackup.existingData));
    if (success) {
      showToast('success', 'داده‌های پشتیبان با موفقیت در نرم‌افزار بازیابی شدند.');
    } else {
      showToast('error', 'خطا در بازیابی داده‌ها. فرمت فایل نامعتبر است.');
    }
    setConflictBackup(null);
  };

  // Conflict Resolution: Overwrite connected directory's backup with app's current state
  const handleResolveOverwrite = async () => {
    if (!conflictBackup) return;
    await writeCurrentStateToDir(conflictBackup.handle, false);
    showToast('success', 'فایل پوشه با اطلاعات جاری نرم‌افزار بازنویسی شد.');
    setConflictBackup(null);
  };

  // Conflict Resolution: Archive old backup by copying content, then save new state to live backup
  const handleResolveArchiveAndSave = async () => {
    if (!conflictBackup) return;
    try {
      const handle = conflictBackup.handle;
      const existingJson = JSON.stringify(conflictBackup.existingData, null, 2);

      const now = new Date();
      // Format simple local date and time digits to avoid slashes in file name
      const datePart = now.toLocaleDateString('fa-IR').replace(/\//g, '-');
      const timePart = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
      const archiveFileName = `coworking_backup_archived_${datePart}_${timePart}.json`;

      // 1. Create archived backup file and write existing folder's backup contents into it
      const archiveFileH = await handle.getFileHandle(archiveFileName, { create: true });
      const archiveWritable = await archiveFileH.createWritable();
      await archiveWritable.write(existingJson);
      await archiveWritable.close();

      // 2. Write current app's state cleanly to the live backup file
      await writeCurrentStateToDir(handle, false);
      showToast('success', 'فایل قبلی با موفقیت آرشیو شد و پشتیبان جدید ایجاد گردید.');
    } catch (err) {
      console.error('Failed to archive existing backup:', err);
      showToast('error', 'خطا در آرشیو کردن پشتیبان قدیمی.');
    } finally {
      setConflictBackup(null);
    }
  };

  // Conflict Resolution: Cancel connection and unlink directory safely
  const handleResolveCancelAndDisconnect = async () => {
    await handleDisconnectDir();
    setConflictBackup(null);
  };

  // Disconnect backup folder
  const handleDisconnectDir = async () => {
    setDirHandle(null);
    setDirName('');
    setDirPermissionStatus('prompt');
    await deleteHandleFromDB();
    showToast('success', 'اتصال پوشه قطع شد.');
  };

  const handleToggleAutoSave = (val: boolean) => {
    setAutoSaveEnabled(val);
    localStorage.setItem('autosave_enabled', val ? 'true' : 'false');
    showToast('success', `ذخیره خودکار ${val ? 'فعال' : 'غیرفعال'} شد.`);
  };

  // Auto-save logic triggers after changes, preferring the directory handle if valid
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only allow background write if no conflict remains unresolved
    if (autoSaveEnabled && !conflictBackup) {
      const timer = setTimeout(() => {
        if (dirHandle && dirPermissionStatus === 'granted') {
          writeCurrentStateToDir(dirHandle, false);
        } else {
          // Fallback to storing in state-controlled LocalStorage history
          const json = getFullBackupJSON();
          triggerHistoryBackup(json);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [config, shifts, members, terms, sessionNotes, sessionAttendance, calendarOverrides, autoSaveEnabled, dirHandle, dirPermissionStatus, conflictBackup]);

  return (
    <div id="backup-manager-view" className="flex-1 flex flex-col h-full bg-slate-50/10 rounded-2xl border border-slate-200/50 overflow-hidden animate-fade-in font-sans p-[10px] space-y-3">
      
      {/* Conflict Resolution Dialog Modal */}
      {conflictBackup && (
        <BackupConflictDialog
          conflictBackup={conflictBackup}
          onResolveArchiveAndSave={handleResolveArchiveAndSave}
          onResolveRestore={handleResolveRestore}
          onResolveOverwrite={handleResolveOverwrite}
          onResolveCancelAndDisconnect={handleResolveCancelAndDisconnect}
        />
      )}

      {/* Toast Notice Banner - Compact Floating */}
      {notification && (
        <div id="toast-banner" className={`fixed top-4 left-4 z-50 px-4 py-3 rounded-xl border flex items-center gap-2.5 shadow-xl text-xs font-semibold leading-relaxed animate-slide-up ${
          notification.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' :
          notification.type === 'refused' ? 'bg-amber-50/95 border-amber-200 text-amber-800' :
          'bg-rose-50/95 border-rose-200 text-rose-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Dynamic Slim Header Bar */}
      <div id="backup-header-toolbar" className="flex justify-between items-center bg-white p-[10px] rounded-2xl border border-slate-200 shadow-3xs flex-wrap gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7.5 h-7.5 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-4xs">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>سامانه پشتیبان‌گیری داده‌ها</span>
            </h1>
          </div>
        </div>

        {/* Global Controls: Autosave + Manual Icons (Download & Upload) */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl p-0.5 shadow-5xs" dir="ltr">
            {/* Download/Export manual JSON */}
            <button
              type="button"
              id="export-manual-btn-icon"
              onClick={triggerManualDownload}
              title="دانلود خروجی پشتیبان دستی (قالب JSON)"
              className="p-1.5 hover:bg-white text-slate-500 hover:text-indigo-655 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <span className="w-[1px] h-4 bg-slate-200 self-center" />
            {/* Upload/Import manual JSON */}
            <div className="relative">
              <input
                type="file"
                id="pwa-import-file-input-icon"
                ref={fileInputRef}
                accept=".json"
                onChange={handleJsonFileInput}
                className="hidden"
              />
              <button
                type="button"
                id="trigger-import-btn-icon"
                onClick={() => fileInputRef.current?.click()}
                title="بارگذاری و بازیابی فایل نسخه پشتیبان"
                className="p-1.5 hover:bg-white text-slate-500 hover:text-indigo-655 rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Autosave Switch */}
          <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-4xs" title="ذخیره خودکار تغییرات در پس‌زمینه">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] text-slate-500 font-bold select-none cursor-default">ذخیره خودکار</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="auto-save-toggle"
                checked={autoSaveEnabled}
                onChange={(e) => handleToggleAutoSave(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-600 transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 animate-none"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Directory Connection Ribbon Bar - Narrow, Space Saving */}
      <div id="dir-connection-ribbon" className="bg-white px-3 py-2 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-3xs flex-wrap min-h-[46px]">
        {dirHandle ? (
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-between flex-wrap">
            {/* Status & Connected Folder Name */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                dirPermissionStatus === 'granted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
              }`} />
              <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                <span className="text-slate-400">پوشه ذخیره خودکار:</span>
                <span className="font-mono text-slate-800 font-bold bg-slate-50 border border-slate-100/60 px-2 py-0.5 rounded-lg select-all max-w-[200px] truncate" title={dirName}>
                  {dirName}
                </span>
                {dirPermissionStatus !== 'granted' && (
                  <span className="text-[10px] text-amber-600 bg-amber-55 px-2 py-0.5 rounded-md font-bold">تایید دسترسی لازم است</span>
                )}
              </div>
            </div>

            {/* Config & Directory Operations */}
            <div className="flex items-center gap-1.5 shrink-0">
              {dirPermissionStatus !== 'granted' ? (
                <button
                  type="button"
                  id="grant-dir-access-btn"
                  onClick={handleRequestDirPermission}
                  className="px-3 h-7.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-white animate-spin duration-[4000ms]" />
                  <span>تایید دسترسی نوشتن</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    id="save-rolling-backup-btn"
                    onClick={() => writeCurrentStateToDir(dirHandle, true)}
                    className="px-2.5 h-7.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="ایجاد فایل بکاپ زمان‌دار مجزا در پوشه"
                  >
                    <Save className="w-3 h-3" />
                    <span>پشتیبان زمان‌دار جدید</span>
                  </button>
                  <button
                    type="button"
                    id="quick-save-dir-btn"
                    onClick={() => writeCurrentStateToDir(dirHandle, false)}
                    className="px-2.5 h-7.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-150 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="به‌روزرسانی فوری فایل پشتیبان اصلی در پوشه"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>بروزرسانی فوری</span>
                  </button>
                </div>
              )}
              
              <button
                type="button"
                id="disconnect-dir-btn"
                onClick={handleDisconnectDir}
                className="px-2.5 h-7.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded-xl text-[10px] font-bold flex items-center transition-all cursor-pointer"
                title="قطع پیوند پوشه جاری"
              >
                <span>قطع اتصال</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-grow flex-wrap">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>پوشه محلی متصل نیست. برای همگام‌سازی دائمی و ذخیره تغییرات روی درایو سیستم، پوشه‌ای را انتخاب کنید.</span>
            </div>
            
            <div className="flex items-center gap-2">
              {!isDirSupported && (
                <span className="text-[9.5px] text-rose-500 font-bold bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg">انتخاب پوشه در مرورگر شما پشتیبانی نمی‌شود</span>
              )}
              <button
                type="button"
                id="connect-backup-dir-btn"
                onClick={handleSelectSystemDir}
                disabled={!isDirSupported}
                className="px-3 h-7.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none shadow-5xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>اتصال پوشه پشتیبان‌گیری</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Local Backup History Table - High Density */}
      <BackupHistoryTable
        localHistory={localHistory}
        onRestore={handleRestoreFromHistory}
        onDelete={handleDeleteHistoryItem}
      />

    </div>
  );
}
