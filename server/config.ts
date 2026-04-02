import { DenoKvRepo } from "#/server/kv/denoKv.ts";

export const configRepo = new DenoKvRepo<string>(["config"]);
