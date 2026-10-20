import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  X,
  Calendar as CalendarIcon,
  Mail,
  Users,
  FileSpreadsheet,
  Plus,
  Send,
  AlertTriangle,
  RefreshCw,
  Clock,
  ExternalLink,
  LogIn,
} from "lucide-react";
import {
  WorkspaceService,
  CalendarEvent,
  GmailMessage,
  GoogleContact,
} from "../../services/workspace";
import { googleSignIn } from "../../services/firebase";

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<"calendar" | "gmail" | "contacts" | "sheets">("calendar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar State
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventSummary, setEventSummary] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");

  // Gmail State
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [toEmail, setToEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Contacts State
  const [contacts, setContacts] = useState<GoogleContact[]>([]);

  // Sheets State
  const [sheetId, setSheetId] = useState("");
  const [sheetRange, setSheetRange] = useState("Sheet1!A1:E10");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [newRowVal, setNewRowVal] = useState("");

  // Mandatory Confirmation Dialog State
  const [pendingAction, setPendingAction] = useState<{
    type: "send_email" | "create_event" | "append_sheet";
    title: string;
    description: string;
    execute: () => Promise<void>;
  } | null>(null);

  const loadTabData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "calendar") {
        const evs = await WorkspaceService.listUpcomingEvents(10);
        setEvents(evs);
      } else if (activeTab === "gmail") {
        const msgs = await WorkspaceService.listRecentEmails(8);
        setEmails(msgs);
      } else if (activeTab === "contacts") {
        const cts = await WorkspaceService.listContacts(15);
        setContacts(cts);
      } else if (activeTab === "sheets" && sheetId) {
        const values = await WorkspaceService.getSpreadsheetValues(sheetId, sheetRange);
        setSheetData(values);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load Workspace data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadTabData();
    }
  }, [isOpen, activeTab, user]);

  // Handle Event Creation with Mandatory Confirmation Dialog
  const handleScheduleEvent = () => {
    if (!eventSummary || !eventDate) return;
    const startIso = `${eventDate}T${eventTime || "10:00"}:00`;
    const endIso = `${eventDate}T${eventTime ? "11:00" : "11:00"}:00`;

    setPendingAction({
      type: "create_event",
      title: "Schedule Google Calendar Event",
      description: `Create new event "${eventSummary}" scheduled for ${eventDate} at ${eventTime || "10:00 AM"}?`,
      execute: async () => {
        await WorkspaceService.createCalendarEvent(eventSummary, startIso, endIso);
        setEventSummary("");
        loadTabData();
      },
    });
  };

  // Handle Sending Email with Mandatory Confirmation Dialog
  const handleSendEmail = () => {
    if (!toEmail || !emailSubject || !emailBody) return;

    setPendingAction({
      type: "send_email",
      title: "Confirm Sending Email via Gmail",
      description: `Send email to "${toEmail}" with subject "${emailSubject}"? This action sends a real email from your account.`,
      execute: async () => {
        await WorkspaceService.sendEmail(toEmail, emailSubject, emailBody);
        setToEmail("");
        setEmailSubject("");
        setEmailBody("");
        loadTabData();
      },
    });
  };

  // Handle Appending Row with Mandatory Confirmation Dialog
  const handleAppendSheet = () => {
    if (!sheetId || !newRowVal) return;
    const values = newRowVal.split(",").map((v) => v.trim());

    setPendingAction({
      type: "append_sheet",
      title: "Append Row to Google Sheet",
      description: `Append new row [${values.join(", ")}] to spreadsheet ID "${sheetId}" in range "${sheetRange}"?`,
      execute: async () => {
        await WorkspaceService.appendSpreadsheetRow(sheetId, sheetRange, values);
        setNewRowVal("");
        loadTabData();
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                GOOGLE WORKSPACE PRODUCTIVITY HUB
              </h2>
              <p className="text-[11px] text-neutral-400">
                Google Calendar • Gmail • Google Contacts • Google Sheets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={loadTabData}
                title="Refresh Data"
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-800 bg-black/50 text-xs">
          {[
            { id: "calendar", label: "Google Calendar", icon: CalendarIcon },
            { id: "gmail", label: "Gmail Inbox & Send", icon: Mail },
            { id: "contacts", label: "Google Contacts", icon: Users },
            { id: "sheets", label: "Google Sheets", icon: FileSpreadsheet },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
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

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-5 text-sm space-y-4">
          {!user ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center mx-auto text-cyan-400">
                <LogIn className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  Google Workspace Authentication Required
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                  Connect your Google account with permission to see your Calendar, read/send Gmail, access Contacts, and inspect Sheets.
                </p>
              </div>
              <button
                onClick={() => googleSignIn()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-lg transition cursor-pointer"
              >
                Sign in with Google
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* CALENDAR TAB */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  {/* Create Event Form */}
                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                    <h4 className="text-xs font-semibold text-cyan-300">Schedule New Calendar Event</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={eventSummary}
                        onChange={(e) => setEventSummary(e.target.value)}
                        placeholder="Event Title (e.g. Project Sync)"
                        className="sm:col-span-1 bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                      <input
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        className="bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <button
                      onClick={handleScheduleEvent}
                      disabled={!eventSummary || !eventDate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-medium cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Event</span>
                    </button>
                  </div>

                  {/* Events List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-neutral-400">Upcoming Events</h4>
                    {events.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-3">No upcoming events found on Google Calendar.</p>
                    ) : (
                      events.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-neutral-200">{ev.summary}</p>
                            <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              <span>{ev.start.dateTime ? new Date(ev.start.dateTime).toLocaleString() : ev.start.date}</span>
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* GMAIL TAB */}
              {activeTab === "gmail" && (
                <div className="space-y-4">
                  {/* Compose Email Form */}
                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                    <h4 className="text-xs font-semibold text-cyan-300">Compose & Send Email</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        value={toEmail}
                        onChange={(e) => setToEmail(e.target.value)}
                        placeholder="Recipient Email (to@example.com)"
                        className="bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject"
                        className="bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Write your email body..."
                      className="w-full bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 resize-none"
                    />
                    <button
                      onClick={handleSendEmail}
                      disabled={!toEmail || !emailSubject || !emailBody}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-medium cursor-pointer transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send with Confirmation</span>
                    </button>
                  </div>

                  {/* Recent Emails */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-neutral-400">Recent Inbox Messages</h4>
                    {emails.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-3">No recent emails retrieved.</p>
                    ) : (
                      emails.map((msg) => (
                        <div
                          key={msg.id}
                          className="p-3 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-neutral-200 truncate">{msg.subject}</span>
                            <span className="text-[10px] text-neutral-500 flex-shrink-0">{msg.date}</span>
                          </div>
                          <p className="text-[11px] text-cyan-400 truncate">From: {msg.from}</p>
                          <p className="text-[11px] text-neutral-400 line-clamp-1">{msg.snippet}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* CONTACTS TAB */}
              {activeTab === "contacts" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-400">Google Contacts Connections</h4>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-3">No contacts retrieved.</p>
                  ) : (
                    contacts.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-neutral-200">{c.displayName}</p>
                          <p className="text-[11px] text-neutral-400">{c.email || c.phoneNumber || "No details"}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SHEETS TAB */}
              {activeTab === "sheets" && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                    <h4 className="text-xs font-semibold text-cyan-300">Inspect Google Spreadsheet</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={sheetId}
                        onChange={(e) => setSheetId(e.target.value)}
                        placeholder="Google Spreadsheet ID"
                        className="bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono"
                      />
                      <input
                        type="text"
                        value={sheetRange}
                        onChange={(e) => setSheetRange(e.target.value)}
                        placeholder="Range (e.g. Sheet1!A1:D10)"
                        className="bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={loadTabData}
                        disabled={!sheetId}
                        className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs cursor-pointer"
                      >
                        Fetch Sheet Data
                      </button>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex gap-2">
                      <input
                        type="text"
                        value={newRowVal}
                        onChange={(e) => setNewRowVal(e.target.value)}
                        placeholder="Append row values (comma separated: e.g. Q4, 15000, Approved)"
                        className="flex-1 bg-black/60 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                      <button
                        onClick={handleAppendSheet}
                        disabled={!sheetId || !newRowVal}
                        className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 text-white text-xs cursor-pointer"
                      >
                        Append Row
                      </button>
                    </div>
                  </div>

                  {sheetData.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-neutral-800">
                      <table className="w-full text-left text-xs text-neutral-300">
                        <tbody>
                          {sheetData.map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-neutral-800/60 hover:bg-neutral-900/50">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 border-r border-neutral-800/40">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* MANDATORY USER CONFIRMATION DIALOG FOR MUTATING OPERATIONS */}
        {pendingAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-md p-5 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-700 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{pendingAction.title}</h3>
                  <p className="text-xs text-neutral-400">User Confirmation Required</p>
                </div>
              </div>

              <p className="text-xs text-neutral-200 leading-relaxed bg-black/50 p-3 rounded-lg border border-neutral-800">
                {pendingAction.description}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setPendingAction(null)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const act = pendingAction;
                    setPendingAction(null);
                    await act.execute();
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium cursor-pointer transition shadow-lg"
                >
                  Confirm & Execute
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
