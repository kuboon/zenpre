import { kvStorage } from "../_cms.ts";

export default async function* () {
  for await (const newsItem of kvStorage) {
    const data = await kvStorage.get(newsItem.path).readData();
    yield {
      url: `/${newsItem.name}.html`,
      layout: "layout.vto",
      title: data.title,
      content: data.content,
    };
  }
  yield {
    url: "/page-1/",
    content: "This is the first page",
  };
  yield {
    url: "/page-2/",
    content: "This is the second page",
  };
  yield {
    url: "/page-3/",
    content: "This is the third page",
  };
}
