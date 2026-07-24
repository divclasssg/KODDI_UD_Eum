import { expect, test, type Locator, type Page } from "@playwright/test";

type PersonaCase = {
  id: "youngsu" | "minjeong" | "seonghun";
  publicName: string;
  complaint: string;
};

const PERSONAS: readonly PersonaCase[] = [
  {
    id: "youngsu",
    publicName: "합성 사용자 가",
    complaint: "합성 허리 불편",
  },
  {
    id: "minjeong",
    publicName: "합성 사용자 나",
    complaint: "합성 무릎 불편",
  },
  {
    id: "seonghun",
    publicName: "합성 사용자 다",
    complaint: "합성 손목 불편",
  },
];

const PRIVATE_TEST_LABELS = /김영수|이민정|박성훈|persona|fixture|페르소나/i;

function trackExternalOperations(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:ai|media|stt)\//.test(request.url())) {
      requests.push(request.url());
    }
  });
  return requests;
}

async function expectPublicOnly(page: Page) {
  expect(await page.locator("body").innerText()).not.toMatch(
    PRIVATE_TEST_LABELS,
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(48);
}

async function tabTo(page: Page, target: Locator, maximumTabs = 120) {
  for (let count = 0; count < maximumTabs; count += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(
    `키보드 Tab으로 ${maximumTabs}회 안에 대상에 도달하지 못했습니다.`,
  );
}

async function activate(
  page: Page,
  target: Locator,
  keyboard: boolean,
  key: "Enter" | "Space" = "Enter",
) {
  if (!keyboard) {
    await target.click();
    return;
  }
  await tabTo(page, target);
  await expect(target).toBeFocused();
  await page.keyboard.press(key);
}

async function activateRadio(
  page: Page,
  target: Locator,
  keyboard: boolean,
) {
  if (!keyboard) {
    await target.click();
    return;
  }

  const radios = page.getByRole("radio");
  if (await target.isChecked()) {
    await tabTo(page, target);
    await page.keyboard.press("Space");
    await expect(target).toBeChecked();
    return;
  }

  await tabTo(page, radios.first());
  const count = await radios.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await page.keyboard.press("Space");
      await expect(target).toBeChecked();
      return;
    }
    await page.keyboard.press("ArrowRight");
  }
  throw new Error("키보드 방향키로 radio 선택 항목에 도달하지 못했습니다.");
}

async function completeOnboarding(
  page: Page,
  persona: PersonaCase,
  keyboard = false,
) {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/onboarding");
  await activate(
    page,
    page.getByRole("button", { name: "시작하기" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "다음" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "계속" }),
    keyboard,
  );

  const birthDate = page.getByLabel("생년월일");
  if (keyboard) {
    await tabTo(page, birthDate);
    await expect(birthDate).toBeFocused();
    await page.keyboard.type("05201960");
    await expect(birthDate).toHaveValue("1960-05-20");
  } else {
    await birthDate.fill("1960-05-20");
  }

  await activate(
    page,
    page.getByRole("button", { name: "확인하고 계속" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "동의하고 계속" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", {
      name: "민감정보 처리에 동의하고 계속",
    }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "AI 전송 없이 계속" }),
    keyboard,
  );

  const name = page.getByLabel("이름");
  if (keyboard) {
    await tabTo(page, name);
    await expect(name).toBeFocused();
    await page.keyboard.type(persona.publicName);
  } else {
    await name.fill(persona.publicName);
  }

  await activateRadio(page, page.getByLabel("답하지 않음"), keyboard);
  await activate(
    page,
    page.getByRole("button", { name: "기본정보 확인" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "의료정보 준비하기" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "입력을 마치고 확인" }),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "저장하고 홈으로" }),
    keyboard,
  );
  await expect(
    page.getByRole("heading", {
      name: `${persona.publicName}님, 안녕하세요`,
    }),
  ).toBeVisible();
}

