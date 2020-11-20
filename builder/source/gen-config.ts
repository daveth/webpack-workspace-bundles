import Webpack from "webpack";
import webpackNodeExternals from "webpack-node-externals";
import webpackMerge from "webpack-merge";

export interface EntryPoint {
  readonly name: string;
  readonly main: string;
}

export default function genConfig(
  entryPoints: EntryPoint[],
  outputDir: string,
  modulesDirs: string[],
  workspaceNames: string[]
): Webpack.Configuration {
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
        allowlist: [...workspaceNames],
      }),
    ],
  };

  const entries: Webpack.Configuration[] = entryPoints.map((ep) => ({
    entry: { [ep.name]: ep.main },
  }));

  return webpackMerge([baseConfig, ...entries]);
}
