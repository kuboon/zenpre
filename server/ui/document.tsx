/**
 * Document — 永続 HTML シェル(ヘッダ + `<Frame name="content">`)。
 *
 * クライアント側では `run()`(client/mod.ts からバンドルされる /mod.js)が
 * `<a rmx-target="content">` のクリックをフレーム差し替えに変換する。
 */

import { Frame, type Handle } from "@remix-run/ui";
import { routes } from "../routes.ts";

type DocumentProps = {
  initialSrc: string;
};

export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ZenPre</title>
        <link rel="icon" href="data:image/png;base64,iVBORw0KGgo=" />
        <script async type="module" src="/mod.js"></script>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body class="min-h-screen bg-base-100 text-base-content">
        <header class="navbar bg-base-200 shadow-sm">
          <div class="navbar-start">
            <a
              class="btn btn-ghost text-xl"
              href={routes.home.href()}
              rmx-target="content"
            >
              ZenPre
            </a>
          </div>
          <nav class="navbar-end">
            <a
              class="btn btn-ghost btn-sm"
              href="https://github.com/kuboon/zenpre"
            >
              GitHub
            </a>
          </nav>
        </header>
        <Frame
          name="content"
          src={handle.props.initialSrc}
          fallback={
            <main class="mx-auto w-full max-w-3xl p-8">
              <p>Loading…</p>
            </main>
          }
        />
      </body>
    </html>
  );
}
