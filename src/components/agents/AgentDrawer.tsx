import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  Cpu,
  Database,
  Terminal,
  ShieldCheck,
  CheckCircle,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Youtube,
  Globe,
  Github,
  Zap,
  Clock,
  AlertTriangle,
  Flame,
} from "lucide-react";

interface AgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAction: (prompt: string) => void;
}

export const AgentDrawer: React.FC<AgentDrawerProps> = ({
  isOpen,
  onClose,
  onRunAction,
}) => {
  const [activeTab, setActiveTab] = useState<
    "sub_agents" | "agents" | "tasks" | "memory" | "skills" | "audit"
  >("sub_agents");
  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const [newMemoryKey, setNewMemoryKey] = useState("");
  const [newMemoryVal, setNewMemoryVal] = useState("");
  const [newMemoryCat, setNewMemoryCat] = useState("preference");
  const [loading, setLoading] = useState(false);
  const [githubUrl, setGithubUrl] = useState("https://github.com/microsoft/playwright");

  // Load backend data
  const loadData = async () => {
    setLoading(true);
    try {
      const [saRes, tRes, mRes, sRes, aRes] = await Promise.all([
        fetch("/api/sub-agents").then((r) => r.json()).catch(() => ({ agents: [] })),
        fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
        fetch("/api/memory").then((r) => r.json()).catch(() => ({ memories: [] })),
        fetch("/api/skills").then((r) => r.json()).catch(() => ({ skills: [] })),
        fetch("/api/audit-logs").then((r) => r.json()).catch(() => ({ logs: [] })),
      ]);
      setSubAgents(saRes.agents || []);
      setTasks(tRes.tasks || []);
      setMemories(mRes.memories || []);
      setSkills(sRes.skills || []);
      setAuditLogs(aRes.logs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadData, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch("/api/sub-agents/run-tests", { method: "POST" });
      const data = await res.json();
      setTestResults(data.results || []);
      loadData();
    } catch (e) {
      console.error("Test execution failed:", e);
    } finally {
      setRunningTests(false);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemoryKey || !newMemoryVal) return;
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Type": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ category: newMemoryCat, key: newMemoryKey, value: newMemoryVal }),
    });
    setNewMemoryKey("");
    setNewMemoryVal("");
    loadData();
  };

  const handleDeleteMemory = async (id: string) => {
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    loadData();
  };

  const handleCancelTask = async (taskId: string) => {
    await fetch("/api/tasks/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    loadData();
  };

  const handleToggleSkill = async (id: string, current: boolean) => {
    await fetch("/api/skills/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !current }),
    });
    loadData();
  };

  const formatCountdown = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired (24h Elapsed)";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${h}h ${m}m ${s}s left`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-2xl h-full bg-neutral-950 border-l border-neutral-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <span>DYNAMIC SUB-AGENT FACTORY</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  24h Strict Lifecycle
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Manager–Worker Architecture • Deduplication • Automated Test Suite
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              title="Refresh"
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-800 bg-black/40 overflow-x-auto text-xs">
          {[
            { id: "sub_agents", label: `Sub-Agents (${subAgents.length})`, icon: Cpu },
            { id: "agents", label: "Specialist Tools", icon: Layers },
            { id: "tasks", label: `Tasks (${tasks.length})`, icon: Terminal },
            { id: "memory", label: `Memory (${memories.length})`, icon: Database },
            { id: "skills", label: `Skills (${skills.length})`, icon: Zap },
            { id: "audit", label: "Audit & Security", icon: ShieldCheck },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                  activeTab === t.id
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 text-sm space-y-4">
          {/* TAB: Dynamic Sub-Agents & 24h Lifecycle */}
          {activeTab === "sub_agents" && (
            <div className="space-y-4">
              {/* Test Runner Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-cyan-950/40 border border-neutral-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-cyan-400" />
                    <span>Run Sub-Agent Factory Test Suite (12 Scenarios)</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Tests atomic deduplication, 24h lifecycle, unauthorized tool denial, restart recovery.
                  </p>
                </div>
                <button
                  onClick={handleRunTests}
                  disabled={runningTests}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 text-white text-xs font-medium cursor-pointer transition shadow-md"
                >
                  <Play className={`w-3.5 h-3.5 ${runningTests ? "animate-spin" : ""}`} />
                  <span>{runningTests ? "Running..." : "Run Tests"}</span>
                </button>
              </div>

              {/* Test Suite Results if executed */}
              {testResults && (
                <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 space-y-1.5 max-h-56 overflow-y-auto font-mono text-[11px]">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-800 text-xs">
                    <span className="font-bold text-neutral-200">
                      Test Suite Results ({testResults.filter((r) => r.passed).length}/{testResults.length} Passed)
                    </span>
                    <button
                      onClick={() => setTestResults(null)}
                      className="text-neutral-500 hover:text-neutral-300"
                    >
                      Clear
                    </button>
                  </div>
                  {testResults.map((t, idx) => (
                    <div key={idx} className="flex items-start gap-2 py-0.5">
                      <span className={t.passed ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                        [{t.passed ? "PASS" : "FAIL"}]
                      </span>
                      <span className="text-neutral-300 font-semibold">{t.testId}:</span>
                      <span className="text-neutral-400 truncate">{t.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-Agents List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-300">Registered Sub-Agents ({subAgents.length})</h4>
                  <span className="text-[10px] text-neutral-500">Fixed 24h Window • No Expiry Extension</span>
                </div>

                {subAgents.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-neutral-900/40 border border-neutral-800/80 text-xs text-neutral-500">
                    <p>No active sub-agents yet.</p>
                    <p className="text-[11px] text-neutral-600 mt-1">
                      Give Lina any command (e.g. YouTube, WhatsApp, GitHub, Calendar) to automatically create a specialized sub-agent.
                    </p>
                  </div>
                ) : (
                  subAgents.map((agent) => {
                    const isExpired = Date.now() >= new Date(agent.expiresAt).getTime();
                    return (
                      <div
                        key={agent.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                          isExpired
                            ? "bg-neutral-950/70 border-neutral-800/60 opacity-60"
                            : "bg-neutral-900/70 border-neutral-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-neutral-200 text-xs">{agent.name}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase font-bold ${
                                  isExpired
                                    ? "bg-neutral-800 text-neutral-400"
                                    : agent.status === "running"
                                    ? "bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                }`}
                              >
                                {isExpired ? "EXPIRED" : agent.status}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-cyan-400 mt-0.5">
                              {agent.capabilitySignature} • {agent.taskCount || 0} tasks executed
                            </p>
                          </div>

                          {/* 24-Hour Expiration Countdown */}
                          <div className="text-right">
                            <span
                              className={`text-[10px] font-mono flex items-center gap-1 ${
                                isExpired ? "text-neutral-500" : "text-amber-400"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{formatCountdown(agent.expiresAt)}</span>
                            </span>
                            <p className="text-[9px] text-neutral-500">
                              Created: {new Date(agent.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <p className="text-[11px] text-neutral-400 line-clamp-2">{agent.purpose}</p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-neutral-400">
                          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-neutral-800">
                            Tools: {agent.requiredTools?.join(", ") || "none"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-neutral-800">
                            Permissions: {agent.requiredPermissions?.join(", ") || "sandboxed"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: Specialist Tools */}
          {activeTab === "agents" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium text-neutral-200">WhatsApp Sub-Agent Adapter</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Active
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Searches contacts, drafts messages, and securely verifies recipient identity before sending.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      onRunAction("Lina, WhatsApp kholo aur Amit Sharma ki chat search karo.");
                    }}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 cursor-pointer"
                  >
                    Search "Amit" Chat
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-400" />
                    <span className="font-medium text-neutral-200">YouTube Sub-Agent Adapter</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                    Active
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Searches channels, opens tutorials, summarizes video transcripts, and handles playback controls.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onRunAction("Lina, YouTube par Python automation tutorial search karo.");
                  }}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 cursor-pointer"
                >
                  Search "Python Automation"
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-neutral-200">Browser & Computer-Use Adapter</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                    Controlled
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Navigates web URLs, clicks elements, submits forms with permission, and takes visual snapshots.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onRunAction("Lina, web search karo latest AI automation tools 2025 ke baare mein.");
                  }}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 cursor-pointer"
                >
                  Run Web Search
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-purple-400" />
                    <span className="font-medium text-neutral-200">GitHub Intelligence Adapter</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-400 border border-purple-800">
                    Sandboxed
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Validates repo URLs, clones into sandbox, inspects architecture, runs safety checks, and packages plugins.
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="flex-1 bg-black/60 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                  />
                  <button
                    onClick={() => {
                      onClose();
                      onRunAction(`Lina, is repository ko analyze karo aur iski functionality integrate karo: ${githubUrl}`);
                    }}
                    className="px-3 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700 text-xs cursor-pointer font-medium"
                  >
                    Analyze
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Tasks Queue */}
          {activeTab === "tasks" && (
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-xs">
                  No active or recent background tasks.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-200">{task.title}</h4>
                        <p className="text-[10px] text-neutral-500">
                          {task.agent} • {new Date(task.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-mono ${
                            task.status === "completed"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : task.status === "running"
                              ? "bg-cyan-950 text-cyan-400 border border-cyan-800 animate-pulse"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {task.status}
                        </span>
                        {task.status === "running" && (
                          <button
                            onClick={() => handleCancelTask(task.id)}
                            className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-300"
                        style={{ width: `${task.progress || 0}%` }}
                      />
                    </div>

                    {task.logs && task.logs.length > 0 && (
                      <div className="p-2 rounded bg-black/60 border border-neutral-900 text-[11px] font-mono text-neutral-400 max-h-24 overflow-y-auto space-y-1">
                        {task.logs.slice(-3).map((log: string, idx: number) => (
                          <div key={idx} className="truncate">
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: Memory Vault */}
          {activeTab === "memory" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <h4 className="text-xs font-semibold text-cyan-300">Add New Personal Memory</h4>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newMemoryCat}
                    onChange={(e) => setNewMemoryCat(e.target.value)}
                    className="bg-black/60 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-200"
                  >
                    <option value="preference">Preference</option>
                    <option value="project">Ongoing Project</option>
                    <option value="fact">Fact / Detail</option>
                  </select>
                  <input
                    type="text"
                    value={newMemoryKey}
                    onChange={(e) => setNewMemoryKey(e.target.value)}
                    placeholder="Subject Key (e.g. favorite_topic)"
                    className="col-span-2 bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemoryVal}
                    onChange={(e) => setNewMemoryVal(e.target.value)}
                    placeholder="Memory Value (e.g. Loves concise bullet points)"
                    className="flex-1 bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                  <button
                    onClick={handleAddMemory}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] text-cyan-400 font-mono uppercase">
                          {m.category}
                        </span>
                        <span className="font-semibold text-neutral-200">{m.key}</span>
                      </div>
                      <p className="text-neutral-300 leading-normal">{m.value}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                      title="Delete Memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Self-Evolved Skills */}
          {activeTab === "skills" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-400">
                  Audited & registered plugins in Lina's dynamic runtime registry.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onRunAction("Lina, mere liye ek naya Excel automation function create karo.");
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-900/60 border border-cyan-700 text-cyan-200 text-xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Evolve New Skill</span>
                </button>
              </div>

              {skills.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-mono font-bold text-cyan-300">{s.name}</h4>
                      <p className="text-[11px] text-neutral-400">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>{s.testStatus}</span>
                      </span>
                      <button
                        onClick={() => handleToggleSkill(s.id, s.enabled)}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase cursor-pointer ${
                          s.enabled ? "bg-cyan-600 text-white" : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {s.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-black/60 border border-neutral-900 font-mono text-[10px] text-neutral-400">
                    <p className="text-neutral-500">Permissions: {s.requiredPermissions?.join(", ") || "sandboxed"}</p>
                    <p className="text-neutral-500">Version: {s.version}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: Audit Logs */}
          {activeTab === "audit" && (
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-xs">No audit logs recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-neutral-300 font-medium">{log.action}</span>
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded ${
                          log.level === "high"
                            ? "bg-red-950 text-red-400 border border-red-800"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {log.level} risk
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">{log.details}</p>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                      <span>{log.agent}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
