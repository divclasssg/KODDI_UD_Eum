import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import type {
  CompleteOnboardingInputV1,
  ProfileBundleV1,
} from "@/lib/db/contracts";

const NOW = new Date("2026-07-22T03:00:00.000Z");

async function reachEligibility(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "시작하기" }));
  await user.click(screen.getByRole("button", { name: "다음" }));
  await user.click(screen.getByRole("button", { name: "계속" }));
}

async function reachLocalConsent(user: ReturnType<typeof userEvent.setup>) {
  await reachEligibility(user);
  await user.type(screen.getByLabelText("생년월일"), "1960-05-20");
  await user.click(screen.getByRole("button", { name: "확인하고 계속" }));
}

async function reachBasicProfile(user: ReturnType<typeof userEvent.setup>) {
  await reachLocalConsent(user);
  await user.click(screen.getByRole("button", { name: "동의하고 계속" }));
  await user.click(
    screen.getByRole("button", { name: "민감정보 처리에 동의하고 계속" }),
  );
  await user.click(screen.getByRole("button", { name: "AI 전송 없이 계속" }));
}

async function reachMedicalMenu(user: ReturnType<typeof userEvent.setup>) {
  await reachBasicProfile(user);
  await user.type(screen.getByLabelText("이름"), "테스트 사용자");
  await user.click(screen.getByRole("button", { name: "기본정보 확인" }));
  await user.click(screen.getByRole("button", { name: "의료정보 준비하기" }));
}

async function completeSyntheticForm(user: ReturnType<typeof userEvent.setup>) {
  await reachMedicalMenu(user);
  await user.click(screen.getByRole("button", { name: "입력을 마치고 확인" }));
  await user.click(screen.getByRole("button", { name: "저장하고 홈으로" }));
}

const timestamp =
  "2026-07-22T03:00:00.000Z" as ProfileBundleV1["profile"]["updatedAt"];

const syntheticBundle: ProfileBundleV1 = {
  profile: {
    id: "default",
    schemaVersion: 1,
    displayName: "테스트 사용자",
    birthDate: "1960-05-20",
    sex: "unknown",
    updatedAt: timestamp,
  },
  medicalProfile: {
    id: "default",
    schemaVersion: 1,
    conditions: { state: "unknown" },
    medications: { state: "unknown" },
    allergies: { state: "unknown" },
    familyHistory: { state: "unknown" },
    medicalHistory: { state: "unknown" },
    surgicalHistory: { state: "unknown" },
    smoking: { state: "unknown" },
    alcohol: { state: "unknown" },
    updatedAt: timestamp,
  },
};

