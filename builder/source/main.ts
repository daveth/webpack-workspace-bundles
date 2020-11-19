import Webpack from "webpack";
import config from "./gen-config";

async function run() {
  const compiler = Webpack(await config());
  compiler.run((err, stats) => {
    if (err) console.error(err);
    if (stats) console.log(stats.toString({ colors: true }));
  });
}

run();
