import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "lina_memory.json");

export interface MemoryItem {
  id: string;
  category: "preference" | "project" | "fact" | "task_history" | "conversation_summary";
  key: string;
  value: string;
  confidence: number;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  agent: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  logs: string[];
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  requiredPermissions: string[];
  code: string;
  testStatus: "passed" | "untested" | "failed";
  enabled: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  level: "low" | "medium" | "high";
  agent: string;
  details: string;
  status: "allowed" | "denied" | "executed";
}

interface DBState {
  memories: MemoryItem[];
  tasks: TaskRecord[];
  skills: SkillManifest[];
  auditLogs: AuditLog[];
  settings: {
    language: string;
    voice: string;
    model: string;
    particleDensity: "low" | "medium" | "high";
    proactivity: "low" | "balanced" | "high";
    bargeInEnabled: boolean;
  };
}

const DEFAULT_STATE: DBState = {
  memories: [
    {
      id: "mem_pref_1",
      category: "preference",
      key: "preferred_language",
      value: "Hinglish (warm, conversational Hindi + English)",
      confidence: 1.0,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "mem_pref_2",
      category: "preference",
      key: "assistant_tone",
      value: "Loving, respectful, proactive, natural conversational companion",
      confidence: 1.0,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "mem_proj_1",
      category: "project",
      key: "current_focus",
      value: "Full-stack development, automation & daily scheduling",
      confidence: 0.95,
      updatedAt: new Date().toISOString(),
    },
  ],
  tasks: [],
  skills: [
    {
      id: "skill_excel_calc",
      name: "excel_summary_calculator",
      description: "Extract and summarize total revenue, sales, and column metrics from spreadsheets or CSV data",
      version: "1.0.0",
      inputSchema: { type: "object", properties: { data: { type: "string" }, column: { type: "string" } } },
      outputSchema: { type: "object", properties: { sum: { type: "number" }, average: { type: "number" } } },
      requiredPermissions: ["filesystem_read"],
      code: "function summarize(data, col) { return { total: 0, count: 0 }; }",
      testStatus: "passed",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ],
  auditLogs: [],
  settings: {
    language: "Hinglish",
    voice: "Aoede",
    model: "gemini-2.5-flash",
    particleDensity: "medium",
    proactivity: "balanced",
    bargeInEnabled: true,
  },
};

function loadDB(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error("Error reading database, using defaults:", err);
  }
  return DEFAULT_STATE;
}

function saveDB(state: DBState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving database:", err);
  }
}

let dbState: DBState = loadDB();

export const db = {
  getMemories: () => dbState.memories,
  addMemory: (category: MemoryItem["category"], key: string, value: string, confidence = 0.9) => {
    const existingIndex = dbState.memories.findIndex((m) => m.key.toLowerCase() === key.toLowerCase());
    const item: MemoryItem = {
      id: "mem_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      category,
      key,
      value,
      confidence,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      dbState.memories[existingIndex] = item;
    } else {
      dbState.memories.push(item);
    }
    saveDB(dbState);
    return item;
  },
  deleteMemory: (id: string) => {
    dbState.memories = dbState.memories.filter((m) => m.id !== id);
    saveDB(dbState);
  },
  clearMemories: () => {
    dbState.memories = [];
    saveDB(dbState);
  },

  getTasks: () => dbState.tasks,
  createTask: (title: string, agent: string): TaskRecord => {
    const task: TaskRecord = {
      id: "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      title,
      agent,
      status: "running",
      progress: 10,
      logs: [`[${new Date().toLocaleTimeString()}] Task initiated by ${agent}`],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dbState.tasks.unshift(task);
    // keep max 50 recent tasks
    if (dbState.tasks.length > 50) dbState.tasks = dbState.tasks.slice(0, 50);
    saveDB(dbState);
    return task;
  },
  updateTask: (id: string, updates: Partial<TaskRecord>) => {
    const task = dbState.tasks.find((t) => t.id === id);
    if (task) {
      Object.assign(task, updates);
      task.updatedAt = new Date().toISOString();
      saveDB(dbState);
    }
    return task;
  },
  appendTaskLog: (id: string, log: string, progress?: number) => {
    const task = dbState.tasks.find((t) => t.id === id);
    if (task) {
      task.logs.push(`[${new Date().toLocaleTimeString()}] ${log}`);
      if (progress !== undefined) task.progress = progress;
      task.updatedAt = new Date().toISOString();
      saveDB(dbState);
    }
  },
  cancelTask: (id: string) => {
    const task = dbState.tasks.find((t) => t.id === id);
    if (task && (task.status === "running" || task.status === "pending")) {
      task.status = "cancelled";
      task.logs.push(`[${new Date().toLocaleTimeString()}] Task cancelled by user.`);
      task.updatedAt = new Date().toISOString();
      saveDB(dbState);
    }
    return task;
  },
  stopAllTasks: () => {
    let stopped = 0;
    for (const t of dbState.tasks) {
      if (t.status === "running" || t.status === "pending") {
        t.status = "cancelled";
        t.logs.push(`[${new Date().toLocaleTimeString()}] Emergency stop triggered.`);
        t.updatedAt = new Date().toISOString();
        stopped++;
      }
    }
    saveDB(dbState);
    return stopped;
  },

  getSkills: () => dbState.skills,
  registerSkill: (skill: Omit<SkillManifest, "id" | "createdAt">): SkillManifest => {
    const newSkill: SkillManifest = {
      ...skill,
      id: "skill_" + Date.now(),
      createdAt: new Date().toISOString(),
    };
    dbState.skills.push(newSkill);
    saveDB(dbState);
    return newSkill;
  },
  toggleSkill: (id: string, enabled: boolean) => {
    const s = dbState.skills.find((x) => x.id === id);
    if (s) {
      s.enabled = enabled;
      saveDB(dbState);
    }
  },

  getAuditLogs: () => dbState.auditLogs,
  addAuditLog: (action: string, agent: string, level: AuditLog["level"], details: string, status: AuditLog["status"] = "executed") => {
    const log: AuditLog = {
      id: "log_" + Date.now(),
      timestamp: new Date().toISOString(),
      action,
      agent,
      level,
      details,
      status,
    };
    dbState.auditLogs.unshift(log);
    if (dbState.auditLogs.length > 100) dbState.auditLogs = dbState.auditLogs.slice(0, 100);
    saveDB(dbState);
    return log;
  },

  getSettings: () => dbState.settings,
  updateSettings: (updates: Partial<DBState["settings"]>) => {
    Object.assign(dbState.settings, updates);
    saveDB(dbState);
    return dbState.settings;
  },
};
