import Path from "path";
import FS from "fs";
import Util from "util";

const read = Util.promisify(FS.readFile);

import Webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import WebpackWriteFilePlugin from "./webpack-write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";

import * as Misc from "./misc";
import * as Yarn from "./yarn";

function stripWorkspacePackageDef(
  workspace: Yarn.WorkspaceInfo,
  packageDef: Yarn.PackageDef
): Yarn.PackageDef {
  return {
    name: packageDef.name,
    version: packageDef.version,
    dependencies: Misc.filterObject(
      packageDef.dependencies,
      ([name, _]) => !workspace.workspaceDependencies.find((d) => d === name)
    ),
  };
}

class Workspace {
  private constructor(
    public readonly location: string,
    public readonly packageDefinition: Yarn.PackageDef,
    public readonly workspaceDependencies: string[],
    public readonly mismatchedWorkspaceDependencies: string[]
  ) {}

  public static async load(
    workspaceRoot: string,
    workspace: Yarn.WorkspaceInfo
  ): Promise<Workspace> {
    const packageDefinition = await read(
      Path.resolve(workspaceRoot, workspace.location, "package.json")
    )
      .then((content) => content.toString())
      .then(JSON.parse);

    return new Workspace(
      workspace.location,
      packageDefinition,
      workspace.workspaceDependencies,
      workspace.mismatchedWorkspaceDependencies
    );
  }

  public get name(): string {
    return this.packageDefinition.name;
  }

  public get pathSafeName(): string {
    // Remove the "@something/" from the start of the package name.
    // We assume that all package scopes for local workspaces are the same and so
    // therefore there won't be any name conflicts that didn't already exist.
    return this.name.replace(/^@.*\//, "");
  }

  public makeWebpackConfig(workspaceRoot: string): Webpack.Configuration {
    // Build a path to the input source file that webpack will use as the entry
    // point for this bundle.
    const entry = Path.join(
      workspaceRoot,
      this.location,
      this.packageDefinition.main!
    );

    // TODO: Need to merge dependencies of workspace depepencies of this package
    // Keep only package name, version, and non-workspace dependencies
    const strippedPackageDef = stripWorkspacePackageDef(
      this,
      this.packageDefinition
    );

    // Set the package main file to be "index.js" since this is what the compiled
    // bundle will end up being named.
    strippedPackageDef.main = "index.js";

    return {
      entry: { [this.pathSafeName]: entry },
      plugins: [
        new WebpackWriteFilePlugin({
          path: this.pathSafeName,
          name: "package.json",
          content: Buffer.from(JSON.stringify(strippedPackageDef)),
        }),
      ],
    };
  }
}

class Project {
  private constructor(
    public readonly location: string,
    public readonly workspaces: Record<string, Workspace>
  ) {}

  public static async load(): Promise<Project> {
    const workspaceRoot = await Yarn.findWorkspaceRoot();
    if (!workspaceRoot) throw new Error(`Could not find workspace root`);

    const workspaces: Record<string, Workspace> = await Misc.mapObjectAsync(
      Misc.filterObject(
        await Yarn.getWorkspaces(),
        ([name, _]) => name !== "@daveth/builder"
      ),
      async ([, ws]) => await Workspace.load(workspaceRoot, ws)
    );

    return new Project(workspaceRoot, workspaces);
  }

  public makeWebpackConfig(filter?: string[]): Webpack.Configuration {
    const workspaceBuildConfigs = Object.entries(this.workspaces)
      .filter(([name, ,]) => !filter || filter.find((ws) => ws === name))
      .map(([, ws]) => ws.makeWebpackConfig(this.location));

    return webpackMerge(workspaceBuildConfigs);
  }
}

async function run() {
  // Load the project's workspace and package data.
  const project = await Project.load();

  // TODO: These should be parameterisable.
  const outputDir = Path.resolve(project.location, "dist");
  const modulesDirs = [Path.resolve(project.location, "node_modules")];

  const workspaceBuildConfigs = project.makeWebpackConfig();
  const baseConfig: Webpack.Configuration = {
    mode: "production",
    output: {
      path: outputDir,
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
        additionalModuleDirs: modulesDirs,
        allowlist: [...Object.keys(project.workspaces)],
      }),
    ],
    plugins: [new CleanWebpackPlugin()],
  };

  const config = webpackMerge([baseConfig, workspaceBuildConfigs]);

  Webpack(config, (err, stats) => {
    if (err) {
      console.error(err);
      return;
    }

    if (stats) {
      console.log(stats.toString({ colors: true }));
      return;
    }
  });
}

run();
