import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeScreen } from "@/features/home/home-screen";

describe("HomeScreen", () => {
  it("AI 전송 거부 상태에서는 수동 문진을 기본 행동으로 표시한다", async () => {
    render(
      <HomeScreen
        loadState={() =>
          Promise.resolve({
            status: "ready",
            displayName: "테스트 사용자",
            aiTransfer: "declined",
          })
        }
        navigate={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "테스트 사용자님, 안녕하세요",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /수동 문진 시작하기/ }),
    ).toBeVisible();
    expect(screen.getByText("외부 AI로 정보를 보내지 않아요.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /AI 문진 시작하기/ }),
    ).not.toBeInTheDocument();
  });

  it("AI 전송 동의 상태에서는 두 문진 방식을 구분한다", async () => {
    render(
      <HomeScreen
        loadState={() =>
          Promise.resolve({
            status: "ready",
            displayName: "테스트 사용자",
            aiTransfer: "granted",
          })
        }
        navigate={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: /AI 문진 시작하기/ }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: /수동 문진 시작하기/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("동의나 프로필이 없으면 온보딩으로 복구한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() => Promise.resolve({ status: "missing" })}
        navigate={navigate}
      />,
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/onboarding"),
    );
  });

  it("읽기 실패 시 재시도 행동을 제공한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() => Promise.resolve({ status: "error" })}
        navigate={navigate}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장된 정보를 불러오지 못했어요.",
    );
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
    screen.getByRole("button", { name: "온보딩 다시 시작하기" }).click();
    expect(navigate).toHaveBeenCalledWith("/onboarding");
  });
});
