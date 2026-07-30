/**
 * Remote MCP エンドポイント(`POST /mcp`)。
 *
 * MCP の Streamable HTTP トランスポートは中身が JSON-RPC 2.0 over HTTP なので、
 * ここでは Node 依存の SDK を使わず、ステートレスな最小実装を直接書く
 * (Deno / fetch-router と素直に噛み合い、依存も増やさない)。全ツールが
 * 単純な request/response なので SSE ストリームは提供しない(GET は 405)。
 *
 * 認可は OAuth ではなく各ツール引数の capability key で行う(§12)。ツールは
 * REST controller と同じ repo 層を叩く薄い wrapper。
 *
 * 提供ツール:
 * - `upload_slide` / `edit_slide` / `create_talk`(slide/talk 管理)
 * - `list_pending_posts` / `publish_post`(LLM モデレーター、§11 ModeratorMcp)
 */
import { type } from "arktype";
import { genPublicId } from "@kuboon/zenpre/keys.ts";
import { POST_TEXT_MAX_GRAPHEMES } from "@kuboon/zenpre/schemas.ts";
import type { Slides } from "./repo/slides.ts";
import type { Talks } from "./repo/talks.ts";
import type { HubRegistry } from "./relay/hub.ts";

export type McpDeps = { slides: Slides; talks: Talks; hubs: HubRegistry };

const SERVER_INFO = { name: "zenpre", version: "0.1.0" };
const PREFERRED_PROTOCOL = "2025-06-18";
const SUPPORTED_PROTOCOLS = new Set([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, mcp-session-id, mcp-protocol-version",
};

/** ツール内で投げるユーザー向けエラー(tools/call の isError にする)。 */
class ToolError extends Error {}

/** grapheme 数(絵文字等の多バイト文字を 1 と数える)。 */
function graphemeLength(s: string): number {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    let n = 0;
    for (
      const _ of new Seg(undefined, { granularity: "grapheme" }).segment(s)
    ) {
      n++;
    }
    return n;
  }
  return [...s].length;
}

type ToolDef = {
  name: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  input: any;
  // deno-lint-ignore no-explicit-any
  handler: (args: any, deps: McpDeps) => Promise<unknown>;
};

