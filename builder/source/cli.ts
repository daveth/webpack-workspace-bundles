import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

import * as Webpack from "webpack";
import { Compiler } from "./compiler";

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

async function run() {
  const cwd = YarnFS.npath.toPortablePath(process.cwd());
  const yarnConfig = await Yarn.Configuration.find(cwd, null);
  const { project } = await Yarn.Project.find(yarnConfig, cwd);

  const compiler = new Compiler(project);

  try {
    console.log("Building Webpack Configuration...");
    const config = compiler.makeWebpackConfig();

    console.log("Running webpack...");
    const stats = await webpackAsync(config);
    console.log(stats?.toString({ colors: true }));
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
