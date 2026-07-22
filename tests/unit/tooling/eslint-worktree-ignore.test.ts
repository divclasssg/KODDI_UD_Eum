import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("ESLint 격리 worktree 계약", () => {
  it("저장소 내부 worktree의 생성물을 검사 대상에서 제외한다", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const generatedFile = path.join(
      process.cwd(),
      ".worktrees/example/.next/server/app.js",
    );

    await expect(eslint.isPathIgnored(generatedFile)).resolves.toBe(true);
  });
});
