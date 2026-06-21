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
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 text-right transition-all">
      {isEditingMember ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-row-reverse">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-row-reverse">
              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
              <span>ویرایش مشخصات پرونده</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1 text-right">
              <label className="text-[10px] font-bold text-slate-400">نام کامل مراجع</label>
              <input
                id="edit-fullname-inline"
                type="text"
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 p-2 text-xs rounded-lg focus:outline-none focus:border-slate-400 font-semibold text-right transition-all"
                dir="rtl"
                placeholder="مثال: علی احمدی"
              />
            </div>

            <div className="flex flex-col gap-1 text-right">
              <label className="text-[10px] font-bold text-slate-400">شماره تلفن همراه</label>
              <input
                id="edit-phone-inline"
                type="text"
                value={editMemberPhone}
                onChange={(e) => setEditMemberPhone(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 p-2 text-xs rounded-lg focus:outline-none focus:border-slate-400 font-mono text-left transition-all"
                dir="ltr"
                placeholder="09123456789"
              />
            </div>
          </div>

          {error && (
            <p className="text-rose-600 text-[10.5px] font-semibold mt-1 text-right">
              {error}
            </p>
          )}

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 flex-row-reverse">
            <div className="flex gap-2 flex-row-reverse">
              <button
                id="save-edit-member-btn"
                onClick={handleSaveEditMember}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-all"
                title="ذخیره کلیه ویرایش‌های پرونده"
              >
                <Check className="w-3.5 h-3.5" />
                <span>ذخیره تغییرات</span>
              </button>
              <button
                id="cancel-edit-member-btn"
                onClick={() => setIsEditingMember(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg cursor-pointer transition-all"
                title="لغو تغییرات"
              >
                انصراف
              </button>
            </div>

            <button
              id="delete-member-inline-btn"
              onClick={handleDeleteMember}
              className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg cursor-pointer transition-all"
              title="حذف کامل پرونده مراجع"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف پرونده</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-row-reverse w-full">
          {/* Info Segment: Name and Phone in a single row */}
          <div className="flex items-center gap-4 flex-row-reverse min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-800 truncate" title={member.fullName}>
              {member.fullName}
            </h2>
            <span className="text-slate-300 text-xs select-none">|</span>
            <span className="text-xs text-slate-500 font-mono select-all tracking-wider">
              {member.phone}
            </span>
          </div>

          {/* Quick edit button to turn on editing mode */}
          <button
            id="edit-member-btn"
            onClick={() => {
              setIsEditingMember(true);
              setEditMemberName(member.fullName);
              setEditMemberPhone(member.phone);
              setError('');
            }}
            className="flex items-center justify-center w-8 h-8 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer transition-all active:scale-95 shrink-0"
            title="ویرایش پرونده"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
