export default async function handler(req, res) {
  const { symbol, interval = "5min", outputsize = "100" } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "symbol query param is required" });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "server is missing TWELVE_DATA_API_KEY" });
  }

  const url = "https://api.twelvedata.com/time_series?symbol=" + encodeURIComponent(symbol) + "&interval=" + interval + "&outputsize=" + outputsize + "&apikey=" + apiKey;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();

    if (data.status === "error") {
      return res.status(502).json({ error: data.message || "upstream error" });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
