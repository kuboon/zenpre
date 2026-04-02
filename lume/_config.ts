import lume from "lume/mod.ts";
import bundle from "./bundle.ts";
import date from "lume/plugins/date.ts";
import favicon from "lume/plugins/favicon.ts";
import feed from "lume/plugins/feed.ts";
import inline from "lume/plugins/inline.ts";
import esbuild from "lume/plugins/esbuild.ts";
import metas from "lume/plugins/metas.ts";
// import modifyUrls from "lume/plugins/modify_urls.ts";
import nav from "lume/plugins/nav.ts";
import jsx from "lume/plugins/jsx.ts";
import mdx from "lume/plugins/mdx.ts";
import picture from "lume/plugins/picture.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import sitemap from "lume/plugins/sitemap.ts";
import source_maps from "lume/plugins/source_maps.ts";
import transformImages from "lume/plugins/transform_images.ts";
import vento from "lume/plugins/vento.ts";
import { middleware } from "../server/lume.ts";
import path from "node:path";

const site = lume({
  prettyUrls: false,
  src: "src",
  server: {
    middlewares: [middleware()],
  },
}, {
  markdown: { options: { breaks: true }, plugins: [] },
});

site.use(date());
// site.use(bundle());
site.use(favicon());
site.use(jsx());
site.use(esbuild());
// site.use(mdx());
site.use(tailwindcss());
site.use(source_maps());
site.use(picture());
site.use(transformImages());
site.use(metas());
// site.use(inline());
site.use(feed({
  output: ["feed.rss", "feed.json"],
  query: "noindex!=true",
  info: {
    title: "=metas.site",
    description: "=description",
  },
}));
// site.use(filter_pages({}));
// site.use(modifyUrls({
//   fn: (url: string) => url.replace(/\.html$/, ""),
// }))
site.use(nav());
// site.use(prism());
// site.use(relations());
site.use(sitemap({
  query: "noindex!=true",
}));
site.use(vento());
site.loadData([".md"], async (path) => {
  const content = await Deno.readTextFile(path);
  return { content };
});
site.add("style/main.css");
site.add("_lib/markdown.ts");
export default site;
