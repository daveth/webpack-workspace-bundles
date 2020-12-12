import Path from "path";
import FS from "fs";
import Util from "util";

import Webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import WebpackWriteFilePlugin from "./webpack-write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";

import * as Misc from "./misc";
import * as Yarn from "./yarn";

async function getWorkspacePackageDef(
  rootPath: string,
  workspace: Yarn.WorkspaceInfo
): Promise<Yarn.PackageDef> {
  const read = Util.promisify(FS.readFile);
  return read(Path.resolve(rootPath, workspace.location, "package.json"))
    .then((content) => content.toString())
    .then(JSON.parse);
}

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

function makeWorkspaceWebpackConfig(
  workspaceRoot: string,
  workspace: Yarn.WorkspaceInfo,
  packageDef: Yarn.PackageDef
): Webpack.Configuration {
  // Build a path to the input source file that webpack will use as the entry
  // point for this bundle.
  const entry = Path.join(workspaceRoot, workspace.location, packageDef.main!);

  // Remove the "@something/" from the start of the package name.
  // We assume that all package scopes for local workspaces are the same and so
  // therefore there won't be any name conflicts that didn't already exist.
  const safePkgName = packageDef.name.replace(/^@.*\//, "");

  // TODO: Need to merge dependencies of workspace depepencies of this package
  // Keep only package name, version, and non-workspace dependencies
  const strippedPackageDef = stripWorkspacePackageDef(workspace, packageDef);

  // Set the package main file to be "index.js" since this is what the compiled
  // bundle will end up being named.
  strippedPackageDef.main = "index.js";

  return {
    entry: { [safePkgName]: entry },
    plugins: [
      new WebpackWriteFilePlugin({
        path: safePkgName,
        name: "package.json",
        content: Buffer.from(JSON.stringify(strippedPackageDef)),
      }),
    ],
  };
}

interface Workspace {
  location: string;
  packageDefinition: Yarn.PackageDef;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
}

class Project {
  private constructor(
    public readonly location: string,
    public readonly workspaces: Record<string, Workspace>
  ) {}

  public static async load(): Promise<Project> {
    const workspaceRoot = await Yarn.findWorkspaceRoot();
    if (!workspaceRoot) throw new Error(`Could not find workspace root`);

    const rawWorkspaces = await Yarn.getWorkspaces();
    const packageDefs = await Promise.all(
      Object.values(rawWorkspaces).map((ws) =>
        getWorkspacePackageDef(workspaceRoot, ws)
      )
    );

    // take workspaces and package defs
    // build object like { [name]: { ...workspace, packageDefinition: pkg } }
    const workspaces: Record<string, Workspace> = {};
    Misc.zip(Object.entries(rawWorkspaces), packageDefs)
      .map(Misc.flatten)
      .forEach(([name, ws, pkg]) => {
        workspaces[name] = {
          ...ws,
          packageDefinition: pkg,
        };
      });

    return new Project(workspaceRoot, workspaces);
  }

  public makeWebpackConfig(filter?: string[]): Webpack.Configuration {
    const workspaceBuildConfigs = Object.entries(this.workspaces)
      .filter(([name, ,]) => !filter || filter.find((ws) => ws === name))
      .filter(([, ws]) => ws.packageDefinition.bundle)
      .map(([, ws]) =>
        makeWorkspaceWebpackConfig(this.location, ws, ws.packageDefinition)
      );

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
