/**
 * markdown エディタ(`/new` と `/s/:id/edit`)のクライアントエントリ。
 *
 * - textarea の入力を debounce して `<zen-slide-viewer>` にライブプレビュー
 *   (`load({ markdown })` = 実際の閲覧画面と同じ描画経路)。
 * - テーマはプレビュー枠だけに適用する(エディタ自体の配色は変えない)。
 * - 新規は `POST /api/slides`。作成後は URL を `/s/:id/edit` に差し替えて
 *   編集モードへ移り、以後は `PATCH /api/slides/:id` で更新する
 *   (`slide_key` は localStorage に退避)。
 */
import { defineComponents } from "@kuboon/zenpre/components.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { createShareButtons } from "@kuboon/share-element";
import { setupRecording } from "./recording.ts";

defineComponents();

const md = document.getElementById("zen-md") as HTMLTextAreaElement | null;
const themeSel = document.getElementById("zen-theme") as
  | HTMLSelectElement
  | null;
const createBtn = document.getElementById("zen-create") as
  | HTMLButtonElement
  | null;
const preview = document.getElementById("zen-preview");
const result = document.getElementById("zen-result");
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");

/** 相対 URL を絶対 URL にして表示・コピーしやすくする。 */
const abs = (path: string) => new URL(path, location.origin).toString();

/** localStorage に置く編集鍵のキー。 */
const keyOf = (slideId: string) => `zen-slide-key:${slideId}`;

type EditData = { slide_id: string };

/** 編集中のスライド(`/s/:id/edit` で SSR が埋める)。新規なら null。 */
function readEditData(): EditData | null {
  const el = document.getElementById("zen-edit-data");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? "") as EditData;
  } catch {
    return null;
  }
}

const editData = readEditData();
/** 編集対象。作成に成功したらここが埋まり、以後は更新モードになる。 */
let editing = editData?.slide_id ?? null;

/** 結果パネルにリンク行を足す。 */
function addLink(label: string, href: string, note?: string): void {
  if (!result) return;
  const row = document.createElement("div");
  row.className = "zen-result-row";
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  row.appendChild(a);
  const url = document.createElement("code");
  url.textContent = abs(href);
  row.appendChild(url);
  if (note) {
    const n = document.createElement("small");
    n.textContent = note;
    row.appendChild(n);
  }
  result.appendChild(row);
}

