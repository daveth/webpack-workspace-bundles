import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

function unique<T>(value: T, index: number, array: T[]): boolean {
  return array.indexOf(value) === index;
}

function prettyName(ws: Yarn.Workspace): string {
  if (!ws.manifest.name) return "[unnamed workspace]";
  return Yarn.structUtils.stringifyIdent(ws.manifest.name);
}

type DependencyMap = Map<Yarn.IdentHash, Yarn.Descriptor>;
type DependencyPair = [Yarn.IdentHash, Yarn.Descriptor];

// TODO: Handle circular dependencies between workspaces
function collectDependencies(
  project: Yarn.Project,
  workspace: Yarn.Workspace
): DependencyPair[] {
  return Array.from(workspace.manifest.dependencies)
    .map(([ident, desc]): DependencyPair[] => {
      const ws = project.workspacesByIdent.get(ident);
      return ws ? collectDependencies(project, ws) : [[ident, desc]];
    })
    .reduceRight((collected, deps) => collected.concat(deps), []);
}

// TODO: Check version conflicts
function transitiveDependencies(
  project: Yarn.Project,
  workspace: Yarn.Workspace
): DependencyMap {
  return new Map(collectDependencies(project, workspace).filter(unique));
}

function makePackageManifest(
  project: Yarn.Project,
  workspace: Yarn.Workspace
): Yarn.Manifest {
  const manifest = new Yarn.Manifest();
  manifest.name = workspace.manifest.name;
  manifest.version = workspace.manifest.version;
  manifest.main = YarnFS.npath.toPortablePath("index.js");
  manifest.dependencies = transitiveDependencies(project, workspace);

  return manifest;
}

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
