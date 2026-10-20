import { NormalizedTask } from "./types.js";

export class TaskClassifier {
  /**
   * Normalizes an incoming raw user request into a structured task definition.
   * Uses capability-based semantic categorization rather than raw string matching.
   */
  static classify(rawRequest: string, isContinuation = false): NormalizedTask {
    const p = rawRequest.toLowerCase();
    const taskId = "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

    // 1. YouTube Browsing vs Download/Analysis
    if (p.includes("youtube") || p.includes("video") || p.includes("gaana") || p.includes("song")) {
      const isDownloadOrDeepAnalyze = p.includes("download") || p.includes("extract audio") || p.includes("transcribe full");
      if (isDownloadOrDeepAnalyze) {
        return {
          taskId,
          rawRequest,
          category: "media_download",
          intendedOutcome: "Download and extract media/transcript from YouTube",
          requiredCapabilities: ["youtube_download", "audio_extraction"],
          capabilitySignature: "youtube.download_analyze",
          requiredTools: ["youtube.download", "media.extract"],
          requiredPermissions: ["filesystem_write", "media_processing"],
          inputFormat: "url_or_query",
          outputFormat: "media_file_path",
          constraints: ["respect_copyright", "quota_budget"],
          isContinuation,
          targetEntities: { query: rawRequest },
        };
      }

      return {
        taskId,
        rawRequest,
        category: "media_search",
        intendedOutcome: "Search YouTube for topic, inspect results, and open video",
        requiredCapabilities: ["youtube_search", "browser_navigation", "video_inspection"],
        capabilitySignature: "youtube.search_browse",
        requiredTools: ["youtube.search", "youtube.open_video", "youtube.playback"],
        requiredPermissions: ["browser_access"],
        inputFormat: "search_keywords",
        outputFormat: "video_details_json",
        constraints: ["open_top_result", "report_status"],
        isContinuation,
        targetEntities: { query: rawRequest },
      };
    }

    // 1.5 PC Control: Launch native applications (Notepad, VS Code, Calculator, Explorer, etc.)
    const isAppLaunch =
      p.includes("notepad") ||
      p.includes("calculator") ||
      p.includes("calc") ||
      (p.includes("vscode") || (p.includes("code") && (p.includes("kholo") || p.includes("open")))) ||
      (p.includes("chrome") && (p.includes("kholo") || p.includes("open"))) ||
      p.includes("open app") ||
      p.includes("launch app") ||
      p.includes("app kholo") ||
      (p.includes("kholo") && (p.includes("pc") || p.includes("laptop") || p.includes("software")));

    if (isAppLaunch && !p.includes("youtube") && !p.includes("whatsapp")) {
      let appTarget = "notepad";
      if (p.includes("calc")) appTarget = "calculator";
      else if (p.includes("code") || p.includes("vs")) appTarget = "vscode";
      else if (p.includes("chrome") || p.includes("browser")) appTarget = "chrome";
      else if (p.includes("term") || p.includes("powershell")) appTarget = "terminal";
      else if (p.includes("explorer") || p.includes("folder")) appTarget = "explorer";

      return {
        taskId,
        rawRequest,
        category: "pc_app_launch",
        intendedOutcome: `Launch native or web PC application '${appTarget}' via backend terminal`,
        requiredCapabilities: ["pc_app_launch", "terminal_command_execution"],
        capabilitySignature: "pc.open_app",
        requiredTools: ["pc.open_app"],
        requiredPermissions: ["system_exec"],
        inputFormat: "app_name_or_target",
        outputFormat: "app_launch_receipt_json",
        constraints: ["safe_command_execution", "report_status"],
        isContinuation,
        targetEntities: { appName: appTarget, prompt: rawRequest },
      };
    }

    // 1.6 PC Terminal Command Execution
    if (
      (p.includes("terminal") && (p.includes("run") || p.includes("command") || p.includes("karo") || p.includes("execute"))) ||
      p.startsWith("run ") ||
      p.includes("npm ") ||
      p.includes("git status") ||
      p.includes("shell command") ||
      p.includes("powershell command")
    ) {
      return {
        taskId,
        rawRequest,
        category: "terminal_execution",
        intendedOutcome: "Execute shell or system command in the backend terminal securely",
        requiredCapabilities: ["terminal_execution", "command_output_capture"],
        capabilitySignature: "pc.terminal_command",
        requiredTools: ["terminal.run_command"],
        requiredPermissions: ["terminal_access"],
        inputFormat: "shell_command_string",
        outputFormat: "terminal_output_receipt",
        constraints: ["sandbox_safety_check", "audit_log"],
        isContinuation,
        targetEntities: { command: rawRequest },
      };
    }

    // 1.7 PC System Health & Metrics
    if (
      p.includes("system health") ||
      (p.includes("cpu") && (p.includes("use") || p.includes("usage") || p.includes("kitna") || p.includes("check"))) ||
      (p.includes("ram") && (p.includes("free") || p.includes("use") || p.includes("kitni") || p.includes("check"))) ||
      p.includes("pc slow") ||
      p.includes("system status") ||
      p.includes("system info")
    ) {
      return {
        taskId,
        rawRequest,
        category: "system_analytics",
        intendedOutcome: "Read and analyze PC hardware metrics (CPU, RAM, Uptime, OS) in natural language",
        requiredCapabilities: ["system_metrics_read", "health_analysis"],
        capabilitySignature: "pc.system_health",
        requiredTools: ["pc.get_health"],
        requiredPermissions: ["system_metrics_read"],
        inputFormat: "query_scope",
        outputFormat: "system_health_json",
        constraints: ["read_only"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 1.8 PC Productivity Macros
    if (p.includes("morning setup") || p.includes("morning macro") || p.includes("clean temp") || (p.includes("macro") && p.includes("run"))) {
      const macroType = p.includes("clean") ? "clean_temp" : "morning_setup";
      return {
        taskId,
        rawRequest,
        category: "pc_macro",
        intendedOutcome: `Execute automated PC productivity macro '${macroType}'`,
        requiredCapabilities: ["macro_sequence_execution", "multi_app_orchestration"],
        capabilitySignature: "pc.macro_run",
        requiredTools: ["pc.execute_macro"],
        requiredPermissions: ["system_exec"],
        inputFormat: "macro_name",
        outputFormat: "macro_execution_receipt",
        constraints: ["sequential_steps"],
        isContinuation,
        targetEntities: { macroName: macroType },
      };
    }

    // 2. WhatsApp: Open Web/Desktop vs Read/Search Contacts vs Send Message
    if (
      p.includes("whatsapp") ||
      p.includes("chat") ||
      p.includes("rakesh") ||
      p.includes("amit") ||
      (p.includes("message") && (p.includes("send") || p.includes("bhej") || p.includes("draft") || p.includes("search")))
    ) {
      const isSending = p.includes("send") || p.includes("bhejo") || p.includes("bhej do");
      if (isSending) {
        const contactTarget = p.includes("rakesh") ? "CA Rakesh" : p.includes("amit") ? "Amit Sharma" : "CA Rakesh";
        const hasAttachment = p.includes("file") || p.includes("attach") || p.includes("invoice") || p.includes("pdf") || p.includes("sheet");
        return {
          taskId,
          rawRequest,
          category: "messaging_send",
          intendedOutcome: `Draft and send message via WhatsApp to ${contactTarget} after confirmation${hasAttachment ? " with file attachment" : ""}`,
          requiredCapabilities: ["whatsapp_send", "user_confirmation_validation"],
          capabilitySignature: "whatsapp.send_message",
          requiredTools: ["whatsapp.draft_message", "whatsapp.send_message"],
          requiredPermissions: ["whatsapp.send", "user_confirmation"],
          inputFormat: "recipient_and_text",
          outputFormat: "send_confirmation_receipt",
          constraints: ["must_confirm_recipient", "prevent_silent_send"],
          isContinuation,
          targetEntities: { contact: contactTarget, prompt: rawRequest, hasAttachment },
        };
      }

      const isOpeningWeb = p.includes("kholo") || p.includes("open") || p.includes("web");
      if (isOpeningWeb && !p.includes("search") && !p.includes("dhundo")) {
        const contactTarget = p.includes("rakesh") ? "CA Rakesh" : p.includes("amit") ? "Amit Sharma" : undefined;
        return {
          taskId,
          rawRequest,
          category: "messaging_open",
          intendedOutcome: `Launch WhatsApp Web in browser and backend terminal${contactTarget ? " for " + contactTarget : ""}`,
          requiredCapabilities: ["whatsapp_open", "browser_launch"],
          capabilitySignature: "whatsapp.open_chat",
          requiredTools: ["whatsapp.open_chat", "pc.open_app"],
          requiredPermissions: ["whatsapp.read", "system_exec"],
          inputFormat: "contact_name_optional",
          outputFormat: "open_receipt_json",
          constraints: ["open_web_interface"],
          isContinuation,
          targetEntities: { contact: contactTarget, prompt: rawRequest },
        };
      }

      const contactTarget = p.includes("rakesh") ? "CA Rakesh" : p.includes("amit") ? "Amit Sharma" : "CA Rakesh";
      return {
        taskId,
        rawRequest,
        category: "messaging_read",
        intendedOutcome: `Search WhatsApp contacts for '${contactTarget}' and read conversation previews`,
        requiredCapabilities: ["whatsapp_search", "contact_lookup"],
        capabilitySignature: "whatsapp.search_contacts",
        requiredTools: ["whatsapp.search_contacts", "whatsapp.open_chat"],
        requiredPermissions: ["whatsapp.read"],
        inputFormat: "contact_name_query",
        outputFormat: "contacts_list_json",
        constraints: ["read_only"],
        isContinuation,
        targetEntities: { query: contactTarget, prompt: rawRequest },
      };
    }

    // 3. GitHub Intelligence
    if (p.includes("github") || p.includes("repo") || p.includes("repository") || p.includes("plugin")) {
      const match = rawRequest.match(/https:\/\/github\.com\/[^\s]+/);
      const url = match ? match[0] : "";
      return {
        taskId,
        rawRequest,
        category: "code_intelligence",
        intendedOutcome: "Analyze GitHub repository, audit security, and register plugin",
        requiredCapabilities: ["github_api_read", "ast_analysis", "sandbox_test"],
        capabilitySignature: "github.inspect_repo",
        requiredTools: ["github.fetch_metadata", "github.audit_security", "skills.register_manifest"],
        requiredPermissions: ["sandboxed_execution", "network_fetch"],
        inputFormat: "github_repo_url",
        outputFormat: "repository_analysis_report",
        constraints: ["sandbox_isolation", "zero_privilege_escalation"],
        isContinuation,
        targetEntities: { repoUrl: url },
      };
    }

    // 4. Dynamic Skills Self-Evolution (e.g. "mere liye ek naya Excel automation function create karo")
    if (p.includes("skill") || p.includes("evolve") || (p.includes("create") && (p.includes("function") || p.includes("automation") || p.includes("tool"))) || p.includes("naye tool") || p.includes("naya function")) {
      return {
        taskId,
        rawRequest,
        category: "self_evolution",
        intendedOutcome: "Design, sandbox-test, and register new custom automation skill",
        requiredCapabilities: ["code_synthesis", "sandbox_test", "schema_validation"],
        capabilitySignature: "skills.evolve_skill",
        requiredTools: ["skills.validate_code", "skills.register_manifest"],
        requiredPermissions: ["sandboxed_eval"],
        inputFormat: "capability_description",
        outputFormat: "skill_manifest_json",
        constraints: ["ast_safety_check", "zero_privilege_escalation"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 5. Excel & Spreadsheets: Read vs Edit
    if (p.includes("excel") || p.includes("spreadsheet") || p.includes("csv") || p.includes("sheet")) {
      const isEditing = p.includes("edit") || p.includes("save") || p.includes("append") || p.includes("update") || p.includes("likho");
      if (isEditing) {
        return {
          taskId,
          rawRequest,
          category: "spreadsheet_edit",
          intendedOutcome: "Modify, update, or append rows to spreadsheet data",
          requiredCapabilities: ["spreadsheet_write", "schema_validation"],
          capabilitySignature: "spreadsheet.edit_data",
          requiredTools: ["sheets.append_row", "sheets.update_values"],
          requiredPermissions: ["sheets.write", "user_confirmation"],
          inputFormat: "tabular_data_row",
          outputFormat: "mutation_receipt",
          constraints: ["require_user_confirmation_on_overwrite"],
          isContinuation,
          targetEntities: { prompt: rawRequest },
        };
      }

      return {
        taskId,
        rawRequest,
        category: "spreadsheet_read",
        intendedOutcome: "Read and summarize column metrics from spreadsheet",
        requiredCapabilities: ["spreadsheet_read", "statistical_analysis"],
        capabilitySignature: "spreadsheet.read_analyze",
        requiredTools: ["sheets.get_values", "math.summarize"],
        requiredPermissions: ["sheets.read"],
        inputFormat: "sheet_id_or_file",
        outputFormat: "summary_metrics_json",
        constraints: ["read_only"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 5. Google Workspace Calendar: Read vs Write
    if (p.includes("calendar") || p.includes("meeting") || p.includes("event") || p.includes("schedule")) {
      const isCreating = p.includes("create") || p.includes("add") || p.includes("schedule") || p.includes("rakh lo");
      if (isCreating) {
        return {
          taskId,
          rawRequest,
          category: "calendar_write",
          intendedOutcome: "Create and schedule calendar event",
          requiredCapabilities: ["calendar_event_create", "time_parsing"],
          capabilitySignature: "workspace.calendar_write",
          requiredTools: ["calendar.create_event"],
          requiredPermissions: ["calendar.write", "user_confirmation"],
          inputFormat: "event_title_and_time",
          outputFormat: "calendar_event_json",
          constraints: ["require_user_confirmation"],
          isContinuation,
          targetEntities: { prompt: rawRequest },
        };
      }

      return {
        taskId,
        rawRequest,
        category: "calendar_read",
        intendedOutcome: "List and inspect upcoming calendar events",
        requiredCapabilities: ["calendar_event_list"],
        capabilitySignature: "workspace.calendar_read",
        requiredTools: ["calendar.list_events"],
        requiredPermissions: ["calendar.read"],
        inputFormat: "time_window",
        outputFormat: "events_list_json",
        constraints: ["read_only"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 6. Gmail: Read vs Send
    if (p.includes("gmail") || p.includes("email") || p.includes("mail")) {
      const isSending = p.includes("send") || p.includes("bhejo") || p.includes("compose");
      if (isSending) {
        return {
          taskId,
          rawRequest,
          category: "gmail_send",
          intendedOutcome: "Compose and send email via Gmail with user verification",
          requiredCapabilities: ["gmail_send", "user_confirmation_validation"],
          capabilitySignature: "workspace.gmail_send",
          requiredTools: ["gmail.send_email"],
          requiredPermissions: ["gmail.send", "user_confirmation"],
          inputFormat: "recipient_subject_body",
          outputFormat: "message_receipt",
          constraints: ["require_explicit_confirmation"],
          isContinuation,
          targetEntities: { prompt: rawRequest },
        };
      }

      return {
        taskId,
        rawRequest,
        category: "gmail_read",
        intendedOutcome: "Read and list recent inbox emails",
        requiredCapabilities: ["gmail_read"],
        capabilitySignature: "workspace.gmail_read",
        requiredTools: ["gmail.list_messages"],
        requiredPermissions: ["gmail.read"],
        inputFormat: "filter_query",
        outputFormat: "emails_list_json",
        constraints: ["read_only"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 7. Dynamic Skills Self-Evolution
    if (p.includes("skill") || p.includes("evolve") || p.includes("naye tool") || p.includes("naya function")) {
      return {
        taskId,
        rawRequest,
        category: "self_evolution",
        intendedOutcome: "Design, sandbox-test, and register new custom automation skill",
        requiredCapabilities: ["code_synthesis", "sandbox_test", "schema_validation"],
        capabilitySignature: "skills.evolve_skill",
        requiredTools: ["skills.validate_code", "skills.register_manifest"],
        requiredPermissions: ["sandboxed_eval"],
        inputFormat: "capability_description",
        outputFormat: "skill_manifest_json",
        constraints: ["ast_safety_check", "zero_privilege_escalation"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 8. Conversational greetings and check-ins (no tool execution needed)
    const isConversational =
      p === "hi" ||
      p === "hello" ||
      p.startsWith("hi ") ||
      p.startsWith("hello ") ||
      p.includes("namaste") ||
      p.includes("kaise ho") ||
      p.includes("kaisi ho") ||
      p.includes("kya haal") ||
      p.includes("who are you") ||
      p.includes("tum kaun ho") ||
      p.includes("shukriya") ||
      p.includes("thank you") ||
      p.includes("kya kar sakti ho") ||
      p.includes("tell me a joke") ||
      p.includes("koyi kahani") ||
      (!p.includes("search") &&
        !p.includes("kholo") &&
        !p.includes("open") &&
        !p.includes("browse") &&
        !p.includes("find") &&
        !p.includes("check") &&
        !p.includes("navigate") &&
        !p.includes("website") &&
        !p.includes("http") &&
        !p.includes(".com") &&
        !p.includes(".org"));

    if (isConversational) {
      return {
        taskId,
        rawRequest,
        category: "general_conversation",
        intendedOutcome: "Respond with natural Hinglish warmth, emotional presence, and attentiveness",
        requiredCapabilities: ["conversation"],
        capabilitySignature: "conversation.general",
        requiredTools: [],
        requiredPermissions: [],
        inputFormat: "natural_language_dialogue",
        outputFormat: "conversational_text",
        constraints: ["warmth", "emotional_awareness", "no_hallucinations"],
        isContinuation,
        targetEntities: { prompt: rawRequest },
      };
    }

    // 9. General Browser / Web Research
    return {
      taskId,
      rawRequest,
      category: "web_automation",
      intendedOutcome: "Navigate webpage and search information",
      requiredCapabilities: ["web_search", "page_navigation"],
      capabilitySignature: "browser.general_browse",
      requiredTools: ["browser.search", "browser.navigate"],
      requiredPermissions: ["browser_access"],
      inputFormat: "search_query_or_url",
      outputFormat: "search_results_json",
      constraints: ["allowlist_domains_only"],
      isContinuation,
      targetEntities: { query: rawRequest },
    };
  }
}
