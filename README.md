# ZenPre

`---` 区切りの markdown をそのままプレゼンにする、AI 時代のプレゼンツール。

- 要件: [PLAN.md](./PLAN.md)
- 実装計画: [IMPLEMENTATION.md](./IMPLEMENTATION.md)

## 構成

Deno workspace:

- [`packages/zenpre/`](./packages/zenpre/) — JSR
  [`@kuboon/zenpre`](https://jsr.io/@kuboon/zenpre)。schemas / keys (今後 render
  / components / relay_client を追加)
- [`server/`](./server/) — zenpre.deno.dev 本体(Remix v3 fetch-router)
- [`client/`](./client/) — 本体サイトの hydration エントリ
- [`bundler/`](./bundler/) — `Deno.bundle` + Tailwind v4 + daisyUI → `bundled/`

## 開発

```bash
deno task dev    # bundle して localhost:8000 で起動(--watch)
deno task test   # 全 workspace のテスト
deno task check  # type check + lint + fmt --check
deno task build  # bundled/ を生成
```
