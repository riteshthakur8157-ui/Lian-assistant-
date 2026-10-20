import React, { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { ParticleCore, AssistantState, OrbTheme } from "./components/particles/ParticleCore";
import { TopBar } from "./components/dashboard/TopBar";
import { ChatPanel, ChatMessage, FileAttachment } from "./components/chat/ChatPanel";
import { AgentDrawer } from "./components/agents/AgentDrawer";
import { WorkspaceModal } from "./components/workspace/WorkspaceModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { PCControlModal } from "./components/pc/PCControlModal";
import { initAuth } from "./services/firebase";

export default function App() {
  const [state, setState] = useState<AssistantState>("IDLE");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [theme, setTheme] = useState<OrbTheme>("dark");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  const [runningTasksCount, setRunningTasksCount] = useState<number>(0);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isPCOpen, setIsPCOpen] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    language: "Hinglish",
    voice: "Aoede",
    model: "gemini-2.5-flash",
    particleDensity: "medium" as "low" | "medium" | "high",
    proactivity: "balanced" as "low" | "balanced" | "high",
    bargeInEnabled: true,
  });

  // Audio Context and Stream References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeAudioSourceRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // 1. Initialize Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => setUser(currentUser),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  // 2. Poll Tasks Count & System Status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/system/status");
        if (res.ok) {
          const data = await res.json();
          setOnline(true);
          setRunningTasksCount(data.runningTasks || 0);
          if (data.settings) {
            setSettings((prev) => ({ ...prev, ...data.settings }));
          }
        }
      } catch {
        setOnline(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // 3. Audio Amplitude Monitor Loop for Web Audio API
  const startAudioMeter = (analyser: AnalyserNode) => {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
      }
      const avg = sum / buffer.length;
      const normalized = Math.min(1.0, avg / 128);
      setAudioLevel(normalized);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const stopAudioMeter = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  };

  // 4. Voice Listening Pipeline (with SpeechRecognition & Web Audio stream)
  const startListening = async () => {
    // Stop any active assistant speech (Barge-In)
    interruptSpeech();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      startAudioMeter(analyser);
      setState("LISTENING");

      // Browser Speech Recognition for user spoken query transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = settings.language === "Hindi" ? "hi-IN" : "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          if (transcript) {
            stopListening();
            handleSendMessage(transcript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition notice:", e.error);
          stopListening();
        };

        recognition.onend = () => {
          if (state === "LISTENING") {
            stopListening();
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setState("ERROR");
      setTimeout(() => setState("IDLE"), 2500);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    stopAudioMeter();
    if (state === "LISTENING") {
      setState("IDLE");
    }
  };

  const browserTtsIntervalRef = useRef<any>(null);

  // 5. Barge-in / Interruption of Lina's speech
  const interruptSpeech = () => {
    if (activeAudioSourceRef.current) {
      activeAudioSourceRef.current.pause();
      activeAudioSourceRef.current.currentTime = 0;
      activeAudioSourceRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (browserTtsIntervalRef.current) {
      clearInterval(browserTtsIntervalRef.current);
      browserTtsIntervalRef.current = null;
    }
    stopAudioMeter();
    if (state === "SPEAKING" || state === "THINKING") {
      setState("IDLE");
    }
  };

  // Browser Speech Synthesis fallback (0 quota used, instant, works offline)
  const speakWithBrowserTts = (text: string) => {
    interruptSpeech();
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setState("IDLE");
      return;
    }

    // Clean markdown and non-spoken notes
    const clean = text
      .replace(/[*_#`[\]()]/g, " ")
      .replace(/\*\(Note:.*?\)\*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      setState("IDLE");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice =
      voices.find((v) => v.lang.includes("hi") || v.lang.includes("IN")) ||
      voices.find(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("samantha")
      ) ||
      voices[0];

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    setState("SPEAKING");

    // Animate audioLevel so green particles pulse in sync with spoken voice
    let step = 0;
    browserTtsIntervalRef.current = setInterval(() => {
      step++;
      const simulatedAudio = 0.28 + 0.32 * Math.abs(Math.sin(step * 0.4));
      setAudioLevel(simulatedAudio);
    }, 70);

    utterance.onend = () => {
      if (browserTtsIntervalRef.current) {
        clearInterval(browserTtsIntervalRef.current);
        browserTtsIntervalRef.current = null;
      }
      stopAudioMeter();
      setState("IDLE");
    };

    utterance.onerror = () => {
      if (browserTtsIntervalRef.current) {
        clearInterval(browserTtsIntervalRef.current);
        browserTtsIntervalRef.current = null;
      }
      stopAudioMeter();
      setState("IDLE");
    };

    window.speechSynthesis.speak(utterance);
  };

  // 6. Play Response Audio via Web Audio API for Live Waveform Reactive Particles
  const playAudioResponse = (audioBase64: string) => {
    interruptSpeech();
    setState("SPEAKING");

    try {
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      activeAudioSourceRef.current = audio;

      // Connect to Web Audio analyser to drive green glowing particles
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      analyserRef.current = analyser;

      startAudioMeter(analyser);

      audio.onended = () => {
        stopAudioMeter();
        setState("IDLE");
        activeAudioSourceRef.current = null;
      };

      audio.onerror = () => {
        stopAudioMeter();
        setState("IDLE");
        activeAudioSourceRef.current = null;
      };

      audio.play().catch((err) => {
        console.warn("Audio autoplay blocked by browser:", err);
        stopAudioMeter();
        setState("IDLE");
      });
    } catch (e) {
      console.error("Audio playback error:", e);
      setState("IDLE");
    }
  };

  // 7. Send Message & Orchestration Pipeline
  const handleSendMessage = async (text: string, attachment?: FileAttachment) => {
    interruptSpeech();

    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachment: attachment
        ? {
            name: attachment.name,
            type: attachment.type,
            size: `${(attachment.size / 1024).toFixed(1)} KB`,
            previewUrl: attachment.previewUrl,
          }
        : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setState("THINKING");

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.text }],
      }));

      const attachmentsPayload = attachment
        ? [
            {
              name: attachment.name,
              mimeType: attachment.type,
              dataBase64: attachment.dataBase64,
              textContent: attachment.textContent,
            },
          ]
        : [];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          attachments: attachmentsPayload,
          voice: true,
          voiceName: settings.voice,
          clientContext: {
            language: settings.language,
            model: settings.model,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process request");
      }

      const linaMsg: ChatMessage = {
        id: "msg_" + Date.now(),
        role: "lina",
        text: data.text || "Main aapki madad karne ke liye yahan hoon.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolActions: data.toolActions || [],
        subAgent: data.subAgent,
      };

      setMessages((prev) => [...prev, linaMsg]);

      // Automatic browser tab launch for WhatsApp Web if requested
      const lowerReq = text.toLowerCase();
      if (
        (lowerReq.includes("whatsapp") && (lowerReq.includes("kholo") || lowerReq.includes("open") || lowerReq.includes("web"))) ||
        (data.toolActions && data.toolActions.some((a: any) => a.action?.includes("whatsapp.open") || a.summary?.includes("WhatsApp Web")))
      ) {
        const isRakesh = lowerReq.includes("rakesh");
        const cleanPhone = isRakesh ? "919811122334" : "";
        const waUrl = cleanPhone
          ? `https://web.whatsapp.com/send?phone=${cleanPhone}`
          : `https://web.whatsapp.com`;
        try {
          window.open(waUrl, "_blank", "noopener,noreferrer");
        } catch (e) {
          console.warn("Popup blocked:", e);
        }
      }

      // If server WAV audio returned, play it; else if useClientTts, speak via browser synthesis; otherwise return to IDLE
      if (data.audioBase64) {
        playAudioResponse(data.audioBase64);
      } else if (data.useClientTts && data.text) {
        speakWithBrowserTts(data.text);
      } else {
        setState("IDLE");
      }
    } catch (err: any) {
      console.error("Orchestration error:", err);
      setState("ERROR");
      const errorMsg: ChatMessage = {
        id: "msg_" + Date.now(),
        role: "lina",
        text: `Maaf kijiye, ek technical issue aaya: ${err.message || "Network error"}. Kripya dobara try kijiye.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setTimeout(() => setState("IDLE"), 3000);
    }
  };

  // 8. Emergency Stop All Tasks
  const handleStopAllTasks = async () => {
    interruptSpeech();
    try {
      await fetch("/api/tasks/stop-all", { method: "POST" });
      setRunningTasksCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const themeBackgrounds: Record<OrbTheme, string> = {
    dark: "radial-gradient(120% 80% at 50% 35%, #171c40 0%, #0a0d1f 60%, #04050d 100%)",
    sunset: "radial-gradient(120% 80% at 50% 35%, #fff6ef 0%, #ffe7e1 60%, #fbd8e8 100%)",
    light: "radial-gradient(120% 80% at 50% 35%, #ffffff 0%, #f4f6fb 60%, #eceff7 100%)",
    red: "radial-gradient(120% 80% at 50% 35%, #2a0a10 0%, #120508 60%, #050203 100%)",
  };

  return (
    <main
      className="relative w-screen h-screen overflow-hidden font-sans select-none transition-colors duration-500"
      style={{
        background: themeBackgrounds[theme] || themeBackgrounds.dark,
        color: theme === "light" || theme === "sunset" ? "#1d2340" : "#ffffff",
      }}
    >
      {/* 3D Particle Scene Viewport (100% Unobstructed Center) */}
      <ParticleCore
        state={state}
        audioLevel={audioLevel}
        theme={theme}
        onThemeChange={(t) => setTheme(t)}
        onTapCore={() => {
          if (state === "IDLE") {
            startListening();
          } else if (state === "LISTENING") {
            stopListening();
          } else {
            interruptSpeech();
          }
        }}
      />

      {/* Top Bar with Assistant Info, Provider Status, Workspace & Settings */}
      <TopBar
        online={online}
        modelName={settings.model}
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAgents={() => setIsAgentsOpen(true)}
        onOpenWorkspace={() => setIsWorkspaceOpen(true)}
        onOpenPCControl={() => setIsPCOpen(true)}
        onStopAllTasks={handleStopAllTasks}
        runningTasksCount={runningTasksCount}
      />

      {/* Center Dynamic Status Tag */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/40 border border-neutral-800/80 backdrop-blur-sm text-xs font-mono tracking-wider">
          <span
            className={`w-2 h-2 rounded-full ${
              state === "LISTENING"
                ? "bg-cyan-400 animate-ping"
                : state === "THINKING"
                ? "bg-amber-400"
                : state === "SPEAKING"
                ? "bg-emerald-400 animate-pulse"
                : state === "ERROR"
                ? "bg-red-400"
                : "bg-blue-500"
            }`}
          />
          <span className="text-neutral-300 uppercase">{state}</span>
        </div>
      </div>

      {/* Consolidated Collapsible Bottom Chat Dock */}
      <ChatPanel
        state={state}
        onSendMessage={handleSendMessage}
        onStartListening={startListening}
        onStopListening={stopListening}
        onInterruptSpeech={interruptSpeech}
        audioLevel={audioLevel}
        messages={messages}
      />

      {/* Modals & Drawers */}
      <PCControlModal
        isOpen={isPCOpen}
        onClose={() => setIsPCOpen(false)}
        onTriggerVoiceCommand={(cmd) => handleSendMessage(cmd)}
        assistantState={state}
        activeContactName={(() => {
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const txt = (lastUser?.text || "").toLowerCase();
          if (txt.includes("rakesh")) return "CA Rakesh";
          if (txt.includes("amit")) return "Amit Sharma";
          if (txt.includes("pooja")) return "Pooja Verma";
          if (txt.includes("rohit")) return "Rohit Tech Lead";
          if (txt.includes("neha")) return "Neha Designer";
          if (txt.includes("mummy")) return "Mummy";
          return undefined;
        })()}
        audioLevel={audioLevel}
      />

      <AgentDrawer
        isOpen={isAgentsOpen}
        onClose={() => setIsAgentsOpen(false)}
        onRunAction={(prompt) => handleSendMessage(prompt)}
      />

      <WorkspaceModal
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        user={user}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={async (updated) => {
          setSettings((prev) => ({ ...prev, ...updated }));
          await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });
        }}
        onClearHistory={() => setMessages([])}
      />
    </main>
  );
}
