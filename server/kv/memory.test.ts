import { assertEquals, assertNotEquals } from "@std/assert";
import { MemoryKvRepo } from "./memory.ts";

Deno.test("entry: set と get で値を保存・取得できる", async () => {
  const repo = new MemoryKvRepo<string>(["test"]);
  const entry = repo.entry(["key1"]);
  await entry.set("hello");
  const value = await entry.get();
  assertEquals(value, "hello");
});

Deno.test("entry: get は存在しないキーに null を返す", async () => {
  const repo = new MemoryKvRepo<string>(["test"]);
  const value = await repo.entry(["missing"]).get();
  assertEquals(value, null);
});

Deno.test("entry: delete で値を削除できる", async () => {
  const repo = new MemoryKvRepo<number>(["test"]);
  const entry = repo.entry(["del"]);
  await entry.set(42);
  await entry.delete();
  assertEquals(await entry.get(), null);
});

Deno.test("entry: update で値を更新できる", async () => {
  const repo = new MemoryKvRepo<number>(["test"]);
  const entry = repo.entry(["counter"]);
  await entry.set(1);
  const result = await entry.update((n) => (n ?? 0) + 1);
  assertEquals(result.ok, true);
  assertEquals(await entry.get(), 2);
});

Deno.test("entry: update で null を返すと削除される", async () => {
  const repo = new MemoryKvRepo<string>(["test"]);
  const entry = repo.entry(["remove"]);
  await entry.set("value");
  await entry.update(() => null);
  assertEquals(await entry.get(), null);
});

Deno.test("entry: expireIn 経過後は null を返す", async () => {
  const repo = new MemoryKvRepo<string>(["test"]);
  const entry = repo.entry(["expiring"]);
  await entry.set("temp", { expireIn: 1 }); // 1ms
  await new Promise((r) => setTimeout(r, 10));
  assertEquals(await entry.get(), null);
});

Deno.test("list: create で新規エントリを作成しイテレートできる", async () => {
  const repo = new MemoryKvRepo<string>(["list-test"]);
  const list = repo.list();
  const key = await list.create("item1");
  assertNotEquals(key, null);

  const items: string[] = [];
  for await (const e of repo.list()) {
    const v = await e.get();
    if (v) items.push(v);
  }
  assertEquals(items, ["item1"]);
});

Deno.test("list: get で既存エントリを取得できる", async () => {
  const repo = new MemoryKvRepo<string>(["list-test2"]);
  const list = repo.list();
  const key = await list.create("hello");
  assertNotEquals(key, null);

  const entry = list.get(key!);
  assertEquals(await entry.get(), "hello");
});

Deno.test("prefix が異なるリポジトリ間で分離される", async () => {
  const repoA = new MemoryKvRepo<string>(["a"]);
  const repoB = new MemoryKvRepo<string>(["b"]);
  await repoA.entry(["x"]).set("from-a");
  assertEquals(await repoB.entry(["x"]).get(), null);
});
