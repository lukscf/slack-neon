// Troca o ícone da barra do Chrome para a cor de tema escolhida no popup.
// O ícone de chrome://extensions vem do manifest e é sempre o roxo (o Chrome não deixa mudá-lo).
const COLORS = new Set(["purple", "blue", "pink", "cyan", "green", "bullet"]);

function iconPaths(color) {
  const c = COLORS.has(color) ? color : "purple";
  const path = {};
  for (const n of [16, 32, 48, 128]) path[n] = `icons/${c}/icon${n}.png`;
  return path;
}

async function applyIcon(color) {
  if (color === undefined) ({ color } = await chrome.storage.local.get({ color: "purple" }));
  try {
    await chrome.action.setIcon({ path: iconPaths(color) });
  } catch (error) {
    console.warn("SL Neon: não foi possível trocar o ícone", error);
  }
}

chrome.runtime.onInstalled.addListener(() => applyIcon());
chrome.runtime.onStartup.addListener(() => applyIcon());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.color) applyIcon(changes.color.newValue);
});
applyIcon();

// ---------- Avisos do Windows pelo SL Neon ----------
// O conteúdo vem da página do Slack (notify.js) e vai direto para o aviso do sistema; nada é guardado,
// além do vínculo aviso → aba (em storage.session, que some ao fechar o navegador).
async function linkOf(nid) {
  const { slnLinks = {} } = await chrome.storage.session.get("slnLinks");
  return slnLinks[nid];
}
async function setLink(nid, value) {
  const { slnLinks = {} } = await chrome.storage.session.get("slnLinks");
  if (value) slnLinks[nid] = value; else delete slnLinks[nid];
  const keys = Object.keys(slnLinks);
  if (keys.length > 50) delete slnLinks[keys[0]];
  await chrome.storage.session.set({ slnLinks });
}

async function showSystemNotice(msg, tab) {
  const { color } = await chrome.storage.local.get({ color: "purple" });
  const n = msg.n || {};
  const nid = `sln:${tab?.id ?? 0}:${n.tag || n.id}`;
  const options = {
    type: "basic",
    iconUrl: chrome.runtime.getURL(iconPaths(color)[128]),
    title: String(n.title || "Slack").slice(0, 120),
    message: msg.hide ? "Nova mensagem (conteúdo oculto)" : String(n.body || "Nova mensagem").slice(0, 500),
    contextMessage: msg.test ? "Aviso de teste do SL Neon" : "Slack · SL Neon",
    buttons: [{ title: "Abrir no Slack" }],
    requireInteraction: !!msg.persist,
    silent: !!n.silent,
    priority: 2
  };
  await chrome.notifications.clear(nid).catch(() => {});
  await chrome.notifications.create(nid, options);
  if (!msg.test) await setLink(nid, { tabId: tab?.id, windowId: tab?.windowId, id: n.id });
  return nid;
}

async function openFromNotice(nid) {
  const link = await linkOf(nid);
  chrome.notifications.clear(nid);
  if (!link) return;
  await setLink(nid, null);
  try {
    await chrome.windows.update(link.windowId, { focused: true });
    await chrome.tabs.update(link.tabId, { active: true });
    await chrome.tabs.sendMessage(link.tabId, { type: "sln-notify-click", id: link.id });
  } catch {}
}

chrome.notifications.onClicked.addListener((nid) => { if (nid.startsWith("sln:")) openFromNotice(nid); });
chrome.notifications.onButtonClicked.addListener((nid) => { if (nid.startsWith("sln:")) openFromNotice(nid); });
chrome.notifications.onClosed.addListener(async (nid) => {
  if (!nid.startsWith("sln:")) return;
  const link = await linkOf(nid);
  if (!link) return;
  await setLink(nid, null);
  chrome.tabs.sendMessage(link.tabId, { type: "sln-notify-closed", id: link.id }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!sender.tab?.url?.startsWith("https://app.slack.com/")) return;
  if (msg?.type === "sln-notify") {
    showSystemNotice(msg, sender.tab).then((nid) => reply({ ok: true, nid }), () => reply({ ok: false }));
    return true;
  }
  if (msg?.type === "sln-notify-clear") {
    // o Slack fechou o aviso (por exemplo, você leu a mensagem em outro lugar)
    chrome.storage.session.get("slnLinks").then(({ slnLinks = {} }) => {
      for (const [nid, l] of Object.entries(slnLinks)) if (l.id === msg.id && l.tabId === sender.tab.id) { chrome.notifications.clear(nid); setLink(nid, null); }
    });
  }
});
