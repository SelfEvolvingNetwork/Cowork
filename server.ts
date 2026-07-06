import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import { calculateTermSessions } from "./src/utils/jalali";

const DB_PATH = path.join(process.cwd(), "database.json");

interface DbState {
  version: number;
  config: { totalRegularDesks: number; totalPremiumDesks: number };
  shifts: any[];
  members: any[];
  terms: any[];
  sessionNotes: Record<string, string>;
  sessionAttendance: Record<string, string>;
  calendarOverrides: Record<string, "holiday" | "working">;
}

function recalculateAllTerms(db: DbState) {
  if (!db.terms || !Array.isArray(db.terms)) return;
  db.terms = db.terms.map((t) => {
    const shift = db.shifts.find((s) => s.id === t.shiftId);
    if (!shift) return t;
    const calc = calculateTermSessions(t.startDate, t.sessionsCount, shift.weekDays, db.calendarOverrides);
    return {
      ...t,
      sessions: calc.sessions,
      endDate: calc.endDate,
    };
  });
}

const DEFAULT_DB: DbState = {
  version: 1,
  config: { totalRegularDesks: 20, totalPremiumDesks: 5 },
  shifts: [],
  members: [],
  terms: [],
  sessionNotes: {},
  sessionAttendance: {},
  calendarOverrides: {}
};

// Queue helper to prevent concurrent file I/O race conditions
class DbQueue {
  private queue: Promise<any> = Promise.resolve();

  async run<T>(op: () => Promise<T>): Promise<T> {
    const next = this.queue.then(op);
    this.queue = next.catch(() => {});
    return next;
  }
}

const dbQueue = new DbQueue();

async function readDb(): Promise<DbState> {
  return dbQueue.run(async () => {
    try {
      const data = await fs.readFile(DB_PATH, "utf-8");
      return JSON.parse(data);
    } catch {
      await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
      return DEFAULT_DB;
    }
  });
}

