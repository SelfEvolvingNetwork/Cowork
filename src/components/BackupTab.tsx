import React, { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, 
  Download, 
  Upload, 
  Laptop, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Save, 
  Clock,
  Users,
  FileText,
  CheckSquare,
  FolderOpen,
  FolderCheck,
  RefreshCw,
  FolderDot
} from 'lucide-react';
import { Member, Shift, Term, SessionNotes, SessionAttendance, CalendarOverrides, CoworkingConfig } from '../types';

// IndexedDB Helper functions to persist Directory Handles across page loads in PWA
const DB_NAME = 'coworking_pwa_db_v2';
const STORE_NAME = 'handles_store';
const KEY_DIR = 'backup_dir_handle';

function saveHandleToDB(handle: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(handle, KEY_DIR);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function getHandleFromDB(): Promise<any | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY_DIR);
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function deleteHandleFromDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve();
        return;
      }
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(KEY_DIR);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

interface LocalHistoryItem {
  timestamp: string;
  id: string;
  recordsCount: {
    members: number;
    terms: number;
    attendance: number;
  };
  data: string;
}

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
            // Write update automatically
            writeCurrentStateToDir(handle, false);
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
      
      // Conduct initial write
      await writeCurrentStateToDir(handle, false);
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
        await writeCurrentStateToDir(dirHandle, false);
      } else {
        showToast('refused', 'دسترسی رد شد.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'خطای تایید دسترسی.');
    }
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

    if (autoSaveEnabled) {
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
  }, [config, shifts, members, terms, sessionNotes, sessionAttendance, calendarOverrides, autoSaveEnabled, dirHandle, dirPermissionStatus]);

  return (
    <div id="backup-manager-view" className="flex-1 flex flex-col h-full bg-slate-50/10 rounded-2xl border border-slate-200/50 overflow-hidden animate-fade-in font-sans">
      
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

      {/* Slim Header & Action Row - High Density */}
      <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-3xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-slate-900 leading-tight">پشتیبان‌گیری هوشمند</h2>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">ذخیره، بازیابی و همگام‌سازی مستمر داده‌ها</p>
          </div>
        </div>

        {/* Global Autosave Toggle */}
        <div className="flex items-center gap-2.5 bg-slate-50/90 border border-slate-200/70 rounded-xl px-3 py-1.5 shadow-4xs" title="ذخیره خودکار تغییرات در پس‌زمینه">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[11px] text-slate-700 font-bold select-none cursor-default">ذخیره مستمر تغییرات</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="auto-save-toggle"
              checked={autoSaveEnabled}
              onChange={(e) => handleToggleAutoSave(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-600 transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
          </label>
        </div>
      </div>

      {/* Compact Main Layout: Split into top config panel and bottom history panel */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 min-h-0">
        
        {/* Core Actions Box */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex flex-col gap-3 shrink-0 relative overflow-hidden">
          {/* Subtle colored accent glow background */}
          <div className={`absolute top-0 right-0 w-1.5 h-full ${
            dirHandle && dirPermissionStatus === 'granted' ? 'bg-emerald-500' : dirHandle ? 'bg-amber-500' : 'bg-slate-200'
          }`} />
          
          <div className="flex items-start justify-between gap-1.5 pr-1.5">
            <div className="flex gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-4xs transition-colors ${
                dirHandle ? (dirPermissionStatus === 'granted' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') : 'bg-slate-50 text-slate-400 border border-slate-100'
              }`}>
                {dirHandle && dirPermissionStatus === 'granted' ? <FolderCheck className="w-4.5 h-4.5" /> : <FolderOpen className="w-4.5 h-4.5" />}
              </div>
              <div className="flex flex-col justify-center">
                <h4 className="text-xs font-black text-slate-800 leading-tight">پوشه ذخیره پشتیبان سیستم</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">انتخاب پوشه محلی برای همگام‌سازی فایل‌های بکاپ خارج از مرورگر</p>
              </div>
            </div>
            {dirHandle && (
              <span className={`text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full select-none ${
                dirPermissionStatus === 'granted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'
              }`}>
                {dirPermissionStatus === 'granted' ? 'همگام و متصل' : 'نیاز به تایید دسترسی'}
              </span>
            )}
          </div>

          {dirHandle ? (
            <div className="bg-slate-50/30 rounded-xl p-3 border border-slate-100 flex flex-col gap-3 mr-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-650 bg-white px-3 py-2 rounded-lg border border-slate-100/70 shadow-4xs">
                <span className="font-extrabold flex items-center gap-1.5">
                  <FolderDot className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  <span>پوشه فعال فعلی:</span>
                </span>
                <span className="font-mono text-slate-800 font-bold max-w-[200px] truncate bg-slate-50 px-2 py-0.5 rounded border border-slate-100/50" title={dirName}>
                  {dirName}
                </span>
              </div>

              {dirPermissionStatus !== 'granted' ? (
                <div className="flex flex-col gap-2 mt-0.5">
                  <div className="p-2.5 bg-amber-50/50 border border-amber-200/60 rounded-lg text-amber-800">
                    <p className="text-[10.5px] font-bold leading-normal">
                      مرورگر جهت امنیت نیاز به تایید مجدد دسترسی نوشتن به پوشه زیر دارد. لطفا تایید کنید:
                    </p>
                  </div>
                  <button
                    type="button"
                    id="grant-dir-access-btn"
                    onClick={handleRequestDirPermission}
                    className="w-full h-9.5 bg-amber-500 hover:bg-amber-600 hover:shadow-2xs active:scale-[0.99] text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin duration-1000" />
                    تایید دسترسی خواندن و نوشتن پوشه
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 mt-0.5">
                  <button
                    type="button"
                    id="save-rolling-backup-btn"
                    onClick={() => writeCurrentStateToDir(dirHandle, true)}
                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all hover:shadow-xs active:scale-[0.99] cursor-pointer"
                    title="یک فایل متراکم با تاریخ و ساعت دقیق در این پوشه ایجاد می‌کند"
                  >
                    <Save className="w-3.5 h-3.5 text-white/90" />
                    بکاپ زمان‌دار جدید
                  </button>
                  <button
                    type="button"
                    id="quick-save-dir-btn"
                    onClick={() => writeCurrentStateToDir(dirHandle, false)}
                    className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all hover:shadow-xs active:scale-[0.99] cursor-pointer"
                    title="فایل بکاپ پیش‌فرض را فورا بروزرسانی می‌کند"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-white/90" />
                    به‌روزرسانی فوری
                  </button>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  id="disconnect-dir-btn"
                  onClick={handleDisconnectDir}
                  className="text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-all font-extrabold cursor-pointer border border-transparent hover:border-rose-100"
                >
                  قطع پیوند و جداسازی پوشه
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mr-1.5">
              <div className="p-6 bg-slate-50/50 border border-dashed border-slate-205 rounded-2xl flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11.5px] text-slate-800 font-bold">هیچ پوشه‌ای متصل نشده است</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] leading-relaxed">برای حفظ ایمنی دائمی، یک پوشه محلی در درایو سیستم خود انتخاب کنید تا تمامی تغییرات داده‌ها بلافاصله پشتیبان‌گیری شود.</p>
                </div>
                <button
                  type="button"
                  id="connect-backup-dir-btn"
                  onClick={handleSelectSystemDir}
                  disabled={!isDirSupported}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer font-sans shadow-xs hover:shadow-sm active:scale-[0.99]"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  اتصال پوشه پشتیبان‌گیری عمومی
                </button>
              </div>
              {!isDirSupported && (
                <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-center">
                  <p className="text-[9px] font-bold leading-normal">
                    مرورگر شما از قابلیت دسترسی مستقیم به سیستم فایل پشتیبانی نمی‌کند. از دانلود دستی استفاده نمایید.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Small Ribbon for Manual File Actions */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          {/* Export Manual Download */}
          <button
            type="button"
            id="export-manual-btn-fixed"
            onClick={triggerManualDownload}
            className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200/65 hover:border-blue-400 hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer text-right group h-12"
          >
            <div className="w-7.5 h-7.5 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold group-hover:bg-blue-100 transition-colors shadow-4xs">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-black text-slate-800 leading-none group-hover:text-blue-700 transition-colors">دانلود نسخه پشتیبان دستی</span>
              <span className="block text-[9px] text-slate-400 font-medium mt-1 leading-none">دانلود فایل فشرده با فرمت JSON</span>
            </div>
          </button>

          {/* Import Manual Recovery File */}
          <div className="relative h-12 select-none">
            <input
              type="file"
              id="pwa-import-file-input-fixed"
              ref={fileInputRef}
              accept=".json"
              onChange={handleJsonFileInput}
              className="hidden"
            />
            <button
              type="button"
              id="trigger-import-btn-fixed"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200/65 hover:border-indigo-400 border-dashed hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer text-right w-full h-12 group"
            >
              <div className="w-7.5 h-7.5 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors shadow-4xs">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-black text-slate-800 leading-none group-hover:text-indigo-700 transition-colors">وارد کردن نسخه پشتیبان</span>
                <span className="block text-[9px] text-slate-400 font-medium mt-1 leading-none">بازیابی فوری داده‌ها از فایل JSON</span>
              </div>
            </button>
          </div>
        </div>

        {/* Local History - remaining flex space with inner scrolling */}
        <div className="flex-1 min-h-0 bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col shadow-3xs overflow-hidden">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
              <h3 className="text-xs font-black text-slate-800 leading-none">تاریخچه نسخه‌های پشتیبان حافظه محلی</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-bold font-sans bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-150">۵ نسخه اخیر</span>
          </div>

          <div className="flex-grow overflow-y-auto pr-1 space-y-2 select-none scrollbar-thin">
            {localHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/20">
                <HardDrive className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-[11.5px] text-slate-500 font-bold">هیچ نسخه‌ای ثبت نشده است</p>
                <p className="text-[10px] text-slate-400 mt-1">با ایجاد اولین تغییرات در بخش‌ها، نسخه‌ها به مرور ثبت می شوند.</p>
              </div>
            ) : (
              localHistory.map((item, idx) => (
                <div 
                  key={item.id}
                  id={`history-item-${item.id}`}
                  onClick={() => handleRestoreFromHistory(item)}
                  className="group bg-slate-50/40 hover:bg-slate-100/75 hover:border-indigo-200 border border-slate-200/50 p-3 rounded-xl flex items-center justify-between transition-all duration-200 cursor-pointer text-xs relative overflow-hidden shadow-4xs"
                >
                  {/* Subtle color highlight bar inside history item */}
                  <div className="absolute top-0 right-0 h-full w-1 group-hover:bg-indigo-500 bg-transparent transition-colors" />

                  <div className="flex items-center gap-3 min-w-0 pr-1.5">
                    <span className="text-[10.5px] text-slate-400 font-bold font-mono w-5">#{idx + 1}</span>
                    <div className="min-w-0">
                      <span className="font-extrabold text-slate-800 font-mono text-[11px] block leading-none">{item.timestamp}</span>
                      
                      {/* Stat badges with tooltips */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1 shrink-0 bg-white border border-slate-150 px-2 py-0.5 rounded-lg shadow-5xs" title="تعداد اعضا">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="text-[9.5px] text-slate-500 leading-none">اعضا:</span>
                          <b className="text-slate-800 font-black font-mono">{item.recordsCount.members}</b>
                        </span>
                        <span className="w-[1px] h-3 bg-slate-200" />
                        <span className="flex items-center gap-1 shrink-0 bg-white border border-slate-150 px-2 py-0.5 rounded-lg shadow-5xs" title="تعداد قراردادها">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span className="text-[9.5px] text-slate-500 leading-none">قراردادها:</span>
                          <b className="text-slate-800 font-black font-mono">{item.recordsCount.terms}</b>
                        </span>
                        <span className="w-[1px] h-3 bg-slate-200" />
                        <span className="flex items-center gap-1 shrink-0 bg-white border border-slate-150 px-2 py-0.5 rounded-lg shadow-5xs" title="تعداد حضور و غیاب">
                          <CheckSquare className="w-3 h-3 text-slate-400" />
                          <span className="text-[9.5px] text-slate-500 leading-none">حضور:</span>
                          <b className="text-slate-800 font-black font-mono">{item.recordsCount.attendance}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-black transition-all group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 leading-none shadow-5xs">
                      بازیابی
                    </span>
                    <button
                      type="button"
                      id={`delete-hist-btn-${item.id}`}
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      title="حذف این نسخه"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
