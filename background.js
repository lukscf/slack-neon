// Troca o ícone da barra do Chrome para a cor de tema escolhida no popup.
// O ícone de chrome://extensions vem do manifest e é sempre o roxo (o Chrome não deixa mudá-lo).
const COLORS = new Set(["purple", "blue", "pink", "cyan", "green"]);

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
