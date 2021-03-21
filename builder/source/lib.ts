import * as Yarn from "@yarnpkg/core";
import * as YarnFS from "@yarnpkg/fslib";

class WorkspaceHasNoMainError extends Error {
  public constructor(public readonly workspace: Yarn.Workspace) {
    super(
      `Workspace ${prettyName(
        workspace.manifest.name!
      )} has no 'main' in its manifest`
    );
  }
}

class WorkspaceNotFoundError extends Error {
  public constructor(
    public readonly project: Yarn.Project,
    public readonly candidate: string
  ) {
    super(`Workspace ${candidate} not found in project`);
  }
}

function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return a.map((a, i) => [a, b[i]]);
}

function mapZipSelf<A, B>(a: A[], fn: (a: A) => B): [B, A][] {
  return zip(a.map(fn), a);
}

function flatten<T>(accumulator: T[], current: T[]): T[] {
  return accumulator.concat(current);
}

function prettyName(id: Yarn.Ident): string {
  return Yarn.structUtils.stringifyIdent(id);
}

function isWorkspace(project: Yarn.Project, ident: Yarn.Ident): boolean {
  return project.workspacesByIdent.has(ident.identHash);
}

function notExcludedBy(externals?: string[]): (d: Yarn.Descriptor) => boolean {
  return (descriptor) =>
    !externals || !externals.includes(prettyName(descriptor));
}

function recurse(
  project: Yarn.Project,
  descriptor: Yarn.Descriptor,
  externals?: string[]
): Yarn.Descriptor[] {
  if (isWorkspace(project, descriptor)) {
    const childWorkspace = project.workspacesByIdent.get(descriptor.identHash)!;
    return collect(project, childWorkspace, externals);
  }

  return [descriptor];
}

function collect(
  project: Yarn.Project,
  workspace: Yarn.Workspace,
  externals?: string[]
): Yarn.Descriptor[] {
  return Array.from(workspace.manifest.dependencies.values())
    .filter(notExcludedBy(externals))
    .map((descriptor) => recurse(project, descriptor, externals))
    .reduceRight(flatten, []);
}

function setIfExists<O, K extends keyof O>(obj: O, key: K, prop: any) {
  if (prop) obj[key] = prop;
}

export class FlattenedWorkspaceManifest {
  private readonly internal: Yarn.Manifest = new Yarn.Manifest();

  public constructor(
    public readonly entry: string,
    public readonly externals?: string[],
    template?: Partial<Yarn.Manifest>
  ) {
    if (!template) return;
    setIfExists(this.internal, "name", template.name);
    setIfExists(this.internal, "version", template.version);
    setIfExists(this.internal, "license", template.license);
    setIfExists(this.internal, "dependencies", template.dependencies);
    setIfExists(this.internal, "devDependencies", template.devDependencies);
  }

  public set dependencies(dependencies: Yarn.Descriptor[]) {
    this.internal.dependencies = new Map(
      mapZipSelf(dependencies, (d) => d.identHash)
    );
  }

  public set devDependencies(devDependencies: Yarn.Descriptor[]) {
    this.internal.devDependencies = new Map(
      mapZipSelf(devDependencies, (d) => d.identHash)
    );
  }

  public get manifest(): { [key: string]: any } {
    return this.internal.exportTo({});
  }
}

function resolveMain(workspace: Yarn.Workspace): YarnFS.PortablePath {
  if (!workspace.manifest.main) throw new WorkspaceHasNoMainError(workspace);

  return YarnFS.ppath.relative(
    workspace.project.cwd,
    YarnFS.ppath.resolve(workspace.cwd, workspace.manifest.main)
  );
}

function byName(name: string): (ws: Yarn.Workspace) => boolean {
  return (ws) => !!ws.manifest.name && prettyName(ws.manifest.name) === name;
}

function byPrettyName(name: string): (descriptor: Yarn.Descriptor) => boolean {
  return (descriptor) => prettyName(descriptor) === name;
}

function lookupDependencyIn(
  dependencies: Yarn.Descriptor[]
): (name: string) => Yarn.Descriptor | undefined {
  return (name) => dependencies.find(byPrettyName(name));
}

function lookupWorkspaceIn(
  workspaces: Yarn.Workspace[]
): (name: string) => Yarn.Workspace | undefined {
  return (name) => workspaces.find(byName(name));
}

function exists<T>(o: T | undefined | null): o is T {
  return !!o;
}

function throwError(e: Error): never {
  throw e;
}

function assertExists<T>(
  assertion: () => Error
): (o: T | undefined | null) => o is T {
  return (o): o is T => exists(o) || throwError(assertion());
}

export async function loadWorkspace(options: {
  name: string;
  entry?: string;
  externals?: string[];
}): Promise<FlattenedWorkspaceManifest> {
  // Initialise a Yarn configuration for the current project
  const cwd = YarnFS.npath.toPortablePath(process.cwd());
  const yarnConfig = await Yarn.Configuration.find(cwd, null);
  const { project } = await Yarn.Project.find(yarnConfig, cwd);

  // Look up the requested workspace in the project
  const workspace = project.workspaces.find(byName(options.name));
  if (!workspace) throw new WorkspaceNotFoundError(project, options.name);

  // Map externals from names to workspace descriptors.
  // TODO: Make these pin a version instead of using `workspace:<relpath>`
  const externalsDescriptors = options.externals
    ?.map(lookupWorkspaceIn(project.workspaces))
    .filter(assertExists(() => new WorkspaceNotFoundError(project, "fuck")))
    .map((workspace) => workspace.anchoredDescriptor);

  // Resolve the entry point and collect dependencies
  const entry = options.entry || resolveMain(workspace);
  const dependencies = collect(project, workspace, options?.externals);

  // Build a list of all externals for build tools to exclude.
  // This needs to be the set of packages marked as external by our caller plus
  // any leaf-node dependencies we extracted from traversing our workspaces.
  const externals = dependencies.concat(externalsDescriptors || []);

  const manifest = new FlattenedWorkspaceManifest(
    entry,
    externals.map(prettyName),
    workspace.manifest
  );

  manifest.dependencies = externals;
  manifest.devDependencies = [];

  return manifest;
}
