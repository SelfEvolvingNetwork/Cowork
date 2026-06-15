import React, { useState } from 'react';
import { Shift } from '../types';
import { getWeekdayShortName } from '../utils/jalali';
import { Clock, Plus, Trash2, Edit2, Check, X, AlertTriangle, Armchair, ShieldCheck } from 'lucide-react';

interface ShiftsTableProps {
  shifts: Shift[];
  addShift: (name: string, weekDays: number[], totalRegular: number, totalPremium: number) => void;
  updateShift: (id: string, updated: Partial<Omit<Shift, 'id'>>) => void;
  deleteShift: (id: string) => boolean;
}

export function ShiftsTable({ shifts, addShift, updateShift, deleteShift }: ShiftsTableProps) {
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editTotalRegular, setEditTotalRegular] = useState(20);
  const [editTotalPremium, setEditTotalPremium] = useState(5);

  // New row "draft" state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDays, setNewDays] = useState<number[]>([]);
  const [newTotalRegular, setNewTotalRegular] = useState(20);
  const [newTotalPremium, setNewTotalPremium] = useState(5);

  // Validation feedback
  const [errorText, setErrorText] = useState('');

  const toggleDayInList = (list: number[], setList: React.Dispatch<React.SetStateAction<number[]>>, dayIdx: number) => {
    if (list.includes(dayIdx)) {
      setList(list.filter((d) => d !== dayIdx));
    } else {
      setList([...list, dayIdx]);
    }
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      setErrorText('نام سانس نمی‌تواند خالی باشد.');
      return;
    }
    if (editDays.length === 0) {
      setErrorText('حداقل یک روز از هفته را برای سانس انتخاب کنید.');
      return;
    }
    if (editTotalRegular < 0 || editTotalPremium < 0) {
      setErrorText('ظرفیت صندلی‌ها نمی‌تواند عدد منفی باشد.');
      return;
    }
    updateShift(id, { 
      name: editName.trim(), 
      weekDays: editDays,
      totalRegular: editTotalRegular,
      totalPremium: editTotalPremium
    });
    setEditingId(null);
    setErrorText('');
  };

  const handleSaveNew = () => {
    if (!newName.trim()) {
      setErrorText('نام سانس خالی است.');
      return;
    }
    if (newDays.length === 0) {
      setErrorText('لطفا حداقل یک روزِ سانس را مشخص کنید.');
      return;
    }
    if (newTotalRegular < 0 || newTotalPremium < 0) {
      setErrorText('ظرفیت صندلی‌ها نمی‌تواند عدد منفی باشد.');
      return;
    }
    addShift(newName.trim(), newDays, newTotalRegular, newTotalPremium);
    setNewName('');
    setNewDays([]);
    setNewTotalRegular(20);
    setNewTotalPremium(5);
    setIsAdding(false);
    setErrorText('');
  };

  return (
    <div id="shifts-table-container" className="flex flex-col gap-6 animate-fade-in text-right">
      
      {/* Table Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>تنظیمات سانس‌بندی و گنجایش صندلی‌ها</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تعریف ظرفیت پذیرش میزهای عادی و بخش ویژه (VIP) به تفکیک برای هر یک از سانس‌های کاری
          </p>
        </div>
        {!isAdding && (
          <button
            id="add-shift-btn"
            onClick={() => {
              setIsAdding(true);
              setNewName('');
              setNewDays([]);
              setNewTotalRegular(20);
              setNewTotalPremium(5);
              setEditingId(null);
              setErrorText('');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold leading-none cursor-pointer transition-all shadow-xs"
            title="افزودن سانس کاری جدید"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن</span>
          </button>
        )}
      </div>

      {errorText && (
        <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-xl border border-rose-100 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Shifts Grid Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs overflow-hidden text-right">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs font-bold bg-slate-50/50">
                <th className="py-4 px-4 font-semibold w-[24%] text-right text-slate-600" title="نام و عنوان اختصاصی سانس کاری">نام</th>
                <th className="py-4 px-4 font-semibold w-[40%] text-right text-slate-600" title="روزهای کاری تعیین شده در طول هفته">روزها</th>
                <th className="py-4 px-4 text-center font-semibold w-[13%] text-slate-600" title="گنجایش صندلی‌های میزهای عادی عمومی">
                  <div className="flex items-center justify-center gap-1">
                    <Armchair className="w-3.5 h-3.5 text-emerald-600" />
                    <span>عادی</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center font-semibold w-[13%] text-slate-600" title="گنجایش صندلی‌های میزهای بخش ویژه (VIP)">
                  <div className="flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>ویژه</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center font-semibold w-[10%] text-slate-600 font-sans">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {/* Add New Shift Row Inline Form */}
              {isAdding && (
                <tr className="bg-blue-50/30 animate-fade-in border-b border-blue-100/30">
                  <td className="py-3 px-4">
                    <input
                      id="input-new-shift-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="مثلاً: سانس زوج بعدازظهر"
                      className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 text-xs rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 text-right font-semibold"
                      dir="rtl"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                        const isSelected = newDays.includes(dayIdx);
                        return (
                          <button
                            key={dayIdx}
                            id={`day-chk-${dayIdx}`}
                            type="button"
                            onClick={() => toggleDayInList(newDays, setNewDays, dayIdx)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs select-none cursor-pointer transition-colors border ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-650'
                            }`}
                          >
                            {getWeekdayShortName(dayIdx)}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <input
                      id="input-new-shift-regular"
                      type="number"
                      min="0"
                      value={newTotalRegular}
                      onChange={(e) => setNewTotalRegular(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 text-xs rounded-xl text-center font-mono font-bold focus:outline-none focus:border-blue-500 text-emerald-700"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      id="input-new-shift-premium"
                      type="number"
                      min="0"
                      value={newTotalPremium}
                      onChange={(e) => setNewTotalPremium(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 text-xs rounded-xl text-center font-mono font-bold focus:outline-none focus:border-blue-500 text-blue-700"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center items-center gap-1.5">
                      <button
                        id="save-new-shift-btn"
                        onClick={handleSaveNew}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-colors"
                        title="ذخیره سانس جدید"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        id="cancel-new-shift-btn"
                        onClick={() => {
                          setIsAdding(false);
                          setErrorText('');
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300 rounded-lg cursor-pointer transition-colors"
                        title="لغو"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Listed Shifts Rows */}
              {shifts.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <tr key={s.id} id={`shift-row-${s.id}`} className="hover:bg-slate-50/40 transition-colors">
                    
                    {/* Name cell */}
                    <td className="py-4 px-4 font-bold text-slate-850">
                      {isEditing ? (
                        <input
                          id={`input-edit-shift-name-${s.id}`}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 text-xs rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/15 text-right"
                          dir="rtl"
                        />
                      ) : (
                        <span>{s.name}</span>
                      )}
                    </td>

                    {/* Active Days cell */}
                    <td className="py-4 px-4">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                            const isSelected = editDays.includes(dayIdx);
                            return (
                              <button
                                key={dayIdx}
                                id={`day-edit-chk-${dayIdx}`}
                                type="button"
                                onClick={() => toggleDayInList(editDays, setEditDays, dayIdx)}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs select-none cursor-pointer transition-colors border ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                {getWeekdayShortName(dayIdx)}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                            const isActive = s.weekDays.includes(dayIdx);
                            return (
                              <span
                                key={dayIdx}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                  isActive
                                    ? dayIdx === 6
                                      ? 'bg-rose-50 text-rose-600 border border-rose-100 font-extrabold'
                                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                                    : 'bg-slate-50 text-slate-400 border border-transparent line-through font-normal'
                                }`}
                              >
                                {getWeekdayShortName(dayIdx)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Regular Capacity cell */}
                    <td className="py-4 px-4 text-center">
                      {isEditing ? (
                        <input
                          id={`input-edit-shift-regular-${s.id}`}
                          type="number"
                          min="0"
                          value={editTotalRegular}
                          onChange={(e) => setEditTotalRegular(Math.max(0, Number(e.target.value)))}
                          className="w-16 bg-white border border-slate-300 text-slate-800 p-1.5 text-xs rounded-lg text-center font-mono font-extrabold text-emerald-700 font-sans"
                        />
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 border border-emerald-100 rounded-lg cursor-help transition-all hover:bg-emerald-100"
                          title={`${s.totalRegular ?? 20} صندلی عادی`}
                        >
                          <Armchair className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{s.totalRegular ?? 20}</span>
                        </span>
                      )}
                    </td>

                    {/* Premium Capacity cell */}
                    <td className="py-4 px-4 text-center">
                      {isEditing ? (
                        <input
                          id={`input-edit-shift-premium-${s.id}`}
                          type="number"
                          min="0"
                          value={editTotalPremium}
                          onChange={(e) => setEditTotalPremium(Math.max(0, Number(e.target.value)))}
                          className="w-16 bg-white border border-slate-300 text-slate-800 p-1.5 text-xs rounded-lg text-center font-mono font-extrabold text-blue-700 font-sans"
                        />
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 border border-blue-100 rounded-lg cursor-help transition-all hover:bg-blue-100"
                          title={`${s.totalPremium ?? 5} صندلی ویژه (VIP)`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{s.totalPremium ?? 5}</span>
                        </span>
                      )}
                    </td>

                    {/* Actions cell */}
                    <td className="py-4 px-4 text-center">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            id={`save-edit-btn-${s.id}`}
                            onClick={() => handleSaveEdit(s.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-colors"
                            title="ذخیره طرح تغییرات"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`cancel-edit-btn-${s.id}`}
                            onClick={() => {
                              setEditingId(null);
                              setErrorText('');
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-500 rounded-lg cursor-pointer transition-colors"
                            title="لغو"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            id={`edit-shift-btn-${s.id}`}
                            onClick={() => {
                              setEditingId(s.id);
                              setEditName(s.name);
                              setEditDays(s.weekDays);
                              setEditTotalRegular(s.totalRegular ?? 20);
                              setEditTotalPremium(s.totalPremium ?? 5);
                              setIsAdding(false);
                              setErrorText('');
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer transition-colors border border-slate-200"
                            title="ویرایش سانس"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-shift-btn-${s.id}`}
                            onClick={() => {
                              deleteShift(s.id);
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-605 rounded-lg cursor-pointer transition-all border border-slate-200 hover:border-rose-200"
                            title="حذف سانس"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
