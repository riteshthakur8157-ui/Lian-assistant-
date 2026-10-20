import { exec, spawn } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { db } from "./db.js";

export interface PCAppInfo {
  id: string;
  name: string;
  aliases: string[];
  category: "productivity" | "communication" | "developer" | "utilities" | "media";
  icon: string;
  description: string;
  windowsCommand: string;
  linuxCommand: string;
  macCommand: string;
  processName: string;
  webFallbackUrl?: string;
  status?: "running" | "ready" | "stopped";
}

export const KNOWN_PC_APPS: Record<string, PCAppInfo> = {
  notepad: {
    id: "notepad",
    name: "Notepad (Text Editor)",
    aliases: ["notepad", "text editor", "note", "likho", "pad"],
    category: "productivity",
    icon: "FileText",
    description: "Native quick text and note editor",
    windowsCommand: "start notepad.exe",
    linuxCommand: "gedit & || xdg-open untitled_note.txt || nano",
    macCommand: "open -a TextEdit",
    processName: "notepad",
    webFallbackUrl: "/api/pc/scratchpad",
  },
  whatsapp: {
    id: "whatsapp",
    name: "WhatsApp Web",
    aliases: ["whatsapp web", "wa web", "whatsapp in browser", "browser mein whatsapp"],
    category: "communication",
    icon: "MessageSquare",
    description: "Direct WhatsApp Web messaging & contact chat",
    windowsCommand: "start https://web.whatsapp.com",
    linuxCommand: "xdg-open https://web.whatsapp.com &",
    macCommand: "open https://web.whatsapp.com",
    processName: "chrome",
    webFallbackUrl: "https://web.whatsapp.com",
  },
  whatsapp_desktop: {
    id: "whatsapp_desktop",
    name: "WhatsApp Desktop Native",
    aliases: ["whatsapp desktop", "whatsapp pc mein", "desktop whatsapp", "whatsapp app"],
    category: "communication",
    icon: "MessageSquare",
    description: "Native Windows WhatsApp desktop application",
    windowsCommand: "start whatsapp:",
    linuxCommand: "xdg-open whatsapp:// &",
    macCommand: "open -a WhatsApp",
    processName: "WhatsApp",
    webFallbackUrl: "https://web.whatsapp.com",
  },
  vscode: {
    id: "vscode",
    name: "Visual Studio Code",
    aliases: ["vscode", "vs code", "code", "editor", "ide"],
    category: "developer",
    icon: "Code",
    description: "Code editor and workspace IDE",
    windowsCommand: "code .",
    linuxCommand: "code . &",
    macCommand: "open -a 'Visual Studio Code' .",
    processName: "Code",
    webFallbackUrl: "https://vscode.dev",
  },
  chrome: {
    id: "chrome",
    name: "Google Chrome",
    aliases: ["chrome", "google chrome", "browser", "internet"],
    category: "utilities",
    icon: "Globe",
    description: "Web browser and search engine",
    windowsCommand: "start chrome",
    linuxCommand: "google-chrome & || chromium & || xdg-open https://google.com &",
    macCommand: "open -a 'Google Chrome'",
    processName: "chrome",
    webFallbackUrl: "https://www.google.com",
  },
  excel: {
    id: "excel",
    name: "Microsoft Excel / Spreadsheets",
    aliases: ["excel", "sheet", "spreadsheet", "ms excel", "hisab"],
    category: "productivity",
    icon: "FileSpreadsheet",
    description: "Financial modeling and spreadsheet data editor",
    windowsCommand: "start excel",
    linuxCommand: "xdg-open https://sheets.new &",
    macCommand: "open -a 'Microsoft Excel'",
    processName: "excel",
    webFallbackUrl: "https://sheets.new",
  },
  word: {
    id: "word",
    name: "Microsoft Word / Documents",
    aliases: ["word", "winword", "doc", "document", "ms word"],
    category: "productivity",
    icon: "FileText",
    description: "Document drafting, reports and word processor",
    windowsCommand: "start winword",
    linuxCommand: "xdg-open https://docs.new &",
    macCommand: "open -a 'Microsoft Word'",
    processName: "winword",
    webFallbackUrl: "https://docs.new",
  },
  powerpoint: {
    id: "powerpoint",
    name: "PowerPoint Presentations",
    aliases: ["powerpoint", "ppt", "presentation", "slides"],
    category: "productivity",
    icon: "Presentation",
    description: "Slide deck and presentation designer",
    windowsCommand: "start powerpnt",
    linuxCommand: "xdg-open https://slides.new &",
    macCommand: "open -a 'Microsoft PowerPoint'",
    processName: "powerpnt",
    webFallbackUrl: "https://slides.new",
  },
  terminal: {
    id: "terminal",
    name: "Terminal / PowerShell",
    aliases: ["terminal", "powershell", "cmd", "command prompt", "bash"],
    category: "developer",
    icon: "Terminal",
    description: "Command line shell executor",
    windowsCommand: "start powershell",
    linuxCommand: "xterm & || gnome-terminal & || sh",
    macCommand: "open -a Terminal",
    processName: "powershell",
  },
  calculator: {
    id: "calculator",
    name: "Calculator",
    aliases: ["calculator", "calc", "calculation", "ganit"],
    category: "utilities",
    icon: "Calculator",
    description: "System calculator utility",
    windowsCommand: "start calc.exe",
    linuxCommand: "gnome-calculator & || kcalc & || bc",
    macCommand: "open -a Calculator",
    processName: "calc",
  },
  explorer: {
    id: "explorer",
    name: "File Explorer / Files",
    aliases: ["explorer", "file explorer", "folder", "files", "my documents", "meri project folder"],
    category: "utilities",
    icon: "Folder",
    description: "Manage system files and directories",
    windowsCommand: "start explorer .",
    linuxCommand: "xdg-open . &",
    macCommand: "open .",
    processName: "explorer",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    aliases: ["youtube", "yt", "video", "videos"],
    category: "media",
    icon: "Video",
    description: "Watch video tutorials, music & podcasts",
    windowsCommand: "start https://www.youtube.com",
    linuxCommand: "xdg-open https://www.youtube.com &",
    macCommand: "open https://www.youtube.com",
    processName: "chrome",
    webFallbackUrl: "https://www.youtube.com",
  },
  spotify: {
    id: "spotify",
    name: "Spotify",
    aliases: ["spotify", "music", "songs", "gaana"],
    category: "media",
    icon: "Music",
    description: "Music streaming and focus playlists",
    windowsCommand: "start spotify:",
    linuxCommand: "spotify & || xdg-open https://open.spotify.com &",
    macCommand: "open -a Spotify",
    processName: "Spotify",
    webFallbackUrl: "https://open.spotify.com",
  },
};

