import React, { useState, useEffect } from "react";
import {
  X,
  Monitor,
  Terminal,
  MessageSquare,
  Cpu,
  Zap,
  Play,
  ExternalLink,
  Search,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Folder,
  Globe,
  Calculator,
  Code,
  Music,
  Video,
  Send,
  HardDrive,
  Activity,
  Layers,
} from "lucide-react";

interface PCControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerVoiceCommand?: (text: string) => void;
  assistantState?: "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "ERROR";
  activeContactName?: string;
  audioLevel?: number;
}

interface PCApp {
  id: string;
  name: string;
  category: string;
  description: string;
  windowsCommand: string;
  linuxCommand: string;
  webFallbackUrl?: string;
}

interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  role?: string;
  lastMessage?: string;
  status?: string;
}

export const PCControlModal: React.FC<PCControlModalProps> = ({
  isOpen,
  onClose,
  onTriggerVoiceCommand,
  assistantState = "IDLE",
  activeContactName,
  audioLevel = 0,
}) => {
  const [activeTab, setActiveTab] = useState<"apps" | "whatsapp" | "terminal" | "health" | "macros">("apps");
  const [apps, setApps] = useState<PCApp[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [searchContact, setSearchContact] = useState("");
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [waMessageText, setWaMessageText] = useState("");
  const [waAttachment, setWaAttachment] = useState<string>("GST_Audit_Report_2026.pdf");
  const [waSentStatus, setWaSentStatus] = useState<string | null>(null);

  // Terminal state
  const [terminalCmd, setTerminalCmd] = useState("uptime");
  const [terminalOutput, setTerminalOutput] = useState<{ command?: string; stdout: string; stderr: string; exitCode: number; durationMs: number } | null>(null);
  const [isRunningTerm, setIsRunningTerm] = useState(false);

  // System Health state
  const [health, setHealth] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Execution toast
  const [lastAction, setLastAction] = useState<{ name: string; command: string; time: string } | null>(null);

  // Load apps, contacts, and health
  useEffect(() => {
    if (isOpen) {
      fetchApps();
      fetchContacts();
      fetchHealth();
    }
  }, [isOpen]);

  const fetchApps = async () => {
    try {
      const res = await fetch("/api/pc/apps");
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
      }
    } catch (e) {
      console.warn("Failed to fetch PC apps:", e);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/whatsapp/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        if (data.contacts && data.contacts.length > 0) {
          // Default to CA Rakesh if present
          const rakesh = data.contacts.find((c: any) => c.name.toLowerCase().includes("rakesh"));
          setSelectedContact(rakesh || data.contacts[0]);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch WhatsApp contacts:", e);
    }
  };

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch("/api/pc/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (e) {
      console.warn("Failed to fetch PC health:", e);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const handleLaunchApp = async (appId: string, webUrl?: string) => {
    try {
      const res = await fetch("/api/pc/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_app", appName: appId }),
      });
      const data = await res.json();
      setLastAction({
        name: data.appName || appId,
        command: data.commandExecuted || `start ${appId}`,
        time: new Date().toLocaleTimeString(),
      });

      // If app has web version (like WhatsApp Web), open in new tab
      if (webUrl) {
        window.open(webUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      console.error("Launch error:", err);
    }
  };

  const handleRunTerminal = async (commandToRun?: string) => {
    const cmd = commandToRun || terminalCmd;
    if (!cmd.trim()) return;
    setIsRunningTerm(true);
    try {
      const res = await fetch("/api/pc/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminal", command: cmd }),
      });
      const data = await res.json();
      setTerminalOutput(data);
      setLastAction({
        name: "Terminal Command",
        command: cmd,
        time: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningTerm(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedContact) return;
    try {
      const message = waMessageText.trim() || `Sir, maine file attach karke review ke liye bhej di hai.`;
      const res = await fetch("/api/whatsapp/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          contact: selectedContact.name,
          messageText: message,
          confirmed: true,
          attachment: waAttachment ? { name: waAttachment, type: "application/pdf", size: "245 KB" } : undefined,
        }),
      });
      const data = await res.json();
      setWaSentStatus(`Success! Message and attachment dispatched to ${selectedContact.name}.`);
      if (data.directWebUrl) {
        window.open(data.directWebUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => setWaSentStatus(null), 5000);
    } catch (e: any) {
      setWaSentStatus(`Failed: ${e.message}`);
    }
  };

  const handleRunMacro = async (macroName: string) => {
    try {
      const res = await fetch("/api/pc/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "macro", target: macroName }),
      });
      const data = await res.json();
      setLastAction({
        name: data.macroName || macroName,
        command: `Sequence: ${data.stepsExecuted?.join(" -> ") || "Completed"}`,
        time: new Date().toLocaleTimeString(),
      });
      // If morning setup, open WhatsApp Web in browser as well
      if (macroName === "morning_setup") {
        window.open("https://web.whatsapp.com", "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
      c.phone.includes(searchContact) ||
      (c.role && c.role.toLowerCase().includes(searchContact.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[780px] flex flex-col rounded-2xl bg-neutral-950 border border-cyan-500/30 text-neutral-200 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-wide text-white">PC JUNCTION & OS EXECUTION</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/50 text-cyan-300 uppercase">
                  Maya Engine 6.0
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Native App Launcher • Terminal Background Execution • WhatsApp Automation • Hardware Telemetry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-neutral-800 bg-neutral-900/30 overflow-x-auto">
          {[
            { id: "apps", label: "App Launcher", icon: Monitor },
            { id: "whatsapp", label: "WhatsApp Assistant", icon: MessageSquare },
            { id: "terminal", label: "Terminal Executor", icon: Terminal },
            { id: "health", label: "System Health", icon: Activity },
            { id: "macros", label: "Productivity Macros", icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                  active
                    ? "border-cyan-400 text-cyan-400 bg-cyan-950/20"
                    : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Status Bar (if any command was executed) */}
        {lastAction && (
          <div className="flex items-center justify-between px-6 py-2 bg-emerald-950/40 border-b border-emerald-800/40 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>{lastAction.name}:</strong> Launched via background shell:{" "}
                <code className="text-[11px] font-mono text-emerald-200">{lastAction.command}</code>
              </span>
            </div>
            <span className="text-[10px] text-emerald-400/80">{lastAction.time}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: APP LAUNCHER */}
          {activeTab === "apps" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Native PC Applications</h3>
                  <p className="text-xs text-neutral-400">
                    Spawns real OS applications via backend terminal processes.
                  </p>
                </div>
                <div className="text-xs text-cyan-400 font-mono">Platform: {health?.platform || "Linux/Windows"}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {[
                  {
                    id: "notepad",
                    name: "Notepad (Text Editor)",
                    category: "Productivity",
                    icon: FileText,
                    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
                    desc: "Launches native Notepad / scratchpad on system.",
                  },
                  {
                    id: "whatsapp",
                    name: "WhatsApp Web",
                    category: "Communication",
                    icon: MessageSquare,
                    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                    desc: "Opens WhatsApp Web with direct contact search.",
                    webUrl: "https://web.whatsapp.com",
                  },
                  {
                    id: "vscode",
                    name: "Visual Studio Code",
                    category: "Developer",
                    icon: Code,
                    color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
                    desc: "Opens VS Code prompt runner and project workspace.",
                  },
                  {
                    id: "chrome",
                    name: "Google Chrome",
                    category: "Browser",
                    icon: Globe,
                    color: "text-red-400 border-red-500/30 bg-red-500/10",
                    desc: "Launches browser with persistent search sessions.",
                    webUrl: "https://www.google.com",
                  },
                  {
                    id: "terminal",
                    name: "Terminal / Shell",
                    category: "Developer",
                    icon: Terminal,
                    color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
                    desc: "Opens terminal command environment.",
                  },
                  {
                    id: "calculator",
                    name: "Calculator",
                    category: "Utilities",
                    icon: Calculator,
                    color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
                    desc: "Launches system calculator utility.",
                  },
                  {
                    id: "explorer",
                    name: "File Explorer",
                    category: "System",
                    icon: Folder,
                    color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
                    desc: "Opens root workspace folders.",
                  },
                  {
                    id: "youtube",
                    name: "YouTube",
                    category: "Media",
                    icon: Video,
                    color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
                    desc: "Opens YouTube tutorial & playback dashboard.",
                    webUrl: "https://www.youtube.com",
                  },
                  {
                    id: "spotify",
                    name: "Spotify",
                    category: "Media",
                    icon: Music,
                    color: "text-green-400 border-green-500/30 bg-green-500/10",
                    desc: "Plays music & deep focus audio.",
                    webUrl: "https://open.spotify.com",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition hover:shadow-lg group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg border ${item.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                          {item.category}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white group-hover:text-cyan-300 transition">
                          {item.name}
                        </h4>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{item.desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                        <button
                          onClick={() => handleLaunchApp(item.id, item.webUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Launch</span>
                        </button>

                        {item.webUrl && (
                          <a
                            href={item.webUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-cyan-300 transition"
                          >
                            <span>Open Web</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP ASSISTANT */}
          {activeTab === "whatsapp" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Contacts Sidebar */}
              <div className="md:col-span-5 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">WhatsApp Contacts</h3>
                  <button
                    onClick={() => window.open("https://web.whatsapp.com", "_blank")}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <span>Open Web</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    value={searchContact}
                    onChange={(e) => setSearchContact(e.target.value)}
                    placeholder="Search contact (e.g. CA Rakesh)..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredContacts.map((c) => {
                    const isSelected = selectedContact?.id === c.id;
                    const isRakesh = c.name.toLowerCase().includes("rakesh");

                    // Check if Lina is actively speaking or processing a voice command for this contact
                    const isContactActiveVoice =
                      (assistantState === "SPEAKING" || assistantState === "THINKING") &&
                      (
                        (activeContactName && c.name.toLowerCase().includes(activeContactName.toLowerCase())) ||
                        (!activeContactName && isSelected) ||
                        (activeContactName && activeContactName.toLowerCase().includes(c.name.toLowerCase()))
                      );

                    const isSpeaking = assistantState === "SPEAKING";
                    const isThinking = assistantState === "THINKING";

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedContact(c)}
                        className={`relative p-3 rounded-xl border transition-all duration-300 cursor-pointer overflow-visible ${
                          isContactActiveVoice
                            ? isSpeaking
                              ? "bg-emerald-950/70 border-emerald-400 shadow-[0_0_25px_rgba(0,255,157,0.3)] text-white ring-2 ring-emerald-400/70 scale-[1.02]"
                              : "bg-cyan-950/70 border-cyan-400 shadow-[0_0_25px_rgba(0,209,255,0.3)] text-white ring-2 ring-cyan-400/70 scale-[1.02]"
                            : isSelected
                            ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                            : "bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:border-neutral-700"
                        }`}
                      >
                        {/* Radiant Glow Behind Card during Voice Activity */}
                        {isContactActiveVoice && (
                          <>
                            <div
                              className={`absolute -inset-1 rounded-2xl blur-md pointer-events-none -z-10 transition-opacity duration-300 ${
                                isSpeaking
                                  ? "bg-gradient-to-r from-emerald-500/25 via-emerald-400/40 to-teal-400/25 animate-pulse"
                                  : "bg-gradient-to-r from-cyan-500/25 via-blue-500/40 to-cyan-400/25 animate-pulse"
                              }`}
                            />
                            {/* Concentric Subtle Outward Ripple Waves */}
                            <div
                              className={`absolute inset-0 rounded-xl pointer-events-none border transition-all ${
                                isSpeaking
                                  ? "border-emerald-400/70 animate-subtle-ripple"
                                  : "border-cyan-400/70 animate-subtle-ripple-blue"
                              }`}
                            />
                            <div
                              className={`absolute inset-0 rounded-xl pointer-events-none border transition-all ${
                                isSpeaking
                                  ? "border-emerald-400/40 animate-subtle-ripple-delayed"
                                  : "border-cyan-400/40 animate-subtle-ripple-blue-delayed"
                              }`}
                            />
                          </>
                        )}

                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-white">{c.name}</span>
                            {isRakesh && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 border border-amber-600/50 text-amber-300">
                                CA / Auditor
                              </span>
                            )}

                            {/* Active Voice Equalizer & Badge */}
                            {isContactActiveVoice && (
                              <div className="flex items-center gap-1 ml-1">
                                <div className="flex items-end gap-0.5 h-3 px-1">
                                  <span
                                    className={`w-0.5 rounded-full ${isSpeaking ? "bg-emerald-400" : "bg-cyan-400"} animate-[audio-bar-pulse_0.7s_ease-in-out_infinite]`}
                                    style={{ animationDelay: "0ms" }}
                                  />
                                  <span
                                    className={`w-0.5 rounded-full ${isSpeaking ? "bg-emerald-400" : "bg-cyan-400"} animate-[audio-bar-pulse_0.7s_ease-in-out_infinite]`}
                                    style={{ animationDelay: "180ms" }}
                                  />
                                  <span
                                    className={`w-0.5 rounded-full ${isSpeaking ? "bg-emerald-400" : "bg-cyan-400"} animate-[audio-bar-pulse_0.7s_ease-in-out_infinite]`}
                                    style={{ animationDelay: "360ms" }}
                                  />
                                </div>
                                <span
                                  className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full font-semibold border ${
                                    isSpeaking
                                      ? "bg-emerald-950 border-emerald-500/70 text-emerald-300 animate-pulse"
                                      : "bg-cyan-950 border-cyan-500/70 text-cyan-300 animate-pulse"
                                  }`}
                                >
                                  {isSpeaking ? "Speaking" : "Processing"}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] ${isContactActiveVoice && isSpeaking ? "text-emerald-300 font-bold" : "text-emerald-400"}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-400 relative z-10">
                          <span>{c.phone}</span>
                          <span className="truncate max-w-[120px] text-[10px]">{c.role}</span>
                        </div>
                        {c.lastMessage && (
                          <p className="text-[10px] text-neutral-500 mt-1 truncate relative z-10">"{c.lastMessage}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Message Composer & Direct Dispatch */}
              <div className="md:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {selectedContact ? selectedContact.name : "Select a contact"}
                      </h4>
                      <p className="text-xs text-emerald-400">{selectedContact?.phone || "+91..."}</p>
                    </div>
                    <button
                      onClick={() => handleLaunchApp("whatsapp", `https://web.whatsapp.com/send?phone=${selectedContact?.phone.replace(/[^0-9]/g, "")}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Launch Chat</span>
                    </button>
                  </div>

                  {/* Attachment Picker */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                      Attached File / Document
                    </label>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                      <Paperclip className="w-4 h-4 text-emerald-400" />
                      <select
                        value={waAttachment}
                        onChange={(e) => setWaAttachment(e.target.value)}
                        className="bg-transparent text-neutral-200 text-xs flex-1 focus:outline-none cursor-pointer"
                      >
                        <option value="GST_Audit_Report_2026.pdf" className="bg-neutral-900">
                          GST_Audit_Report_2026.pdf (245 KB) - Tax Audit
                        </option>
                        <option value="Balance_Sheet_Q3.xlsx" className="bg-neutral-900">
                          Balance_Sheet_Q3.xlsx (120 KB) - Financials
                        </option>
                        <option value="Contract_Agreement.pdf" className="bg-neutral-900">
                          Contract_Agreement.pdf (512 KB) - Legal
                        </option>
                        <option value="" className="bg-neutral-900">
                          None (Text Message Only)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Message Input */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                      Message Content
                    </label>
                    <textarea
                      rows={4}
                      value={waMessageText}
                      onChange={(e) => setWaMessageText(e.target.value)}
                      placeholder={`Namaste ${selectedContact?.name || "Sir"}, GST returns aur balance sheet review ke liye bhej di hai...`}
                      className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  {waSentStatus && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-xs text-emerald-300">
                      {waSentStatus}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-500">
                    Auto-synced with Lina Voice Command: "CA Rakesh ko message bhej do"
                  </span>
                  <button
                    onClick={handleSendWhatsApp}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp Web</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TERMINAL EXECUTOR */}
          {activeTab === "terminal" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Backend Terminal Shell</h3>
                  <p className="text-xs text-neutral-400">
                    Executes system commands on the backend node environment with output streaming.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {["uptime", "free -m", "ls -la", "node -v"].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => {
                        setTerminalCmd(cmd);
                        handleRunTerminal(cmd);
                      }}
                      className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] font-mono text-cyan-400 transition cursor-pointer"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Command Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-cyan-500">$</span>
                  <input
                    type="text"
                    value={terminalCmd}
                    onChange={(e) => setTerminalCmd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRunTerminal();
                    }}
                    placeholder="Enter bash command (e.g. ps aux, git status, uptime)..."
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-black border border-neutral-800 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  onClick={() => handleRunTerminal()}
                  disabled={isRunningTerm}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {isRunningTerm ? "Running..." : "Execute"}
                </button>
              </div>

              {/* Terminal Screen */}
              <div className="p-4 rounded-xl bg-black border border-neutral-800 font-mono text-xs text-neutral-300 min-h-[260px] max-h-[380px] overflow-y-auto">
                {terminalOutput ? (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pb-2 mb-2 border-b border-neutral-800">
                      <span>Command: {terminalOutput.command || terminalCmd}</span>
                      <span>
                        Exit Code: {terminalOutput.exitCode} ({terminalOutput.durationMs}ms)
                      </span>
                    </div>
                    {terminalOutput.stdout && (
                      <pre className="text-emerald-400 whitespace-pre-wrap">{terminalOutput.stdout}</pre>
                    )}
                    {terminalOutput.stderr && (
                      <pre className="text-rose-400 whitespace-pre-wrap mt-2">{terminalOutput.stderr}</pre>
                    )}
                  </div>
                ) : (
                  <div className="text-neutral-600 text-center py-12">
                    <Terminal className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                    <p>Enter a command or click a preset above to run in backend terminal.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM HEALTH */}
          {activeTab === "health" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Hardware & System Telemetry</h3>
                  <p className="text-xs text-neutral-400">
                    Real-time metrics queried from host OS architecture.
                  </p>
                </div>
                <button
                  onClick={fetchHealth}
                  disabled={isLoadingHealth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {health && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-neutral-400 font-medium">Memory (RAM)</span>
                      <Cpu className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{health.ramUsagePercent}%</div>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {health.usedMemGB} GB / {health.totalMemGB} GB
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 mt-3 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${health.ramUsagePercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-neutral-400 font-medium">CPU Cores</span>
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{health.cpuCores} Cores</div>
                    <p className="text-[11px] text-neutral-400 mt-1 truncate" title={health.cpuModel}>
                      {health.cpuModel}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-neutral-400 font-medium">System Uptime</span>
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{health.uptimeHours} hrs</div>
                    <p className="text-[11px] text-neutral-400 mt-1">Hostname: {health.hostname}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-neutral-400 font-medium">Architecture</span>
                      <HardDrive className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-xl font-bold text-white uppercase">{health.platform}</div>
                    <p className="text-[11px] text-neutral-400 mt-1">Arch: {health.arch}</p>
                  </div>
                </div>
              )}

              {/* Natural Language Health Readout */}
              {health?.summary && (
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200">
                  <p className="font-semibold mb-1 text-cyan-300">Natural Voice Readout:</p>
                  <p className="leading-relaxed">"{health.summary}"</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MACROS */}
          {activeTab === "macros" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Automated PC Macros</h3>
                <p className="text-xs text-neutral-400">
                  Multi-step orchestration sequences that launch applications, clear caches, and organize workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Morning Productivity Setup</h4>
                      <span className="text-[10px] text-neutral-400 font-mono">VS Code + WhatsApp Web + Chrome</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Spawns Visual Studio Code workspace, launches WhatsApp Web communication hub, and opens Chrome for daily briefings.
                  </p>
                  <button
                    onClick={() => handleRunMacro("morning_setup")}
                    className="mt-4 w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Execute Morning Macro
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Clean Temporary Files</h4>
                      <span className="text-[10px] text-neutral-400 font-mono">Cache Purge & Temp Cleaner</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Safely deletes cached logs and temporary scratch files from %TEMP% or /tmp to restore free disk space.
                  </p>
                  <button
                    onClick={() => handleRunMacro("clean_temp")}
                    className="mt-4 w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Clean Temp Files
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
