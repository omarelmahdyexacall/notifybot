import { describe, it, expect } from "vitest";
import { runCommand } from "../src/runner.js";

describe("runCommand", () => {
  it("captures stdout and exit code 0 for a successful command", async () => {
    const result = await runCommand("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("captures stderr and non-zero exit code for a failing command", async () => {
    const result = await runCommand("node -e \"process.stderr.write('err'); process.exit(1)\"");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("err");
  });

  it("returns the kill function that terminates the process", async () => {
    let killFn;
    const promise = runCommand("node -e \"setTimeout(() => {}, 30000)\"", {
      onStart: (kill) => { killFn = kill; },
    });
    setTimeout(() => killFn(), 100);
    const result = await promise;
    expect(result.exitCode).not.toBe(0);
    expect(result.killed).toBe(true);
  });
});
