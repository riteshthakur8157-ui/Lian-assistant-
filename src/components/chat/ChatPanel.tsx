import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Send,
  Paperclip,
  Square,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  X,
  Volume2,
  Sparkles,
  Bot,
  User as UserIcon,
  Zap,
  Clock,
  ExternalLink,
  Play,
} from "lucide-react";
import { AssistantState } from "../particles/ParticleCore";

export interface ChatMessage {
  id: string;
  role: "user" | "lina";
  text: string;
  timestamp: string;
  toolActions?: Array<{ agent: string; action: string; summary: string }>;
  subAgent?: {
    id: string;
    name: string;
    capability: string;
    expiresAt: string;
    reused: boolean;
  };
  attachment?: {
    name: string;
    type: string;
    size: string;
    previewUrl?: string;
  };
}

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  dataBase64?: string;
  textContent?: string;
  previewUrl?: string;
}

interface ChatPanelProps {
  state: AssistantState;
  onSendMessage: (text: string, attachment?: FileAttachment) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onInterruptSpeech: () => void;
  audioLevel: number;
  messages: ChatMessage[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  state,
  onSendMessage,
  onStartListening,
  onStopListening,
  onInterruptSpeech,
  audioLevel,
  messages,
}) => {
  const [inputText, setInputText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (expanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded]);

  // Handle file attachment selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 15MB
    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isTextDoc =
      file.type.includes("text") ||
      file.type.includes("json") ||
      file.type.includes("csv") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json");

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        setAttachment({
          name: file.name,
          type: file.type,
          size: file.size,
          dataBase64: base64Data,
          previewUrl: result,
        });
      };
      reader.readAsDataURL(file);
    } else if (isTextDoc) {
      const text = await file.text();
      setAttachment({
        name: file.name,
        type: file.type || "text/plain",
        size: file.size,
        textContent: text,
      });
    } else {
      // PDF or binary document
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        setAttachment({
          name: file.name,
          type: file.type || "application/pdf",
          size: file.size,
          dataBase64: base64Data,
          textContent: `[Binary document file: ${file.name}, size: ${(file.size / 1024).toFixed(1)} KB]`,
        });
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed && !attachment) return;

    onSendMessage(trimmed, attachment || undefined);
    setInputText("");
    setAttachment(null);
    setExpanded(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isBusy = state === "THINKING" || state === "SPEAKING";

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-3 sm:px-4 pointer-events-auto">
      <div className="flex flex-col rounded-2xl bg-black/85 border border-cyan-950/60 shadow-[0_8px_32px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300">
        {/* Top collapse / status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-900 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                state === "LISTENING"
                  ? "bg-cyan-400"
                  : state === "THINKING"
                  ? "bg-amber-400"
                  : state === "SPEAKING"
                  ? "bg-emerald-400"
                  : state === "ERROR"
                  ? "bg-red-400"
                  : "bg-blue-500"
              }`}
            />
            <span className="text-xs font-medium tracking-wide text-neutral-300">
              Lina is {state}
            </span>
            {isBusy && (
              <span className="text-[11px] text-cyan-400 animate-pulse font-mono hidden sm:inline">
                {state === "THINKING" ? "Processing intent & tools..." : "Speaking response..."}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Real-time Waveform Strip */}
            {(state === "LISTENING" || state === "SPEAKING") && (
              <div className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-neutral-900">
                <Volume2 className="w-3 h-3 text-cyan-400 mr-1" />
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-cyan-400 transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(18, audioLevel * 30 * (1 + Math.sin(i * 1.2))))}px`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Stop / Barge-in Button */}
            {isBusy && (
              <button
                onClick={onInterruptSpeech}
                title="Barge-in / Stop Speech"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/80 border border-red-800 text-red-300 text-xs hover:bg-red-900 transition cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}

            {/* Expand / Collapse Toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              title={expanded ? "Collapse conversation history" : "Expand conversation history"}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 text-xs transition cursor-pointer"
            >
              <span>{expanded ? "Hide Chat" : "Show Chat"}</span>
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Conversation History */}
        {expanded && (
          <div className="max-h-72 overflow-y-auto p-4 space-y-3.5 bg-neutral-950/90 text-sm">
            {messages.length === 0 ? (
              <div className="text-center py-6 text-neutral-500">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-cyan-500/60" />
                <p className="text-xs">
                  Namaste! Main hoon Lina. Aap voice ya text se Hindi, English ya Hinglish mein baat kar sakte hain.
                </p>
                {/* Quick Prompts */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {[
                    "Notepad kholo",
                    "WhatsApp web pe kholo",
                    "CA Rakesh ko search karo",
                    "CA Rakesh ko file attach karke message bhej do",
                    "System health check karo",
                    "Morning setup macro run karo",
                    "YouTube par Python automation search karo",
                  ].map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputText(prompt);
                      }}
                      className="px-2.5 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs transition cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-500">
                    {m.role === "user" ? (
                      <>
                        <span>You</span>
                        <UserIcon className="w-3 h-3 text-cyan-400" />
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-cyan-300" />
                        <span className="text-cyan-400 font-medium">Lina</span>
                      </>
                    )}
                    <span>• {m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                      m.role === "user"
                        ? "bg-cyan-950/50 border border-cyan-800/40 text-cyan-50 rounded-br-none"
                        : "bg-neutral-900/90 border border-neutral-800 text-neutral-200 rounded-bl-none shadow-md"
                    }`}
                  >
                    {/* Attachment preview if user uploaded a file */}
                    {m.attachment && (
                      <div className="flex items-center gap-2 p-2 mb-2 rounded bg-black/40 border border-neutral-800 text-xs text-neutral-300">
                        {m.attachment.previewUrl ? (
                          <img
                            src={m.attachment.previewUrl}
                            alt="preview"
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-cyan-400" />
                        )}
                        <div className="overflow-hidden">
                          <p className="font-medium truncate">{m.attachment.name}</p>
                          <p className="text-[10px] text-neutral-500">{m.attachment.size}</p>
                        </div>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {/* Dynamic Sub-Agent badge */}
                    {m.subAgent && (
                      <div className="mt-2.5 pt-2 border-t border-neutral-800/70">
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-[11px] font-mono text-indigo-300">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-semibold text-neutral-200">
                              {m.subAgent.reused ? "♻️ Sub-Agent Reused:" : "✨ New Sub-Agent:"}
                            </span>
                            <span className="truncate text-indigo-200">{m.subAgent.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-amber-400/90 shrink-0">
                            <Clock className="w-3 h-3" />
                            <span>24h Window</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Agent execution badges */}
                    {m.toolActions && m.toolActions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.toolActions.map((ta, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-mono bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30"
                          >
                            <span className="font-bold">[{ta.agent}]</span>
                            <span className="text-neutral-400 truncate">{ta.summary}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Interactive Action Launcher if WhatsApp or App is mentioned */}
                    {m.role === "lina" && (m.text.toLowerCase().includes("whatsapp") || m.toolActions?.some((a) => a.summary.toLowerCase().includes("whatsapp") || a.action.includes("whatsapp"))) && (
                      <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex items-center gap-2">
                        <button
                          onClick={() => {
                            const isRakesh = m.text.toLowerCase().includes("rakesh");
                            const waUrl = isRakesh
                              ? "https://web.whatsapp.com/send?phone=919811122334"
                              : "https://web.whatsapp.com";
                            window.open(waUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open WhatsApp Web</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Attachment Chip Bar */}
        {attachment && (
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/90 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt="preview"
                  className="w-8 h-8 rounded object-cover border border-cyan-800"
                />
              ) : (
                <FileText className="w-5 h-5 text-cyan-400" />
              )}
              <div>
                <p className="font-medium text-cyan-300">{attachment.name}</p>
                <p className="text-[10px] text-neutral-400">
                  {(attachment.size / 1024).toFixed(1)} KB • {attachment.type || "Document"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setAttachment(null)}
              className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-red-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Input Dock */}
        <div className="flex items-end gap-2 p-3 bg-neutral-950/90">
          {/* File Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.xlsx,.xls,.docx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach Document, Image, PDF, CSV or Code"
            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-cyan-400 transition cursor-pointer flex-shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text Area */}
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Lina or speak in Hindi/Hinglish/English..."
              className="w-full resize-none rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-cyan-500/70 focus:outline-none px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 max-h-32 leading-relaxed"
            />
          </div>

          {/* Microphone Voice Button */}
          <button
            onClick={state === "LISTENING" ? onStopListening : onStartListening}
            title={state === "LISTENING" ? "Stop microphone" : "Speak to Lina"}
            className={`p-3 rounded-xl transition-all cursor-pointer flex-shrink-0 relative ${
              state === "LISTENING"
                ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.8)] scale-105"
                : "bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-cyan-400 hover:text-cyan-300"
            }`}
          >
            {state === "LISTENING" ? (
              <MicOff className="w-4 h-4 animate-bounce" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() && !attachment}
            title="Send Message"
            className={`p-3 rounded-xl transition-all cursor-pointer flex-shrink-0 ${
              inputText.trim() || attachment
                ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
