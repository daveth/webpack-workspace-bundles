import Path from "path";

import Webpack from "webpack";
import WebpackWriteFilePlugin from "./webpack-write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";

import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

function hasMain(ws: Yarn.Workspace): boolean {
  return ws.manifest.main !== null;
}

function unique<T>(value: T, index: number, array: T[]): boolean {
  return array.indexOf(value) === index;
}

type DependencyMap = Map<Yarn.IdentHash, Yarn.Descriptor>;
type DependencyPair = [Yarn.IdentHash, Yarn.Descriptor];

export class ConfigGenerator {
  public constructor(public readonly project: Yarn.Project) {}

  public get workspaceIdentStrings(): string[] {
    return this.project.workspaces.map((ws) =>
      Yarn.structUtils.stringifyIdent(ws.manifest.name!)
    );
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

  public makeWorkspaceConfig(workspace: Yarn.Workspace): Webpack.Configuration {
    const name = workspace.manifest.name?.name!;
    const entry = YarnFS.ppath.resolve(workspace.cwd, workspace.manifest.main!);

    // Build the new manifest with all transitive dependencies included.
    const manifest = new Yarn.Manifest();
    manifest.name = workspace.manifest.name;
    manifest.version = workspace.manifest.version;
    manifest.main = YarnFS.npath.toPortablePath("index.js");
    manifest.dependencies = this.transitiveDependencies(workspace);

    return {
      entry: { [name]: entry },
      plugins: [
        new WebpackWriteFilePlugin({
          path: name,
          name: "package.json",
          content: Buffer.from(JSON.stringify(manifest.exportTo({}))),
        }),
      ],
    };
  }

  public makeWebpackConfig(): Webpack.Configuration {
    const workspaceConfigs = this.project.workspaces
      .filter(hasMain)
      .map((ws) => this.makeWorkspaceConfig(ws));

    return webpackMerge([
      // TODO: Cleaner way of handling externals? Per-entry basis?
      {
        externals: [
          webpackNodeExternals({
            additionalModuleDirs: [Path.resolve("node_modules")],
            allowlist: this.workspaceIdentStrings,
          }),
        ],
      },
      ...workspaceConfigs,
    ]);
  }
}
