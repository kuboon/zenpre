import { ActionSchema } from "#/schemas.ts";
import { slideshowToHtml } from "./markdown.ts";

type Action = typeof ActionSchema.t;

class MarkdownRenderer extends HTMLDivElement {
  private boundOnAction: (e: Event) => void;
  private reactionLane = 0;

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
  }

  disconnectedCallback() {
    this.removeEventListener("action", this.boundOnAction);
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
    // Cycle lanes so multiple near-simultaneous reactions do not fully overlap.
    const lane = this.reactionLane++ % 4;
    const el = document.createElement("div");
    el.textContent = emoji;
    // Position randomly between 10% and 90% from the left edge
    const MIN_LEFT = 10;
    const LEFT_RANGE = 80;
    const left = Math.random() * LEFT_RANGE + MIN_LEFT;
    const startBottom = 10 + lane * 6;
    const endBottom = 80 - lane * 3;
    el.style.cssText = [
      "position:fixed",
      `left:${left}%`,
      `bottom:${startBottom}%`,
      "font-size:2rem",
      "pointer-events:none",
      "z-index:9999",
      "transition:bottom 3s ease-out,opacity 3s ease-out",
      "opacity:1",
    ].join(";");
    document.body.appendChild(el);
    // Defer by two frames so the initial style is committed before transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.bottom = `${endBottom}%`;
        el.style.opacity = "0";
      });
    });
    setTimeout(() => el.remove(), 3000);
  }
}

customElements.define("markdown-renderer", MarkdownRenderer, {
  extends: "div",
});
