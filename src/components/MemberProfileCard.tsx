import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { Edit2, Check, X, Trash2 } from 'lucide-react';

interface MemberProfileCardProps {
  member: Member;
  memberTermsCount: number;
  updateMember: (id: string, updated: Partial<Omit<Member, 'id'>>) => void;
  deleteMember: (id: string) => boolean;
  onDeleteSuccess: () => void;
}

export function MemberProfileCard({
  member,
  memberTermsCount,
  updateMember,
  deleteMember,
  onDeleteSuccess,
}: MemberProfileCardProps) {
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editMemberName, setEditMemberName] = useState(member.fullName);
  const [editMemberPhone, setEditMemberPhone] = useState(member.phone);
  const [error, setError] = useState('');

  useEffect(() => {
    setEditMemberName(member.fullName);
    setEditMemberPhone(member.phone);
    setIsEditingMember(false);
    setError('');
  }, [member]);

  const handleSaveEditMember = () => {
    if (!editMemberName.trim() || !editMemberPhone.trim()) {
      setError('نام کامل و شماره تماس نباید خالی باشند.');
      return;
    }
    updateMember(member.id, {
      fullName: editMemberName.trim(),
      phone: editMemberPhone.trim(),
    });
    setIsEditingMember(false);
    setError('');
  };

  const handleDeleteMember = () => {
    const ok = deleteMember(member.id);
    if (ok) {
      onDeleteSuccess();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-right">
      {isEditingMember ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-blue-600" />
            <span>ویرایش پرونده</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400">نام کامل:</label>
              <input
                id="edit-fullname-inline"
                type="text"
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-850 p-2.5 text-xs rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-right"
                dir="rtl"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400">تلفن همراه:</label>
              <input
                id="edit-phone-inline"
                type="text"
                value={editMemberPhone}
                onChange={(e) => setEditMemberPhone(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-850 p-2.5 text-xs rounded-xl focus:outline-none focus:border-blue-500 font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-bold mt-1 text-right">{error}</p>
          )}

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 flex-row-reverse">
            <div className="flex gap-2 flex-row-reverse">
              <button
                id="save-edit-member-btn"
                onClick={handleSaveEditMember}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                title="ذخیره کلیه ویرایش‌های پرونده"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره</span>
              </button>
              <button
                id="cancel-edit-member-btn"
                onClick={() => setIsEditingMember(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
                title="لغو تغییرات"
              >
                لغو
              </button>
            </div>

            <button
              id="delete-member-inline-btn"
              onClick={handleDeleteMember}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs rounded-xl cursor-pointer transition-all"
              title="پاکسازی کامل اطلاعات پرونده مراجع"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف پرونده</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-row-reverse">
          <div className="flex items-center gap-4 flex-row-reverse">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
              {member.fullName[0] || 'م'}
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-slate-850">{member.fullName}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-2 flex-row-reverse">
                <span className="font-mono text-slate-600 font-bold">شماره تماس: {member.phone}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-slate-50 px-4 py-2 rounded-xl text-center border border-slate-200 font-sans shrink-0" title="مجموع کل قراردادهای ثبت‌شده برای مراجع">
              <div className="text-[10px] text-slate-505 font-bold">قراردادها</div>
              <div className="text-lg font-bold text-blue-700 mt-0.5 font-mono">{memberTermsCount} دور</div>
            </div>

            <button
              id="edit-member-btn"
              onClick={() => {
                setIsEditingMember(true);
                setEditMemberName(member.fullName);
                setEditMemberPhone(member.phone);
                setError('');
              }}
              className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-xl text-slate-600 cursor-pointer transition-all"
              title="ویرایش مشخصات پرونده"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
