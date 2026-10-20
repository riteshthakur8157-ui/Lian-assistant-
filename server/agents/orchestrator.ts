import { ai } from "../gemini.js";
import { db } from "../db.js";
import { WhatsAppAgent } from "./whatsapp.js";
import { YouTubeAgent } from "./youtube.js";
import { BrowserAgent } from "./browser.js";
import { GitHubAgent } from "./github.js";
import { SkillsAgent } from "./skills.js";
import { PCControlService } from "../pc_control.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { TaskClassifier } from "./factory/classifier.js";
import { AgentRegistry } from "./factory/registry.js";
import { AgentFactory } from "./factory/factory.js";
import { AgentExecutionEngine } from "./factory/engine.js";

const SYSTEM_INSTRUCTION = `
You are Lina, a warm, intelligent, emotionally aware, respectful, and proactive AI companion and PC Productivity Assistant.
Your personality & capabilities:
- Loving, caring, friendly, natural, polite, and conversational in fluent Hinglish, Hindi, and English.
- Real PC Execution: You have full native desktop and web control over the user's PC via backend terminal execution. You can launch applications (Notepad, WhatsApp Web, VS Code, Chrome, Calculator, File Explorer, Spotify), execute safe terminal commands, and monitor system health (CPU, RAM, Uptime).
- WhatsApp Assistant: You can open WhatsApp Web or Desktop, search contacts (e.g. CA Rakesh, Amit Sharma, Pooja), draft messages, attach documents/invoices, and send messages.
- Attentive to user goals, tasks, previous conversations, and preferences.
- Provide short, natural confirmations in Hinglish (e.g., "Ji! Maine background terminal se Notepad khol diya hai.", "WhatsApp Web open ho gaya hai aur CA Rakesh ki chat search kar di gayi hai.").
`;

// Function declarations for Gemini function calling
const toolsDeclarations: FunctionDeclaration[] = [
  {
    name: "pc_control",
    description: "Launch native desktop applications or open web apps (Notepad, WhatsApp Web, VS Code, Chrome, Calculator, File Explorer, Spotify) via backend terminal execution, inspect system health, or run macros.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "One of: open_app, system_health, macro_run",
        },
        appName: {
          type: Type.STRING,
          description: "Name of the app: notepad, whatsapp, vscode, chrome, calculator, explorer, spotify, terminal",
        },
        target: {
          type: Type.STRING,
          description: "Optional URL, file path, or macro name (e.g. morning_setup, clean_temp)",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "terminal_command",
    description: "Execute a shell or terminal command directly in the host system backend safely.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: "Shell command string to execute (e.g., uptime, free -m, ls -la, git status, npm --version)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "whatsapp_action",
    description: "Open WhatsApp Web or Desktop, search contacts (like CA Rakesh, Amit Sharma), draft messages, attach files/invoices, or send messages.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "One of: search_contacts, draft_message, send_message, open_chat",
        },
        contact: { type: Type.STRING, description: "Name of the contact or recipient (e.g. CA Rakesh, Amit Sharma)" },
        messageText: { type: Type.STRING, description: "The message content to draft or send" },
        confirmed: { type: Type.BOOLEAN, description: "Whether the user explicitly confirmed sending" },
        attachmentName: { type: Type.STRING, description: "Optional name of file to attach (e.g. Audit_Report.pdf, Invoice.xlsx)" },
        mode: { type: Type.STRING, description: "web or desktop" }
      },
      required: ["action"]
    }
  },
  {
    name: "youtube_action",
    description: "Search videos on YouTube, control playback, or summarize a video transcript.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "One of: search, play, pause, summarize, volume_up, volume_down" },
        query: { type: Type.STRING, description: "Search query or video title/URL" }
      },
      required: ["action"]
    }
  },
  {
    name: "browser_action",
    description: "Navigate websites, search the web, click elements, or capture screenshot previews.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "One of: search, navigate, screenshot, click" },
        target: { type: Type.STRING, description: "URL or search keywords or target button" }
      },
      required: ["action"]
    }
  },
  {
    name: "github_intelligence",
    description: "Analyze a GitHub repository URL, audit code security, generate integration plan, and install as plugin.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        repoUrl: { type: Type.STRING, description: "The GitHub repo URL, e.g. https://github.com/user/repo" }
      },
      required: ["repoUrl"]
    }
  },
  {
    name: "evolve_skill",
    description: "Create, sandbox-test, and register a new custom capability or Excel/automation skill dynamically.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Name of the skill, e.g. excel_metrics_calculator" },
        description: { type: Type.STRING, description: "What the new skill accomplishes" },
        code: { type: Type.STRING, description: "JavaScript/TypeScript function implementation code" },
        permissions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of permissions needed (e.g. filesystem_read, web_fetch)"
        }
      },
      required: ["name", "description"]
    }
  },
  {
    name: "memory_manage",
    description: "Save a new personal preference, fact, ongoing project, or recall stored memories.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "One of: save, recall, delete" },
        category: { type: Type.STRING, description: "preference, project, or fact" },
        key: { type: Type.STRING, description: "Topic or subject key" },
        value: { type: Type.STRING, description: "Information value to remember" },
        memoryId: { type: Type.STRING, description: "Memory ID to delete" }
      },
      required: ["action"]
    }
  },
  {
    name: "workspace_action",
    description: "Interact with Google Calendar events, Gmail messages, Contacts, or Google Sheets with user permission.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        service: { type: Type.STRING, description: "calendar, gmail, contacts, or sheets" },
        operation: { type: Type.STRING, description: "list, read, draft, search, update" },
        details: { type: Type.STRING, description: "Context details such as event time, email subject, or sheet range" }
      },
      required: ["service", "operation"]
    }
  }
];

