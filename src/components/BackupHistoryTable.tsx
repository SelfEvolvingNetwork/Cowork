import React from 'react';
import { HardDrive, Users, FileText, CheckSquare, Trash2 } from 'lucide-react';

export interface LocalHistoryItem {
  timestamp: string;
  id: string;
  recordsCount: {
    members: number;
    terms: number;
    attendance: number;
  };
  data: string;
}

interface BackupHistoryTableProps {
  localHistory: LocalHistoryItem[];
  onRestore: (item: LocalHistoryItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function BackupHistoryTable({
  localHistory,
  onRestore,
  onDelete,
}: BackupHistoryTableProps) {
  return (
    <div id="local-history-panel" className="flex-1 min-h-0 bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col shadow-3xs overflow-hidden">
      
      {/* Table Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
          <h3 className="text-xs font-extrabold text-slate-800 leading-none">تاریخچه نسخه‌های پشتیبان حافظه مرورگر</h3>
        </div>
        <span className="text-[10px] text-slate-400 font-bold font-sans bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/50">۵ نسخه اخیر</span>
      </div>

      {/* Scrollable Table Content */}
      <div className="flex-grow overflow-y-auto mt-2.5 pr-1 space-y-2 select-none scrollbar-thin">
        {localHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-100 bg-slate-50/25 rounded-2xl">
            <HardDrive className="w-7 h-7 text-slate-300 mb-2 stroke-[1.5]" />
            <p className="text-[11px] text-slate-500 font-bold">هیچ نسخه محلی ثبت نشده است</p>
            <p className="text-[9.5px] text-slate-400 mt-1 max-w-[280px]">با ثبت اولین تغییرات در اعضا، قراردادها یا شیفت‌ها، نسخه‌ها به صورت خودکار ثبت خواهند شد.</p>
          </div>
        ) : (
          <table className="w-full text-right border-collapse text-xs select-none">
            <thead className="bg-slate-50/90 text-slate-500 sticky top-0 font-extrabold border-b border-slate-150 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-2.5 px-3 text-center w-[8%]">ردیف</th>
                <th className="py-2.5 px-3 text-right">زمان پشتیبانی</th>
                <th className="py-2.5 px-3 text-right">خلاصه آمار اعضا و قراردادها</th>
                <th className="py-2.5 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70">
              {localHistory.map((item, idx) => (
                <tr 
                  key={item.id}
                  className="hover:bg-slate-50/60 group transition-all duration-150"
                >
                  <td className="py-2.5 px-3 text-slate-400 font-bold font-mono text-[10px] text-center w-[8%]">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-extrabold text-slate-800 font-mono text-[11px]">{item.timestamp}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-500">
                      {/* Members counter */}
                      <span className="flex items-center gap-1 bg-slate-50/80 border border-slate-150 rounded-lg px-2 py-0.5 shadow-5xs" title="تعداد اعضای فعال">
                        <Users className="w-3 h-3 text-slate-450" />
                        <span className="text-[9.5px]">اعضا:</span>
                        <span className="text-slate-800 font-black font-mono">{item.recordsCount.members}</span>
                      </span>
                      {/* Terms counter */}
                      <span className="flex items-center gap-1 bg-slate-50/80 border border-slate-150 rounded-lg px-2 py-0.5 shadow-5xs" title="تعداد کل قراردادهای فعال">
                        <FileText className="w-3 h-3 text-slate-455" />
                        <span className="text-[9.5px]">قراردادها:</span>
                        <span className="text-slate-800 font-black font-mono">{item.recordsCount.terms}</span>
                      </span>
                      {/* Attendance counter */}
                      <span className="flex items-center gap-1 bg-slate-50/80 border border-slate-150 rounded-lg px-2 py-0.5 shadow-5xs" title="تعداد جلسات حضور و غیاب شده">
                        <CheckSquare className="w-3 h-3 text-slate-455" />
                        <span className="text-[9.5px]">جلسات حضور:</span>
                        <span className="text-slate-800 font-black font-mono">{item.recordsCount.attendance}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-1 px-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRestore(item)}
                        className="px-2.5 py-1 text-[10px] bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-650 rounded-lg font-black transition-all cursor-pointer inline-flex items-center justify-center shadow-5xs"
                        title="بازیابی داده‌های پشتیبان روی مرورگر فعلی"
                      >
                        بازیابی داده‌ها
                      </button>
                      <button
                        type="button"
                        id={`delete-hist-btn-${item.id}`}
                        onClick={(e) => onDelete(item.id, e)}
                        title="حذف دائمی این نسخه"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
