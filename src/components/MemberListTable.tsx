import React, { useState, useRef, useEffect } from 'react';
import { Member, Term } from '../types';
import { 
  UserPlus, 
  Edit2, 
  Save, 
  Undo2, 
  Trash2,
  FilterX,
  Sparkles
} from 'lucide-react';

interface MemberListTableProps {
  members: Member[];
  terms: Term[];
  todayDate: string;
  selectedMemberId: string | null;
  selectMemberId: (id: string | null) => void;
  addMember: (fullName: string, phone: string) => string | null;
  updateMember: (id: string, updated: Partial<Omit<Member, 'id'>>) => void;
  deleteMember: (id: string) => boolean;
  setSelectedTermId: (id: string | null) => void;
}

export function MemberListTable({
  members,
  terms,
  todayDate,
  selectedMemberId,
  selectMemberId,
  addMember,
  updateMember,
  deleteMember,
  setSelectedTermId,
}: MemberListTableProps) {
  // Filters State
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterTermsCount, setFilterTermsCount] = useState<'all' | 'has-terms' | 'no-terms'>('all');
  const [filterAttendance, setFilterAttendance] = useState<'all' | 'present' | 'absent'>('all');

  // Inline Editing Member State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Inline Adding New Member State
  const [showAddRow, setShowAddRow] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [continuousAdd, setContinuousAdd] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  // Refs for keyboard controls
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Auto focus name input when Row opens
  useEffect(() => {
    if (showAddRow) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    } else {
      setSuccessMessage('');
      setInlineError('');
    }
  }, [showAddRow]);

  // Global Alt+A / Alt+ش shortcut to toggle addition row
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      // ALT + a (english) or ALT + ش (persian layout 'a' mapping)
      if (e.altKey && (e.key.toLowerCase() === 'a' || e.key === 'ش')) {
        e.preventDefault();
        setShowAddRow((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  const handleInlineAddMember = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setInlineError('');
    setSuccessMessage('');

    const trimmedName = inlineName.trim();
    const trimmedPhone = inlinePhone.trim();

    if (!trimmedName) {
      setInlineError('نام الزامی است');
      nameInputRef.current?.focus();
      return;
    }
    if (!trimmedPhone) {
      setInlineError('همراه الزامی است');
      phoneInputRef.current?.focus();
      return;
    }
    if (!/^[0-9۰-۹+]+$/.test(trimmedPhone)) {
      setInlineError('ارقام نامعتبر');
      phoneInputRef.current?.focus();
      return;
    }

    const createdId = addMember(trimmedName, trimmedPhone);
    if (createdId) {
      setInlineName('');
      setInlinePhone('');
      setInlineError('');
      
      if (continuousAdd) {
        setSuccessMessage(`با موفقیت ثبت شد: ${trimmedName}`);
        // Reset message after 2.5 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 2500);
        // Put focus back to name input for the next entry
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 50);
      } else {
        setShowAddRow(false);
        // Automatically select the newly created member and switch view
        selectMemberId(createdId);
      }
    } else {
      setInlineError('خطای عضوگیری');
    }
  };

  const handleStartEdit = (m: Member) => {
    setEditingId(m.id);
    setEditName(m.fullName);
    setEditPhone(m.phone);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPhone('');
  };

  const handleSaveEdit = (mId: string) => {
    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();

    if (!trimmedName || !trimmedPhone) {
      return;
    }

    updateMember(mId, { fullName: trimmedName, phone: trimmedPhone });
    setEditingId(null);
  };

  // Filter members table
  const filteredMembers = members.filter((m) => {
    if (filterName.trim() !== '') {
      if (!m.fullName.toLowerCase().includes(filterName.toLowerCase().trim())) {
        return false;
      }
    }
    if (filterPhone.trim() !== '') {
      if (!m.phone.includes(filterPhone.trim())) {
        return false;
      }
    }
    const mTerms = terms.filter((t) => t.memberId === m.id);
    if (filterTermsCount === 'has-terms' && mTerms.length === 0) {
      return false;
    }
    if (filterTermsCount === 'no-terms' && mTerms.length > 0) {
      return false;
    }
    const hasActiveSessionsToday = terms.some(
      (t) => t.memberId === m.id && t.sessions.includes(todayDate)
    );
    if (filterAttendance === 'present' && !hasActiveSessionsToday) {
      return false;
    }
    if (filterAttendance === 'absent' && hasActiveSessionsToday) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full h-full flex-1 min-h-0 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col gap-4 overflow-hidden">
      
      {/* Header containing metadata summary */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-row-reverse shrink-0">
        <div className="flex items-center gap-2 flex-row-reverse">
          <h3 className="font-extrabold text-slate-800 text-sm">مشتریان</h3>
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg font-sans font-bold" title="کل پرونده‌های ثبت‌شده">
            {members.length} عضو
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline" title="کلیدهای میانبر: Alt + A برای بازکردن فرم">
            (میانبر فرم ثبت تند: Alt+A)
          </span>
        </div>
        
        <button
          onClick={() => setShowAddRow(!showAddRow)}
          className={`text-xs font-bold py-1.5 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
            showAddRow 
              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
              : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-xs'
          }`}
          title={showAddRow ? "لغو ثبت مشتری جدید" : "افزودن پرونده مشتری جدید"}
        >
          {showAddRow ? (
            <>
              <span>✕</span>
              <span>لغو</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>افزودن</span>
            </>
          )}
        </button>
      </div>

      {/* Editable & Filterable Table Grid */}
      <div className="flex-1 min-h-0 overflow-auto border border-slate-100 rounded-2xl bg-white shadow-2xs">
        <table className="w-full text-right border-collapse text-xs" dir="rtl">
          
          {/* Fixed Non-scroll Header & Columns Filters */}
          <thead className="sticky top-0 z-20 bg-slate-50 shadow-xs border-b border-slate-200">
            <tr className="border-b border-slate-150 text-slate-600 text-[11px] font-extrabold bg-slate-50">
              <th className="py-3 px-4 text-center select-none w-[10%] min-w-[60px]">ردیف</th>
              <th className="py-3 px-4 text-right select-none w-[45%]">نام مشتری</th>
              <th className="py-3 px-4 text-right select-none w-[25%]">تلفن همراه</th>
              <th className="py-3 px-4 text-center select-none w-[20%] min-w-[120px]">عملیات</th>
            </tr>
            
            {/* Comprehensive filters input row */}
            <tr className="bg-slate-50 border-b border-slate-150">
              <td className="p-2 text-center text-slate-400 font-bold">🔍 فیلتر</td>
              <td className="p-2">
                 <input
                  type="text"
                  placeholder="نام..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full bg-white hover:bg-slate-50 focus:bg-white border border-slate-250 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-all text-right font-medium text-slate-700"
                  dir="rtl"
                />
              </td>
              <td className="p-2">
                <input
                  type="text"
                  placeholder="تلفن..."
                  value={filterPhone}
                  onChange={(e) => setFilterPhone(e.target.value)}
                  className="w-full bg-white hover:bg-slate-50 focus:bg-white border border-slate-250 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-all text-left font-mono font-medium text-slate-700"
                  dir="ltr"
                />
              </td>
              <td className="p-2 text-center">
                <button
                  id="clear-member-list-filters-btn"
                  onClick={() => {
                    setFilterName('');
                    setFilterPhone('');
                    setFilterTermsCount('all');
                    setFilterAttendance('all');
                  }}
                  className="p-1.5 text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-all border border-slate-200 hover:border-red-200 inline-flex items-center justify-center cursor-pointer shadow-3xs"
                  title="پاکسازی فیلترهای جستجو"
                >
                  <FilterX className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            
            {/* INLINE ROW FOR INSTANT ADDING SUB-MEMBER INSIDE TABLE */}
            {showAddRow && (
              <tr className="bg-blue-50/40 hover:bg-blue-50/50 transition-colors border-b border-blue-100/60 font-sans">
                <td className="py-3 px-4 text-center font-extrabold text-blue-600 text-sm">
                  {successMessage ? '✅' : '✨'}
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="نام و نام خانوادگی مشتری جدید..."
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          phoneInputRef.current?.focus();
                        } else if (e.key === 'Escape') {
                          setShowAddRow(false);
                        }
                      }}
                      className="w-full bg-white hover:bg-white focus:bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs focus:outline-none transition-all text-right font-bold text-slate-800 placeholder-blue-300"
                      dir="rtl"
                    />
                    {inlineError && (
                      <div className="text-[10px] font-bold text-rose-600 animate-shake">
                        ⚠️ {inlineError}
                      </div>
                    )}
                    {successMessage && (
                      <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{successMessage}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={phoneInputRef}
                      type="text"
                      placeholder="شماره تلفن (مثال: 0912...)"
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleInlineAddMember();
                        } else if (e.key === 'Escape') {
                          setShowAddRow(false);
                        }
                      }}
                      className="w-full bg-white hover:bg-white focus:bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs focus:outline-none transition-all text-left font-mono font-bold text-slate-800 placeholder-blue-300"
                      dir="ltr"
                    />
                    <label className="flex items-center gap-1.5 text-[10.5px] text-slate-500 select-none cursor-pointer hover:text-slate-800 mt-1">
                      <input
                        type="checkbox"
                        checked={continuousAdd}
                        onChange={(e) => setContinuousAdd(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>فرم ثبت پشت‌سرهم باز بماند</span>
                    </label>
                  </div>
                </td>
                <td className="p-2 text-center">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <button
                      onClick={() => handleInlineAddMember()}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1 mx-auto cursor-pointer"
                      title="ثبت مستقیم پرونده مشتری جدید (دکمه Enter)"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>ثبت (Enter)</span>
                    </button>
                    <span className="text-[9px] text-slate-400">(یا کلید Esc لغو)</span>
                  </div>
                </td>
              </tr>
            )}

            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-xs text-slate-400 italic">
                  هیچ مشتری با مشخصات و فیلترهای تعیین شده یافت نشد.
                </td>
              </tr>
            ) : (
              filteredMembers.map((m, idx) => {
                const isEditing = editingId === m.id;
                const representsSelected = m.id === selectedMemberId;

                return (
                  <tr 
                    key={m.id}
                    className={`transition-colors text-right ${
                      representsSelected 
                        ? 'bg-blue-50/30' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Row Index */}
                    <td className="py-3.5 px-4 text-slate-400 text-center font-mono font-bold">
                      {idx + 1}
                    </td>

                    {/* Customer Full Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-2.5 py-1.5 w-full text-xs text-right font-bold focus:outline-none"
                          dir="rtl"
                        />
                      ) : (
                        <button
                          onClick={() => selectMemberId(m.id)}
                          className={`text-right font-extrabold text-xs hover:underline cursor-pointer transition-colors block w-full ${
                            representsSelected ? 'text-blue-600' : 'text-slate-800 hover:text-blue-600'
                          }`}
                        >
                          {m.fullName}
                        </button>
                      )}
                    </td>

                    {/* Customer Phone */}
                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-2.5 py-1.5 w-full text-xs text-left font-mono font-bold focus:outline-none"
                          dir="ltr"
                        />
                      ) : (
                        <span className="text-slate-500 text-xs font-mono font-semibold">{m.phone}</span>
                      )}
                    </td>

                    {/* Custom Integrated action buttons */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSaveEdit(m.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center border border-emerald-750"
                            title="ثبت و ذخیره تغییرات پرونده"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center border border-slate-250"
                            title="لغو ویرایش"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {/* Inline Edit triggers */}
                          <button
                            onClick={() => handleStartEdit(m)}
                            className="p-1 text-blue-600 hover:bg-blue-550 border border-slate-200 rounded-lg cursor-pointer transition-all"
                            title="ویرایش مشخصات"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Inline delete member */}
                          <button
                            onClick={() => {
                              if (confirm(`آیا از حذف اطلاعات پرونده آقای/خانم ${m.fullName} و تمامی ادوار او اطمینان دارید؟`)) {
                                const success = deleteMember(m.id);
                                if (success && m.id === selectedMemberId) {
                                  selectMemberId(null);
                                  setSelectedTermId(null);
                                }
                              }
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg cursor-pointer transition-all"
                            title="حذف مراجع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
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
