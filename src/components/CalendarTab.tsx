import React, { useState } from 'react';
import { 
  getDaysInJalaliMonth, 
  getWeekdayOfJalali, 
  getJalaliMonthName, 
  isHoliday, 
  formatJalali, 
  parseJalaliString,
  getWeekdayName,
  getWeekdayShortName
} from '../utils/jalali';
import { CalendarOverrides, Member, Term, SessionNotes, SessionAttendance } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays,
  Coffee,
  Briefcase
} from 'lucide-react';
import { CalendarDayDetailsModal } from './CalendarDayDetailsModal';

interface CalendarTabProps {
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

export function CalendarTab({
  todayDate,
  calendarOverrides,
  toggleDayStatus,
  members,
  terms,
  sessionNotes,
  saveSessionNote,
  sessionAttendance,
  saveSessionAttendance,
}: CalendarTabProps) {
  const todayParts = parseJalaliString(todayDate);
  
  const [currentYear, setCurrentYear] = useState(todayParts.jy);
  const [currentMonth, setCurrentMonth] = useState(todayParts.jm);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Move to next month
  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Move to previous month
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextYear = () => {
    setCurrentYear((prev) => prev + 1);
  };

  const handlePrevYear = () => {
    setCurrentYear((prev) => prev - 1);
  };

  // Generate calendar slots
  const daysInMonth = getDaysInJalaliMonth(currentYear, currentMonth);
  const firstDayWeekday = getWeekdayOfJalali(currentYear, currentMonth, 1);
  const calendarSlots: ({ day: number; dateStr: string } | null)[] = [];
  
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarSlots.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = formatJalali(currentYear, currentMonth, d);
    calendarSlots.push({ day: d, dateStr: dStr });
  }

  if (isDialogOpen) {
    return (
      <div id="calendar-tab-details" className="w-full flex-1 flex flex-col min-h-0 animate-fade-in text-right">
        <CalendarDayDetailsModal
          onClose={() => setIsDialogOpen(false)}
          selectedDate={selectedDate}
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
      </div>
    );
  }

  return (
    <div id="calendar-tab" className="flex flex-col gap-4 animate-fade-in text-right">
      
      {/* 100% Full-Width Interactive Calendar Grid - Flat integration with the full visual space */}
      <div id="full-width-calendar-card" className="flex flex-col w-full text-right">
        
        {/* Calendar Header with Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pb-[6px] pr-0 pl-0 pt-[3px] border-b border-slate-200 mb-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5.5 h-5.5 text-blue-600" />
            <h2 className="text-md font-bold text-slate-800 flex items-center gap-1">
              <span>تقویم و کنترل جلسات کاری:</span>
              <span className="text-blue-600 font-extrabold">{getJalaliMonthName(currentMonth)} {currentYear}</span>
            </h2>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-2">
            <button
              id="year-prev-btn"
              onClick={handlePrevYear}
              className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg cursor-pointer transition-colors"
              title="سال قبل"
            >
              {currentYear - 1} »
            </button>
            <button
              id="month-prev-btn"
              onClick={handlePrevMonth}
              className="py-[4px] px-[6px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg cursor-pointer transition-colors"
              title="ماه قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <button
              id="today-nav-btn"
              onClick={() => {
                const todayPartsNow = parseJalaliString(todayDate);
                setCurrentYear(todayPartsNow.jy);
                setCurrentMonth(todayPartsNow.jm);
                setSelectedDate(todayDate);
              }}
              className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-150 text-xs font-bold rounded-lg hover:bg-blue-105 cursor-pointer transition-colors"
            >
              امروز
            </button>

            <button
              id="month-next-btn"
              onClick={handleNextMonth}
              className="py-[4px] px-[6px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg cursor-pointer transition-colors"
              title="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="year-next-btn"
              onClick={handleNextYear}
              className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg cursor-pointer transition-colors"
              title="سال بعد"
            >
              « {currentYear + 1}
            </button>
          </div>
        </div>

        {/* Days of week titles (Sat to Fri) */}
        <div className="grid grid-cols-7 gap-2 mb-[5px] mt-0 mr-0 ml-0 text-center text-xs font-black text-slate-500 pb-[5px] pt-[6px] px-0 border-b border-slate-200">
          {[0, 1, 2, 3, 4, 5, 6].map((w) => (
            <div key={w} className={w === 6 ? 'text-rose-600 font-black' : ''}>
              {getWeekdayShortName(w)}
            </div>
          ))}
        </div>

        {/* Grid Day Cells - Fully Responsive, Auto-Fitting the container without scroll */}
        <div className="grid grid-cols-7 gap-2">
          {calendarSlots.map((slot, index) => {
            if (!slot) {
              return <div key={`emptySlot-${index}`} className="opacity-25 bg-slate-100/40 rounded-xl border border-dashed border-slate-200/30 w-full py-2" />;
            }

            const { day, dateStr } = slot;
            const isToday = todayDate === dateStr;
            const isSel = selectedDate === dateStr;
            const isDayHoliday = isHoliday(dateStr, calendarOverrides);

            // count active sessions on this date
            const attendeeCount = terms.filter((term) => term.sessions.includes(dateStr)).length;

            return (
              <button
                key={`dayCell-${day}`}
                id={`cal-day-cell-${dateStr}`}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setIsDialogOpen(true);
                }}
                className={`flex items-center justify-center p-2 rounded-xl border text-right transition-all group select-none cursor-pointer w-full ${
                  isSel 
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-550/15 shadow-xs scale-[1.01]' 
                    : isToday 
                    ? 'bg-amber-50/70 hover:bg-amber-100/30 border-amber-300 shadow-xs' 
                    : 'bg-white hover:bg-slate-100/50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full flex-row-reverse gap-1">
                  {/* Right side: Day number + Today dot if any */}
                  <div className="flex items-center gap-1 flex-row-reverse">
                    <span className={`text-[17px] font-black font-mono leading-none ${
                      isSel ? 'text-blue-700' : isToday ? 'text-amber-700' : 'text-slate-800'
                    }`}>
                      {day}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="امروز" />
                    )}
                  </div>

                  {/* Left side: Holiday sign */}
                  <span className={`p-1.5 rounded font-extrabold leading-none shrink-0 border ${
                    isDayHoliday 
                      ? 'bg-rose-50 border-rose-150' 
                      : 'bg-emerald-50 border-emerald-150'
                  }`} title={isDayHoliday ? 'تعطیل رسمی یا عمومی' : 'روز کاری فعال'}>
                    {isDayHoliday ? (
                      <Coffee className="w-3.5 h-3.5 text-rose-600" />
                    ) : (
                      <Briefcase className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>



      </div>



    </div>
  );
}
