import Path from "path";
import FS from "fs";
import Util from "util";
import Webpack from "webpack";
import WebpackWriteFilePlugin from "./write-file-plugin";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";
import * as Yarn from "./yarn";

// Turns two arrays into one array of pairs
function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((ai, i) => [ai, b[i]]);
}

// Flattens arrays or tuples one level deep
function flatten(arg: any[]): any[] {
  const res: any[] = [];

  arg.forEach((v) => {
    if (Array.isArray(v)) res.push(...v);
    else res.push(v);
  });

  return res;
}

function filterObject<T>(obj: T, pred: (arg: [string, any]) => boolean) {
  if (!obj) return obj;

  const acc: any = {};
  Object.entries(obj)
    .filter(pred)
    .forEach(([name, val]) => {
      acc[name] = val;
    });

  return acc;
}

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
    dependencies: filterObject(
      packageDef.dependencies,
      ([name, _]) => name in workspace.workspaceDependencies
    ),
  };
}

function makeWorkspaceWebpackConfig(
  currentDir: string,
  workspaceRoot: string,
  workspace: Yarn.WorkspaceInfo,
  packageDef: Yarn.PackageDef
): Webpack.Configuration {
  // Path from the current dir to the entry file of the package
  const entry = Path.resolve(
    Path.relative(currentDir, workspaceRoot),
    workspace.location,
    packageDef.main!
  );

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

  const workspaceBuildConfigs: Webpack.Configuration[] = zip(
    Object.entries(workspaces),
    packageFiles
  )
    // Flatten the tuple [[name, ws], pkg] into [name, ws, pkg]
    .map(flatten)
    // Build all workspaces if none specified, otherwise only build specified
    .filter(([name, ,]) => !workspacesToBuild || name in workspacesToBuild)
    // Don't build workspaces that aren't intended to be bundled
    .filter(([, , pkg]) => pkg.bundle)
    // Transform workspace info and package def into a webpack config
    .map(([, ws, pkg]) =>
      makeWorkspaceWebpackConfig(process.cwd(), workspaceRoot, ws, pkg)
    );

  const baseConfig = {
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