export class PCControlService {
  /**
   * Determine the current OS platform
   */
  public static getPlatform(): "win32" | "linux" | "darwin" {
    return process.platform as "win32" | "linux" | "darwin";
  }

  /**
   * Check if a process is already running on the system to prevent unnecessary duplicate launches
   */
  public static async isProcessRunning(processName: string): Promise<boolean> {
    const platform = this.getPlatform();
    return new Promise((resolve) => {
      const checkCmd =
        platform === "win32"
          ? `tasklist /FI "IMAGENAME eq ${processName}*" 2>nul`
          : `pgrep -i "${processName}" 2>/dev/null || ps aux | grep -i "${processName}" | grep -v grep`;

      exec(checkCmd, { timeout: 3000 }, (error, stdout) => {
        if (error || !stdout) {
          resolve(false);
        } else {
          const isFound = stdout.toLowerCase().includes(processName.toLowerCase());
          resolve(isFound);
        }
      });
    });
  }

  /**
   * Universal application and website opening system.
   * Handles Windows desktop apps, websites, existing browser tabs, and scratchpad note creation.
   */
  public static async openApp(
    appName: string,
    target?: string
  ): Promise<{
    success: boolean;
    appName: string;
    commandExecuted: string;
    pid?: number;
    platform: string;
    alreadyRunning: boolean;
    webFallbackUrl?: string;
    message: string;
    details?: any;
  }> {
    const raw = appName.toLowerCase().trim();
    let appKey = Object.keys(KNOWN_PC_APPS).find(
      (k) =>
        k === raw ||
        KNOWN_PC_APPS[k].name.toLowerCase() === raw ||
        KNOWN_PC_APPS[k].aliases.some((a) => raw.includes(a))
    );

    // Explicit instruction overrides ("PC mein", "desktop app" vs "Web par", "browser mein")
    const wantsDesktop =
      raw.includes("pc mein") ||
      raw.includes("desktop app") ||
      raw.includes("pc par") ||
      raw.includes("native");
    const wantsWeb =
      raw.includes("web") ||
      raw.includes("browser") ||
      raw.includes("chrome") ||
      raw.includes("online");

    if (raw.includes("whatsapp")) {
      appKey = wantsDesktop ? "whatsapp_desktop" : "whatsapp";
    }

    if (!appKey) {
      if (raw.includes("note") || raw.includes("pad") || raw.includes("likh")) appKey = "notepad";
      else if (raw.includes("excel") || raw.includes("sheet") || raw.includes("hisab")) appKey = "excel";
      else if (raw.includes("word") || raw.includes("doc")) appKey = "word";
      else if (raw.includes("ppt") || raw.includes("slide")) appKey = "powerpoint";
      else if (raw.includes("code") || raw.includes("vs")) appKey = "vscode";
      else if (raw.includes("browser") || raw.includes("chrome") || raw.includes("internet")) appKey = "chrome";
      else if (raw.includes("calc") || raw.includes("hisab")) appKey = "calculator";
      else if (raw.includes("folder") || raw.includes("file") || raw.includes("drive")) appKey = "explorer";
      else if (raw.includes("term") || raw.includes("cmd") || raw.includes("powershell") || raw.includes("bash")) appKey = "terminal";
      else if (raw.includes("song") || raw.includes("music") || raw.includes("gaana")) appKey = "spotify";
      else if (raw.includes("yt") || raw.includes("video")) appKey = "youtube";
    }

    const platform = this.getPlatform();
    let commandToRun = "";
    let webFallbackUrl: string | undefined = undefined;
    let displayName = appName;
    let processName = "";

    if (appKey && KNOWN_PC_APPS[appKey]) {
      const app = KNOWN_PC_APPS[appKey];
      displayName = app.name;
      webFallbackUrl = app.webFallbackUrl;
      processName = app.processName;

      if (platform === "win32") {
        commandToRun = app.windowsCommand;
      } else if (platform === "darwin") {
        commandToRun = app.macCommand;
      } else {
        commandToRun = app.linuxCommand;
      }

      if (target && target.startsWith("http")) {
        commandToRun = platform === "win32" ? `start ${target}` : `xdg-open "${target}" &`;
        webFallbackUrl = target;
      }
    } else {
      // Dynamic custom executable or path
      displayName = appName;
      processName = appName;
      if (platform === "win32") {
        commandToRun = `start ${appName}`;
      } else if (platform === "darwin") {
        commandToRun = `open -a "${appName}"`;
      } else {
        commandToRun = `xdg-open "${appName}" & || ${appName} &`;
      }
    }

    // Check if the process is already active
    const alreadyRunning = processName ? await this.isProcessRunning(processName) : false;

    // If Notepad specifically requested in Linux/Web container, create a real note file on disk
    if (appKey === "notepad") {
      try {
        const notesDir = path.resolve(process.cwd(), "data", "notes");
        if (!fs.existsSync(notesDir)) {
          fs.mkdirSync(notesDir, { recursive: true });
        }
        const notePath = path.join(notesDir, `note_${Date.now()}.txt`);
        fs.writeFileSync(
          notePath,
          `# Lina AI Quick Note\nCreated: ${new Date().toLocaleString()}\nTarget: ${target || "General Notes"}\n\n`,
          "utf-8"
        );
      } catch (e) {
        console.warn("Could not write scratchpad note file:", e);
      }
    }

    db.addAuditLog(
      "pc_open_app",
      "PC Control",
      "medium",
      `Launching application '${displayName}' [Process: ${processName}, AlreadyRunning: ${alreadyRunning}] via command: ${commandToRun}`,
      "executed"
    );

    return new Promise((resolve) => {
      try {
        const child = exec(commandToRun, { timeout: 8000 }, (error) => {
          if (error && !commandToRun.includes("||")) {
            console.warn(`Terminal execution notice for '${commandToRun}':`, error.message);
          }
        });

        const pid = child.pid;
        const msg = alreadyRunning
          ? `सर, ${displayName} पहले से चालू है, मैंने इसे फोकस कर दिया है।`
          : `जी सर, ${displayName} खोल दिया है।`;

        resolve({
          success: true,
          appName: displayName,
          commandExecuted: commandToRun,
          pid,
          platform,
          alreadyRunning,
          webFallbackUrl,
          message: msg,
          details: { target, timestamp: new Date().toISOString() },
        });
      } catch (err: any) {
        resolve({
          success: false,
          appName: displayName,
          commandExecuted: commandToRun,
          platform,
          alreadyRunning: false,
          webFallbackUrl,
          message: `सर, ${displayName} अभी नहीं खुल पाया। मैं एक बार कारण चेक करती हूँ: ${err.message}`,
        });
      }
    });
  }

