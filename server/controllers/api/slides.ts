/**
 * Slide の REST API。
 *
 * - `POST  /api/slides`            — 作成(公開)。`{ slide_id, slide_key, preview_url }` を返す
 * - `GET   /api/slides/:slide_id`  — 取得(公開)。`{ slide_id, title, markdown, css, theme }`
 * - `PATCH /api/slides/:slide_id`  — 更新(`X-Slide-Key` 必須)
 *
 * 認可は capability key(`slide_key`)のみで、cookie を使わないため CORS は
 * 全開放してよい(§8/§12)。MCP tool(M5)はこの controller の薄い wrapper。
 */
import { type } from "arktype";
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../../routes.ts";
import type { Slides } from "../../repo/slides.ts";

const CreateInput = type({
  markdown: "string",
  "css?": "string",
  "theme?": "string",
});
const PatchInput = type({
  "markdown?": "string",
  "css?": "string",
  "theme?": "string",
});

const CORS = { "Access-Control-Allow-Origin": "*" };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS });
}
function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: CORS });
}

export function slidesCreateAction(slides: Slides) {
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
      const { slide, slide_key } = await slides.create(input);
      return json({
        slide_id: slide.slide_id,
        slide_key,
        preview_url: `/s/${slide.slide_id}`,
      }, 201);
    },
  } satisfies Action<typeof routes.api.slidesCreate>;
}

export function slideGetAction(slides: Slides) {
  return {
    async handler(context) {
      const slide = await slides.get(context.params.slide_id);
      if (!slide) return fail(404, "not found");
      return json({
        slide_id: slide.slide_id,
        title: slide.title,
        markdown: slide.markdown,
        css: slide.css,
        theme: slide.theme,
      });
    },
  } satisfies Action<typeof routes.api.slideGet>;
}

export function slideUpdateAction(slides: Slides) {
  return {
    async handler(context) {
      const key = context.request.headers.get("x-slide-key");
      if (!key) return fail(401, "missing X-Slide-Key");
      let body: unknown;
      try {
        body = await context.request.json();
      } catch {
        return fail(400, "invalid json");
      }
      const patch = PatchInput(body);
      if (patch instanceof type.errors) return fail(400, patch.summary);
      const result = await slides.update(context.params.slide_id, key, patch);
      if (result === "not_found") return fail(404, "not found");
      if (result === "forbidden") return fail(403, "forbidden");
      return json({ ok: true, preview_url: `/s/${result.slide_id}` });
    },
  } satisfies Action<typeof routes.api.slideUpdate>;
}
