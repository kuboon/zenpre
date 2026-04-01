export type Slide = {
  id: string;
  key: string;
  title: string;
  markdown: string;
  css: string;
};
export type Session = {
  id: string;
  key: string;
  slide_id: string;
  begin_at: string;
  end_at: string;
};

export type JoinAction = {
  type: "join";
};
export type FocusAction = {
  type: "focus";
  page: number;
  anchor: number;
};
export type ReactionAction = {
  type: "reaction";
  emoji: string;
};
export type PostAction = {
  type: "post";
  text: string;
  id: string | null;
};
export type VoteAction = {
  type: "vote";
  post_id: string;
};
export type Action = JoinAction | FocusAction | ReactionAction | PostAction | VoteAction;

export type TimelineItem = {
  ms: number;
  action: Action;
};
