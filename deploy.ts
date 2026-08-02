Deno.env.set("SERVER_MODE", "public");
const { handler } = await import("./server.ts");

if (import.meta.main) {
  const port = Number(Deno.env.get("PORT") ?? "8000");
  const hostname = Deno.env.get("HOST") ?? "0.0.0.0";
  Deno.serve({ hostname, port }, handler);
}