describe("OnboardingScreen", () => {
  it("스플래시와 두 소개에서 글·음성·사진과 의료진 활용을 안내한다", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingScreen complete={vi.fn()} navigate={vi.fn()} now={() => NOW} />,
    );

    expect(screen.getByText("병원 문진, 더 쉽고 편하게.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByText(/글, 음성, 사진/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText(/의료진에게 보여주세요/)).toBeVisible();
  });

  it("만 14세 미만은 저장과 동의 화면에 도달하지 못한다", async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(
      <OnboardingScreen complete={complete} navigate={vi.fn()} now={() => NOW} />,
    );

    await reachEligibility(user);
    await user.type(screen.getByLabelText("생년월일"), "2012-07-23");
    await user.click(screen.getByRole("button", { name: "확인하고 계속" }));

    expect(screen.getByRole("heading", { name: "만 14세 이상만 이용할 수 있어요" })).toBeVisible();
    expect(complete).not.toHaveBeenCalled();
    expect(screen.queryByText("이 기기에 정보를 저장해도 될까요?")).not.toBeInTheDocument();
  });

  it("로컬 저장을 거부하면 재검토와 종료만 보인다", async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(
      <OnboardingScreen complete={complete} navigate={vi.fn()} now={() => NOW} />,
    );

    await reachLocalConsent(user);
    await user.click(screen.getByRole("button", { name: "저장하지 않기" }));

    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "다시 검토하기" })).toBeVisible();
    expect(screen.getByRole("button", { name: "종료하기" })).toBeVisible();
  });

  it("민감정보 처리를 거부하면 해당 동의를 다시 검토한다", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingScreen complete={vi.fn()} navigate={vi.fn()} now={() => NOW} />,
    );

    await reachLocalConsent(user);
    await user.click(screen.getByRole("button", { name: "동의하고 계속" }));
    await user.click(screen.getByRole("button", { name: "민감정보 저장하지 않기" }));
    await user.click(screen.getByRole("button", { name: "다시 검토하기" }));

    expect(screen.getByRole("heading", { name: "건강정보를 이 기기에서 처리해도 될까요?" })).toBeVisible();
  });

  it("기본정보의 생년월일을 자격 확인에서 이어받고 이전에도 보존한다", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingScreen complete={vi.fn()} navigate={vi.fn()} now={() => NOW} />,
    );
    await reachBasicProfile(user);
    await user.type(screen.getByLabelText("이름"), "테스트 사용자");

    expect(screen.getByLabelText("생년월일")).toHaveValue("1960-05-20");
    await user.click(screen.getByRole("button", { name: "기본정보 확인" }));
    await user.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByLabelText("이름")).toHaveValue("테스트 사용자");
  });

  it("기본정보에서 생년월일을 14세 미만으로 바꾸면 저장 전에 차단한다", async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(
      <OnboardingScreen complete={complete} navigate={vi.fn()} now={() => NOW} />,
    );
    await reachBasicProfile(user);
    await user.type(screen.getByLabelText("이름"), "테스트 사용자");
    await user.clear(screen.getByLabelText("생년월일"));
    await user.type(screen.getByLabelText("생년월일"), "2012-07-23");
    await user.click(screen.getByRole("button", { name: "기본정보 확인" }));

    expect(
      screen.getByRole("heading", { name: "만 14세 이상만 이용할 수 있어요" }),
    ).toBeVisible();
    expect(complete).not.toHaveBeenCalled();
  });

  it("의료정보 메뉴에서 음성·사진 진입점을 보이고 실제 IO 없이 준비 중을 안내한다", async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(
      <OnboardingScreen complete={vi.fn()} navigate={vi.fn()} now={() => NOW} />,
    );
    await reachMedicalMenu(user);
    await user.click(screen.getByRole("button", { name: "복용 중인 약" }));

    const voice = screen.getByRole("button", { name: "음성 입력, 준비 중" });
    const photo = screen.getByRole("button", { name: "사진 추가, 준비 중" });
    await user.click(voice);
    expect(screen.getByRole("dialog")).toHaveTextContent("현재 데모에서는 준비 중인 기능입니다");
    await user.click(screen.getByRole("button", { name: "텍스트로 계속" }));
    await user.click(photo);

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("의료 측정값 오류를 입력과 연결하고 첫 오류로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingScreen complete={vi.fn()} navigate={vi.fn()} now={() => NOW} />,
    );
    await reachMedicalMenu(user);
    await user.click(screen.getByRole("button", { name: "키와 몸무게" }));
    await user.type(screen.getByLabelText("키(cm, 선택)"), "251");
    await user.click(screen.getByRole("button", { name: "이 정보 저장" }));

    const height = screen.getByLabelText("키(cm, 선택)");
    expect(height).toHaveFocus();
    expect(height).toHaveAttribute("aria-describedby", "height-cm-error");
  });

  it("저장이 끝난 뒤에만 홈으로 이동한다", async () => {
    const user = userEvent.setup();
    const completion = Promise.withResolvers<ProfileBundleV1>();
    const complete = vi.fn((input: CompleteOnboardingInputV1) => {
      void input;
      return completion.promise;
    });
    const navigate = vi.fn();
    render(
      <OnboardingScreen complete={complete} navigate={navigate} now={() => NOW} />,
    );

    await completeSyntheticForm(user);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("안전하게 저장하고 있어요.");
    completion.resolve(syntheticBundle);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/home"));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: expect.objectContaining({
          sensitiveHealth: expect.any(Object),
        }),
        profileBundle: expect.objectContaining({
          profile: expect.objectContaining({ birthDate: "1960-05-20" }),
        }),
      }),
    );
  });

  it("공개 UI에 persona 선택을 노출하지 않는다", () => {
    render(
      <OnboardingScreen complete={vi.fn()} navigate={vi.fn()} now={() => NOW} />,
    );
    expect(document.body).not.toHaveTextContent(/persona|페르소나|fixture/i);
  });

  it("Strict Mode에서도 저장 완료 뒤 홈으로 이동한다", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <StrictMode>
        <OnboardingScreen
          complete={() => Promise.resolve(syntheticBundle)}
          navigate={navigate}
          now={() => NOW}
        />
      </StrictMode>,
    );

    await completeSyntheticForm(user);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/home"));
  });
});
