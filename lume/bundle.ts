import { merge } from "lume/core/utils/object.ts";
import { log, warnUntil } from "lume/core/utils/log.ts";
import { bytes } from "lume/core/utils/format.ts";
import { prepareAsset, saveAsset } from "lume/plugins/source_maps.ts";
import type Site from "lume/core/site.ts";

export interface Options {
  /** File extensions to bundle */
  extensions?: string[];

  /**
   * Bundle options
   */
  options?: {
    /** Whether to minify the output */
    minify?: boolean;
    /** Whether to include source maps */
    sourcemap?: boolean;
  };
}

// Default options
export const defaults: Options = {
  extensions: [".ts", ".js", ".tsx", ".jsx"],
  options: {
    minify: true,
    sourcemap: false,
  },
};

/**
 * A plugin to use Deno.bundle in Lume
 */
export default function bundle(userOptions?: Options) {
  const options = merge(defaults, userOptions);

  return (site: Site) => {
    site.process(
      options.extensions,
      async function processBundle(pages, _allPages) {
        const hasPages = warnUntil(
          `[bundle plugin] No ${
            options.extensions.map((e) => e.slice(1).toUpperCase()).join(", ")
          } files found. Use <code>site.add()</code> to add files. For example: <code>site.add("script.js")</code>`,
          pages.length,
        );

        if (!hasPages) {
          return;
        }

        const item = site.debugBar?.buildItem(
          "[bundle plugin] Bundle processing started",
        );

        for (const page of pages) {
          try {
            const { content, filename, enableSourceMap } = prepareAsset(
              site,
              page,
            );

            // Write temporary file for bundling
            const tempFile = filename;
            await Deno.writeTextFile(tempFile, content);

            const bundleOptions = {
              entrypoints: [`file://${tempFile}`],
              format: "esm" as const,
              minify: options.options?.minify,
              outputDir: "/",
              write: false,
            } satisfies Deno.bundle.Options;

            console.log("Bundling with options:", bundleOptions);
            // Bundle the file
            const result = await Deno.bundle(bundleOptions);

            if (!result.success) {
              const errors = result.errors?.map((e) => e.text || String(e))
                .join(", ");
              throw new Error(`Bundle failed: ${errors}`);
            }

            const outputFile = result.outputFiles?.[0];
            if (!outputFile) {
              throw new Error("No output file generated");
            }

            const finalCode = outputFile.text();

            // Save the bundled code
            page.data.url = outputFile.path;
            saveAsset(
              site,
              page,
              finalCode,
              enableSourceMap ? undefined : undefined, // Source maps from Deno.bundle not currently supported
            );

            if (item) {
              item.items ??= [];
              item.items.push({
                title: outputFile.path,
                details: bytes(finalCode.length),
              });
            }
          } catch (error) {
            const message = error instanceof Error
              ? error.message
              : String(error);
            log.error(
              `[bundle plugin] Failed to bundle ${page.sourcePath}: ${message}`,
            );
            throw error;
          }
        }

        if (item) {
          item.title = `[bundle plugin] Bundled ${pages.length} files`;
        }
      },
    );
  };
}
