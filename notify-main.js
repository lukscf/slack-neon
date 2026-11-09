// SL Neon: ponte das notificações (roda no mundo da página, antes do Slack carregar).
// O Slack avisa de mensagens com `new Notification(...)`. Quando a opção está ligada, a extensão
// troca essa classe por uma igual que, em vez de chamar o Windows direto, entrega o aviso para o
// SL Neon decidir: aviso neon dentro da página ou aviso do Windows com ícone do tema e botão Abrir.
// O objeto devolvido ao Slack se comporta como uma notificação de verdade (onclick, close etc.),
// então clicar no aviso abre a conversa como antes. Nada sai do navegador.
(() => {
  if (window.__slnNotifyMain || typeof window.Notification !== "function") return;
  window.__slnNotifyMain = true;

  const Original = window.Notification;
  const root = document.documentElement;
  const live = new Map();
  let seq = 0;

  const send = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
  const on = () => root.dataset.slnNotify === "on"; // ligado pelo content script do SL Neon

  class SlnNotification extends EventTarget {
    constructor(title, options = {}) {
      super();
      if (!on()) return new Original(title, options); // opção desligada: comportamento original
      this.title = String(title ?? "");
      this.body = String(options.body ?? "");
      this.icon = String(options.icon ?? "");
      this.tag = String(options.tag ?? "");
      this.data = options.data ?? null;
      this.silent = !!options.silent;
      this.options = options;
      this.onclick = this.onshow = this.onclose = this.onerror = null;
      this.__id = "n" + Date.now().toString(36) + (++seq);
      // mesma tag substitui o aviso anterior, como no navegador
      if (this.tag) for (const n of live.values()) if (n.tag === this.tag) n.__drop();
      live.set(this.__id, this);
      send("sln-notify", { id: this.__id, title: this.title, body: this.body, icon: this.icon, tag: this.tag, silent: this.silent });
      setTimeout(() => this.__fire("show"));
    }
    __fire(type) {
      const ev = new Event(type, { cancelable: true });
      try { this["on" + type]?.call(this, ev); } catch (e) { setTimeout(() => { throw e; }); }
      this.dispatchEvent(ev);
      return ev;
    }
    __drop() {
      if (!live.delete(this.__id)) return;
      this.__fire("close");
    }
    close() {
      if (!live.has(this.__id)) return;
      send("sln-notify-close", { id: this.__id });
      this.__drop();
    }
    static get permission() { return Original.permission; }
    static requestPermission(...args) { return Original.requestPermission(...args); }
    static get maxActions() { return Original.maxActions; }
  }
  Object.defineProperty(SlnNotification, "name", { value: "Notification" });
  try {
    Object.defineProperty(window, "Notification", { value: SlnNotification, writable: true, configurable: true });
  } catch {
    return;
  }

  const parse = (e) => { try { return JSON.parse(e.detail); } catch { return {}; } };

  // clique no aviso neon ou no aviso do Windows: o Slack abre a conversa
  document.addEventListener("sln-notify-click", (e) => {
    const n = live.get(parse(e).id);
    if (!n) return;
    try { window.focus(); } catch {}
    n.__fire("click");
    n.__drop();
  });
  document.addEventListener("sln-notify-closed", (e) => live.get(parse(e).id)?.__drop());

  // o SL Neon decidiu não mexer neste aviso: mostra o original do navegador, ligado ao objeto do Slack
  document.addEventListener("sln-notify-native", (e) => {
    const n = live.get(parse(e).id);
    if (!n) return;
    try {
      const real = new Original(n.title, n.options);
      real.onclick = () => { try { window.focus(); } catch {} n.__fire("click"); n.__drop(); real.close(); };
      real.onclose = () => n.__drop();
      const close = n.close.bind(n);
      n.close = () => { real.close(); close(); };
    } catch {}
  });
})();
