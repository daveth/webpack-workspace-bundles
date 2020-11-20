import Path from "path";
import Webpack from "webpack";
import Yarn from "./yarn";
import genConfig from "./gen-config";

async function run() {
  const workspaceRoot = await Yarn.findWorkspaceRoot();
  if (!workspaceRoot) throw new Error(`Could not find workspace root`);

  const outputDir = Path.resolve(workspaceRoot, "dist");
  const modulesDirs = [Path.resolve(workspaceRoot, "node_modules")];

  const workspaces = await Yarn.getWorkspaces();
  const workspaceNames = Object.keys(workspaces);
  const entryPoints = [
    {
      name: "app",
      main: Path.resolve(
        workspaceRoot,
        "components",
        "app",
        "source",
        "index.ts"
      ),
    },
  ];

  const config = genConfig(entryPoints, outputDir, modulesDirs, workspaceNames);

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
