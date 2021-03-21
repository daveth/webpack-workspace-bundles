import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";
import { prettyName, makePackageManifest } from "./lib";

async function run() {
  const cwd = YarnFS.npath.toPortablePath(process.cwd());
  const toBuild = process.argv.slice(2);

  const yarnConfig = await Yarn.Configuration.find(cwd, null);
  const { project } = await Yarn.Project.find(yarnConfig, cwd);

  const manifests = project.workspaces
    .filter((ws) => toBuild.includes(prettyName(ws)))
    .map((ws) => makePackageManifest(project, ws));

  console.log(manifests.map((manifest) => manifest.exportTo({})));
}

run().catch(console.error);
