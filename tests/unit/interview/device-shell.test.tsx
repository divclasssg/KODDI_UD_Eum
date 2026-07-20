import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DevicePreview } from "@/features/interview/components/device-preview";

describe("고정 디바이스 셸", () => {
  it("프레임과 상태바를 장식으로 숨기고 홈 이름을 제공한다", () => {
    const { container } = render(
      <DevicePreview>
        <p>문진 내용</p>
      </DevicePreview>,
    );

    const frame = container.querySelector('img[alt=""]');
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame).toHaveAttribute("width", "1350");
    expect(frame).toHaveAttribute("height", "2760");
    expect(screen.getByText("9:41").closest("[aria-hidden]")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 나가기" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("문진 내용")).toBeVisible();
  });
});