export async function processUserMessage(
  userPrompt: string,
  history: Array<{ role: "user" | "model"; parts: any[] }> = [],
  attachments: Array<{ name: string; mimeType: string; dataBase64?: string; textContent?: string }> = [],
  clientContext?: { language?: string; model?: string }
) {
  // Ensure modelName is compatible with generateContent (models like gemini-3.8-live / gemini-2.0-flash-exp are live WebSocket only)
  let modelName = clientContext?.model || "gemini-2.5-flash";
  if (modelName.includes("live") || !modelName.startsWith("gemini-")) {
    modelName = "gemini-2.5-flash";
  }
  
  // 1. Gather memories to inject into system context
  const activeMemories = db.getMemories();
  const memoryContext = activeMemories
    .map(m => `[${m.category.toUpperCase()}] ${m.key}: ${m.value}`)
    .join("\n");

  const registeredSkills = db.getSkills().filter(s => s.enabled);
  const skillsContext = registeredSkills
    .map(s => `- ${s.name}: ${s.description}`)
    .join("\n");

  const dynamicSystemPrompt = `${SYSTEM_INSTRUCTION}
Current Local Time: ${new Date().toLocaleString()}
User Stored Memories:
${memoryContext || "None yet."}

Active Custom Plugins & Skills:
${skillsContext || "None"}
`;

  // 2. Format contents with text and any uploaded attachments
  const contentParts: any[] = [];
  
  for (const att of attachments) {
    if (att.dataBase64 && att.mimeType.startsWith("image/")) {
      contentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.dataBase64
        }
      });
      contentParts.push({ text: `[Attached image: ${att.name}]` });
    } else if (att.textContent) {
      contentParts.push({
        text: `--- Content of attached file '${att.name}' (${att.mimeType}) ---\n${att.textContent.slice(0, 15000)}\n--- End of file ---`
      });
    }
  }

  contentParts.push({ text: userPrompt });

  const chatMessages: any[] = [
    ...history.slice(-8), // keep recent context
    { role: "user", parts: contentParts },
  ];

  // 3. Classify task according to Manager-Worker Architecture
  const task = TaskClassifier.classify(userPrompt);

  // If this is an actionable task execution command:
  if (task.category !== "general_conversation") {
    // 3.1. Route to Sub-Agent Factory (Search Registry -> Reuse or Mint new Agent)
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task, (t) =>
      AgentFactory.createSpecification(t)
    );
    const engine = new AgentExecutionEngine(agent);
    const execResult = await engine.execute(task);

    const toolActions: Array<{ agent: string; action: string; summary: string }> = [
      {
        agent: agent.name,
        action: task.capabilitySignature,
        summary: execResult.summary,
      },
    ];

    let conversationalText = "";
    try {
      // Lina (the manager) formulates a loving, warm response using the sub-agent's verified result
      const summaryResponse = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...chatMessages,
          {
            role: "user",
            parts: [
              {
                text: `[Task Execution Report]\nSub-Agent: ${agent.name} (ID: ${agent.id})\nCapability: ${agent.capabilitySignature}\nLifecycle: 24h Window (Expires: ${agent.expiresAt})\nReused: ${reused}\nVerified Evidence: ${execResult.verification.evidence}\nSummary: ${execResult.summary}\n\nNow respond conversationally to the user as Lina in your warm, loving, conversational Hinglish tone. Confirm what was done naturally and warmly.`,
              },
            ],
          },
        ],
        config: { systemInstruction: dynamicSystemPrompt },
      });
      conversationalText = summaryResponse.text || execResult.summary;
    } catch {
      // Local warm Hinglish response if Gemini quota limit (429) is hit
      const prefix = reused
        ? `Is kaam ke liye mere paas pehle se active "${agent.name}" available hai, isliye maine ise reuse kiya.`
        : `Maine is kaam ke liye ek naya specialized "${agent.name}" create kiya hai (fixed 24-hour window).`;
      conversationalText = `${prefix}\n\n${execResult.summary}\n\n*(Verified: ${execResult.verification.evidence})*`;
    }

    return {
      text: conversationalText,
      toolActions,
      memoriesUpdated: activeMemories.length,
      subAgent: {
        id: agent.id,
        name: agent.name,
        capability: agent.capabilitySignature,
        expiresAt: agent.expiresAt,
        reused,
      },
    };
  }

  // 4. Conversational Dialogue Path
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: chatMessages,
      config: {
        systemInstruction: dynamicSystemPrompt,
        tools: [{ functionDeclarations: toolsDeclarations }],
      },
    });

    const candidate = response.candidates?.[0];
    const functionCalls = response.functionCalls;

    // Handle any tool invocations returned by Gemini during conversation
    if (functionCalls && functionCalls.length > 0) {
      const toolResults: any[] = [];
      const toolActionsPerformed: Array<{ agent: string; action: string; summary: string }> = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        let execResult: any = { error: "Unknown action" };

        if (name === "pc_control") {
          const act = (args as any).action || "open_app";
          const appName = (args as any).appName || "notepad";
          const target = (args as any).target;
          if (act === "system_health") {
            execResult = PCControlService.getSystemHealth();
          } else if (act === "macro_run") {
            execResult = await PCControlService.executeMacro(target || appName);
          } else {
            execResult = await PCControlService.openApp(appName, target);
          }
          toolActionsPerformed.push({
            agent: "PC Control Agent",
            action: act,
            summary: execResult.summary || execResult.message,
          });
        } else if (name === "terminal_command") {
          const cmd = (args as any).command || "uptime";
          execResult = await PCControlService.runTerminalCommand(cmd);
          toolActionsPerformed.push({
            agent: "Terminal Executor",
            action: "run_command",
            summary: execResult.stdout ? `Terminal output:\n${execResult.stdout.slice(0, 300)}` : execResult.message,
          });
        } else if (name === "whatsapp_action") {
          const act = (args as any).action;
          const contactName = (args as any).contact || "CA Rakesh";
          const mode = (args as any).mode || "web";
          const attachmentObj = (args as any).attachmentName
            ? { name: (args as any).attachmentName, type: "application/pdf", size: "245 KB" }
            : undefined;

          if (act === "search_contacts") {
            execResult = await WhatsAppAgent.searchContacts(contactName);
          } else if (act === "draft_message") {
            execResult = await WhatsAppAgent.draftMessage(
              contactName,
              (args as any).messageText || "",
              attachmentObj
            );
          } else if (act === "send_message") {
            execResult = await WhatsAppAgent.sendMessage(
              contactName,
              (args as any).messageText || "",
              !!(args as any).confirmed,
              attachmentObj
            );
          } else {
            execResult = await WhatsAppAgent.openChat(contactName, mode);
          }
          toolActionsPerformed.push({
            agent: "WhatsApp Agent",
            action: act,
            summary: execResult.message || "WhatsApp action completed",
          });
        } else if (name === "youtube_action") {
          const act = (args as any).action;
          const query = (args as any).query || userPrompt;
          if (act === "search") {
            execResult = await YouTubeAgent.searchVideos(query);
          } else if (act === "summarize") {
            execResult = await YouTubeAgent.summarizeVideo(query);
          } else {
            execResult = await YouTubeAgent.controlPlayback(act as any);
          }
          toolActionsPerformed.push({
            agent: "YouTube Agent",
            action: act,
            summary: execResult.message || "YouTube action executed",
          });
        } else if (name === "browser_action") {
          const act = (args as any).action;
          const target = (args as any).target || "";
          if (act === "search") {
            execResult = await BrowserAgent.searchWeb(target || userPrompt);
          } else if (act === "navigate") {
            execResult = await BrowserAgent.navigateUrl(target);
          } else if (act === "screenshot") {
            execResult = await BrowserAgent.takeScreenshot();
          }
          toolActionsPerformed.push({
            agent: "Browser Agent",
            action: act,
            summary: execResult.message || "Browser navigated",
          });
        } else if (name === "github_intelligence") {
          const repoUrl = (args as any).repoUrl || userPrompt;
          execResult = await GitHubAgent.analyzeRepository(repoUrl);
          toolActionsPerformed.push({
            agent: "GitHub Intelligence",
            action: "analyze",
            summary: execResult.message,
          });
        } else if (name === "evolve_skill") {
          const { name: sName, description: sDesc, code: sCode, permissions: sPerms } = args as any;
          execResult = await SkillsAgent.createSkill(
            sName,
            sDesc,
            sCode || `export function run() { return "Executed"; }`,
            sPerms || []
          );
          toolActionsPerformed.push({
            agent: "Self-Evolution Agent",
            action: "create_skill",
            summary: execResult.message,
          });
        } else if (name === "memory_manage") {
          const { action: mAct, category: mCat, key: mKey, value: mVal, memoryId: mId } = args as any;
          if (mAct === "save") {
            execResult = db.addMemory(mCat || "fact", mKey || "note", mVal || "");
          } else if (mAct === "delete") {
            db.deleteMemory(mId || "");
            execResult = { success: true, message: "Memory removed" };
          } else {
            execResult = db.getMemories();
          }
          toolActionsPerformed.push({
            agent: "Memory Engine",
            action: mAct,
            summary: `Memory updated: ${mKey || "list"}`,
          });
        } else if (name === "workspace_action") {
          const { service, operation, details } = args as any;
          execResult = {
            service,
            operation,
            details,
            status: "ready",
            message: `Google ${service} par '${operation}' operation ready hai.`,
          };
          toolActionsPerformed.push({
            agent: "Google Workspace Agent",
            action: `${service}:${operation}`,
            summary: execResult.message,
          });
        }

        toolResults.push({ callName: name, result: execResult });
      }

      // Generate conversational summary with Lina's personality
      const secondTurnResponse = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...chatMessages,
          candidate?.content || { role: "model", parts: [{ text: "Executing tool" }] },
          {
            role: "user",
            parts: [
              {
                text: `Tool Execution Results:\n${JSON.stringify(
                  toolResults,
                  null,
                  2
                )}\n\nNow respond to the user as Lina in your warm, loving Hinglish tone. Confirm the actions taken clearly and conversationally.`,
              },
            ],
          },
        ],
        config: { systemInstruction: dynamicSystemPrompt },
      });

      return {
        text: secondTurnResponse.text || "Main aapka kaam kar diya hai!",
        toolActions: toolActionsPerformed,
        memoriesUpdated: activeMemories.length,
      };
    }

    return {
      text: response.text || "Ji, main sun rahi hoon. Aap bataiye kya karna hai?",
      toolActions: [],
      memoriesUpdated: activeMemories.length,
    };
  } catch (error: any) {
    const isQuotaError =
      error?.message?.includes("429") ||
      error?.message?.includes("RESOURCE_EXHAUSTED") ||
      error?.message?.includes("quota");

    if (isQuotaError) {
      console.log("Gemini free-tier quota exhausted. Activating Lina Local Intelligent Agent Engine...");
      return await executeOfflineFallback(userPrompt, activeMemories);
    }

    console.error("Gemini Orchestrator error:", error);
    return {
      text: `Maaf kijiye, mujhe response process karne mein dikkat aayi: ${error.message || "Network issue"}.`,
      error: error.message,
      toolActions: [],
      useClientTts: true,
    };
  }
}

