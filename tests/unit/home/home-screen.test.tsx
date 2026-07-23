import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeScreen } from "@/features/home/home-screen";

describe("HomeScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("직접 프로필 저장 직후 성공 상태를 한 번 표시한다", async () => {
    sessionStorage.setItem("koddi.profile-save-success", "true");
    const props = {
      loadState: () =>
        Promise.resolve({
          status: "ready" as const,
          displayName: "테스트 사용자",
          aiTransfer: "declined" as const,
        }),
      navigate: vi.fn(),
    };

    const { unmount } = render(<HomeScreen {...props} />);

    const status = await screen.findByText("변경사항을 저장했어요.");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toBeVisible();
    expect(sessionStorage.getItem("koddi.profile-save-success")).toBeNull();

    unmount();
    render(<HomeScreen {...props} />);
    await screen.findByRole("heading", {
      name: "테스트 사용자님, 안녕하세요",
    });
    expect(
      screen.queryByText("변경사항을 저장했어요."),
    ).not.toBeInTheDocument();
  });

  it("AI 전송 거부 상태에서는 수동 문진을 기본 행동으로 표시한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() =>
          Promise.resolve({
            status: "ready",
            displayName: "테스트 사용자",
            aiTransfer: "declined",
          })
        }
        navigate={navigate}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "테스트 사용자님, 안녕하세요",
      }),
    ).toBeVisible();
    const manualStart = screen.getByRole("button", {
      name: /수동 문진 시작하기/,
    });
    expect(manualStart).toHaveAttribute("data-action-emphasis", "primary");
    fireEvent.click(manualStart);
    expect(navigate).toHaveBeenCalledWith("/interview/manual");
    expect(navigate).not.toHaveBeenCalledWith("/interview/ai");
    expect(screen.getByText("외부 AI로 정보를 보내지 않아요.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /AI 문진 시작하기/ }),
    ).not.toBeInTheDocument();
  });

  it("AI 전송 동의 상태에서는 AI 문진을 기본 행동으로 연결한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() =>
          Promise.resolve({
            status: "ready",
            displayName: "테스트 사용자",
            aiTransfer: "granted",
          })
        }
        navigate={navigate}
      />,
    );

    const aiStart = await screen.findByRole("button", {
      name: "AI 문진 시작하기",
    });
    expect(aiStart).toBeEnabled();
    expect(aiStart).toHaveAttribute("data-action-emphasis", "primary");
    fireEvent.click(aiStart);
    expect(navigate).toHaveBeenCalledWith("/interview/ai");
    expect(
      screen.getByRole("button", { name: "수동 문진 시작하기" }),
    ).toBeEnabled();
  });

  it("공개 홈에 Persona와 fixture, 역할극 문구를 표시하지 않는다", async () => {
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

    await screen.findByRole("heading", { name: "테스트 사용자님, 안녕하세요" });
    expect(document.body).not.toHaveTextContent(/persona|페르소나|fixture|역할극/i);
  });

  it("수동 문진을 Persona 없는 실제 경로로 연결한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() => Promise.resolve({ status: "ready", displayName: "테스트 사용자", aiTransfer: "declined" })}
        navigate={navigate}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "수동 문진 시작하기" }),
    );
    expect(navigate).toHaveBeenCalledWith("/interview/manual");
  });

  it("프로필 수정과 전체 삭제의 실제 경로를 제공한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() =>
          Promise.resolve({
            status: "ready",
            displayName: "테스트 사용자",
            aiTransfer: "declined",
          })
        }
        navigate={navigate}
      />,
    );

    await screen.findByRole("heading", { name: "테스트 사용자님, 안녕하세요" });
    screen.getByRole("button", { name: "프로필 수정" }).click();
    screen.getByRole("button", { name: "저장된 정보 모두 삭제" }).click();

    expect(navigate).toHaveBeenNthCalledWith(1, "/profile");
    expect(navigate).toHaveBeenNthCalledWith(2, "/settings/data");
  });

  it("기록 보기에서 저장 기록 목록으로 이동한다", async () => {
    const navigate = vi.fn();
    render(
      <HomeScreen
        loadState={() =>
          Promise.resolve({
            status: "ready",
            displayName: "테스트 사용자",
            aiTransfer: "declined",
          })
        }
        navigate={navigate}
      />,
    );

    (
      await screen.findByRole("button", { name: "기록 보기" })
    ).click();

    expect(navigate).toHaveBeenCalledWith("/records");
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
