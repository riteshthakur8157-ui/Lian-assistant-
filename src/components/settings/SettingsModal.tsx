import React from "react";
import { X, Sliders, Volume2, Globe, Cpu, Sparkles, Trash2 } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    language: string;
    voice: string;
    model: string;
    particleDensity: "low" | "medium" | "high";
    proactivity: "low" | "balanced" | "high";
    bargeInEnabled: boolean;
  };
  onUpdateSettings: (newSettings: any) => void;
  onClearHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/40">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              LINA AI SETTINGS & OPTIMIZATIONS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-neutral-300 overflow-y-auto max-h-[80vh]">
          {/* AI Model */}
          <div className="space-y-1.5">
            <label className="font-medium text-neutral-200 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Intelligence Engine</span>
            </label>
            <select
              value={settings.model}
              onChange={(e) => onUpdateSettings({ model: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Multimodal - Recommended)</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro (Complex Reasoning & Deep Analysis)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash (Ultra-Fast Response)</option>
            </select>
          </div>

          {/* Voice Personas */}
          <div className="space-y-1.5">
            <label className="font-medium text-neutral-200 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lina Voice Synthesis Persona</span>
            </label>
            <select
              value={settings.voice}
              onChange={(e) => onUpdateSettings({ voice: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="Aoede">Aoede (Warm, loving, melodious female voice)</option>
              <option value="Kore">Kore (Articulate, friendly female tone)</option>
              <option value="Zephyr">Zephyr (Bright, conversational voice)</option>
              <option value="Puck">Puck (Energetic, expressive voice)</option>
              <option value="Fenrir">Fenrir (Deep, calm voice)</option>
            </select>
          </div>

          {/* Primary Language */}
          <div className="space-y-1.5">
            <label className="font-medium text-neutral-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Language & Conversational Style</span>
            </label>
            <select
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="Hinglish">Hinglish (Natural conversational Hindi + English mix)</option>
              <option value="Hindi">Hindi (Shuddh evam aadarpoorvak Hindi)</option>
              <option value="English">English (Natural, clear English)</option>
            </select>
          </div>

          {/* 4GB RAM Optimization: Particle Density */}
          <div className="space-y-1.5">
            <label className="font-medium text-neutral-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Particle Rendering Quality (4GB RAM Laptop Support)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "low", label: "Eco (1,800)", desc: "Low CPU/GPU" },
                { id: "medium", label: "Balanced (3,200)", desc: "Recommended" },
                { id: "high", label: "Ultra (4,800)", desc: "High GPU" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onUpdateSettings({ particleDensity: opt.id })}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    settings.particleDensity === opt.id
                      ? "bg-cyan-950/80 border-cyan-500 text-cyan-300"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <p className="font-semibold text-xs">{opt.label}</p>
                  <p className="text-[10px] text-neutral-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Barge-In Interruption Mode */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/60 border border-neutral-800">
            <div>
              <p className="font-medium text-neutral-200">Barge-In Speech Interruption</p>
              <p className="text-[11px] text-neutral-500">
                Lina immediately stops speaking when you start speaking or click Stop.
              </p>
            </div>
            <button
              onClick={() => onUpdateSettings({ bargeInEnabled: !settings.bargeInEnabled })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.bargeInEnabled ? "bg-cyan-600" : "bg-neutral-800"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  settings.bargeInEnabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Clear Session History */}
          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-red-400 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Conversation History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
