import FS from "fs";
import Path from "path";
import Util from "util";

import Webpack from "webpack";
import Project from "./project";
import { Compiler, CompilerOptions } from "./compiler";

async function webpackAsync(
  config: Webpack.Configuration
): Promise<Webpack.Stats | undefined> {
  return new Promise((resolve, reject) => {
    Webpack(config, (err, stats) => {
      if (err) reject(err);
      resolve(stats);
    });
  });
}

const read = Util.promisify(FS.readFile);

async function loadUserConfig(project: Project): Promise<CompilerOptions> {
  const raw = await read(Path.join(project.location, "daveth-build.json"))
    .then((buf) => buf.toString())
    .then(JSON.parse);

  return {
    outputDir: Path.resolve(raw.outputDir),
    modulesDirs: [Path.resolve(project.location, "node_modules")],
    workspaces: raw.workspaces,
    target: raw.target,
    libraryTarget: raw.libraryTarget,
  };
}

async function run() {
  console.log("Reading project workspaces and package definitions...");
  const project = await Project.load();

  const userConfig = await loadUserConfig(project);
  const compiler = new Compiler(project, userConfig);

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

run();
