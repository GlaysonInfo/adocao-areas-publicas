# VALIDATION — Evidências e reprodução

## A) Snapshot sanitizado do localStorage (manual, via DevTools)
1) Abrir o portal no navegador.
2) DevTools → Console.
3) Rodar:

```js
(() => {
  const out = {};
  for (const k of Object.keys(localStorage)) {
    const v = localStorage.getItem(k);
    out[k] = v && v.length > 2000 ? v.slice(0, 2000) + "…(trunc)" : v;
  }
  console.log(out);
  copy(JSON.stringify(out, null, 2));
})();