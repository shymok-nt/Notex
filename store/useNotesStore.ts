import { create } from 'zustand';

export type Note = { id: string; title: string; createdAt: number };

type NotesState = {
  notes: Note[];
  addNote: () => string;
};

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  addNote: () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({ notes: [{ id, title: 'Başlıksız Not', createdAt: Date.now() }, ...state.notes] }));
    return id;
  },
}));
