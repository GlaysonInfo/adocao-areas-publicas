// src/storage/protocol.ts
function get_year() {
  return new Date().getFullYear();
}

/**
 * Sequência única anual compartilhada (propostas e solicitações)
 * Formato: BETIM-YYYY-0001
 */
export function next_protocol(): string {
  const year = get_year();
  const key = `mvp_protocolo_seq_${year}`;
  const current = Number(localStorage.getItem(key) ?? "0");
  const next = current + 1;
  localStorage.setItem(key, String(next));
  const seq = String(next).padStart(4, "0");
  return `BETIM-${year}-${seq}`;
}