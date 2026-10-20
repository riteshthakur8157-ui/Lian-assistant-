import React from "react";
import { User } from "firebase/auth";
import {
  Sparkles,
  Wifi,
  WifiOff,
  Settings,
  Layers,
  OctagonAlert,
  Calendar,
  Mail,
  Users,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Monitor,
} from "lucide-react";
import { googleSignIn, logout } from "../../services/firebase";

interface TopBarProps {
  online: boolean;
  modelName: string;
  user: User | null;
  onOpenSettings: () => void;
  onOpenAgents: () => void;
  onOpenWorkspace: () => void;
  onOpenPCControl?: () => void;
  onStopAllTasks: () => void;
  runningTasksCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  online,
  modelName,
  user,
  onOpenSettings,
  onOpenAgents,
  onOpenWorkspace,
  onOpenPCControl,
  onStopAllTasks,
  runningTasksCount,
}) => {
  const [signingIn, setSigningIn] = React.useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await googleSignIn();
    } catch (e) {
      console.error(e);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
      {/* Brand & Assistant Name */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
          <Sparkles className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-wider text-white text-base sm:text-lg">
              LINA AI
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/50 text-cyan-300">
              Voice Assistant
            </span>
          </div>
          <p className="text-xs text-neutral-400 hidden sm:block">
            PC Control • Multi-Agent Intelligence • Hindi / Hinglish / English
          </p>
        </div>
      </div>

      {/* Middle Status Indicators */}
      <div className="hidden md:flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900/70 border border-neutral-800 text-xs">
          {online ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-neutral-300">Live Active</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-neutral-400">Offline Fallback</span>
            </>
          )}
          <span className="text-neutral-600">•</span>
          <span className="text-cyan-400 font-mono text-[11px]">{modelName}</span>
        </div>

        {/* Emergency Stop All Button */}
        {runningTasksCount > 0 && (
          <button
            onClick={onStopAllTasks}
            title="Emergency Stop All Running Tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-700/60 text-red-300 hover:bg-red-900 text-xs transition cursor-pointer"
          >
            <OctagonAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Stop Tasks ({runningTasksCount})</span>
          </button>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {/* PC Control & App Launcher Hub */}
        {onOpenPCControl && (
          <button
            onClick={onOpenPCControl}
            title="PC Control, Native Apps, Terminal & WhatsApp"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 text-xs font-medium transition cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">PC Control</span>
          </button>
        )}

        {/* Workspace Hub Trigger */}
        <button
          onClick={onOpenWorkspace}
          title="Google Workspace Hub (Calendar, Gmail, Contacts, Sheets)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs transition cursor-pointer"
        >
          <div className="flex items-center gap-1 text-cyan-400">
            <Calendar className="w-3.5 h-3.5" />
            <Mail className="w-3.5 h-3.5" />
            <Users className="w-3.5 h-3.5" />
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </div>
          <span className="hidden lg:inline text-neutral-300 font-medium">Workspace</span>
          {user && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        {/* Multi-Agent & Tasks Drawer */}
        <button
          onClick={onOpenAgents}
          title="Agents, Tasks & Skills"
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs transition cursor-pointer"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Agents</span>
          {runningTasksCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-600 text-white text-[10px] font-bold">
              {runningTasksCount}
            </span>
          )}
        </button>

        {/* Google Sign In / User Profile */}
        {user ? (
          <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg bg-neutral-900/70 border border-neutral-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-6 h-6 rounded-full border border-neutral-700"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold">
                {user.email?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <span className="text-xs text-neutral-300 max-w-[90px] truncate hidden sm:inline">
              {user.displayName?.split(" ")[0] || "User"}
            </span>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1 text-neutral-500 hover:text-red-400 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-medium transition cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{signingIn ? "Connecting..." : "Google Sign In"}</span>
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Assistant Settings"
          className="p-2 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
