/**
 * GET /card.png — X Player Card / OGP 用のポスター画像(`assets/card.png`、
 * 675×675 の正方形)。モバイルの X ではプレイヤーを開く前にこれが表示される。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";

const IMAGE_URL = new URL("../../assets/card.png", import.meta.url);
let image: Promise<Uint8Array<ArrayBuffer>> | undefined;

export const cardImageAction = {
  async handler() {
    image ??= Deno.readFile(IMAGE_URL);
    return new Response(await image, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
        "access-control-allow-origin": "*",
      },
    });
  },
} satisfies Action<typeof routes.cardImage>;
