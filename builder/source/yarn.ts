import ChildProcess from "child_process";
import findWorkspaceRoot from "find-workspace-root";

async function run(args: string[]): Promise<string> {
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

interface WorkspaceInfo {
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
}

async function getWorkspaces(): Promise<Record<string, WorkspaceInfo>> {
  return run(["--silent", "workspaces", "info"]).then(JSON.parse);
}

export default {
  run,
  getWorkspaces,
  findWorkspaceRoot,
};
