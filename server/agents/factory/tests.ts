import { TaskClassifier } from "./classifier.js";
import { AgentRegistry } from "./registry.js";
import { AgentFactory } from "./factory.js";
import { AgentExecutionEngine } from "./engine.js";

export interface TestResult {
  testId: string;
  name: string;
  passed: boolean;
  details: string;
}

export async function runAllTests(): Promise<{ passed: boolean; results: TestResult[] }> {
  const results: TestResult[] = [];
  const logTest = (testId: string, name: string, passed: boolean, details: string) => {
    results.push({ testId, name, passed, details });
    console.log(`[${passed ? "PASS" : "FAIL"}] ${testId}: ${name} - ${details}`);
  };

  // Clear test state
  AgentRegistry.clear();

  // ----------------------------------------------------
  // TEST 1: No matching agent exists -> Create one agent & assign
  // ----------------------------------------------------
  try {
    const task1 = TaskClassifier.classify("Lina, YouTube kholo aur Python automation tutorial search karo.");
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task1, (t) => AgentFactory.createSpecification(t));
    const engine = new AgentExecutionEngine(agent);
    const execResult = await engine.execute(task1);

    const passed = !reused && agent.capabilitySignature === "youtube.search_browse" && execResult.status === "completed";
    logTest("TEST 1", "Create new agent when none exists", passed, `Agent created: ${agent.name} (ID: ${agent.id}), Exec: ${execResult.status}`);
  } catch (e: any) {
    logTest("TEST 1", "Create new agent when none exists", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 2: Matching valid agent exists -> Reuse it
  // ----------------------------------------------------
  try {
    const task2 = TaskClassifier.classify("Lina, YouTube par Python automation search karo.");
    const agentsBefore = AgentRegistry.getAllAgents().length;
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task2, (t) => AgentFactory.createSpecification(t));
    const agentsAfter = AgentRegistry.getAllAgents().length;

    const passed = reused && agentsBefore === agentsAfter;
    logTest("TEST 2", "Reuse existing valid matching agent", passed, `Reused: ${reused}, Agent count remained ${agentsBefore}`);
  } catch (e: any) {
    logTest("TEST 2", "Reuse existing valid matching agent", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 3: Same capability requested with different wording -> Reuse
  // ----------------------------------------------------
  try {
    const task3 = TaskClassifier.classify("Search YouTube for Python tutorials and open a relevant video.");
    const agentsBefore = AgentRegistry.getAllAgents().length;
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task3, (t) => AgentFactory.createSpecification(t));
    const agentsAfter = AgentRegistry.getAllAgents().length;

    const passed = reused && agentsBefore === agentsAfter && agent.capabilitySignature === "youtube.search_browse";
    logTest("TEST 3", "Capability-based reuse with different wording", passed, `Deduplicated to signature: ${task3.capabilitySignature}, Reused: ${reused}`);
  } catch (e: any) {
    logTest("TEST 3", "Capability-based reuse with different wording", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 4: Used several times within 24h -> Never extend expires_at
  // ----------------------------------------------------
  try {
    const task4a = TaskClassifier.classify("Search YouTube for React tutorial");
    const { agent: agentBefore } = await AgentRegistry.getOrCreateAgent(task4a, (t) => AgentFactory.createSpecification(t));
    const originalExpiresAt = agentBefore.expiresAt;

    // Simulate usage later in time
    const task4b = TaskClassifier.classify("Search YouTube for Machine Learning tutorial");
    const { agent: agentAfter } = await AgentRegistry.getOrCreateAgent(task4b, (t) => AgentFactory.createSpecification(t));

    const passed = agentBefore.id === agentAfter.id && agentAfter.expiresAt === originalExpiresAt;
    logTest("TEST 4", "Strict 24h expiration: never extended on reuse", passed, `Original expiresAt: ${originalExpiresAt}, After reuse: ${agentAfter.expiresAt}`);
  } catch (e: any) {
    logTest("TEST 4", "Strict 24h expiration: never extended on reuse", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 5: Agent has expired -> Reject for new assignments, create replacement
  // ----------------------------------------------------
  try {
    const task5 = TaskClassifier.classify("Search YouTube for Docker tutorial");
    const existing = AgentRegistry.findCompatibleAgent(task5);
    if (existing) {
      // Simulate expiration: set expiresAt to 1 hour in the past
      existing.expiresAt = new Date(Date.now() - 3600 * 1000).toISOString();
      AgentRegistry.updateAgent(existing.id, { expiresAt: existing.expiresAt });
    }

    const { agent: newAgent, reused } = await AgentRegistry.getOrCreateAgent(task5, (t) => AgentFactory.createSpecification(t));
    const passed = !reused && newAgent.id !== existing?.id && new Date(newAgent.expiresAt).getTime() > Date.now();
    logTest("TEST 5", "Expired agent rejected, fresh replacement created", passed, `Old agent expired, fresh agent created with 24h lifespan: ${newAgent.id}`);
  } catch (e: any) {
    logTest("TEST 5", "Expired agent rejected, fresh replacement created", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 6: Concurrent identical requests -> Atomic lock creates only 1
  // ----------------------------------------------------
  try {
    // Clear to test fresh concurrency
    AgentRegistry.clear();
    const task6a = TaskClassifier.classify("Analyze GitHub repository https://github.com/microsoft/playwright");
    const task6b = TaskClassifier.classify("Inspect GitHub repository https://github.com/microsoft/playwright");

    // Launch both simultaneously
    const [resA, resB] = await Promise.all([
      AgentRegistry.getOrCreateAgent(task6a, (t) => AgentFactory.createSpecification(t)),
      AgentRegistry.getOrCreateAgent(task6b, (t) => AgentFactory.createSpecification(t)),
    ]);

    const passed = resA.agent.id === resB.agent.id && (resA.reused || resB.reused);
    logTest("TEST 6", "Atomic lock prevents duplicate creation on concurrent requests", passed, `Agent ID A: ${resA.agent.id}, Agent ID B: ${resB.agent.id}`);
  } catch (e: any) {
    logTest("TEST 6", "Atomic lock prevents duplicate creation on concurrent requests", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 7: Agent exists but lacks required permission -> Do not reuse
  // ----------------------------------------------------
  try {
    // Read-only WhatsApp agent
    const readTask = TaskClassifier.classify("Search WhatsApp chat for Amit");
    const { agent: readAgent } = await AgentRegistry.getOrCreateAgent(readTask, (t) => AgentFactory.createSpecification(t));

    // Send task requires "whatsapp.send" and "user_confirmation" permissions
    const sendTask = TaskClassifier.classify("Send message to Amit on WhatsApp");
    const { agent: sendAgent, reused } = await AgentRegistry.getOrCreateAgent(sendTask, (t) => AgentFactory.createSpecification(t));

    const passed = !reused && readAgent.id !== sendAgent.id && sendAgent.requiredPermissions.includes("whatsapp.send");
    logTest("TEST 7", "Permission mismatch prevents unauthorized reuse", passed, `Read agent: ${readAgent.id}, Send agent: ${sendAgent.id} (permissions enforced)`);
  } catch (e: any) {
    logTest("TEST 7", "Permission mismatch prevents unauthorized reuse", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 8: Application restart -> Reload & preserve original expiration
  // ----------------------------------------------------
  try {
    const allAgentsBefore = AgentRegistry.getAllAgents();
    const targetAgent = allAgentsBefore[0];
    const originalExp = targetAgent.expiresAt;

    // Simulate restart by clearing memory and re-initializing from disk
    (AgentRegistry as any).initialized = false;
    AgentRegistry.initialize();

    const reloaded = AgentRegistry.getAgent(targetAgent.id);
    const passed = reloaded !== undefined && reloaded.expiresAt === originalExp;
    logTest("TEST 8", "Application restart recovers persisted agents with exact expiration", passed, `Reloaded agent ${reloaded?.id}, expiration intact: ${reloaded?.expiresAt}`);
  } catch (e: any) {
    logTest("TEST 8", "Application restart recovers persisted agents with exact expiration", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 9: Task fails during execution -> Return clear failure, no false success
  // ----------------------------------------------------
  try {
    const task9 = TaskClassifier.classify("Open YouTube and play video");
    const { agent } = await AgentRegistry.getOrCreateAgent(task9, (t) => AgentFactory.createSpecification(t));
    const engine = new AgentExecutionEngine(agent);

    // Provide an invalid malformed target that triggers failure
    task9.targetEntities = { query: "" };
    // Force a validation failure by changing capabilitySignature temporarily
    task9.capabilitySignature = "corrupted.signature";
    const result = await engine.execute(task9);

    const passed = result.status === "failed" && !result.verification.verified && result.errors.length > 0;
    logTest("TEST 9", "Task error handling validated without false verification", passed, `Rejection correctly handled (expectedErrorCaught: true, verified: ${result.verification.verified})`);
  } catch (e: any) {
    logTest("TEST 9", "Task error handling validated without false verification", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 10: Agent expires while running -> Safe handling, no new assignments
  // ----------------------------------------------------
  try {
    const task10 = TaskClassifier.classify("Search YouTube for tutorial");
    const { agent } = await AgentRegistry.getOrCreateAgent(task10, (t) => AgentFactory.createSpecification(t));

    // Fast-forward expiration to now
    agent.expiresAt = new Date().toISOString();
    AgentRegistry.updateAgent(agent.id, { expiresAt: agent.expiresAt });

    const nextTask = TaskClassifier.classify("Search YouTube for another video");
    const matching = AgentRegistry.findCompatibleAgent(nextTask);

    const passed = matching === null;
    logTest("TEST 10", "Agent expiring during lifecycle accepts no new assignments", passed, `findCompatibleAgent returned null for expired agent.`);
  } catch (e: any) {
    logTest("TEST 10", "Agent expiring during lifecycle accepts no new assignments", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 11: New unrelated capability requested -> Creates specialized agent
  // ----------------------------------------------------
  try {
    const task11 = TaskClassifier.classify("Create an Excel revenue summary function");
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task11, (t) => AgentFactory.createSpecification(t));

    const passed = !reused && agent.capabilitySignature === "skills.evolve_skill";
    logTest("TEST 11", "New unrelated capability creates specialized sub-agent", passed, `Created: ${agent.name} (${agent.capabilitySignature})`);
  } catch (e: any) {
    logTest("TEST 11", "New unrelated capability creates specialized sub-agent", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 12: Generated agent requests unauthorized tool -> Deny and record security event
  // ----------------------------------------------------
  try {
    const task12 = TaskClassifier.classify("Search YouTube tutorial");
    const { agent } = await AgentRegistry.getOrCreateAgent(task12, (t) => AgentFactory.createSpecification(t));
    const engine = new AgentExecutionEngine(agent);

    let caughtViolation = false;
    try {
      // Intentionally call unauthorized tool
      (engine as any).assertToolAllowed("unauthorized_shell_execution");
    } catch (secErr: any) {
      caughtViolation = secErr.message.includes("Security Violation");
    }

    const events = AgentRegistry.getEvents();
    const recordedEvent = events.some((ev) => ev.eventType === "security_violation");

    const passed = caughtViolation && recordedEvent;
    logTest("TEST 12", "Unauthorized tool call denied and recorded in audit log", passed, `Security violation blocked: ${caughtViolation}, Event recorded: ${recordedEvent}`);
  } catch (e: any) {
    logTest("TEST 12", "Unauthorized tool call denied and recorded in audit log", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 13: PC Control: Notepad Launch via Terminal Execution
  // ----------------------------------------------------
  try {
    const task13 = TaskClassifier.classify("Lina, mere PC par Notepad kholo");
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task13, (t) => AgentFactory.createSpecification(t));
    const engine = new AgentExecutionEngine(agent);
    const execResult = await engine.execute(task13);

    const passed = agent.capabilitySignature === "pc.open_app" && execResult.status === "completed" && execResult.verification.verified;
    logTest("TEST 13", "PC Control: Launch Notepad via backend terminal", passed, `Agent: ${agent.name}, Verified: ${execResult.verification.verified}, Command: ${execResult.outputData?.commandExecuted}`);
  } catch (e: any) {
    logTest("TEST 13", "PC Control: Launch Notepad via backend terminal", false, e.message);
  }

  // ----------------------------------------------------
  // TEST 14: WhatsApp: CA Rakesh contact search & file attachment
  // ----------------------------------------------------
  try {
    const task14 = TaskClassifier.classify("Lina, CA Rakesh ko search karo aur audit file attach karke message bhej do");
    const { agent, reused } = await AgentRegistry.getOrCreateAgent(task14, (t) => AgentFactory.createSpecification(t));
    const engine = new AgentExecutionEngine(agent);
    const execResult = await engine.execute(task14);

    const passed = agent.capabilitySignature === "whatsapp.send_message" && execResult.status === "completed" && execResult.outputData?.recipient.includes("CA Rakesh");
    logTest("TEST 14", "WhatsApp: CA Rakesh contact match and attachment dispatch", passed, `Recipient: ${execResult.outputData?.recipient}, Attachment: ${execResult.outputData?.attachment?.name || "none"}`);
  } catch (e: any) {
    logTest("TEST 14", "WhatsApp: CA Rakesh contact match and attachment dispatch", false, e.message);
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${results.filter((r) => r.passed).length} / ${results.length} PASSED`);
  console.log(`========================================\n`);

  return { passed: allPassed, results };
}

// Auto-run if executed directly via tsx
if (import.meta.url.endsWith(process.argv[1] || "")) {
  runAllTests().then((res) => {
    process.exit(res.passed ? 0 : 1);
  });
}
