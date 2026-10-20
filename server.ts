import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./server/db.js";
import { processUserMessage } from "./server/agents/orchestrator.js";
import { VoiceService } from "./server/voice.js";
import { WhatsAppAgent, KNOWN_CONTACTS } from "./server/agents/whatsapp.js";
import { YouTubeAgent } from "./server/agents/youtube.js";
import { BrowserAgent } from "./server/agents/browser.js";
import { GitHubAgent } from "./server/agents/github.js";
import { SkillsAgent } from "./server/agents/skills.js";
import { AgentRegistry } from "./server/agents/factory/registry.js";
import { runAllTests } from "./server/agents/factory/tests.js";
import { PCControlService, KNOWN_PC_APPS } from "./server/pc_control.js";

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 1. WebSocket Server for real-time live voice and task stream
const wssLive = new WebSocketServer({ noServer: true });
const wssEvents = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/ws/live") {
    wssLive.handleUpgrade(request, socket, head, (ws) => {
      wssLive.emit("connection", ws, request);
    });
  } else if (pathname === "/ws/events") {
    wssEvents.handleUpgrade(request, socket, head, (ws) => {
      wssEvents.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wssLive.on("connection", (ws: WebSocket) => {
  VoiceService.setupLiveSession(ws);
});

// Broadcast helper for real-time background task updates
export function broadcastTaskEvent(event: any) {
  const msg = JSON.stringify(event);
  for (const client of wssEvents.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// 2. Chat & Multi-Agent Orchestration Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, attachments, voice = true, voiceName = "Aoede", clientContext } = req.body;
    if (!message && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: "Message or attachment is required" });
    }

    const result = await processUserMessage(message || "", history || [], attachments || [], clientContext);

    let audioBase64: string | undefined = undefined;
    let useClientTts = (result as any).useClientTts || false;
    if (voice && result.text && !useClientTts) {
      const voiceRes = await VoiceService.synthesizeSpeech(result.text, voiceName);
      audioBase64 = voiceRes.audioBase64;
      if (voiceRes.useClientTts) {
        useClientTts = true;
      }
    }

    res.json({
      text: result.text,
      audioBase64,
      useClientTts,
      quotaExhausted: !!(result as any).quotaExhausted,
      toolActions: result.toolActions,
      memoriesUpdated: result.memoriesUpdated,
    });
  } catch (error: any) {
    console.error("API /api/chat error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// 3. Text to Speech Endpoint
app.post("/api/voice/tts", async (req, res) => {
  try {
    const { text, voice = "Aoede" } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    const voiceRes = await VoiceService.synthesizeSpeech(text, voice);
    res.json(voiceRes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Memory API
app.get("/api/memory", (_req, res) => {
  res.json({ memories: db.getMemories() });
});

app.post("/api/memory", (req, res) => {
  const { category, key, value, confidence } = req.body;
  if (!key || !value) return res.status(400).json({ error: "Key and value are required" });
  const item = db.addMemory(category || "fact", key, value, confidence);
  res.json({ success: true, item });
});

app.delete("/api/memory/:id", (req, res) => {
  db.deleteMemory(req.params.id);
  res.json({ success: true });
});

// 5. Tasks API
app.get("/api/tasks", (_req, res) => {
  res.json({ tasks: db.getTasks() });
});

app.post("/api/tasks/stop-all", (_req, res) => {
  const count = db.stopAllTasks();
  broadcastTaskEvent({ type: "all_tasks_stopped", count });
  res.json({ success: true, stopped: count });
});

app.post("/api/tasks/cancel", (req, res) => {
  const { taskId } = req.body;
  const task = db.cancelTask(taskId);
  broadcastTaskEvent({ type: "task_cancelled", taskId });
  res.json({ success: true, task });
});

// 6. Skills & Self-Evolution API
app.get("/api/skills", (_req, res) => {
  res.json({ skills: db.getSkills() });
});

app.post("/api/skills/evolve", async (req, res) => {
  const { name, description, code, permissions } = req.body;
  const result = await SkillsAgent.createSkill(name, description, code, permissions);
  broadcastTaskEvent({ type: "skill_evolved", skill: result.skill });
  res.json(result);
});

app.post("/api/skills/toggle", (req, res) => {
  const { id, enabled } = req.body;
  db.toggleSkill(id, !!enabled);
  res.json({ success: true });
});

// 6.5 Dynamic Sub-Agents & 24-Hour Lifecycle Factory API
app.get("/api/sub-agents", (_req, res) => {
  res.json({ agents: AgentRegistry.getAllAgents() });
});

app.get("/api/sub-agents/events", (_req, res) => {
  res.json({ events: AgentRegistry.getEvents() });
});

app.post("/api/sub-agents/run-tests", async (_req, res) => {
  try {
    const testResults = await runAllTests();
    res.json(testResults);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GitHub Repository Intelligence API
app.post("/api/github/analyze", async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: "Repository URL is required" });
  const result = await GitHubAgent.analyzeRepository(repoUrl);
  res.json(result);
});

// 8. Individual Agents direct triggers
app.get("/api/whatsapp/contacts", (_req, res) => {
  res.json({ contacts: KNOWN_CONTACTS });
});

app.post("/api/whatsapp/action", async (req, res) => {
  const { action, contact, messageText, confirmed, attachment, mode } = req.body;
  if (action === "search") {
    res.json(await WhatsAppAgent.searchContacts(contact || ""));
  } else if (action === "draft") {
    res.json(await WhatsAppAgent.draftMessage(contact || "CA Rakesh", messageText || "", attachment));
  } else if (action === "send") {
    res.json(await WhatsAppAgent.sendMessage(contact || "CA Rakesh", messageText || "", !!confirmed, attachment));
  } else {
    const openRes = await WhatsAppAgent.openChat(contact || "CA Rakesh", mode || "web");
    broadcastTaskEvent({ type: "whatsapp_opened", contact, result: openRes });
    res.json(openRes);
  }
});

// 8.5 PC Control & Terminal Automation API
app.get("/api/pc/apps", (_req, res) => {
  res.json({ apps: Object.values(KNOWN_PC_APPS) });
});

app.get("/api/pc/health", (_req, res) => {
  res.json(PCControlService.getSystemHealth());
});

app.post("/api/pc/action", async (req, res) => {
  try {
    const { action, appName, command, target } = req.body;
    if (action === "open_app") {
      const result = await PCControlService.openApp(appName || "notepad", target);
      broadcastTaskEvent({ type: "pc_app_opened", appName, result });
      return res.json(result);
    }
    if (action === "terminal") {
      const result = await PCControlService.runTerminalCommand(command || "uptime");
      broadcastTaskEvent({ type: "terminal_executed", command, result });
      return res.json(result);
    }
    if (action === "macro") {
      const result = await PCControlService.executeMacro(target || "morning_setup");
      broadcastTaskEvent({ type: "macro_executed", macro: target, result });
      return res.json(result);
    }
    const health = PCControlService.getSystemHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/youtube/action", async (req, res) => {
  const { action, query } = req.body;
  if (action === "search") {
    res.json(await YouTubeAgent.searchVideos(query || ""));
  } else if (action === "summarize") {
    res.json(await YouTubeAgent.summarizeVideo(query || ""));
  } else {
    res.json(await YouTubeAgent.controlPlayback(action));
  }
});

app.post("/api/browser/action", async (req, res) => {
  const { action, target } = req.body;
  if (action === "search") {
    res.json(await BrowserAgent.searchWeb(target || ""));
  } else if (action === "navigate") {
    res.json(await BrowserAgent.navigateUrl(target || ""));
  } else {
    res.json(await BrowserAgent.takeScreenshot());
  }
});

// 9. Audit Logs & System Status
app.get("/api/audit-logs", (_req, res) => {
  res.json({ logs: db.getAuditLogs() });
});

app.get("/api/system/status", (_req, res) => {
  res.json({
    name: "Lina AI Voice Assistant",
    version: "2.5.0",
    status: "online",
    activeAgents: [
      "WhatsApp Agent",
      "YouTube Agent",
      "Browser & Computer-Use Agent",
      "Google Workspace Agent",
      "GitHub Intelligence Agent",
      "Self-Evolution & Skills Agent",
      "Memory & Personalization Engine",
    ],
    geminiLiveReady: true,
    totalMemories: db.getMemories().length,
    totalSkills: db.getSkills().length,
    runningTasks: db.getTasks().filter((t) => t.status === "running").length,
    settings: db.getSettings(),
  });
});

app.post("/api/settings", (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// 10. Vite Dev Middleware Integration or Static Production Serve
const PORT = 3000;
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Lina AI Voice Assistant server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Lina AI server:", err);
});
