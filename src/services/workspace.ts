import { getAccessToken } from "./firebase";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject?: string;
  from?: string;
  date?: string;
}

export interface GoogleContact {
  resourceName: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
}

export const WorkspaceService = {
  // --- Google Calendar ---
  listUpcomingEvents: async (maxResults: number = 5): Promise<CalendarEvent[]> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const now = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      now
    )}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to fetch calendar events");
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || "(No Title)",
      description: item.description,
      start: item.start,
      end: item.end,
      location: item.location,
    }));
  },

  createCalendarEvent: async (
    summary: string,
    startTime: string,
    endTime: string,
    description: string = ""
  ): Promise<CalendarEvent> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to create calendar event");
    }
    return await res.json();
  },

  // --- Gmail ---
  listRecentEmails: async (maxResults: number = 5): Promise<GmailMessage[]> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const listUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to list emails");
    }
    const listData = await listRes.json();
    const messageIds = listData.messages || [];

    const messages: GmailMessage[] = [];
    for (const item of messageIds) {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
        const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "Unknown";
        const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";

        messages.push({
          id: msgData.id,
          threadId: msgData.threadId,
          snippet: msgData.snippet || "",
          subject,
          from,
          date,
        });
      }
    }
    return messages;
  },

  sendEmail: async (to: string, subject: string, bodyText: string): Promise<any> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const emailLines = [
      `To: ${to}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${subject}`,
      "",
      bodyText,
    ];
    const emailRaw = emailLines.join("\r\n");
    const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to send email");
    }
    return await res.json();
  },

  // --- Google Contacts ---
  listContacts: async (pageSize: number = 10): Promise<GoogleContact[]> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const url = `https://people.googleapis.com/v1/people/me/connections?pageSize=${pageSize}&personFields=names,emailAddresses,phoneNumbers`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to fetch Google contacts");
    }
    const data = await res.json();
    return (data.connections || []).map((person: any) => {
      const displayName = person.names?.[0]?.displayName || "Unnamed Contact";
      const email = person.emailAddresses?.[0]?.value;
      const phoneNumber = person.phoneNumbers?.[0]?.value;
      return {
        resourceName: person.resourceName,
        displayName,
        email,
        phoneNumber,
      };
    });
  },

  // --- Google Sheets ---
  getSpreadsheetValues: async (spreadsheetId: string, range: string): Promise<any[][]> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to fetch spreadsheet values");
    }
    const data = await res.json();
    return data.values || [];
  },

  appendSpreadsheetRow: async (spreadsheetId: string, range: string, values: any[]): Promise<any> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Google Workspace authentication required.");

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to append row to spreadsheet");
    }
    return await res.json();
  },
};
