const DEFAULTS = {
  theme: true, tilt: true, composeFx: true, privacy: false,
  color: "purple", background: "aurora"
};
const COLORS = { purple: "#bd77ff", blue: "#5c9dff", pink: "#ff74bb", cyan: "#4fe0db", green: "#75df95" };
// O popup inteiro acompanha a cor: fundo, painéis, linhas e texto secundário têm o mesmo tom.
const HUES = { purple: 275, blue: 218, pink: 330, cyan: 178, green: 140 };
function tint(color) {
  const h = HUES[color] ?? HUES.purple;
  const root = document.documentElement.style;
  root.setProperty("--bg", `hsl(${h} 50% 4%)`);
  root.setProperty("--panel", `hsl(${h} 42% 10%)`);
  root.setProperty("--line", `hsl(${h} 30% 24%)`);
  root.setProperty("--text", `hsl(${h} 100% 96%)`);
  root.setProperty("--muted", `hsl(${h} 22% 70%)`);
  root.setProperty("--top", `hsl(${h} 40% 20%)`);
}
const SLACK = "https://app.slack.com/";
const $ = (selector) => document.querySelector(selector);

function status(message, error = false) {
  const el = $("#status");
  el.textContent = message;
  el.style.color = error ? "#ff9db1" : "var(--accent)";
}

function showColor(color) {
  document.documentElement.style.setProperty("--accent", COLORS[color] || COLORS.purple);
  tint(color);
  document.querySelectorAll(".colors button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.color === color));
  });
}

chrome.storage.local.get(DEFAULTS).then((settings) => {
  for (const key of ["theme", "tilt", "composeFx", "privacy"]) $("#" + key).checked = !!settings[key];
  $("#background").value = settings.background;
  showColor(settings.color);
});

for (const key of ["theme", "tilt", "composeFx", "privacy"]) {
  $("#" + key).addEventListener("change", (event) => {
    chrome.storage.local.set({ [key]: event.target.checked });
    status("Preferência salva.");
  });
}
$("#background").addEventListener("change", (event) => {
  chrome.storage.local.set({ background: event.target.value });
  status("Fundo atualizado.");
});
document.querySelectorAll(".colors button").forEach((button) => button.addEventListener("click", () => {
  const color = button.dataset.color;
  showColor(color);
  chrome.storage.local.set({ color });
  status("Cor atualizada.");
}));

// Diagnóstico: mostra se a extensão está ativa na aba do Slack aberta.
(async () => {
  const diag = $("#diag");
  const version = chrome.runtime.getManifest().version;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.startsWith(SLACK)) {
      diag.textContent = `SL Neon ${version}. Abra o Slack em app.slack.com para ver o diagnóstico.`;
      return;
    }
    const info = await chrome.tabs.sendMessage(tab.id, { type: "ping" });
    diag.textContent = `SL Neon ${version} ativo nesta aba. Tema ${info.theme ? "aplicado" : "desligado"}.`;
  } catch {
    diag.textContent = `SL Neon ${version} instalado, mas não está rodando nesta aba. Recarregue o Slack (F5).`;
  }
})();
