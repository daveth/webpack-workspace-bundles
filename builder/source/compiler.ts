import Path from "path";

import Webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import WebpackWriteFilePlugin from "./webpack-write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";

import Project from "./project";
import Workspace from "./workspace";
import * as Yarn from "./yarn";
import * as Misc from "./misc";

export interface CompilerOptions {
  outputDir: string;
  target: string;
  libraryTarget: string;
  modulesDirs: string[];
  workspaces?: string[];
}

export class Compiler {
  public constructor(
    public readonly project: Project,
    public readonly options?: CompilerOptions
  ) {}

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

  private makeDependenciesObject(workspace: Workspace): Record<string, string> {
    return this.collectWorkspaceDeps(workspace).reduceRight(
      (deps, [name, version]) => {
        if (deps[name])
          console.warn(`Dependency ${name}@${version} already included`);
        return Misc.addEntryToObject(deps, [name, version]);
      },
      {} as Record<string, string>
    );
  }

  private makeWorkspaceConfig(workspace: Workspace): Webpack.Configuration {
    if (!workspace.packageDefinition.main) {
      throw new Error(
        `Cannot bundle workspace ${workspace.name}, no 'main' field in package.json`
      );
    }

    // Build a path to the input source file that webpack will use as the entry
    // point for this bundle.
    const entry = Path.join(
      this.project.location,
      workspace.location,
      workspace.packageDefinition.main
    );

    // Build the new package definition with all transient dependencies included
    const packageDefinition: Yarn.PackageDef = {
      name: workspace.packageDefinition.name,
      version: workspace.packageDefinition.version,
      main: "index.js",
      dependencies: this.makeDependenciesObject(workspace),
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

  public makeWebpackConfig(): Webpack.Configuration {
    const workspacesToBuild = this.options?.workspaces;
    const workspaceBuildConfigs = Object.entries(this.project.workspaces)
      .filter(
        ([name, ,]) =>
          !workspacesToBuild || workspacesToBuild.find((ws) => ws === name)
      )
      .map(([, ws]) => this.makeWorkspaceConfig(ws));

    // TODO: Split out what we can and make this be a user config thing?
    // TODO: Can we make it so any extra typescript assets like declaration
    // files or sourcemaps end up in the output bundle?
    const baseConfig: Webpack.Configuration = {
      mode: "production",
      output: {
        path: this.options!.outputDir,
        filename: "[name]/index.js",
        libraryTarget: this.options?.libraryTarget || "commonjs",
      },
      target: this.options?.target || "node",
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
          additionalModuleDirs: this.options!.modulesDirs,
          allowlist: [...Object.keys(this.project.workspaces)],
        }),
      ],
      plugins: [new CleanWebpackPlugin()],
    };

    return webpackMerge([baseConfig, ...workspaceBuildConfigs]);
  }
}

export default Compiler;
