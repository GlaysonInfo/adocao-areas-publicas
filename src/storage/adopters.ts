// src/storage/adopters.ts
import type { AdotantePerfil, AdotanteRole } from "../domain/adopter";

const KEY = "mvp_adopters_v1";

function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readAll(): AdotantePerfil[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdotantePerfil[]) : [];
  } catch {
    // se corrompeu, volta vazio (não derruba o app)
    return [];
  }
}

function writeAll(items: AdotantePerfil[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function norm(s: unknown) {
  return String(s ?? "").trim();
}

function isValidEmail(email: string) {
  // simples e suficiente pro MVP
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getAdopterProfile(role: AdotanteRole): AdotantePerfil | null {
  const all = readAll();
  return all.find((p) => p.role === role) ?? null;
}

export function upsertAdopterProfile(input: {
  role: AdotanteRole;
  nome_razao_social: string;
  email: string;
  celular: string;
  whatsapp?: string;
}): { ok: true; profile: AdotantePerfil } | { ok: false; message: string } {
  try {
    const role = input.role;
    const nome = norm(input.nome_razao_social);
    const email = norm(input.email).toLowerCase();
    const celular = norm(input.celular);
    const whatsapp = norm(input.whatsapp);

    if (!nome) return { ok: false, message: "Informe Nome / Razão social." };
    if (!email || !isValidEmail(email)) return { ok: false, message: "Informe um e-mail válido." };
    if (!celular) return { ok: false, message: "Informe o celular (com DDD)." };

    const all = readAll();
    const existing = all.find((p) => p.role === role);

    const next: AdotantePerfil = existing
      ? {
          ...existing,
          nome_razao_social: nome,
          email,
          celular,
          whatsapp: whatsapp || undefined,
          updated_at: nowIso(),
        }
      : {
          id: safeUuid(),
          role,
          nome_razao_social: nome,
          email,
          celular,
          whatsapp: whatsapp || undefined,
          created_at: nowIso(),
          updated_at: nowIso(),
        };

    const merged = existing ? all.map((p) => (p.role === role ? next : p)) : [next, ...all];
    writeAll(merged);

    return { ok: true, profile: next };
  } catch {
    return { ok: false, message: "Falha ao salvar no armazenamento local (localStorage)." };
  }
}