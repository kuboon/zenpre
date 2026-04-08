import { Hono } from "@hono/hono";

const subscribers = new Map<
  string,
  Set<ReadableStreamDefaultController<Uint8Array>>
>();
const encoder = new TextEncoder();

function getSubscribers(
  id: string,
): Set<ReadableStreamDefaultController<Uint8Array>> {
  if (!subscribers.has(id)) {
    subscribers.set(id, new Set());
  }
  return subscribers.get(id)!;
}

function broadcast(id: string, data: string): void {
  const subs = subscribers.get(id);
  if (!subs) return;
  const msg = encoder.encode(`data: ${data}\n\n`);
  for (const controller of subs) {
    try {
      controller.enqueue(msg);
    } catch {
      subs.delete(controller);
    }
  }
}

export const relayApp = new Hono()
  .get("/:id", (c) => {
    const { id } = c.req.param();
    const subs = getSubscribers(id);

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        subs.add(controller);
        controller.enqueue(encoder.encode(": connected\n\n"));
        c.req.raw.signal.addEventListener("abort", () => {
          subs.delete(controller);
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  })
  .post("/:id", async (c) => {
    const { id } = c.req.param();
    const data = await c.req.text();
    broadcast(id, data);
    return c.json({ ok: true });
  });
