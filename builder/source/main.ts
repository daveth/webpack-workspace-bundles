import Path from "path";
import Webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import WebpackWriteFilePlugin from "./webpack-write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";
import Workspace from "./workspace";
import Project from "./project";
import * as Yarn from "./yarn";
import * as Misc from "./misc";

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

function makeWorkspaceConfig(
  workspaceRoot: string,
  workspace: Workspace
): Webpack.Configuration {
  // Build a path to the input source file that webpack will use as the entry
  // point for this bundle.
  const entry = Path.join(
    workspaceRoot,
    workspace.location,
    workspace.packageDefinition.main!
  );

  // TODO: Need to merge dependencies of workspace depepencies of this package
  // Keep only package name, version, and non-workspace dependencies
  const strippedPackageDef = stripWorkspacePackageDef(
    workspace,
    workspace.packageDefinition
  );

  // Set the package main file to be "index.js" since this is what the compiled
  // bundle will end up being named.
  strippedPackageDef.main = "index.js";

  return {
    entry: { [workspace.pathSafeName]: entry },
    plugins: [
      new WebpackWriteFilePlugin({
        path: workspace.pathSafeName,
        name: "package.json",
        content: Buffer.from(JSON.stringify(strippedPackageDef)),
      }),
    ],
  };
}

function makeProjectConfig(
  project: Project,
  filter?: string[]
): Webpack.Configuration {
  const workspaceBuildConfigs = Object.entries(project.workspaces)
    .filter(([name, ,]) => !filter || filter.find((ws) => ws === name))
    .map(([, ws]) => makeWorkspaceConfig(project.location, ws));

  return webpackMerge(workspaceBuildConfigs);
}

async function run() {
  // Load the project's workspace and package data.
  const project = await Project.load();

  // TODO: These should be parameterisable.
  const outputDir = Path.resolve(project.location, "dist");
  const modulesDirs = [Path.resolve(project.location, "node_modules")];

  const workspaceBuildConfigs = makeProjectConfig(project);
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
