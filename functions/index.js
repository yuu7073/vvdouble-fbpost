// VV DOUBLE · FB 貼文工具 · Cloud Function 中間站
// 網頁 → 這裡（各家 Token 存在 Realtime Database /fbpost/config，前端讀不到）→ Meta / Dropbox / Shopline / Anthropic
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const SHOPLINE_TOKEN = defineSecret("SHOPLINE_TOKEN"); // 與官網批次中心共用
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");

admin.initializeApp();

const VERSION = "2026-10-26z";
const GRAPH = "https://graph.facebook.com/v21.0";
const SL = "https://open.shopline.io/v1";
const DBX_API = "https://api.dropboxapi.com/2";
const DBX_CONTENT = "https://content.dropboxapi.com/2";
const ANTHROPIC = "https://api.anthropic.com/v1/messages";

const ALLOW_ORIGINS = [
  "https://yuu7073.github.io",
  "http://localhost",
  "http://127.0.0.1",
  "null",
];

function cors(req, res) {
  const origin = req.headers.origin || "null";
  const ok = ALLOW_ORIGINS.some((o) => origin === o || origin.startsWith(o + ":"));
  res.set("Access-Control-Allow-Origin", ok ? origin : ALLOW_ORIGINS[0]);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Tool-Password");
  res.set("Access-Control-Max-Age", "3600");
}

const db = () => admin.database();
const cfgRef = () => db().ref("/fbpost/config");

async function loadConfig() {
  const s = await cfgRef().get();
  const cfg = s.exists() ? s.val() : {};
  if (!cfg.shoplineToken) { try { cfg.shoplineToken = SHOPLINE_TOKEN.value(); } catch (e) {} }
  return cfg;
}

