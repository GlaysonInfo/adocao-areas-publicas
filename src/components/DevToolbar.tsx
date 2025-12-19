import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function collectMvpDump() {
  const dump: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("mvp_")) {
      const v = localStorage.getItem(k);
      if (v !== null) dump[k] = v;
    }
  }
  return dump;
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function clearMvpStorage() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("mvp_")) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

export function DevToolbar() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <strong style={{ opacity: 0.75 }}>DEV</strong>

      <span style={{ opacity: 0.75 }}>
        Perfil: <strong>{role ?? "—"}</strong>
      </span>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      >
        Sair / Trocar perfil
      </button>

      <button
        type="button"
        onClick={() => {
          const ok = confirm("Resetar dados do MVP? Isso apaga chaves mvp_* do localStorage.");
          if (!ok) return;
          clearMvpStorage();
          navigate("/login", { replace: true });
          window.location.reload();
        }}
      >
        Resetar dados (MVP)
      </button>

      <button
        type="button"
        onClick={() => {
          const dump = collectMvpDump();
          downloadJson(`mvp_dump_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, dump);
        }}
      >
        Exportar dump
      </button>

      <button type="button" onClick={() => fileRef.current?.click()}>
        Importar dump
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.item(0);
          if (!f) return;

          try {
            const text = await f.text();
            const parsed = JSON.parse(text) as Record<string, string>;

            const ok = confirm("Importar dump? Isso sobrescreve as chaves mvp_* atuais.");
            if (!ok) return;

            // limpa e restaura
            clearMvpStorage();
            for (const [k, v] of Object.entries(parsed)) {
              if (k.startsWith("mvp_")) localStorage.setItem(k, v);
            }

            window.location.reload();
          } catch {
            alert("Arquivo inválido (esperado um JSON com chaves mvp_*).");
          } finally {
            // permite importar o mesmo arquivo novamente
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}