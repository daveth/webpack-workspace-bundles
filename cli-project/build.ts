import * as fs from "fs";
import * as esbuild from "esbuild";
import * as daveth from "@daveth/builder";

async function build() {
  const app = await daveth.loadWorkspace({ name: "@daveth/app" });

  await esbuild.build({
    entryPoints: [app.entry],
    bundle: true,
    outdir: "dist",
    platform: "node",
    external: app.externals,
  });

  await fs.promises.writeFile(
    "dist/package.json",
    JSON.stringify(app.manifest)
  );
}

build().catch(console.error);
