/**
 * Deno Deploy 用エントリポイント。ローカルは `deno serve -P ./router.ts`
 * でも起動できる(router が fetch handler を default export している)。
 */
import router from "./router.ts";

Deno.serve((req) => router.fetch(req));
