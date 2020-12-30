import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

import * as Webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import webpackMerge from "webpack-merge";

import { ConfigGenerator } from "./config-generator";

async function webpackAsync(
  config: Webpack.Configuration
): Promise<Webpack.Stats | undefined> {
  return new Promise((resolve, reject) => {
    Webpack.webpack(config, (err, stats) => {
      if (err) reject(err);
      resolve(stats);
    });
  });
}

// TODO: Split out what we can and make this be a user config thing?
// TODO: Can we make it so any extra typescript assets like declaration
// files or sourcemaps end up in the output bundle?
function baseConfig(cwd: YarnFS.PortablePath): Webpack.Configuration {
  return {
    mode: "production",
    output: {
      path: YarnFS.ppath.join(cwd, YarnFS.npath.toPortablePath("dist")),
      filename: "[name]/index.js",
      libraryTarget: "commonjs",
    },
    target: "node",
    resolve: {
      extensions: [".ts", ".js", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/i,
          use: "ts-loader",
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js", ".json"],
    },
    plugins: [new CleanWebpackPlugin()],
  };
}

async function run() {
  const cwd = YarnFS.npath.toPortablePath(process.cwd());
  const toBuild = process.argv.slice(2);

  const yarnConfig = await Yarn.Configuration.find(cwd, null);
  const { project } = await Yarn.Project.find(yarnConfig, cwd);

  const configGenerator = new ConfigGenerator(project);
  const webpackConfig = webpackMerge([
    baseConfig(cwd),
    configGenerator.makeWebpackConfig(toBuild),
  ]);

  const stats = await webpackAsync(webpackConfig);
  console.log(stats?.toString({ colors: true }));
}

run().catch(console.error);
