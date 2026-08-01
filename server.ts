import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import { calculateTermSessions, calculateTermSessionsWithHistory, getTodayJalali } from "./src/utils/jalali";

let DB_DIR = path.join(process.cwd(), "my");
let DB_PATH = path.join(DB_DIR, "database.json");
let dirSource = "fallback_local";

let serverVersion = "dev";

async function detectVersion() {
  try {
    const distIndexPath = path.join(process.cwd(), "dist", "index.html");
    const stats = await fs.stat(distIndexPath);
    serverVersion = `prod-${stats.mtime.getTime()}`;
    console.log(`Detected production version from dist/index.html mtime: ${serverVersion}`);
  } catch (err) {
    serverVersion = `dev-${Date.now()}`;
    console.log(`Fallback version generated for development: ${serverVersion}`);
  }
}

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
  config: { 
    totalRegularDesks: number; 
    totalPremiumDesks: number;
    academyName?: string;
    academyPhone?: string;
    academyAddress?: string;
    academyLogo?: string;
  };
  shifts: any[];
  members: any[];
  terms: any[];
  sessionNotes: Record<string, string>;
  sessionAttendance: Record<string, string>;
  calendarOverrides: Record<string, "holiday" | "working">;
}

function recalculateAllTerms(db: DbState) {
  if (!db.terms || !Array.isArray(db.terms)) return;
  const todayDate = getTodayJalali();
  db.terms = db.terms.map((t) => {
    const shift = db.shifts.find((s) => s.id === t.shiftId);
    if (!shift) return t;
    const calc = calculateTermSessionsWithHistory(
      t,
      shift.weekDays,
      db.calendarOverrides,
      todayDate,
      db.sessionAttendance
    );
    return {
      ...t,
      sessions: calc.sessions,
      endDate: calc.endDate,
    };
  });
}

