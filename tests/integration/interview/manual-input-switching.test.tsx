import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createInterviewApplicationService } from "@/features/interview/application/interview-application-service";
import { createManualInterviewApplicationRepositoryPort } from "@/features/interview/manual/manual-interview-application-adapter";
import { ManualInterviewScreen } from "@/features/interview/manual/manual-interview-screen";
import { createManualInterviewService } from "@/features/interview/manual/manual-interview-service";
import { createConsentRepository } from "@/lib/db/consent-repository";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { createInterviewRepository } from "@/lib/db/interview-repository";

import { SYNTHETIC_DECLINED_AI_CONSENT_INPUT } from "../db/fixtures";

describe("manual input switching", () => {
  it("입력 방식별 draft를 IndexedDB와 reload 경계를 지나 보존한다", async () => {
    const database = await openMedicalInterviewDatabase();
    await createConsentRepository(database).grant(
      SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
    );
    const repository = createInterviewRepository(database);
    let id = 0;
    const createService = () => {
      const legacyService = createManualInterviewService({
        repository,
        captureRuntimeGeneration: () => 0,
        randomId: () => `integration-${++id}`,
      });
      return createInterviewApplicationService({
        repository: createManualInterviewApplicationRepositoryPort({
          legacyService,
          repository,
        }),
        navigate: () => {},
        captureRuntimeGeneration: () => 0,
        randomId: () => `application-${++id}`,
      });
    };

    const firstService = createService();
    const firstRender = render(<ManualInterviewScreen service={firstService} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("답변"), "합성 두통 복원");
    await firstService.whenIdle();
    firstRender.unmount();

    const secondService = createService();
    const secondRender = render(<ManualInterviewScreen service={secondService} />);
    expect(await screen.findByLabelText("답변")).toHaveValue("합성 두통 복원");
    await user.click(screen.getByRole("button", { name: "답변 저장" }));
    await screen.findByRole("heading", { name: "언제부터 불편했나요?" });
    await user.click(screen.getByRole("tab", { name: "직접 입력" }));
    await user.type(screen.getByLabelText("답변"), "합성 기간 메모");
    await user.click(screen.getByRole("tab", { name: "기간 선택" }));
    await user.click(screen.getByRole("radio", { name: "며칠 전" }));
    await secondService.whenIdle();
    secondRender.unmount();

    const thirdService = createService();
    const thirdRender = render(<ManualInterviewScreen service={thirdService} />);
    await screen.findByRole("heading", { name: "언제부터 불편했나요?" });
    expect(screen.getByRole("radio", { name: "며칠 전" })).toBeChecked();
    await user.click(screen.getByRole("tab", { name: "직접 입력" }));
    expect(screen.getByLabelText("답변")).toHaveValue("합성 기간 메모");

    thirdRender.unmount();
    database.close();
  });
});
