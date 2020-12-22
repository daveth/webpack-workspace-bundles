import Express from "express";
import * as Foo from "@daveth/foo";
import * as Bar from "@daveth/bar";

export function run() {
  Foo.hello();
  Bar.hello();
}

export const app = Express();
app.get("/", (_, res: Express.Response) => {
  res.status(200).type("text/plain").send("!");
});
