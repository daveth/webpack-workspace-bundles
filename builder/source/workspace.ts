import Path from "path";
import FS from "fs";
import Util from "util";
import * as Yarn from "./yarn";
const read = Util.promisify(FS.readFile);

export default class Workspace {
  private constructor(
    public readonly location: string,
    public readonly packageDefinition: Yarn.PackageDef,
    public readonly workspaceDependencies: string[],
    public readonly mismatchedWorkspaceDependencies: string[]
  ) {}

  public static async load(
    workspaceRoot: string,
    workspace: Yarn.WorkspaceInfo
  ): Promise<Workspace> {
    const packageDefinition = await read(
      Path.resolve(workspaceRoot, workspace.location, "package.json")
    )
      .then((content) => content.toString())
      .then(JSON.parse);

    return new Workspace(
      workspace.location,
      packageDefinition,
      workspace.workspaceDependencies,
      workspace.mismatchedWorkspaceDependencies
    );
  }

  public get name(): string {
    return this.packageDefinition.name;
  }

  public get pathSafeName(): string {
    // Remove the "@something/" from the start of the package name.
    // We assume that all package scopes for local workspaces are the same and so
    // therefore there won't be any name conflicts that didn't already exist.
    return this.name.replace(/^@.*\//, "");
  }
}