async function completeManualInterview(
  page: Page,
  complaint: string,
  suffix: string,
  keyboard: boolean,
) {
  await activate(
    page,
    page.getByRole("button", { name: "수동 문진 시작하기" }),
    keyboard,
  );

  const firstAnswer = page.getByLabel("답변");
  if (keyboard) {
    await tabTo(page, firstAnswer);
    await page.keyboard.type(`${complaint} ${suffix}`);
  } else {
    await firstAnswer.fill(`${complaint} ${suffix}`);
  }
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );

  await activateRadio(page, page.getByLabel("며칠 전"), keyboard);
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );
  await activateRadio(
    page,
    page.getByLabel("나아졌다가 다시 나타나요"),
    keyboard,
  );
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );
  await activateRadio(page, page.getByLabel("많이 불편해요"), keyboard);
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );

  const finalAnswer = page.getByLabel("답변");
  if (keyboard) {
    await tabTo(page, finalAnswer);
    await page.keyboard.type(`합성 추가 내용 ${suffix}`);
  } else {
    await finalAnswer.fill(`합성 추가 내용 ${suffix}`);
  }
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );
  await expect(
    page.getByRole("heading", { name: "작성한 내용을 확인해 주세요" }),
  ).toBeVisible();
  await activate(
    page,
    page.getByRole("button", { name: "문진 저장 완료" }),
    keyboard,
  );
  await expect(
    page.getByRole("status").filter({ hasText: "문진을 저장했어요." }),
  ).toBeVisible();
}

async function returnHome(page: Page) {
  await page.getByRole("button", { name: "홈으로" }).click();
}

async function editCurrentProfile(
  page: Page,
  nextName: string,
  keyboard: boolean,
) {
  const editLink = page.getByRole("link", { name: "내 정보 수정" });
  await activate(page, editLink, keyboard);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/profile");

  const name = page.getByLabel("이름");
  if (keyboard) {
    await tabTo(page, name);
    await expect(name).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(nextName);
  } else {
    await name.fill(nextName);
  }

  await activate(
    page,
    page.getByRole("button", { name: "변경사항 저장" }),
    keyboard,
  );
  await expect(
    page.getByRole("heading", { name: "문진 기록" }),
  ).toBeVisible();
}

test("이민정 기준 Task 1 공개 온보딩과 문진을 keyboard로 완료한다", async ({
  page,
}) => {
  const persona = PERSONAS[1]!;
  const requests = trackExternalOperations(page);
  await completeOnboarding(page, persona, true);
  await completeManualInterview(page, persona.complaint, "Task 1", true);
  await expect(
    page.getByRole("status").filter({ hasText: "문진을 저장했어요." }),
  ).toBeVisible();
  await expectPublicOnly(page);
  expect(requests).toEqual([]);
});

for (const persona of PERSONAS) {
  test(`${persona.id} 기준 Task 2 오늘 기록을 의료진용 화면까지 연다`, async ({
    page,
  }) => {
    const requests = trackExternalOperations(page);
    await completeOnboarding(page, persona);
    await completeManualInterview(page, persona.complaint, "Task 2", false);
    await returnHome(page);
    await page.getByRole("button", { name: "기록 보기" }).click();
    const record = page.getByRole("link", {
      name: new RegExp(persona.complaint),
    });
    await expect(record).toContainText("완료");
    await expect(record).toContainText("수동 문진");
    await expectTouchTarget(record);
    await record.click();
    const clinician = page.getByRole("link", {
      name: "의료진에게 보여주기",
    });
    await expectTouchTarget(clinician);
    await clinician.click();
    await expect(
      page.getByRole("heading", { name: "의료진 참고용" }),
    ).toBeVisible();
    await expectPublicOnly(page);
    expect(requests).toEqual([]);
  });
}

for (const persona of PERSONAS) {
  test(`${persona.id} 기준 Task 3 과거 기록에서 현재 정보를 수정한다`, async ({
    page,
  }) => {
    const requests = trackExternalOperations(page);
    await completeOnboarding(page, persona);
    await completeManualInterview(page, persona.complaint, "과거", false);
    await returnHome(page);
    await completeManualInterview(page, persona.complaint, "최신", false);
    await returnHome(page);
    const keyboard = persona.id === "seonghun";
    await activate(
      page,
      page.getByRole("button", { name: "기록 보기" }),
      keyboard,
    );
    const past = page.getByRole("link", {
      name: new RegExp(`${persona.complaint} 과거`),
    });
    await activate(page, past, keyboard);
    await editCurrentProfile(
      page,
      `${persona.publicName} 수정`,
      keyboard,
    );
    await expect(
      page.getByRole("heading", { name: "문진 기록" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "변경사항을 저장했어요." }),
    ).toBeVisible();
    await expectPublicOnly(page);
    expect(requests).toEqual([]);
  });
}
