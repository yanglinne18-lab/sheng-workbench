import { initialState } from "./seed";
import type { WorkbenchState } from "./types";

const STORAGE_KEY = "sheng-workbench-state-v1";
const SAVED_AT_KEY = "sheng-workbench-saved-at-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function arrayOrDefault<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function normalizeState(input: unknown): WorkbenchState {
  const source = isRecord(input) ? input : {};
  const settings = isRecord(source.settings) ? source.settings : {};

  return {
    ...initialState,
    ...source,
    notes: arrayOrDefault(source.notes, initialState.notes),
    people: arrayOrDefault(source.people, initialState.people),
    organizations: arrayOrDefault(source.organizations, initialState.organizations),
    relationships: arrayOrDefault(source.relationships, initialState.relationships),
    interactions: arrayOrDefault(source.interactions, initialState.interactions),
    opportunities: arrayOrDefault(source.opportunities, initialState.opportunities),
    tasks: arrayOrDefault(source.tasks, initialState.tasks),
    settings: {
      ...initialState.settings,
      ...settings,
    },
  };
}

export function loadState(): WorkbenchState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return normalizeState(JSON.parse(raw));
  } catch {
    return initialState;
  }
}

export function saveState(state: WorkbenchState) {
  const savedAt = new Date().toISOString();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.localStorage.setItem(SAVED_AT_KEY, savedAt);
  return savedAt;
}

export function getSavedAt() {
  return window.localStorage.getItem(SAVED_AT_KEY);
}

export function resetState() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(SAVED_AT_KEY);
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