function migrateAndNormalizeState(input: any): DbState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_DB };
  }

  const config = input.config || {};
  const rawShifts = Array.isArray(input.shifts) ? input.shifts : [];
  const rawMembers = Array.isArray(input.members) ? input.members : [];
  const rawTerms = Array.isArray(input.terms) ? input.terms : [];
  
  // Resolve legacy key variations gracefully (e.g. notes -> sessionNotes, overrides -> calendarOverrides)
  let rawNotes = input.sessionNotes || input.notes || {};
  let rawAttendance = input.sessionAttendance || input.attendance || {};
  let rawOverrides = input.calendarOverrides || input.overrides || {};

  if (typeof rawNotes !== "object" || rawNotes === null) rawNotes = {};
  if (typeof rawAttendance !== "object" || rawAttendance === null) rawAttendance = {};
  if (typeof rawOverrides !== "object" || rawOverrides === null) rawOverrides = {};

  // Standardize configuration
  const normalizedConfig = {
    totalRegularDesks: typeof config.totalRegularDesks === "number" 
      ? config.totalRegularDesks 
      : (typeof config.totalDesks === "number" ? config.totalDesks : 20),
    totalPremiumDesks: typeof config.totalPremiumDesks === "number" 
      ? config.totalPremiumDesks 
      : 5,
    academyName: typeof config.academyName === "string" ? config.academyName : "آموزشگاه پرستو",
    academyPhone: typeof config.academyPhone === "string" ? config.academyPhone : "",
    academyAddress: typeof config.academyAddress === "string" ? config.academyAddress : "",
    academyLogo: typeof config.academyLogo === "string" ? config.academyLogo : "",
  };

  // Standardize shifts mapping any legacy key/values
  const normalizedShifts = rawShifts.map((s: any) => {
    if (!s || typeof s !== "object") return null;
    return {
      id: s.id || `shift-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: (s.name || s.title || "").trim(),
      weekDays: Array.isArray(s.weekDays) ? s.weekDays : (Array.isArray(s.days) ? s.days : []),
      totalRegular: typeof s.totalRegular === "number" ? s.totalRegular : (typeof s.regularSeats === "number" ? s.regularSeats : 20),
      totalPremium: typeof s.totalPremium === "number" ? s.totalPremium : (typeof s.premiumSeats === "number" ? s.premiumSeats : 5)
    };
  }).filter(Boolean);

  // Standardize members mapping legacy keys like 'name' to 'fullName'
  const normalizedMembers = rawMembers.map((m: any) => {
    if (!m || typeof m !== "object") return null;
    return {
      id: m.id || `member-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      fullName: (m.fullName || m.name || "").trim(),
      phone: (m.phone || m.mobile || m.phoneNumber || "").trim()
    };
  }).filter(Boolean);

  // Standardize calendar overrides
  const normalizedOverrides: Record<string, "holiday" | "working"> = {};
  for (const [key, val] of Object.entries(rawOverrides)) {
    if (val === "holiday" || val === "working") {
      normalizedOverrides[key] = val;
    }
  }

  // Standardize subscription terms
  const normalizedTerms = rawTerms.map((t: any) => {
    if (!t || typeof t !== "object") return null;
    return {
      id: t.id || `term-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      memberId: t.memberId || "",
      shiftId: t.shiftId || "",
      startDate: t.startDate || "",
      endDate: t.endDate || "",
      sessionsCount: typeof t.sessionsCount === "number" ? t.sessionsCount : 12,
      sessions: Array.isArray(t.sessions) ? t.sessions : [],
      deskType: t.deskType || "regular"
    };
  }).filter(Boolean);

  // Strip non-string or unneeded overhead properties from session details
  const cleanNotes: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawNotes)) {
    if (typeof value === "string") {
      cleanNotes[key] = value;
    }
  }

  const cleanAttendance: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawAttendance)) {
    if (typeof value === "string") {
      cleanAttendance[key] = value;
    }
  }

  const cleanState: DbState = {
    version: typeof input.version === "number" ? input.version : 1,
    config: normalizedConfig,
    shifts: normalizedShifts,
    members: normalizedMembers,
    terms: normalizedTerms,
    sessionNotes: cleanNotes,
    sessionAttendance: cleanAttendance,
    calendarOverrides: normalizedOverrides
  };

  // Dynamically recalculate all terms sessions & end dates on-the-fly to keep data aligned
  recalculateAllTerms(cleanState);

  return cleanState;
}

const DEFAULT_DB: DbState = {
  version: 1,
  config: { 
    totalRegularDesks: 20, 
    totalPremiumDesks: 5,
    academyName: "آموزشگاه پرستو",
    academyPhone: "",
    academyAddress: "",
    academyLogo: ""
  },
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
      const parsed = JSON.parse(data);
      const migrated = migrateAndNormalizeState(parsed);
      return migrated;
    } catch {
      const defaultState = migrateAndNormalizeState(DEFAULT_DB);
      await fs.writeFile(DB_PATH, JSON.stringify(defaultState, null, 2), "utf-8");
      return defaultState;
    }
  });
}

async function writeDb(state: DbState): Promise<DbState> {
  return dbQueue.run(async () => {
    state.version = (state.version || 0) + 1;
    // Strip unnecessary fields and overhead before saving to disk
    const cleanState = migrateAndNormalizeState(state);
    cleanState.version = state.version;

    try {
      await fs.mkdir(DB_DIR, { recursive: true });
    } catch (e) {}
    await fs.writeFile(DB_PATH, JSON.stringify(cleanState, null, 2), "utf-8");
    return cleanState;
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Detect and set server build/static version
  await detectVersion();

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

  // Version check API route
  app.get("/api/version", (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.json({ version: serverVersion });
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
      const { id, name, weekDays, totalRegular, totalPremium } = req.body;
      const db = await readDb();
      const newShift = {
        id: id || `shift-${Date.now()}`,
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
      const { id, fullName, phone } = req.body;
      const db = await readDb();
      const newId = id || `member-${Date.now()}`;
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
      const { id, memberId, shiftId, startDate, sessionsCount, deskType } = req.body;
      const db = await readDb();
      const newId = id || `term-${Date.now()}`;

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
            const calc = calculateTermSessionsWithHistory(
              merged,
              shiftObj.weekDays,
              db.calendarOverrides,
              getTodayJalali(),
              db.sessionAttendance
            );
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
      
      // Fully migrate and normalize incoming backup to ensure 100% future-proof compatibility
      const migratedDb = migrateAndNormalizeState(data);
      
      // Preserve and increment the database version safely
      const currentDb = await readDb().catch(() => ({ version: 0 }));
      migratedDb.version = (currentDb.version || 0) + 1;

      await writeDb(migratedDb);
      res.json(migratedDb);
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
    
    // Serve static files with custom Cache-Control headers based on file type
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const fileName = path.basename(filePath);
        if (fileName === "sw.js" || fileName === "service-worker.js" || filePath.endsWith(".html") || fileName === "manifest.json") {
          // CRITICAL: Never cache service worker, HTML files, or manifest to guarantee immediate updates
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        } else {
          // Cache immutable Vite-hashed assets (JS, CSS, images, etc.) for up to 1 year
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));

    app.get('*', (req, res) => {
      // Never cache the index.html fallback for client-side routing
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
