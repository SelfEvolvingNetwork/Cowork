import { useState, useEffect, useRef } from 'react';
import { CoworkingConfig, Shift, Member, Term, SessionNotes, CalendarOverrides, SessionAttendance } from '../types';
import { calculateTermSessions, getTodayJalali, isValidJalaliDate, normalizePersianDigits } from '../utils/jalali';

export interface DialogError {
  isOpen: boolean;
  title: string;
  message: string;
}

export function useCoworkingState() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'reports' | 'profile' | 'shifts' | 'backup'>('reports');

  // Define dynamic today's date
  const [todayDate] = useState<string>(() => getTodayJalali());

  // 1. Core State
  const [config, setConfig] = useState<CoworkingConfig>({ totalRegularDesks: 20, totalPremiumDesks: 5 });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [calendarOverrides, setCalendarOverrides] = useState<CalendarOverrides>({});
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNotes>({});
  const [sessionAttendance, setSessionAttendance] = useState<SessionAttendance>({});

  const [dialogError, setDialogError] = useState<DialogError>({
    isOpen: false,
    title: '',
    message: '',
  });

  const serverVersionRef = useRef<number>(0);

  // Helper to sync state from server
  const syncWithServer = (data: any, force = false) => {
    const version = data.version || 0;
    if (!force && version <= serverVersionRef.current) return;

    serverVersionRef.current = version;
    if (data.config) setConfig(data.config);
    if (data.shifts) setShifts(data.shifts);
    if (data.members) setMembers(data.members);
    if (data.terms) setTerms(data.terms);
    if (data.sessionNotes) setSessionNotes(data.sessionNotes);
    if (data.sessionAttendance) setSessionAttendance(data.sessionAttendance);
    if (data.calendarOverrides) setCalendarOverrides(data.calendarOverrides);
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  const manualSync = async (silent = false): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/data");
      const data = await res.json();
      syncWithServer(data, true); // force state sync to guarantee latest server content
      const now = new Date();
      setLastSyncedTime(now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      return true;
    } catch (e) {
      console.error("Manual sync failed:", e);
      if (!silent) {
        showErrorDialog(
          "خطای ارتباط با سرور",
          "امکان برقراری ارتباط با سرور برای همگام‌سازی وجود ندارد. لطفا اتصال شبکه خود را بررسی کنید."
        );
      }
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Initial load (Only fetch once on mount)
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await fetch("/api/data");
        const data = await res.json();
        syncWithServer(data);
        const now = new Date();
        setLastSyncedTime(now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        console.error("Failed to fetch initial data:", e);
      }
    };
    fetchInitial();
  }, []);

  // 3. Central Backup History Autosave Tracker (Local storage per browser, nice for recovery)
  const [localHistory, setLocalHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('coworking_backup_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const autoSaveEnabled = localStorage.getItem('autosave_enabled') !== 'false';
    if (!autoSaveEnabled) return;

    const timer = setTimeout(() => {
      const now = new Date();
      const jalaliTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const jalaliDate = now.toLocaleDateString('fa-IR');
      const timestampStr = `${jalaliDate} - ${jalaliTime}`;

      const stateObj = {
        config,
        shifts,
        members,
        terms,
        notes: sessionNotes,
        attendance: sessionAttendance,
        overrides: calendarOverrides,
        exportedAt: now.toISOString(),
        appVersion: '1.2.0'
      };
      const jsonString = JSON.stringify(stateObj, null, 2);

      setLocalHistory((prev) => {
        try {
          const currentData = JSON.parse(jsonString);
          
          if (
            (!currentData.members || currentData.members.length === 0) &&
            (!currentData.shifts || currentData.shifts.length === 0) &&
            (!currentData.terms || currentData.terms.length === 0)
          ) {
            return prev;
          }

          if (prev.length > 0) {
            const lastData = JSON.parse(prev[0].data);
            const isSame = 
              JSON.stringify(currentData.members) === JSON.stringify(lastData.members) &&
              JSON.stringify(currentData.shifts) === JSON.stringify(lastData.shifts) &&
              JSON.stringify(currentData.terms) === JSON.stringify(lastData.terms) &&
              JSON.stringify(currentData.notes) === JSON.stringify(lastData.notes) &&
              JSON.stringify(currentData.attendance) === JSON.stringify(lastData.attendance) &&
              JSON.stringify(currentData.overrides) === JSON.stringify(lastData.overrides);
            
            if (isSame) {
              return prev;
            }
          }
        } catch (e) {
          console.error("Error checking backup uniqueness in hook:", e);
        }

        const updated = [
          {
            id: 'hist-' + Date.now(),
            timestamp: timestampStr,
            recordsCount: {
              members: members.length,
              terms: terms.length,
              attendance: Object.keys(sessionAttendance).filter(k => sessionAttendance[k]).length,
            },
            data: jsonString
          },
          ...prev.slice(0, 4)
        ];
        localStorage.setItem('coworking_backup_history', JSON.stringify(updated));
        return updated;
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [config, shifts, members, terms, sessionNotes, sessionAttendance, calendarOverrides]);

  // Helper to open error dialogs
  const showErrorDialog = (title: string, message: string) => {
    setDialogError({ isOpen: true, title, message });
  };

  const closeErrorDialog = () => {
    setDialogError((prev) => ({ ...prev, isOpen: false }));
  };

  // Helper to check for seat overbooking on session days
  const checkCapacityConflict = (
    termId: string | null,
    shiftId: string,
    deskType: 'regular' | 'premium',
    sessions: string[],
    currentTerms: Term[] = terms
  ): { isConflict: boolean; dateStr?: string; count?: number; capacity?: number } => {
    const shiftObj = shifts.find((s) => s.id === shiftId);
    if (!shiftObj) return { isConflict: false };

    const capacity = deskType === 'premium' ? (shiftObj.totalPremium ?? 5) : (shiftObj.totalRegular ?? 20);

    for (const dateStr of sessions) {
      const activeCount = currentTerms.filter(
        (t) =>
          t.id !== termId &&
          t.shiftId === shiftId &&
          t.deskType === deskType &&
          t.sessions.includes(dateStr)
      ).length;

      if (activeCount + 1 > capacity) {
        return {
          isConflict: true,
          dateStr,
          count: activeCount + 1,
          capacity
        };
      }
    }
    return { isConflict: false };
  };

  // 4. API Operations / REST Transactions

  const updateConfig = async (newConfig: Partial<CoworkingConfig>) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: newConfig }),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  };

  // SHIFT CRUD
  const addShift = async (name: string, weekDays: number[], totalRegular = 20, totalPremium = 5) => {
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, weekDays, totalRegular, totalPremium }),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to add shift:", err);
    }
  };

  const updateShift = async (id: string, updated: Partial<Omit<Shift, 'id'>>) => {
    try {
      const res = await fetch(`/api/shifts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to update shift:", err);
    }
  };

  const deleteShift = async (id: string) => {
    const hasRegisteredTerm = terms.some((t) => t.shiftId === id);
    if (hasRegisteredTerm) {
      showErrorDialog(
        'خطای عدم امکان حذف سانس',
        'امکان حذف این سانس وجود ندارد؛ زیرا تعدادی از کاربران در این سانس دارای عضویت و اشتراک فعال یا رزرو شده هستند. لطفا ابتدا اشتراک‌های این سانس را حذف یا ویرایش کنید.'
      );
      return false;
    }

    try {
      const res = await fetch(`/api/shifts/${id}`, {
        method: "DELETE",
      });
      const db = await res.json();
      syncWithServer(db);
      return true;
    } catch (err) {
      console.error("Failed to delete shift:", err);
      return false;
    }
  };

  // MEMBER CRUD
  const addMember = async (fullName: string, phone: string) => {
    if (!fullName.trim() || !phone.trim()) return null;
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone }),
      });
      const data = await res.json();
      syncWithServer(data.db);
      return data.newId;
    } catch (err) {
      console.error("Failed to add member:", err);
      return null;
    }
  };

  const updateMember = async (id: string, updated: Partial<Omit<Member, 'id'>>) => {
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to update member:", err);
    }
  };

  const deleteMember = async (id: string) => {
    const hasTerms = terms.some((t) => t.memberId === id);
    if (hasTerms) {
      showErrorDialog(
        'خطای عدم امکان حذف مشترک',
        'این مشترک دارای سوابق ترم و اشتراک‌های ثبت شده است. برای حفظ یکپارچگی داده‌ها، حذف این مشترک امکان‌پذیر نیست. لطفا ابتدا ترم‌های مربوط به این کاربر را حذف نمایید.'
      );
      return false;
    }

    try {
      const res = await fetch(`/api/members/${id}`, {
        method: "DELETE",
      });
      const db = await res.json();
      syncWithServer(db);
      return true;
    } catch (err) {
      console.error("Failed to delete member:", err);
      return false;
    }
  };

  // TERM CRUD
  const addTerm = async (
    memberId: string,
    shiftId: string,
    startDate: string,
    sessionsCount = 12,
    deskType: 'regular' | 'premium' = 'regular'
  ) => {
    if (!memberId || !shiftId || !startDate) return null;

    const normalizedStart = normalizePersianDigits(startDate);

    if (!isValidJalaliDate(normalizedStart)) {
      showErrorDialog(
        'خطای تاریخ نامعتبر',
        'تاریخ شروع وارد شده معتبر نمی‌باشد. لطفاً فرمت تاریخ را به شکل صحیح YYYY/MM/DD (مانند 1405/01/15) با روزها و ماه‌های معتبر وارد انتخاب کنید.'
      );
      return null;
    }

    const shiftObj = shifts.find((s) => s.id === shiftId);
    if (!shiftObj) return null;

    const calc = calculateTermSessions(normalizedStart, sessionsCount, shiftObj.weekDays, calendarOverrides);

    const capacityConflict = checkCapacityConflict(null, shiftId, deskType, calc.sessions);
    if (capacityConflict.isConflict) {
      showErrorDialog(
        'هشدار تکمیل ظرفیت سانس کاری',
        `توجه: ظرفیت صندلی‌های ${
          deskType === 'premium' ? 'بخش ویژه (VIP)' : 'عادی'
        } در سانس "${shiftObj.name}" در تاریخ ${capacityConflict.dateStr} پر شده است (ظرفیت مجاز: ${capacityConflict.capacity} صندلی). با این حال، ثبت‌نام با موفقیت ذخیره و انجام شد.`
      );
    }

    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          shiftId,
          startDate: normalizedStart,
          endDate: calc.endDate,
          sessionsCount,
          sessions: calc.sessions,
          deskType,
        }),
      });
      const data = await res.json();
      syncWithServer(data.db);
      return data.newId;
    } catch (err) {
      console.error("Failed to add term:", err);
      return null;
    }
  };

  const updateTerm = async (
    id: string,
    updated: Partial<Omit<Term, 'id' | 'endDate' | 'sessions'>>
  ) => {
    if (updated.startDate) {
      const normalizedStart = normalizePersianDigits(updated.startDate);
      if (!isValidJalaliDate(normalizedStart)) {
        showErrorDialog(
          'خطای تاریخ نامعتبر',
          'تاریخ شروع وارد شده معتبر نمی‌باشد. لطفاً فرمت صحیح YYYY/MM/DD را وارد کنید.'
        );
        return false;
      } else {
        updated.startDate = normalizedStart;
      }
    }

    const termToUpdate = terms.find((t) => t.id === id);
    if (!termToUpdate) return false;

    const merged = { ...termToUpdate, ...updated };
    const shiftObj = shifts.find((s) => s.id === merged.shiftId);
    if (!shiftObj) return false;

    const calc = calculateTermSessions(merged.startDate, merged.sessionsCount, shiftObj.weekDays, calendarOverrides);

    const capacityConflict = checkCapacityConflict(id, merged.shiftId, merged.deskType, calc.sessions, terms);
    if (capacityConflict.isConflict) {
      showErrorDialog(
        'هشدار تکمیل ظرفیت سانس کاری',
        `توجه: ظرفیت صندلی‌های ${
          merged.deskType === 'premium' ? 'بخش ویژه (VIP)' : 'عادی'
        } در سانس "${shiftObj.name}" در تاریخ ${capacityConflict.dateStr} پر شده است (حد مجاز ظرفیت: ${capacityConflict.capacity} عدد). با این حال، تغییرات با موفقیت ذخیره گردید.`
      );
    }

    try {
      const res = await fetch(`/api/terms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updated,
          sessions: calc.sessions,
          endDate: calc.endDate,
        }),
      });
      const db = await res.json();
      syncWithServer(db);
      return true;
    } catch (err) {
      console.error("Failed to update term:", err);
      return false;
    }
  };

  const deleteTerm = async (id: string) => {
    try {
      const res = await fetch(`/api/terms/${id}`, {
        method: "DELETE",
      });
      const db = await res.json();
      syncWithServer(db);
      return true;
    } catch (err) {
      console.error("Failed to delete term:", err);
      return false;
    }
  };

  // CALENDAR DAYS TOGGLE
  const toggleDayStatus = async (dateStr: string) => {
    try {
      const res = await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateStr }),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to toggle day status:", err);
    }
  };

  // SESSION NOTES CRUD
  const saveSessionNote = async (termId: string, dateStr: string, note: string) => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId, dateStr, note }),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to save session note:", err);
    }
  };

  // SESSION ATTENDANCE CRUD
  const saveSessionAttendance = async (termId: string, dateStr: string, status: 'present' | 'absent' | '') => {
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId, dateStr, status }),
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to save session attendance:", err);
    }
  };

  // RESTORE BACKUP DATA
  const importBackupData = async (jsonString: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonString);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        throw new Error("Server import failed");
      }
      const db = await res.json();
      syncWithServer(db, true);
      return true;
    } catch (e) {
      console.error("Failed to import backup:", e);
      return false;
    }
  };

  // WIPE ALL OPERATIONAL DATA COLD RESET
  const wipeAllData = async () => {
    try {
      const res = await fetch("/api/wipe", {
        method: "POST",
      });
      const db = await res.json();
      syncWithServer(db);
    } catch (err) {
      console.error("Failed to wipe data:", err);
    }
  };

  return {
    activeTab,
    setActiveTab,
    todayDate,
    config,
    updateConfig,
    shifts,
    addShift,
    updateShift,
    deleteShift,
    members,
    addMember,
    updateMember,
    deleteMember,
    terms,
    addTerm,
    updateTerm,
    deleteTerm,
    calendarOverrides,
    toggleDayStatus,
    sessionNotes,
    saveSessionNote,
    sessionAttendance,
    saveSessionAttendance,
    importBackupData,
    wipeAllData,
    localHistory,
    setLocalHistory,
    dialogError,
    closeErrorDialog,
    showErrorDialog,
    isSyncing,
    lastSyncedTime,
    manualSync,
  };
}
