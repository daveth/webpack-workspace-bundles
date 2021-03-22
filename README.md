# Manyfest
Flatten package manifests for Yarn workspaces into a single composed manifest.

## Motivation
Deploying for NodeJS-based serverless environments requires having a single
bundle to be deployed. These bundles can be produced simply by zipping up the
deployables' source directories, but however if the source directory is a Yarn
workspace then the depended-upon workspaces won't be included with the bundle.
This can lead to deployment failing with `cannot resolve pacakge @org/lib` when
a deployed bundle depends on a local workspace `@org/lib` which wasn't included
in the bundle in this naive bundling process.

Serverless NodeJS environments tend to install dependencies using NPM or Yarn
using an uploaded package manifest, and so to more closely match what these
environments can support for installing dependencies this tool produces a
manifest from a target Yarn workspace that includes all transitive dependencies
of workspaces that are depended upon.
