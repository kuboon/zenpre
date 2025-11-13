# Agent Instructions for zenpre

This document provides instructions for AI agents working on this repository.

## Technology Stack

### Deno

This project uses **Deno** as the JavaScript/TypeScript runtime.

- **Version**: Latest stable version
- **Configuration**: See `deno.json` for tasks, compiler options, and permissions
- **Key commands**:
  - `deno task build` - Build the site for production
  - `deno task serve` - Run development server with live reload
  - `deno task lume` - Run Lume CLI directly

**Important Deno configuration details**:
- Unstable features enabled: `temporal`, `fmt-component`, `kv`
- Lock file is disabled (`"lock": false`)
- Permissions are configured per-task in `deno.json`
- JSX is configured with React JSX runtime via `lume`

### Lume

This project uses **Lume** (version 3.1.1) as the static site generator.

- **Source**: `https://cdn.jsdelivr.net/gh/lumeland/lume@3.1.1/`
- **Configuration**: `_config.ts`
- **Source directory**: `src/`
- **Pretty URLs**: Disabled (`prettyUrls: false`)

**Active Lume plugins** (see `_config.ts`):
- `date` - Date formatting
- `favicon` - Favicon generation
- `jsx` - JSX/TSX support
- `feed` - RSS/JSON feed generation
- `metas` - Meta tags
- `nav` - Navigation
- `pagefind` - Search functionality
- `tailwindcss` - Tailwind CSS integration
- `source_maps` - Source map generation
- `picture` - Image optimization
- `transformImages` - Image transformations
- `inline` - Inline assets
- `sitemap` - Sitemap generation
- `vento` - Vento template engine

**Key files**:
- `_config.ts` - Main Lume configuration
- `src/_data.yml` - Global site data
- `src/_includes/` - Layout templates
- `src/_components/` - Reusable components
- `src/posts/` - Blog posts
- `src/style/main.css` - Main stylesheet

### DaisyUI 5

This project uses **DaisyUI version 5.0.50** for UI components.

- **Integration**: Via Tailwind CSS plugin in `src/style/main.css`
- **Version**: 5.0.50 (specified in CSS `@plugin` directive)
- **Themes**: 
  - Built-in themes: `retro`, `valentine`
  - Custom theme: `green` (default, light mode)

**DaisyUI configuration** (in `src/style/main.css`):
```css
@plugin "daisyui@5.0.50" {
  themes: retro, valentine;
}
```

**Custom theme configuration**:
The project includes a custom "green" theme with:
- Light color scheme (`prefersdark: false`)
- Custom color palette using OKLCH color space
- Custom border radius and sizing variables
- Custom depth and noise settings

**When working with styling**:
- Use DaisyUI component classes (e.g., `btn`, `card`, `navbar`)
- Reference the custom "green" theme colors
- Maintain consistency with the retro/valentine theme options
- Use Tailwind utility classes alongside DaisyUI components
- All styling configuration is in `src/style/main.css`

### Hono.js
https://hono.dev/llms.txt
This project uses **Hono.js** as the backend API framework.

## Development Workflow

1. **Setup**: Clone the repository and run `deno task serve` for development
2. **Development**: Edit files in `src/` and view changes at `http://localhost:3000`
3. **Build**: Run `deno task build` to generate the production site
4. **Deployment**: The site is deployed via GitHub Actions (see `.github/workflows/lume.yml`)

## Project Structure

```
.
├── _config.ts          # Lume configuration
├── deno.json           # Deno configuration and tasks
├── src/
│   ├── _data.yml       # Global site data
│   ├── _includes/      # Layout templates
│   ├── _components/    # Reusable components
│   ├── posts/          # Blog posts
│   ├── style/
│   │   └── main.css    # Main stylesheet with DaisyUI config
│   ├── favicon.svg     # Site favicon
│   └── index.yml       # Homepage configuration
└── .github/
    └── workflows/
        └── lume.yml    # GitHub Pages deployment
```

## Making Changes

### Adding Dependencies
- JavaScript/TypeScript: Add to `imports` in `deno.json`
- Lume plugins: Import and use in `_config.ts`
- DaisyUI version: Update version number in `src/style/main.css`

### Styling Updates
- Modify `src/style/main.css` for theme or DaisyUI configuration
- Use DaisyUI component classes in templates
- Leverage the custom "green" theme for consistency

### Content Updates
- Blog posts: Add markdown files to `src/posts/`
- Pages: Add files to `src/`
- Configuration: Update `src/_data.yml` for site metadata

## Important Notes

- **No package.json**: This project uses Deno's import maps instead of npm
- **CDN imports**: Dependencies are loaded from CDN (jsdelivr.net, jsr.io)
- **Permissions**: Deno permissions are explicitly configured in `deno.json`
- **Markdown**: Configured with `breaks: true` for GitHub-flavored line breaks
