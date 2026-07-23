import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileScreen } from "@/features/profile/profile-screen";
import {
  toUtcTimestamp,
  type ProfileBundleV1,
} from "@/lib/db/contracts";

const SYNTHETIC_PROFILE_BUNDLE: ProfileBundleV1 = {
  profile: {
    id: "default",
    schemaVersion: 1,
    displayName: "테스트 사용자",
    birthDate: "1960-05-20",
    sex: "unknown",
    updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
  medicalProfile: {
    id: "default",
    schemaVersion: 1,
    conditions: { state: "known", values: ["합성 만성질환"] },
    medications: { state: "unknown" },
    allergies: { state: "unknown" },
    familyHistory: { state: "unknown" },
    medicalHistory: { state: "unknown" },
    surgicalHistory: { state: "unknown" },
    smoking: { state: "unknown" },
    alcohol: { state: "unknown" },
    updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
};

describe("ProfileScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("기록에서 진입하면 과거 기록 불변 안내를 표시한다", async () => {
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={vi.fn()}
        navigate={vi.fn()}
        returnTo="/records/completed-record"
      />,
    );

    expect(
      await screen.findByText("과거 기록은 변경되지 않아요."),
    ).toBeVisible();
  });

  it("clean 취소는 같은 기록으로 즉시 복귀한다", async () => {
    const navigate = vi.fn();
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={vi.fn()}
        navigate={navigate}
        returnTo="/records/completed-record"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "취소하고 돌아가기" }),
    );

    expect(navigate).toHaveBeenCalledWith("/records/completed-record");
  });

  it("dirty 취소는 계속 수정하거나 변경사항을 버릴 수 있다", async () => {
    const navigate = vi.fn();
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={vi.fn()}
        navigate={navigate}
      />,
    );

    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "수정한 사용자" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "취소하고 돌아가기" }),
    );
    expect(
      screen.getByRole("heading", { name: "변경사항을 버릴까요?" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "계속 수정" }));
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "취소하고 돌아가기" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "변경사항 버리기" }));
    expect(navigate).toHaveBeenCalledWith("/home");
  });

  it("저장 성공은 같은 기록으로 복귀한다", async () => {
    const navigate = vi.fn();
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        navigate={navigate}
        returnTo="/records/completed-record"
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "수정한 사용자" },
    });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/records/completed-record"),
    );
    expect(sessionStorage.getItem("koddi.profile-save-success")).toBe("true");
  });

  it("저장 중에는 중복 제출하지 않는다", async () => {
    let resolveSave: ((bundle: ProfileBundleV1) => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<ProfileBundleV1>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={save}
        navigate={vi.fn()}
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "수정한 사용자" },
    });
    const submit = screen.getByRole("button", { name: "변경사항 저장" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSave?.(SYNTHETIC_PROFILE_BUNDLE);
    });
  });

  it("저장 중에는 제출한 draft의 모든 편집 control을 비활성화한다", async () => {
    const user = userEvent.setup();
    let resolveSave: ((bundle: ProfileBundleV1) => void) | undefined;
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={() =>
          new Promise<ProfileBundleV1>((resolve) => {
            resolveSave = resolve;
          })
        }
        navigate={vi.fn()}
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    const name = await screen.findByLabelText("이름");
    fireEvent.change(name, { target: { value: "제출한 사용자" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    expect(name).toBeDisabled();
    expect(screen.getByLabelText("생년월일")).toBeDisabled();
    expect(screen.getByLabelText("답하지 않음")).toBeDisabled();
    expect(screen.getAllByLabelText("잘 모르겠어요")[0]).toBeDisabled();
    expect(screen.getByLabelText("키(cm, 선택)")).toBeDisabled();
    await user.type(name, "저장 중 변경");
    expect(name).toHaveValue("제출한 사용자");

    await act(async () => {
      resolveSave?.(SYNTHETIC_PROFILE_BUNDLE);
    });
  });

  it("저장 중에는 열린 폐기 확인에서 이동하지 않고 저장 목적지로만 복귀한다", async () => {
    let resolveSave: ((bundle: ProfileBundleV1) => void) | undefined;
    const navigate = vi.fn();
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={() =>
          new Promise<ProfileBundleV1>((resolve) => {
            resolveSave = resolve;
          })
        }
        navigate={navigate}
        returnTo="/records/completed-record"
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "수정한 사용자" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "취소하고 돌아가기" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "변경사항 버리기" }));

    expect(navigate).not.toHaveBeenCalled();
    await act(async () => {
      resolveSave?.(SYNTHETIC_PROFILE_BUNDLE);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/records/completed-record");
  });

  it("저장 실패 후에도 draft를 유지한다", async () => {
    const save = vi.fn().mockRejectedValue(new Error("합성 저장 실패"));
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={save}
        navigate={vi.fn()}
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    const name = await screen.findByLabelText("이름");
    fireEvent.change(name, { target: { value: "수정한 테스트 사용자" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장하지 못했어요",
    );
    expect(name).toHaveValue("수정한 테스트 사용자");
  });

  it("dirty 상태에서는 페이지 이탈을 경고한다", async () => {
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "수정한 사용자" },
    });
    const event = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("draft가 clean 상태로 돌아오면 페이지 이탈 경고를 제거한다", async () => {
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    const name = await screen.findByLabelText("이름");
    fireEvent.change(name, { target: { value: "수정한 사용자" } });
    fireEvent.change(name, { target: { value: "테스트 사용자" } });
    const event = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("저장 완료 전에 unmount하면 상태를 갱신하지 않는다", async () => {
    let resolveSave: ((bundle: ProfileBundleV1) => void) | undefined;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const navigate = vi.fn();
    const { unmount } = render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={() =>
          new Promise<ProfileBundleV1>((resolve) => {
            resolveSave = resolve;
          })
        }
        navigate={navigate}
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "수정한 사용자" },
    });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    unmount();

    await act(async () => {
      resolveSave?.(SYNTHETIC_PROFILE_BUNDLE);
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("unmount 뒤 늦은 load 성공은 이동하거나 화면을 갱신하지 않는다", async () => {
    let resolveLoad: ((bundle: ProfileBundleV1 | undefined) => void) | undefined;
    const navigate = vi.fn();
    const { unmount } = render(
      <ProfileScreen
        load={() =>
          new Promise<ProfileBundleV1 | undefined>((resolve) => {
            resolveLoad = resolve;
          })
        }
        save={vi.fn()}
        navigate={navigate}
      />,
    );

    unmount();
    await act(async () => {
      resolveLoad?.(undefined);
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText("프로필 수정")).not.toBeInTheDocument();
  });

  it("unmount 뒤 늦은 load 실패는 이동하거나 오류를 표시하지 않는다", async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    const navigate = vi.fn();
    const { unmount } = render(
      <ProfileScreen
        load={() =>
          new Promise<ProfileBundleV1 | undefined>((_, reject) => {
            rejectLoad = reject;
          })
        }
        save={vi.fn()}
        navigate={navigate}
      />,
    );

    unmount();
    await act(async () => {
      rejectLoad?.(new Error("합성 load 실패"));
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.queryByText("프로필을 불러오지 못했어요."),
    ).not.toBeInTheDocument();
  });

  it("저장 실패 뒤 입력을 유지하고 다시 저장할 수 있다", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("합성 저장 실패"))
      .mockResolvedValueOnce(SYNTHETIC_PROFILE_BUNDLE);
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={save}
        navigate={vi.fn()}
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    const name = await screen.findByLabelText("이름");
    fireEvent.change(name, { target: { value: "수정한 테스트 사용자" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장하지 못했어요",
    );
    expect(name).toHaveValue("수정한 테스트 사용자");
    fireEvent.click(screen.getByRole("button", { name: "다시 저장" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "변경사항을 저장했어요",
    );
  });

  it("만 14세 미만 생년월일은 repository에 전달하지 않는다", async () => {
    const save = vi.fn();
    render(
      <ProfileScreen
        load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
        save={save}
        navigate={vi.fn()}
        now={() => new Date("2026-07-22T03:00:00.000Z")}
      />,
    );

    fireEvent.change(await screen.findByLabelText("생년월일"), {
      target: { value: "2012-07-23" },
    });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    const error = await screen.findByText("만 14세 이상만 사용할 수 있어요.");
    const birthDate = screen.getByLabelText("생년월일");

    expect(error).toBeVisible();
    expect(birthDate).toHaveAttribute("aria-invalid", "true");
    expect(birthDate).toHaveAttribute("aria-describedby", error.id);
    expect(save).not.toHaveBeenCalled();
  });

  it("profile이 없으면 온보딩으로 이동한다", async () => {
    const navigate = vi.fn();
    render(
      <ProfileScreen
        load={() => Promise.resolve(undefined)}
        save={vi.fn()}
        navigate={navigate}
      />,
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/onboarding"));
  });
});
