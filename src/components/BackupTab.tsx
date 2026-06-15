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
  RefreshCw,
  Trash2
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
  wipeAllData?: () => void;
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
  wipeAllData,
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

  // Wiping confirmation states
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [wipeConfirmText, setWipeConfirmText] = useState<string>('');

  // Active session and unique ID for dynamic non-overwriting filenames
  const [sessionKey, setSessionKey] = useState<string>(() => {
    return localStorage.getItem('backup_session_key') || 'INIT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  });

  const regenerateSessionKey = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newKey = `SESS_${randomSuffix}`;
    setSessionKey(newKey);
    localStorage.setItem('backup_session_key', newKey);
    return newKey;
  };

  // Load and check support
  useEffect(() => {
    setIsDirSupported('showDirectoryPicker' in window);

    // Load persisted Directory Handle from IndexedDB
    getHandleFromDB().then(async (handle) => {
      if (handle) {
        setDirHandle(handle);
        setDirName(handle.name || 'پوشه بکاپ');
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
      // Non-destructively look for active live backup file inside the connected folder
      const fileH = await handle.getFileHandle(`coworking_live_backup_${sessionKey}.json`, { create: false });
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
        const newKey = regenerateSessionKey();
        showToast('success', `بازیابی با موفقیت انجام شد. شناسه بکاپ جدید: ${newKey}`);
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
        const newKey = regenerateSessionKey();
        triggerHistoryBackup(text);
        showToast('success', `پرونده با موفقیت وارد و فعال شد. شناسه بکاپ: ${newKey}`);
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
      let fileName = `coworking_live_backup_${sessionKey}.json`;
      if (isRolling) {
        const now = new Date();
        const datePart = now.toLocaleDateString('fa-IR').replace(/\//g, '-');
        const timePart = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        fileName = `coworking_backup_roll_${sessionKey}_${datePart}_${timePart}.json`;
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
      const newKey = regenerateSessionKey();
      showToast('success', `داده‌های پشتیبان با موفقیت در نرم‌افزار بازیابی و فعال شدند. شناسه جدید: ${newKey}`);
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

      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <div id="wipe-confirmation-modal" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
          <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-right flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex items-center gap-3 pr-1 pb-3 border-b border-rose-50 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/50">
                <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-800 leading-tight">
                  هشدار امنیتی بسیار مهم!
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  شما در حال پاک‌سازی و حذف کامل کل پایگاه داده سیستم هستید.
                </p>
              </div>
            </div>

            {/* Warning Details */}
            <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3.5 text-[11px] leading-relaxed text-rose-850 flex flex-col gap-2">
              <p>🔴 <b>این عملیات غیرقابل بازگشت است.</b> تمامی اطلاعات شامل موارد زیر برای همیشه از روی این مرورگر حذف خواهند شد:</p>
              <ul className="list-disc list-inside space-y-1 text-[10.5px] text-rose-700 pr-2">
                <li>لیست کامل اعضا و مشترکین ({members.length} نفر)</li>
                <li>قراردادها و طرح‌های عضویت فعال ({terms.length} مورد)</li>
                <li>تمامی شیفت‌های کاری تعریف شده ({shifts.length} شیفت)</li>
                <li>تمام یادداشت‌های جلسات و گزارش حضور و غیاب‌ها</li>
              </ul>
              
              <div className="mt-1.5 p-2 bg-amber-55 border border-amber-200/60 rounded-xl text-[9.5px]/1.4 text-amber-800">
                <b>💡 تدبیر ایمنی خودکار:</b> جهت محافظت از هارددیسک و پیشگیری از رونویسی تصادفی داده پیشین با محتوای خالی، اتصال پوشه متصل شده به صورت خودکار پیش از پاک‌سازی قطع خواهد شد.
              </div>
            </div>

            {/* Confirmation verification input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="wipe-confirm-input" className="text-[10.5px] text-slate-500 font-bold">
                جهت تایید نهایی، کلمه <span className="text-rose-650 font-extrabold">"حذف"</span> را در کادر زیر بنویسید:
              </label>
              <input
                id="wipe-confirm-input"
                type="text"
                placeholder="حذف"
                autoComplete="off"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                className="w-full h-10 px-3 py-1 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white rounded-xl text-center text-xs font-black transition-colors outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowWipeConfirm(false);
                  setWipeConfirmText('');
                }}
                className="px-4.5 h-10 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer transition-colors"
              >
                انصراف و بازگشت
              </button>
              
              <button
                type="button"
                id="do-wipe-confirm-btn"
                onClick={() => {
                  if (wipeConfirmText === 'حذف') {
                    // Safety Precaution: disconnect local backup prior to state wipe to avoid zero-byte live backup file writing
                    if (dirHandle) {
                      handleDisconnectDir();
                    }
                    if (wipeAllData) wipeAllData();
                    setShowWipeConfirm(false);
                    setWipeConfirmText('');
                    showToast('success', 'تمامی اطلاعات به صورت کامل پاک‌سازی و ریست شدند.');
                  }
                }}
                disabled={wipeConfirmText !== 'حذف'}
                className="px-5 h-10 text-xs font-black bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl transition-all shadow-sm active:scale-95 disabled:pointer-events-none cursor-pointer"
              >
                تایید پاک‌سازی کامل
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dynamic Slim Header Bar */}
      <div id="backup-header-toolbar" className="flex justify-between items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-5xs gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/50">
            <HardDrive className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-xs font-black text-slate-800 tracking-tight leading-none select-none">
            مدیریت پشتیبان‌ها
          </h1>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Actions Container */}
          <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-lg p-0.5" dir="ltr">
            {/* Download/Export manual JSON */}
            <button
              type="button"
              id="export-manual-btn-icon"
              onClick={triggerManualDownload}
              title="بارگیری فایل پشتیبان دستی (JSON)"
              className="p-1 hover:bg-white text-slate-550 hover:text-indigo-600 rounded duration-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <span className="w-[1px] h-3 bg-slate-200 self-center mx-0.5" />
            {/* Upload/Import manual JSON */}
            <div className="relative inline-flex">
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
                className="p-1 hover:bg-white text-slate-550 hover:text-indigo-600 rounded duration-100 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="w-[1px] h-3 bg-slate-200 self-center mx-0.5" />
            {/* WIPE ALL DATA - Sleek Crimson Button with Warning Tooltip */}
            <button
              type="button"
              id="header-wipe-data-action"
              onClick={() => setShowWipeConfirm(true)}
              title="پاک‌سازی کامل اطلاعات (بازنشانی کارخانه)"
              className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-650 rounded duration-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Slim Autosave Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 rounded-lg px-2 h-6.5 select-none" title="ذخیره خودکار پیش‌فرض">
            <span className="text-[9px] text-slate-500 font-extrabold">ذخیره خودکار</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="auto-save-toggle"
                checked={autoSaveEnabled}
                onChange={(e) => handleToggleAutoSave(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-6.5 h-3.5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-3 duration-100"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Directory Connection Ribbon Bar - Ultra Slim, High Density */}
      <div 
        id="dir-connection-ribbon" 
        onClick={!dirHandle && isDirSupported ? handleSelectSystemDir : undefined}
        className={`px-3 py-1.5 rounded-xl border transition-all duration-150 shrink-0 flex items-center justify-between gap-3 min-h-[36px] ${
          !dirHandle ? 'border-dashed border-indigo-200 bg-indigo-50/15 hover:bg-indigo-50/25 hover:border-indigo-400 cursor-pointer' : 'bg-white border-slate-200'
        }`}
      >
        {dirHandle ? (
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Status & Connected Folder Name */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                dirPermissionStatus === 'granted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'
              }`} />
              <div className="flex items-center gap-1.5 min-w-0 text-[10px] flex-wrap">
                <span className="text-slate-400 font-medium">ذخیره خودکار:</span>
                <span className="font-mono text-slate-800 font-bold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded max-w-[120px] truncate" title={dirName}>
                  {dirName}
                </span>
                {dirPermissionStatus !== 'granted' && (
                  <span className="text-[8px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded-sm font-extrabold leading-none animate-pulse">نیاز به مجوز</span>
                )}
                <span className="text-slate-400 font-medium mr-1.5">شناسه فعال:</span>
                <span className="font-mono text-indigo-750 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-extrabold" title="پس از بازیابی به شناسه جدیدی تبدیل می‌شود تا رونویسی پیش نیاید">
                  {sessionKey}
                </span>
              </div>
            </div>

            {/* Config & Directory Operations */}
            <div className="flex items-center gap-1 shrink-0">
              {dirPermissionStatus !== 'granted' ? (
                <button
                  type="button"
                  id="grant-dir-access-btn"
                  onClick={handleRequestDirPermission}
                  className="px-2 h-5.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-black flex items-center gap-1 transition-all cursor-pointer"
                  title="تایید دسترسی خواندن و نوشتن فایل در کامپیوتر"
                >
                  <RefreshCw className="w-2.5 h-2.5 text-white animate-spin duration-[4000ms]" />
                  <span>تایید مجوز</span>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    id="save-rolling-backup-btn"
                    onClick={() => writeCurrentStateToDir(dirHandle, true)}
                    className="p-1 bg-slate-50 hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded shrink-0"
                    title="ثبت پشتیبان زمان‌دار جدید در پوشه سیستم"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    id="quick-save-dir-btn"
                    onClick={() => writeCurrentStateToDir(dirHandle, false)}
                    className="p-1 bg-slate-50 hover:bg-emerald-50 text-emerald-600 border border-slate-200 rounded shrink-0"
                    title="به‌روزرسانی فوری فایل پشتیبان"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <button
                type="button"
                id="disconnect-dir-btn"
                onClick={handleDisconnectDir}
                className="px-1.5 h-5.5 text-[8.5px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded cursor-pointer leading-none"
                title="قطع پیوند پوشه جاری با نرم‌افزار"
              >
                قطع رمزارز
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 w-full select-none">
            {/* Linked information */}
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-550 shrink-0" />
              <div className="flex items-center gap-1 text-[10px] text-slate-500 min-w-0">
                <span className="font-extrabold text-slate-700">اتصال هارد دیسک:</span>
                <span className="truncate max-w-[280px]">برای ذخیره خودکار در درایو فیزیکی کامپیوتر کلیک کنید.</span>
                
                {/* Minimal Warning Icon with iframe limitations as Tooltip */}
                <div 
                  className="inline-flex text-amber-600 hover:text-amber-700 cursor-help"
                  title="مرورگرها در حالت عادی (iframe) به دلایل امنیتی دسترسی به پوشه را مسدود می‌کنند. در صورت عدم اقدام، دکمه 'Open in new window' در نوار بالا را بفشارید."
                >
                  <AlertTriangle className="w-3 h-3 animate-pulse inline self-center mr-0.5" />
                </div>
              </div>
            </div>

            {/* Quick Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {!isDirSupported && (
                <span className="text-[8.5px] text-rose-500 font-extrabold bg-rose-50/60 border border-rose-100 px-1 py-0.5 rounded" title="مرورگر شما از API پوشه پشتیبانی نمی‌کند">غیرپشتیبانی</span>
              )}
              <button
                type="button"
                id="connect-backup-dir-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSystemDir();
                }}
                disabled={!isDirSupported}
                className="px-2.5 h-6.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
              >
                <FolderOpen className="w-3 h-3" />
                <span>اتصال پوشه</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Security & Risky Backup Warnings */}
      <div className="bg-amber-50/40 border border-amber-200/50 p-2 text-[10.5px] text-amber-900 shrink-0 leading-normal select-none rounded-xl">
        <div className="flex items-center gap-1.5 font-black text-amber-950 mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>ریسک‌های امنیتی بکاپ‌گیری در مرورگر:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[9.5px] text-slate-500 leading-relaxed font-semibold">
          <div className="bg-white/50 border border-amber-100/50 p-1.5 rounded-lg flex items-start gap-1">
            <span className="text-amber-700 font-extrabold shrink-0">۱.</span>
            <span>پاک‌سازی تاریخچه سایت یا باز کردن در حالت ناشناس (Incognito) بکاپ‌های محلی ذخیره شده را کلاً حذف می‌کند.</span>
          </div>
          <div className="bg-white/50 border border-amber-100/50 p-1.5 rounded-lg flex items-start gap-1">
            <span className="text-amber-700 font-extrabold shrink-0">۲.</span>
            <span>ذخیره خودکار روی فایل‌های هارد دیسک بدون تغییر شناسه، نسخه معتبر پیشین را بدون اخطار رونویسی می‌کند.</span>
          </div>
          <div className="bg-white/50 border border-amber-100/50 p-1.5 rounded-lg flex items-start gap-1">
            <span className="text-amber-700 font-extrabold shrink-0">۳.</span>
            <span>پاک‌سازی کامل دیتابیس بدون قطع اتصال پوشه دیسک، فوراً دیتای معتبر پشتیبان را از هارد شما حذف می‌کند.</span>
          </div>
        </div>
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
