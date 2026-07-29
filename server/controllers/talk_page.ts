/**
 * Talk のページ:
 * - `GET /t/:talk_id`            — audience ビュー(focus 追従 + reaction 送信)
 * - `GET /t/:talk_id/present`    — presenter Controller(ページ送り = focus 配信)
 *
 * どちらも Talk にひも付いた Slide を SSR し、relay 用の設定(talk_id/role)を
 * 埋め込む。presenter の `event_key` は URL fragment(`#key=`)でクライアントが
 * 受け取るので、サーバには渡らない(ログに残さない)。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import type { Talks } from "../repo/talks.ts";
import type { Slides } from "../repo/slides.ts";
import { renderSlideDocument } from "../ui/slide_document.ts";

const notFound = (msg: string): Response =>
  new Response(msg, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

async function renderTalk(
  talks: Talks,
  slides: Slides,
  talkId: string,
  role: "audience" | "presenter",
  clientScript: string,
): Promise<Response> {
  const talk = await talks.get(talkId);
  if (!talk) return notFound("talk not found");
  if (!talk.slide_id) {
    return notFound("this talk has no slide bound");
  }
  const slide = await slides.get(talk.slide_id);
  if (!slide) return notFound("slide not found");

  const doc = await renderSlideDocument({
    title: slide.title,
    markdown: slide.markdown,
    css: slide.css,
    theme: slide.theme,
    clientScript,
    talk: { talk_id: talkId, role },
  });
  return new Response(doc, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function talkPageAction(talks: Talks, slides: Slides) {
  return {
    handler(context) {
      return renderTalk(
        talks,
        slides,
        context.params.talk_id,
        "audience",
        "/talk.js",
      );
    },
  } satisfies Action<typeof routes.talkPage>;
}

export function talkPresentAction(talks: Talks, slides: Slides) {
  return {
    handler(context) {
      return renderTalk(
        talks,
        slides,
        context.params.talk_id,
        "presenter",
        "/present.js",
      );
    },
  } satisfies Action<typeof routes.talkPresent>;
}

export function talkReplayAction(talks: Talks, slides: Slides) {
  return {
    handler(context) {
      // 再生ページ。relay には繋がず、timeline を fetch して自動操作する。
      return renderTalk(
        talks,
        slides,
        context.params.talk_id,
        "audience",
        "/replay.js",
      );
    },
  } satisfies Action<typeof routes.talkReplay>;
}
