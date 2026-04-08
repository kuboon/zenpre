import { markdownToHtml } from "./markdown.ts";

type FocusAction = { type: "focus"; page: number; anchor: number };
type ReactionAction = { type: "reaction"; emoji: string };
type Action = FocusAction | ReactionAction | { type: string };

class MarkdownRenderer extends HTMLDivElement {
  private pages: string[] = [];
  private currentPage = 0;
  private eventSource: EventSource | null = null;

  async connectedCallback() {
    const markdown = this.querySelector("template")?.innerHTML ?? "";
    const markdownPages = markdown.split(/\n---\n/).map((s) => s.trim())
      .filter(Boolean);
    this.pages = markdownPages.length > 0 ? markdownPages : [markdown];
    await this.renderPage(0);

    const params = new URLSearchParams(location.search);
    const eventId = params.get("event");
    if (eventId) {
      this.connectToRelay(eventId);
    }
  }

  disconnectedCallback() {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private async renderPage(pageIndex: number) {
    const idx = Math.max(0, Math.min(pageIndex, this.pages.length - 1));
    const page = this.pages[idx] ?? "";
    const rendered = this.querySelector("#rendered");
    if (rendered) {
      rendered.innerHTML = await markdownToHtml(page);
    }
    this.currentPage = idx;
  }

  private focusPage(pageIndex: number, anchor: number) {
    this.renderPage(pageIndex).then(() => {
      const rendered = this.querySelector("#rendered");
      if (!rendered) return;
      const headings = rendered.querySelectorAll("h1,h2,h3,h4,h5,h6");
      const heading = headings[anchor];
      if (heading) {
        heading.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  private connectToRelay(eventId: string) {
    const es = new EventSource(`/api/relay/${eventId}`);
    this.eventSource = es;
    es.addEventListener("message", (event: MessageEvent) => {
      try {
        const action = JSON.parse(event.data) as Action;
        this.handleAction(action);
      } catch {
        // ignore parse errors
      }
    });
  }

  private handleAction(action: Action) {
    if (action.type === "focus") {
      const { page, anchor } = action as FocusAction;
      this.focusPage(page, anchor);
    } else if (action.type === "reaction") {
      this.showReaction((action as ReactionAction).emoji);
    }
  }

  private showReaction(emoji: string) {
    const el = document.createElement("span");
    el.textContent = emoji;
    const x = Math.floor(Math.random() * 80 + 10);
    const y = Math.floor(Math.random() * 80 + 10);
    el.style.cssText =
      `position:fixed;font-size:3rem;left:${x}%;top:${y}%;pointer-events:none;z-index:9999;`;
    document.body.appendChild(el);
    el.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-60px)" },
      ],
      { duration: 2000, easing: "ease-out" },
    ).onfinish = () => el.remove();
  }
}

customElements.define("markdown-renderer", MarkdownRenderer, {
  extends: "div",
});
