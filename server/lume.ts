import app from "./app.ts";

export function middleware() {
  return async (request: Request, next: () => Promise<Response>) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return await app.fetch(request);
    }
    return await next();
  };
}