async function writeDb(state: DbState): Promise<DbState> {
  return dbQueue.run(async () => {
    state.version = (state.version || 0) + 1;
    await fs.writeFile(DB_PATH, JSON.stringify(state, null, 2), "utf-8");
    return state;
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check API route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "coworking-manager" });
  });

  // Get current DB
  app.get("/api/data", async (req, res) => {
    try {
      const db = await readDb();
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Config
  app.post("/api/config", async (req, res) => {
    try {
      const { config } = req.body;
      const db = await readDb();
      db.config = { ...db.config, ...config };
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SHIFTS CRUD
  app.post("/api/shifts", async (req, res) => {
    try {
      const { name, weekDays, totalRegular, totalPremium } = req.body;
      const db = await readDb();
      const newShift = {
        id: `shift-${Date.now()}`,
        name: (name || "").trim(),
        weekDays: weekDays || [],
        totalRegular: typeof totalRegular === "number" ? totalRegular : 20,
        totalPremium: typeof totalPremium === "number" ? totalPremium : 5,
      };
      db.shifts.push(newShift);
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = req.body;
      const db = await readDb();
      db.shifts = db.shifts.map((s) => {
        if (s.id === id) {
          return { ...s, ...updated };
        }
        return s;
      });
      recalculateAllTerms(db);
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      db.shifts = db.shifts.filter((s) => s.id !== id);
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // MEMBERS CRUD
  app.post("/api/members", async (req, res) => {
    try {
      const { fullName, phone } = req.body;
      const db = await readDb();
      const newId = `member-${Date.now()}`;
      const newMember = {
        id: newId,
        fullName: (fullName || "").trim(),
        phone: (phone || "").trim(),
      };
      db.members.push(newMember);
      await writeDb(db);
      res.json({ db, newId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/members/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = req.body;
      const db = await readDb();
      db.members = db.members.map((m) => {
        if (m.id === id) {
          return { ...m, ...updated };
        }
        return m;
      });
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/members/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      db.members = db.members.filter((m) => m.id !== id);
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // TERMS CRUD
  app.post("/api/terms", async (req, res) => {
    try {
      const { memberId, shiftId, startDate, sessionsCount, deskType } = req.body;
      const db = await readDb();
      const newId = `term-${Date.now()}`;

      const shiftObj = db.shifts.find((s: any) => s.id === shiftId);
      if (!shiftObj) {
        return res.status(400).json({ error: "Shift not found" });
      }

      const sessionsCountVal = typeof sessionsCount === "number" ? sessionsCount : 12;
      const calc = calculateTermSessions(startDate, sessionsCountVal, shiftObj.weekDays, db.calendarOverrides);

      const newTerm = {
        id: newId,
        memberId,
        shiftId,
        startDate,
        endDate: calc.endDate,
        sessionsCount: sessionsCountVal,
        sessions: calc.sessions,
        deskType: deskType || "regular",
      };
      db.terms.push(newTerm);
      await writeDb(db);
      res.json({ db, newId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/terms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = req.body;
      const db = await readDb();
      db.terms = db.terms.map((t) => {
        if (t.id === id) {
          const merged = { ...t, ...updated };
          const shiftObj = db.shifts.find((s: any) => s.id === merged.shiftId);
          if (shiftObj) {
            const sessionsCountVal = typeof merged.sessionsCount === "number" ? merged.sessionsCount : 12;
            const calc = calculateTermSessions(merged.startDate, sessionsCountVal, shiftObj.weekDays, db.calendarOverrides);
            merged.sessions = calc.sessions;
            merged.endDate = calc.endDate;
            merged.sessionsCount = sessionsCountVal;
          }
          return merged;
        }
        return t;
      });
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/terms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      db.terms = db.terms.filter((t) => t.id !== id);
      // Clean up notes and attendance
      Object.keys(db.sessionNotes).forEach((key) => {
        if (key.startsWith(`${id}_`)) {
          delete db.sessionNotes[key];
        }
      });
      Object.keys(db.sessionAttendance).forEach((key) => {
        if (key.startsWith(`${id}_`)) {
          delete db.sessionAttendance[key];
        }
      });
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DAY STATUS OVERRIDES
  app.post("/api/overrides", async (req, res) => {
    try {
      const { dateStr } = req.body;
      const db = await readDb();
      const currentStatus = db.calendarOverrides[dateStr];
      if (!currentStatus) {
        db.calendarOverrides[dateStr] = "holiday";
      } else if (currentStatus === "holiday") {
        db.calendarOverrides[dateStr] = "working";
      } else {
        delete db.calendarOverrides[dateStr];
      }
      recalculateAllTerms(db);
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SESSION NOTES
  app.post("/api/notes", async (req, res) => {
    try {
      const { termId, dateStr, note } = req.body;
      const db = await readDb();
      const key = `${termId}_${dateStr}`;
      db.sessionNotes[key] = note;
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SESSION ATTENDANCE
  app.post("/api/attendance", async (req, res) => {
    try {
      const { termId, dateStr, status } = req.body;
      const db = await readDb();
      const key = `${termId}_${dateStr}`;
      db.sessionAttendance[key] = status;
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // WIPE ALL OPERATIONAL DATA
  app.post("/api/wipe", async (req, res) => {
    try {
      const db = await readDb();
      db.config = { totalRegularDesks: 20, totalPremiumDesks: 5 };
      db.shifts = [];
      db.members = [];
      db.terms = [];
      db.sessionNotes = {};
      db.sessionAttendance = {};
      db.calendarOverrides = {};
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // RESTORE BACKUP DATA
  app.post("/api/import", async (req, res) => {
    try {
      const { data } = req.body;
      const db = await readDb();
      if (data.config) db.config = data.config;
      if (data.shifts) db.shifts = data.shifts;
      if (data.members) db.members = data.members;
      if (data.terms) db.terms = data.terms;
      if (data.notes) db.sessionNotes = data.notes;
      if (data.attendance) db.sessionAttendance = data.attendance;
      if (data.overrides) db.calendarOverrides = data.overrides;
      await writeDb(db);
      res.json(db);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development vs static asset serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
