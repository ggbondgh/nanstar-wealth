export async function onRequestPost() {
  return json({
    error: "OCR import is reserved but not enabled",
    status: "placeholder",
    next: "Screenshots can later be uploaded here and converted into rows for the existing import preview."
  }, 501);
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
