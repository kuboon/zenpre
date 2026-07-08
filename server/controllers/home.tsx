/**
 * GET / — トップページ。
 *
 * 直接のブラウザロードではシェル(ヘッダ + content フレーム)を返し、
 * フレームリクエスト(`rmx-frame: 1`)では下のランディング fragment を返す。
 */

import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import { renderPage } from "../utils/render.tsx";

export const homeAction = {
  handler(context) {
    return renderPage(
      context,
      <main class="mx-auto w-full max-w-3xl p-8 space-y-6">
        <div class="hero bg-base-200 rounded-box">
          <div class="hero-content text-center">
            <div>
              <h1 class="text-3xl font-bold">ZenPre</h1>
              <p class="py-4">
                <code>---</code>{" "}
                区切りの markdown をそのままプレゼンにする、AI
                時代のプレゼンツール。
              </p>
            </div>
          </div>
        </div>

        <div class="card card-border bg-base-100">
          <div class="card-body">
            <h2 class="card-title">できること(予定)</h2>
            <ul class="list-disc pl-6 space-y-1">
              <li>
                スマホ縦持ちフル画面ネイティブ。左右でページ、上下でスクロール
              </li>
              <li>
                presenter の focus / audience の reaction・post・vote
                をリアルタイム同期
              </li>
              <li>プレゼンの記録と再生(timeline)</li>
              <li>remote MCP からスライド作成・イベント作成</li>
            </ul>
            <p class="text-sm opacity-70">
              実装計画は{" "}
              <a
                class="link"
                href="https://github.com/kuboon/zenpre/blob/main/IMPLEMENTATION.md"
              >
                IMPLEMENTATION.md
              </a>{" "}
              を参照。
            </p>
          </div>
        </div>
      </main>,
    );
  },
} satisfies Action<typeof routes.home>;
