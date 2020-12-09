import Path from "path";
import FS from "fs";
import Util from "util";
import Webpack from "webpack";
import Yarn from "./yarn";
import genConfig from "./gen-config";

const read = Util.promisify(FS.readFile);

function unscopePackageName(name: string): string {
  return name.replace(/^@.*\//, "");
}

function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((k, i) => [k, b[i]]);
}

async function run() {
  const workspaceRoot = await Yarn.findWorkspaceRoot();
  if (!workspaceRoot) throw new Error(`Could not find workspace root`);

  // TODO: These should be parameterisable.
  const outputDir = Path.resolve(workspaceRoot, "dist");
  const modulesDirs = [Path.resolve(workspaceRoot, "node_modules")];

  const workspaces = await Yarn.getWorkspaces();

  // Read all workspace package.json files and filter by the ones we can bundle.
  const packageFiles = await Promise.all(
    Object.values(workspaces)
      .map((ws) => Path.resolve(workspaceRoot, ws.location, "package.json"))
      .map((path) => read(path).then((pkg) => JSON.parse(pkg.toString())))
  ).then((packages) => packages.filter((pkg) => pkg.bundle));

  // Get the names and locations of the workspaces we are interested in.
  const names = packageFiles.map((pkg) => pkg.name);
  const locations = names.map((name) => workspaces[name].location);

  // Relative path from the current working directory to the workspace root.
  const fromHereToRoot = Path.relative(process.cwd(), workspaceRoot);

  // Build paths relative from the current working directory to each package's
  // main file.
  const mainPaths = zip(
    locations,
    packageFiles.map((pkg) => pkg.main)
  ).map(([loc, main]) => Path.join(fromHereToRoot, loc, main));

  // Transform these into entry point objects for the webpack config.
  const entryPoints = zip(names, mainPaths).map(([name, main]) => ({
    name: unscopePackageName(name),
    main,
  }));

  // Finally, assemble this information into a webpack config and run the build.
  const config = genConfig(entryPoints, outputDir, modulesDirs, names);

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
