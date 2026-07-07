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
  Trash2,
  FileText,
  Server,
  ShieldCheck
} from 'lucide-react';
import { Member, Shift, Term, SessionNotes, SessionAttendance, CalendarOverrides, CoworkingConfig } from '../types';
import { getTodayJalali } from '../utils/jalali';
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
  importBackupData: (json: string) => Promise<boolean>;
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
  
  const [clientVersion, setClientVersion] = useState<string>(() => {
    return localStorage.getItem('app_client_version') || 'درحال بارگذاری...';
  });

  useEffect(() => {
    const v = localStorage.getItem('app_client_version');
    if (v) {
      setClientVersion(v);
    }
  }, []);
  
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

  // Secure Server Folder status state
  const [secureFolderStatus, setSecureFolderStatus] = useState<{
    status: 'ok' | 'error' | 'loading' | 'uninitialized';
    diskPath: string;
    source: string;
    testResult?: {
      write: 'success' | 'failed';
      read: 'success' | 'failed';
      delete: 'success' | 'failed';
      errors: {
        write: string | null;
        read: string | null;
        delete: string | null;
      };
    };
    error?: string;
  }>({
    status: 'uninitialized',
    diskPath: '',
    source: ''
  });

  const checkSecureFolderStatus = async () => {
    setSecureFolderStatus(prev => ({ ...prev, status: 'loading' }));
    try {
      const res = await fetch("/api/secure-folder-status");
      if (!res.ok) {
        throw new Error(`خطای سرور: ${res.status}`);
      }
      const data = await res.json();
      setSecureFolderStatus({
        status: data.status,
        diskPath: data.diskPath,
        source: data.source,
        testResult: data.testResult,
        error: data.error || null
      });
    } catch (err: any) {
      setSecureFolderStatus({
        status: 'error',
        diskPath: '',
        source: '',
        error: err.message || "خطا در برقراری ارتباط با سرور"
      });
    }
  };

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wiping confirmation states
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [wipeConfirmText, setWipeConfirmText] = useState<string>('');

  // Helper to generate a clean/safe chronological Persian Jalali timestamp key
  const getTimestampKey = () => {
    const now = new Date();
    try {
      const formatter = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const yr = parts.find(p => p.type === 'year')?.value || '';
      const mo = parts.find(p => p.type === 'month')?.value || '';
      const dy = parts.find(p => p.type === 'day')?.value || '';
      const hr = parts.find(p => p.type === 'hour')?.value || '00';
      const mn = parts.find(p => p.type === 'minute')?.value || '00';
      const sc = parts.find(p => p.type === 'second')?.value || '00';
      
      const cleanNum = (str: string) => {
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        const converted = str.split('').map(char => {
          const idx = persianDigits.indexOf(char);
          return idx !== -1 ? idx.toString() : char;
        }).join('');
        return converted.replace(/\D/g, '');
      };
      
      return `${cleanNum(yr)}${cleanNum(mo)}${cleanNum(dy)}-${cleanNum(hr)}${cleanNum(mn)}${cleanNum(sc)}`;
    } catch (e) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }
  };

  // Active session and unique ID for dynamic non-overwriting filenames
  const [sessionKey, setSessionKey] = useState<string>(() => {
    return localStorage.getItem('backup_session_key') || getTimestampKey();
  });

  const regenerateSessionKey = () => {
    const newKey = getTimestampKey();
    setSessionKey(newKey);
    localStorage.setItem('backup_session_key', newKey);
    return newKey;
  };

  // Load and check support
  useEffect(() => {
    setIsDirSupported('showDirectoryPicker' in window);
    checkSecureFolderStatus();

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

  // Format the full system current state JSON by fetching from server first to guarantee complete data
  const getFullBackupJSONAsync = async (): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

      const res = await fetch("/api/data", { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("Server response not ok");
      }
      const data = await res.json();
      const stateObj = {
        config: data.config,
        shifts: data.shifts,
        members: data.members,
        terms: data.terms,
        notes: data.sessionNotes,
        attendance: data.sessionAttendance,
        overrides: data.calendarOverrides,
        exportedAt: new Date().toISOString(),
        appVersion: '1.2.0',
        clientVersion: clientVersion,
        serverVersion: data.version || 0
      };
      return JSON.stringify(stateObj, null, 2);
    } catch (err) {
      console.warn("Could not fetch fresh database state from server. Falling back to local state.", err);
      // Fallback to client state
      const stateObj = {
        config,
        shifts,
        members,
        terms,
        notes: sessionNotes,
        attendance: sessionAttendance,
        overrides: calendarOverrides,
        exportedAt: new Date().toISOString(),
        appVersion: '1.2.0 (Local Fallback)',
        clientVersion: clientVersion
      };
      return JSON.stringify(stateObj, null, 2);
    }
  };

  // Deprecated synchronous backup getter (kept for absolute fallback references)
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
      appVersion: '1.2.0',
      clientVersion: clientVersion
    };
    return JSON.stringify(stateObj, null, 2);
  };

  // Check if existing backup in the connected folder differs from current app state
  const checkBackupConflictAndSync = async (handle: any) => {
    if (!handle) return;
    try {
      // Non-destructively look for active live backup file inside the connected folder
      const fileH = await handle.getFileHandle(`BK_${sessionKey}.json`, { create: false });
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

  // Helper to trigger active and reserved terms report download
  const handleDownloadReport = () => {
    try {
      const todayDate = getTodayJalali();
      const relevantTerms = terms.map(term => {
        const member = members.find(m => m.id === term.memberId);
        const shift = shifts.find(s => s.id === term.shiftId);
        
        let status: 'active' | 'reserved' | 'finished' = 'active';
        if (todayDate > term.endDate) {
          status = 'finished';
        } else if (todayDate < term.startDate) {
          status = 'reserved';
        }
        
        return {
          ...term,
          memberName: member ? member.fullName : 'کاربر حذف شده',
          memberPhone: member ? member.phone : 'نامشخص',
          shiftName: shift ? shift.name : 'سانس حذف شده',
          status
        };
      }).filter(t => t.status === 'active' || t.status === 'reserved');

      const activeCount = relevantTerms.filter(t => t.status === 'active').length;
      const reservedCount = relevantTerms.filter(t => t.status === 'reserved').length;

      const now = new Date();
      const jalaliTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const reportDateStr = `${todayDate} - ${jalaliTime}`;

      const rowsHtml = relevantTerms.length > 0 ? relevantTerms.map((t, idx) => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0 text-right">
          <td class="px-4 py-3.5 text-center font-bold text-slate-400 text-xs">${idx + 1}</td>
          <td class="px-4 py-3.5 font-bold text-slate-800 text-sm">${t.memberName}</td>
          <td class="px-4 py-3.5 text-slate-700 text-xs font-bold">${t.shiftName}</td>
          <td class="px-4 py-3.5 font-mono text-indigo-750 text-xs font-black">${t.startDate}</td>
          <td class="px-4 py-3.5 font-mono text-rose-700 text-xs font-black">${t.endDate}</td>
          <td class="px-4 py-3.5 text-center font-semibold">
            ${t.status === 'active' 
              ? '<span class="bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2.5 py-0.5 rounded-full text-[10.5px] font-black">فعال</span>' 
              : '<span class="bg-blue-50 text-blue-800 border border-blue-200/50 px-2.5 py-0.5 rounded-full text-[10.5px] font-black">رزرو شده</span>'
            }
          </td>
        </tr>
      `).join('') : `
        <tr>
          <td colspan="6" class="px-4 py-12 text-center text-slate-400 font-extrabold text-sm bg-slate-50/50">
            هیچ اشتراک فعال یا رزرو شده‌ای در سیستم یافت نشد.
          </td>
        </tr>
      `;

      const htmlContent = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>گزارش مدیریت - اشتراک‌های فعال و رزرو شده</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @font-face {
      font-family: 'Vazirmatn';
      src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Vazirmatn';
      src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    body {
      font-family: 'Vazirmatn', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 p-4 md:p-8 min-h-screen flex flex-col justify-between" style="font-family: 'Vazirmatn', sans-serif;">

  <!-- REPORT CONTAINER -->
  <div class="max-w-5xl mx-auto w-full bg-white rounded-3xl border border-slate-200 p-6 md:p-8 flex-1 flex flex-col justify-between shadow-xs">
    
    <div>
      <!-- HEADER section -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-dashed border-slate-200 gap-4">
        <div class="text-right">
          <div class="flex items-center gap-2 text-indigo-700 font-black text-lg mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <h1 class="font-extrabold text-lg">گزارش وضعیت اعضای فعال و رزرو شده</h1>
          </div>
          <p class="text-xs text-slate-500 font-semibold leading-relaxed">گزارش خلاصه وضعیت اشتراک‌های معتبر (فعال و در انتظار شروع) کاربران فضای کاری</p>
        </div>
        <div class="flex flex-col items-start md:items-end text-right">
          <span class="text-xs text-slate-400 font-extrabold mb-1">تاریخ تولید گزارش:</span>
          <span class="font-mono text-slate-800 text-xs font-black bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl" dir="ltr">${reportDateStr}</span>
        </div>
      </div>

      <!-- METRICS GRID -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <!-- Card 1 -->
        <div class="bg-slate-50/60 border border-slate-200/65 rounded-2xl p-4 text-right flex items-center justify-between">
          <div>
            <p class="text-[10px] text-slate-400 font-extrabold mb-1">کل ترم‌های معتبر</p>
            <p class="text-xl font-black text-slate-850">${relevantTerms.length} <span class="text-xs font-bold text-slate-400">مورد</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200/30">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <!-- Card 2 -->
        <div class="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 text-right flex items-center justify-between">
          <div>
            <p class="text-[10px] text-emerald-800 font-extrabold mb-1">اشتراک‌های فعال</p>
            <p class="text-xl font-black text-emerald-950">${activeCount} <span class="text-xs font-bold text-emerald-700">نفر</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/30">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>
        <!-- Card 3 -->
        <div class="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 text-right flex items-center justify-between">
          <div>
            <p class="text-[10px] text-blue-800 font-extrabold mb-1">اشتراک‌های رزرو شده</p>
            <p class="text-xl font-black text-blue-950">${reservedCount} <span class="text-xs font-bold text-blue-700">نفر</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/30">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
      </div>

      <!-- FILTERS & SEARCH ROW -->
      <div class="flex flex-col sm:flex-row gap-3 my-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl no-print">
        <div class="flex-1 relative">
          <input 
            type="text" 
            id="searchInput" 
            placeholder="جستجو در نام، سانس یا تاریخ..." 
            class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold"
            oninput="handleFilter()"
          />
        </div>
        <div class="w-full sm:w-48">
          <select 
            id="statusFilter" 
            class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
            onchange="handleFilter()"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فقط فعال</option>
            <option value="reserved">فقط رزرو شده</option>
          </select>
        </div>
      </div>

      <!-- FILTERED COUNT SUMMARY -->
      <div class="flex justify-between items-center mb-3 px-1">
        <span id="filteredCount" class="text-[11px] text-slate-400 font-extrabold select-none"></span>
      </div>

      <!-- MAIN TABLE -->
      <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-5xs">
        <div class="overflow-x-auto">
          <table class="w-full text-right border-collapse">
            <thead>
              <tr class="bg-indigo-50/40 border-b border-slate-200 text-slate-700 text-xs font-bold select-none">
                <th class="px-4 py-3 text-center w-12 text-[10px] text-slate-400">#</th>
                <th class="px-4 py-3 cursor-pointer hover:bg-slate-100 transition" onclick="toggleSort('memberName')">
                  <div class="flex items-center gap-1">
                    <span>نام و نام خانوادگی</span>
                    <span id="sort-icon-memberName" class="text-[10px] text-slate-400 font-bold">↕</span>
                  </div>
                </th>
                <th class="px-4 py-3 cursor-pointer hover:bg-slate-100 transition" onclick="toggleSort('shiftName')">
                  <div class="flex items-center gap-1">
                    <span>سانس کاری</span>
                    <span id="sort-icon-shiftName" class="text-[10px] text-slate-400 font-bold">↕</span>
                  </div>
                </th>
                <th class="px-4 py-3 cursor-pointer hover:bg-slate-100 transition" onclick="toggleSort('startDate')">
                  <div class="flex items-center gap-1">
                    <span>تاریخ شروع</span>
                    <span id="sort-icon-startDate" class="text-[10px] text-slate-400 font-bold">↕</span>
                  </div>
                </th>
                <th class="px-4 py-3 cursor-pointer hover:bg-slate-100 transition" onclick="toggleSort('endDate')">
                  <div class="flex items-center gap-1">
                    <span>تاریخ پایان</span>
                    <span id="sort-icon-endDate" class="text-[10px] text-slate-400 font-bold">↕</span>
                  </div>
                </th>
                <th class="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition" onclick="toggleSort('status')">
                  <div class="flex items-center justify-center gap-1">
                    <span>وضعیت</span>
                    <span id="sort-icon-status" class="text-[10px] text-slate-400 font-bold">↕</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody id="tableBody" class="divide-y divide-slate-100 text-xs font-semibold">
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- REPORT FOOTER -->
    <div class="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-slate-400 text-[10px] gap-2">
      <span>تولید شده به صورت خودکار توسط آموزشگاه پرستو</span>
      <span class="font-mono">صفحه ۱ از ۱</span>
    </div>

  </div>

  <script>
    // Data injected directly from server
    const allTerms = ${JSON.stringify(relevantTerms)};
    let filteredTerms = [...allTerms];
    
    // Sort State
    let sortKey = '';
    let sortDirection = 'asc'; // 'asc' | 'desc'

    // Filter State
    let searchQuery = '';
    let statusFilter = 'all';

    function renderTable() {
      const tbody = document.getElementById('tableBody');
      const filteredCountEl = document.getElementById('filteredCount');
      
      // Clear body
      tbody.innerHTML = '';
      
      if (filteredTerms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-12 text-center text-slate-400 font-extrabold text-xs bg-slate-50/50">هیچ اشتراک معتبری مطابق فیلترهای شما یافت نشد.</td></tr>';
        if (filteredCountEl) {
          filteredCountEl.innerText = 'هیچ موردی یافت نشد';
        }
        return;
      }
      
      if (filteredCountEl) {
        filteredCountEl.innerText = 'نمایش ' + filteredTerms.length + ' مورد از ' + allTerms.length + ' اشتراک معتبر';
      }

      for (let i = 0; i < filteredTerms.length; i++) {
        const t = filteredTerms[i];
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0 text-right";
        
        const statusBadge = t.status === 'active' 
          ? '<span class="bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2.5 py-0.5 rounded-full text-[10.5px] font-black">فعال</span>' 
          : '<span class="bg-blue-50 text-blue-800 border border-blue-200/50 px-2.5 py-0.5 rounded-full text-[10.5px] font-black">رزرو شده</span>';
          
        tr.innerHTML = '<td class="px-4 py-3.5 text-center font-bold text-slate-400 text-xs">' + (i + 1) + '</td>' +
          '<td class="px-4 py-3.5 font-bold text-slate-800 text-sm">' + t.memberName + '</td>' +
          '<td class="px-4 py-3.5 text-slate-700 text-xs font-bold">' + t.shiftName + '</td>' +
          '<td class="px-4 py-3.5 font-mono text-indigo-750 text-xs font-black">' + t.startDate + '</td>' +
          '<td class="px-4 py-3.5 font-mono text-rose-700 text-xs font-black">' + t.endDate + '</td>' +
          '<td class="px-4 py-3.5 text-center font-semibold">' + statusBadge + '</td>';
          
        tbody.appendChild(tr);
      }
    }

    function handleFilter() {
      searchQuery = document.getElementById('searchInput').value.trim();
      statusFilter = document.getElementById('statusFilter').value;
      
      filteredTerms = allTerms.filter(function(t) {
        const matchesSearch = t.memberName.indexOf(searchQuery) !== -1 || 
                             t.shiftName.indexOf(searchQuery) !== -1 || 
                             t.startDate.indexOf(searchQuery) !== -1 || 
                             t.endDate.indexOf(searchQuery) !== -1;
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
      
      // Re-apply sorting on filtered terms if any
      if (sortKey) {
        applySort();
      } else {
        renderTable();
      }
    }

    function toggleSort(key) {
      if (sortKey === key) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDirection = 'asc';
      }
      
      // Update Sort Icons
      const keys = ['memberName', 'shiftName', 'startDate', 'endDate', 'status'];
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j];
        const icon = document.getElementById('sort-icon-' + k);
        if (icon) {
          if (k === sortKey) {
            icon.innerText = sortDirection === 'asc' ? '▲' : '▼';
            icon.className = "text-[10px] text-indigo-600 font-bold";
          } else {
            icon.innerText = '↕';
            icon.className = "text-[10px] text-slate-400";
          }
        }
      }
      
      applySort();
    }

    function applySort() {
      filteredTerms.sort(function(a, b) {
        const valA = a[sortKey] || '';
        const valB = b[sortKey] || '';
        
        if (typeof valA === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB, 'fa')
            : valB.localeCompare(valA, 'fa');
        } else {
          return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        }
      });
      
      renderTable();
    }

    // Initialize table on load
    window.onload = function() {
      renderTable();
    };
  </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      const pad = (n: number) => n.toString().padStart(2, '0');
      
      const cleanNum = (str: string) => {
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        return str.split('').map(char => {
          const idx = persianDigits.indexOf(char);
          return idx !== -1 ? idx.toString() : char;
        }).join('').replace(/\D/g, '');
      };

      const rawYr = now.toLocaleDateString('fa-IR', { year: '2-digit' });
      const rawMo = now.toLocaleDateString('fa-IR', { month: '2-digit' });
      const rawDy = now.toLocaleDateString('fa-IR', { day: '2-digit' });

      const cYr = cleanNum(rawYr).slice(-2).padStart(2, '0');
      const cMo = cleanNum(rawMo).padStart(2, '0');
      const cDy = cleanNum(rawDy).padStart(2, '0');
      const cHr = pad(now.getHours());
      const cMn = pad(now.getMinutes());

      const filename = "B_Report_" + cYr + "-" + cMo + "-" + cDy + "_" + cHr + "-" + cMn + ".html";

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'گزارش مدیریت با موفقیت آماده و دانلود شد.');
    } catch (err) {
      console.error(err);
      showToast('error', 'خطا در تولید گزارش مدیریت.');
    }
  };

  // Helper to trigger system file download (fallback & manual export)
  const triggerManualDownload = async () => {
    try {
      const json = await getFullBackupJSONAsync();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      
      let datePart = '05-04-01';
      let timePart = '12-00';
      
      try {
        const formatter = new Intl.DateTimeFormat('fa-IR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(now);
        const yr = parts.find(p => p.type === 'year')?.value || '';
        const mo = parts.find(p => p.type === 'month')?.value || '';
        const dy = parts.find(p => p.type === 'day')?.value || '';
        const hr = parts.find(p => p.type === 'hour')?.value || '00';
        const mn = parts.find(p => p.type === 'minute')?.value || '00';
        
        const cleanNum = (str: string) => {
          const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
          const converted = str.split('').map(char => {
            const idx = persianDigits.indexOf(char);
            return idx !== -1 ? idx.toString() : char;
          }).join('');
          return converted.replace(/\D/g, '');
        };
        
        const cYr = cleanNum(yr);
        const cMo = cleanNum(mo).padStart(2, '0');
        const cDy = cleanNum(dy).padStart(2, '0');
        const cHr = cleanNum(hr).padStart(2, '0');
        const cMn = cleanNum(mn).padStart(2, '0');
        
        const yearShort = cYr.slice(-2);
        datePart = `${yearShort}-${cMo}-${cDy}`;
        timePart = `${cHr}-${cMn}`;
      } catch (e) {
        // Fallback to Gregorian if fa-IR is unsupported or errors
        const pad = (n: number) => n.toString().padStart(2, '0');
        const rYr = now.getFullYear().toString().slice(-2);
        datePart = `${rYr}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      }

      a.href = url;
      a.download = `B${datePart}_${timePart}.json`;
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

  const handleRestoreFromHistory = async (item: LocalHistoryItem) => {
    if (confirm('داده‌های فعلی جایگزین شوند؟')) {
      const success = await importBackupData(item.data);
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
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const success = await importBackupData(text);
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

  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'd' || key === 'ی') {
          e.preventDefault();
          triggerManualDownload();
        } else if (key === 'u' || key === 'ع') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [members, terms, shifts, sessionNotes, sessionAttendance, calendarOverrides]);

  // Write Current State to Selected Directory
  const writeCurrentStateToDir = async (handle: any, isRolling = false) => {
    if (!handle) return;
    setIsWriting(true);
    try {
      const json = await getFullBackupJSONAsync();
      
      // Determine file name
      let fileName = `BK_${sessionKey}.json`;
      if (isRolling) {
        const now = new Date();
        const datePart = now.toLocaleDateString('fa-IR').replace(/\//g, '-');
        const timePart = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        fileName = `BK_ROLL_${sessionKey}_${datePart}_${timePart}.json`;
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
      const json = await getFullBackupJSONAsync();
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
      const newKey = regenerateSessionKey();
      showToast('success', `پوشه بکاپ متصل و با موفقیت ذخیره شد. شناسه فعال: ${newKey}`);
      
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
  const handleResolveRestore = async () => {
    if (!conflictBackup) return;
    const success = await importBackupData(JSON.stringify(conflictBackup.existingData));
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
      const archiveFileName = `BK_ARCHIVED_${datePart}_${timePart}.json`;

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
    const newKey = regenerateSessionKey();
    showToast('success', `اتصال پوشه قطع شد. شناسه بکاپ جدید ایجاد شد: ${newKey}`);
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
      const timer = setTimeout(async () => {
        if (dirHandle && dirPermissionStatus === 'granted') {
          await writeCurrentStateToDir(dirHandle, false);
        } else {
          // Fallback to storing in state-controlled LocalStorage history
          const json = await getFullBackupJSONAsync();
          triggerHistoryBackup(json);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [config, shifts, members, terms, sessionNotes, sessionAttendance, calendarOverrides, autoSaveEnabled, dirHandle, dirPermissionStatus, conflictBackup]);

  return (
    <div id="backup-manager-view" className="flex-1 flex flex-col h-full bg-slate-50/10 rounded-2xl border border-slate-200/50 overflow-hidden animate-fade-in font-sans p-[10px] space-y-3">
      
      {/* Dynamic Inline Notification Banner */}
      {notification && (
        <div 
          className={`px-4 py-3 text-xs rounded-xl border flex items-center justify-between gap-3 animate-fade-in shrink-0 text-right ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : notification.type === 'refused'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">
              {notification.type === 'success' ? '✅' : '⚠️'}
            </span>
            <span className="font-extrabold">{notification.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-650 font-bold cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

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
          {/* SECURE CLIENT VERSION ID BADGE */}
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200/60 rounded-lg px-2 py-0.5 select-all" title="شناسه امن کلاینت جهت تضمین بروزرسانی">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span className="text-[9px] text-emerald-800 font-extrabold leading-none">نسخه فعال کلاینت:</span>
            <span className="font-mono text-[9px] font-black text-emerald-950 tracking-tight leading-none">{clientVersion}</span>
          </div>
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
              title="بارگیری فایل پشتیبان دستی (Alt + D)"
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
                title="بارگذاری و بازیابی فایل نسخه پشتیبان (Alt + U)"
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

          {/* Download Terms Report */}
          <button
            type="button"
            id="download-terms-report-btn"
            onClick={handleDownloadReport}
            title="دانلود گزارش جامع اشتراک‌های فعال و رزرو شده (فرمت HTML)"
            className="flex items-center gap-1.5 px-2.5 h-6.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 border border-indigo-200/60 rounded-lg text-[10px] font-black cursor-pointer duration-100 select-none leading-none shrink-0 animate-pulse hover:animate-none"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-650" />
            <span>گزارش مدیر (HTML)</span>
          </button>

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

      {/* Secure Folder Connection Status on Server */}
      <div 
        id="secure-folder-status-card" 
        className="px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-5xs flex flex-col gap-2 shrink-0 text-right"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-650 flex items-center justify-center border border-emerald-100/50">
              <Server className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 leading-none">
                وضعیت اتصال به پوشه امن سرور (دیتاسنتر)
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-tight">
                آیا سیستم توانسته است در پوشه پشتیبان امن رانفلر اطلاعات بنویسد و بخواند؟
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={checkSecureFolderStatus}
            disabled={secureFolderStatus.status === 'loading'}
            title="تست مجدد اتصال و خواندن/نوشتن"
            className="flex items-center gap-1 px-2.5 h-6.5 bg-slate-100 hover:bg-indigo-50 text-slate-650 hover:text-indigo-600 rounded-lg text-[10px] font-bold cursor-pointer duration-100 select-none leading-none shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${secureFolderStatus.status === 'loading' ? 'animate-spin' : ''}`} />
            <span>تست مجدد</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-1.5 p-3 bg-slate-50 border border-slate-100/80 rounded-xl">
          {/* Path & Source */}
          <div className="flex flex-col gap-1.5 justify-center">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-bold">
              <span>مسیر دیسک امن:</span>
              {secureFolderStatus.status === 'loading' ? (
                <span className="h-3 w-20 bg-slate-200 animate-pulse rounded"></span>
              ) : (
                <span className="font-mono text-slate-800 font-black bg-white border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[150px]" title={secureFolderStatus.diskPath || "نامشخص"}>
                  {secureFolderStatus.diskPath || "درحال بررسی..."}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-bold">
              <span>منبع مسیر:</span>
              {secureFolderStatus.status === 'loading' ? (
                <span className="h-3 w-16 bg-slate-200 animate-pulse rounded"></span>
              ) : (
                <span className="text-slate-700 bg-white border border-slate-200/60 px-1.5 py-0.5 rounded text-[9.5px]">
                  {secureFolderStatus.source === 'env' && "متغیر UPLOAD_PATH (رانفلر)"}
                  {secureFolderStatus.source === 'default' && "پیش‌فرض (/my)"}
                  {secureFolderStatus.source === 'fallback_local' && "محلی پروژه (./my)"}
                  {!secureFolderStatus.source && "بررسی نشده"}
                </span>
              )}
            </div>
          </div>

          {/* Test Read/Write Status */}
          <div className="flex flex-col gap-1.5 justify-center border-r border-slate-200/65 pr-3 sm:border-r">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-bold">
              <span>تست خواندن و نوشتن:</span>
              {secureFolderStatus.status === 'loading' && (
                <span className="text-slate-400">درحال بررسی...</span>
              )}
              {secureFolderStatus.status === 'ok' && (
                <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-[9.5px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  موفقیت‌آمیز
                </span>
              )}
              {secureFolderStatus.status === 'error' && (
                <span className="text-rose-700 font-black bg-rose-50 border border-rose-150 px-2 py-0.5 rounded text-[9.5px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  ناموفق
                </span>
              )}
              {secureFolderStatus.status === 'uninitialized' && (
                <span className="text-slate-400">نامشخص</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[9.5px] text-slate-400 font-bold">
              <span>نوشتن: {secureFolderStatus.testResult?.write === 'success' ? '✅' : '❌'}</span>
              <span className="text-slate-300">|</span>
              <span>خواندن: {secureFolderStatus.testResult?.read === 'success' ? '✅' : '❌'}</span>
              <span className="text-slate-300">|</span>
              <span>حذف فایل تست: {secureFolderStatus.testResult?.delete === 'success' ? '✅' : '❌'}</span>
            </div>
          </div>

          {/* Status badge and error message */}
          <div className="flex flex-col justify-center sm:col-span-2 md:col-span-1 border-t sm:border-t-0 md:border-r border-slate-200/65 pt-2 sm:pt-0 md:pr-3">
            {secureFolderStatus.status === 'ok' ? (
              <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50/40 border border-emerald-100 p-2 rounded-lg text-[10px] font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="leading-tight">اتصال ایمن برقرار است و قابلیت خواندن و نوشتن تایید شد. اطلاعات با موفقیت حفظ خواهند شد.</span>
              </div>
            ) : secureFolderStatus.status === 'error' ? (
              <div className="flex flex-col gap-1 p-2 bg-rose-50 border border-rose-150 rounded-lg text-rose-800 text-[9.5px] font-bold">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>خطا: عدم امکان نوشتن در پوشه امن.</span>
                </div>
                {secureFolderStatus.error && (
                  <p className="font-mono text-[8px] bg-white/50 p-1 rounded border border-rose-100 truncate" title={secureFolderStatus.error}>
                    {secureFolderStatus.error}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-[10px] font-medium italic">
                در حال بارگذاری وضعیت اتصال...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Version Integrity Verification Card */}
      <div 
        id="client-version-verification-card" 
        className="px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-5xs flex flex-col gap-2 shrink-0 text-right"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/50">
            <ShieldCheck className="w-4 h-4 text-indigo-650" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 leading-none flex items-center gap-1.5">
              <span>بررسی اصالت و امنیت بروزرسانی کلاینت</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded text-[8.5px] font-black">فعال و ایمن</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-tight">
              شناسه کلاینت برای تضمین دریافت دقیق نسخه جدید و تطابق آن با سرور ثبت شده است.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-100/80 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-right">
          <div className="flex flex-col gap-1.5 justify-center">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-bold">
              <span>شناسه امن نسخه فعلی کلاینت:</span>
              <span className="font-mono text-slate-800 font-black bg-white border border-slate-200/60 px-2 py-0.5 rounded text-[10px] select-all">
                {clientVersion}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-bold">
              <span>وضعیت بروزرسانی:</span>
              <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-[9.5px]">
                کاملاً همگام با دیتاسنتر سرور و به‌روز
              </span>
            </div>
          </div>
          <div className="text-[9.5px] text-slate-400 font-semibold leading-relaxed max-w-md sm:border-r sm:border-slate-200/65 sm:pr-3">
            این شناسه منحصربه‌فرد برای تایید اصالت کلاینت داخل فایل‌های پشتیبان ذخیره شده تزریق شده است. هر زمان سرور بروزرسانی شود، کلاینت به طور خودکار حافظه کش را پاکسازی کرده و صفحه را بدون نیاز به مداخله شما بارگذاری مجدد می‌کند.
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



      {/* Scrollable Local Backup History Table - High Density */}
      <BackupHistoryTable
        localHistory={localHistory}
        onRestore={handleRestoreFromHistory}
        onDelete={handleDeleteHistoryItem}
      />

    </div>
  );
}
