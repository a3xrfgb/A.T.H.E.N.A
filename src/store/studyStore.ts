import { create } from "zustand";
import type { LoadedDoc } from "../components/study/studyDocument";

function revokePdfIfNeeded(doc: LoadedDoc | null) {
  if (doc?.kind === "pdf") URL.revokeObjectURL(doc.blobUrl);
}

interface StudySessionState {
  doc: LoadedDoc | null;
  openDoc: (loaded: LoadedDoc) => void;
  clearDoc: () => void;
}

export const useStudyStore = create<StudySessionState>((set, get) => ({
  doc: null,
  openDoc: (loaded) => {
    revokePdfIfNeeded(get().doc);
    set({ doc: loaded });
  },
  clearDoc: () => {
    revokePdfIfNeeded(get().doc);
    set({ doc: null });
  },
}));
