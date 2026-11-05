/**
 * エディタの「自動再生を録画」(`/s/:id/edit`)。
 *
 * プレビュー上の操作を {@link Recorder} で時刻つきに記録し、play code
 * ({@link encodePlayCode})にして `/s/:id?play=<code>` の URL を作る。
 * サーバには何も保存しないので、録画は何本でも作れて編集鍵も要らない。
 * その URL を開くと自動再生される(`client/slide.ts`)。
 *
 * 記録するもの:
 * - ページ送り(← → / スワイプ)→ `focus(page, 0)`
 * - 見出しのタップ → `focus(page, idx)`
 * - 録画バーのリアクションボタン → `reaction(emoji)`
 *
 * 流れ: 録画 → (3 秒カウントダウン)→ 操作 → 停止 → 確認再生 /
 * URL を共有(`<share-buttons>`)/ やり直し。
 */
import { createShareButtons } from "@kuboon/share-element";
import { encodePlayCode } from "@kuboon/zenpre/play_code.ts";
import { Player } from "@kuboon/zenpre/player.ts";
import { Recorder } from "@kuboon/zenpre/recorder.ts";
import type { Action, TimelineEntry } from "@kuboon/zenpre/schemas.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { REACTION_EMOJIS } from "./relay_ui.ts";

type FocusAction = Extract<Action, { type: "focus" }>;

export type RecordingOptions = {
  viewer: ZenSlideViewer;
  layer: ZenReactionLayer | null;
  /** 録画中は markdown を編集させない(プレビューが作り直されるため)。 */
  md: HTMLTextAreaElement;
  /** 録画先のスライド。作成前なら null(録画できない)。 */
  slideId: () => string | null;
};

/** 1:05 のような表記。 */
export function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** timeline の長さ(最後のエントリの時刻)。 */
const durationOf = (tl: TimelineEntry[]) => tl.length ? tl[tl.length - 1].t : 0;

const COUNTDOWN_SEC = 3;

/** 録画 UI を結線する。作成後などに録画可否が変わったら `refresh()` を呼ぶ。 */
export function setupRecording(opts: RecordingOptions): { refresh(): void } {
  const { viewer, layer, md } = opts;
  const recBtn = document.getElementById("zen-rec") as HTMLButtonElement | null;
  const bar = document.getElementById("zen-rec-bar");
  if (!recBtn || !bar) return { refresh() {} };

  let busy = false; // 録画中〜録画結果の確認中

  const button = (label: string, onClick: () => void, cls = "btn btn-xs") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  };

  const refresh = () => {
    const can = opts.slideId() !== null;
    recBtn.disabled = !can || busy;
    recBtn.title = can
      ? "プレビューでの操作を録画して、自動再生する URL を作ります"
      : "スライドを作成すると使えます";
  };

  // ---- 録画 -------------------------------------------------------------

  let recorder: Recorder | null = null;
  let last: FocusAction = { type: "focus", page: 1, idx: 0 };
  let clock: number | undefined;

  const record = (action: Action) => {
    if (!recorder) return;
    recorder.record(action);
    if (action.type === "focus") last = action;
  };

  // ページ送り → focus(page, 0)
  viewer.addEventListener("zen-navigate", (e) => {
    const { page } = (e as CustomEvent<{ page: number }>).detail;
    if (recorder && page !== last.page) {
      record({ type: "focus", page, idx: 0 });
    }
  });

  // 見出しタップ → focus(page, idx)
  viewer.addEventListener("click", (e) => {
    if (!recorder) return;
    const h = (e.target as Element | null)?.closest<HTMLElement>(
      "[data-idx][data-page]",
    );
    if (!h || !viewer.contains(h)) return;
    const page = Number(h.dataset.page);
    const idx = Number(h.dataset.idx);
    if (!(page >= 1 && idx >= 1)) return;
    record({ type: "focus", page, idx });
    viewer.focusOn(page, idx); // 押したことが見えるように強調する
  });

  const showBar = (...children: (Node | string)[]) => {
    bar.replaceChildren(...children);
    bar.hidden = false;
  };
  const hideBar = () => {
    bar.hidden = true;
    bar.replaceChildren();
  };

  const finish = () => {
    busy = false;
    md.readOnly = false;
    hideBar();
    refresh();
  };

  const start = () => {
    busy = true;
    md.readOnly = true;
    refresh();
    viewer.focusOn(1);
    // カウントダウン中にページ 1 へ戻すスクロールを済ませる(記録しない)。
    let n = COUNTDOWN_SEC;
    const count = document.createElement("strong");
    count.className = "zen-rec-count";
    const tick = () => {
      if (n === 0) return begin();
      count.textContent = `${n}`;
      n--;
      globalThis.setTimeout(tick, 1000);
    };
    showBar(count, "ページ 1 から録画します");
    tick();
  };

  const begin = () => {
    recorder = new Recorder();
    last = { type: "focus", page: 1, idx: 0 };
    recorder.start();
    recorder.record(last);

    const time = document.createElement("span");
    time.className = "zen-rec-time";
    const t0 = Date.now();
    const update = () => (time.textContent = `● ${fmtMs(Date.now() - t0)}`);
    update();
    clock = globalThis.setInterval(update, 250);

    const reactions = document.createElement("span");
    reactions.className = "zen-rec-reactions";
    for (const emoji of REACTION_EMOJIS) {
      reactions.append(button(emoji, () => {
        layer?.emit(emoji);
        record({ type: "reaction", emoji });
        // ← → を続けて押せるよう、キーボードフォーカスをプレビューに戻す。
        viewer.focus({ preventScroll: true });
      }, "zen-rec-emoji"));
    }
    showBar(
      time,
      reactions,
      button("■ 停止", stop, "btn btn-error btn-xs"),
    );
    viewer.focus({ preventScroll: true });
  };

  const stop = () => {
    if (!recorder) return;
    globalThis.clearInterval(clock);
    // 停止した時刻まで最後の画面を見せるよう、終端に今の focus を置く。
    recorder.record({ ...last });
    const timeline = recorder.entries;
    recorder = null;
    review(timeline);
  };

  // ---- 録画結果の確認 ---------------------------------------------------

  const review = (timeline: TimelineEntry[]) => {
    const slideId = opts.slideId();
    if (!slideId) return finish();
    const url = new URL(`/s/${slideId}`, location.origin);
    url.searchParams.set("play", encodePlayCode(timeline));

    let player: Player | null = null;
    const stopPlayer = () => {
      player?.dispose();
      player = null;
    };
    const msg = document.createElement("span");
    msg.textContent = `録画 ${fmtMs(durationOf(timeline))}`;

    const play = button("▶ 確認", () => {
      stopPlayer();
      player = new Player(timeline, {
        apply(action) {
          if (action.type === "reaction") layer?.emit(action.emoji);
          else viewer.apply(action);
        },
      }, {
        onState: (s) => {
          if (s === "ended") play.textContent = "▶ 確認";
        },
      });
      play.textContent = "↻ 最初から";
      player.play();
    });

    const open = document.createElement("a");
    open.className = "btn btn-primary btn-xs";
    open.href = url.toString();
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "開く";

    // 録画した URL をそのまま共有する(X ではカード内で自動再生される)。
    const share = createShareButtons();
    share.url = url.toString();

    showBar(
      msg,
      play,
      open,
      share,
      button("やり直す", () => {
        stopPlayer();
        start();
      }),
      button("閉じる", () => {
        stopPlayer();
        finish();
      }, "btn btn-ghost btn-xs"),
    );
  };

  recBtn.addEventListener("click", start);
  refresh();
  return { refresh };
}
