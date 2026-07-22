import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  loadRootDestination,
  RootGate,
} from "@/features/onboarding/root-gate";

describe("RootGate", () => {
  it("기존 database의 동의나 프로필이 불완전하면 복구 상태를 반환한다", async () => {
    await expect(
      loadRootDestination({
        hasDatabase: () => Promise.resolve(true),
        loadHome: () => Promise.resolve({ status: "missing" }),
      }),
    ).resolves.toBe("recovery");
  });

  it("database가 없으면 온보딩으로 이동한다", async () => {
    const navigate = vi.fn();
    render(
      <RootGate
        loadDestination={() => Promise.resolve("onboarding")}
        navigate={navigate}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "저장된 정보를 확인하고 있어요.",
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/onboarding"));
  });

  it("부분 저장이나 읽기 실패는 복구 화면을 제공한다", async () => {
    const navigate = vi.fn();
    render(
      <RootGate
        loadDestination={() => Promise.resolve("recovery")}
        navigate={navigate}
      />,
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("저장된 정보를 확인하지 못했어요.");
    expect(screen.getByRole("button", { name: "다시 확인하기" })).toBeVisible();
    screen.getByRole("button", { name: "온보딩 다시 시작하기" }).click();
    expect(navigate).toHaveBeenCalledWith("/onboarding");
  });
});
