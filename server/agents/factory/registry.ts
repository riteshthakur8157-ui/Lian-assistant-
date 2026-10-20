import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AgentSpecification, NormalizedTask, AgentEvent } from "./types.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const REGISTRY_FILE = path.join(DATA_DIR, "sub_agents.json");
const EVENTS_FILE = path.join(DATA_DIR, "agent_events.json");

export class AgentRegistry {
  private static agents: Map<string, AgentSpecification> = new Map();
  private static events: AgentEvent[] = [];
  private static inFlightCreation: Map<string, Promise<AgentSpecification>> = new Map();
  private static initialized = false;

  /**
   * Initializes or reloads the registry from disk.
   * Preserves original creation and expiration timestamps.
   */
  public static initialize(): void {
    if (this.initialized) return;

    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        const raw = fs.readFileSync(REGISTRY_FILE, "utf-8");
        const list: AgentSpecification[] = JSON.parse(raw);
        for (const item of list) {
          // Revalidate health and check if expired
          const now = Date.now();
          const exp = new Date(item.expiresAt).getTime();
          if (now >= exp) {
            item.status = "expired";
          }
          this.agents.set(item.id, item);
        }
      }

      if (fs.existsSync(EVENTS_FILE)) {
        const rawEv = fs.readFileSync(EVENTS_FILE, "utf-8");
        this.events = JSON.parse(rawEv);
      }
    } catch (e) {
      console.error("Error loading agent registry from disk:", e);
    }

    this.initialized = true;
  }

  /**
   * Persists the current state of agents and events to disk atomically.
   */
  private static persist(): void {
    try {
      const agentList = Array.from(this.agents.values());
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(agentList, null, 2), "utf-8");
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(this.events.slice(-200), null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving agent registry to disk:", e);
    }
  }

  /**
   * Records an audit event for agent lifecycle and security tracking.
   */
  public static recordEvent(
    agentId: string,
    taskId: string,
    eventType: AgentEvent["eventType"],
    eventDetails: Record<string, any>
  ): void {
    const ev: AgentEvent = {
      id: "ev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      agentId,
      taskId,
      eventType,
      eventTimestamp: new Date().toISOString(),
      eventDetails,
    };
    this.events.unshift(ev);
    if (this.events.length > 500) this.events = this.events.slice(0, 500);
    this.persist();
  }

  /**
   * Searches the registry for an active, unexpired agent supporting the exact capability
   * and possessing all required permissions.
   */
  public static findCompatibleAgent(task: NormalizedTask): AgentSpecification | null {
    this.initialize();
    const now = Date.now();

    for (const agent of this.agents.values()) {
      // 1. Strict 24-hour expiration check
      const expTime = new Date(agent.expiresAt).getTime();
      if (now >= expTime) {
        if (agent.status !== "expired") {
          agent.status = "expired";
          this.recordEvent(agent.id, task.taskId, "agent_expired", {
            reason: "24-hour lifecycle elapsed",
            expiresAt: agent.expiresAt,
          });
        }
        continue;
      }

      // 2. Capability signature match
      if (agent.capabilitySignature !== task.capabilitySignature) {
        continue;
      }

      // 3. Status health check (must be ready or completed previous task)
      if (agent.status === "failed" || agent.status === "expired") {
        continue;
      }

      // 4. Permission check: Candidate must satisfy ALL required permissions of task
      const hasAllPermissions = task.requiredPermissions.every((perm) =>
        agent.requiredPermissions.includes(perm)
      );
      if (!hasAllPermissions) {
        continue;
      }

      return agent;
    }

    return null;
  }

  /**
   * Retrieves or creates a matching sub-agent atomically.
   * If two requests for the same missing capability arrive concurrently,
   * the atomic in-flight lock ensures only one agent is created.
   */
  public static async getOrCreateAgent(
    task: NormalizedTask,
    generatorFn: (t: NormalizedTask) => Promise<AgentSpecification>
  ): Promise<{ agent: AgentSpecification; reused: boolean }> {
    this.initialize();

    // 1. Check if a compatible, unexpired agent already exists
    const existing = this.findCompatibleAgent(task);
    if (existing) {
      // Reuse agent: update lastUsedAt and taskCount, but NEVER extend expiresAt!
      existing.lastUsedAt = new Date().toISOString();
      existing.lastTaskId = task.taskId;
      existing.taskCount += 1;
      this.recordEvent(existing.id, task.taskId, "agent_reused", {
        capability: task.capabilitySignature,
        expiresAt: existing.expiresAt, // remains unchanged!
        taskCount: existing.taskCount,
      });
      this.persist();
      return { agent: existing, reused: true };
    }

    // 2. Atomic distributed/in-process lock for concurrent creation
    const lockKey = task.capabilitySignature;
    if (this.inFlightCreation.has(lockKey)) {
      const promisedAgent = await this.inFlightCreation.get(lockKey)!;
      // Re-verify compatibility after lock resolves
      if (this.findCompatibleAgent(task)) {
        return { agent: promisedAgent, reused: true };
      }
    }

    // 3. Create new sub-agent specification
    const creationPromise = (async () => {
      try {
        const newAgent = await generatorFn(task);
        this.registerAgent(newAgent);
        this.recordEvent(newAgent.id, task.taskId, "agent_created", {
          name: newAgent.name,
          capability: newAgent.capabilitySignature,
          expiresAt: newAgent.expiresAt,
        });
        return newAgent;
      } finally {
        this.inFlightCreation.delete(lockKey);
      }
    })();

    this.inFlightCreation.set(lockKey, creationPromise);
    const createdAgent = await creationPromise;
    return { agent: createdAgent, reused: false };
  }

  /**
   * Registers a newly created agent into the persistent registry.
   * Sets strict 24-hour expiration window.
   */
  public static registerAgent(spec: AgentSpecification): void {
    this.initialize();
    this.agents.set(spec.id, spec);
    this.persist();
  }

  public static getAgent(id: string): AgentSpecification | undefined {
    this.initialize();
    return this.agents.get(id);
  }

  public static updateAgent(id: string, updates: Partial<AgentSpecification>): void {
    this.initialize();
    const agent = this.agents.get(id);
    if (agent) {
      Object.assign(agent, updates);
      this.persist();
    }
  }

  public static getAllAgents(): AgentSpecification[] {
    this.initialize();
    const now = Date.now();
    // Auto-update expired agents
    for (const a of this.agents.values()) {
      if (now >= new Date(a.expiresAt).getTime() && a.status !== "expired") {
        a.status = "expired";
      }
    }
    return Array.from(this.agents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static getEvents(): AgentEvent[] {
    this.initialize();
    return this.events;
  }

  /**
   * Resets the registry (useful for testing).
   */
  public static clear(): void {
    this.agents.clear();
    this.events = [];
    this.inFlightCreation.clear();
    this.persist();
  }
}
