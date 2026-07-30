/**
 * Talk の REST API。
 *
 * - `POST /api/talks`            — 作成。slide 紐付け時は `X-Slide-Key` が必要。
 *   `{ talk_id, event_key, moderator_key, audience_url, presenter_url,
 *   moderator_url }` を返す
 * - `GET  /api/talks/:talk_id`   — 取得(公開)。`{ talk_id, slide_id, begin_at, end_at }`
 *
 * 認可は capability key のみ、cookie 不使用のため CORS は全開放。
 */
import { type } from "arktype";
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../../routes.ts";
import type { Talks } from "../../repo/talks.ts";
import type { Slides } from "../../repo/slides.ts";

const CreateInput = type({
  "slide_id?": "string | null",
  "begin_at?": "string",
  "end_at?": "string | null",
});

const CORS = { "Access-Control-Allow-Origin": "*" };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS });
}
function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: CORS });
}

export function talksCreateAction(talks: Talks, slides: Slides) {
  return {
    async handler(context) {
      let body: unknown;
      try {
        body = await context.request.json();
      } catch {
        return fail(400, "invalid json");
      }
      const input = CreateInput(body);
      if (input instanceof type.errors) return fail(400, input.summary);

      // slide 紐付け時は所有権(X-Slide-Key)を確認する。
      if (input.slide_id) {
        const slide = await slides.get(input.slide_id);
        if (!slide) return fail(404, "slide not found");
        const key = context.request.headers.get("x-slide-key");
        if (!key) return fail(401, "missing X-Slide-Key");
        const check = await slides.update(input.slide_id, key, {});
        if (check === "forbidden") return fail(403, "forbidden");
        if (check === "not_found") return fail(404, "slide not found");
      }

      const { talk, event_key, moderator_key } = await talks.create(input);
      return json({
        talk_id: talk.talk_id,
        event_key,
        moderator_key,
        audience_url: `/t/${talk.talk_id}`,
        presenter_url: `/t/${talk.talk_id}/present#key=${event_key}`,
        moderator_url: `/t/${talk.talk_id}/moderate#key=${moderator_key}`,
      }, 201);
    },
  } satisfies Action<typeof routes.api.talksCreate>;
}

export function talkGetAction(talks: Talks) {
  return {
    async handler(context) {
      const talk = await talks.get(context.params.talk_id);
      if (!talk) return fail(404, "not found");
      return json({
        talk_id: talk.talk_id,
        slide_id: talk.slide_id,
        begin_at: talk.begin_at,
        end_at: talk.end_at,
      });
    },
  } satisfies Action<typeof routes.api.talkGet>;
}

export type { Action };
