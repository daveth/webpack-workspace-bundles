import Workspace from "./workspace";
import * as Yarn from "./yarn";
import * as Misc from "./misc";

export default class Project {
  private constructor(
    public readonly location: string,
    public readonly workspaces: Record<string, Workspace>
  ) {}

  public static async load(): Promise<Project> {
    const workspaceRoot = await Yarn.findWorkspaceRoot();
    if (!workspaceRoot) throw new Error(`Could not find workspace root`);

    const workspaces: Record<string, Workspace> = await Misc.mapObjectAsync(
      Misc.filterObject(
        await Yarn.getWorkspaces(),
        ([name, _]) => name !== "@daveth/builder"
      ),
      async ([, ws]) => await Workspace.load(workspaceRoot, ws)
    );

    return new Project(workspaceRoot, workspaces);
  }
}
