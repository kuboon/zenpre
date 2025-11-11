import lume from "lume/mod.ts";
import date from "lume/plugins/date.ts";
import esbuild from "lume/plugins/esbuild.ts";
import favicon from "lume/plugins/favicon.ts";
import feed from "lume/plugins/feed.ts";
// import filter_pages from "lume/plugins/filter_pages.ts";
import inline from "lume/plugins/inline.ts";
import metas from "lume/plugins/metas.ts";
import modifyUrls from "lume/plugins/modify_urls.ts";
import nav from "lume/plugins/nav.ts";
import jsx from "lume/plugins/jsx.ts";
import pagefind from "lume/plugins/pagefind.ts";
import picture from "lume/plugins/picture.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
// import prism from "lume/plugins/prism.ts";
// import relations from "lume/plugins/relations.ts";
import sitemap from "lume/plugins/sitemap.ts";
import source_maps from "lume/plugins/source_maps.ts";
import transformImages from "lume/plugins/transform_images.ts";
import vento from "lume/plugins/vento.ts";

const site = lume({
  prettyUrls: false,
  src: "src",
}, {
  markdown: { options: { breaks: true }, plugins: [] },
});

site.use(date());
// site.use(esbuild());
site.use(favicon());
site.use(jsx());
site.use(feed({
  output: ["feed.rss", "feed.json"],
  query: "noindex!=true",
  info: {
    title: "=metas.site",
    description: "=description",
  },
}));
// site.use(filter_pages({}));
site.use(metas());
// site.use(modifyUrls({
//   fn: (url: string) => url.replace(/\.html$/, ""),
// }))
site.use(nav());
site.use(pagefind());
site.use(tailwindcss());
site.add("style/main.css");
site.use(source_maps());
site.use(picture());
site.use(transformImages());
site.add("/posts/files");
site.use(inline());
// site.use(prism());
// site.use(relations());
site.use(sitemap({
  query: "noindex!=true",
}));
site.use(vento());

export default site;
