import { ActionSchema } from "#/schemas.ts";
import type { TimelineItem } from "#/types.ts";

type Action = typeof ActionSchema.t;

/**
 * SlidePlayer — custom element that plays back a recorded timeline of actions.
 *
 * Usage:
 *   <slide-player>
 *     <script type="application/json">
 *       [{"ms": 0, "action": {"type": "focus", "page": 1, "anchor": 0}}, ...]
 *     </script>
 *   </slide-player>
 *
 * The element queries the nearest `[is="markdown-renderer"]` and dispatches
 * "action" CustomEvents on it at the specified millisecond offsets.
 */
class SlidePlayer extends HTMLElement {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private playing = false;
  private playButton: HTMLButtonElement | null = null;
  private eventSource: EventSource | null = null;

  connectedCallback() {
    this.renderControls();
    this.connectRelay();
  }

  disconnectedCallback() {
    this.clearTimers();
    this.eventSource?.close();
    this.eventSource = null;
  }

  private getTimeline(): TimelineItem[] {
    const el = this.querySelector<HTMLScriptElement>(
      "script[type='application/json']",
    );
    if (!el?.textContent) return [];
    try {
      return JSON.parse(el.textContent) as TimelineItem[];
    } catch {
      return [];
    }
  }

  private renderControls() {
    const controls = document.createElement("div");
    controls.className = "flex gap-2 items-center p-2";

    this.playButton = document.createElement("button");
    this.playButton.textContent = "▶ Play";
    this.playButton.className = "btn btn-primary btn-sm";
    this.playButton.addEventListener("click", () => this.toggle());
    controls.appendChild(this.playButton);

    const resetButton = document.createElement("button");
    resetButton.textContent = "⏮ Reset";
    resetButton.className = "btn btn-outline btn-sm";
    resetButton.addEventListener("click", () => this.stop());
    controls.appendChild(resetButton);

    this.appendChild(controls);
  }

  private toggle() {
    if (this.playing) {
      this.stop();
    } else {
      this.play();
    }
  }

  private play() {
    this.playing = true;
    if (this.playButton) this.playButton.textContent = "⏸ Pause";

    const timeline = this.getTimeline();
    const maxMs = timeline.reduce((m, item) => Math.max(m, item.ms), 0);

    for (const item of timeline) {
      const timer = setTimeout(() => {
        this.dispatchAction(item.action);
      }, item.ms);
      this.timers.push(timer);
    }

    // Automatically stop after the last action
    const endTimer = setTimeout(
      () => this.stop(),
      maxMs + 100,
    );
    this.timers.push(endTimer);
  }

  private stop() {
    this.playing = false;
    if (this.playButton) this.playButton.textContent = "▶ Play";
    this.clearTimers();
  }

  private clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  private dispatchAction(action: Action) {
    const renderer = document.querySelector("[is='markdown-renderer']");
    if (renderer) {
      renderer.dispatchEvent(new CustomEvent("action", { detail: action }));
    }
  }

  private connectRelay() {
    const eventId = new URLSearchParams(location.search).get("event");
    if (!eventId) return;

    const es = new EventSource(`/api/relay/${eventId}`);
    this.eventSource = es;
    es.addEventListener("message", (event: MessageEvent) => {
      const actions = this.parseActions(event.data);
      for (const action of actions) {
        this.dispatchAction(action);
      }
    });
  }

  private parseActions(raw: unknown): Action[] {
    if (typeof raw !== "string") return [];

    const parsedActions = this.normalizeActions(this.safeParseJson(raw));
    if (parsedActions.length > 0) return parsedActions;

    // Fallback: tolerate comma/newline separated JSON snippets.
    return raw
      .split(/\n+/)
      .map((line) => line.trim().replace(/,+$/, ""))
      .filter(Boolean)
      .flatMap((line) => this.normalizeActions(this.safeParseJson(line)));
  }

  private safeParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private normalizeActions(value: unknown): Action[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.normalizeActions(item));
    }
    if (!value || typeof value !== "object") return [];

    if (ActionSchema.allows(value)) {
      return [value as Action];
    }

    const maybeAction = (value as Record<string, unknown>).action;
    if (ActionSchema.allows(maybeAction)) {
      return [maybeAction as Action];
    }

    const maybeActions = (value as Record<string, unknown>).actions;
    if (Array.isArray(maybeActions)) {
      return maybeActions.flatMap((item) => this.normalizeActions(item));
    }

    return [];
  }
}

customElements.define("slide-player", SlidePlayer);
