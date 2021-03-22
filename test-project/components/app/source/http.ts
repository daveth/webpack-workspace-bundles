import Express from "express";

export const app = Express();

app.get("/", (_, res: Express.Response) => {
  res.status(200).type("text/plain").send("!");
});
