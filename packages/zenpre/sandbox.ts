/**
 * 信頼できない author HTML(`zen-html` スライド)を安全に描画するための
 * サンドボックス生成ユーティリティ。
 *
 * HTML は `sandbox="allow-scripts"` の `<iframe srcdoc>`(same-origin 無し =
 * 不透明オリジン)に隔離し、`<head>` 先頭の CSP メタで**すべての通信を遮断**する。
 * JS/CSS アニメーションはローカルで動くが、fetch/XHR/WebSocket/beacon・リモート
 * img/font/css は一切出せない。iframe は別ブラウジングコンテキストなので、
 * 自分の枠外へオーバーレイして本体 UI やアドレスバーを偽装することもできない。
 *
 * DOM 非依存(server SSR / client / render パイプラインで共用)。
 *
 * @module
 */

/** HTML の特殊文字をエスケープする(属性値・テキスト共用)。 */
export const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]!),
  );

/**
 * サンドボックス内 CSP。すべての通信を遮断しつつ、inline の JS/CSS と
 * `data:`/`blob:` の画像・メディア・フォントだけを許可する。
 *
 * 注意: `<meta>` 配信の CSP は `sandbox`/`frame-ancestors` を無視する。
 * それらは iframe の `sandbox` 属性側で担保する(役割分担)。
 */
export const SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "object-src 'none'",
].join("; ");

/** サンドボックス内の最小リセット CSS。 */
export const SANDBOX_RESET =
  "html,body{margin:0;padding:0;height:100%}*{box-sizing:border-box}";

/**
 * author HTML を、全通信を遮断したサンドボックス `<iframe>` 要素の文字列にする。
 * 返り値はそのままページ HTML に埋め込める(SSR / client 共通)。
 */
export function sandboxedHtmlFrame(html: string): string {
  const doc = `<!doctype html><html><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style>${SANDBOX_RESET}</style>` +
    `</head><body>${html}</body></html>`;
  // srcdoc は属性値なので全体を 1 回エスケープする。ブラウザが属性値を
  // エンティティ復号してから document として解釈するので、CSP の
  // シングルクォート等も author markup もそのまま生きる。
  return `<iframe class="zen-html-frame" sandbox="allow-scripts" ` +
    `referrerpolicy="no-referrer" loading="lazy" ` +
    `srcdoc="${escapeHtml(doc)}"></iframe>`;
}
