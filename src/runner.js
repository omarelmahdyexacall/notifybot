import { spawn, execSync } from "node:child_process";

function killProcess(child) {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Process may have already exited
    }
  } else {
    child.kill("SIGTERM");
  }
}

export function runCommand(command, { onStart } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let killed = false;

    const child = spawn(command, {
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    });

    if (onStart) {
      onStart(() => {
        killed = true;
        killProcess(child);
      });
    }

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        killed,
      });
    });
  });
}
