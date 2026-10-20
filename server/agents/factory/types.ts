export type AgentStatus =
  | "planning"
  | "creating"
  | "ready"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "expired";

export interface AgentSpecification {
  id: string;
  name: string;
  purpose: string;
  supportedCategories: string[];
  capabilitySignature: string; // Deterministic capability key
  systemInstructions: string;
  executionStrategy: string[];
  stepByStepPlan: string[];
  requiredTools: string[];
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  requiredPermissions: string[];
  dependencies: string[];
  errorHandling: {
    maxRetries: number;
    retryDelayMs: number;
    timeoutMs: number;
  };
  verificationRules: string[];
  progressReporting: string;
  securityRestrictions: string[];
  loggingRequirements: string[];
  createdAt: string; // UTC ISO
  expiresAt: string; // UTC ISO: strictly createdAt + 24 hours
  lastUsedAt: string; // UTC ISO
  lastTaskId?: string;
  taskCount: number;
  status: AgentStatus;
  version: string;
  configurationHash: string;
}

export interface NormalizedTask {
  taskId: string;
  rawRequest: string;
  category: string;
  intendedOutcome: string;
  requiredCapabilities: string[];
  capabilitySignature: string;
  requiredTools: string[];
  requiredPermissions: string[];
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  isContinuation: boolean;
  targetEntities: Record<string, any>;
}

export interface TaskExecutionResult {
  taskId: string;
  agentId: string;
  status: "completed" | "failed" | "partial";
  summary: string;
  actionsCompleted: string[];
  verification: {
    verified: boolean;
    evidence: string;
    checksPassed: string[];
  };
  artifacts: any[];
  errors: string[];
  executionTimeMs: number;
  outputData?: any;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  taskId: string;
  eventType:
    | "agent_created"
    | "agent_reused"
    | "task_started"
    | "tool_called"
    | "security_violation"
    | "task_completed"
    | "task_failed"
    | "agent_expired";
  eventTimestamp: string;
  eventDetails: Record<string, any>;
}
