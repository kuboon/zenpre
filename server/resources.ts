import { DenoKvRepo } from "#/server/kv/denoKv.ts";
import { OnAirSchema, SlideSchema } from "#/schemas.ts";
import type { Resource } from "#/server/createRouter.ts";

export const slideResource = {
  schema: SlideSchema,
  repo: new DenoKvRepo<typeof SlideSchema.t>(["slides"]),
} satisfies Resource<typeof SlideSchema>;

export const onAirResource = {
  schema: OnAirSchema,
  repo: new DenoKvRepo<typeof OnAirSchema.t>(["onAir"]),
} satisfies Resource<typeof OnAirSchema>;
