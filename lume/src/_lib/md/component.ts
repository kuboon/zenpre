import { markdownToHtml } from "./markdown.ts";

class MarkdownRenderer extends HTMLDivElement {
  async connectedCallback() {
    const markdown = this.querySelector("template")?.innerHTML ?? "";
    this.querySelector("#rendered")!.innerHTML = await markdownToHtml(markdown);
  }
}
customElements.define("markdown-renderer", MarkdownRenderer, {
  extends: "div",
});
