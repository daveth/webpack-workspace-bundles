import ChildProcess from "child_process";
export { default as findWorkspaceRoot } from "find-workspace-root";

export interface WorkspaceInfo {
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
}

export interface PackageDef {
  name: string;
  version: string;
  author?: string;
  main?: string;
  types?: string;
  bundle?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = ChildProcess.spawn("yarn", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    proc.on("error", () => reject(stderr));
    proc.on("exit", () => resolve(stdout));
  });
}

export async function getWorkspaces(): Promise<Record<string, WorkspaceInfo>> {
  return run(["--silent", "workspaces", "info"]).then(JSON.parse);
}
