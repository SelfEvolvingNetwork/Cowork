import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Armchair, 
  ShieldCheck, 
  MessageSquare, 
  ToggleLeft, 
  ToggleRight,
  Save,
  Undo2,
  ArrowRight,
  CalendarDays
} from 'lucide-react';
import { Member, Term, SessionNotes, CalendarOverrides, SessionAttendance } from '../types';
import { 
  parseJalaliString, 
  getJalaliMonthName, 
  getWeekdayName, 
  getWeekdayOfJalali, 
  isHoliday 
} from '../utils/jalali';

interface CalendarDayDetailsModalProps {
  onClose: () => void;
  selectedDate: string;
  todayDate: string;
  calendarOverrides: CalendarOverrides;
  toggleDayStatus: (dateStr: string) => void;
  members: Member[];
  terms: Term[];
  sessionNotes: SessionNotes;
  saveSessionNote: (termId: string, dateStr: string, note: string) => void;
  sessionAttendance: SessionAttendance;
  saveSessionAttendance: (termId: string, dateStr: string, status: 'present' | 'absent' | '') => void;
}

export function CalendarDayDetailsModal({
  onClose,
  selectedDate,
  todayDate,
  calendarOverrides,
  toggleDayStatus,
  members,
  terms,
  sessionNotes,
  saveSessionNote,
  sessionAttendance,
  saveSessionAttendance,
}: CalendarDayDetailsModalProps) {
  const selParts = parseJalaliString(selectedDate);
  const selectedDayOfWeekIndex = getWeekdayOfJalali(selParts.jy, selParts.jm, selParts.jd);
  const selectedDayName = getWeekdayName(selectedDayOfWeekIndex);
  const selectedDayIsHoliday = isHoliday(selectedDate, calendarOverrides);

  // Note editor states
  const [editingNoteTermId, setEditingNoteTermId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  // Attendees list on selected date
  const attendees = terms
    .filter((term) => term.sessions.includes(selectedDate))
    .map((term) => {
      const m = members.find((mem) => mem.id === term.memberId);
      return {
        termId: term.id,
        member: m,
        sessions: term.sessions,
        startDate: term.startDate,
        endDate: term.endDate,
        deskType: term.deskType || 'regular',
        noteKey: `${term.id}_${selectedDate}`,
      };
    })
    .filter((a) => a.member !== undefined);

  const handleSaveNote = (termId: string) => {
    saveSessionNote(termId, selectedDate, tempNoteText);
    setEditingNoteTermId(null);
  };

  return (
    <div 
      id="day-edit-page" 
      className="w-full flex-1 flex flex-col bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-right animate-fade-in"
    >
      {/* Page Header */}
      <div className="flex justify-between items-center bg-slate-50/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex-row-reverse shrink-0">
        
        {/* Prominent Back Button (Right direction since RTL) */}
        <button 
          onClick={onClose} 
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-3xs hover:shadow-2xs text-xs font-bold font-sans"
          title="بازگشت به تقویم اصلی"
        >
          <ArrowRight className="w-4 h-4 text-slate-500" />
          <span>بازگشت به تقویم</span>
        </button>

        {/* Selected date display */}
        <div className="text-right flex items-center gap-3.5 flex-row-reverse">
          <div className="p-3 bg-blue-550/10 text-blue-600 rounded-2xl border border-blue-100">
            <CalendarDays className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="text-base sm:text-md font-black text-slate-900 tracking-tight">
              {selectedDayName}، {selParts.jd} {getJalaliMonthName(selParts.jm)} {selParts.jy}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold flex items-center gap-1.5 flex-row-reverse">
              <span>وضعیت روز کاری:</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                selectedDayIsHoliday 
                  ? 'bg-rose-50 text-rose-705 border border-rose-100' 
                  : 'bg-emerald-50 text-emerald-705 border border-emerald-100'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedDayIsHoliday ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`} />
                {selectedDayIsHoliday ? 'تعطیل عمومی' : 'کاری فعال مراجعین'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Pane Split (Two Columns on Wide Screens) */}
      <div className="p-6 overflow-y-auto lg:overflow-hidden flex-1 min-h-0 bg-slate-50/20 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 max-w-6xl mx-auto w-full flex-1 min-h-0 items-stretch">
          
          {/* Right Column: Administrative Configurations */}
          <div className="lg:col-span-2 flex flex-col gap-4 shrink-0 justify-start">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-3xs">
              <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wide">مدیریت وضعیت قانونی تقویم</span>
              <h4 className="text-xs font-black text-slate-800 mt-1.5">تعطیلی عمومی / تعویق جلسات</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mt-2">
                در صورتی که با تعطیلی‌های ناگهانی یا ابطال سرویس در این روز مواجه شدید، وضعیت این روز را تغییر دهید تا به طور خودکار به مراجعین جبرانی داده شود.
              </p>
              
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-center flex-row-reverse text-xs font-bold text-slate-600">
                  <span>وضعیت فعلی روز:</span>
                  <span className={`font-black ${selectedDayIsHoliday ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {selectedDayIsHoliday ? 'تعطیل عمومی' : 'روز کاری فعال'}
                  </span>
                </div>

                <button
                  id={`dialog-toggle-day-btn-${selectedDate}`}
                  onClick={() => toggleDayStatus(selectedDate)}
                  className={`w-full flex items-center justify-between gap-1.5 px-3.5 py-2.5 text-xs font-black rounded-xl cursor-pointer shadow-3xs hover:shadow-2xs transition-all border ${
                    selectedDayIsHoliday 
                      ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <span>تغییر با یک کلیک</span>
                  {selectedDayIsHoliday ? (
                    <ToggleLeft className="w-5.5 h-4.5 text-rose-500 hover:text-rose-600" />
                  ) : (
                    <ToggleRight className="w-5.5 h-4.5 text-emerald-600 hover:text-emerald-750" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-50/30 rounded-3xl p-5 border border-blue-100/50 shadow-3xs">
              <h4 className="text-xs font-black text-slate-700">راهنمای هوشمند جلسات تعطیل:</h4>
              <p className="text-[11.5px] text-slate-500 leading-relaxed mt-2 text-right">
                ثبت تاریخ به عنوان تعطیل، اعتبار دوره‌ها را به تعویق انداخته و زمان آن را افزایش می‌دهد. بدین ترتیب مراجعین در موعد سرآمد دوره‌شان حق حضور کامل را حفظ می‌کنند.
              </p>
            </div>
          </div>

          {/* Left Column: Scheduled Coworkers Attendance list */}
          <div className="lg:col-span-5 flex flex-col lg:h-full min-h-0 overflow-hidden">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-3xs flex flex-col h-full min-h-0">
              <div className="flex justify-between items-center flex-row-reverse pb-4 border-b border-slate-100 shrink-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-800">
                  مراجعین و مشترکین رزرو شده در این تاریخ
                </h4>
                <span className="text-[10.5px] font-black bg-blue-550/10 text-blue-700 px-3 py-1 rounded-xl font-mono border border-blue-105">
                  {attendees.length} نفر رزرو فعال
                </span>
              </div>

              {attendees.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 flex-1 overflow-y-auto">
                  <span className="text-4xl">🛋️</span>
                  <p className="text-xs text-slate-500 mt-3 font-extrabold">هیچ کاربری در این تاریخ سانس کاری فعالی ثبت نکرده است.</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">مراجعینی در این روز نمایش داده می‌شوند که دوره فعال آنها شامل این تاریخ باشد.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 mt-2 flex-1 overflow-y-auto pr-1">
                  {attendees.map((a) => {
                    const isEditingThis = editingNoteTermId === a.termId;
                    const noteValue = sessionNotes[a.noteKey] || '';
                    const attValue = sessionAttendance[a.noteKey] || '';
                    
                    // Calculate current session index number
                    const currentSessionIndex = a.sessions.indexOf(selectedDate) + 1;

                    return (
                      <div key={a.termId} className="py-4.5 first:pt-2 last:pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-row-reverse">
                        
                        {/* Member Information Frame */}
                        <div className="flex items-center gap-3 flex-row-reverse w-full sm:w-auto shrink-0 select-none">
                          <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-md shadow-3xs shrink-0">
                            👤
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 flex-row-reverse">
                              <h5 className="font-extrabold text-xs sm:text-sm text-slate-850">{a.member?.fullName}</h5>
                              {a.deskType === 'premium' ? (
                                <span className="inline-flex items-center bg-amber-550/10 text-amber-700 border border-amber-200/55 p-1 rounded-lg" title="صندلی ویژه (VIP)">
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center bg-slate-50 text-slate-650 border border-slate-205 p-1 rounded-lg" title="صندلی عادی عمومی">
                                  <Armchair className="w-3.5 h-3.5 text-slate-500" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span>{a.member?.phone}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-extrabold text-blue-600">جلسه {currentSessionIndex} از {a.sessions.length}</span>
                            </div>
                          </div>
                        </div>

                        {/* Presence and custom note actions frame */}
                        <div className="flex-1 w-full lg:max-w-md flex flex-col gap-2">
                          
                          {/* Attendance Switches */}
                          <div className="flex items-center justify-between flex-row-reverse gap-2">
                            <div className="flex items-center gap-1.5 flex-row-reverse shrink-0">
                              <span className="text-[10.5px] text-slate-400 font-bold">ثبت حضور:</span>
                              
                              <button
                                id={`quick-present-btn-cal-${a.termId}`}
                                onClick={() => {
                                  const nextAtt = attValue === 'present' ? '' : 'present';
                                  saveSessionAttendance(a.termId, selectedDate, nextAtt);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                                  attValue === 'present'
                                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-3xs'
                                    : 'bg-emerald-50/40 border border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>حاضر</span>
                              </button>

                              <button
                                id={`quick-absent-btn-cal-${a.termId}`}
                                onClick={() => {
                                  const nextAtt = attValue === 'absent' ? '' : 'absent';
                                  saveSessionAttendance(a.termId, selectedDate, nextAtt);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                                  attValue === 'absent'
                                    ? 'bg-rose-600 border-rose-700 text-white shadow-3xs'
                                    : 'bg-rose-50/40 border border-rose-100 text-rose-700 hover:bg-rose-100'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>غایب</span>
                              </button>
                            </div>

                            {/* Note Editor link */}
                            {!isEditingThis ? (
                              <button
                                id={`edit-note-btn-${a.termId}`}
                                onClick={() => {
                                  setEditingNoteTermId(a.termId);
                                  setTempNoteText(noteValue);
                                }}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-extrabold cursor-pointer flex items-center gap-1 flex-row-reverse"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                <span>یادداشت کتبی</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-bold font-sans">در حال ویرایش...</span>
                            )}
                          </div>

                          {/* Render Note Container */}
                          <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/80">
                            {isEditingThis ? (
                              <div className="flex flex-col gap-1.5">
                                <textarea
                                  id={`textarea-note-${a.termId}`}
                                  value={tempNoteText}
                                  onChange={(e) => setTempNoteText(e.target.value)}
                                  placeholder="مثالی: بابت پرداختی هزینه کمد، انصراف یا تاخیر مراجع..."
                                  className="w-full bg-white border border-slate-300 text-slate-800 p-2 text-xs rounded-xl focus:outline-none focus:border-blue-500 h-14 resize-none text-right font-medium"
                                  dir="rtl"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    id={`save-note-btn-${a.termId}`}
                                    onClick={() => handleSaveNote(a.termId)}
                                    className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1"
                                    title="ذخیره"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>ذخیره</span>
                                  </button>
                                  <button
                                    id={`cancel-note-btn-${a.termId}`}
                                    onClick={() => setEditingNoteTermId(null)}
                                    className="p-1 px-2 text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1"
                                    title="لغو"
                                  >
                                    <Undo2 className="w-3.5 h-3.5" />
                                    <span>لغو</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className={`text-xs ${noteValue.trim() ? 'text-slate-800 font-bold pb-0.5' : 'text-slate-400 font-medium italic'}`}>
                                {noteValue.trim() ? noteValue : 'یادداشت کتبی ثبت نشده است...'}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
