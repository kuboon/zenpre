/**
 * The ZenPre intro deck autoplayed on the home page (`/`).
 *
 * This dogfooding deck is served statically without KV and replayed by the
 * Player with a fixed {@link INTRO_TIMELINE} of focus and reaction actions.
 */
import type { TimelineEntry } from "@kuboon/zenpre/schemas.ts";

export const INTRO_THEME = "synthwave";

/**
 * Fixed timeline streamed into the home-page Player. It recreates a presenter
 * moving focus through the deck while audience reactions rise in real time.
 * `t` is milliseconds.
 */
export const INTRO_TIMELINE: TimelineEntry[] = [
  { t: 0, action: { type: "focus", page: 1, idx: 0 } },
  { t: 1100, action: { type: "reaction", emoji: "✨" } },
  { t: 2400, action: { type: "focus", page: 2, idx: 1 } },
  { t: 4200, action: { type: "focus", page: 2, idx: 2 } },
  { t: 6000, action: { type: "focus", page: 2, idx: 3 } },
  { t: 7600, action: { type: "focus", page: 2, idx: 4 } },
  { t: 8300, action: { type: "reaction", emoji: "🎉" } },
  { t: 8380, action: { type: "reaction", emoji: "❤️" } },
  { t: 8460, action: { type: "reaction", emoji: "👏" } },
  { t: 8540, action: { type: "reaction", emoji: "🎉" } },
  { t: 8620, action: { type: "reaction", emoji: "❤️" } },
  { t: 8700, action: { type: "reaction", emoji: "👏" } },
  { t: 8780, action: { type: "reaction", emoji: "🎉" } },
  { t: 9000, action: { type: "focus", page: 4, idx: 0 } },
  { t: 10800, action: { type: "reaction", emoji: "⏺️" } },
  { t: 11800, action: { type: "focus", page: 5, idx: 0 } },
  { t: 14100, action: { type: "reaction", emoji: "🤖" } },
  { t: 15000, action: { type: "focus", page: 6, idx: 0 } },
  { t: 17200, action: { type: "reaction", emoji: "📱" } },
  { t: 18100, action: { type: "focus", page: 7, idx: 0 } },
  { t: 20200, action: { type: "focus", page: 8, idx: 0 } },
  { t: 22300, action: { type: "reaction", emoji: "⚡" } },
  { t: 23100, action: { type: "reaction", emoji: "🎉" } },
];

export const INTRO_MARKDOWN = `# ZenPre

## Presentation, redefined.

Interactive.

AI-native.

Mobile-native.

---

# Interaction

What you are watching right now is ZenPre AutoPlay.

Share your slide URL with the audience before the session.

## Drive the room from a browser controller

Advance pages in real time.

## Go deeper with vertical focus

Scroll down into the exact point you want everyone to see.

↓

↓

↓

↓


# Focus here.

And audience interaction lands in the moment.

🎉 ❤️ 👏

---

# AutoPlay

Every focus move and every interaction can be captured as JSON by the
Record component, then replayed by the Player component.

The presentation becomes an event stream, not a static file.

---

# AI-native

Upload presentations and schedule live sessions smoothly from a remote MCP.

Markdown and HTML are first-class. PowerPoint or PDF? Do we still need them?

When an AI opens a slide URL, it can fetch the pure slide text directly.

---

# Mobile-native

- Vertical fullscreen by default
- Next topic: page transition
- Deeper context: vertical scroll

---

# One more thing

---

# Own your stage

ZenPre's refined component architecture lets you embed the presentation engine
inside pages you already own.

Just tell your AI:

> I want to embed slides using https://zenpre.kbn.one/

Try it now.
`;
