import Webpack from "webpack";
import Project from "./project";
import Compiler from "./compiler";

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

async function run() {
  console.log("Reading project workspaces and package definitions...");
  const project = await Project.load();

  for (let [name] of Object.entries(project.workspaces)) {
    console.info(`Loaded workspace ${name}`);
  }

  const compiler = new Compiler(project);

  try {
    console.log("Building Webpack Configuration...");
    const config = compiler.makeWebpackConfig();

    console.log("Running webpack...");
    const stats = await webpackAsync(config);

    console.log("Webpack Output:");
    console.log(stats?.toString({ colors: true }));
  } catch (err) {
    console.error(err);
  }
}

run();
