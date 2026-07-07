import React, { useState, useEffect } from 'react';
import { Shift, SessionNotes, SessionAttendance, CalendarOverrides } from '../types';
import { 
  getDaysInJalaliMonth, 
  getWeekdayOfJalali, 
  getJalaliMonthName, 
  formatJalali, 
  parseJalaliString,
  getWeekdayShortName,
  isHoliday
} from '../utils/jalali';
import { X, Check, Trash2, CalendarClock } from 'lucide-react';

interface TermCalendarModalProps {
  onClose: () => void;
  selTermEnriched: {
    id: string;
    shiftId: string;
    startDate: string;
    endDate: string;
    sessionsCount: number;
    sessions: string[];
    shiftName: string;
    status: 'current' | 'finished' | 'reserved';
  };
  shifts: Shift[];
  todayDate: string;
  sessionNotes: SessionNotes;
  saveSessionNote: (termId: string, dateStr: string, note: string) => void;
  sessionAttendance: SessionAttendance;
  saveSessionAttendance: (termId: string, dateStr: string, status: 'present' | 'absent' | '') => void;
  isInline?: boolean;
  calendarOverrides: CalendarOverrides;
}

export function TermCalendarModal({
  onClose,
  selTermEnriched,
  shifts,
  todayDate,
  sessionNotes,
  saveSessionNote,
  sessionAttendance,
  saveSessionAttendance,
  isInline = false,
  calendarOverrides,
}: TermCalendarModalProps) {
  const [selectedCalYearMonth, setSelectedCalYearMonth] = useState<{ year: number; month: number } | null>(null);
  const [activeCalendarDate, setActiveCalendarDate] = useState<string | null>(null);
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [tempAttStatus, setTempAttStatus] = useState<'present' | 'absent' | ''>('');

  // Default selected month/day based on startDate or sessions
  useEffect(() => {
    if (selTermEnriched) {
      const parts = parseJalaliString(selTermEnriched.startDate);
      setSelectedCalYearMonth({ year: parts.jy, month: parts.jm });
      
      const todaySession = selTermEnriched.sessions.find((d) => d === todayDate);
      setActiveCalendarDate(todaySession || selTermEnriched.sessions[0] || null);
    }
    setEditingNoteDate(null);
  }, [selTermEnriched, todayDate]);

  const getSpannedMonths = () => {
    if (!selTermEnriched) return [];
    const seen = new Set<string>();
    const result: { year: number; month: number; label: string }[] = [];
    
    selTermEnriched.sessions.forEach((sessDate) => {
      const parts = parseJalaliString(sessDate);
      const key = `${parts.jy}/${parts.jm}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          year: parts.jy,
          month: parts.jm,
          label: `${getJalaliMonthName(parts.jm)} ${parts.jy}`,
        });
      }
    });
    
    return result;
  };

  const getCalData = () => {
    let year: number;
    let month: number;
    
    if (selectedCalYearMonth) {
      year = selectedCalYearMonth.year;
      month = selectedCalYearMonth.month;
    } else if (selTermEnriched) {
      const parts = parseJalaliString(selTermEnriched.startDate);
      year = parts.jy;
      month = parts.jm;
    } else {
      year = 1405;
      month = 3;
    }

    const days = getDaysInJalaliMonth(year, month);
    const startWeekDay = getWeekdayOfJalali(year, month, 1);

    const slots: ({ day: number; dateStr: string } | null)[] = [];
    for (let i = 0; i < startWeekDay; i++) {
      slots.push(null);
    }
    for (let d = 1; d <= days; d++) {
      slots.push({ day: d, dateStr: formatJalali(year, month, d) });
    }

    return { slots, year, month };
  };

  const { slots: termCalSlots, year: termCalYear, month: termCalMonth } = getCalData();

  return (
    <div 
      id="calendar-dialog-overlay"
      className={isInline 
        ? "w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in" 
        : "fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-40 p-4 animate-fade-in"}
      onClick={isInline ? undefined : onClose}
    >
      <div 
        className={isInline 
          ? "w-full h-full flex-1 min-h-0 p-0 flex flex-col gap-4 text-right font-sans transition-all overflow-hidden" 
          : "bg-white rounded-2xl border border-slate-200 max-w-4xl w-full p-6 shadow-2xl animate-scale-up flex flex-col gap-5 text-right font-sans hover:shadow-3xl transition-all"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header of Dialog */}
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center flex-row-reverse shrink-0">
          {!isInline ? (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-605 transition-colors p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer animate-fade-in"
              title="بستن تقویم"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-5" />
          )}
          
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">تقویم تعاملی و ثبت مستندات جلسات مراجع:</span>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-row-reverse justify-end font-sans">
              <span className="text-blue-700">{selTermEnriched.shiftName}</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500 font-mono font-bold">بازه: {selTermEnriched.startDate} تا {selTermEnriched.endDate}</span>
            </h3>
          </div>
        </div>

        {/* Calendar view body */}
        <div className={isInline 
          ? "w-full flex-1 min-h-0 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-xs overflow-y-auto" 
          : "w-full bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs"}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 p-[2px] pb-[2px] mb-0">
            <div>
              <span className="text-[10px] text-slate-400 font-bold">نمای ماه‌های دارای جلسه در این دوره:</span>
              <div className="flex flex-wrap gap-1 mt-1.5 flex-row-reverse justify-end">
                {getSpannedMonths().map((m) => {
                  const isCurrent = selectedCalYearMonth?.year === m.year && selectedCalYearMonth?.month === m.month;
                  return (
                    <button
                      key={`${m.year}-${m.month}`}
                      onClick={() => {
                        setSelectedCalYearMonth({ year: m.year, month: m.month });
                      }}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}

                {/* دکمه انتخاب امروز */}
                <button
                  type="button"
                  id="user-cal-today-btn"
                  onClick={() => {
                    const todayPartsNow = parseJalaliString(todayDate);
                    setSelectedCalYearMonth({ year: todayPartsNow.jy, month: todayPartsNow.jm });
                    
                    if (selTermEnriched.sessions.includes(todayDate)) {
                      setActiveCalendarDate(todayDate);
                      setEditingNoteDate(todayDate);
                      const noteKey = `${selTermEnriched.id}_${todayDate}`;
                      setTempNoteText(sessionNotes[noteKey] || '');
                      setTempAttStatus(sessionAttendance[noteKey] || '');
                    } else {
                      setActiveCalendarDate(todayDate);
                    }
                  }}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer border bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 hover:border-amber-300 flex items-center gap-1 shadow-3xs"
                  title="پرش به ماه جاری و انتخاب تاریخ امروز"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
                  <span>انتخاب امروز</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 flex-row-reverse flex-wrap">
              <div className="flex items-center gap-1 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-300 inline-block"></span>
                <span>جلسه ساده</span>
              </div>
              <div className="flex items-center gap-1 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-300 inline-block"></span>
                <span>دارای یادداشت</span>
              </div>
              <div className="flex items-center gap-1 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded bg-rose-50 border border-rose-200 inline-block"></span>
                <span>روز تعطیل</span>
              </div>
              <div className="flex items-center gap-1 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block ring-1 ring-blue-600"></span>
                <span>روز فعال انتخابی</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mt-0 mr-0 ml-0 text-center text-xs font-black text-slate-500 pt-[6px] px-0 border-b border-slate-200 pb-[6px] mb-[2px]" dir="rtl">
            {[0, 1, 2, 3, 4, 5, 6].map((w) => (
              <div key={w} className={w === 6 ? 'text-rose-600 font-black' : ''}>{getWeekdayShortName(w)}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2" dir="rtl">
            {termCalSlots.map((slot, i) => {
              if (!slot) {
                return (
                  <div 
                    key={`empty-cell-${i}`} 
                    className="opacity-25 bg-slate-100/40 rounded-xl border border-dashed border-slate-200/30 w-full p-2 text-right" 
                  />
                );
              }

              const isSessionDay = selTermEnriched.sessions.includes(slot.dateStr);
              
              if (!isSessionDay) {
                const isDayHoliday = isHoliday(slot.dateStr, calendarOverrides);
                return (
                  <div
                    key={`term-cal-${slot.day}`}
                    className={`flex items-center justify-center p-2 rounded-xl border text-right transition-all select-none cursor-not-allowed w-full min-h-0 ${
                      isDayHoliday 
                        ? 'bg-rose-50/60 border-rose-150 text-rose-700' 
                        : 'bg-slate-50/75 border-slate-200/70 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full flex-row-reverse gap-1">
                      <div className="flex items-center gap-1 flex-row-reverse">
                        <span className={`text-[17px] font-black font-mono leading-none ${
                          isDayHoliday ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {slot.day}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-row-reverse">
                        <span className={`px-1.5 py-0.5 rounded-lg text-[8.5px] font-bold leading-none shrink-0 border ${
                          isDayHoliday 
                            ? 'border-rose-200 bg-rose-50 text-rose-600' 
                            : 'border-slate-200/60 bg-slate-100 text-slate-400'
                        } font-sans`}>
                          {isDayHoliday ? 'تعطیل' : 'غیرفعال'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              const sessionNum = selTermEnriched.sessions.indexOf(slot.dateStr) + 1;
              const noteKey = `${selTermEnriched.id}_${slot.dateStr}`;
              const noteVal = sessionNotes[noteKey] || '';
              const attVal = sessionAttendance[noteKey] || '';
              const hasNote = noteVal.trim().length > 0;
              const isActive = activeCalendarDate === slot.dateStr;
              const isToday = todayDate === slot.dateStr;
              const isDayHoliday = isHoliday(slot.dateStr, calendarOverrides);

              const bgClass = isActive
                ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-550/15 shadow-xs scale-[1.01]'
                : isToday
                ? 'bg-amber-50/70 hover:bg-amber-100/30 border-amber-300 shadow-xs ring-2 ring-amber-400/20'
                : hasNote
                ? 'bg-amber-50/70 hover:bg-amber-100/30 border-amber-300 shadow-xs'
                : 'bg-white hover:bg-slate-100/50 border-slate-200';

              const textClass = isActive ? 'text-blue-700' : isToday ? 'text-amber-700' : 'text-slate-800';

              return (
                <button
                  key={`term-cal-${slot.day}`}
                  onClick={() => {
                    setActiveCalendarDate(slot.dateStr);
                    setEditingNoteDate(slot.dateStr);
                    setTempNoteText(noteVal);
                    setTempAttStatus(attVal);
                  }}
                  className={`flex items-center justify-center p-2 rounded-xl border text-right transition-all group select-none cursor-pointer w-full ${bgClass}`}
                >
                  <div className="flex items-center justify-between w-full flex-row-reverse gap-1">
                    {/* Right side: Day number */}
                    <div className="flex items-center gap-1 flex-row-reverse">
                      <span className={`text-[17px] font-black font-mono leading-none ${textClass}`}>
                        {slot.day}
                      </span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="امروز" />
                      )}
                    </div>

                    {/* Left side: Session Badge or Note indicator */}
                    <div className="flex items-center gap-1.5 flex-row-reverse">
                      {attVal === 'present' ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="حاضر" />
                      ) : attVal === 'absent' ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500" title="غایب" />
                      ) : null}

                      {hasNote && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse animate-duration-1000" title="دارای یادداشت مراجع" />
                      )}
                      
                      <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black leading-none shrink-0 border flex items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-blue-600 border-blue-700 text-white shadow-3xs'
                          : hasNote
                          ? 'bg-amber-100 border-amber-200 text-amber-800 font-bold'
                          : 'bg-indigo-50 border-indigo-150 text-indigo-700 font-bold'
                      }`} title={`جلسه ${sessionNum}`}>
                        <span className="font-sans text-[8.5px] font-black opacity-80">جلسه</span>
                        <span className="font-mono text-xs">{sessionNum}</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions footer */}
        {!isInline && (
          <div className="flex justify-end pt-1 shrink-0">
            <button
              onClick={onClose}
              className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors font-sans"
            >
              بستن پنجره تقویم
            </button>
          </div>
        )}
      </div>

      {/* Note modal dialog internally managed */}
      {editingNoteDate && (
        <div 
          id="session-note-dialog" 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setEditingNoteDate(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl animate-scale-up flex flex-col gap-4 text-right font-sans hover:shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center flex-row-reverse">
              <button 
                onClick={() => setEditingNoteDate(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
              <div>
                <div className="flex items-center gap-1.5 flex-row-reverse justify-end">
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                    {editingNoteDate}
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-100">
                    جلسه {selTermEnriched ? selTermEnriched.sessions.indexOf(editingNoteDate) + 1 : 0} از {selTermEnriched?.sessionsCount || 0}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 mt-2 font-sans">
                  یادداشت و جزئیات جلسه‌ روز
                </h4>
              </div>
            </div>

            {/* Attendance fields */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-500">وضعیت حضور و غیاب جلسه:</label>
              <div className="flex gap-2 flex-row-reverse justify-start">
                <button
                  type="button"
                  id="dialog-att-present-btn"
                  onClick={() => setTempAttStatus('present')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 transition-all cursor-pointer ${
                    tempAttStatus === 'present'
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حاضر</span>
                </button>
                <button
                  type="button"
                  id="dialog-att-absent-btn"
                  onClick={() => setTempAttStatus('absent')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 transition-all cursor-pointer ${
                    tempAttStatus === 'absent'
                      ? 'bg-rose-600 border-rose-700 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>غایب</span>
                </button>
                <button
                  type="button"
                  id="dialog-att-unmarked-btn"
                  onClick={() => setTempAttStatus('')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 transition-all cursor-pointer ${
                    tempAttStatus === ''
                      ? 'bg-slate-400 border-slate-550 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span>ثبت‌نشده</span>
                </button>
              </div>
            </div>

            {/* Body text input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500">متن یادداشت تخصصی جلسه مراجع:</label>
              <textarea
                id="dialog-note-textarea"
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
                placeholder="آیتم‌های یادداشتی مراجع مانند پیگیری روند تحقیق، فعالیت‌ها یا جزئیات تمدید..."
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 p-3 text-xs rounded-xl focus:outline-none transition-colors h-32 resize-none leading-relaxed font-sans text-right"
                dir="rtl"
                autoFocus
              />
            </div>

            {/* Actions footer */}
            <div className="flex justify-between items-center gap-3 pt-2 flex-row-reverse">
              <div className="flex gap-2 flex-row-reverse">
                <button
                  onClick={() => {
                    saveSessionNote(selTermEnriched.id, editingNoteDate, tempNoteText);
                    saveSessionAttendance(selTermEnriched.id, editingNoteDate, tempAttStatus);
                    setEditingNoteDate(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs font-sans"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ذخیره تغییرات</span>
                </button>
                <button
                  onClick={() => setEditingNoteDate(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl cursor-pointer font-sans"
                >
                  انصراف
                </button>
              </div>

              {(tempNoteText.trim() || tempAttStatus) && (
                <button
                  onClick={() => {
                    saveSessionNote(selTermEnriched.id, editingNoteDate, '');
                    saveSessionAttendance(selTermEnriched.id, editingNoteDate, '');
                    setEditingNoteDate(null);
                  }}
                  className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-all cursor-pointer font-sans text-xs flex items-center gap-1"
                  title="پاک کردن یادداشت"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold">پاک کردن</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
