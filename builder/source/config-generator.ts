import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

function unique<T>(value: T, index: number, array: T[]): boolean {
  return array.indexOf(value) === index;
}

function prettyName(ws: Yarn.Workspace): string {
  return Yarn.structUtils.stringifyIdent(ws.manifest.name!);
}

type DependencyMap = Map<Yarn.IdentHash, Yarn.Descriptor>;
type DependencyPair = [Yarn.IdentHash, Yarn.Descriptor];

export class ManifestGenerator {
  public constructor(public readonly project: Yarn.Project) {}

  public get workspaceIdentStrings(): string[] {
    return this.project.workspaces
      .filter((ws) => ws.manifest.name && true)
      .map(prettyName);
  }

  private collectDependencies(workspace: Yarn.Workspace): DependencyPair[] {
    // TODO: Handle circular dependencies between workspaces?
    return Array.from(workspace.manifest.dependencies)
      .map(([ident, desc]): DependencyPair[] => {
        const ws = this.project.workspacesByIdent.get(ident);
        return ws ? this.collectDependencies(ws) : [[ident, desc]];
      })
      .reduceRight((collected, deps) => collected.concat(deps), []);
  }

  private transitiveDependencies(workspace: Yarn.Workspace): DependencyMap {
    // TODO: Check version conflicts?
    return new Map(this.collectDependencies(workspace).filter(unique));
  }

  public makePackageManifest(workspace: Yarn.Workspace): Yarn.Manifest {
    const manifest = new Yarn.Manifest();
    manifest.name = workspace.manifest.name;
    manifest.version = workspace.manifest.version;
    manifest.main = YarnFS.npath.toPortablePath("index.js");
    manifest.dependencies = this.transitiveDependencies(workspace);

    return manifest;
  }
}
