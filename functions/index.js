// VV DOUBLE · FB 貼文工具 · Cloud Function 中間站
// 網頁 → 這裡（各家 Token 存在 Realtime Database /fbpost/config，前端讀不到）→ Meta / Dropbox / Shopline / Anthropic
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");

admin.initializeApp();

const VERSION = "2026-10-25d";
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
  return s.exists() ? s.val() : {};
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
  if (!cfg.reurlKey) throw new Error("尚未設定 reurl API Key");
  const key = Buffer.from(url).toString("base64url").slice(0, 120);
  const ref = db().ref("/fbpost/short/" + key);
  const s = await ref.get();
  if (s.exists() && s.val().short) return s.val().short;
  const r = await fetch("https://api.reurl.cc/shorten", { method: "POST", headers: { "Content-Type": "application/json", "reurl-api-key": cfg.reurlKey }, body: JSON.stringify({ url }) });
  const j = await r.json().catch(() => ({}));
  if (!j.short_url) throw new Error("reurl 失敗：" + JSON.stringify(j).slice(0, 160));
  await ref.set({ url, short: j.short_url, at: Date.now() });
  return j.short_url;
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
    description: stripHtml((it.description_translations || {})["zh-hant"] || ""),
    colors: [...new Set(v.map((x) => ((x.fields_translations || [])[0] || {})["zh-hant"] || (x.fields || [])[0] && (x.fields[0]["zh-hant"] || x.fields[0].name) || "").filter(Boolean))],
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
async function dbxRpc(cfg, path, json) {
  const tok = await dbxToken(cfg);
  const r = await fetch(DBX_API + path, { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(json) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Dropbox " + path + " " + r.status + " " + JSON.stringify(j).slice(0, 200));
  return j;
}
async function dbxContent(cfg, path, arg) {
  const tok = await dbxToken(cfg);
  const r = await fetch(DBX_CONTENT + path, { method: "POST", headers: { Authorization: "Bearer " + tok, "Dropbox-API-Arg": JSON.stringify(arg) } });
  if (!r.ok) throw new Error("Dropbox " + path + " " + r.status + " " + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;

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

const TYPE_LABEL = { new: "新品上架", restock: "補貨到貨", promo: "活動優惠", outfit: "穿搭靈感", staff: "門市店員實穿分享（用店員真實上身的角度寫，提到身形或尺寸怎麼挑）", link: "活動連結" };

function copySystem(cfg) {
  return `你是台灣大尺碼女裝品牌 VV DOUBLE 的 Facebook 粉專小編。
品牌 slogan：「大尺碼不是特例，而是我的日常」。核心精神：棉花糖女孩也有美麗的權利，肉肉女孩穿得好看是日常不是例外。
尺寸：SM / ML / XL2L / 3L4L / 5L6L。價格帶 NT$490–1,380。
語氣：像懂穿搭的姐妹在講話，溫暖、具體、有畫面感；描述版型怎麼修飾、怎麼搭，不空喊口號、不用「寶寶們」「姐妹們」這種開頭、不用驚嘆號連發、不用 emoji 刷版（最多 2 個）、不寫「點擊連結」這種制式語。
每則 120–220 字，繁體中文（台灣用語）。結尾固定帶 hashtag：#VVDOUBLE #大尺碼不是特例 #肉肉女孩，可再加 1–2 個跟商品有關的。
${cfg.copyRules ? "額外規則：" + cfg.copyRules : ""}
輸出格式：恰好 3 個版本，用「===」分隔，不加編號、不加標題、不加任何說明。`;
}

// ---------- 主程式 ----------
exports.fbpost = onRequest(
  { region: "asia-east1", memory: "1GiB", timeoutSeconds: 300, cors: false },
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
    if (!cfg.password || pw !== cfg.password) return res.status(401).json({ error: cfg.password ? "密碼錯誤" : "尚未設定密碼" });

    try {
      switch (action) {
        case "status": {
          return res.json({
            version: VERSION,
            meta: !!(cfg.metaToken && cfg.pageId),
            pageId: cfg.pageId || "",
            dropbox: !!cfg.dropboxRefresh,
            dropboxAppKey: cfg.dropboxAppKey || "",
            dropboxRoot: cfg.dropboxRoot || "",
            shopline: !!cfg.shoplineToken,
            claude: !!cfg.anthropicKey,
            claudeModel: cfg.claudeModel || "",
            copyRules: cfg.copyRules || "",
            utmSource: cfg.utmSource || "fb",
            utmMedium: cfg.utmMedium || "ad",
            dropboxStaff: cfg.dropboxStaff || "",
            reurl: !!cfg.reurlKey,
            scheduleSheet: cfg.scheduleSheet || "1vrsXPERq4ppkHmlhdwU3IHKc6WZrgN9Kc8H97mvVQAs",
            scheduleYear: Number(cfg.scheduleYear) || 2026,
            serviceEmail: await serviceEmail(),
            templates: cfg.templates || null,
          });
        }

        case "setup": {
          // 只更新有送來的欄位；空字串代表不改
          const allow = ["pageId", "metaToken", "dropboxAppKey", "dropboxRoot", "dropboxStaff", "reurlKey", "scheduleSheet", "scheduleYear", "shoplineToken", "anthropicKey", "claudeModel", "copyRules", "utmSource", "utmMedium", "newPassword"];
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
          dbxCache.token = ""; dbxCache.exp = 0;
          return res.json({ ok: true });
        }

        case "dropboxList": {
          const path = body.path || cfg.dropboxRoot || "";
          let j = await dbxRpc(cfg, "/files/list_folder", { path, limit: 2000, include_non_downloadable_files: false });
          let entries = j.entries || [];
          while (j.has_more) { j = await dbxRpc(cfg, "/files/list_folder/continue", { cursor: j.cursor }); entries = entries.concat(j.entries || []); }
          const folders = entries.filter((e) => e[".tag"] === "folder").map((e) => ({ name: e.name, path: e.path_lower }));
          const files = entries.filter((e) => e[".tag"] === "file" && IMG_RE.test(e.name)).map((e) => ({ name: e.name, path: e.path_lower, size: e.size }));
          folders.sort((a, b) => b.name.localeCompare(a.name, "zh-Hant"));
          files.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }));
          return res.json({ path, folders, files });
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
          const q = String(body.query || "").trim();
          const fields = "&fields[]=items.id&fields[]=items.title_translations&fields[]=items.status&fields[]=items.medias&fields[]=items.detail_medias&fields[]=items.variations&fields[]=items.price&fields[]=items.price_sale&fields[]=items.sku&fields[]=items.description_translations";
          let items = [];
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

        // ----- 文案 -----
        case "copy": {
          const { products = [], type = "new", extra = "", link = "" } = body;
          const desc = products.map((p) => `【${p.title}】售價 NT$${p.priceSale || p.price || "—"}${p.colors && p.colors.length ? "，顏色：" + p.colors.join("/") : ""}\n${(p.description || "").slice(0, 600)}`).join("\n\n");
          const user = `貼文類型：${TYPE_LABEL[type] || type}\n${extra ? "這次要強調：" + extra + "\n" : ""}${link ? "文末放這個連結（原樣貼上、單獨一行、放在 hashtag 之前）：" + link + "\n" : ""}\n商品資料：\n${desc || "（無商品資料，請依貼文類型與強調重點撰寫）"}`;
          const text = await claude(cfg, copySystem(cfg), user);
          const variants = text.split(/\n?===+\n?/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
          return res.json({ variants });
        }

        // ----- 週曆 -----
        case "week": {
          const dates = (body.dates || []).slice(0, 14);
          const out = {};
          for (const d of dates) { const s = await db().ref("/fbpost/slots/" + d).get(); out[d] = s.exists() ? s.val() : {}; }
          const wt = await db().ref("/fbpost/weekType/" + (dates[0] || "")).get();
          return res.json({ slots: out, weekType: wt.exists() ? wt.val() : "" });
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
            items.push({ row: hi + 2 + i, name: String(name).trim(), type: r[ci.type] || "", start, end, mech: r[ci.mech] || "", note: r[ci.note] || "", url: ci.url >= 0 ? (r[ci.url] || "") : "", startRaw: r[ci.start] || "", endRaw: r[ci.end] || "" });
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
          let postId, photoIds = [];
          if (images.length === 1) {
            const img = images[0];
            const j = await fbPost(token, `/${page}/photos`, { message, ...schedule }, { buf: Buffer.from(img.b64, "base64"), mime: img.mime, name: img.name });
            postId = j.post_id || j.id; photoIds = [j.id];
          } else if (images.length > 1) {
            for (const img of images.slice(0, 10)) {
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
          return res.json({ ok: true, postId, id: ref.key, scheduled: !!isScheduled });
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
