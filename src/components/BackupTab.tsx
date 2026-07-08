import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Trash2,
  Server,
  ShieldCheck,
  Settings,
  Cpu,
  User,
  Globe,
  Link,
  Terminal
} from 'lucide-react';
import { Member, Shift, Term, SessionNotes, SessionAttendance, CalendarOverrides, CoworkingConfig } from '../types';

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
  updateConfig
}: BackupTabProps) {
  // Client & Server Version states
  const [clientVersion, setClientVersion] = useState<string>(() => {
    return localStorage.getItem('app_client_version') || 'درحال بارگذاری...';
  });

  useEffect(() => {
    const v = localStorage.getItem('app_client_version');
    if (v) {
      setClientVersion(v);
    }
  }, []);

  // Notifications state
  const [notification, setNotification] = useState<{ type: 'success' | 'refused' | 'error'; text: string; } | null>(null);

  const showToast = (type: 'success' | 'refused' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => curr?.text === text ? null : curr);
    }, 4500);
  };

  // Secure Server Folder status state
  const [secureFolderStatus, setSecureFolderStatus] = useState<{
    status: 'ok' | 'error' | 'loading' | 'uninitialized';
    diskPath: string;
    source: string;
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

  // H14M OS Core integration states (M14H Document)
  const [h14mStatus, setH14mStatus] = useState<{
    connected: boolean;
    lastConnect: { timestamp: number; method: string; headers: any; body: any } | null;
    appId: string;
  } | null>(null);
  const [h14mUserInfo, setH14mUserInfo] = useState<any>(null);
  const [h14mLoading, setH14mLoading] = useState<boolean>(false);
  const [h14mError, setH14mError] = useState<string | null>(null);

  const fetchH14mInfo = async () => {
    setH14mLoading(true);
    setH14mError(null);
    try {
      // 1. Fetch local connection state tracking
      const statusRes = await fetch("/api/h14m/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setH14mStatus(statusData);
      }

      // 2. Fetch user details via proxy to H14M OS Core (secures secret token)
      const userInfoRes = await fetch("/api/h14m/user-info");
      if (userInfoRes.ok) {
        const userInfoData = await userInfoRes.json();
        if (userInfoData.success) {
          setH14mUserInfo(userInfoData.user);
        } else {
          setH14mError(userInfoData.error || "خطا در دریافت اطلاعات کاربر");
        }
      } else {
        setH14mError(`خطای ارتباط با سرور: ${userInfoRes.status}`);
      }
    } catch (err: any) {
      setH14mError(err.message || "خطا در ارتباط با سرور");
    } finally {
      setH14mLoading(false);
    }
  };

  useEffect(() => {
    checkSecureFolderStatus();
    fetchH14mInfo();
  }, []);

  // File import input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wiping confirmation states
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [wipeConfirmText, setWipeConfirmText] = useState<string>('');

  // Settings local states
  const [regularDesks, setRegularDesks] = useState<number>(config.totalRegularDesks || 20);
  const [premiumDesks, setPremiumDesks] = useState<number>(config.totalPremiumDesks || 5);
  const [academyName, setAcademyName] = useState<string>(config.academyName || 'آموزشگاه پرستو');
  const [academyPhone, setAcademyPhone] = useState<string>(config.academyPhone || '');
  const [academyAddress, setAcademyAddress] = useState<string>(config.academyAddress || '');
  const [academyLogo, setAcademyLogo] = useState<string>(config.academyLogo || '');

  // Synchronize local setting states when props change
  useEffect(() => {
    if (config) {
      setRegularDesks(config.totalRegularDesks);
      setPremiumDesks(config.totalPremiumDesks);
      setAcademyName(config.academyName || 'آموزشگاه پرستو');
      setAcademyPhone(config.academyPhone || '');
      setAcademyAddress(config.academyAddress || '');
      setAcademyLogo(config.academyLogo || '');
    }
  }, [config]);

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
        const pad = (n: number) => n.toString().padStart(2, '0');
        const rYr = now.getFullYear().toString().slice(-2);
        datePart = `${rYr}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      }

      a.href = url;
      a.download = `Backup_${datePart}_${timePart}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('success', 'فایل پشتیبان با موفقیت دانلود شد.');
    } catch (err: any) {
      showToast('error', 'خطا در بارگذاری خروجی.');
    }
  };

  const handleJsonFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const success = await importBackupData(text);
      if (success) {
        showToast('success', `فایل پشتیبان با موفقیت وارد و در سیستم فعال شد.`);
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
  }, [members, terms, shifts, sessionNotes, sessionAttendance, calendarOverrides, clientVersion]);

  // Settings Save Handler
  const handleSaveSettings = () => {
    updateConfig({
      totalRegularDesks: Number(regularDesks),
      totalPremiumDesks: Number(premiumDesks),
      academyName: academyName.trim(),
      academyPhone: academyPhone.trim(),
      academyAddress: academyAddress.trim(),
      academyLogo: academyLogo
    });
    showToast('success', 'تنظیمات سیستم با موفقیت به‌روزرسانی و در سرور ذخیره شد.');
  };

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
            className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
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
              <p>🔴 <b>این عملیات غیرقابل بازگشت است.</b> تمامی اطلاعات شامل موارد زیر برای همیشه از روی سیستم و پایگاه داده حذف خواهند شد:</p>
              <ul className="list-disc list-inside space-y-1 text-[10.5px] text-rose-700 pr-2">
                <li>لیست کامل اعضا و مشترکین ({members.length} نفر)</li>
                <li>قراردادها و طرح‌های عضویت فعال ({terms.length} مورد)</li>
                <li>تمامی شیفت‌های کاری تعریف شده ({shifts.length} شیفت)</li>
                <li>تمام یادداشت‌های جلسات و گزارش حضور و غیاب‌ها</li>
              </ul>
            </div>

            {/* Confirmation verification input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="wipe-confirm-input" className="text-[10.5px] text-slate-500 font-bold">
                جهت تایید نهایی، کلمه <span className="text-rose-600 font-extrabold">"حذف"</span> را در کادر زیر بنویسید:
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
      <div id="backup-header-toolbar" className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-5xs gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/50">
            <Settings className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-xs font-black text-slate-800 tracking-tight leading-none select-none">
            تنظیمات و پشتیبان‌گیری
          </h1>

          {/* SECURE SERVER FOLDER STATUS ICON INDICATOR */}
          <button 
            type="button"
            onClick={checkSecureFolderStatus}
            className={`flex items-center gap-1 border rounded-lg px-2 py-0.5 duration-100 cursor-pointer ${
              secureFolderStatus.status === 'ok' 
                ? 'bg-emerald-50 border-emerald-200/60 text-emerald-800 hover:bg-emerald-100'
                : secureFolderStatus.status === 'error'
                ? 'bg-rose-50 border-rose-200/60 text-rose-800 hover:bg-rose-100'
                : 'bg-amber-50 border-amber-200/60 text-amber-800 hover:bg-amber-100'
            }`}
            title={`وضعیت دیتاسنتر: ${
              secureFolderStatus.status === 'ok' ? 'اتصال ایمن برقرار است' : 
              secureFolderStatus.status === 'error' ? 'عدم امکان نوشتن در پوشه دیتابیس' : 'در حال بررسی...'
            } (برای تست مجدد کلیک کنید)`}
          >
            <Server className={`w-3.5 h-3.5 ${secureFolderStatus.status === 'loading' ? 'animate-spin text-amber-600' : secureFolderStatus.status === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span className="text-[9px] font-black leading-none">
              {secureFolderStatus.status === 'ok' ? 'دیتاسنتر متصل' : secureFolderStatus.status === 'error' ? 'خطای دیتاسنتر' : 'درحال بارگذاری'}
            </span>
          </button>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-lg p-0.5" dir="ltr">
            {/* Download/Export manual JSON */}
            <button
              type="button"
              id="export-manual-btn-icon"
              onClick={triggerManualDownload}
              title="بارگیری فایل پشتیبان دستی (Alt + D)"
              className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded duration-100 cursor-pointer"
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
                className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded duration-100 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="w-[1px] h-3 bg-slate-200 self-center mx-0.5" />
            {/* WIPE ALL DATA - Sleek Crimson Button */}
            <button
              type="button"
              id="header-wipe-data-action"
              onClick={() => setShowWipeConfirm(true)}
              title="پاک‌سازی کامل اطلاعات (بازنشانی کارخانه)"
              className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded duration-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Configuration Settings Table */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-5xs overflow-hidden flex flex-col text-right">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-indigo-600 rounded-full"></div>
            <h2 className="text-xs font-black text-slate-800">جدول مدیریت تنظیمات و مشخصات سیستم</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-extrabold select-none">
            مقادیر پیش‌فرض برای ظرفیت‌ها و هدر فاکتورهای چاپی
          </span>
        </div>

        {/* Scrollable Container with the Settings Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold select-none text-[10.5px]">
                <th className="pb-2 w-[40%]">موضوع تنظیم</th>
                <th className="pb-2 w-[60%]">مقدار / فیلد ویرایش</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {/* Default Regular Seats Count */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">تعداد صندلی‌های پیش‌فرض عادی</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">ظرفیت پیش‌فرض برای تعریف صندلی‌های عمومی در سانس‌ها</div>
                </td>
                <td className="py-3.5">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={regularDesks}
                    onChange={(e) => setRegularDesks(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full sm:w-48 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
                  />
                </td>
              </tr>

              {/* Default Premium Seats Count */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">تعداد صندلی‌های پیش‌فرض ویژه</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">ظرفیت پیش‌فرض برای صندلی‌های اختصاصی/VIP در سانس‌ها</div>
                </td>
                <td className="py-3.5">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={premiumDesks}
                    onChange={(e) => setPremiumDesks(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full sm:w-48 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
                  />
                </td>
              </tr>

              {/* Academy Name */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">نام آموزشگاه</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">عنوان رسمی مدرسه، آکادمی یا فضای اشتراکی کاری</div>
                </td>
                <td className="py-3.5">
                  <input
                    type="text"
                    value={academyName}
                    onChange={(e) => setAcademyName(e.target.value)}
                    placeholder="آموزشگاه پرستو"
                    className="w-full max-w-md h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </td>
              </tr>

              {/* Academy Logo Selector & Uploader */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">آیکون و لوگوی آموزشگاه</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">انتخاب لوگوی آماده یا بارگذاری تصویر سفارشی (PWA و منو)</div>
                </td>
                <td className="py-3.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Visual Preview Box */}
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-2 shadow-sm shrink-0">
                      <img 
                        src={academyLogo || "/parastu_logo.png"} 
                        alt="لوگو" 
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = "/parastu_logo.png";
                        }}
                      />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      {/* Presets List */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAcademyLogo('')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            academyLogo === '' 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          پیش‌فرض (پرستو)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAcademyLogo('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            academyLogo.includes('22%2010v6')
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          کلاه فارغ‌التحصیلی
                        </button>
                        <button
                          type="button"
                          onClick={() => setAcademyLogo('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%232563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            academyLogo.includes('2%203h6')
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          کتاب باز
                        </button>
                        <button
                          type="button"
                          onClick={() => setAcademyLogo('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><line x1="15" y1="22" x2="15" y2="16"/><line x1="9" y1="16" x2="15" y2="16"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/></svg>')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            academyLogo.includes('x="4"%20y="2"')
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          ساختمان آموزشی
                        </button>
                      </div>

                      {/* Custom File Upload Input */}
                      <div className="flex items-center gap-2 mt-1">
                        <label className="px-3 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>بارگذاری تصویر دلخواه...</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 200 * 1024) {
                                  showToast('error', 'اندازه تصویر باید کمتر از ۲۰۰ کیلوبایت باشد تا با سرعت بهینه ذخیره شود.');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    setAcademyLogo(event.target.result as string);
                                    showToast('success', 'لوگوی سفارشی با موفقیت در پیش‌نمایش بارگذاری شد. لطفا دکمه ذخیره نهایی را بزنید.');
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {academyLogo && (
                          <button
                            type="button"
                            onClick={() => {
                              setAcademyLogo('');
                              showToast('success', 'لوگوی سفارشی پاک‌سازی شد.');
                            }}
                            className="px-2 h-8 rounded-lg text-rose-600 hover:bg-rose-50 text-[10px] font-bold border border-rose-200 transition-colors cursor-pointer"
                          >
                            حذف لوگو
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">تصاویر با کادر مربع (۱:۱) و حجم پایین توصیه می‌شوند.</p>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Academy Phone */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">شماره تماس آموزشگاه</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">شماره تلفن ثابت یا همراه جهت برقراری تماس و درج در گزارشات</div>
                </td>
                <td className="py-3.5">
                  <input
                    type="text"
                    value={academyPhone}
                    onChange={(e) => setAcademyPhone(e.target.value)}
                    placeholder="مثال: ۰۲۱۸۸۸۸۸۸۸۸"
                    className="w-full max-w-md h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-left font-mono"
                    dir="ltr"
                  />
                </td>
              </tr>

              {/* Academy Address */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">آدرس فیزیکی آموزشگاه</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">نشانی پستی دقیق جهت چاپ روی سربرگ‌ها و رسیدهای ثبت‌نام</div>
                </td>
                <td className="py-3.5">
                  <textarea
                    rows={2}
                    value={academyAddress}
                    onChange={(e) => setAcademyAddress(e.target.value)}
                    placeholder="مثال: تهران، خیابان آزادی، پلاک ۱۲"
                    className="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                  />
                </td>
              </tr>

              {/* H14M OS Integration */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span>اتصال به هسته سیستم عامل H14M (سند M14H)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">وضعیت اتصال، استعلام مشخصات عمومی کاربر و اعتبارسنجی توکن امنیتی</div>
                </td>
                <td className="py-3.5">
                  <div className="flex flex-col gap-2.5 max-w-md">
                    {/* Status badge and Refresh button */}
                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-extrabold">وضعیت اتصال:</span>
                        {h14mStatus?.connected ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-850 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-lg" title="هسته سیستم عامل H14M با موفقیت متصل شده است">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            فعال (متصل)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-850 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-lg" title="در انتظار اتصال یا استعلام از طرف هسته H14M">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            در انتظار اتصال
                          </span>
                        )}
                      </div>
                      
                      <button
                        type="button"
                        onClick={fetchH14mInfo}
                        disabled={h14mLoading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-700 disabled:text-slate-400 border border-indigo-200 rounded-lg cursor-pointer transition-all active:scale-95 select-none"
                        title="به‌روزرسانی و استعلام مجدد از هسته سیستم عامل"
                      >
                        <RefreshCw className={`w-3 h-3 ${h14mLoading ? 'animate-spin' : ''}`} />
                        <span>استعلام از H14M</span>
                      </button>
                    </div>

                    {/* H14M User Profile Details */}
                    {h14mUserInfo ? (
                      <div className="bg-indigo-50/45 border border-indigo-100/60 rounded-xl p-3 flex flex-col gap-1.5 text-[11px] text-indigo-950 font-bold">
                        <div className="flex items-center justify-between border-b border-indigo-100/40 pb-1.5">
                          <span className="flex items-center gap-1 text-indigo-800">
                            <User className="w-3.5 h-3.5" />
                            <span>کاربر متصل:</span>
                          </span>
                          <span className="font-mono text-xs text-indigo-900 bg-indigo-100/60 px-1.5 py-0.5 rounded">{h14mUserInfo.username}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-indigo-100/40 pb-1.5">
                          <span className="flex items-center gap-1 text-indigo-800">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>نقش سیستمی:</span>
                          </span>
                          <span className="text-[10px] text-indigo-900 bg-indigo-100/60 px-1.5 py-0.5 rounded">{h14mUserInfo.role === 'partner_developer' ? 'توسعه‌دهنده همکار' : h14mUserInfo.role}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-indigo-100/40 pb-1.5">
                          <span className="flex items-center gap-1 text-indigo-800">
                            <Link className="w-3.5 h-3.5" />
                            <span>برنامه متصل:</span>
                          </span>
                          <span className="text-[10px] text-indigo-900">{h14mUserInfo.connected_app?.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-indigo-750">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />
                            <span>زمان هسته:</span>
                          </span>
                          <span className="font-mono">{new Date(h14mUserInfo.system_time).toLocaleTimeString('fa-IR')} {new Date(h14mUserInfo.system_time).toLocaleDateString('fa-IR')}</span>
                        </div>
                      </div>
                    ) : h14mError ? (
                      <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-2 text-[10px] text-rose-700 font-extrabold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{h14mError}</span>
                      </div>
                    ) : (
                      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 text-[10px] text-slate-400 font-bold text-center">
                        هنوز اطلاعات کاربری از هسته بارگذاری نشده است. روی دکمه «استعلام از H14M» کلیک کنید.
                      </div>
                    )}
                  </div>
                </td>
              </tr>

              {/* Client Version */}
              <tr>
                <td className="py-3.5 pl-3">
                  <div className="font-extrabold text-slate-800">نسخه نرم‌افزار کلاینت</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">شناسه نسخه فعال کلاینت جهت ارزیابی انطباق دیتاسنتر سرور</div>
                </td>
                <td className="py-3.5">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/65 rounded-lg px-2.5 py-1" title="کلاینت همگام با دیتاسنتر سرور">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-mono text-xs font-black text-emerald-950 tracking-tight leading-none">{clientVersion}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Action Button Section inside scroll area to save */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-5 h-10 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm shadow-indigo-100"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>ذخیره نهایی تنظیمات سیستم</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
