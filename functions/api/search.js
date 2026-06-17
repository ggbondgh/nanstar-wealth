import { searchInstruments } from "./_market.js";

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  try {
    const data = await searchInstruments(requestUrl.searchParams.get("q") || "");
    return json(data);
  } catch (error) {
    return json({ error: error.message || "Search unavailable" }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
