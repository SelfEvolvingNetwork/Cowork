import React from 'react';
import { ShieldAlert, FolderCheck, Laptop, Archive, FolderOpen, Copy } from 'lucide-react';

interface BackupConflictDialogProps {
  conflictBackup: {
    handle: any;
    existingData: any;
    currentData: any;
  };
  onResolveArchiveAndSave: () => void;
  onResolveRestore: () => void;
  onResolveOverwrite: () => void;
  onResolveCancelAndDisconnect: () => void;
}

export function BackupConflictDialog({
  conflictBackup,
  onResolveArchiveAndSave,
  onResolveRestore,
  onResolveOverwrite,
  onResolveCancelAndDisconnect,
}: BackupConflictDialogProps) {
  return (
    <div id="backup-conflict-dialog" className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-95 /60 backdrop-blur-xs animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}>
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-right animate-slide-up flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-center gap-3 pr-1 pb-3 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-4xs shrink-0 border border-amber-200/30">
            <ShieldAlert className="w-5 h-5 animate-pulse text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              همپوشانی داده‌ها و تداخل فایل پشتیبان
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              یک فایل پشتیبان فعال از قبل در این پوشه وجود دارد که با داده‌های فعلی نرم‌افزار متفاوت است.
            </p>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Existing file column */}
          <div className="bg-amber-50/45 border border-amber-200/50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-800 pb-2 border-b border-indigo-100/60 shrink-0">
              <FolderCheck className="w-4 h-4 text-amber-600" />
              <span className="text-[11.5px] font-black">فایل پشتیبان موجود در پوشه</span>
            </div>
            
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">تاریخ ذخیره فایل:</span>
                <span className="font-mono text-slate-700 font-bold">
                  {conflictBackup.existingData.exportedAt ? new Date(conflictBackup.existingData.exportedAt).toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'نامعلوم'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] items-center">
                <span className="text-slate-500 font-medium">تعداد کل اعضا:</span>
                <span className="bg-white border border-slate-100 px-2 py-0.5 rounded font-mono text-slate-800 font-extrabold shadow-5xs">
                  {conflictBackup.existingData.members?.length || 0} نفر
                </span>
              </div>
              <div className="flex justify-between text-[11px] items-center">
                <span className="text-slate-500 font-medium">عضویت‌ها/اشتراک‌ها:</span>
                <span className="bg-white border border-slate-100 px-2 py-0.5 rounded font-mono text-slate-800 font-extrabold shadow-5xs">
                  {conflictBackup.existingData.terms?.length || 0} مورد
                </span>
              </div>
              <div className="flex justify-between text-[11px] items-center">
                <span className="text-slate-500 font-medium">تعداد شیفت‌ها:</span>
                <span className="bg-white border border-slate-100 px-2 py-0.5 rounded font-mono text-slate-800 font-extrabold shadow-5xs">
                  {conflictBackup.existingData.shifts?.length || 0} شیفت
                </span>
              </div>
            </div>
          </div>

          {/* Current App State Column */}
          <div className="bg-indigo-50/45 border border-indigo-200/50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-indigo-800 pb-2 border-b border-indigo-100/60 shrink-0">
              <Laptop className="w-4 h-4 text-indigo-650" />
              <span className="text-[11.5px] font-black">داده‌های فعلی نرم‌افزار</span>
            </div>
            
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">وضعیت فعلی:</span>
                <span className="text-slate-755 font-bold bg-white px-2 py-0.5 rounded border border-slate-100 text-[10px] leading-none shadow-5xs">در حال کار</span>
              </div>
              <div className="flex justify-between text-[11px] items-center">
                <span className="text-slate-500 font-medium">تعداد کل اعضا:</span>
                <span className="bg-white border border-slate-100 px-2 py-0.5 rounded font-mono text-indigo-850 font-extrabold shadow-5xs">
                  {conflictBackup.currentData.members?.length || 0} نفر
                </span>
              </div>
              <div className="flex justify-between text-[11px] items-center">
                <span className="text-slate-500 font-medium">عضویت‌ها/اشتراک‌ها:</span>
                <span className="bg-white border border-slate-100 px-2 py-0.5 rounded font-mono text-indigo-850 font-extrabold shadow-5xs">
                  {conflictBackup.currentData.terms?.length || 0} مورد
                </span>
              </div>
              <div className="flex justify-between text-[11px] items-center">
                <span className="text-slate-500 font-medium">تعداد شیفت‌ها:</span>
                <span className="bg-white border border-slate-100 px-2 py-0.5 rounded font-mono text-indigo-850 font-extrabold shadow-5xs">
                  {conflictBackup.currentData.shifts?.length || 0} شیفت
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Description Warning Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10.5px] leading-relaxed text-slate-600">
          برای جلوگیری از حذف ناخواسته اطلاعات تاریخی و حفظ امنیت سیستم، یکی از راه‌حل‌های زیر را برای همگام‌سازی انتخاب نمایید. در نظر داشته باشید که بازنویسی منجر به پاک شدن فایل قبلی در پوشه و بازیابی منجر به پاک شدن اطلاعات بر روی این مرورگر خواهد شد.
        </div>

        {/* Resolution Buttons Grid */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 shrink-0">
          
          {/* Option 2: Archive old, save new */}
          <button
            type="button"
            onClick={onResolveArchiveAndSave}
            className="w-full h-11 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold px-4 flex items-center justify-between transition-colors border border-emerald-200 cursor-pointer shadow-4xs"
          >
            <div className="flex items-center gap-2.5">
              <Archive className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-800">۱. آرشیو فایل پشتیبان قبلی و ذخیره داده‌های جاری در پوشه</span>
            </div>
            <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded font-extrabold">پیشنهادی و ایمن‌ترین روش</span>
          </button>

          {/* Option 1: Load file from Directory into memory */}
          <button
            type="button"
            onClick={onResolveRestore}
            className="w-full h-11 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold px-4 flex items-center justify-between transition-colors border border-indigo-200 cursor-pointer shadow-4xs"
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-slate-800">۲. بازیابی و بارگذاری اطلاعات پشتیبان پوشه در مرورگر</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded select-none">جایگزینی داده‌های فعلی برنامه</span>
          </button>

          {/* Option 3: Overwrite file with current app state */}
          <button
            type="button"
            onClick={onResolveOverwrite}
            className="w-full h-11 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold px-4 flex items-center justify-between transition-colors border border-slate-200 cursor-pointer shadow-4xs"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-slate-800">۳. بازنویسی صریح فایل پشتیان پوشه با داده‌های جاری نرم‌افزار</span>
            </div>
            <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded select-none font-bold">حذف فایل قبلی بدون لغو</span>
          </button>

        </div>

        {/* Secondary Option: Cancel & Disconnect */}
        <div className="flex justify-between items-center mt-1 shrink-0">
          <span className="text-[10px] text-slate-400 font-medium">ساعت سیستم: {new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            type="button"
            onClick={onResolveCancelAndDisconnect}
            className="px-5 h-9 text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl cursor-pointer transition-colors border border-rose-100"
          >
            انصراف و قطع پیوند پوشه
          </button>
        </div>

      </div>
    </div>
  );
}
