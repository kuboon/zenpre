if (typeof WorkerGlobalScope === "undefined") {
  const worker = new Worker(import.meta.url, { type: "module" });
  worker.onmessage = () => Deno.exit();
  await new Promise<void>(() => {});
}

console.log("In worker thread");
await Deno.bundle({
  entrypoints: [import.meta.url],
});
postMessage("done");
