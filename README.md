# Bundling applications for serverless NodeJS environments with Webpack
If you're using Yarn workspaces or other local package/monorepo tools (like
Lerna), then any code existing in separate modules to the one being deployed
won't automatically be bundled up, meaning that at deployment your app will fail
with some reason like `can't find package @my-org/some-dependency`.

One solution to this is to package up all local dependencies by using
`yarn pack` (or `npm pack`), copy them into the deployment staging area, and
adjust the `package.json` to point at these zip files. This gets pretty messy
as you need to find all workspace dependencies of your app, get the directories
they are in, run the bundling command, copy them over, etc, etc.

A better solution is to use some tool like Webpack that can produce
self-contained bundles for you. Webpack already uses Node's module resolution
system to find where the dependencies are in the filesystem and will output them
into the final bundle. To avoid bundling every dependency (even ones that will
be installed at deploy-time in the target environment), the `externals` config
property can be used to only add local workspace dependencies to the bundle.

