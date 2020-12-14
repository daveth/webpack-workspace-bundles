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

function stripWorkspacePackageDef(workspace: Workspace): Yarn.PackageDef {
  return {
    name: workspace.packageDefinition.name,
    version: workspace.packageDefinition.version,
    dependencies: Misc.filterObject(
      workspace.packageDefinition.dependencies,
      ([name, _]) => !workspace.workspaceDependencies.find((d) => d === name)
    ),
  };
}

function collectWorkspaceDeps(
  project: Project,
  workspace: Workspace
): [string, string][] {
  if (!workspace.packageDefinition.dependencies) return [];

  return Object.entries(workspace.packageDefinition.dependencies)
    .map(([name, val]): [string, string][] => {
      if (workspace.workspaceDependencies.find((e) => e === name)) {
        return collectWorkspaceDeps(project, project.workspaces[name]);
      } else return [[name, val]];
    })
    .reduce((p, n) => p.concat(n));
}

function makeDependenciesObject(project: Project, workspace: Workspace) {
  if (!workspace.packageDefinition.dependencies) return undefined;
  // TODO: Check for conflicts and resolve versions
  return Misc.fromEntries(collectWorkspaceDeps(project, workspace));
}

function makeWorkspaceConfig(
  project: Project,
  workspace: Workspace
): Webpack.Configuration {
  // Build a path to the input source file that webpack will use as the entry
  // point for this bundle.
  const entry = Path.join(
    project.location,
    workspace.location,
    workspace.packageDefinition.main!
  );

  // Build the new package definition with all transient dependencies included
  const packageDefinition: Yarn.PackageDef = {
    name: workspace.packageDefinition.name,
    version: workspace.packageDefinition.version,
    main: "index.js",
    dependencies: makeDependenciesObject(project, workspace),
  };

  return {
    entry: { [workspace.pathSafeName]: entry },
    plugins: [
      new WebpackWriteFilePlugin({
        path: workspace.pathSafeName,
        name: "package.json",
        content: Buffer.from(JSON.stringify(packageDefinition)),
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
    .map(([, ws]) => makeWorkspaceConfig(project, ws));

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
