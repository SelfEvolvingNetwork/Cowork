import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import { calculateTermSessions } from "./src/utils/jalali";

let DB_DIR = path.join(process.cwd(), "my");
let DB_PATH = path.join(DB_DIR, "database.json");
let dirSource = "fallback_local";

async function initDbDirectory() {
  const envPath = process.env.UPLOAD_PATH;
  if (envPath) {
    try {
      await fs.mkdir(envPath, { recursive: true });
      const testFile = path.join(envPath, ".test-write");
      await fs.writeFile(testFile, "test", "utf-8");
      await fs.unlink(testFile);
      DB_DIR = envPath;
      dirSource = "env";
      console.log(`Successfully verified and initialized storage at UPLOAD_PATH: ${DB_DIR}`);
    } catch (err) {
      console.error(`Warning: UPLOAD_PATH (${envPath}) is not writable. Falling back to local folder.`, err);
      DB_DIR = path.join(process.cwd(), "my");
      dirSource = "fallback_local";
    }
  } else {
    try {
      await fs.mkdir("/my", { recursive: true });
      const testFile = path.join("/my", ".test-write");
      await fs.writeFile(testFile, "test", "utf-8");
      await fs.unlink(testFile);
      DB_DIR = "/my";
      dirSource = "default";
      console.log(`Successfully verified and initialized storage at default /my: ${DB_DIR}`);
    } catch (err) {
      console.warn(`Warning: Default path /my is not writable. Falling back to local project folder ./my.`);
      DB_DIR = path.join(process.cwd(), "my");
      dirSource = "fallback_local";
    }
  }
  DB_PATH = path.join(DB_DIR, "database.json");
}

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
      await fs.mkdir(DB_DIR, { recursive: true });
    } catch (e) {}
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
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
    } catch (e) {}
    await fs.writeFile(DB_PATH, JSON.stringify(state, null, 2), "utf-8");
    return state;
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Resolve and verify the secure storage directory
  await initDbDirectory();

  // Pre-create the persistent DB directory
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    console.log(`Directory ${DB_DIR} verified/created.`);
  } catch (err) {
    console.error(`Warning: Failed to create DB_DIR: ${DB_DIR}`, err);
  }

  app.use(express.json({ limit: "10mb" }));

  // Health check API route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "coworking-manager" });
  });

  // Secure folder status check API route
  app.get("/api/secure-folder-status", async (req, res) => {
    try {
      const testFileName = `write-test-${Date.now()}.tmp`;
      const testFilePath = path.join(DB_DIR, testFileName);
      const testContent = "Runflare secure folder connection test string";
      
      let canWrite = false;
      let canRead = false;
      let canDelete = false;
      let writeError = null;
      let readError = null;
      let deleteError = null;

      // 1. Create directory if not exists
      try {
        await fs.mkdir(DB_DIR, { recursive: true });
      } catch (err: any) {
        writeError = `Failed to create/verify directory: ${err.message}`;
      }

      if (!writeError) {
        // 2. Try writing
        try {
          await fs.writeFile(testFilePath, testContent, "utf-8");
          canWrite = true;
        } catch (err: any) {
          writeError = err.message;
        }

        // 3. Try reading if wrote successfully
        if (canWrite) {
          try {
            const content = await fs.readFile(testFilePath, "utf-8");
            canRead = content === testContent;
            if (!canRead) {
              readError = "Read content did not match written content";
            }
          } catch (err: any) {
            readError = err.message;
          }

          // 4. Try deleting
          try {
            await fs.unlink(testFilePath);
            canDelete = true;
          } catch (err: any) {
            deleteError = err.message;
          }
        }
      }

      const overallSuccess = canWrite && canRead && canDelete;

      res.json({
        status: overallSuccess ? "ok" : "error",
        diskPath: DB_DIR,
        source: dirSource,
        testResult: {
          write: canWrite ? "success" : "failed",
          read: canRead ? "success" : "failed",
          delete: canDelete ? "success" : "failed",
          errors: {
            write: writeError,
            read: readError,
            delete: deleteError
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({
        status: "error",
        diskPath: DB_DIR,
        source: dirSource,
        error: err.message
      });
    }
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
      if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "اطلاعات پشتیبان معتبر نمی‌باشد" });
      }
      const db = await readDb();
      if (data.config && typeof data.config === "object") db.config = { ...db.config, ...data.config };
      if (data.shifts && Array.isArray(data.shifts)) db.shifts = data.shifts;
      if (data.members && Array.isArray(data.members)) db.members = data.members;
      if (data.terms && Array.isArray(data.terms)) db.terms = data.terms;
      if (data.notes && typeof data.notes === "object") db.sessionNotes = data.notes;
      if (data.attendance && typeof data.attendance === "object") db.sessionAttendance = data.attendance;
      if (data.overrides && typeof data.overrides === "object") db.calendarOverrides = data.overrides;
      
      recalculateAllTerms(db);
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
