/**
 * GET / — トップページ。
 *
 * ZenPre 自身の機能で作った紹介プレゼン(`./content/intro.ts`)を
 * 自動再生する。KV を使わず静的 markdown を {@link renderSlideDocument} で
 * SSR するだけなので、スライド未作成でも動く(dogfooding)。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import { renderSlideDocument } from "../ui/slide_document.ts";
import {
  INTRO_MARKDOWN,
  INTRO_THEME,
  INTRO_TIMELINE,
} from "../content/intro.ts";

export const homeAction = {
  async handler() {
    const doc = await renderSlideDocument({
      title: "ZenPre",
      markdown: INTRO_MARKDOWN,
      theme: INTRO_THEME,
      timeline: INTRO_TIMELINE,
      clientScript: "/home.js",
      cta: { href: "/new", label: "スライドを作る" },
      // ランディングだけ phone モックアップの中で再生して見せる。
      phoneMock: true,
    });
    return new Response(doc, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
} satisfies Action<typeof routes.home>;
