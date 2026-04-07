import { create } from "zustand";
import type { Message, Project, Thread } from "../types/chat";
import type { UserAttachment } from "../lib/userMessageContent";
import { buildSerializedUserMessage, parseUserMessageContent } from "../lib/userMessageContent";
import { api } from "../lib/tauri";
import { useChatComposerStore } from "./chatComposerStore";
import { useUiStore } from "./uiStore";

function sortThreads(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return b.updatedAt - a.updatedAt;
  });
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

interface ChatStore {
  threads: Thread[];
  projects: Project[];
  activeThreadId: string | null;
  /** When true, `loadThreads` must not auto-select the first thread (user chose "New chat" with no thread yet). */
  emptyChatIntent: boolean;
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  streamingText: Record<string, string>;
  /** Reasoning / thinking stream (separate from final answer tokens). */
  streamingReasoning: Record<string, string>;

  setActiveThread: (id: string | null) => void;
  loadThreads: () => Promise<void>;
  loadProjects: () => Promise<void>;
  /** Clear selection so the user can compose without creating a sidebar row until the first send. */
  startEmptyChat: () => void;
  /** Create a DB thread if none is active; used on first message / when staging needs a thread id. */
  ensureActiveThread: () => Promise<string>;
  createThread: (title?: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  deleteThreads: (ids: string[]) => Promise<void>;
  renameThread: (id: string, title: string) => Promise<void>;
  toggleThreadPin: (id: string) => Promise<void>;
  assignThreadProject: (threadId: string, projectId: string | null) => Promise<void>;
  assignThreadsToProject: (
    threadIds: string[],
    projectId: string | null,
  ) => Promise<void>;
  setThreadColor: (threadId: string, color: string) => Promise<void>;
  setThreadsColor: (threadIds: string[], color: string) => Promise<void>;
  createProject: (
    name: string,
    opts?: { color?: string; folderPath?: string | null },
  ) => Promise<Project>;
  updateProject: (id: string, name: string) => Promise<void>;
  toggleProjectStarred: (id: string) => Promise<void>;
  toggleProjectPinned: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadMessages: (threadId: string) => Promise<void>;
  sendMessage: (
    content: string,
    modelId: string,
    imageDataUrl?: string | null,
    opts?: {
      thinkEnabled?: boolean;
      /** When true, `content` is already the final JSON/plain string for the DB (retry/regenerate). */
      serializedOnly?: boolean;
      attachments?: UserAttachment[];
    },
  ) => Promise<void>;
  appendToken: (threadId: string, token: string, kind?: "reasoning" | "content") => void;
  deleteAssistantMessage: (message: Message) => Promise<void>;
  clearStreaming: (threadId: string) => void;
  stopStreaming: () => Promise<void>;
  clearThread: (threadId: string) => Promise<void>;
  regenerate: (modelId: string) => Promise<void>;
  /** Remove this assistant reply onward and re-stream (same user turn). */
  regenerateAssistantMessage: (message: Message, modelId: string) => Promise<void>;
  /** Remove this user message onward and send the same text again. */
  retryUserMessage: (message: Message, modelId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  threads: [],
  projects: [],
  activeThreadId: null,
  emptyChatIntent: false,
  messages: {},
  isStreaming: false,
  streamingText: {},
  streamingReasoning: {},

  setActiveThread: (id) =>
    set({
      activeThreadId: id,
      emptyChatIntent: id != null ? false : get().emptyChatIntent,
    }),

  startEmptyChat: () => {
    set({ activeThreadId: null, emptyChatIntent: true });
  },

  ensureActiveThread: async () => {
    const existing = get().activeThreadId;
    if (existing) return existing;
    const t = await api.createThread("New chat");
    set((s) => ({
      threads: sortThreads([t, ...s.threads]),
      activeThreadId: t.id,
      messages: { ...s.messages, [t.id]: s.messages[t.id] ?? [] },
      emptyChatIntent: false,
    }));
    return t.id;
  },

  loadProjects: async () => {
    const projects = await api.listProjects();
    set({ projects: sortProjects(projects) });
  },

  loadThreads: async () => {
    const threads = sortThreads(await api.listThreads());
    set({ threads });
    const { activeThreadId, emptyChatIntent } = get();
    if (!activeThreadId && !emptyChatIntent && threads[0]) {
      set({ activeThreadId: threads[0].id });
      await get().loadMessages(threads[0].id);
    }
  },

  createThread: async (title) => {
    const t = await api.createThread(title?.trim() || "New chat");
    set((s) => ({
      threads: sortThreads([t, ...s.threads]),
      activeThreadId: t.id,
      messages: { ...s.messages, [t.id]: [] },
      emptyChatIntent: false,
    }));
  },

  toggleThreadPin: async (id) => {
    const t = await api.toggleThreadPinned(id);
    set((s) => ({
      threads: sortThreads(s.threads.map((x) => (x.id === id ? t : x))),
    }));
  },

  assignThreadProject: async (threadId, projectId) => {
    const t = await api.setThreadProject(threadId, projectId);
    set((s) => ({
      threads: sortThreads(s.threads.map((x) => (x.id === threadId ? t : x))),
    }));
  },

  assignThreadsToProject: async (threadIds, projectId) => {
    if (threadIds.length === 0) return;
    await api.assignThreadsProject(threadIds, projectId);
    set((s) => ({
      threads: sortThreads(
        s.threads.map((x) =>
          threadIds.includes(x.id) ? { ...x, projectId } : x,
        ),
      ),
    }));
  },

  setThreadColor: async (threadId, color) => {
    const t = await api.setThreadColor(threadId, color);
    set((s) => ({
      threads: sortThreads(s.threads.map((x) => (x.id === threadId ? t : x))),
    }));
  },

  setThreadsColor: async (threadIds, color) => {
    if (threadIds.length === 0) return;
    await api.setThreadsColor(threadIds, color);
    set((s) => ({
      threads: sortThreads(
        s.threads.map((x) =>
          threadIds.includes(x.id) ? { ...x, color } : x,
        ),
      ),
    }));
  },

  createProject: async (name, opts) => {
    const color = opts?.color ?? "#7c6af7";
    const folderPath = opts?.folderPath ?? null;
    const p = await api.createProject(name, color, folderPath);
    set((s) => ({
      projects: sortProjects([...s.projects, p]),
    }));
    return p;
  },

  updateProject: async (id, name) => {
    const p = await api.updateProject(id, name);
    set((s) => ({
      projects: sortProjects(s.projects.map((x) => (x.id === id ? p : x))),
    }));
  },

  toggleProjectStarred: async (id) => {
    const p = await api.toggleProjectStarred(id);
    set((s) => ({
      projects: sortProjects(s.projects.map((x) => (x.id === id ? p : x))),
    }));
  },

  toggleProjectPinned: async (id) => {
    const p = await api.toggleProjectPinned(id);
    set((s) => ({
      projects: sortProjects(s.projects.map((x) => (x.id === id ? p : x))),
    }));
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set((s) => ({
      projects: s.projects.filter((x) => x.id !== id),
    }));
    await get().loadThreads();
  },

  deleteThread: async (id) => {
    await get().deleteThreads([id]);
  },

  deleteThreads: async (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const { activeThreadId, isStreaming } = get();
    if (activeThreadId && idSet.has(activeThreadId) && isStreaming) {
      await api.stopStreaming();
      set({ isStreaming: false });
    }
    await api.deleteThreads(ids);
    set((s) => {
      const threads = s.threads.filter((x) => !idSet.has(x.id));
      const messages = { ...s.messages };
      for (const id of ids) {
        delete messages[id];
      }
      const nextActive =
        s.activeThreadId && idSet.has(s.activeThreadId)
          ? threads[0]?.id ?? null
          : s.activeThreadId;
      return {
        threads,
        messages,
        activeThreadId: nextActive,
        emptyChatIntent: nextActive === null,
      };
    });
  },

  renameThread: async (id, title) => {
    await api.renameThread(id, title);
    set((s) => ({
      threads: sortThreads(
        s.threads.map((t) => (t.id === id ? { ...t, title } : t)),
      ),
    }));
  },

  loadMessages: async (threadId) => {
    const list = await api.getThreadMessages(threadId);
    set((s) => ({
      messages: { ...s.messages, [threadId]: list },
    }));
  },

  sendMessage: async (content, modelId, imageDataUrl, opts) => {
    let threadId = get().activeThreadId;
    if (!threadId) {
      try {
        threadId = await get().ensureActiveThread();
      } catch (e) {
        useUiStore.getState().pushToast(String(e), "error");
        return;
      }
    }
    const editFromId = useChatComposerStore.getState().editFromMessageId;
    if (editFromId) {
      try {
        await api.deleteMessagesFrom(threadId, editFromId);
      } catch (e) {
        useUiStore.getState().pushToast(String(e), "error");
        return;
      }
      useChatComposerStore.getState().setEditFromMessageId(null);
      await get().loadMessages(threadId);
    }
    const thinkEnabled = opts?.thinkEnabled ?? useChatComposerStore.getState().thinkEnabled;
    const serialized =
      opts?.serializedOnly === true
        ? content
        : buildSerializedUserMessage(
            content,
            imageDataUrl ?? null,
            opts?.attachments,
          );
    const optimistic: Message = {
      id: "temp-user",
      threadId,
      role: "user",
      content: serialized,
      createdAt: Date.now(),
    };
    set((s) => ({
      isStreaming: true,
      streamingText: { ...s.streamingText, [threadId]: "" },
      streamingReasoning: { ...s.streamingReasoning, [threadId]: "" },
      messages: {
        ...s.messages,
        [threadId]: [...(s.messages[threadId] ?? []), optimistic],
      },
    }));
    try {
      await api.streamChat(threadId, serialized, modelId, false, null, thinkEnabled);
      await get().loadMessages(threadId);
      await get().loadThreads();
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
      await get().loadMessages(threadId);
    } finally {
      get().clearStreaming(threadId);
      set({ isStreaming: false });
    }
  },

  appendToken: (threadId, token, kind) =>
    set((s) => {
      if (kind === "reasoning") {
        return {
          streamingReasoning: {
            ...s.streamingReasoning,
            [threadId]: (s.streamingReasoning[threadId] ?? "") + token,
          },
        };
      }
      return {
        streamingText: {
          ...s.streamingText,
          [threadId]: (s.streamingText[threadId] ?? "") + token,
        },
      };
    }),

  clearStreaming: (threadId) =>
    set((s) => {
      const { [threadId]: _t, ...restText } = s.streamingText;
      const { [threadId]: _r, ...restReas } = s.streamingReasoning;
      return { streamingText: restText, streamingReasoning: restReas };
    }),

  deleteAssistantMessage: async (message) => {
    if (message.role !== "assistant" || message.id === "streaming") return;
    const threadId = message.threadId;
    if (get().activeThreadId !== threadId) return;
    try {
      await api.deleteMessage(threadId, message.id);
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
      return;
    }
    await get().loadMessages(threadId);
  },

  stopStreaming: async () => {
    await api.stopStreaming();
    set({ isStreaming: false });
  },

  clearThread: async (threadId) => {
    await api.clearThreadMessages(threadId);
    set((s) => ({
      messages: { ...s.messages, [threadId]: [] },
    }));
  },

  regenerate: async (modelId) => {
    const threadId = get().activeThreadId;
    if (!threadId) return;
    await api.deleteLastAssistantMessage(threadId);
    await get().loadMessages(threadId);
    set((s) => ({
      isStreaming: true,
      streamingText: { ...s.streamingText, [threadId]: "" },
      streamingReasoning: { ...s.streamingReasoning, [threadId]: "" },
    }));
    try {
      const thinkEnabled = useChatComposerStore.getState().thinkEnabled;
      await api.streamChat(threadId, "", modelId, true, null, thinkEnabled);
      await get().loadMessages(threadId);
      await get().loadThreads();
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
      await get().loadMessages(threadId);
    } finally {
      get().clearStreaming(threadId);
      set({ isStreaming: false });
    }
  },

  regenerateAssistantMessage: async (message, modelId) => {
    if (message.role !== "assistant" || message.id === "streaming") return;
    const threadId = message.threadId;
    useChatComposerStore.getState().setEditFromMessageId(null);
    try {
      await api.deleteMessagesFrom(threadId, message.id);
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
      return;
    }
    await get().loadMessages(threadId);
    set((s) => ({
      isStreaming: true,
      streamingText: { ...s.streamingText, [threadId]: "" },
      streamingReasoning: { ...s.streamingReasoning, [threadId]: "" },
    }));
    try {
      const thinkEnabled = useChatComposerStore.getState().thinkEnabled;
      await api.streamChat(threadId, "", modelId, true, null, thinkEnabled);
      await get().loadMessages(threadId);
      await get().loadThreads();
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
      await get().loadMessages(threadId);
    } finally {
      get().clearStreaming(threadId);
      set({ isStreaming: false });
    }
  },

  retryUserMessage: async (message, modelId) => {
    if (message.role !== "user" || message.id === "temp-user") return;
    const threadId = message.threadId;
    useChatComposerStore.getState().setEditFromMessageId(null);
    try {
      await api.deleteMessagesFrom(threadId, message.id);
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
      return;
    }
    await get().loadMessages(threadId);
    const raw = message.content;
    const head = raw.trimStart();
    if (head.startsWith("{")) {
      try {
        const j = JSON.parse(raw) as { v?: number };
        if (j.v === 1 || j.v === 2) {
          await get().sendMessage(raw, modelId, null, { serializedOnly: true });
          return;
        }
      } catch {
        /* plain text that happens to start with { */
      }
    }
    const { text, imageDataUrl } = parseUserMessageContent(raw);
    await get().sendMessage(text, modelId, imageDataUrl ?? null);
  },
}));
