import React, { useState } from 'react';
import { Member, Shift, Term, SessionNotes, SessionAttendance } from '../types';
import { getRemainingDays } from '../utils/jalali';
import { ArrowUpDown, Search, CalendarClock, Check, X, Armchair, ShieldCheck } from 'lucide-react';

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
  filterOverride?: {
    shiftId: string;
    deskType: 'all' | 'regular' | 'premium';
    status: 'all' | 'current' | 'finished' | 'reserved' | 'no_active_shift' | 'no_term';
  } | null;
  onClearFilterOverride?: () => void;
}

type SortField = 'fullName' | 'remainingDaysCount' | 'remainingSessionsCount' | 'deskType' | 'shiftName';
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
  filterOverride,
  onClearFilterOverride,
}: ReportsTabProps) {
  // Filters State
  const [nameFilter, setNameFilter] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [deskTypeFilter, setDeskTypeFilter] = useState<'all' | 'regular' | 'premium'>('all');
  const [remainingSessionsFilter, setRemainingSessionsFilter] = useState<'all' | 'has_remaining' | 'no_remaining'>('all');
  const [attendanceTodayFilter, setAttendanceTodayFilter] = useState<'all' | 'present' | 'absent' | 'not_marked' | 'no_session_today'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'no_active_shift' | 'finished' | 'reserved' | 'no_term'>('all');

  // React to external filter overrides
  React.useEffect(() => {
    if (filterOverride) {
      if (filterOverride.shiftId !== undefined) {
        setSelectedShiftId(filterOverride.shiftId);
      }
      if (filterOverride.deskType !== undefined) {
        setDeskTypeFilter(filterOverride.deskType);
      }
      if (filterOverride.status !== undefined) {
        setStatusFilter(filterOverride.status);
      }
      // Reset other filters to ensure the filtered records show correctly
      setNameFilter('');
      setRemainingSessionsFilter('all');
      setAttendanceTodayFilter('all');
      
      // Notify parent to clear the override state so user can freely change filters afterward
      onClearFilterOverride?.();
    }
  }, [filterOverride, onClearFilterOverride]);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('remainingDaysCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Compute enriched reporting list - ONE row per user (displaying their LATEST term)
  const enrichedReports = members.map((member) => {
    const memberTerms = terms.filter((t) => t.memberId === member.id);

    // Sort terms to get the latest term by startDate desc, then endDate desc, then id desc
    const sortedTerms = [...memberTerms].sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return b.startDate.localeCompare(a.startDate);
      }
      if (a.endDate !== b.endDate) {
        return b.endDate.localeCompare(a.endDate);
      }
      return b.id.localeCompare(a.id);
    });

    const latestTerm = sortedTerms[0];

    if (!latestTerm) {
      return {
        termId: `no_term_${member.id}`,
        memberId: member.id,
        fullName: member.fullName,
        phone: member.phone,
        deskType: 'regular' as const,
        shiftName: 'بدون سانس',
        shiftId: 'none',
        startDate: '—',
        endDate: '—',
        sessionsCount: 0,
        remainingSessionsCount: 0,
        remainingDaysCount: 0,
        sessions: [],
        status: 'no_term' as const,
        hasActiveShift: false,
        hasTerm: false,
      };
    }

    const shift = shifts.find((s) => s.id === latestTerm.shiftId);

    // Determine status relative to todayDate
    let statusLabel: 'current' | 'finished' | 'reserved' = 'current';
    if (todayDate > latestTerm.endDate) {
      statusLabel = 'finished';
    } else if (todayDate < latestTerm.startDate) {
      statusLabel = 'reserved';
    }

    const remainingSessions = latestTerm.sessions.filter((s) => s >= todayDate).length;
    const remainingDays = getRemainingDays(latestTerm.endDate, todayDate);
    const hasActiveShift = statusLabel === 'current';

    return {
      termId: latestTerm.id,
      memberId: member.id,
      fullName: member.fullName,
      phone: member.phone,
      deskType: latestTerm.deskType || 'regular',
      shiftName: shift ? shift.name : 'سانس حذف شده',
      shiftId: latestTerm.shiftId,
      startDate: latestTerm.startDate,
      endDate: latestTerm.endDate,
      sessionsCount: latestTerm.sessionsCount,
      remainingSessionsCount: remainingSessions,
      remainingDaysCount: remainingDays,
      sessions: latestTerm.sessions,
      status: statusLabel,
      hasActiveShift,
      hasTerm: true,
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
    let shiftMatch = true;
    if (selectedShiftId === 'no_active') {
      shiftMatch = !rep.hasActiveShift;
    } else if (selectedShiftId !== 'all') {
      shiftMatch = rep.shiftId === selectedShiftId;
    }

    // 3. Filter by deskType (column 3)
    const deskTypeMatch = deskTypeFilter === 'all' || rep.deskType === deskTypeFilter;

    // 4. Filter by remaining sessions (column 4)
    let remainingMatch = true;
    if (remainingSessionsFilter === 'has_remaining') {
      remainingMatch = rep.remainingSessionsCount > 0 || rep.remainingDaysCount > 0;
    } else if (remainingSessionsFilter === 'no_remaining') {
      remainingMatch = rep.remainingSessionsCount <= 0 || rep.remainingDaysCount <= 0;
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
    let statusMatch = true;
    if (statusFilter === 'no_active_shift') {
      statusMatch = !rep.hasActiveShift;
    } else if (statusFilter !== 'all') {
      statusMatch = rep.status === statusFilter;
    }

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
    } else if (sortField === 'remainingDaysCount') {
      comparison = a.remainingDaysCount - b.remainingDaysCount;
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
          {(nameFilter || selectedShiftId !== 'all' || deskTypeFilter !== 'all' || remainingSessionsFilter !== 'all' || attendanceTodayFilter !== 'all' || statusFilter !== 'all') && (
            <button
              id="clear-report-filters-btn"
              onClick={() => {
                setNameFilter('');
                setSelectedShiftId('all');
                setDeskTypeFilter('all');
                setRemainingSessionsFilter('all');
                setAttendanceTodayFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
                <button onClick={() => toggleSort('shiftName')} className="flex items-center gap-1.5 hover:text-slate-800 cursor-pointer text-right w-full" title="سانس کاری آخرین دوره مشتری">
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

              {/* Column 5: Remaining Days sort */}
              <th className="py-4 px-4 font-semibold text-center text-slate-600 w-[12%]">
                <button onClick={() => toggleSort('remainingDaysCount')} className="flex items-center justify-center gap-1.5 hover:text-slate-800 cursor-pointer text-center w-full" title="روزهای باقی‌مانده تا پایان قرارداد (منفی یعنی گذشته)">
                  <span>روزهای باقی‌مانده</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60 text-slate-400" />
                </button>
              </th>

              {/* Column 6: Today's Attendance */}
              <th className="py-4 px-4 font-semibold text-center text-slate-600 w-[21%]" title={`وضعیت حضور و غیاب امروز مورخ ${todayDate}`}>حضور امروز</th>

              {/* Column 7: Status */}
              <th className="py-4 px-4 font-semibold text-center text-slate-600 w-[15%]" title="وضعیت زمانی آخرین ترم مراجع">وضعیت</th>

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
                    <option value="all">همه سانس‌ها</option>
                    <option value="no_active">🚫 فاقد سانس فعال</option>
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

                {/* 5. Remaining Sessions / Days Filter */}
                <td className="p-2 w-[12%] text-center">
                  <select
                    id="search-report-remaining"
                    value={remainingSessionsFilter}
                    onChange={(e) => setRemainingSessionsFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer text-center transition-colors font-sans"
                  >
                    <option value="all">همه</option>
                    <option value="has_remaining">دارد (+)</option>
                    <option value="no_remaining">منقضی / پایان‌یافته</option>
                  </select>
                </td>

                {/* 6. Today's Attendance Filter */}
                <td className="p-2 w-[21%] text-center">
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
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="current">فعال</option>
                    <option value="no_active_shift">🚫 فاقد سانس فعال</option>
                    <option value="finished">پایان‌یافته</option>
                    <option value="reserved">رزرو</option>
                    <option value="no_term">بدون ترم</option>
                  </select>
                </td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedReports.length === 0 ? (
                <tr>
                   <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                     هیچ رکوردی منطبق با فیلترهای تعیین شده پیدا نشد.
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
                    <td className="py-3.5 px-3 text-slate-400 text-center font-mono font-bold w-[6%]">
                      {idx + 1}
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-800 w-[17%]">
                      {onSelectMember ? (
                        <button
                          onClick={() => onSelectMember(row.memberId, row.hasTerm ? row.termId : undefined)}
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
                      <span className={`text-xs px-2.5 py-1 rounded-md border font-semibold text-right block truncate ${
                        !row.hasTerm
                          ? 'bg-amber-50/60 text-amber-700 border-amber-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
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

                    {/* Remaining Days */}
                    <td className="py-3.5 px-4 text-center w-[12%] font-mono">
                      {!row.hasTerm ? (
                        <span className="text-slate-400 text-xs font-semibold select-none">—</span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full font-bold text-xs inline-flex items-center gap-1 ${
                          row.remainingDaysCount < 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : row.remainingDaysCount === 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : row.status === 'reserved'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                        }`} title={`جلسات باقی‌مانده: ${row.remainingSessionsCount} از ${row.sessionsCount}`}>
                          {row.remainingDaysCount > 0 ? `+${row.remainingDaysCount} روز` : `${row.remainingDaysCount} روز`}
                        </span>
                      )}
                    </td>

                    {/* Today's Attendance Column */}
                    <td className="py-3.5 px-4 text-center w-[21%]">
                      {row.hasTerm && row.sessions.includes(todayDate) ? (
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
                                      ? 'bg-emerald-600 border border-emerald-600 text-white shadow-xs font-sans'
                                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-250 font-sans'
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
                                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-250 font-sans'
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
                      <span className={`p-1.5 px-2.5 rounded-lg border inline-flex items-center justify-center gap-1 text-xs font-bold ${
                        row.status === 'finished'
                          ? 'bg-slate-100 border-slate-200 text-slate-500'
                          : row.status === 'reserved'
                          ? 'bg-blue-50 border-blue-150 text-blue-700'
                          : row.status === 'no_term'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-emerald-50 border-emerald-150 text-emerald-700'
                      }`} title={
                        row.status === 'finished' 
                          ? 'اشتراک پایان یافته' 
                          : row.status === 'reserved' 
                          ? 'اشتراک رزرو شده آینده' 
                          : row.status === 'no_term'
                          ? 'فاقد ترم و سانس'
                          : 'اشتراک جاری (فعال)'
                      }>
                        {row.status === 'finished' && <><X className="w-3.5 h-3.5" /><span>پایان‌یافته</span></>}
                        {row.status === 'reserved' && <><CalendarClock className="w-3.5 h-3.5" /><span>رزرو</span></>}
                        {row.status === 'current' && <><Check className="w-3.5 h-3.5" /><span>فعال</span></>}
                        {row.status === 'no_term' && <span>بدون ترم</span>}
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
