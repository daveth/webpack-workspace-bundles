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
  workspaceRoot: string,
  workspace: Yarn.WorkspaceInfo
): Promise<Yarn.PackageDef> {
  const read = Util.promisify(FS.readFile);

  return read(Path.resolve(workspaceRoot, workspace.location, "package.json"))
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

async function run() {
  const workspaceRoot = await Yarn.findWorkspaceRoot();
  if (!workspaceRoot) throw new Error(`Could not find workspace root`);

  // TODO: These should be parameterisable.
  const workspacesToBuild: string[] | undefined = undefined;
  const outputDir = Path.resolve(workspaceRoot, "dist");
  const modulesDirs = [Path.resolve(workspaceRoot, "node_modules")];

  const workspaces = await Yarn.getWorkspaces();
  const packageFiles = await Promise.all(
    Object.values(workspaces).map((ws) =>
      getWorkspacePackageDef(workspaceRoot, ws)
    )
  );

  // 1. Zip workspace [name, info] with corresponding package defs
  // 2. Flatten the tuple [[name, ws], pkg] into [name, ws, pkg]
  // 3. Keep only workspaces we want to build
  // 4. Filter out packages that have a falsey 'bundle' value
  // 5. Transform workspace info and package def into a webpack config

  const workspaceBuildConfigs: Webpack.Configuration[] = Misc.zip(
    Object.entries(workspaces),
    packageFiles
  )
    .map(Misc.flatten)
    .filter(([name, ,]) => !workspacesToBuild || name in workspacesToBuild)
    .filter(([, , pkg]) => pkg.bundle)
    .map(([, ws, pkg]) => makeWorkspaceWebpackConfig(workspaceRoot, ws, pkg));

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
        allowlist: [...Object.keys(workspaces)],
      }),
    ],
    plugins: [new CleanWebpackPlugin()],
  };

  const config = webpackMerge([baseConfig, ...workspaceBuildConfigs]);

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
