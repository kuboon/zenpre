#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys --unsafely-ignore-certificate-errors

import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { app as honoApp } from "./server/main.ts";

const PORT = 8000;

// Handler that combines Hono API and static file serving
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // If the request is for /api/*, use Hono
  if (url.pathname.startsWith("/api/")) {
    return await honoApp.fetch(req);
  }
  
  // Otherwise, serve static files from _site directory
  return serveDir(req, {
    fsRoot: "_site",
    quiet: true,
  });
}

console.log(`Server running on http://localhost:${PORT}`);
console.log("- Static site served from _site/");
console.log("- API endpoints available at /api/*");
console.log("\nMake sure to run 'deno task build' first to generate the _site directory");

Deno.serve({ port: PORT }, handler);

