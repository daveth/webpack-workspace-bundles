import { promises as fs } from "fs";
import * as esbuild from "esbuild";
import * as manyfest from "@daveth/manyfest";

async function build() {
  const app = await manyfest.loadWorkspace({ name: "@daveth/app" });

  console.log({
    entry: app.entry,
    externals: app.externals,
    manifest: app.manifest,
  });

  await esbuild.build({
    entryPoints: [app.entry],
    bundle: true,
    outdir: "dist",
    platform: "node",
    external: app.externals,
  });

  await fs.writeFile("dist/package.json", JSON.stringify(app.manifest));
}

build().catch(console.error);
