import { initialState } from "./seed";
import type { WorkbenchState } from "./types";

const STORAGE_KEY = "sheng-workbench-state-v1";

export function loadState(): WorkbenchState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as WorkbenchState;
    return {
      ...initialState,
      ...parsed,
      settings: {
        ...initialState.settings,
        ...parsed.settings,
      },
    };
  } catch {
    return initialState;
  }
}

export function saveState(state: WorkbenchState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  window.localStorage.removeItem(STORAGE_KEY);
  return initialState;
}

export function exportState(state: WorkbenchState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sheng-workbench-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
