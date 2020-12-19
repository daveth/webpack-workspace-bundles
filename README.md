# Bundling applications for serverless NodeJS environments with Webpack
## Motivation
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

## Still to come
### Optimisations / Inlining / Tree-Shaking
TODO: Investigate.

### Better output generation (more readable)
TODO: Investigate.

### Webpack declaration files in incorrect places
Generated `*.d.ts` files end up in the workspace's directories instead of where
the `builder` output directory is specified. Is this a `tsconfig.json` issue or
a webpack one?

It seems like the files end up wherever the `compilerOptions.outDir` field of
the workspace's `tsconfig.json` file specifies. Is there a good way to control
this from webpack?

### Separation of build and package
The build step has been split out of the package to be built, but needs to be
parameterised properly since the target is hard-coded.

### Better local testing
Currently the `builder` package is up one level from the yarn workspaces project
that uses it. The `test-project` project references the `builder` package by a
relative path, which unfortunately seems to mean it doesn't transitively install
dependencies of the `builder` package, causing webpack's `ts-loader` to fail.
TODO: Hoist the `ts-loader` dependency out of `builder`? Maybe it shouldn't need
to know about loaders for the entrypoints, and those should be passed by the
project configuration.
