import { describe, expect, it, vi } from "vitest";

import { hasMedicalInterviewDatabase } from "@/lib/db/database-presence";

describe("database presence", () => {
  it("databases API가 없으면 database를 열지 않고 false를 반환한다", async () => {
    const factory = { open: vi.fn() } as unknown as IDBFactory;

    await expect(hasMedicalInterviewDatabase(factory)).resolves.toBe(false);
    expect(factory.open).not.toHaveBeenCalled();
  });

  it("정확한 v1 database 이름만 찾는다", async () => {
    const factory = {
      databases: vi.fn().mockResolvedValue([
        { name: "다른-database", version: 1 },
        { name: "koddi-ud-eum", version: 1 },
      ]),
    } as unknown as IDBFactory;

    await expect(hasMedicalInterviewDatabase(factory)).resolves.toBe(true);
  });

  it("더 높은 version도 기존 database로 인식해 오류 복구 경로로 보낸다", async () => {
    const factory = {
      databases: vi.fn().mockResolvedValue([
        { name: "koddi-ud-eum", version: 2 },
      ]),
    } as unknown as IDBFactory;

    await expect(hasMedicalInterviewDatabase(factory)).resolves.toBe(true);
  });
});
