// Função que monta a resposta no formato que a Moveo espera
export function liveInstructionsPayload(markdown: string) {
  return Response.json({
    context: {
      live_instructions: markdown
    }
  });
}

// (opcional) checagem de segurança com token
export function ensureAuthHeader(req: Request) {
  const required = process.env.WEBHOOK_TOKEN;
  if (!required) return; // se vc não quiser segurança ainda

  const got = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "");

  if (got !== required) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
