import { getInstrumentProfile } from "../_market.js";

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  try {
    const data = await getInstrumentProfile(
      context.params.code,
      requestUrl.searchParams.get("kind") || "",
      requestUrl.searchParams.get("date") || "",
      requestUrl.searchParams.get("time") || ""
    );
    return json(data);
  } catch (error) {
    return json({ error: error.message || "Instrument data unavailable" }, 502);
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