const TOOLS: ToolDef[] = [
  {
    name: "upload_slide",
    description:
      "markdown からスライドを作成する。slide_key(編集用の秘密鍵)は一度だけ返る。",
    input: type({ markdown: "string", "css?": "string", "theme?": "string" }),
    handler: async (args, { slides }) => {
      const { slide, slide_key } = await slides.create(args);
      return {
        slide_id: slide.slide_id,
        slide_key,
        preview_url: `/s/${slide.slide_id}`,
      };
    },
  },
  {
    name: "edit_slide",
    description:
      "既存スライドを更新する。slide_key が必要。markdown/css/theme は与えたものだけ更新。",
    input: type({
      slide_id: "string",
      slide_key: "string",
      "markdown?": "string",
      "css?": "string",
      "theme?": "string",
    }),
    handler: async (args, { slides }) => {
      const { slide_id, slide_key, ...patch } = args;
      const result = await slides.update(slide_id, slide_key, patch);
      if (result === "not_found") throw new ToolError("slide not found");
      if (result === "forbidden") throw new ToolError("invalid slide_key");
      return { ok: true, preview_url: `/s/${result.slide_id}` };
    },
  },
  {
    name: "create_talk",
    description:
      "トーク(開催枠)を作成する。slide_id を省くとリレー専用トーク(セルフホスト用)。" +
      "slide 紐付け時は slide_key で所有権を確認する。",
    input: type({
      "slide_id?": "string | null",
      "slide_key?": "string",
      "begin_at?": "string",
      "end_at?": "string | null",
    }),
    handler: async (args, { slides, talks }) => {
      if (args.slide_id) {
        const slide = await slides.get(args.slide_id);
        if (!slide) throw new ToolError("slide not found");
        if (!args.slide_key) throw new ToolError("slide_key required");
        const check = await slides.update(args.slide_id, args.slide_key, {});
        if (check === "not_found") throw new ToolError("slide not found");
        if (check === "forbidden") throw new ToolError("invalid slide_key");
      }
      const { talk, event_key, moderator_key } = await talks.create({
        slide_id: args.slide_id ?? null,
        begin_at: args.begin_at,
        end_at: args.end_at,
      });
      return {
        talk_id: talk.talk_id,
        talk_key: event_key,
        moderator_key,
        audience_url: `/t/${talk.talk_id}`,
        presenter_url: `/t/${talk.talk_id}/present#key=${event_key}`,
        moderator_url: `/t/${talk.talk_id}/moderate#key=${moderator_key}`,
      };
    },
  },
  {
    name: "list_pending_posts",
    description:
      "未承認(level-0)の post を新しめ順で取得する。moderator_key または talk_key が必要。" +
      "リレーの isolate ローカルな直近バッファなので best-effort。",
    input: type({ talk_id: "string", moderator_key: "string" }),
    handler: async (args, { talks, hubs }) => {
      const role = await talks.roleOf(args.talk_id, args.moderator_key);
      if (!role) throw new ToolError("forbidden: invalid key for this talk");
      return { pending: hubs.pendingPosts(args.talk_id) };
    },
  },
  {
    name: "publish_post",
    description:
      "post を承認して全員へ配信する(level>=1)。moderator_key または talk_key が必要。" +
      "text は 50 grapheme まで。",
    input: type({
      talk_id: "string",
      moderator_key: "string",
      text: "string",
      "level?": "number.integer >= 1",
    }),
    handler: async (args, { talks, hubs }) => {
      const role = await talks.roleOf(args.talk_id, args.moderator_key);
      if (!role) throw new ToolError("forbidden: invalid key for this talk");
      if (graphemeLength(args.text) > POST_TEXT_MAX_GRAPHEMES) {
        throw new ToolError(
          `text exceeds ${POST_TEXT_MAX_GRAPHEMES} graphemes`,
        );
      }
      const post_id = genPublicId();
      hubs.publishStage(args.talk_id, {
        kind: "action",
        action: {
          type: "post",
          text: args.text,
          level: args.level ?? 1,
          post_id,
        },
        from: "mcp",
        ts: Date.now(),
      });
      return { ok: true, post_id };
    },
  },
];

// --- JSON-RPC ---------------------------------------------------------------

type RpcId = string | number | null;
type RpcMessage = {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: RpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** 1 メッセージを処理する。通知(id なし)は null を返す(応答なし)。 */
async function dispatch(
  msg: RpcMessage,
  deps: McpDeps,
): Promise<object | null> {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion as string | undefined;
      const protocolVersion = requested && SUPPORTED_PROTOCOLS.has(requested)
        ? requested
        : PREFERRED_PROTOCOL;
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // 通知には応答しない
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.input.toJsonSchema(),
        })),
      });
    case "tools/call": {
      const name = msg.params?.name as string | undefined;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        return rpcError(id, -32602, `unknown tool: ${name}`);
      }
      const parsed = tool.input(msg.params?.arguments ?? {});
      if (parsed instanceof type.errors) {
        return rpcResult(id, toolError(parsed.summary));
      }
      try {
        const result = await tool.handler(parsed, deps);
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        });
      } catch (e) {
        if (e instanceof ToolError) return rpcResult(id, toolError(e.message));
        throw e;
      }
    }
    default:
      if (isNotification) return null;
      return rpcError(id, -32601, `method not found: ${msg.method}`);
  }
}

function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * `/mcp` を処理する。POST の JSON-RPC を捌き、GET は SSE 非対応で 405、
 * OPTIONS は CORS プリフライト。ステートレス(セッション ID は使わない)。
 */
export async function handleMcp(
  req: Request,
  deps: McpDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method === "GET") {
    return new Response("method not allowed (no SSE stream)", {
      status: 405,
      headers: { ...CORS, Allow: "POST, OPTIONS" },
    });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { ...CORS, Allow: "POST, OPTIONS" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
      headers: CORS,
    });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses: object[] = [];
  for (const m of messages) {
    const res = await dispatch(m as RpcMessage, deps);
    if (res) responses.push(res);
  }

  // 通知だけ(応答なし)は 202 Accepted。
  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: CORS });
  }
  const payload = Array.isArray(body) ? responses : responses[0];
  return Response.json(payload, {
    headers: { ...CORS, "content-type": "application/json" },
  });
}
