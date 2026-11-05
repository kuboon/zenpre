/**
 * GET / — トップページ。
 *
 * ZenPre 自身の機能で作った紹介プレゼン(`./content/intro.ts`)を
 * phone モックアップの中で自動再生し、ランディングページ({@link landingShell})の
 * ヒーローに埋め込む。KV を使わず静的 markdown を {@link renderSlideDocument} で
 * SSR するだけなので、スライド未作成でも動く(dogfooding)。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import { renderSlideDocument } from "../ui/slide_document.ts";
import { landingShell } from "../ui/landing.ts";
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
      // ランディングだけ phone モックアップの中で再生し、ページの一部として見せる。
      phoneMock: true,
      shell: landingShell,
    });
    return new Response(doc, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
} satisfies Action<typeof routes.home>;
