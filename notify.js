// SL Neon: avisos de mensagens.
// - Slack aberto e em foco na tela: aviso neon no canto da página, na cor do tema.
// - Slack em segundo plano: aviso do Windows pelo SL Neon (ícone do tema, botão "Abrir no Slack",
//   opção de ficar na tela até fechar e de esconder o texto da mensagem).
// - Opções desligadas: o aviso original do navegador, sem mudança.
// O texto das mensagens só é usado para montar o aviso e não é guardado nem enviado a lugar nenhum.
(() => {
  if (window.__slnNotifyLoaded) return;
  window.__slnNotifyLoaded = true;

  const DEFAULTS = { notifyToast: true, notifyEnhance: true, notifyPersist: false, notifyPrivate: false, privacy: false, color: "purple" };
  const cfg = { ...DEFAULTS };
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const send = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
  const parse = (e) => { try { return JSON.parse(e.detail); } catch { return null; } };

  function sync() {
    root.dataset.slnNotify = cfg.notifyToast || cfg.notifyEnhance ? "on" : "off";
  }
  chrome.storage.local.get(DEFAULTS).then((s) => { Object.assign(cfg, s); sync(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const k of Object.keys(DEFAULTS)) if (changes[k]) cfg[k] = changes[k].newValue ?? DEFAULTS[k];
    sync();
  });

  const hidden = () => cfg.notifyPrivate || cfg.privacy; // modo discreto também esconde o texto

  // ---------- Aviso neon dentro da página ----------
  let stack;
  const toasts = new Map();
  function ensureStack() {
    if (stack?.isConnected) return stack;
    stack = document.createElement("div");
    stack.id = "sln-toasts";
    stack.setAttribute("role", "region");
    stack.setAttribute("aria-label", "Avisos do Slack");
    document.body.appendChild(stack);
    return stack;
  }
  function removeToast(id, notifySlack) {
    const el = toasts.get(id);
    if (!el) return;
    toasts.delete(id);
    clearTimeout(el._t);
    el.classList.add("out");
    setTimeout(() => el.remove(), reduced.matches ? 0 : 260);
    if (notifySlack) send("sln-notify-closed", { id });
  }
  function showToast(n, { test = false } = {}) {
    ensureStack();
    // mesma tag: substitui o aviso anterior
    if (n.tag) for (const [id, el] of toasts) if (el.dataset.tag === n.tag) removeToast(id, false);
    const el = document.createElement("div");
    el.className = "sln-toast";
    el.dataset.tag = n.tag || "";
    el.setAttribute("role", "alert");
    el.tabIndex = 0;
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    if (/^https:\/\//.test(n.icon)) img.src = n.icon; else img.classList.add("empty");
    img.addEventListener("error", () => img.classList.add("empty"));
    const text = document.createElement("div");
    text.className = "sln-toast-text";
    const title = document.createElement("strong");
    title.textContent = n.title || "Slack";
    const body = document.createElement("p");
    body.textContent = hidden() ? "Nova mensagem (conteúdo oculto)" : (n.body || "Nova mensagem");
    const x = document.createElement("button");
    x.type = "button";
    x.className = "sln-toast-x";
    x.setAttribute("aria-label", "Fechar aviso");
    x.textContent = "×";
    text.append(title, body);
    el.append(img, text, x);
    if (test) el.classList.add("test");
    const open = () => { removeToast(n.id, false); if (!test) send("sln-notify-click", { id: n.id }); };
    el.addEventListener("click", (e) => { if (e.target === x) return; open(); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); if (e.key === "Escape") removeToast(n.id, !test); });
    x.addEventListener("click", (e) => { e.stopPropagation(); removeToast(n.id, !test); });
    const arm = () => { clearTimeout(el._t); if (!cfg.notifyPersist) el._t = setTimeout(() => removeToast(n.id, !test), 6500); };
    el.addEventListener("mouseenter", () => clearTimeout(el._t));
    el.addEventListener("mouseleave", arm);
    stack.prepend(el);
    toasts.set(n.id, el);
    while (toasts.size > 4) removeToast(toasts.keys().next().value, true); // no máximo 4 na tela
    arm();
  }

  // ---------- Decide qual aviso mostrar ----------
  function route(n) {
    const focused = document.visibilityState === "visible" && document.hasFocus();
    if (focused && cfg.notifyToast) return showToast(n);
    if (cfg.notifyEnhance) {
      // se o aviso do sistema falhar, cai no aviso original do navegador
      chrome.runtime.sendMessage({ type: "sln-notify", n, persist: !!cfg.notifyPersist, hide: hidden() })
        .then((r) => { if (!r?.ok) send("sln-notify-native", { id: n.id }); })
        .catch(() => send("sln-notify-native", { id: n.id }));
      return;
    }
    send("sln-notify-native", { id: n.id }); // aviso original do navegador
  }

  document.addEventListener("sln-notify", (e) => { const n = parse(e); if (n?.id) route(n); });
  document.addEventListener("sln-notify-close", (e) => {
    const n = parse(e);
    if (!n?.id) return;
    removeToast(n.id, false);
    chrome.runtime.sendMessage({ type: "sln-notify-clear", id: n.id }).catch(() => {});
  });

  // cliques no aviso do Windows chegam pelo background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "sln-notify-click") send("sln-notify-click", { id: msg.id });
    else if (msg?.type === "sln-notify-closed") send("sln-notify-closed", { id: msg.id });
    else if (msg?.type === "sln-notify-test") {
      // teste do popup: mostra os dois avisos, sem mexer em nenhuma conversa
      const n = { id: "teste-" + Date.now(), title: "SL Neon: aviso de teste", body: "Assim chegam as mensagens novas no Slack.", icon: "", tag: "" };
      showToast(n, { test: true });
      if (cfg.notifyEnhance) chrome.runtime.sendMessage({ type: "sln-notify", n, persist: !!cfg.notifyPersist, hide: hidden(), test: true }).catch(() => {});
    }
  });

  sync();
})();
