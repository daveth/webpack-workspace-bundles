import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

function unique<T>(value: T, index: number, array: T[]): boolean {
  return array.indexOf(value) === index;
}

export function prettyName(ws: Yarn.Workspace): string {
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

export function makePackageManifest(
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
