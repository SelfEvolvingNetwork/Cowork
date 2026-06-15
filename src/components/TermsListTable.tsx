import React, { useState, useEffect } from 'react';
import { Term, Shift, CalendarOverrides } from '../types';
import { calculateTermSessions, normalizePersianDigits, isValidJalaliDate } from '../utils/jalali';
import { 
  CalendarClock, 
  Plus, 
  AlertTriangle, 
  Check, 
  X, 
  Trash2, 
  Edit2, 
  Calendar,
  Armchair,
  ShieldCheck
} from 'lucide-react';

interface TermsListTableProps {
  memberId: string;
  terms: Term[];
  shifts: Shift[];
  todayDate: string;
  calendarOverrides: CalendarOverrides;
  addTerm: (memberId: string, shiftId: string, startDate: string, sessionsCount?: number, deskType?: 'regular' | 'premium') => string | null;
  updateTerm: (id: string, updated: Partial<Omit<Term, 'id' | 'endDate' | 'sessions'>>) => boolean | void;
  deleteTerm: (id: string) => boolean;
  selectedTermId: string | null;
  setSelectedTermId: (id: string | null) => void;
  onOpenCalendar: () => void;
  isAddingTerm: boolean;
  setIsAddingTerm: (val: boolean) => void;
}

export function TermsListTable({
  memberId,
  terms,
  shifts,
  todayDate,
  calendarOverrides,
  addTerm,
  updateTerm,
  deleteTerm,
  selectedTermId,
  setSelectedTermId,
  onOpenCalendar,
  isAddingTerm,
  setIsAddingTerm,
}: TermsListTableProps) {
  // Add Term State
  const [newTermShiftId, setNewTermShiftId] = useState('');
  const [newTermStartDate, setNewTermStartDate] = useState('');
  const [newTermSessionsCount, setNewTermSessionsCount] = useState(12);
  const [newTermDeskType, setNewTermDeskType] = useState<'regular' | 'premium'>('regular');
  const [newTermEndDatePreview, setNewTermEndDatePreview] = useState('');
  const [newTermError, setNewTermError] = useState('');

  // Edit Term State
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [editTermShiftId, setEditTermShiftId] = useState('');
  const [editTermStartDate, setEditTermStartDate] = useState('');
  const [editTermSessionsCount, setEditTermSessionsCount] = useState(12);
  const [editTermDeskType, setEditTermDeskType] = useState<'regular' | 'premium'>('regular');
  const [editTermEndDatePreview, setEditTermEndDatePreview] = useState('');
  const [editTermError, setEditTermError] = useState('');

  // Initialize adding term values when isAddingTerm transitions to true
  useEffect(() => {
    if (isAddingTerm) {
      if (!newTermShiftId) setNewTermShiftId(shifts[0]?.id || '');
      if (!newTermStartDate) setNewTermStartDate(todayDate);
      if (newTermSessionsCount === 0 || !newTermSessionsCount) setNewTermSessionsCount(12);
      if (!newTermDeskType) setNewTermDeskType('regular');
      setNewTermError('');
    }
  }, [isAddingTerm, shifts, todayDate]);

  // Reset local states on member changes
  useEffect(() => {
    setIsAddingTerm(false);
    setIsEditingTerm(false);
    setNewTermError('');
    setEditTermError('');
  }, [memberId]);

  // Real-time end date preview for adding a term
  useEffect(() => {
    if (isAddingTerm && newTermShiftId && newTermStartDate) {
      const shiftObj = shifts.find((s) => s.id === newTermShiftId);
      if (shiftObj) {
        const regex = /^\d{4}\/\d{2}\/\d{2}$/;
        if (regex.test(newTermStartDate)) {
          const calc = calculateTermSessions(newTermStartDate, newTermSessionsCount, shiftObj.weekDays, calendarOverrides);
          setNewTermEndDatePreview(calc.endDate);
          setNewTermError('');
        } else {
          setNewTermEndDatePreview('تاریخ شروع نامعتبر');
        }
      }
    } else {
      setNewTermEndDatePreview('');
    }
  }, [isAddingTerm, newTermShiftId, newTermStartDate, newTermSessionsCount, shifts, calendarOverrides]);

  // Real-time end date preview for editing a term
  useEffect(() => {
    if (isEditingTerm && editTermShiftId && editTermStartDate) {
      const shiftObj = shifts.find((s) => s.id === editTermShiftId);
      if (shiftObj) {
        const regex = /^\d{4}\/\d{2}\/\d{2}$/;
        if (regex.test(editTermStartDate)) {
          const calc = calculateTermSessions(editTermStartDate, editTermSessionsCount, shiftObj.weekDays, calendarOverrides);
          setEditTermEndDatePreview(calc.endDate);
          setEditTermError('');
        } else {
          setEditTermEndDatePreview('تاریخ شروع نامعتبر');
        }
      }
    } else {
      setEditTermEndDatePreview('');
    }
  }, [isEditingTerm, editTermShiftId, editTermStartDate, editTermSessionsCount, shifts, calendarOverrides]);

  const handleSaveNewTerm = () => {
    const normalizedInput = normalizePersianDigits(newTermStartDate);
    if (!isValidJalaliDate(normalizedInput)) {
      setNewTermError('فرمت یا مقادیر تاریخ شروع معتبر نیست. مثال: ۱۴۰۵/۰۳/۰۱');
      return;
    }
    if (!newTermShiftId) {
      setNewTermError('انتخاب سانس الزامی است.');
      return;
    }
    const termId = addTerm(memberId, newTermShiftId, normalizedInput, newTermSessionsCount, newTermDeskType);
    if (termId) {
      setSelectedTermId(termId);
      setIsAddingTerm(false);
      setNewTermError('');
    }
  };

  const handleSaveEditTerm = () => {
    if (!selectedTermId) return;
    const normalizedInput = normalizePersianDigits(editTermStartDate);
    if (!isValidJalaliDate(normalizedInput)) {
      setEditTermError('فرمت یا مقادیر تاریخ شروع معتبر نیست. مثال: ۱۴۰۵/۰۳/۰۱');
      return;
    }
    if (!editTermShiftId) {
      setEditTermError('انتخاب سانس الزامی است.');
      return;
    }
    const success = updateTerm(selectedTermId, {
      shiftId: editTermShiftId,
      startDate: normalizedInput,
      sessionsCount: editTermSessionsCount,
      deskType: editTermDeskType,
    });
    
    if (success !== false) {
      setIsEditingTerm(false);
      setEditTermError('');
    }
  };

  const handleDeleteTerm = () => {
    if (!selectedTermId) return;
    const ok = deleteTerm(selectedTermId);
    if (ok) {
      setSelectedTermId(null);
      setIsEditingTerm(false);
    }
  };

  // Filter and enrich terms for this member
  const memberTerms = terms.filter((t) => t.memberId === memberId);
  const enrichedTerms = memberTerms.map((t) => {
    const shift = shifts.find((s) => s.id === t.shiftId);
    let status: 'current' | 'finished' | 'reserved' = 'current';
    if (todayDate > t.endDate) {
      status = 'finished';
    } else if (todayDate < t.startDate) {
      status = 'reserved';
    }

    return {
      ...t,
      shiftName: shift ? shift.name : 'سانس حذف شده',
      status,
    };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4 text-right h-full flex-1 min-h-0 overflow-hidden">
      {(newTermError || editTermError) && (
        <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-lg text-[11px] text-rose-700 font-bold flex items-center gap-1.5 flex-row-reverse text-right animate-fade-in shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>{newTermError || editTermError}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto border border-slate-100 rounded-xl">
        <table className="w-full text-right border-collapse text-xs" dir="rtl">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
              <th className="p-3 font-semibold text-right w-[22%]" title="سانس کاری انتخاب شده">سانس</th>
              <th className="p-3 font-semibold text-center w-[10%]" title="نوع صندلی اختصاص یافته">صندلی</th>
              <th className="p-3 font-semibold text-right w-[14%]" title="تاریخ شروع قرارداد">شروع</th>
              <th className="p-3 font-semibold text-right w-[14%]" title="تاریخ پایان قرارداد">پایان</th>
              <th className="p-3 text-center font-semibold w-[12%]" title="تعداد جلسات مجاز دوره">جلسات</th>
              <th className="p-3 text-center font-semibold w-[10%]" title="وضعیت فعلی دوره اشتراک">وضعیت</th>
              <th className="p-3 text-left font-semibold w-[18%]">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isAddingTerm && (
              <tr className="bg-blue-50/20 border-b-2 border-blue-100 animate-slide-up">
                {/* Shift Select */}
                <td className="p-3">
                  <select
                    id="new-term-shift-select"
                    value={newTermShiftId}
                    onChange={(e) => setNewTermShiftId(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-850 text-xs rounded-xl p-2 w-full focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="" disabled>-- انتخاب سانس کاری --</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>

                {/* Desk Type Select */}
                <td className="p-3">
                  <select
                    id="new-term-desk-select"
                    value={newTermDeskType}
                    onChange={(e) => setNewTermDeskType(e.target.value as any)}
                    className="bg-white border border-slate-300 text-slate-850 text-xs rounded-xl p-2 w-full focus:outline-none focus:border-blue-500 font-semibold"
                    dir="rtl"
                  >
                    <option value="regular">میز عادی عمومی</option>
                    <option value="premium">میز ویژه اختصاصی (VIP)</option>
                  </select>
                </td>

                <td className="p-3">
                  <input
                    id="new-term-start-date"
                    type="text"
                    value={newTermStartDate}
                    onChange={(e) => setNewTermStartDate(e.target.value)}
                    placeholder="۱۴۰۵/۰۳/۰۱"
                    className="bg-white border border-slate-300 text-slate-850 p-2 text-xs rounded-xl text-center font-mono w-28 focus:outline-none focus:border-blue-500"
                    dir="ltr"
                  />
                </td>
                <td className="p-3 font-mono font-bold text-blue-750">
                  {newTermEndDatePreview ? newTermEndDatePreview : 'درحال محاسبه...'}
                </td>
                <td className="p-3 text-center">
                  <input
                    id="new-term-sessions-count"
                    type="number"
                    min="1"
                    max="36"
                    value={newTermSessionsCount}
                    onChange={(e) => setNewTermSessionsCount(Math.max(1, Number(e.target.value)))}
                    className="bg-white border border-slate-300 text-slate-805 p-2 text-xs rounded-xl text-center font-mono w-16 focus:outline-none focus:border-blue-500"
                  />
                </td>
                <td className="p-3 text-center col-span-1">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-100">در حال ثبت</span>
                </td>
                <td className="p-3 text-left animate-fade-in">
                  <div className="flex gap-1.5 justify-end">
                    <button
                      id="save-new-term-inline-btn"
                      onClick={handleSaveNewTerm}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-colors"
                      title="ذخیره قرارداد"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id="cancel-add-term"
                      onClick={() => {
                        setIsAddingTerm(false);
                        setNewTermError('');
                      }}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-550 rounded-lg cursor-pointer transition-colors"
                      title="انصراف"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {memberTerms.length === 0 && !isAddingTerm ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 italic py-8">
                  این مراجع هنوز در هیچ ترم یا سانسی قرار نگرفته است. برای فعالسازی از گزینه «ثبت قرارداد جدید» استفاده فرمایید.
                </td>
              </tr>
            ) : (
              enrichedTerms.map((t) => {
                const isSelected = selectedTermId === t.id;
                const isEditingThisRow = isEditingTerm && isSelected;

                if (isEditingThisRow) {
                  return (
                    <tr key={t.id} className="bg-amber-50/20 border-b-2 border-amber-100 animate-slide-up">
                      {/* Edit Shift */}
                      <td className="p-3">
                        <select
                          id="edit-term-shift-inline"
                          value={editTermShiftId}
                          onChange={(e) => setEditTermShiftId(e.target.value)}
                          className="bg-white border border-slate-300 text-slate-800 text-xs rounded-xl p-2 w-full focus:outline-none focus:border-amber-500 font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Edit Desk Type */}
                      <td className="p-3">
                        <select
                          id="edit-term-desk-inline"
                          value={editTermDeskType}
                          onChange={(e) => setEditTermDeskType(e.target.value as any)}
                          className="bg-white border border-slate-300 text-slate-800 text-xs rounded-xl p-2 w-full focus:outline-none focus:border-amber-500 font-semibold"
                          dir="rtl"
                        >
                          <option value="regular">میز عادی عمومی</option>
                          <option value="premium">میز ویژه اختصاصی (VIP)</option>
                        </select>
                      </td>

                      <td className="p-3">
                        <input
                          id="edit-term-startdate-inline"
                          type="text"
                          value={editTermStartDate}
                          onChange={(e) => setEditTermStartDate(e.target.value)}
                          className="bg-white border border-slate-300 text-slate-855 p-2 text-xs rounded-xl text-center font-mono w-28 focus:outline-none focus:border-amber-500"
                          dir="ltr"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-700">
                        {editTermEndDatePreview}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          id="edit-term-sessions-inline"
                          type="number"
                          min="1"
                          max="48"
                          value={editTermSessionsCount}
                          onChange={(e) => setEditTermSessionsCount(Math.max(1, Number(e.target.value)))}
                          className="bg-white border border-slate-300 text-slate-855 p-2 text-xs rounded-xl text-center font-mono w-16 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-105">ویرایش...</span>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            id="save-edit-term-submit"
                            onClick={handleSaveEditTerm}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-colors"
                            title="ثبت تغییرات"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id="delete-term-inline-btn"
                            onClick={handleDeleteTerm}
                            className="p-1.5 bg-rose-650 hover:bg-rose-500 text-white rounded-lg cursor-pointer transition-colors"
                            title="لغو کامل این قرارداد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingTerm(false);
                              setEditTermError('');
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-550 rounded-lg cursor-pointer transition-colors"
                            title="انصراف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={t.id}
                    onClick={() => {
                      setSelectedTermId(t.id);
                      setIsEditingTerm(false);
                    }}
                    className={`transition-all duration-150 cursor-pointer hover:bg-slate-50/50 ${
                      isSelected ? 'bg-blue-50/30 font-semibold border-r-4 border-r-blue-500' : ''
                    }`}
                  >
                    <td className="p-3 text-slate-850 font-bold text-right">{t.shiftName}</td>
                    
                    {/* Desk Type Badge Display */}
                    <td className="p-3 text-center">
                      {t.deskType === 'premium' ? (
                        <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-200/60 p-1.5 rounded-lg" title="صندلی ویژه (VIP)">
                          <ShieldCheck className="w-4 h-4 text-amber-650" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center bg-slate-50 text-slate-600 border border-slate-205 p-1.5 rounded-lg" title="صندلی عادی عمومی">
                          <Armchair className="w-4 h-4 text-slate-500" />
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-mono text-slate-600 text-right">{t.startDate}</td>
                    <td className="p-3 font-mono text-slate-600 text-right">{t.endDate}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{t.sessionsCount} جلسه</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center justify-center p-1.5 rounded-lg border ${
                        t.status === 'current'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : t.status === 'reserved'
                          ? 'bg-blue-50 border-blue-100 text-blue-700'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`} title={
                        t.status === 'current' 
                          ? 'اشتراک جاری فعال' 
                          : t.status === 'reserved' 
                          ? 'اشتراک رزرو شده برای آینده' 
                          : 'اشتراک پایان‌یافته و منقضی شده'
                      }>
                        {t.status === 'current' && <Check className="w-3.5 h-3.5" />}
                        {t.status === 'reserved' && <Calendar className="w-3.5 h-3.5" />}
                        {t.status === 'finished' && <X className="w-3.5 h-3.5" />}
                      </span>
                    </td>
                    <td className="p-3 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end items-center">
                        <button
                          id={`select-term-row-details-${t.id}`}
                          onClick={() => {
                            setSelectedTermId(t.id);
                            setIsEditingTerm(false);
                            onOpenCalendar();
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10.5px] font-bold border cursor-pointer transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-550 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-250 hover:bg-slate-50'
                          }`}
                          title={isSelected ? "مشاهده تقویم و یادداشت‌های این دوره جاری" : "انتخاب و مشاهده جزئیات دوره"}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'جاری' : 'انتخاب'}</span>
                        </button>
                        <button
                          id={`edit-selected-term-btn-${t.id}`}
                          onClick={() => {
                            setSelectedTermId(t.id);
                            setIsEditingTerm(true);
                            setEditTermShiftId(t.shiftId);
                            setEditTermStartDate(t.startDate);
                            setEditTermSessionsCount(t.sessionsCount);
                            setEditTermDeskType(t.deskType ?? 'regular');
                            setEditTermError('');
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all"
                          title="ویرایش مشخصات این دوره"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