// ---------- 小工具 ----------
function taipeiParts(ts) {
  // 回傳台北時間的 MM DD YY HH mm
  const d = new Date(ts);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const o = {};
  f.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
  if (o.hour === "24") o.hour = "00";
  return o;
}
function utmCampaign(ts) {
  const p = taipeiParts(ts);
  return `${p.month}${p.day}${p.year}_${p.hour}${p.minute}`;
}
// 商品描述裡的「模特兒參考」表：MODEL／穿著／身高／體重／…／感受
function parseModels(html) {
  const out = [];
  const parts = String(html || "").split(/模特兒參考|MODELS REFERENCE/i);
  const sec = parts[parts.length - 1];
  if (parts.length < 2) return out;
  const table = sec.split(/<\/table>/i)[0];
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let head = [];
  rows.forEach((r) => {
    const cells = (r.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map((c) => c.replace(/<[^>]+>/g, "").trim());
    if (!cells.length) return;
    if (/MODEL/i.test(cells[0]) || /穿著/.test(cells.join(""))) { head = cells; return; }
    const o = {}; cells.forEach((v, i) => { o[head[i] || ("c" + i)] = v; });
    const name = o.MODEL || cells[0];
    if (name) out.push({ name, size: o["穿著"] || cells[1] || "", height: o["身高"] || "", weight: o["體重"] || "", feel: o["感受"] || "" });
  });
  return out;
}
function parseMaterial(html) {
  const m = String(html || "").replace(/<[^>]+>/g, " ").match(/材質[：:]\s*([^|｜\n]{2,60})/);
  return m ? m[1].trim() : "";
}
function stripHtml(s) {
  return String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- Google Sheets（Cloud Function 服務帳號讀取；試算表需分享給它）----------
async function sheetsGet(spreadsheetId, range) {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const client = await auth.getClient();
  const r = await client.request({ url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}` });
  return (r.data && r.data.values) || [];
}
async function serviceEmail() {
  try { const auth = new GoogleAuth(); const c = await auth.getCredentials(); if (c && c.client_email) return c.client_email; } catch (e) {}
  try { const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", { headers: { "Metadata-Flavor": "Google" } }); return await r.text(); } catch (e) { return ""; }
}
// 「10/15」「11/3（直播 11/2）」→ 取第一個 M/D；年份：7 月以後算 baseYear，否則 baseYear+1
function parseMD(s, baseYear) {
  const m = String(s || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return null;
  const mo = Number(m[1]), d = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const y = mo >= 7 ? baseYear : baseYear + 1;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ---------- reurl.cc 短網址 ----------
async function shorten(cfg, url) {
  if (!cfg.bitlyToken && !cfg.reurlKey) throw new Error("尚未設定 Bitly Token 或 reurl API Key");
  const key = Buffer.from(url).toString("base64url").slice(0, 120);
  const ref = db().ref("/fbpost/short/" + key);
  const s = await ref.get();
  if (s.exists() && s.val().short) return s.val().short;
  let short;
  if (cfg.bitlyToken) {
    const r = await fetch("https://api-ssl.bitly.com/v4/shorten", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.bitlyToken }, body: JSON.stringify({ long_url: url }) });
    const j = await r.json().catch(() => ({}));
    if (!j.link) throw new Error("Bitly 失敗：" + (j.description || j.message || JSON.stringify(j).slice(0, 160)));
    short = j.link;
  } else {
    const r = await fetch("https://api.reurl.cc/shorten", { method: "POST", headers: { "Content-Type": "application/json", "reurl-api-key": cfg.reurlKey }, body: JSON.stringify({ url }) });
    const j = await r.json().catch(() => ({}));
    if (!j.short_url) throw new Error("reurl 失敗：" + JSON.stringify(j).slice(0, 160));
    short = j.short_url;
  }
  await ref.set({ url, short, at: Date.now() });
  return short;
}

// ---------- Shopline ----------
async function slFetch(token, path, opt = {}) {
  const headers = { Authorization: "Bearer " + token, Accept: "application/json" };
  if (opt.json) { headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(opt.json); }
  const r = await fetch(SL + path, { method: opt.method || "GET", headers, body: opt.body });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
function slProduct(it) {
  const t = (it.title_translations || {})["zh-hant"] || "";
  const v = it.variations || [];
  const price = (it.price && it.price.dollars) || (v[0] && v[0].price && v[0].price.dollars) || null;
  const priceSale = (it.price_sale && it.price_sale.dollars) || null;
  return {
    id: it.id,
    title: t,
    status: it.status,
    sku: (v[0] || {}).sku || it.sku || "",
    price, priceSale,
    images: (it.medias || []).map((m) => m.images && m.images.original && m.images.original.url).filter(Boolean),
    detailImages: (it.detail_medias || []).map((m) => m.images && m.images.original && m.images.original.url).filter(Boolean),
    description: stripHtml((it.description_translations || {})["zh-hant"] || "").replace(/商品平量尺寸表[\s\S]*$/, "").slice(0, 800),
    models: parseModels((it.description_translations || {})["zh-hant"] || ""),
    material: parseMaterial((it.description_translations || {})["zh-hant"] || ""),
    colors: [...new Set(v.map((x) => ((x.fields_translations || [])[0] || {})["zh-hant"] || (x.fields || [])[0] && (x.fields[0]["zh-hant"] || x.fields[0].name) || "").filter(Boolean))],
    sizes: [...new Set(v.map((x) => ((x.fields_translations || [])[1] || {})["zh-hant"] || (x.fields || [])[1] && (x.fields[1]["zh-hant"] || x.fields[1].name) || "").filter(Boolean))],
    url: "https://www.vvdouble.com/products/" + it.id,
  };
}

// ---------- Dropbox ----------
const dbxCache = { token: "", exp: 0 };
async function dbxToken(cfg) {
  if (dbxCache.token && Date.now() < dbxCache.exp - 60000) return dbxCache.token;
  if (!cfg.dropboxRefresh || !cfg.dropboxAppKey) throw new Error("Dropbox 尚未連接");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: cfg.dropboxRefresh, client_id: cfg.dropboxAppKey });
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body });
  const j = await r.json();
  if (!j.access_token) throw new Error("Dropbox token 更新失敗：" + JSON.stringify(j).slice(0, 200));
  dbxCache.token = j.access_token;
  dbxCache.exp = Date.now() + (j.expires_in || 14400) * 1000;
  return j.access_token;
}
// Dropbox Business：團隊資料夾在 root namespace，所有呼叫都帶 Path-Root
let dbxRootNs = "";
async function dbxPathRoot(cfg) {
  if (dbxRootNs) return dbxRootNs;
  const tok = await dbxToken(cfg);
  const r = await fetch(DBX_API + "/users/get_current_account", { method: "POST", headers: { Authorization: "Bearer " + tok } });
  const j = await r.json().catch(() => ({}));
  const ri = j.root_info || {};
  if (ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id) dbxRootNs = JSON.stringify({ ".tag": "root", root: ri.root_namespace_id });
  else dbxRootNs = "home";
  return dbxRootNs;
}
async function dbxHeaders(cfg, extra) {
  const tok = await dbxToken(cfg);
  const h = Object.assign({ Authorization: "Bearer " + tok }, extra || {});
  const pr = await dbxPathRoot(cfg);
  if (pr && pr !== "home") h["Dropbox-API-Path-Root"] = pr;
  return h;
}
async function dbxRpc(cfg, path, json) {
  const r = await fetch(DBX_API + path, { method: "POST", headers: await dbxHeaders(cfg, { "Content-Type": "application/json" }), body: JSON.stringify(json) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Dropbox " + path + " " + r.status + " " + JSON.stringify(j).slice(0, 200));
  return j;
}
async function dbxContent(cfg, path, arg) {
  // header 只能放 ASCII：非 ASCII 字元轉成 \uXXXX（Dropbox 官方建議做法）
  const argStr = JSON.stringify(arg).replace(/[\u007f-\uffff]/g, (c) => "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4));
  const r = await fetch(DBX_CONTENT + path, { method: "POST", headers: await dbxHeaders(cfg, { "Dropbox-API-Arg": argStr }) });
  if (!r.ok) throw new Error("Dropbox " + path + " " + r.status + " " + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;


// ---------- Microsoft Graph（Teams 門市照片同步） ----------
const MSG = "https://graph.microsoft.com/v1.0";
const msCache = { token: "", exp: 0 };
async function msToken(cfg) {
  if (msCache.token && Date.now() < msCache.exp - 60000) return msCache.token;
  if (!cfg.msTenant || !cfg.msClientId || !cfg.msSecret) throw new Error("尚未設定 Microsoft 365（租用戶 ID、應用程式 ID、密鑰）");
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.msClientId, client_secret: cfg.msSecret, scope: "https://graph.microsoft.com/.default" });
  const r = await fetch(`https://login.microsoftonline.com/${cfg.msTenant}/oauth2/v2.0/token`, { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("Microsoft 登入失敗：" + (j.error_description || JSON.stringify(j)).slice(0, 200));
  msCache.token = j.access_token; msCache.exp = Date.now() + (j.expires_in || 3600) * 1000;
  return j.access_token;
}
async function msGet(cfg, url, raw) {
  const r = await fetch(url.startsWith("http") ? url : MSG + url, { headers: { Authorization: "Bearer " + (await msToken(cfg)) } });
  if (!r.ok) throw new Error("Graph " + r.status + " " + (await r.text()).slice(0, 200));
  return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
}
const STORE_SHORT = [["忠孝", "忠孝"], ["統一", "統一"], ["桃園", "桃園"], ["ATT", "桃園"], ["新一中", "台中"], ["一中", "台中"], ["台中", "台中"], ["台南", "台南"], ["新天地", "台南"], ["高雄", "高雄"], ["新堀江", "高雄"]];
function storeShort(loc) { const s = String(loc || ""); for (const [k, v] of STORE_SHORT) if (s.includes(k)) return v; return ""; }
function tpeDate(iso) { const d = new Date(new Date(iso).getTime() + 8 * 3600000); return { ym: d.toISOString().slice(0, 7), mmddyy: d.toISOString().slice(5, 7) + d.toISOString().slice(8, 10) + d.toISOString().slice(2, 4) }; }
async function msFindTeamChannels(cfg) {
  const teamName = cfg.teamsTeam || "門市總彙";
  const norm = (s) => String(s || "").replace(/[\s【】\[\]（）()「」]/g, "");
  let teams = [], url = "/teams?$select=id,displayName&$top=100";
  while (url) { const p = await msGet(cfg, url); teams = teams.concat(p.value || []); url = p["@odata.nextLink"] || ""; }
  const team = teams.find((x) => norm(x.displayName) === norm(teamName)) || teams.find((x) => norm(x.displayName).includes(norm(teamName)));
  if (!team) throw new Error("找不到團隊：" + teamName + "。現有團隊：" + teams.map((x) => x.displayName).join("、"));
  const c = await msGet(cfg, `/teams/${team.id}/channels`);
  const find = (name) => (c.value || []).find((x) => norm(x.displayName).includes(norm(name)));
  const display = find(cfg.teamsChanDisplay || "陳列回報"), staff = find(cfg.teamsChanStaff || "穿搭分享");
  return { team, display, staff, channels: (c.value || []).map((x) => x.displayName) };
}
const msUserCache = {};
async function msUser(cfg, id) {
  if (!id) return { name: "", store: "", loc: "" };
  if (msUserCache[id]) return msUserCache[id];
  let u = {};
  try { u = await msGet(cfg, `/users/${id}?$select=displayName,officeLocation,department,jobTitle`); } catch (e) {}
  const loc = u.officeLocation || u.department || "";
  return (msUserCache[id] = { name: (u.displayName || "").trim(), store: storeShort(loc) || storeShort(u.department) || storeShort(u.jobTitle), loc });
}
async function dbxEnsureFolder(cfg, path) {
  try { await dbxRpc(cfg, "/files/create_folder_v2", { path, autorename: false }); } catch (e) { if (!/conflict/.test(e.message)) throw e; }
}
async function dbxListNames(cfg, path) {
  try { const j = await dbxRpc(cfg, "/files/list_folder", { path, recursive: false, limit: 2000 }); let out = (j.entries || []).map((e) => e.name); let cur = j.cursor, more = j.has_more; while (more) { const k = await dbxRpc(cfg, "/files/list_folder/continue", { cursor: cur }); out = out.concat((k.entries || []).map((e) => e.name)); cur = k.cursor; more = k.has_more; } return out; } catch (e) { if (/not_found/.test(e.message)) return []; throw e; }
}
async function dbxUpload(cfg, path, buf) {
  const argStr = JSON.stringify({ path, mode: "add", autorename: true, mute: true }).replace(/[\u007f-￿]/g, (c) => "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4));
  const r = await fetch(DBX_CONTENT + "/files/upload", { method: "POST", headers: await dbxHeaders(cfg, { "Dropbox-API-Arg": argStr, "Content-Type": "application/octet-stream" }), body: buf });
  if (!r.ok) throw new Error("Dropbox upload " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}
function extOf(mime, name) { const m = /\.(jpe?g|jfif|png|gif|webp|mp4|mov|heic)$/i.exec(name || ""); if (m) return m[0].toLowerCase().replace(".jfif", ".jpg").replace(".jpeg", ".jpg"); if (/png/.test(mime)) return ".png"; if (/gif/.test(mime)) return ".gif"; if (/webp/.test(mime)) return ".webp"; if (/mp4|video/.test(mime)) return ".mp4"; return ".jpg"; }
// 同步一個頻道：kind = display（陳列）| staff（實穿）
function teamsRoot(cfg) {
  // 門市素材固定放官網部門底下（不跟商品根目錄的檔期子資料夾走）；teamsFolder 以 / 開頭則視為絕對路徑
  const tf = cfg.teamsFolder || "門市素材";
  if (tf.startsWith("/")) return tf;
  const root = cfg.dropboxRoot || "";
  const i = root.indexOf("/官網部門");
  return (i >= 0 ? root.slice(0, i + 5) : root) + "/" + tf;
}
async function teamsSyncChannel(cfg, team, channel, kind, since, limit, dry, deadline) {
  const doneRef = db().ref(`/fbpost/teams/done/${kind}`);
  const doneSnap = await doneRef.get(); const done = doneSnap.exists() ? doneSnap.val() : {};
  const root = teamsRoot(cfg) + "/" + (kind === "display" ? "陳列" : "實穿");
  const log = [], counters = {};
  let url = `/teams/${team.id}/channels/${channel.id}/messages?$top=50`, processed = 0, uploaded = 0, stop = false, more = false;
  while (url && !stop) {
    const page = await msGet(cfg, url);
    for (const m of page.value || []) {
      if (m.createdDateTime < since) { stop = true; break; }
      if (m.messageType !== "message" || done[m.id]) continue;
      if (processed >= limit || (deadline && Date.now() > deadline)) { stop = true; more = true; break; }
      processed++;
      const imgs = []; const re = /<img[^>]*src="([^"]*hostedContents\/([^"\/]+)\/\$value)"[^>]*>/g; let mm;
      while ((mm = re.exec(m.body && m.body.content || ""))) imgs.push({ url: mm[1].replace(/&amp;/g, "&"), id: mm[2] });
      const atts = (m.attachments || []).filter((a) => a.contentType === "reference");
      if (!imgs.length && !atts.length) { if (!dry) await doneRef.child(m.id).set({ at: m.createdDateTime, n: 0 }); continue; }
      const user = await msUser(cfg, m.from && m.from.user && m.from.user.id);
      const d = tpeDate(m.createdDateTime);
      const store = user.store || "未知門市";
      const folder = kind === "display" ? `${root}/${d.ym}/${store}` : `${root}/${d.ym}`;
      const prefix = kind === "display" ? `${store}陳列_${d.mmddyy}_` : `${store}_${user.name}_${d.mmddyy}_`;
      const ck = folder + "|" + prefix;
      if (counters[ck] === undefined) { const names = await dbxListNames(cfg, folder); counters[ck] = names.filter((n) => n.startsWith(prefix)).map((n) => Number((/_(\d+)\.[a-z0-9]+$/i.exec(n) || [])[1] || 0)).reduce((a, b) => Math.max(a, b), 0); }
      const files = []; let failed = 0;
      // 來源：貼在訊息裡的圖（hostedContents）＋上傳檔案（SharePoint 附件，用 shares API 下載）
      const srcs = imgs.map((im) => ({ url: im.url, name: "" })).concat(atts.filter((a) => /\.(jpe?g|jfif|png|gif|webp|heic|mp4|mov)$/i.test(a.name || "")).map((a) => ({ url: `/shares/u!${Buffer.from(a.contentUrl).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-")}/driveItem/content`, name: a.name })));
      const others = (m.attachments || []).filter((a) => !(a.contentType === "reference" && /\.(jpe?g|jfif|png|gif|webp|heic|mp4|mov)$/i.test(a.name || ""))).map((a) => (a.name || "") + "[" + a.contentType + "]");
      for (const im of srcs) {
        try {
          const buf = dry ? null : await msGet(cfg, im.url, true);
          counters[ck]++;
          const name = prefix + counters[ck] + extOf("", im.name || "x.jpg");
          if (!dry) { await dbxEnsureFolder(cfg, folder); await dbxUpload(cfg, folder + "/" + name, buf); }
          files.push(name); uploaded++;
        } catch (e) { failed++; log.push({ msg: m.id, error: (im.name || "圖") + "：" + e.message.slice(0, 200) }); }
      }
      if (others.length) log.push({ msg: m.id, skipped: "略過附件：" + others.join("、").slice(0, 300) });
      log.push({ at: m.createdDateTime.slice(0, 16), who: user.name, store, loc: user.loc, files });
      if (!dry && !failed) await doneRef.child(m.id).set({ at: m.createdDateTime, n: files.length, files });
    }
    url = page["@odata.nextLink"] || "";
  }
  return { processed, uploaded, log, more };
}

// ---------- Meta ----------
async function fbGet(token, path, params = {}) {
  const u = new URL(GRAPH + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set("access_token", token);
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Meta " + path + " " + (j.error ? j.error.message : r.status));
  return j;
}
async function fbPost(token, path, fields, file) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, typeof v === "string" ? v : JSON.stringify(v)); });
  fd.append("access_token", token);
  if (file) fd.append("source", new Blob([file.buf], { type: file.mime || "image/jpeg" }), file.name || "image.jpg");
  const r = await fetch(GRAPH + path, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Meta " + path + " " + (j.error ? j.error.message : r.status));
  return j;
}
async function fbDelete(token, id) {
  const r = await fetch(GRAPH + "/" + id + "?access_token=" + encodeURIComponent(token), { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Meta delete " + (j.error ? j.error.message : r.status));
  return j;
}

// ---------- Anthropic ----------
async function claude(cfg, system, user) {
  if (!cfg.anthropicKey) throw new Error("尚未設定 Claude API Key");
  const r = await fetch(ANTHROPIC, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": cfg.anthropicKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: cfg.claudeModel || "claude-sonnet-4-6", max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Claude " + r.status + " " + JSON.stringify(j).slice(0, 200));
  return (j.content || []).map((c) => c.text || "").join("");
}


// ===== 本週行銷建議（天氣 + 節慶 + 活動 + 排程） =====
const TW_HOLIDAYS = {
  "2026-10-25": "光復節（補假 10/26）", "2026-10-26": "光復節補假", "2026-10-31": "萬聖節", "2026-11-11": "雙11", "2026-11-12": "國父誕辰", "2026-11-26": "感恩節（美式）", "2026-11-27": "黑色星期五",
  "2026-12-12": "雙12", "2026-12-24": "平安夜", "2026-12-25": "聖誕節（行憲紀念日放假）", "2026-12-31": "跨年",
  "2027-01-01": "元旦", "2027-02-05": "除夕", "2027-02-06": "春節初一", "2027-02-07": "初二", "2027-02-08": "初三", "2027-02-09": "初四", "2027-02-10": "初五", "2027-02-14": "情人節", "2027-02-22": "元宵節", "2027-02-28": "和平紀念日",
  "2027-03-08": "婦女節／38女王節", "2027-04-04": "兒童節", "2027-04-05": "清明節", "2027-05-01": "勞動節", "2027-05-09": "母親節", "2027-06-09": "端午節", "2027-08-08": "父親節", "2027-08-14": "七夕", "2027-09-15": "中秋節", "2027-10-10": "國慶日",
};
function weekHolidays(dates) {
  return dates.map((d) => {
    const dt = new Date(d + "T00:00:00+08:00"), dow = dt.getUTCDay();
    const name = TW_HOLIDAYS[d];
    return name ? `${d.slice(5)} ${name}` : null;
  }).filter(Boolean);
}
async function weatherFor(dates) {
  const spots = [["台北", 25.04, 121.56], ["台中", 24.15, 120.67], ["高雄", 22.63, 120.30]];
  const out = [];
  for (const [n, la, lo] of spots) {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}`;
      const r = await fetch(u); const j = await r.json();
      const d = j.daily || {};
      out.push(n + "：" + (d.time || []).map((t, i) => `${t.slice(5)} ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C 雨${d.precipitation_probability_max[i]}%`).join("、"));
    } catch (e) { out.push(n + "：天氣讀取失敗"); }
  }
  return out;
}

const TYPE_LABEL = { new_preview: "新品預告", new_dm: "新品上架", promo_dm: "活動DM", weekly: "當周活動", hero: "主推商品", staff: "店員實穿", store: "門市陳列", reels_item: "單品影片", reels_brand: "形象影片", new: "新品上架", restock: "補貨", promo: "活動優惠", outfit: "穿搭", link: "活動連結" };

const BRAND_RULES = `【品牌】VV DOUBLE 台灣大尺碼女裝。slogan「大尺碼不是特例，而是我的日常」。核心：棉花糖女孩穿得好看是日常，衣服配合人，不是人配合衣服。

【鐵律：絕不販賣身材焦慮】
禁用：顯胖、遮肉、藏肉、修飾缺點、穿不下、不敢穿、被說、肉肉的困擾；「顯瘦」不能當主賣點或第一行，放在詳述裡提一次可以；順身、修身、合身這類詞可以用。
不用缺乏感、自卑感當 hook，不先戳痛點再給解法；一律從正面感受出發：舒服、好看、合身、想天天穿。

【鐵律：只說自己，不比較】
不提競品、不用對比或貶低拉抬自己，不寫「不是放大版」這類句子；只對 VV DOUBLE 做肯定句。

【鐵律：文案內不寫價格】
不寫售價、折後價、NT$ 任何金額；價格讓客人到商品頁看。活動機制（幾折、滿額折多少）可以寫，單品價格不行。

【鐵律：不做負面行銷、不做飢餓行銷】
不寫「再不買就沒了」「最後 N 件」「錯過等明年」「手慢無」這種製造焦慮的句子。
只有特賣會／大折數活動可以寫倒數與現貨提醒，而且要寫成明確資訊（活動到幾號、售完不補），不是催促。

【寫法】
生動輕快活潑，像懂穿搭的姐妹在講話；精準、有 hook、有內容。每句都要有畫面或資訊，沒有的就刪。
不鋪陳、不解釋、不總結、不客套、不落落長。
禁止：破折號（— 或 ——）、「寶寶們」「姐妹們」開頭、驚嘆號連發、「點擊連結」「快來看看」「不容錯過」「無論…還是…」「不只是…更是…」這類制式句、任何讀起來像 AI 的套話。
emoji 可以用：一行最多 1 個，整則 3～5 個，放行首或行尾，增加親切感。
句子短，一句一行；行內用空格代替逗號，行尾幾乎不加標點。`;

// 編排邏輯（獨立於品牌鐵律，設定頁改鐵律不會蓋掉）
const LAYOUT_RULES = `【編排邏輯：hook → 設計重點 → 連結 → 詳述 → 商品資訊 → 單品連結】
手機 3 行後會折疊成「查看更多」，前 3 行要把重點和連結放完。固定結構如下，行數和順序不能變：
第 1 行：hook。用問句或情境開頭 再接一句解答（例：Y字尷尬不知道怎麼穿? 穿對一件就好看🌿）
第 2 行：設計重點＋帶來的感覺（例：假兩件裙擺設計 層次感直接給你）
第 3 行：「{前綴} {連結名稱}→ {網址}」，連結名稱與網址用我提供的「第 3 行連結」，一字不改；前綴照我指定的用，沒指定就不加
空一行
詳述 3 行，每行 18 字內：尺寸一句（用尺寸範圍，例「2L-5L 都有」；商品資料有寫體重範圍才可寫體重，不自己推算）、版型或設計一句、布料一句
空一行
商品全名（原樣不改字 含色名）
model 行：「model {名字} {身高}/{體重} 穿 {尺寸}」一位一行（商品資料有附才寫）
「單品連結→ {單品網址}」
hashtag：只有我說「要 hashtag」才在最後加一行：#VVDOUBLE #大尺碼不是特例 #肉肉女孩 再加 2 個跟商品有關的；沒說就完全不要出現 #
活動清單（✐ 開頭的行）由工具另外帶入，你不要寫。
多款商品：每款各一組「商品全名／model／單品連結→」，中間空一行。

【取向：依貼文類型】
新品介紹：hook 用當週主題的氣氛；第 2 行講這檔新品的共同感覺；詳述改成材質／版型／怎麼搭各一行。
主打商品：第 1 行就要讓人想看這件；第 2 行設計重點；詳述照固定三句。
行銷大活動：有趣味的口吻；第 1 行用【　】框活動名 第 2 行講活動最大的好處或期間；詳述換成活動機制 2～3 行，每行一個重點。
門市陳列／影片：像在聊天，一句畫面感開場、一句真實感受；中段 2～3 行講怎麼搭、穿起來的感覺。有給「門市資訊」時，商品資訊那段改放門市資訊（兩行，一字不改，ꔛ 符號保留）。有給「STAFF's PICK 清單」時，在門市資訊前放一段：「♡ 陳列單品」一行，接著清單每行加條列符號（商品名 網址 一行一款，不改字）；沒清單但有商品資料才用商品全名＋單品連結。
門市店員實穿（貼文類型是「店員實穿」時用這個固定結構，取代上面的通用結構）：
整篇不空行，每行都緊接著上一行（分隔只用「-」那一行）：
第 1 行：#門市店員實穿 ♡ {門市名}
第 2 行：「{一個符號}{第 3 行連結的名稱}➤{網址}」，例：✱NEW新品➤https://bit.ly/xxx（用我提供的第 3 行連結，名稱可加「新品」這類兩字修飾，網址一字不改）
第 3～5 行：各以 ⛧ 開頭，每行一句來門市試穿的好處，用問句或對話感（例：版型適不適合？穿上鏡子一照就知道！／不用盲買 面料親膚度 彈性現場親手感受／不知道怎麼搭配？來門市讓我們幫妳量身打造OOTD！），要換句不要照抄範例
一行「-」
♡ STAFF's PICK
每款商品一行：「{條列符號}商品名{箭頭符號} 單品網址」（商品名不含色名、不含《獨家自訂》這類前綴；箭頭符號用清單裡給的，沒有就用 ➨）；多款就接著列。有給「STAFF's PICK 清單」就照清單每行加上條列符號，不用商品資料、不改字
一行「-」
♡ STAFF Body Shape - {STAFF Body Shape}（沒給就省略這行）
接著直接放門市資訊兩行（有給才放，不空行）
這個結構裡不要 hook、不要 hashtag（第 1 行的 #門市店員實穿 是固定的，不算）、不要任何空行。`;

function orientName(type) {
  if (/^new_|^new$|restock/.test(type)) return "新品介紹";
  if (/promo|weekly|link/.test(type)) return "行銷大活動";
  if (/staff/.test(type)) return "店員實穿（用「門市店員實穿」固定結構）";
  if (/store|reels|outfit/.test(type)) return "門市陳列／影片";
  return "主打商品";
}
function copySystem(cfg, type) {
  return `你是 VV DOUBLE 的 Facebook 粉專小編。以下規則全部要遵守，沒有例外。

${String(cfg.brandRules || BRAND_RULES).replace(/【編排邏輯[\s\S]*$/, "").trim()}

${LAYOUT_RULES}

這一篇的取向：${orientName(type)}
${cfg.copyRules ? "額外規則：" + cfg.copyRules : ""}
輸出：恰好 3 個版本，第 1 版最精簡、第 3 版最有故事感，用「===」分隔，不加編號、不加標題、不加任何說明。`;
}

// ---------- 主程式 ----------
exports.fbpost = onRequest(
  { region: "asia-east1", memory: "1GiB", timeoutSeconds: 300, cors: false, secrets: [SHOPLINE_TOKEN] },
  async (req, res) => {
    cors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const body = req.body || {};
    const action = body.action;
    if (action === "version") return res.json({ version: VERSION, sha: "__GIT_SHA__" });

    const cfg = await loadConfig();
    const pw = req.get("X-Tool-Password") || "";

    // 第一次使用：還沒有密碼時，setup 會把這次的密碼存起來
    if (action === "setup" && !cfg.password) {
      if (!pw || pw.length < 4) return res.status(400).json({ error: "密碼至少 4 碼" });
      await cfgRef().update({ password: pw, createdAt: Date.now() });
      return res.json({ ok: true, first: true });
    }
    const sk = req.get("X-Sync-Key") || "";
    const viaSync = action === "teamsSync" && cfg.syncKey && sk === cfg.syncKey;
    if (!viaSync && (!cfg.password || pw !== cfg.password)) return res.status(401).json({ error: cfg.password ? "密碼錯誤" : "尚未設定密碼" });

    try {
      switch (action) {
        case "status": {
          return res.json({
            version: VERSION,
            meta: !!(cfg.metaToken && cfg.pageId),
            pageId: cfg.pageId || "",
            pageName: cfg.pageName || "",
            metaExpires: cfg.metaExpires === undefined ? null : cfg.metaExpires,
            dropbox: !!cfg.dropboxRefresh,
            dropboxAppKey: cfg.dropboxAppKey || "",
            dropboxRoot: cfg.dropboxRoot || "",
            teamsRoot: teamsRoot(cfg), ms: !!(cfg.msTenant && cfg.msClientId && cfg.msSecret), msTenant: cfg.msTenant || "", msClientId: cfg.msClientId || "", teamsTeam: cfg.teamsTeam || "", teamsChanDisplay: cfg.teamsChanDisplay || "", teamsChanStaff: cfg.teamsChanStaff || "", teamsFolder: cfg.teamsFolder || "", teamsSince: cfg.teamsSince || "", teamsLast: cfg.teamsLast || null,
            shopline: !!cfg.shoplineToken,
            claude: !!cfg.anthropicKey,
            claudeModel: cfg.claudeModel || "",
            copyRules: cfg.copyRules || "",
            brandRules: cfg.brandRules || "",
            brandRulesDefault: BRAND_RULES,
            catLinks: cfg.catLinks || "view all pants|https://www.vvdouble.com/categories/view-all-bottom\nview all tops|https://www.vvdouble.com/categories/view-all-top\nNew|https://www.vvdouble.com/categories/newin",
            utmSource: cfg.utmSource || "fb",
            utmMedium: cfg.utmMedium || "ad",
            dropboxStaff: cfg.dropboxStaff || "",
            reurl: !!(cfg.bitlyToken || cfg.reurlKey), shortener: cfg.bitlyToken ? "bitly" : cfg.reurlKey ? "reurl" : "",
            scheduleSheet: cfg.scheduleSheet || "1vrsXPERq4ppkHmlhdwU3IHKc6WZrgN9Kc8H97mvVQAs",
            scheduleYear: Number(cfg.scheduleYear) || 2026,
            serviceEmail: await serviceEmail(),
            templates: cfg.templates || null,
          });
        }

        case "setup": {
          // 只更新有送來的欄位；空字串代表不改
          const allow = ["pageId", "metaToken", "dropboxAppKey", "dropboxRoot", "dropboxStaff", "reurlKey", "bitlyToken", "msTenant", "msClientId", "msSecret", "teamsTeam", "teamsChanDisplay", "teamsChanStaff", "teamsFolder", "teamsSince", "syncKey", "scheduleSheet", "scheduleYear", "shoplineToken", "anthropicKey", "claudeModel", "copyRules", "brandRules", "catLinks", "utmSource", "utmMedium", "newPassword"];
          const upd = {};
          for (const k of allow) {
            if (typeof body[k] === "string" && body[k].trim() !== "") upd[k === "newPassword" ? "password" : k] = body[k].trim();
          }
          if (body.clearDropbox) upd.dropboxRefresh = null;
          if (body.templates && typeof body.templates === "object") upd.templates = body.templates;
          upd.updatedAt = Date.now();
          await cfgRef().update(upd);
          return res.json({ ok: true });
        }

        case "metaExchange": {
          // 短期用戶 Token → 長期用戶 Token → 永久粉專 Token（全程後端，不回傳 token）
          const { appId, appSecret, userToken, pageId } = body;
          if (!appId || !appSecret || !userToken) return res.status(400).json({ error: "App ID、App 密鑰、短期 Token 都要填" });
          const ex = await (await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userToken)}`)).json();
          if (!ex.access_token) return res.status(400).json({ error: "換長期 Token 失敗：" + JSON.stringify(ex).slice(0, 200) });
          const acc = await fbGet(ex.access_token, "/me/accounts", { fields: "id,name,access_token,tasks", limit: 50 });
          const pages = (acc.data || []).map((p) => ({ id: p.id, name: p.name, tasks: p.tasks || [] }));
          const want = pageId || cfg.pageId || "";
          const pick = (acc.data || []).find((p) => p.id === want) || (acc.data || []).find((p) => /^VV Double$/i.test(p.name));
          if (!pick) return res.json({ ok: false, pages, error: "找不到指定粉專，請選一個" });
          const info = await fbGet(pick.access_token, "/debug_token", { input_token: pick.access_token, access_token: `${appId}|${appSecret}` }).catch(() => null);
          await cfgRef().update({ metaToken: pick.access_token, pageId: pick.id, pageName: pick.name, metaAppId: String(appId), metaTokenAt: Date.now(), metaExpires: info && info.data ? (info.data.expires_at || 0) : null });
          return res.json({ ok: true, page: { id: pick.id, name: pick.name }, expires: info && info.data ? info.data.expires_at : null, pages });
        }

        case "metaCheck": {
          if (!cfg.metaToken || !cfg.pageId) return res.json({ ok: false, error: "尚未設定 Meta" });
          const j = await fbGet(cfg.metaToken, "/" + cfg.pageId, { fields: "id,name,fan_count" });
          return res.json({ ok: true, page: j });
        }

        // ----- Dropbox OAuth（PKCE，前端產 verifier，這裡換 refresh token）-----
        case "dropboxExchange": {
          const { code, verifier, redirect } = body;
          if (!cfg.dropboxAppKey) return res.status(400).json({ error: "先填 Dropbox App Key" });
          const form = new URLSearchParams({ code, grant_type: "authorization_code", client_id: cfg.dropboxAppKey, code_verifier: verifier, redirect_uri: redirect });
          const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body: form });
          const j = await r.json();
          if (!j.refresh_token) return res.status(400).json({ error: "Dropbox 授權失敗", detail: j });
          await cfgRef().update({ dropboxRefresh: j.refresh_token, dropboxAccount: j.account_id || "" });
          dbxCache.token = ""; dbxCache.exp = 0; dbxRootNs = "";
          return res.json({ ok: true });
        }

        case "dropboxList": {
          const path = (body.path !== undefined ? body.path : (cfg.dropboxRoot || "")) || "";
          let j = await dbxRpc(cfg, "/files/list_folder", { path, limit: 2000, include_non_downloadable_files: false });
          let entries = j.entries || [];
          while (j.has_more) { j = await dbxRpc(cfg, "/files/list_folder/continue", { cursor: j.cursor }); entries = entries.concat(j.entries || []); }
          const folders = entries.filter((e) => e[".tag"] === "folder").map((e) => ({ name: e.name, path: e.path_lower }));
          const files = entries.filter((e) => e[".tag"] === "file" && IMG_RE.test(e.name)).map((e) => ({ name: e.name, path: e.path_lower, size: e.size }));
          folders.sort((a, b) => b.name.localeCompare(a.name, "zh-Hant"));
          files.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }));
          return res.json({ path, folders, files, pathRoot: await dbxPathRoot(cfg) });
        }

        case "dropboxFind": {
          // 依商品名找 Dropbox 資料夾：不靠搜尋，直接走 根目錄 → 日期資料夾 → 分類 → 「OK <商品名>」；分色款再進顏色子資料夾
          const title = String(body.title || "").trim();
          const code = String(body.sku || "").trim().toUpperCase().slice(0, 8);
          if (!title && !code) return res.status(400).json({ error: "缺少商品名" });
          const m = title.match(/^(.*?)(?:-([^-]{1,6}))?$/);
          const base = (m && m[1] || title).trim(), color = (m && m[2] || "").trim();
          const norm = (s) => String(s || "").replace(/^ok\s*/i, "").replace(/_[0-9A-Z]{6,10}$/i, "").replace(/[\s　《》〈〉「」『』【】()（）]/g, "").toLowerCase();
          const codeOf = (s) => { const mm = String(s || "").match(/_([0-9A-Z]{6,10})$/i); return mm ? mm[1].toUpperCase() : ""; };
          const nb = norm(base);
          const listFolders = async (path) => {
            let j = await dbxRpc(cfg, "/files/list_folder", { path, limit: 2000 });
            let e = j.entries || [];
            while (j.has_more) { j = await dbxRpc(cfg, "/files/list_folder/continue", { cursor: j.cursor }); e = e.concat(j.entries || []); }
            return e.filter((x) => x[".tag"] === "folder");
          };
          const root = cfg.dropboxRoot || "";
          const isDate = (n) => /^\d{3,4}/.test(n);
          const isCat = (n) => /分類/.test(n);
          // 1) 決定要掃的「日期資料夾」清單
          let dateDirs = [];
          const rootFolders = await listFolders(root);
          const yearNow = String(new Date().getFullYear());
          const isCamp = (n) => /^\d{4}[a-z]*$/i.test(n);
          if (rootFolders.some((x) => isCat(x.name))) dateDirs = [{ name: root.split("/").pop(), path_lower: root, key: "9999" }];
          else dateDirs = rootFolders.filter((x) => isCamp(x.name)).map((x) => Object.assign({ key: yearNow + x.name.slice(0, 4) }, x));
          // 官網部門底下：直接的日期資料夾（如 1020）＋ 年份資料夾（如 2026）裡的日期資料夾（如 0825），依新到舊
          const di = root.indexOf("/官網部門");
          if (di >= 0) {
            const dept = root.slice(0, di + 5);
            try {
              const top = await listFolders(dept);
              for (const x of top) {
                if (dateDirs.some((d) => d.path_lower === x.path_lower)) continue;
                if (/^20\d{2}$/.test(x.name)) { try { (await listFolders(x.path_lower)).filter((y) => isCamp(y.name)).forEach((y) => dateDirs.push(Object.assign({ key: x.name + y.name.slice(0, 4) }, y))); } catch (e) {} }
                else if (isCamp(x.name)) dateDirs.push(Object.assign({ key: yearNow + x.name.slice(0, 4) }, x));
              }
            } catch (e) {}
          }
          dateDirs = dateDirs.filter((d, i, a) => a.findIndex((z) => z.path_lower === d.path_lower) === i).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 8);
          if (!dateDirs.length) dateDirs = rootFolders.slice(0, 6);
          // 2) 每個日期資料夾 → 分類層（沒有就用日期資料夾本身）→ 收集商品資料夾
          const scanned = [], all = [];
          for (const d of dateDirs) {
            const subs = await listFolders(d.path_lower);
            const cats = subs.filter((x) => isCat(x.name));
            const targets = cats.length ? cats : [d];
            for (const t of targets) {
              scanned.push(t.path_lower);
              const items = t === d ? subs : await listFolders(t.path_lower);
              items.forEach((x) => all.push(x));
              // 分類層底下若還有一層子分類（例如 上衣／褲子），再往下一層
              for (const x of items) { if (!/^ok/i.test(x.name) && !norm(x.name).includes(nb)) { try { const deeper = await listFolders(x.path_lower); deeper.forEach((y) => all.push(y)); } catch (e) {} } }
            }
          }
          const byCode = code ? all.filter((h) => codeOf(h.name) === code) : [];
          const exact = all.filter((h) => norm(h.name) === nb || norm(h.name) === norm(title));
          const partial = all.filter((h) => norm(h.name).includes(nb) || (nb.length >= 6 && nb.includes(norm(h.name)) && norm(h.name).length >= 6));
          const cand = (byCode.length ? byCode : exact.length ? exact : partial).sort((a, b) => b.path_lower.localeCompare(a.path_lower));
          if (!cand.length) return res.json({ found: false, scanned, total: all.length });
          const matchedBy = byCode.length ? "code" : exact.length ? "name" : "partial";
          let path = cand[0].path_lower, pickedColor = "";
          try {
            const sub = await dbxRpc(cfg, "/files/list_folder", { path, limit: 200 });
            const folders = (sub.entries || []).filter((e) => e[".tag"] === "folder");
            const files = (sub.entries || []).filter((e) => e[".tag"] === "file" && IMG_RE.test(e.name));
            if (color) { const c = folders.find((e) => norm(e.name).includes(norm(color))); if (c) { path = c.path_lower; pickedColor = c.name; } }
            if (!pickedColor && !files.length && folders.length === 1 && !/^(gif|長條圖)$/i.test(folders[0].name)) { path = folders[0].path_lower; pickedColor = folders[0].name; }
          } catch (e) {}
          return res.json({ found: true, matchedBy, path, folder: cand[0].name, color: pickedColor, others: cand.slice(1, 5).map((c) => ({ name: c.name, path: c.path_lower })) });
        }

        case "renameScan":
        case "renameRun": {
          // 舊資料夾補貨號：OK 品名 → OK 品名_貨號（貨號查 Shopline，取組頭前 8 碼）
          if (!cfg.shoplineToken) return res.status(400).json({ error: "尚未設定 Shopline Token" });
          const norm = (s) => String(s || "").replace(/^ok\s*/i, "").replace(/_[0-9A-Z]{6,10}$/i, "").replace(/[\s　《》〈〉「」『』【】()（）]/g, "").toLowerCase();
          const hasCode = (s) => /_[0-9A-Z]{6,10}$/i.test(String(s || ""));
          const listFolders = async (path) => {
            let j = await dbxRpc(cfg, "/files/list_folder", { path, limit: 2000 });
            let e = j.entries || [];
            while (j.has_more) { j = await dbxRpc(cfg, "/files/list_folder/continue", { cursor: j.cursor }); e = e.concat(j.entries || []); }
            return e.filter((x) => x[".tag"] === "folder");
          };
          const root = cfg.dropboxRoot || "";
          const rootFolders = await listFolders(root);
          let dateDirs = rootFolders.some((x) => /分類/.test(x.name)) ? [{ name: root.split("/").pop(), path_lower: root }] : rootFolders.filter((x) => /^\d{3,4}/.test(x.name));
          if (body.dates && body.dates.length) dateDirs = dateDirs.filter((d) => body.dates.includes(d.name));
          const targets = [];
          for (const d of dateDirs) {
            const subs = await listFolders(d.path_lower);
            const cats = subs.filter((x) => /分類/.test(x.name));
            const pools = cats.length ? cats : [d];
            for (const t of pools) {
              const items = t === d ? subs : await listFolders(t.path_lower);
              for (const x of items) {
                if (/^(gif|長條圖)$/i.test(x.name)) continue;
                if (/^ok/i.test(x.name) || x.name.includes("》") || x.name.length >= 8) targets.push(x);
                else { try { (await listFolders(x.path_lower)).forEach((y) => targets.push(y)); } catch (e) {} }
              }
            }
          }
          const plan = [];
          for (const t of targets) {
            if (hasCode(t.name)) { plan.push({ path: t.path_lower, name: t.name, status: "skip", note: "已有貨號" }); continue; }
            const q = t.name.replace(/^ok\s*/i, "").trim();
            let sku = "", match = "";
            try {
              const r = await slFetch(cfg.shoplineToken, `/products/search?query=${encodeURIComponent(q.replace(/[《》]/g, " ").slice(0, 60))}&per_page=10&fields[]=items.id&fields[]=items.title_translations&fields[]=items.variations&fields[]=items.sku`);
              const items = (r.body && r.body.items) || [];
              const same = items.filter((it) => norm(((it.title_translations || {})["zh-hant"] || "").replace(/-[^-]{1,6}$/, "")) === norm(q));
              const pick = (same.length ? same : items.filter((it) => norm((it.title_translations || {})["zh-hant"] || "").includes(norm(q))))[0];
              if (pick) { sku = ((((pick.variations || [])[0] || {}).sku) || pick.sku || "").toUpperCase().slice(0, 8); match = (pick.title_translations || {})["zh-hant"] || ""; }
            } catch (e) {}
            if (!/^[0-9A-Z]{6,10}$/.test(sku)) { plan.push({ path: t.path_lower, name: t.name, status: "nomatch", note: "Shopline 找不到" }); continue; }
            const newName = t.name.replace(/\s+$/, "") + "_" + sku;
            plan.push({ path: t.path_lower, name: t.name, newName, sku, match, status: "rename" });
          }
          if (action === "renameScan") return res.json({ plan, total: plan.length, rename: plan.filter((p) => p.status === "rename").length, nomatch: plan.filter((p) => p.status === "nomatch").length, skip: plan.filter((p) => p.status === "skip").length });
          // 執行
          const done = [], failed = [];
          for (const p of plan.filter((x) => x.status === "rename")) {
            const to = p.path.replace(/\/[^\/]+$/, "/") + p.newName;
            try {
              await dbxRpc(cfg, "/files/move_v2", { from_path: p.path, to_path: to, autorename: false });
              await db().ref("/fbpost/renames").push({ from: p.path, to, at: Date.now(), by: body.by || "" });
              done.push({ from: p.name, to: p.newName });
            } catch (e) { failed.push({ name: p.name, error: String(e.message).slice(0, 120) }); }
          }
          return res.json({ done, failed, nomatch: plan.filter((p) => p.status === "nomatch").map((p) => p.name) });
        }

        case "dropboxThumbs": {
          const paths = (body.paths || []).slice(0, 25);
          const j = await dbxRpc(cfg, "/files/get_thumbnail_batch", {
            entries: paths.map((p) => ({ path: p, format: "jpeg", size: "w256h256", mode: "bestfit" })),
          });
          const out = {};
          (j.entries || []).forEach((e, i) => { if (e[".tag"] === "success") out[paths[i]] = "data:image/jpeg;base64," + e.thumbnail; });
          return res.json({ thumbs: out });
        }

        case "dropboxFile": {
          // 原圖 base64（前端用 canvas 依貼文類型裁切縮放後再回傳發布）
          const buf = await dbxContent(cfg, "/files/download", { path: body.path });
          const ext = (body.path.match(/\.(\w+)$/) || [])[1] || "jpg";
          const mime = ext.toLowerCase() === "png" ? "image/png" : ext.toLowerCase() === "webp" ? "image/webp" : "image/jpeg";
          return res.json({ b64: buf.toString("base64"), mime });
        }

        // ----- Shopline -----
        case "shoplineSearch": {
          if (!cfg.shoplineToken) return res.status(400).json({ error: "尚未設定 Shopline Token" });
          let q = String(body.query || "").trim();
          const fields = "&fields[]=items.id&fields[]=items.title_translations&fields[]=items.status&fields[]=items.medias&fields[]=items.detail_medias&fields[]=items.variations&fields[]=items.price&fields[]=items.price_sale&fields[]=items.sku&fields[]=items.description_translations";
          let items = [];
          // 商品網址：/products/{id 或 handle}
          if (/^https?:\/\//.test(q)) {
            const handle = decodeURIComponent((q.split("?")[0].split("/products/")[1] || "").replace(/\/$/, ""));
            if (/^[0-9a-f]{24}$/i.test(handle)) { const r = await slFetch(cfg.shoplineToken, `/products/${handle}?${fields.slice(1)}`); if (r.body && r.body.id) return res.json({ items: [slProduct(r.body)] }); }
            q = handle.split("-")[0] || handle;
            if (!q) return res.json({ items: [] });
          }
          // 貨號前綴（例如 26AU06）：用 sku 搜尋 + 標題搜尋都試
          const r1 = await slFetch(cfg.shoplineToken, `/products/search?query=${encodeURIComponent(q)}&per_page=40${fields}`);
          items = (r1.body && r1.body.items) || [];
          if (/^[0-9A-Z]{4,}$/i.test(q)) {
            const r2 = await slFetch(cfg.shoplineToken, `/products?sku=${encodeURIComponent(q)}&per_page=40${fields}`);
            const more = (r2.body && r2.body.items) || [];
            const seen = new Set(items.map((i) => i.id));
            more.forEach((m) => { if (!seen.has(m.id)) items.push(m); });
          }
          const list = items.map(slProduct);
          if (/^[0-9A-Z]{4,}$/i.test(q)) {
            const pre = q.toUpperCase();
            list.sort((a, b) => (b.sku.toUpperCase().startsWith(pre) ? 1 : 0) - (a.sku.toUpperCase().startsWith(pre) ? 1 : 0));
          }
          return res.json({ items: list });
        }

        case "resolvePicks": {
          // STAFF's PICK：每行一個網址或品名 → 商品全名（含色名）＋單品短網址
          if (!cfg.shoplineToken) return res.status(400).json({ error: "尚未設定 Shopline Token" });
          const fields = "&fields[]=items.id&fields[]=items.title_translations&fields[]=items.variations&fields[]=items.status";
          const lines = String(body.text || "").split(/\n|,|，/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
          const out = [];
          for (const line of lines) {
            let items = [], handle = "", color = "";
            try {
              if (/^https?:\/\//.test(line)) {
                handle = decodeURIComponent((line.split("?")[0].split("/products/")[1] || "").replace(/\/$/, ""));
                if (/^[0-9a-f]{24}$/i.test(handle)) { const r = await slFetch(cfg.shoplineToken, `/products/${handle}?${fields.slice(1)}`); if (r.body && r.body.id) items = [r.body]; }
                else {
                  const H = handle.toUpperCase(), pre = H.split("-")[0];
                  const matchV = (it) => (it.variations || []).find((v) => String(v.sku || "").toUpperCase().startsWith(H));
                  let pool = [];
                  for (const q of [`/products?sku=${encodeURIComponent(pre)}&per_page=50${fields}`, `/products/search?query=${encodeURIComponent(pre)}&per_page=50${fields}`, `/products/search?query=${encodeURIComponent(H)}&per_page=20${fields}`]) {
                    const r = await slFetch(cfg.shoplineToken, q); pool = pool.concat((r.body && r.body.items) || []);
                    const hit = pool.find(matchV); if (hit) { items = [hit]; const v = matchV(hit); color = (((v.fields_translations || [])[0] || {})["zh-hant"] || ((v.fields || [])[0] && (v.fields[0]["zh-hant"] || v.fields[0].name)) || ""); break; }
                  }
                  if (!items.length) { const hit2 = pool.find((it) => (it.variations || []).some((v) => String(v.sku || "").toUpperCase().startsWith(pre))); if (hit2) items = [hit2]; }
                }
              } else {
                const r = await slFetch(cfg.shoplineToken, `/products/search?query=${encodeURIComponent(line)}&per_page=5${fields}`); items = (r.body && r.body.items) || [];
                const m = line.match(/-([^-]{1,6})$/); if (m) color = m[1];
              }
            } catch (e) {}
            const it = items[0];
            if (!it) { out.push({ input: line, ok: false }); continue; }
            const title = ((it.title_translations || {})["zh-hant"] || "").trim();
            const url = "https://www.vvdouble.com/products/" + it.id;
            let short = url; try { short = await shorten(cfg, url + "?" + (body.utm || "")); } catch (e) { try { short = await shorten(cfg, url); } catch (e2) {} }
            out.push({ input: line, ok: true, title: title.replace(/^[《〈【][^》〉】]*[》〉】]/, "").replace(/-[^-]{1,6}$/, "").trim(), url: short });
          }
          return res.json({ picks: out });
        }

        case "copyEdit": {
          // 照文案裡（ ）內的註記修改：只改註記處，其餘一字不動
          const { text = "", type = "hero", activities = [], products = [], catLinks = [], storeInfo = "", picks = "" } = body;
          const info = [
            activities.length ? "活動連結：\n" + activities.map((a) => `${a.name}→ ${a.url}`).join("\n") : "",
            catLinks.length ? "分類連結：\n" + catLinks.map((c) => `${c.name}→ ${c.url}`).join("\n") : "",
            products.length ? "商品資料：\n" + products.map((p) => `【${p.title}】單品網址：${p.link}${p.sizes && p.sizes.length ? "　尺寸：" + p.sizes.join(" / ") : ""}${p.material ? "　材質：" + p.material : ""}${(p.models || []).length ? "　model：" + p.models.map((x) => `${x.name} ${String(x.height || "").replace(/\D/g, "")}/${String(x.weight || "").replace(/\D/g, "")} 穿 ${x.size}`).join("；") : ""}\n${p.description || ""}`).join("\n\n") : "",
            storeInfo ? "門市資訊：\n" + storeInfo : "",
            picks ? "STAFF's PICK 清單：\n" + picks : "",
          ].filter(Boolean).join("\n\n");
          const system = copySystem(cfg, type) + `\n\n【這次的任務：照註記修改】
使用者給你一篇文案，裡面有用全形或半形括號寫的「指示」，例如（兩行敘述）、(連結)、（改口語一點）、（補 model 資訊）。
規則：
1. 只處理括號指示所在的位置，把指示換成對應內容；其他文字一字不動（符號、空行、順序都保留）。
2. （連結）要用我提供的連結清單對應：那一行寫的是哪個活動／分類／商品，就用它的網址；對不到就留「(連結)」不要亂編。
3. （N 行敘述）就寫 N 行，每行 18 字內，內容依這篇的取向和上下文。
4. 不是指示的括號（例如商品名裡的括號、(統一時代百貨)）不要動。
5. 只輸出修改後的整篇文案，不加說明、不加「===」、不加任何標題。`;
          const out = await claude(cfg, system, `文案：\n${text}\n\n可用資料：\n${info || "（無）"}`);
          return res.json({ text: out.replace(/^===+\n?|\n?===+$/g, "").trim() });
        }

        // ----- 文案 -----
        case "copy": {
          const { products = [], type = "new", extra = "", catLinks = [], model = "", line3 = null, prefix = "", hashtags = false, storeInfo = "", storeName = "", bodyShape = "", picks = "" } = body;
          // 裝飾符號每篇輪換，避免每篇長一樣
          const pick = (a) => a[Math.floor(Math.random() * a.length)];
          const pfx = prefix === "random" ? pick(["𖤘𖤘", "✧✧", "❥❥", "⟡⟡", "✦✦", "☾☾", "❀❀", "✿✿", "✩✩", "➤➤", "»»", "✎✎", "❁❁", "⋆⋆"]) : prefix;
          const SYM = { bullet: pick(["⛧", "✦", "❀", "✿", "⟡", "✧", "❥", "☾", "✩", "⋆", "𖤐", "❁", "✤"]), heart: pick(["♡", "♥", "❣", "✿", "❀", "♪", "☆", "✧"]), wrap: pick(["ꔛ", "✦", "❁", "⋆", "✿", "❀", "ꕤ", "⟡", "✧"]), dash: pick(["-", "–", "・・・", "｡･ﾟ･", "⋯⋯"]) };
          const num = (v) => String(v || "").replace(/[^\d.]/g, "");
          const desc = products.map((p) => {
            const ms = (p.models || []).map((x) => `model ${x.name} ${num(x.height)}/${num(x.weight)} 穿 ${x.size}`).join("；");
            return `【${p.title}】${p.colors && p.colors.length ? "顏色：" + p.colors.join("/") : ""}${p.sizes && p.sizes.length ? "　尺寸：" + p.sizes.join(" / ") : ""}${p.material ? "　材質：" + p.material : ""}\n商品網址：${p.link || p.url || ""}\n${ms ? "MODEL 資訊：" + ms + "\n" : ""}${(p.description || "").slice(0, 600)}`;
          }).join("\n\n");
          const cats = catLinks.map((c) => `${c.name}→ ${c.url}`).join("\n");
          const l3 = line3 && line3.url ? `第 3 行連結：${line3.name}→ ${line3.url}` : `第 3 行連結：從分類連結挑一個\n分類連結：\n${cats || "（無）"}`;
          const user = `貼文類型：${TYPE_LABEL[type] || type}\n${extra ? "這次要強調：" + extra + "\n" : ""}${model ? "MODEL 資訊：" + model + "\n" : ""}${l3}\n第 3 行前綴：${pfx || "不加"}\n${hashtags ? "要 hashtag" : "不要 hashtag"}\n${storeInfo ? "門市資訊（原樣照抄，但把 ꔛ 換成這篇的框符號 " + SYM.wrap + "）：\n" + storeInfo + "\n" : ""}這篇用的符號：條列符號「${SYM.bullet}」、心／標題符號「${SYM.heart}」、分隔線「${SYM.dash}」；規則裡寫的 ⛧ ♡ ꔛ - 一律換成這組，3 個版本可以各自再換成別的裝飾符號，不要三版都一樣。\n${storeName ? "門市名：" + storeName + "\n" : ""}${bodyShape ? "STAFF Body Shape：" + bodyShape + "\n" : ""}${picks ? "STAFF's PICK 清單（原樣照抄 不改字 順序不變）：\n" + picks + "\n" : ""}\n商品資料：\n${desc || "（無商品資料，請依貼文類型與強調重點撰寫）"}`;
          const text = await claude(cfg, copySystem(cfg, type), user);
          let variants = text.split(/\n?===+\n?/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
          if (/staff/.test(type)) variants = variants.map((v) => v.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim()).join("\n"));
          return res.json({ variants });
        }


        case "teamsCheck": {
          const r = await msFindTeamChannels(cfg);
          const root = teamsRoot(cfg);
          let rootOk = "", sub = [];
          try { const j = await dbxRpc(cfg, "/files/list_folder", { path: root, recursive: true, limit: 500 }); sub = (j.entries || []).map((e) => e.path_display); rootOk = "存在，" + sub.length + " 個項目"; } catch (e) { rootOk = /not_found/.test(e.message) ? "不存在（會自動建立）" : e.message.slice(0, 120); }
          const dd = await db().ref("/fbpost/teams/done").get(); const dv = dd.exists() ? dd.val() : {};
          const doneN = { display: Object.keys(dv.display || {}).length, staff: Object.keys(dv.staff || {}).length };
          return res.json({ team: r.team.displayName, display: r.display ? r.display.displayName : null, staff: r.staff ? r.staff.displayName : null, channels: r.channels, root, rootOk, sub: sub.slice(0, 40), doneN });
        }
        case "syncKeyNew": {
          const key = require("crypto").randomBytes(24).toString("hex");
          await cfgRef().update({ syncKey: key });
          return res.json({ key });
        }
        case "uploadImage": {
          // 本機圖片 → Dropbox 門市素材/上傳/YYYY-MM/，之後當一般 Dropbox 圖用（草稿可還原）
          const name = String(body.name || "upload.jpg").replace(/[\\/:*?"<>|]/g, "_");
          const buf = Buffer.from(String(body.b64 || ""), "base64");
          if (!buf.length) return res.status(400).json({ error: "沒有檔案" });
          const folder = teamsRoot(cfg) + "/上傳/" + (String(body.ym || "").match(/^\d{4}-\d{2}$/) ? body.ym : new Date().toISOString().slice(0, 7));
          await dbxEnsureFolder(cfg, folder);
          const j = await dbxUpload(cfg, folder + "/" + name, buf);
          return res.json({ path: j.path_lower, name: j.name });
        }
        case "titlesList": {
          // 大標 PNG：官網部門/大標
          const root = cfg.dropboxRoot || ""; const i = root.indexOf("/官網部門");
          const path = (i >= 0 ? root.slice(0, i + 5) : root) + "/大標";
          let files = [];
          try { const j = await dbxRpc(cfg, "/files/list_folder", { path, limit: 500 }); files = (j.entries || []).filter((e) => e[".tag"] === "file" && /\.png$/i.test(e.name)).map((e) => ({ name: e.name.replace(/\.png$/i, ""), path: e.path_lower })); } catch (e) { if (!/not_found/.test(e.message)) throw e; try { await dbxRpc(cfg, "/files/create_folder_v2", { path, autorename: false }); } catch (e2) {} }
          return res.json({ path, files });
        }
        case "teamsReset": {
          await db().ref("/fbpost/teams/done").remove();
          return res.json({ ok: true });
        }
        case "teamsUsers": {
          const u = await msGet(cfg, "/users?$select=displayName,officeLocation,department,jobTitle,mail&$top=200");
          const users = (u.value || []).map((x) => ({ name: x.displayName, loc: x.officeLocation || "", dept: x.department || "", title: x.jobTitle || "", mail: x.mail || "", store: storeShort(x.officeLocation) || storeShort(x.department) || storeShort(x.jobTitle) }));
          return res.json({ users });
        }
        case "teamsSync": {
          const r = await msFindTeamChannels(cfg);
          const since = (body.since || cfg.teamsSince || "2026-09-01") + "T00:00:00Z";
          const limit = Number(body.limit) || 40, dry = !!body.dry, out = {}, deadline = Date.now() + (dry ? 240 : 150) * 1000;
          if (r.display && body.kind !== "staff") out.display = await teamsSyncChannel(cfg, r.team, r.display, "display", since, limit, dry, deadline);
          if (r.staff && body.kind !== "display" && !(out.display && out.display.more)) out.staff = await teamsSyncChannel(cfg, r.team, r.staff, "staff", since, limit, dry, deadline);
          out.more = !!((out.display && out.display.more) || (out.staff && out.staff.more));
          if (!dry) await cfgRef().update({ teamsLast: { at: Date.now(), display: out.display ? out.display.uploaded : 0, staff: out.staff ? out.staff.uploaded : 0 } });
          return res.json(out);
        }
        case "labelCopy": {
          // 首圖圖文：依版型各欄位角色，用商品資料填短句（JSON）
          const { product = {}, slots = [], tplName = "" } = body;
          if (!slots.length) return res.json({ texts: {} });
          const p = product;
          const info = `【${p.title || ""}】${p.colors && p.colors.length ? "顏色：" + p.colors.join("/") : ""}${p.sizes && p.sizes.length ? "　尺寸：" + p.sizes.join(" / ") : ""}${p.material ? "　材質：" + p.material : ""}\n${(p.description || "").slice(0, 800)}`;
          const list = slots.map((s) => `- ${s.id}（${s.role}）：${s.hint}；最多 ${s.max} 字`).join("\n");
          const system = (cfg.brandRules || BRAND_RULES) + `\n\n【任務】這是放在商品首圖上的短文字（圖文版型「${tplName}」），不是貼文內文。\n每個欄位只寫一句、不加句尾標點、不用 emoji、不寫價格、不寫顯瘦遮肉類字眼、字數嚴格遵守上限。\n只輸出 JSON 物件，key 是欄位 id，value 是文字，不要任何其他文字或程式碼框。`;
          const text = await claude(cfg, system, `商品資料：\n${info}\n\n要填的欄位：\n${list}`);
          let texts = {};
          try { texts = JSON.parse(text.replace(/^[^{]*/, "").replace(/[^}]*$/, "")); } catch (e) { return res.status(500).json({ error: "AI 回傳格式錯誤", raw: text.slice(0, 200) }); }
          return res.json({ texts });
        }

        // ----- 週曆 -----
        case "week": {
          const dates = (body.dates || []).slice(0, 14);
          const out = {};
          for (const d of dates) { const s = await db().ref("/fbpost/slots/" + d).get(); out[d] = s.exists() ? s.val() : {}; }
          const wt = await db().ref("/fbpost/weekType/" + (dates[0] || "")).get();
          return res.json({ slots: out, weekType: wt.exists() ? wt.val() : "" });
        }
        case "weekTips": {
          const dates = (body.dates || []).slice(0, 7);
          if (dates.length !== 7) return res.status(400).json({ error: "dates" });
          const key = "/fbpost/tips/" + dates[0];
          if (!body.force) { const c = await db().ref(key).get(); if (c.exists()) return res.json(Object.assign({ cached: true }, c.val())); }
          const weather = await weatherFor(dates);
          const hol = weekHolidays(dates);
          const acts = (body.acts || []).map((a) => `${a.name}（${a.start}～${a.end}）${a.mech || ""}`);
          const plan = (body.plan || []).map((x) => `${x.date.slice(5)} ${x.slot}：${TYPE_LABEL[x.type] || x.type}${x.status ? "（" + x.status + "）" : ""}`);
          const sys = `你是 VV DOUBLE（台灣大尺碼女裝，7 間門市＋官網）的行銷企劃。根據本週天氣、節慶、活動與貼文排程，給粉專小編 4～6 條「可以直接執行」的建議。
規則：每條一句話、具體（要推什麼品類／用什麼切角／哪一天發）、不要客套、不要解釋原理、不要重複排程裡已有的內容。溫度：≤20°C 強推外套/針織/長袖，20–25°C 薄外套/疊穿，≥28°C 透氣涼感；雨天推門市取貨/宅配免運與穿搭影片。
只輸出 JSON：{"summary":"一句話本週重點","tips":["…","…"]}`;
          const user = `本週 ${dates[0]}～${dates[6]}
天氣：
${weather.join("\n")}
節慶／假日：${hol.length ? hol.join("、") : "無"}
進行中活動：${acts.length ? "\n" + acts.join("\n") : "無"}
已排貼文：${plan.length ? "\n" + plan.join("\n") : "尚未排"}`;
          const txt = await claude(cfg, sys, user);
          let j = {}; try { j = JSON.parse((txt.match(/\{[\s\S]*\}/) || ["{}"])[0]); } catch (e) { j = { summary: "", tips: txt.split("\n").filter(Boolean) }; }
          const outp = { summary: j.summary || "", tips: Array.isArray(j.tips) ? j.tips.slice(0, 8) : [], weather, holidays: hol, at: Date.now() };
          await db().ref(key).set(outp);
          return res.json(outp);
        }
        case "saveSlot": {
          const { date, slot, data } = body;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{4}$/.test(slot || "")) return res.status(400).json({ error: "日期或時段格式錯誤" });
          if (data === null) { await db().ref(`/fbpost/slots/${date}/${slot}`).remove(); return res.json({ ok: true }); }
          const clean = Object.assign({}, data, { updatedAt: Date.now() });
          await db().ref(`/fbpost/slots/${date}/${slot}`).update(clean);
          return res.json({ ok: true });
        }
        case "setWeekType": {
          await db().ref("/fbpost/weekType/" + body.monday).set(body.weekType || "");
          return res.json({ ok: true });
        }

        // ----- 行銷排程／活動明細 -----
        case "activities": {
          const sheet = cfg.scheduleSheet || "1vrsXPERq4ppkHmlhdwU3IHKc6WZrgN9Kc8H97mvVQAs";
          const year = Number(cfg.scheduleYear) || 2026;
          const rows = await sheetsGet(sheet, "活動明細!A1:Z200");
          const head = rows.find((r) => r.includes("活動／新品名稱")) || [];
          const hi = rows.indexOf(head);
          const col = (name) => head.findIndex((h) => String(h).replace(/\s/g, "").includes(name));
          const ci = { name: col("名稱"), start: col("開始"), end: col("結束"), mech: col("優惠機制"), type: col("類型"), url: head.findIndex((h) => /網址|URL|url|連結/.test(String(h))), note: col("注意") };
          const items = [];
          rows.slice(hi + 1).forEach((r, i) => {
            const name = r[ci.name]; if (!name) return;
            const start = parseMD(r[ci.start], year); if (!start) return;
            const end = parseMD(r[ci.end], year) || addDays(start, 30);
            items.push({ row: hi + 2 + i, name: String(name).trim(), type: r[ci.type] || "", start, end, mech: r[ci.mech] || "", note: r[ci.note] || "", url: ((ci.url >= 0 && r[ci.url]) || r.find((v) => /^https?:\/\//.test(String(v || "").trim())) || "").toString().trim(), startRaw: r[ci.start] || "", endRaw: r[ci.end] || "" });
          });
          // 新品上架日期（行銷排程的「新品時程」列）
          let newDates = [];
          try {
            const sch = await sheetsGet(sheet, "行銷排程!A1:ZZ6");
            const dateRow = sch.find((r) => r[0] === "日期") || [];
            const npRow = sch.find((r) => r[0] === "新品時程") || [];
            npRow.forEach((v, i) => { if (/上架/.test(String(v || ""))) { const d = parseMD(dateRow[i], year); if (d) newDates.push({ date: d, label: String(v).replace(/\s+/g, " ") }); } });
          } catch (e) { console.warn("schedule read", e.message); }
          return res.json({ items, newDates });
        }

        case "shorten": {
          const url = String(body.url || "").trim();
          if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: "網址格式錯誤" });
          const short = await shorten(cfg, url);
          return res.json({ short });
        }

        // ----- 發布 -----
        case "publish": {
          if (!cfg.metaToken || !cfg.pageId) return res.status(400).json({ error: "尚未設定 Meta" });
          const { message = "", images = [], link = "", scheduledAt = 0, meta = {} } = body;
          if (!message.trim() && !images.length) return res.status(400).json({ error: "沒有內容" });
          const token = cfg.metaToken, page = cfg.pageId;
          const isScheduled = scheduledAt && scheduledAt > Date.now() + 10 * 60000;
          const schedule = isScheduled ? { published: "false", scheduled_publish_time: String(Math.floor(scheduledAt / 1000)) } : {};
          // 同一格重新排程：先把舊的「已排程」貼文從粉專刪掉，避免同時段出現兩篇
          let replaced = null;
          if (meta.date && meta.slot) {
            const old = await db().ref(`/fbpost/slots/${meta.date}/${meta.slot}`).get();
            const ov = old.exists() ? old.val() : {};
            if (ov.postId && ov.status === "scheduled") {
              try { await fbDelete(token, ov.postId); } catch (e) { if (!/does not exist|Unsupported/.test(e.message)) throw new Error("刪除舊排程失敗：" + e.message); }
              if (ov.recId) await db().ref("/fbpost/posts/" + ov.recId).update({ status: "deleted", deletedAt: Date.now(), replacedBy: "reschedule" });
              replaced = ov.postId;
            }
          }
          let postId, photoIds = [];
          if (images.length === 1) {
            const img = images[0];
            const j = await fbPost(token, `/${page}/photos`, { message, ...schedule }, { buf: Buffer.from(img.b64, "base64"), mime: img.mime, name: img.name });
            postId = j.post_id || j.id; photoIds = [j.id];
          } else if (images.length > 1) {
            for (const img of images) {
              const j = await fbPost(token, `/${page}/photos`, { published: "false", temporary: "true" }, { buf: Buffer.from(img.b64, "base64"), mime: img.mime, name: img.name });
              photoIds.push(j.id);
            }
            const j = await fbPost(token, `/${page}/feed`, { message, ...schedule, attached_media: photoIds.map((id) => ({ media_fbid: id })) });
            postId = j.id;
          } else {
            const j = await fbPost(token, `/${page}/feed`, { message, link: link || undefined, ...schedule });
            postId = j.id;
          }
          const rec = {
            postId, photoIds, message, link, type: meta.type || "", skus: meta.skus || [], titles: meta.titles || [],
            utm: meta.utm || "", imageCount: images.length, by: meta.by || "",
            scheduledAt: isScheduled ? scheduledAt : 0, status: isScheduled ? "scheduled" : "published", createdAt: Date.now(),
          };
          const ref = await db().ref("/fbpost/posts").push(rec);
          if (meta.date && meta.slot) await db().ref(`/fbpost/slots/${meta.date}/${meta.slot}`).update({ status: isScheduled ? "scheduled" : "published", postId, recId: ref.key, updatedAt: Date.now() });
          return res.json({ ok: true, postId, id: ref.key, scheduled: !!isScheduled, replaced });
        }

        case "limitTest": {
          // 測多圖上限：上傳 N 張暫存小圖→建「未發布」貼文→刪除。只回報結果，不會出現在粉專。
          if (!cfg.metaToken || !cfg.pageId) return res.status(400).json({ error: "尚未設定 Meta" });
          const token = cfg.metaToken, page = cfg.pageId;
          const tries = Array.isArray(body.tries) && body.tries.length ? body.tries.map(Number) : [30, 20, 15, 11, 10];
          const maxN = Math.max(...tries);
          const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
          const ids = [];
          for (let i = 0; i < maxN; i++) {
            const j = await fbPost(token, `/${page}/photos`, { published: "false", temporary: "true" }, { buf: png, mime: "image/png", name: `t${i}.png` });
            ids.push(j.id);
          }
          const results = [];
          for (const n of tries) {
            try {
              const j = await fbPost(token, `/${page}/feed`, { message: `limit test ${n}`, published: "false", attached_media: ids.slice(0, n).map((id) => ({ media_fbid: id })) });
              results.push({ n, ok: true });
              try { await fbDelete(token, j.id); } catch (e) { results[results.length - 1].deleteError = e.message; }
            } catch (e) { results.push({ n, ok: false, error: e.message }); }
          }
          return res.json({ uploaded: ids.length, results });
        }

        case "deletePost": {
          const { id, postId } = body;
          if (postId) { try { await fbDelete(cfg.metaToken, postId); } catch (e) { if (!/does not exist|Unsupported/.test(e.message)) throw e; } }
          if (id) await db().ref("/fbpost/posts/" + id).update({ status: "deleted", deletedAt: Date.now() });
          if (body.date && body.slot) await db().ref(`/fbpost/slots/${body.date}/${body.slot}`).update({ status: "draft", postId: null, recId: null });
          return res.json({ ok: true });
        }

        case "listPosts": {
          const snap = await db().ref("/fbpost/posts").limitToLast(Number(body.n) || 100).get();
          const out = [];
          snap.forEach((c) => { out.push({ id: c.key, ...c.val() }); });
          out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return res.json({ posts: out });
        }

        case "utmPreview": {
          return res.json({ campaign: utmCampaign(Number(body.ts) || Date.now()) });
        }

        // ----- 成效 -----
        case "insights": {
          if (!cfg.metaToken || !cfg.pageId) return res.status(400).json({ error: "尚未設定 Meta" });
          const since = Math.floor((Date.now() - (Number(body.days) || 30) * 86400000) / 1000);
          const metrics = "post_impressions_unique,post_clicks,post_engaged_users,post_reactions_like_total";
          let j;
          try {
            j = await fbGet(cfg.metaToken, `/${cfg.pageId}/published_posts`, {
              since, limit: 100,
              fields: `id,message,created_time,permalink_url,full_picture,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0),insights.metric(${metrics})`,
            });
          } catch (e) {
            // 部分指標可能已被 Meta 停用：退回不帶 insights
            j = await fbGet(cfg.metaToken, `/${cfg.pageId}/published_posts`, {
              since, limit: 100, fields: "id,message,created_time,permalink_url,full_picture,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)",
            });
            j.insightsError = e.message;
          }
          const mine = {};
          const snap = await db().ref("/fbpost/posts").get();
          if (snap.exists()) snap.forEach((c) => { const v = c.val(); if (v.postId) mine[v.postId] = { type: v.type, skus: v.skus, utm: v.utm }; });
          const posts = (j.data || []).map((p) => {
            const ins = {};
            ((p.insights && p.insights.data) || []).forEach((m) => { ins[m.name] = (m.values && m.values[0] && m.values[0].value) || 0; });
            return {
              id: p.id, message: (p.message || "").slice(0, 120), created: p.created_time, url: p.permalink_url, picture: p.full_picture || "",
              reach: ins.post_impressions_unique || 0, clicks: ins.post_clicks || 0, engaged: ins.post_engaged_users || 0,
              reactions: (p.reactions && p.reactions.summary && p.reactions.summary.total_count) || 0,
              comments: (p.comments && p.comments.summary && p.comments.summary.total_count) || 0,
              shares: (p.shares && p.shares.count) || 0,
              mine: mine[p.id] || null,
            };
          });
          await db().ref("/fbpost/insightsCache").set({ at: Date.now(), posts });
          return res.json({ posts, insightsError: j.insightsError || "" });
        }

        default:
          return res.status(400).json({ error: "未知動作 " + action });
      }
    } catch (e) {
      console.error(action, e);
      return res.status(500).json({ error: String(e.message || e).slice(0, 500) });
    }
  }
);
