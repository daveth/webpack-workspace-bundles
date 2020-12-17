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

const webpackAsync = function (
  config: Webpack.Configuration
): Promise<Webpack.Stats> {
  return new Promise((resolve, reject) => {
    Webpack(config, (err, stats) => {
      if (err) reject(err);
      resolve(stats);
    });
  });
};

class Compiler {
  public constructor(public readonly project: Project) {}

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

  public makeWebpackConfig(filter?: string[]): Webpack.Configuration {
    const workspaceBuildConfigs = Object.entries(this.project.workspaces)
      .filter(([name, ,]) => !filter || filter.find((ws) => ws === name))
      .map(([, ws]) => this.makeWorkspaceConfig(ws));

    return webpackMerge(workspaceBuildConfigs);
  }

  public async run(): Promise<Webpack.Stats> {
    // TODO: These should be parameterisable.
    const outputDir = Path.resolve(this.project.location, "dist");
    const modulesDirs = [Path.resolve(this.project.location, "node_modules")];

    const workspaceBuildConfigs = this.makeWebpackConfig();

    // TODO: Split out what we can and make this be a user config thing?
    // TODO: Can we make it so any extra typescript assets like declaration
    // files or sourcemaps end up in the output bundle?
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
          allowlist: [...Object.keys(this.project.workspaces)],
        }),
      ],
      plugins: [new CleanWebpackPlugin()],
    };

    const config = webpackMerge([baseConfig, workspaceBuildConfigs]);
    return webpackAsync(config);
  }
}

async function run() {
  console.log("Reading project workspaces and package definitions...");
  const project = await Project.load();

  for (let [name] of Object.entries(project.workspaces)) {
    console.info(`Loaded workspace ${name}`);
  }

  const compiler = new Compiler(project);

  try {
    console.log("Running webpack...");
    const stats = await compiler.run();

    console.log("Webpack Output:");
    console.log(stats.toString({ colors: true }));
  } catch (err) {
    console.error(err);
  }
}

run();
