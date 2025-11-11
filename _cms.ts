import lumeCMS from "lume/cms/mod.ts";
import GitHub from "lume/cms/storage/github.ts";
import Kv from "lume/cms/storage/kv.ts";

const kv = await Deno.openKv();
export const kvStorage = new Kv({ kv });


const cms = lumeCMS({
  site: {
    name: "CMS デモのCMS",
    description: "ここでブログのコンテンツを編集できます",
    url: "https://example.com",
    body: `
    <p>Long text, for instructions or other content that you want to make it visible in the homepage</p>
    `,
  },
});

cms.storage(
  "src",
  GitHub("kuboon/lume-template", Deno.env.get("GITHUB_TOKEN")!)
);

cms.storage("kv", kvStorage);
cms.upload("post_files", "src:posts/files");

cms.collection({
  name: "news",
  store: "kv:news",
  fields: [
    {
      name: "title",
      type: "text",
    },
    {
      name: "content",
      type: "text",
    },
  ],
});

cms.document({
  name: "landing-page",
  store: "src:index.yml",
  fields: [
    {
      name: "hero",
      type: "object",
      fields: [
        {
          name: "title",
          type: "text",
        },
        {
          name: "content",
          type: "markdown",
        },
      ],
    },
  ],
});
cms.collection({
  name: "posts",
  store: "src:posts/*.md",
  documentName: (data) => {
    const date = new Date(data.published as number).toTemporalInstant()
      .toZonedDateTimeISO("Asia/Tokyo").toPlainDate();
    return `${date}-${data.title}.md`;
  },
  fields: [
    {
      name: "title",
      type: "text",
      value: new Date().toTimeString().slice(0, 5),
    },
    {
      name: "published",
      type: "datetime",
      value: new Date(),
    },
    {
      name: "content",
      type: "markdown",
      upload: "post_files",
    },
  ],
});
export default cms;
