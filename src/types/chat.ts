export interface Thread {
  id: string;
  title: string;
  modelId?: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  projectId?: string | null;
  /** Sidebar accent color (hex) */
  color?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  /** Hex color e.g. #7c6af7 */
  color: string;
  /** Absolute path to project folder on disk */
  folderPath: string;
  starred: boolean;
  pinned: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string;
  tokensUsed?: number;
  createdAt: number;
}
