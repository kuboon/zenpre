import { ActionSchema } from "#/schemas.ts";
export type TimelineItem = {
  ms: number;
  action: typeof ActionSchema.t;
};
