import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

import { ManifestGenerator } from "./config-generator";

function prettyName(ws: Yarn.Workspace): string {
  if (!ws.manifest.name) return "[unnamed workspace]";
  return Yarn.structUtils.stringifyIdent(ws.manifest.name);
}

async function run() {
  const cwd = YarnFS.npath.toPortablePath(process.cwd());
  const toBuild = process.argv.slice(2);

  const yarnConfig = await Yarn.Configuration.find(cwd, null);
  const { project } = await Yarn.Project.find(yarnConfig, cwd);

  const workspaces = project.workspaces.filter((ws) =>
    toBuild.includes(prettyName(ws))
  );

  const manifestGenerator = new ManifestGenerator(project);
  const manifests = workspaces.map((ws) =>
    manifestGenerator.makePackageManifest(ws)
  );

  console.log(manifests.map((manifest) => manifest.exportTo({})));
}

run().catch(console.error);
