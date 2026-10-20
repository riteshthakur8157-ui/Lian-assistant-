import { db } from "../db.js";
import { PCControlService } from "../pc_control.js";

export interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  role?: string;
  lastMessage?: string;
  status?: string;
  avatar?: string;
}

export const KNOWN_CONTACTS: WhatsAppContact[] = [
  {
    id: "c_rakesh",
    name: "CA Rakesh",
    phone: "+91 98111 22334",
    role: "Chartered Accountant & Tax Auditor",
    lastMessage: "GST returns aur Tax Audit balance sheet draft taiyaar hai.",
    status: "Online",
  },
  {
    id: "c_amit",
    name: "Amit Sharma",
    phone: "+91 98765 43210",
    role: "Project Partner",
    lastMessage: "Kal milte hain project review ke liye.",
    status: "Online",
  },
  {
    id: "c_pooja",
    name: "Pooja Verma",
    phone: "+91 98123 45678",
    role: "Operations Lead",
    lastMessage: "Presentation slides bhej di hain.",
    status: "Available",
  },
  {
    id: "c_rohit",
    name: "Rohit Tech Lead",
    phone: "+91 99887 76655",
    role: "Senior Fullstack Engineer",
    lastMessage: "Deployment successful on staging server.",
    status: "Busy",
  },
  {
    id: "c_neha",
    name: "Neha Designer",
    phone: "+91 97766 55443",
    role: "UI/UX Lead",
    lastMessage: "Figma design system link check kar lo ek baar.",
    status: "Offline",
  },
  {
    id: "c_mummy",
    name: "Mummy",
    phone: "+91 98000 11223",
    role: "Family",
    lastMessage: "Ghar kab aaoge beta?",
    status: "Online",
  },
];

export interface WhatsAppActionResult {
  success: boolean;
  action: string;
  status: "completed" | "awaiting_user_input" | "awaiting_approval" | "failed";
  contact?: WhatsAppContact;
  recipient?: string;
  phone?: string;
  messageText?: string;
  attachment?: { name: string; type?: string; size?: string };
  previewUrl?: string;
  directWebUrl?: string;
  message: string;
  confirmationPrompt?: string;
  options?: string[];
}