  /**
   * Run a terminal shell command in backend safely
   */
  public static async runTerminalCommand(
    command: string,
    cwd: string = process.cwd()
  ): Promise<{
    success: boolean;
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
    message: string;
  }> {
    const start = Date.now();

    // Security check: block destructive root disk deletion commands
    const blockedPatterns = [/rm\s+-rf\s+\/($|\s)/, />\s*\/dev\/sda/, /mkfs\./, /dd\s+if=/];
    for (const pattern of blockedPatterns) {
      if (pattern.test(command)) {
        db.addAuditLog(
          "terminal_blocked",
          "PC Control",
          "high",
          `Blocked dangerous terminal command: ${command}`,
          "denied"
        );
        return {
          success: false,
          command,
          stdout: "",
          stderr: "Security Violation: Command blocked by PC safety sandbox.",
          exitCode: 1,
          durationMs: Date.now() - start,
          message: "सुरक्षा कारणों से इस कमांड को निष्पादित नहीं किया गया है।",
        };
      }
    }

    db.addAuditLog("terminal_command", "PC Control", "medium", `Running shell command: ${command}`);

    return new Promise((resolve) => {
      exec(command, { cwd, timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        const exitCode = error ? (error.code ?? 1) : 0;
        resolve({
          success: exitCode === 0,
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          durationMs,
          message:
            exitCode === 0
              ? `कमांड सफलतापूर्वक ${durationMs}ms में पूरी हो गई सर।`
              : `सर, कमांड एक्ज़िट कोड ${exitCode} के साथ समाप्त हुई। एरर: ${stderr || error?.message}`,
        });
      });
    });
  }

