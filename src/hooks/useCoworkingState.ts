import { useState, useEffect } from 'react';
import { CoworkingConfig, Shift, Member, Term, SessionNotes, CalendarOverrides, SessionAttendance } from '../types';
import { calculateTermSessions, getTodayJalali, isValidJalaliDate, normalizePersianDigits } from '../utils/jalali';

export interface DialogError {
  isOpen: boolean;
  title: string;
  message: string;
}

const STORAGE_KEYS = {
  CONFIG: 'coworking_config',
  SHIFTS: 'coworking_shifts',
  MEMBERS: 'coworking_members',
  TERMS: 'coworking_terms',
  NOTES: 'coworking_notes',
  ATTENDANCE: 'coworking_attendance',
  OVERRIDES: 'coworking_overrides',
};

export function useCoworkingState() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'reports' | 'profile' | 'shifts' | 'backup'>('reports');

  // Define dynamic today's date
  const [todayDate] = useState<string>(() => getTodayJalali());

  // 1. Core State Load
  const [config, setConfig] = useState<CoworkingConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    return saved ? JSON.parse(saved) : { totalRegularDesks: 20, totalPremiumDesks: 5 };
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((s: any) => ({
        ...s,
        totalRegular: typeof s.totalRegular === 'number' ? s.totalRegular : 20,
        totalPremium: typeof s.totalPremium === 'number' ? s.totalPremium : 5,
      }));
    }
    return [];
  });

  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map(({ deskType, ...m }: any) => m);
    }
    return [];
  });

  const [calendarOverrides, setCalendarOverrides] = useState<CalendarOverrides>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
    return saved ? JSON.parse(saved) : {};
  });

  const [terms, setTerms] = useState<Term[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TERMS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((t: any) => ({
        ...t,
        deskType: t.deskType || 'regular',
      }));
    }
    return [];
  });

  const [sessionNotes, setSessionNotes] = useState<SessionNotes>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (saved) return JSON.parse(saved);
    return {};
  });

  const [sessionAttendance, setSessionAttendance] = useState<SessionAttendance>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (saved) return JSON.parse(saved);
    return {};
  });

  const [dialogError, setDialogError] = useState<DialogError>({
    isOpen: false,
    title: '',
    message: '',
  });

  // 2. Persist state to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));
  }, [terms]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(sessionNotes));
  }, [sessionNotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(sessionAttendance));
  }, [sessionAttendance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(calendarOverrides));
  }, [calendarOverrides]);

  // 4. Central Backup History Autosave Tracker
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
          
          // 1. Prevent automatic empty backup creations if there is no real user data
          if (
            (!currentData.members || currentData.members.length === 0) &&
            (!currentData.shifts || currentData.shifts.length === 0) &&
            (!currentData.terms || currentData.terms.length === 0)
          ) {
            return prev;
          }

          // 2. Prevent duplicate backup entries where data hasn't changed
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
              return prev; // Skip duplicate history item
            }
          }
        } catch (e) {
          console.error("Error checking backup uniqueness in hook:", e);
        }

        // Keep only up to 5 history items
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

  // Recalculates all active subscriptions after any overrides change or shifts change
  const handleRecalculateAllTerms = (latestOverrides: CalendarOverrides = calendarOverrides) => {
    setTerms((prevTerms) =>
      prevTerms.map((t) => {
        const matchingShift = shifts.find((s) => s.id === t.shiftId);
        if (!matchingShift) return t;
        const calc = calculateTermSessions(t.startDate, t.sessionsCount, matchingShift.weekDays, latestOverrides);
        return {
          ...t,
          sessions: calc.sessions,
          endDate: calc.endDate,
        };
      })
    );
  };

  // Helper to open error dialogs nicely
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

  // 3. Transactions & CRUD Operations

  // Update System capacity configs
  const updateConfig = (newConfig: Partial<CoworkingConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  // SHIFT CRUD
  const addShift = (name: string, weekDays: number[], totalRegular = 20, totalPremium = 5) => {
    if (!name.trim()) return;
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      name: name.trim(),
      weekDays,
      totalRegular,
      totalPremium,
    };
    setShifts((prev) => [...prev, newShift]);
  };

  const updateShift = (id: string, updated: Partial<Omit<Shift, 'id'>>) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updatedShift = { ...s, ...updated };
          return updatedShift;
        }
        return s;
      })
    );
    // After shifts are updated, recalculate terms using this shift
    setTimeout(() => {
      handleRecalculateAllTerms(calendarOverrides);
    }, 50);
  };

  const deleteShift = (id: string) => {
    // Check if any registered subscriptions use this shift
    const hasRegisteredTerm = terms.some((t) => t.shiftId === id);
    if (hasRegisteredTerm) {
      showErrorDialog(
        'خطای عدم امکان حذف سانس',
        'امکان حذف این سانس وجود ندارد؛ زیرا تعدادی از کاربران در این سانس دارای عضویت و اشتراک فعال یا رزرو شده هستند. لطفا ابتدا اشتراک‌های این سانس را حذف یا ویرایش کنید.'
      );
      return false;
    }

    setShifts((prev) => prev.filter((s) => s.id !== id));
    return true;
  };

  // MEMBER CRUD
  const addMember = (fullName: string, phone: string) => {
    if (!fullName.trim() || !phone.trim()) return null;
    const newId = `member-${Date.now()}`;
    const newMember: Member = {
      id: newId,
      fullName: fullName.trim(),
      phone: phone.trim(),
    };
    setMembers((prev) => [...prev, newMember]);
    return newId;
  };

  const updateMember = (id: string, updated: Partial<Omit<Member, 'id'>>) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
    );
  };

  const deleteMember = (id: string) => {
    // Check if this member has registered terms
    const hasTerms = terms.some((t) => t.memberId === id);
    if (hasTerms) {
      showErrorDialog(
        'خطای عدم امکان حذف مشترک',
        'این مشترک دارای سوابق ترم و اشتراک‌های ثبت شده است. برای حفظ یکپارچگی داده‌ها، حذف این مشترک امکان‌پذیر نیست. لطفا ابتدا ترم‌های مربوط به این کاربر را حذف نمایید.'
      );
      return false;
    }

    setMembers((prev) => prev.filter((m) => m.id !== id));
    return true;
  };

  // TERM CRUD
  const addTerm = (memberId: string, shiftId: string, startDate: string, sessionsCount = 12, deskType: 'regular' | 'premium' = 'regular') => {
    if (!memberId || !shiftId || !startDate) return null;

    // Normalizing first to cover Persian digit characters conversion
    const normalizedStart = normalizePersianDigits(startDate);

    // Validate date format and validity
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

    // Check capacity conflicts for these sessions
    const capacityConflict = checkCapacityConflict(null, shiftId, deskType, calc.sessions);
    if (capacityConflict.isConflict) {
      showErrorDialog(
        'خطای تکمیل ظرفیت سانس کاری',
        `امکان ثبت این قرارداد وجود ندارد؛ زیرا ظرفیت صندلی‌های ${
          deskType === 'premium' ? 'بخش ویژه (VIP)' : 'عادی'
        } در سانس "${shiftObj.name}" در تاریخ ${capacityConflict.dateStr} تکمیل است. حد مجاز این صندلی‌ها در سانس انتخابی ${capacityConflict.capacity} صندلی بوده و در حال حاضر رزرو کامل گردیده است.`
      );
      return null;
    }

    const newId = `term-${Date.now()}`;
    const newTerm: Term = {
      id: newId,
      memberId,
      shiftId,
      startDate: normalizedStart,
      endDate: calc.endDate,
      sessionsCount,
      sessions: calc.sessions,
      deskType,
    };

    setTerms((prev) => [...prev, newTerm]);
    return newId;
  };

  const updateTerm = (id: string, updated: Partial<Omit<Term, 'id' | 'endDate' | 'sessions'>>) => {
    let conflictFound = false;
    let formatError = false;

    // Normalize and validate startDate if provided in the update package
    if (updated.startDate) {
      const normalizedStart = normalizePersianDigits(updated.startDate);
      if (!isValidJalaliDate(normalizedStart)) {
        showErrorDialog(
          'خطای تاریخ نامعتبر',
          'تاریخ شروع وارد شده معتبر نمی‌باشد. لطفاً فرمت صحیح YYYY/MM/DD را وارد کنید.'
        );
        formatError = true;
      } else {
        updated.startDate = normalizedStart;
      }
    }

    if (formatError) return false;

    setTerms((prev) => {
      const updatedTerms = prev.map((t) => {
        if (t.id === id) {
          const merged = { ...t, ...updated };
          const shiftObj = shifts.find((s) => s.id === merged.shiftId);
          if (shiftObj) {
            const calc = calculateTermSessions(merged.startDate, merged.sessionsCount, shiftObj.weekDays, calendarOverrides);
            
            const capacityConflict = checkCapacityConflict(id, merged.shiftId, merged.deskType, calc.sessions, prev);
            if (capacityConflict.isConflict) {
              showErrorDialog(
                'خطای تکمیل ظرفیت سانس کاری',
                `امکان ویرایش و ذخیره این قرارداد وجود ندارد؛ زیرا ظرفیت صندلی‌های ${
                  merged.deskType === 'premium' ? 'بخش ویژه (VIP)' : 'عادی'
                } در سانس "${shiftObj.name}" در تاریخ ${capacityConflict.dateStr} به اتمام رسیده است (حد مجاز ظرفیت: ${capacityConflict.capacity} عدد).`
              );
              conflictFound = true;
              return t; // Keep original
            }

            return {
              ...merged,
              sessions: calc.sessions,
              endDate: calc.endDate,
            };
          }
          return merged;
        }
        return t;
      });

      return conflictFound ? prev : updatedTerms;
    });

    return !conflictFound;
  };

  const deleteTerm = (id: string) => {
    setTerms((prev) => prev.filter((t) => t.id !== id));
    // Clean up related session notes
    setSessionNotes((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((key) => {
        if (key.startsWith(`${id}_`)) {
          delete copy[key];
        }
      });
      return copy;
    });
    // Clean up related attendance
    setSessionAttendance((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((key) => {
        if (key.startsWith(`${id}_`)) {
          delete copy[key];
        }
      });
      return copy;
    });
    return true;
  };

  // CALENDAR DAYS TOGGLE
  const toggleDayStatus = (dateStr: string) => {
    setCalendarOverrides((prev) => {
      const currentStatus = prev[dateStr];
      const copy = { ...prev };

      // Cycle through status: default -> holiday -> working -> default
      if (!currentStatus) {
        copy[dateStr] = 'holiday';
      } else if (currentStatus === 'holiday') {
        copy[dateStr] = 'working';
      } else {
        delete copy[dateStr];
      }

      // Reactive Recalculation
      setTimeout(() => {
        handleRecalculateAllTerms(copy);
      }, 20);

      return copy;
    });
  };

  // SESSION NOTES CRUD
  const saveSessionNote = (termId: string, dateStr: string, note: string) => {
    const key = `${termId}_${dateStr}`;
    setSessionNotes((prev) => ({
      ...prev,
      [key]: note,
    }));
  };

  // SESSION ATTENDANCE CRUD
  const saveSessionAttendance = (termId: string, dateStr: string, status: 'present' | 'absent' | '') => {
    const key = `${termId}_${dateStr}`;
    setSessionAttendance((prev) => ({
      ...prev,
      [key]: status,
    }));
  };

  // RESTORE BACKUP DATA
  const importBackupData = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (data.config) {
        setConfig(data.config);
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(data.config));
      }
      if (data.shifts) {
        setShifts(data.shifts);
        localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(data.shifts));
      }
      if (data.members) {
        setMembers(data.members);
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(data.members));
      }
      if (data.terms) {
        setTerms(data.terms);
        localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(data.terms));
      }
      if (data.notes) {
        setSessionNotes(data.notes);
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(data.notes));
      }
      if (data.attendance) {
        setSessionAttendance(data.attendance);
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(data.attendance));
      }
      if (data.overrides) {
        setCalendarOverrides(data.overrides);
        localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(data.overrides));
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
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
    localHistory,
    setLocalHistory,
    dialogError,
    closeErrorDialog,
    showErrorDialog,
  };
}
