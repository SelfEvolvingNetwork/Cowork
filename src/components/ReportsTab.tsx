import React, { useState } from 'react';
import { Member, Shift, Term, SessionNotes, SessionAttendance } from '../types';
import { ArrowUpDown, Filter, Search, CalendarClock, Check, X, Armchair, ShieldCheck, Gauge } from 'lucide-react';

interface ReportsTabProps {
  terms: Term[];
  members: Member[];
  shifts: Shift[];
  todayDate: string;
  sessionNotes: SessionNotes;
  saveSessionNote: (termId: string, dateStr: string, note: string) => void;
  sessionAttendance: SessionAttendance;
  saveSessionAttendance: (termId: string, dateStr: string, status: 'present' | 'absent' | '') => void;
  onSelectMember?: (memberId: string, termId?: string) => void;
}

type SortField = 'fullName' | 'remainingSessionsCount' | 'deskType' | 'shiftName';
type SortOrder = 'asc' | 'desc';

export function ReportsTab({
  terms,
  members,
  shifts,
  todayDate,
  sessionNotes,
  saveSessionNote,
  sessionAttendance,
  saveSessionAttendance,
  onSelectMember,
}: ReportsTabProps) {
  // Filters State
  const [nameFilter, setNameFilter] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [deskTypeFilter, setDeskTypeFilter] = useState<'all' | 'regular' | 'premium'>('all');
  const [remainingSessionsFilter, setRemainingSessionsFilter] = useState<'all' | 'has_remaining' | 'no_remaining'>('all');
  const [attendanceTodayFilter, setAttendanceTodayFilter] = useState<'all' | 'present' | 'absent' | 'not_marked' | 'no_session_today'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'finished' | 'reserved'>('current');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('remainingSessionsCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Compute enriched reporting list
  const enrichedReports = terms.map((term) => {
    const member = members.find((m) => m.id === term.memberId);
    const shift = shifts.find((s) => s.id === term.shiftId);

    // Determine status relative to todayDate
    let statusLabel: 'current' | 'finished' | 'reserved' = 'current';
    if (todayDate > term.endDate) {
      statusLabel = 'finished';
    } else if (todayDate < term.startDate) {
      statusLabel = 'reserved';
    }

    const remainingCount = term.sessions.filter((s) => s >= todayDate).length;

    return {
      termId: term.id,
      memberId: term.memberId,
      fullName: member ? member.fullName : 'کاربر حذف شده',
      phone: member ? member.phone : 'نامشخص',
      deskType: term.deskType || 'regular',
      shiftName: shift ? shift.name : 'سانس حذف شده',
      shiftId: term.shiftId,
      startDate: term.startDate,
      endDate: term.endDate,
      sessionsCount: term.sessionsCount,
      remainingSessionsCount: remainingCount,
      sessions: term.sessions,
      status: statusLabel,
    };
  });

  // Handle Sort Toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Run Filters
  const filteredReports = enrichedReports.filter((rep) => {
    // 1. Filter by Name (column 1)
    const nameMatch = !nameFilter.trim() || rep.fullName.toLowerCase().includes(nameFilter.toLowerCase());
    
    // 2. Filter by shift (column 2)
    const shiftMatch = selectedShiftId === 'all' || rep.shiftId === selectedShiftId;

    // 3. Filter by deskType (column 3)
    const deskTypeMatch = deskTypeFilter === 'all' || rep.deskType === deskTypeFilter;

    // 4. Filter by remaining sessions (column 4)
    let remainingMatch = true;
    if (remainingSessionsFilter === 'has_remaining') {
      remainingMatch = rep.remainingSessionsCount > 0;
    } else if (remainingSessionsFilter === 'no_remaining') {
      remainingMatch = rep.remainingSessionsCount === 0;
    }

    // 5. Filter by today's attendance (column 5)
    let attendanceMatch = true;
    const hasTodaySession = rep.sessions.includes(todayDate);
    const noteKey = `${rep.termId}_${todayDate}`;
    const todayAtt = sessionAttendance[noteKey] || '';
    
    if (attendanceTodayFilter === 'present') {
      attendanceMatch = hasTodaySession && todayAtt === 'present';
    } else if (attendanceTodayFilter === 'absent') {
      attendanceMatch = hasTodaySession && todayAtt === 'absent';
    } else if (attendanceTodayFilter === 'not_marked') {
      attendanceMatch = hasTodaySession && todayAtt === '';
    } else if (attendanceTodayFilter === 'no_session_today') {
      attendanceMatch = !hasTodaySession;
    }

    // 6. Filter by Status (column 6)
    const statusMatch = statusFilter === 'all' || rep.status === statusFilter;

    return nameMatch && shiftMatch && deskTypeMatch && remainingMatch && attendanceMatch && statusMatch;
  });

  // Run Sort
  const sortedReports = [...filteredReports].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'fullName') {
      comparison = a.fullName.localeCompare(b.fullName, 'fa');
    } else if (sortField === 'shiftName') {
      comparison = a.shiftName.localeCompare(b.shiftName, 'fa');
    } else if (sortField === 'deskType') {
      comparison = a.deskType.localeCompare(b.deskType);
    } else if (sortField === 'remainingSessionsCount') {
      comparison = a.remainingSessionsCount - b.remainingSessionsCount;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div id="reports-tab" className="w-full h-full flex-1 min-h-0 flex flex-col gap-3 animate-fade-in text-right overflow-hidden">
      
      {/* Tab Header */}
      <div className="flex justify-between items-center bg-white p-[10px] rounded-2xl border border-slate-200 shadow-xs flex-wrap gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <span>گزارش‌های ما</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(nameFilter || selectedShiftId !== 'all' || deskTypeFilter !== 'all' || remainingSessionsFilter !== 'all' || attendanceTodayFilter !== 'all' || statusFilter !== 'current') && (
            <button
              id="clear-report-filters-btn"
              onClick={() => {
                setNameFilter('');
                setSelectedShiftId('all');
                setDeskTypeFilter('all');
                setRemainingSessionsFilter('all');
                setAttendanceTodayFilter('all');
                setStatusFilter('current');
              }}
              className="text-xs text-rose-655 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>پاکسازی کامل فیلترها</span>
              <span>✕</span>
            </button>
          )}

        </div>
      </div>
      {/* Reports Grid Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-[10px] shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto w-full text-right border border-slate-100 rounded-xl">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-xs">
              <tr className="border-b border-slate-200 text-slate-500 text-xs font-bold bg-slate-50">
              
              {/* Column 0: Row index */}
              <th className="py-4 px-3 font-semibold text-center text-slate-600 w-[6%]" title="ردیف">ردیف</th>

              {/* Column 1: Person sort */}
              <th className="py-4 px-4 font-semibold text-slate-600 w-[17%]">
                <button onClick={() => toggleSort('fullName')} className="flex items-center gap-1.5 hover:text-slate-800 cursor-pointer text-right w-full" title="نام و کاربری مشتری مراجع">
                  <span>نام</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60 text-slate-400" />
                </button>
              </th>

              {/* Column 2: Shift sort */}
              <th className="py-4 px-4 font-semibold text-slate-600 w-[18%]">
                <button onClick={() => toggleSort('shiftName')} className="flex items-center gap-1.5 hover:text-slate-800 cursor-pointer text-right w-full" title="سانس کاری رزرو شده مشتری">
                  <span>سانس</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60 text-slate-400" />
                </button>
              </th>

              {/* Column 4: Desk type sort */}
              <th className="py-4 px-[14px] font-semibold text-slate-600 w-[11%]">
                <button onClick={() => toggleSort('deskType')} className="flex items-center gap-1.5 hover:text-slate-800 cursor-pointer text-right w-full" title="نوع صندلی اختصاصی (عادی یا VIP)">
                  <span>صندلی</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60 text-slate-400" />
                </button>
              </th>

              {/* Column 5: Remaining Sessions sort */}
              <th className="py-4 px-4 font-semibold text-center text-slate-600 w-[11%]">
                <button onClick={() => toggleSort('remainingSessionsCount')} className="flex items-center justify-center gap-1.5 hover:text-slate-800 cursor-pointer text-center w-full" title="تعداد جلسات باقی‌مانده و متباقی دوره">
                  <span>باقی‌مانده</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60 text-slate-400" />
                </button>
              </th>

              {/* Column 6: Today's Attendance */}
              <th className="py-4 px-4 font-semibold text-center text-slate-600 w-[22%]" title={`وضعیت حضور و غیاب امروز مورخ ${todayDate}`}>حضور امروز</th>

              {/* Column 7: Status */}
              <th className="py-4 px-4 font-semibold text-center text-slate-600 w-[15%]" title="وضعیت زمانی اشتراک دوره">وضعیت</th>

            </tr>

            {/* Inline Table Filters Row */}
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* Row index filter empty cell */}
              <td className="p-2 w-[6%] text-center font-bold text-slate-400 text-xs">#</td>
              {/* 1. Name Filter */}
              <td className="p-2 w-[17%]">
                  <div className="relative">
                    <input
                      id="search-report-name"
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder="نام..."
                      className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none transition-colors text-right"
                      dir="rtl"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </td>

                {/* 3. Shift Filter */}
                <td className="p-2 w-[18%]">
                  <select
                    id="search-report-shift"
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer text-right transition-colors"
                    dir="rtl"
                  >
                    <option value="all">همه</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>

                {/* 4. Desk Type Filter */}
                <td className="p-2 w-[11%]">
                  <select
                    id="search-report-desk-type"
                    value={deskTypeFilter}
                    onChange={(e) => setDeskTypeFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer text-right transition-colors"
                    dir="rtl"
                  >
                    <option value="all">همه</option>
                    <option value="regular">عادی</option>
                    <option value="premium">ویژه</option>
                  </select>
                </td>

                {/* 5. Remaining Sessions Filter */}
                <td className="p-2 w-[11%] text-center">
                  <select
                    id="search-report-remaining"
                    value={remainingSessionsFilter}
                    onChange={(e) => setRemainingSessionsFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer text-center transition-colors font-sans"
                  >
                    <option value="all">همه</option>
                    <option value="has_remaining">دارد</option>
                    <option value="no_remaining">ندارد</option>
                  </select>
                </td>

                {/* 6. Today's Attendance Filter */}
                <td className="p-2 w-[22%] text-center">
                  <select
                    id="search-report-attendance-today"
                    value={attendanceTodayFilter}
                    onChange={(e) => setAttendanceTodayFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer text-center transition-colors"
                  >
                    <option value="all">همه</option>
                    <option value="present">حاضر</option>
                    <option value="absent">غایب</option>
                    <option value="not_marked">نامشخص</option>
                    <option value="no_session_today">فاقد جلسه</option>
                  </select>
                </td>

                {/* 7. Status Filter */}
                <td className="p-2 w-[15%]">
                  <select
                    id="search-report-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer text-right transition-colors"
                    dir="rtl"
                  >
                    <option value="all">همه</option>
                    <option value="current">فعال</option>
                    <option value="finished">پایان‌یافته</option>
                    <option value="reserved">رزرو</option>
                  </select>
                </td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedReports.length === 0 ? (
                <tr>
                   <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                     هیچ رکوردی منطبق با فیلترهای جستجویافته پیدا نشد.
                   </td>
                </tr>
              ) : (
                sortedReports.map((row, idx) => (
                  <tr 
                    key={row.termId} 
                    id={`report-row-${row.termId}`}
                    className="hover:bg-slate-50/40 transition-colors text-slate-700"
                  >
                    
                    {/* Row Index cell */}
                    <td className="py-3.5 px-3 text-slate-405 text-center font-mono font-bold w-[6%]">
                      {idx + 1}
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-800 w-[17%]">
                      {onSelectMember ? (
                        <button
                          onClick={() => onSelectMember(row.memberId, row.termId)}
                          className="hover:text-blue-600 hover:underline cursor-pointer transition-colors text-right font-bold focus:outline-none"
                        >
                          {row.fullName}
                        </button>
                      ) : (
                        row.fullName
                      )}
                    </td>

                    {/* Shift */}
                    <td className="py-3.5 px-4 w-[18%]">
                      <span className="bg-slate-50 text-slate-700 text-xs px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-right block truncate">
                        {row.shiftName}
                      </span>
                    </td>

                    {/* Desk */}
                    <td className="py-3.5 px-[14px] w-[11%] text-center animate-fade-in">
                      {row.deskType === 'premium' ? (
                        <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-200/50 p-1.5 rounded-lg" title="صندلی ویژه (VIP)">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center bg-slate-50 text-slate-600 border border-slate-200 p-1.5 rounded-lg" title="صندلی عادی عمومی">
                          <Armchair className="w-4 h-4 text-slate-500" />
                        </span>
                      )}
                    </td>

                    {/* Remaining sessions */}
                    <td className="py-3.5 px-4 text-center w-[11%] font-mono">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-xs inline-flex items-center gap-1 ${
                        row.remainingSessionsCount === 0
                           ? 'bg-rose-50 text-rose-705 border border-rose-100'
                           : row.status === 'reserved'
                           ? 'bg-blue-50 text-blue-700 border border-blue-100'
                           : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      }`}>
                        {row.remainingSessionsCount}
                      </span>
                    </td>

                    {/* Today's Attendance Column */}
                    <td className="py-3.5 px-4 text-center w-[22%]">
                      {row.sessions.includes(todayDate) ? (
                        (() => {
                           const noteKey = `${row.termId}_${todayDate}`;
                           const currentNote = sessionNotes[noteKey] || '';
                           const currentAtt = sessionAttendance[noteKey] || '';
                           const isPresent = currentAtt === 'present';
                           const isAbsent = currentAtt === 'absent';
                           const hasCustomNote = currentNote.trim().length > 0;

                          return (
                            <div className="flex flex-col items-center gap-1.5 justify-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                {/* Button Present */}
                                <button
                                  id={`quick-present-btn-${row.termId}`}
                                  onClick={() => {
                                    const nextAtt = isPresent ? '' : 'present';
                                    saveSessionAttendance(row.termId, todayDate, nextAtt);
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                                    isPresent
                                      ? 'bg-emerald-600 border border-emerald-605 text-white shadow-xs font-sans'
                                      : 'bg-slate-50 border border-slate-205 text-slate-505 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-250 font-sans'
                                  }`}
                                  title="علامت‌گذاری به عنوان حاضر"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>حاضر</span>
                                </button>

                                {/* Button Absent */}
                                <button
                                  id={`quick-absent-btn-${row.termId}`}
                                  onClick={() => {
                                    const nextAtt = isAbsent ? '' : 'absent';
                                    saveSessionAttendance(row.termId, todayDate, nextAtt);
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                                    isAbsent
                                      ? 'bg-rose-600 border border-rose-600 text-white shadow-xs font-sans'
                                      : 'bg-slate-50 border border-slate-205 text-slate-505 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-250 font-sans'
                                  }`}
                                  title="علامت‌گذاری به عنوان غایب"
                                >
                                  <X className="w-3 h-3" />
                                  <span>غایب</span>
                                </button>
                              </div>

                              {/* Custom Note Tooltip or Text if exists */}
                              {hasCustomNote && (
                                <div className="text-[10px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 max-w-[140px] truncate" title={currentNote}>
                                  📝 {currentNote}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold select-none">—</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4 text-center w-[15%] animate-fade-in">
                      <span className={`p-1.5 rounded-lg border inline-flex items-center justify-center ${
                        row.status === 'finished'
                          ? 'bg-slate-100 border-slate-200 text-slate-500'
                          : row.status === 'reserved'
                          ? 'bg-blue-50 border-blue-150 text-blue-700'
                          : 'bg-emerald-50 border-emerald-150 text-emerald-700'
                      }`} title={
                        row.status === 'finished' 
                          ? 'اشتراک پایان یافته' 
                          : row.status === 'reserved' 
                          ? 'اشتراک رزرو شده آینده' 
                          : 'اشتراک جاری (فعال)'
                      }>
                        {row.status === 'finished' && <X className="w-4 h-4" />}
                        {row.status === 'reserved' && <CalendarClock className="w-4 h-4" />}
                        {row.status === 'current' && <Check className="w-4 h-4" />}
                      </span>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
