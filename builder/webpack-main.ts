import Path from "path";
import Webpack from "webpack";
import WebpackNodeExternals from "webpack-node-externals";
import Yarn from "./yarn";
import webpackMerge from "webpack-merge";

export default async function config(_: any): Promise<Webpack.Configuration> {
  const workspaceRoot = await Yarn.findWorkspaceRoot();
  if (!workspaceRoot) throw new Error("Could not find workspace root");

  const workspaces = await Yarn.getWorkspaces();
  const workspaceNames = Object.keys(workspaces);

  const outputDir = Path.resolve(workspaceRoot, "dist");

  const baseConfig: Webpack.Configuration = {
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
