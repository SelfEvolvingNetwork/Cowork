/**
 * Highly precise Jalali (Shamsi) Calendar utilities
 */

export function isJalaliLeapYear(jy: number): boolean {
  const r = jy % 33;
  return [1, 5, 9, 13, 17, 21, 25, 29, 0].includes(r);
}

export function getDaysInJalaliMonth(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) {
    return isJalaliLeapYear(jy) ? 30 : 29;
  }
  return 0;
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  const jy2 = jy - 979;
  const jm2 = jm - 1;
  const jd2 = jd - 1;

  let jDays = jy2 * 365 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
  for (let i = 0; i < jm2; i++) {
    jDays += i < 6 ? 31 : 30;
  }
  jDays += jd2;

  const gDays = jDays + 79;
  const gy = 1600 + 400 * Math.floor(gDays / 146097);
  let gDayRemainder = gDays % 146097;

  let leap = true;
  if (gDayRemainder >= 36525) {
    gDayRemainder--;
    const century = Math.floor(gDayRemainder / 36524);
    gDayRemainder = gDayRemainder % 36524;
    gDayRemainder++;
    if (gDayRemainder >= 365) {
      leap = false;
    }
  }

  const gyAdd = 4 * Math.floor(gDayRemainder / 1461);
  let gDayRemainder2 = gDayRemainder % 1461;
  let gyAdd2 = Math.floor((gDayRemainder2 - 1) / 365);
  if (gyAdd2 > 3) {
    gyAdd2 = 3;
  }
  const year = gy + gyAdd + gyAdd2;
  const dayOfYear = gDayRemainder2 - Math.floor((gyAdd2 * 1461 + 3) / 4);

  const gMonthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
    gMonthDays[1] = 29;
  }

  let month = 0;
  let daysAcc = 0;
  for (let i = 0; i < 12; i++) {
    if (dayOfYear < daysAcc + gMonthDays[i]) {
      month = i + 1;
      break;
    }
    daysAcc += gMonthDays[i];
  }
  const day = dayOfYear - daysAcc + 1;

  return new Date(year, month - 1, day);
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  const gy2 = gy - 1600;
  const gm2 = gm - 1;
  const gd2 = gd - 1;

  let g_day_no = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);

  let i;
  for (i = 0; i < gm2; ++i) {
    g_day_no += g_days_in_month[i];
  }
  if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) {
    g_day_no++;
  }
  g_day_no += gd2;

  let j_day_no = g_day_no - 79;
  const j_np = Math.floor(j_day_no / 12053);
  j_day_no = j_day_no % 12053;

  let jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  let rem = j_day_no % 1461;

  if (rem >= 366) {
    jy += Math.floor((rem - 1) / 365);
    rem = (rem - 1) % 365;
  }

  for (i = 0; i < 11 && rem >= j_days_in_month[i]; ++i) {
    rem -= j_days_in_month[i];
  }
  const jm = i + 1;
  const jd = rem + 1;

  return { jy, jm, jd };
}

export function getWeekdayOfJalali(jy: number, jm: number, jd: number): number {
  const date = jalaliToGregorian(jy, jm, jd);
  const gDay = date.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  // Map index: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
  // Custom weeks: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
  const mapDays = [1, 2, 3, 4, 5, 6, 0];
  return mapDays[gDay];
}

export function parseJalaliString(str: string): { jy: number; jm: number; jd: number } {
  const normalized = normalizePersianDigits(str);
  const parts = normalized.split('/');
  return {
    jy: parseInt(parts[0] || '1405', 10),
    jm: parseInt(parts[1] || '1', 10),
    jd: parseInt(parts[2] || '1', 10)
  };
}

export function normalizePersianDigits(str: string): string {
  if (!str) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let result = str.toString();
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(farsiDigits[i], 'g'), i.toString());
  }
  const arabicIndDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicIndDigits[i], 'g'), i.toString());
  }
  return result;
}