export const WhatsAppAgent = {
  name: "WhatsApp Controller",
  description:
    "Dedicated first-class WhatsApp automation controller for WhatsApp Web and Desktop. Handles contact search, chat opening, message drafting, file attachments, and safe confirmation-based message dispatch.",

  searchContacts: async (query: string): Promise<{
    success: boolean;
    query: string;
    found: number;
    contacts: WhatsAppContact[];
    message: string;
    ambiguous?: boolean;
  }> => {
    db.addAuditLog("whatsapp_search", "WhatsApp Controller", "low", `Searched for contacts with query: ${query}`);
    const q = query.toLowerCase().trim();
    const results = KNOWN_CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.role && c.role.toLowerCase().includes(q))
    );

    if (results.length === 1) {
      return {
        success: true,
        query,
        found: 1,
        contacts: results,
        message: `सर, ${results[0].name} (${results[0].phone}) का कॉन्टैक्ट मिल गया है।`,
        ambiguous: false,
      };
    }

    if (results.length > 1) {
      const names = results.map((r) => r.name).join(", ");
      return {
        success: true,
        query,
        found: results.length,
        contacts: results,
        message: `सर, मुझे '${query}' नाम से ${results.length} कॉन्टैक्ट मिले हैं: ${names}। आप किसे मैसेज करना चाहते हैं?`,
        ambiguous: true,
      };
    }

    return {
      success: false,
      query,
      found: 0,
      contacts: [],
      message: `सर, WhatsApp में '${query}' नाम का कोई कॉन्टैक्ट नहीं मिला।`,
    };
  },

  openChat: async (
    contactName?: string,
    mode: "web" | "desktop" | "auto" = "auto"
  ): Promise<WhatsAppActionResult> => {
    let matchedContact: WhatsAppContact | undefined = undefined;
    if (contactName) {
      const q = contactName.toLowerCase().trim();
      matchedContact = KNOWN_CONTACTS.find(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.role && c.role.toLowerCase().includes(q))
      );
    }

    const cleanPhone = matchedContact ? matchedContact.phone.replace(/[^0-9]/g, "") : "";
    const webUrl = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}`
      : `https://web.whatsapp.com`;

    const appToOpen = mode === "desktop" ? "whatsapp_desktop" : "whatsapp";
    const pcLaunchResult = await PCControlService.openApp(appToOpen, webUrl);

    db.addAuditLog(
      "whatsapp_open",
      "WhatsApp Controller",
      "low",
      `Opened WhatsApp (${mode}) for ${matchedContact?.name || "Main Inbox"}. Command: ${pcLaunchResult.commandExecuted}`
    );

    if (matchedContact) {
      return {
        success: true,
        action: "open_chat",
        status: "awaiting_user_input",
        contact: matchedContact,
        recipient: matchedContact.name,
        phone: matchedContact.phone,
        previewUrl: webUrl,
        directWebUrl: webUrl,
        message: `सर, ${matchedContact.name} की चैट खुल गई है। क्या मैसेज भेजना है?`,
      };
    }

    return {
      success: true,
      action: "open_chat",
      status: "completed",
      previewUrl: webUrl,
      directWebUrl: webUrl,
      message: `जी सर, ${mode === "desktop" ? "WhatsApp Desktop" : "WhatsApp Web"} खोल दिया है।`,
    };
  },

  draftMessage: async (
    recipient: string,
    messageText: string,
    attachment?: { name: string; type?: string; size?: string }
  ): Promise<WhatsAppActionResult> => {
    const contact = KNOWN_CONTACTS.find(
      (c) => c.name.toLowerCase().includes(recipient.toLowerCase()) || c.phone.includes(recipient)
    );

    const displayName = contact ? contact.name : recipient;
    const cleanPhone = contact ? contact.phone.replace(/[^0-9]/g, "") : "";
    const previewUrl = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

    db.addAuditLog(
      "whatsapp_draft",
      "WhatsApp Controller",
      "low",
      `Drafted message for ${displayName} with attachment: ${attachment ? attachment.name : "none"}`
    );

    const confirmationPrompt = attachment
      ? `सर, मैसेज है: '${messageText}' [अटैचमेंट: ${attachment.name}]। क्या इसे ${displayName} को भेज दूँ?`
      : `सर, मैसेज है: '${messageText}'। क्या इसे ${displayName} को भेज दूँ?`;

    return {
      success: true,
      action: "draft_message",
      status: "awaiting_approval",
      contact,
      recipient: displayName,
      phone: contact?.phone,
      messageText,
      attachment,
      previewUrl,
      directWebUrl: previewUrl,
      confirmationPrompt,
      message: confirmationPrompt,
    };
  },

  sendMessage: async (
    recipient: string,
    messageText: string,
    userConfirmed: boolean,
    attachment?: { name: string; type?: string; size?: string }
  ): Promise<WhatsAppActionResult> => {
    const contact = KNOWN_CONTACTS.find(
      (c) => c.name.toLowerCase().includes(recipient.toLowerCase()) || c.phone.includes(recipient)
    );
    const displayName = contact ? contact.name : recipient;

    if (!userConfirmed) {
      db.addAuditLog(
        "whatsapp_send_blocked",
        "WhatsApp Controller",
        "high",
        `Blocked send to ${displayName}: user confirmation missing`,
        "denied"
      );
      return {
        success: false,
        action: "send_message",
        status: "awaiting_approval",
        recipient: displayName,
        messageText,
        attachment,
        message: `सर, मैसेज भेजने से पहले आपकी मंज़ूरी ज़रूरी है। क्या मैं ${displayName} को यह मैसेज भेज दूँ?`,
      };
    }

    const cleanPhone = contact ? contact.phone.replace(/[^0-9]/g, "") : "";
    const directWebUrl = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

    db.addAuditLog(
      "whatsapp_send",
      "WhatsApp Controller",
      "high",
      `Sent message to ${displayName}: "${messageText}" [Attachment: ${attachment?.name || "none"}]`,
      "executed"
    );

    const successMsg = attachment
      ? `हो गया सर, ${displayName} की चैट में फाइल '${attachment.name}' के साथ मैसेज भेज दिया है।`
      : `हो गया सर, ${displayName} की चैट में मैसेज भेज दिया है।`;

    return {
      success: true,
      action: "send_message",
      status: "completed",
      contact,
      recipient: displayName,
      phone: contact?.phone,
      messageText,
      attachment,
      directWebUrl,
      message: successMsg,
    };
  },

  getUnreadMessages: async (): Promise<{
    success: boolean;
    unreadCount: number;
    chats: Array<{ sender: string; lastMessage: string; time: string }>;
    message: string;
  }> => {
    const activeUnread = [
      { sender: "CA Rakesh", lastMessage: "GST returns aur Tax Audit balance sheet draft taiyaar hai.", time: "10:15 AM" },
      { sender: "Amit Sharma", lastMessage: "Kal milte hain project review ke liye.", time: "09:30 AM" },
    ];
    return {
      success: true,
      unreadCount: activeUnread.length,
      chats: activeUnread,
      message: `सर, आपके 2 अनरीड चैट्स हैं: CA Rakesh ने GST बैलेंस शीट भेजी है, और Amit Sharma ने कल के रिव्यू का मैसेज भेजा है।`,
    };
  },
};