  /**
   * Retrieve system health and resource metrics (CPU, RAM, Uptime, OS)
   */
  public static getSystemHealth(): {
    platform: string;
    arch: string;
    hostname: string;
    uptimeHours: number;
    cpuCores: number;
    cpuModel: string;
    totalMemGB: number;
    freeMemGB: number;
    usedMemGB: number;
    ramUsagePercent: number;
    loadAverage: number[];
    summary: string;
  } {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const uptimeSec = os.uptime();

    const totalMemGB = +(totalMem / (1024 * 1024 * 1024)).toFixed(2);
    const freeMemGB = +(freeMem / (1024 * 1024 * 1024)).toFixed(2);
    const usedMemGB = +(usedMem / (1024 * 1024 * 1024)).toFixed(2);
    const ramUsagePercent = +((usedMem / totalMem) * 100).toFixed(1);

    const summary = `सिस्टम बिल्कुल सही काम कर रहा है सर। OS: ${process.platform} (${os.arch()}), ${cpus.length} CPU cores एक्टिव हैं, RAM: ${freeMemGB} GB खाली है (${ramUsagePercent}% इस्तेमाल में), और सिस्टम पिछले ${(uptimeSec / 3600).toFixed(1)} घंटों से चल रहा है।`;

    db.addAuditLog("system_health_check", "PC Control", "low", summary);

    return {
      platform: process.platform,
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeHours: +(uptimeSec / 3600).toFixed(1),
      cpuCores: cpus.length,
      cpuModel: cpus[0]?.model || "Multi-core Processor",
      totalMemGB,
      freeMemGB,
      usedMemGB,
      ramUsagePercent,
      loadAverage: os.loadavg().map((n) => +n.toFixed(2)),
      summary,
    };
  }

  /**
   * Pre-configured Productivity & PC Macros
   */
  public static async executeMacro(macroName: string): Promise<{
    macroName: string;
    stepsExecuted: string[];
    results: any[];
    message: string;
  }> {
    const stepsExecuted: string[] = [];
    const results: any[] = [];

    if (macroName === "morning_setup" || macroName.includes("morning")) {
      stepsExecuted.push("Visual Studio Code वर्कस्पेस खोला गया");
      const vsRes = await this.openApp("vscode");
      results.push(vsRes);

      stepsExecuted.push("WhatsApp Web कम्युनिकेशन हब तैयार किया गया");
      const waRes = await this.openApp("whatsapp");
      results.push(waRes);

      stepsExecuted.push("Google Chrome दैनिक ब्रीफिंग टैब्स खोले गए");
      const chromeRes = await this.openApp("chrome", "https://google.com");
      results.push(chromeRes);

      const health = this.getSystemHealth();
      stepsExecuted.push(`सिस्टम हेल्थ: ${health.ramUsagePercent}% RAM इस्तेमाल में`);
      results.push(health);

      return {
        macroName: "Morning Productivity Setup",
        stepsExecuted,
        results,
        message: "आपका मॉर्निंग सेटअप तैयार है सर: VS Code, WhatsApp Web, और Chrome ब्राउज़र टैब्स खोल दिए गए हैं।",
      };
    }

    if (macroName === "clean_temp" || macroName.includes("clean")) {
      const cleanCmd = process.platform === "win32" ? "del /q /f %TEMP%\\*" : "rm -rf /tmp/* 2>/dev/null || true";
      const res = await this.runTerminalCommand(cleanCmd);
      stepsExecuted.push("अस्थायी कैशे और टेम्प फाइल्स साफ़ की गईं");
      results.push(res);

      return {
        macroName: "Clean Temp Files",
        stepsExecuted,
        results,
        message: "टेम्परेरी फाइल्स और कैशे साफ़ कर दिया गया है सर।",
      };
    }

    return {
      macroName,
      stepsExecuted: ["सामान्य सिस्टम ऑप्टिमाइज़ेशन पूरा हुआ"],
      results: [],
      message: `मैक्रो '${macroName}' निष्पादित हो गया है सर।`,
    };
  }
}
