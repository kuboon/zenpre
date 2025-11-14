# Your task

- [ ] setup [github pages](./settings/pages)
- [ ] [src/_data.yml](src/_data.yml) set `description` and `metas`
- [ ] src/favicon.svg

## Running the Server

This project includes an integrated server that combines:

- **Lume** static site generator
- **Hono.js** API server with Zod validation and RPC

### Quick Start

```bash
# Build the static site
deno task build

# Start the integrated server (static site + API)
deno task serve
```

The server runs on `http://localhost:8000` and provides:

- Static site at `/`
- API endpoints at `/api/*`

See [server/README.md](server/README.md) for API documentation.

## For CMS

- [ ] [_cms.ts](_cms.ts) set `githubOpts`
- [ ] set GITHUB_TOKEN env (requires write access to the repo)
