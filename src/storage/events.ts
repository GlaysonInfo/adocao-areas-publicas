// src/storage/events.ts
import type { ProposalEvent } from "../domain/event";

const KEY = "mvp_events_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

function safeUuid(): string {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readAllRaw(): any[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEvent(raw: any): ProposalEvent | null {
  if (!raw) return null;
  const e: ProposalEvent = {
    id: String(raw.id ?? safeUuid()),
    proposal_id: String(raw.proposal_id ?? ""),
    area_id: String(raw.area_id ?? ""),
    type: raw.type,
    at: String(raw.at ?? new Date().toISOString()),
    actor_role: String(raw.actor_role ?? "sistema"),
    from_col: raw.from_col,
    to_col: raw.to_col,
    note: raw.note,
    outcome: raw.outcome,
  };

  if (!e.proposal_id || !e.area_id || !e.type) return null;
  return e;
}

function writeAll(events: ProposalEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(events));
  notify();
}

export function subscribeEvents(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listEvents(): ProposalEvent[] {
  const all = readAllRaw()
    .map(normalizeEvent)
    .filter(Boolean) as ProposalEvent[];

  all.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return all;
}

export function appendEvent(input: Omit<ProposalEvent, "id"> & { id?: string }) {
  const all = listEvents();
  const ev: ProposalEvent = {
    ...input,
    id: input.id ?? safeUuid(),
  };
  all.push(ev);
  writeAll(all);
  return ev;
}

/** Útil para testes/replay: apaga o log inteiro */
export function clearEvents() {
  localStorage.removeItem(KEY);
  notify();
}