export function isValidJalaliDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const normalized = normalizePersianDigits(dateStr);
  const regex = /^\d{4}\/\d{2}\/\d{2}$/;
  if (!regex.test(normalized)) return false;
  const parts = normalized.split('/');
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  if (jm < 1 || jm > 12) return false;
  const maxDays = getDaysInJalaliMonth(jy, jm);
  if (jd < 1 || jd > maxDays) return false;
  return true;
}

export function formatJalali(jy: number, jm: number, jd: number): string {
  const mm = jm < 10 ? `0${jm}` : `${jm}`;
  const dd = jd < 10 ? `0${jd}` : `${jd}`;
  return `${jy}/${mm}/${dd}`;
}

export function addDaysJalali(dateStr: string, days: number): string {
  const { jy, jm, jd } = parseJalaliString(dateStr);
  const gDate = jalaliToGregorian(jy, jm, jd);
  gDate.setDate(gDate.getDate() + days);
  const result = gregorianToJalali(gDate.getFullYear(), gDate.getMonth() + 1, gDate.getDate());
  return formatJalali(result.jy, result.jm, result.jd);
}

export function getTodayJalali(): string {
  const now = new Date();
  const res = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return formatJalali(res.jy, res.jm, res.jd);
}

export function isDefaultHoliday(jy: number, jm: number, jd: number): boolean {
  // Friday is standard holiday
  const weekday = getWeekdayOfJalali(jy, jm, jd);
  if (weekday === 6) return true; // Friday

  // Solar holidays (MM/DD in Jalali calendar)
  const monthDayStr = `${jm}/${jd}`;
  const solarHolidays = [
    "1/1", "1/2", "1/3", "1/4", // Nowruz holidays
    "1/12", "1/13",             // 12 Farvardin (Islamic Republic Day) & 13 Farvardin (Nature Day)
    "3/14", "3/15",             // 14 & 15 Khordad
    "11/22",                    // 22 Bahman
    "12/29"                     // 29 Esfand (Oil Industry Nationalization)
  ];
  return solarHolidays.includes(monthDayStr);
}

export function isHoliday(dateStr: string, overrides: Record<string, 'holiday' | 'working'>): boolean {
  if (overrides[dateStr] === 'holiday') return true;
  if (overrides[dateStr] === 'working') return false;
  const { jy, jm, jd } = parseJalaliString(dateStr);
  return isDefaultHoliday(jy, jm, jd);
}

export function getJalaliMonthName(jm: number): string {
  const months = [
    "فروردین", "اردیبهشت", "خرداد",
    "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر",
    "دی", "بهمن", "اسفند"
  ];
  return months[jm - 1] || "";
}

export function getWeekdayName(w: number): string {
  const weekdays = [
    "شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنجشنبه", "جمعه"
  ];
  return weekdays[w] || "";
}

export function getWeekdayShortName(w: number): string {
  const weekdays = [
    "ش", "ی", "د", "س", "چ", "پ", "ج"
  ];
  return weekdays[w] || "";
}

/**
 * Calculates a subscription's term session dates and end date.
 * Each term is 12 sessions default.
 * It starts at startDate, then goes day-by-day.
 * A session can only be held on one of the weekDays specified in the active shift,
 * and it can only be counted as a session if it's NOT a holiday (isHoliday is false).
 */
export function calculateTermSessions(
  startDateStr: string,
  sessionsCount: number,
  shiftWeekDays: number[],
  overrides: Record<string, 'holiday' | 'working'>
): { sessions: string[]; endDate: string } {
  const sessions: string[] = [];
  let currentDate = startDateStr;
  let safetyCounter = 0;

  while (sessions.length < sessionsCount && safetyCounter < 1000) {
    safetyCounter++;
    const { jy, jm, jd } = parseJalaliString(currentDate);
    const w = getWeekdayOfJalali(jy, jm, jd);

    if (shiftWeekDays.includes(w)) {
      // It's a day of the shift
      const dayIsHoliday = isHoliday(currentDate, overrides);
      if (!dayIsHoliday) {
        // It's a working day, so it counts as a session!
        sessions.push(currentDate);
      }
    }

    if (sessions.length < sessionsCount) {
      currentDate = addDaysJalali(currentDate, 1);
    }
  }

  return {
    sessions,
    endDate: currentDate
  };
}
