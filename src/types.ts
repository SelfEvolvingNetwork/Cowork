export interface CoworkingConfig {
  totalRegularDesks: number;
  totalPremiumDesks: number;
}

export interface Shift {
  id: string;
  name: string;
  weekDays: number[]; // 0: Sat, 1: Sun, 2: Mon, 3: Tue, 4: Wed, 5: Thu, 6: Fri
  totalRegular: number;
  totalPremium: number;
}

export interface Member {
  id: string;
  fullName: string;
  phone: string;
}

export interface Term {
  id: string;
  memberId: string;
  shiftId: string;
  startDate: string; // YYYY/MM/DD
  endDate: string;   // YYYY/MM/DD
  sessionsCount: number; // default: 12
  sessions: string[]; // List of calculated session Jalali dates
  deskType: 'regular' | 'premium'; // نوع صندلی مربوط به ثبت‌نام ترم است
}

// Session notes keyed by: `${termId}_${date}` (where date is YYYY/MM/DD)
export type SessionNotes = Record<string, string>;

// Session attendance keyed by: `${termId}_${date}` (where date is YYYY/MM/DD)
export type SessionAttendance = Record<string, 'present' | 'absent' | ''>;

// Calendar date custom status overrides keyed by YYYY/MM/DD
export type CalendarOverrides = Record<string, 'holiday' | 'working'>;
