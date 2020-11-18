import Path from "path";
import ChildProcess from "child_process";
import Webpack from "webpack";
import WebpackNodeExternals from "webpack-node-externals";
import findWorkspaceRoot from "find-workspace-root";
import webpackMerge from "webpack-merge";

async function yarn(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = ChildProcess.spawn("yarn", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    proc.on("error", () => reject(stderr));
    proc.on("exit", () => resolve(stdout));
  });
}

interface WorkspaceInfo {
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
}

async function getWorkspaces(): Promise<Record<string, WorkspaceInfo>> {
  return yarn(["--silent", "workspaces", "info"]).then(JSON.parse);
}

export default async function config(_: any): Promise<Webpack.Configuration> {
  const workspaceRoot = await findWorkspaceRoot();
  if (!workspaceRoot) throw new Error("Could not find workspace root");

  const workspaces = await getWorkspaces();
  const workspaceNames = Object.keys(workspaces);

  const baseConfig: Webpack.Configuration = {
    output: {
      path: Path.resolve(__dirname, "dist"),
      filename: "[name].js",
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
      WebpackNodeExternals({
        additionalModuleDirs: [Path.resolve(workspaceRoot, "node_modules")],
        allowlist: [...workspaceNames],
      }),
    ],
  };

  const entries: Webpack.Configuration[] = [
    {
      entry: {
        app: Path.resolve(
          workspaceRoot,
          "components",
          "app",
          "source",
          "index.ts"
        ),
      },
    },
  ];

  return webpackMerge(baseConfig, ...entries);
}