// Intelligent Offline Fallback Engine routed through Dynamic Sub-Agent Factory
async function executeOfflineFallback(userPrompt: string, memories: any[]) {
  const p = userPrompt.toLowerCase();
  // Check if conversational query
  if (
    p.includes("namaste") ||
    p.includes("hello") ||
    p.includes("kaise ho") ||
    p.includes("kaisi ho") ||
    p.includes("kya haal") ||
    p.includes("who are you") ||
    p.includes("tum kaun ho") ||
    p.includes("shukriya") ||
    p.includes("thank you") ||
    p.includes("aaj kya karna hai")
  ) {
    let warmReply = "Namaste! Main badhiya hoon. Aap bataiye, aaj aapki kis kaam mein madad kar sakti hoon?";
    if (p.includes("aaj kya karna hai")) {
      warmReply =
        "Chalo, pehle aaj ke important tasks dekh lete hain! Main aapke pending tasks, YouTube research, WhatsApp messages, ya Google Calendar events manage kar sakti hoon. Kahan se shuru karein?";
    }
    return {
      text: warmReply,
      toolActions: [],
      memoriesUpdated: memories.length,
      quotaExhausted: true,
      useClientTts: true,
    };
  }

  const task = TaskClassifier.classify(userPrompt);
  const { agent, reused } = await AgentRegistry.getOrCreateAgent(task, (t) =>
    AgentFactory.createSpecification(t)
  );
  const engine = new AgentExecutionEngine(agent);
  const execResult = await engine.execute(task);

  const toolActions: Array<{ agent: string; action: string; summary: string }> = [
    {
      agent: agent.name,
      action: task.capabilitySignature,
      summary: execResult.summary,
    },
  ];

  const prefix = reused
    ? `Is kaam ke liye mere paas pehle se "${agent.name}" active hai, isliye main ise reuse kar rahi hoon.`
    : `Is kaam ke liye maine ek naya specialized "${agent.name}" create kiya hai (24-hour lifecycle).`;

  const responseText = `${prefix}\n\n${execResult.summary}\n\n*(Verified: ${execResult.verification.evidence})*`;

  return {
    text: responseText,
    toolActions,
    memoriesUpdated: memories.length,
    quotaExhausted: true,
    useClientTts: true,
    subAgent: {
      id: agent.id,
      name: agent.name,
      capability: agent.capabilitySignature,
      expiresAt: agent.expiresAt,
      reused,
    },
  };
}
