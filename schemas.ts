import { type } from "arktype";

export const NewSlideSchema = type({
  title: "string",
  markdown: "string",
  css: "string",
});
export const SlideSchema = NewSlideSchema.merge({
  id: "string",
  key: "string?",
});

export const NewOnAirSchema = type({
  slide_id: "string",
  begin_at: "string",
  end_at: "string",
});
export const OnAirSchema = NewOnAirSchema.merge({
  id: "string",
  key: "string?",
});

export const ActionSchemas = {
  Join: type({ type: "'join'" }),
  Focus: type({ type: "'focus'", page: "number", anchor: "number" }),
  Reaction: type({ type: "'reaction'", emoji: "string" }),
  Post: type({ type: "'post'", text: "string", id: "string | null" }),
  Vote: type({ type: "'vote'", post_id: "string" }),
};
export const ActionSchema = type.or(...Object.values(ActionSchemas));
