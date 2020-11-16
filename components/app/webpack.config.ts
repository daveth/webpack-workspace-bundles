import Path from "path";
import Webpack from "webpack";
import WebpackNodeExternals from "webpack-node-externals";

export default function config(_: any): Webpack.Configuration {
  return {
    entry: { app: Path.resolve(__dirname, "source", "index.ts") },
    output: {
      path: Path.resolve(__dirname, "dist"),
      filename: "[name].js",
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
        additionalModuleDirs: ["../../node_modules"],
        allowlist: ["@daveth/*"]
      }),
    ],
  };
}
