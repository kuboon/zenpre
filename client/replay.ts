/**
 * `/t/:talk_id/replay` — 記録済み timeline を再生するクライアントエントリ。
 * relay には繋がず、`GET /api/talks/:id/timeline` を fetch して {@link Player}
 * で SlideViewer / ReactionLayer を自動操作する。再生/一時停止/シークバー付き。
 */
import { Player } from "@kuboon/zenpre/player.ts";
import type { Action, TimelineEntry } from "@kuboon/zenpre/schemas.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { defineComponents, readTalkData } from "./relay_ui.ts";

defineComponents();

const data = readTalkData();
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

if (data && viewer) {
  const sink = {
    apply(action: Action) {
      if (action.type === "reaction") layer?.emit(action.emoji);
      else viewer.apply(action);
    },
  };

  buildControls(data.talk_id, viewer, sink);
}

async function buildControls(
  talkId: string,
  _viewer: ZenSlideViewer,
  sink: { apply: (a: Action) => void },
) {
  const res = await fetch(`/api/talks/${talkId}/timeline`);
  const { entries } = await res.json() as { entries: TimelineEntry[] };

  const bar = document.createElement("div");
  bar.className = "zen-player-bar";
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.textContent = "▶";
  const seek = document.createElement("input");
  seek.type = "range";
  seek.min = "0";
  seek.step = "100";
  const time = document.createElement("span");
  time.className = "zen-player-time";
  bar.append(playBtn, seek, time);
  document.body.appendChild(bar);

  if (entries.length === 0) {
    time.textContent = "記録なし";
    playBtn.disabled = true;
    seek.disabled = true;
    return;
  }

  const player = new Player(entries, sink, {
    onTick: (pos) => {
      if (!seeking) seek.value = String(Math.round(pos));
      time.textContent = `${fmt(pos)} / ${fmt(player.duration)}`;
    },
    onState: (s) => {
      playBtn.textContent = s === "playing" ? "⏸" : "▶";
    },
  });
  seek.max = String(Math.max(1, player.duration));
  time.textContent = `0:00 / ${fmt(player.duration)}`;

  playBtn.addEventListener("click", () => {
    if (player.state === "playing") player.pause();
    else player.play();
  });

  let seeking = false;
  seek.addEventListener("input", () => {
    seeking = true;
    time.textContent = `${fmt(Number(seek.value))} / ${fmt(player.duration)}`;
  });
  seek.addEventListener("change", () => {
    player.seek(Number(seek.value));
    seeking = false;
  });
}
