/**
 * GET /AGENTS.md — スライドを作る AI 向けのガイド(リポジトリ直下の
 * `AGENTS.md`)を markdown のまま配信する。トップページの紹介デッキから
 * リンクされる。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";

const GUIDE_URL = new URL("../../AGENTS.md", import.meta.url);
let guide: Promise<string> | undefined;

export const agentsGuideAction = {
  async handler() {
    guide ??= Deno.readTextFile(GUIDE_URL);
    return new Response(await guide, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  },
} satisfies Action<typeof routes.agentsGuide>;