if (md && viewer) {
  // ---- ライブプレビュー -----------------------------------------------
  let timer: number | undefined;
  let rendering = false;
  let pending = false;

  const render = async () => {
    if (rendering) {
      pending = true;
      return;
    }
    rendering = true;
    try {
      // theme は渡さない(daisyUI テーマはプレビュー枠の data-theme で当てる)。
      await viewer.load({ markdown: md.value });
    } catch (e) {
      console.error("preview failed", e);
    } finally {
      rendering = false;
      if (pending) {
        pending = false;
        void render();
      }
    }
  };

  md.addEventListener("input", () => {
    globalThis.clearTimeout(timer);
    timer = globalThis.setTimeout(() => void render(), 400);
  });
  void render();

  // ---- 自動再生の録画 ---------------------------------------------------
  const recording = setupRecording({
    viewer,
    layer,
    md,
    slideId: () => editing,
  });

  // ---- テーマ(プレビュー枠のみ) ---------------------------------------
  themeSel?.addEventListener("change", () => {
    preview?.setAttribute("data-theme", themeSel.value);
  });

  // ---- 作成 / 更新 ------------------------------------------------------

  type TalkLinks = {
    audience_url: string;
    presenter_url: string;
    moderator_url: string;
  };
  /** このブラウザで作ったトークの URL(発表者・モデレーターは鍵つき)。 */
  const talkKeyOf = (slideId: string) => `zen-slide-talk:${slideId}`;
  const loadTalk = (slideId: string): TalkLinks | null => {
    try {
      const raw = localStorage.getItem(talkKeyOf(slideId));
      return raw ? JSON.parse(raw) as TalkLinks : null;
    } catch {
      return null;
    }
  };
  const showTalk = (talk: TalkLinks) => {
    addLink("客席 URL(共有する)", talk.audience_url);
    addLink("発表者", talk.presenter_url, "鍵つき・共有しない");
    addLink("モデレーター", talk.moderator_url, "鍵つき・共有しない");
  };

  /**
   * 結果パネル(閲覧 URL・共有・トーク)。作成直後・更新後・編集ページを
   * 開いたときに同じものを出す。トークは作ってあればその URL を、
   * 無ければ「トークを開始する」ボタンを出す。
   */
  const showPanel = (heading: string, slideId: string, slideKey: string) => {
    if (!result) return;
    result.hidden = false;
    result.textContent = "";
    const h = document.createElement("strong");
    h.textContent = heading;
    result.appendChild(h);
    const previewUrl = `/s/${slideId}`;
    addLink("スライドを開く", previewUrl);
    const share = createShareButtons();
    share.url = abs(previewUrl);
    result.appendChild(share);

    const saved = loadTalk(slideId);
    if (saved) return showTalk(saved);

    // トークにすると相互配信(focus 追従・リアクション・質問)が使える。
    const talkBtn = document.createElement("button");
    talkBtn.type = "button";
    talkBtn.className = "btn btn-sm";
    talkBtn.textContent = "トークを開始する";
    talkBtn.addEventListener("click", async () => {
      talkBtn.disabled = true;
      try {
        const tRes = await fetch("/api/talks", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-slide-key": slideKey,
          },
          body: JSON.stringify({ slide_id: slideId }),
        });
        if (!tRes.ok) throw new Error(`talk failed: ${tRes.status}`);
        const t = await tRes.json() as TalkLinks;
        const talk = {
          audience_url: t.audience_url,
          presenter_url: t.presenter_url,
          moderator_url: t.moderator_url,
        };
        try {
          localStorage.setItem(talkKeyOf(slideId), JSON.stringify(talk));
        } catch { /* ignore */ }
        talkBtn.remove();
        showTalk(talk);
      } catch (e) {
        talkBtn.disabled = false;
        console.error(e);
        const err = document.createElement("small");
        err.textContent = "トークの作成に失敗しました";
        result.appendChild(err);
      }
    });
    result.appendChild(talkBtn);
  };

  createBtn?.addEventListener("click", async () => {
    createBtn.disabled = true;
    const busy = editing ? "更新中…" : "作成中…";
    const idle = editing ? "更新する" : "スライドを作成";
    createBtn.textContent = busy;
    const body = JSON.stringify({
      markdown: md.value,
      theme: themeSel?.value ?? "light",
    });
    try {
      if (editing) {
        // ---- 更新(鍵が必要) ----
        const key = localStorage.getItem(keyOf(editing));
        if (!key) throw new Error("no slide_key for this slide");
        const res = await fetch(`/api/slides/${editing}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-slide-key": key },
          body,
        });
        if (!res.ok) throw new Error(`update failed: ${res.status}`);
        showPanel("更新しました", editing, key);
      } else {
        // ---- 新規作成 ----
        const res = await fetch("/api/slides", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        if (!res.ok) throw new Error(`create failed: ${res.status}`);
        const slide = await res.json() as {
          slide_id: string;
          slide_key: string;
          preview_url: string;
        };
        try {
          localStorage.setItem(keyOf(slide.slide_id), slide.slide_key);
        } catch { /* ignore */ }
        // URL を編集中のスライドに合わせる(リロードしても続きから編集できる)。
        editing = slide.slide_id;
        history.replaceState(null, "", `/s/${slide.slide_id}/edit`);
        document.title = "スライドを編集 — ZenPre";
        showPanel("スライドを作成しました", slide.slide_id, slide.slide_key);
        recording.refresh();
      }
    } catch (e) {
      console.error(e);
      if (result) {
        result.hidden = false;
        result.textContent = editing
          ? "更新に失敗しました"
          : "作成に失敗しました";
      }
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = editing ? "更新する" : idle;
    }
  });

  // 編集モードで鍵があれば、最初から共有・トークの案内を出しておく。
  const openKey = editing ? localStorage.getItem(keyOf(editing)) : null;
  if (editing && openKey) showPanel("このスライド", editing, openKey);

  // 編集モードなのに鍵が無い(他人のスライド/別ブラウザ)ときは更新できない。
  if (editing && !openKey) {
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.title = "このブラウザに編集鍵がありません";
    }
    if (result) {
      result.hidden = false;
      result.textContent =
        "このブラウザには編集鍵が無いため更新できません(閲覧・プレビューのみ)";
    }
  }
}
