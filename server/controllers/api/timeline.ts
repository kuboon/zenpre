/**
 * Timeline の REST API。
 *
 * - `PUT /api/talks/:talk_id/timeline` — chunk 追記(`X-Event-Key` 必須)。
 *   body は {@link TimelineEntry}[]。
 * - `GET /api/talks/:talk_id/timeline` — 全 chunk 結合(公開)。
 */
import { type } from "arktype";
import { TimelineEntrySchema } from "@kuboon/zenpre/schemas.ts";
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../../routes.ts";
import type { Talks } from "../../repo/talks.ts";
import type { Timelines } from "../../repo/timelines.ts";

const ChunkInput = TimelineEntrySchema.array();

const CORS = { "Access-Control-Allow-Origin": "*" };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS });
}
function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: CORS });
}

export function timelinePutAction(talks: Talks, timelines: Timelines) {
  return {
    async handler(context) {
      const talkId = context.params.talk_id;
      const talk = await talks.get(talkId);
      if (!talk) return fail(404, "talk not found");

      const key = context.request.headers.get("x-event-key");
      if (!key) return fail(401, "missing X-Event-Key");
      const role = await talks.roleOf(talkId, key);
      if (role !== "presenter") return fail(403, "forbidden");

      let body: unknown;
      try {
        body = await context.request.json();
      } catch {
        return fail(400, "invalid json");
      }
      const chunk = ChunkInput(body);
      if (chunk instanceof type.errors) return fail(400, chunk.summary);

      await timelines.append(talkId, chunk);
      return json({ ok: true, appended: chunk.length }, 201);
    },
  } satisfies Action<typeof routes.api.timelinePut>;
}

export function timelineGetAction(talks: Talks, timelines: Timelines) {
  return {
    async handler(context) {
      const talkId = context.params.talk_id;
      const talk = await talks.get(talkId);
      if (!talk) return fail(404, "talk not found");
      const entries = await timelines.all(talkId);
      return json({ talk_id: talkId, entries });
    },
  } satisfies Action<typeof routes.api.timelineGet>;
}
