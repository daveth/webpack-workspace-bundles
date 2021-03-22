import { loadWorkspace } from "./lib";

async function run() {
  const toBuild = process.argv[2];
  const workspace = await loadWorkspace({ name: toBuild });
  const manifest = workspace.manifest;
  console.log(manifest);
}

run().catch(console.error);
