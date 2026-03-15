// Deploy this on https://workers.cloudflare.com (free plan)
// 1. Create a new Worker
// 2. Paste this code
// 3. Save & Deploy
// 4. Copy your worker URL (e.g. https://linkbridge.YOUR-NAME.workers.dev)
// 5. Put that URL in index.html as PROXY_URL

export default {
  async fetch(request) {
    // Allow CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);
    const musicUrl = url.searchParams.get("url");
    const country = url.searchParams.get("userCountry") || "DE";

    if (!musicUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=${country}`;

    try {
      const res = await fetch(apiUrl);
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
