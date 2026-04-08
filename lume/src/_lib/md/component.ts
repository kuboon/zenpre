import { ActionSchema } from "#/schemas.ts";
import { slideshowToHtml } from "./markdown.ts";

type Action = typeof ActionSchema.t;

class MarkdownRenderer extends HTMLDivElement {
  private boundOnAction: (e: Event) => void;
  private eventSource: EventSource | null = null;

  constructor() {
    super();
    this.boundOnAction = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const detail = e.detail;
      if (!ActionSchema.allows(detail)) return;
      this.handleAction(detail);
    };
  }

  async connectedCallback() {
    const markdown = this.querySelector("template")?.innerHTML ?? "";
    const rendered = this.querySelector("#rendered");
    if (!rendered) return;

    rendered.innerHTML = await slideshowToHtml(markdown);
    this.addEventListener("action", this.boundOnAction);

    const params = new URLSearchParams(location.search);
    const eventId = params.get("event");
    if (eventId) {
      this.connectToRelay(eventId);
    }
  }

  disconnectedCallback() {
    this.removeEventListener("action", this.boundOnAction);
    this.eventSource?.close();
    this.eventSource = null;
  }

  private connectToRelay(eventId: string) {
    const es = new EventSource(`/api/relay/${eventId}`);
    this.eventSource = es;
    es.addEventListener("message", (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        if (!ActionSchema.allows(parsed)) return;
        this.dispatchEvent(new CustomEvent("action", { detail: parsed }));
      } catch {
        // ignore parse errors
      }
    });
  }

  private handleAction(action: Action) {
    if (action.type === "focus") {
      this.handleFocus(action.page, action.anchor);
    } else if (action.type === "reaction") {
      this.handleReaction(action.emoji);
    }
  }

  private handleFocus(page: number, anchor: number) {
    const pageEl = this.querySelector(`[data-page="${page}"]`);
    if (!pageEl) return;
    const headings = pageEl.querySelectorAll("[data-anchor]");
    const target = anchor < headings.length ? headings[anchor] : pageEl;
    target.scrollIntoView({ behavior: "smooth" });
  }

  private handleReaction(emoji: string) {
    const el = document.createElement("div");
    el.textContent = emoji;
    // Position randomly between 10% and 90% from the left edge
    const MIN_LEFT = 10;
    const LEFT_RANGE = 80;
    const left = Math.random() * LEFT_RANGE + MIN_LEFT;
    el.style.cssText = [
      "position:fixed",
      `left:${left}%`,
      "bottom:10%",
      "font-size:2rem",
      "pointer-events:none",
      "z-index:9999",
      "transition:bottom 3s ease-out,opacity 3s ease-out",
      "opacity:1",
    ].join(";");
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.bottom = "80%";
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 3000);
  }
}

customElements.define("markdown-renderer", MarkdownRenderer, {
  extends: "div",
});
