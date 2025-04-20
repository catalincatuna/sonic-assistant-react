import { Message } from "../components/MessageList";
import { getCurrentSessionId } from "./RestCalls";

interface ChatSession {
  id: string;
  sessionId: string;
  messages: Message[];
  timestamp: string;
  propertyName: string;
}

class ChatHistoryService {
  private static instance: ChatHistoryService;
  private chatSessions: ChatSession[] = [];
  private readonly STORAGE_KEY = "chatSessions";

  private constructor() {
    this.loadFromLocalStorage();
  }

  public static getInstance(): ChatHistoryService {
    if (!ChatHistoryService.instance) {
      ChatHistoryService.instance = new ChatHistoryService();
    }
    return ChatHistoryService.instance;
  }

  private loadFromLocalStorage() {
    try {
      const savedSessions = localStorage.getItem(this.STORAGE_KEY);
      if (savedSessions) {
        this.chatSessions = JSON.parse(savedSessions);
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
      this.chatSessions = [];
    }
  }

  public addSession(messages: Message[], propertyName: string) {
    try {
      const session: ChatSession = {
        id: Date.now().toString(),
        sessionId: getCurrentSessionId(),
        messages: [...messages],
        timestamp: new Date().toISOString(),
        propertyName,
      };

      this.chatSessions.unshift(session);
      this.saveToLocalStorage();
      // this.appendToLogFile(session); // Commented out to prevent automatic download
    } catch (error) {
      console.error("Error adding session:", error);
    }
  }

  public getSessions(): ChatSession[] {
    return [...this.chatSessions];
  }

  private saveToLocalStorage() {
    try {
      const sessionsToSave = JSON.stringify(this.chatSessions);
      localStorage.setItem(this.STORAGE_KEY, sessionsToSave);
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }

  private async appendToLogFile(session: ChatSession) {
    const logEntry = `
Session ID: ${session.sessionId}
Property: ${session.propertyName}
Timestamp: ${new Date(session.timestamp).toLocaleString()}
Messages:
${session.messages
  .map(
    (msg) =>
      `[${msg.timestamp}] ${msg.isUser ? "User" : "Assistant"}: ${msg.text}`
  )
  .join("\n")}
----------------------------------------
`;

    try {
      const blob = new Blob([logEntry], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "chat_log.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving log file:", error);
    }
  }
}

export const chatHistoryService = ChatHistoryService.getInstance();
export type { ChatSession };
