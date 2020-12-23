import Path from "path";

import Webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import WebpackWriteFilePlugin from "./webpack-write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";

import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

function hasMain(ws: Yarn.Workspace): boolean {
  return ws.manifest.main !== null;
}

export class Compiler {
  public constructor(public readonly project: Yarn.Project) {}

  public get workspaceIdentStrings(): string[] {
    return this.project.workspaces.map((ws) =>
      Yarn.structUtils.stringifyIdent(ws.manifest.name!)
    );
  }

  /*
  private collectWorkspaceDeps(workspace: Workspace): [string, string][] {
    if (!workspace.packageDefinition.dependencies) return [];

    // 1. Break the dependencies dictionary up into an array of [name, version]
    // 2. Map each entry to an array of its child entries:
    //    if workspace -> recursively call this function to get a list of KV pairs
    //    else return an array containing the KV pair
    // 3. Flatten the array of arrays into a single array.
    return Object.entries(workspace.packageDefinition.dependencies)
      .map(([name, version]): [string, string][] => {
        if (workspace.workspaceDependencies.find((e) => e === name)) {
          return this.collectWorkspaceDeps(this.project.workspaces[name]);
        } else return [[name, version]];
      })
      .reduceRight((p, n) => p.concat(n));
  }

  */

  public makeWorkspaceConfig(workspace: Yarn.Workspace): Webpack.Configuration {
    const name = workspace.manifest.name?.name!;
    const entry = YarnFS.ppath.resolve(workspace.cwd, workspace.manifest.main!);

    // Build the new manifest with all transient dependencies included.
    const manifest = new Yarn.Manifest();
    manifest.name = workspace.manifest.name;
    manifest.version = workspace.manifest.version;
    manifest.main = YarnFS.npath.toPortablePath("index.js");

    // TODO: Use Yarn to collect dependencies!

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
    // TODO: Split out what we can and make this be a user config thing?
    // TODO: Can we make it so any extra typescript assets like declaration
    // files or sourcemaps end up in the output bundle?
    const baseConfig: Webpack.Configuration = {
      mode: "production",
      output: {
        path: Path.resolve("dist"),
        filename: "[name]/index.js",
        libraryTarget: "commonjs",
      },
      target: "node",
      module: {
        rules: [
          {
            test: /\.ts$/i,
            use: "ts-loader",
            exclude: /node_modules/,
          },
        ],
      },
      externals: [
        webpackNodeExternals({
          additionalModuleDirs: [Path.resolve("node_modules")],
          allowlist: this.workspaceIdentStrings,
        }),
      ],
      plugins: [new CleanWebpackPlugin()],
    };

    return webpackMerge([
      baseConfig,
      ...this.project.workspaces
        .filter(hasMain)
        .map((ws) => this.makeWorkspaceConfig(ws)),
    ]);
  }
}
