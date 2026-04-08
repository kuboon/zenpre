import { Hono } from "@hono/hono";
import { ActionSchema } from "#/schemas.ts";
import { sValidator } from "@hono/standard-validator";

export const relayApp = new Hono()
  .get("/:onAirId", (c) => {
    const { onAirId } = c.req.param();
    const channel = new BroadcastChannel(`relay:${onAirId}`);

    const body = new ReadableStream({
      start(controller) {
        channel.onmessage = (event: MessageEvent) => {
          try {
            const data = `data: ${JSON.stringify(event.data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          } catch {
            // Stream was closed; cancel() will handle channel cleanup
          }
        };
        channel.onmessageerror = () => {
          channel.close();
          controller.close();
        };
      },
      cancel() {
        channel.close();
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
  .post("/:onAirId", sValidator("json", ActionSchema), (c) => {
    const { onAirId } = c.req.param();
    const action = c.req.valid("json");
    const channel = new BroadcastChannel(`relay:${onAirId}`);
    channel.postMessage(action);
    channel.close();
    return c.body(null, 204);
  });
