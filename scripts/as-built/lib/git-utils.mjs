import { execSync } from "node:child_process";

export function runGit(root, cmd) {
  try {
    return execSync(cmd, {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString("utf8")
      .trim();
  } catch {
    return "—";
  }
}

export function getGitContext(root) {
  return {
    branch: runGit(root, "git rev-parse --abbrev-ref HEAD"),
    head: runGit(root, "git rev-parse HEAD"),
    status: runGit(root, "git status --porcelain"),
    log: runGit(root, "git log -n 20 --oneline"),
    diffStat: runGit(root, "git diff --stat"),
  };
}
