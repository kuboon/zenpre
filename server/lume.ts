import app from "./app.ts";

export function middleware() {
  return async (req: Request, next: (req: Request) => Promise<Response>) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api")) {
      return await app.fetch(req);
    }
    return await next(req);
  };
}
