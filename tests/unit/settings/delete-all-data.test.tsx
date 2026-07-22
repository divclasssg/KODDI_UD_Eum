import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteAllData } from "@/features/settings/delete-all-data";

function openConfirmation() {
  fireEvent.click(screen.getByRole("button", { name: "모든 정보 삭제" }));
}

function confirmDeletion() {
  openConfirmation();
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
}

describe("DeleteAllData", () => {
  it("최종 확인 뒤 reset 성공만 알린다", async () => {
    const reset = vi.fn().mockResolvedValue(undefined);
    render(<DeleteAllData reset={reset} navigate={vi.fn()} />);

    openConfirmation();
    expect(
      screen.getByRole("dialog", { name: "모든 정보를 삭제할까요?" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));

    expect(reset).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("삭제를 완료했어요"),
    );
  });

  it("확인을 취소하면 reset을 호출하지 않는다", () => {
    const reset = vi.fn();
    render(<DeleteAllData reset={reset} navigate={vi.fn()} />);

    openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(reset).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reset 실패 시 삭제 완료를 표시하지 않고 재시도한다", async () => {
    const reset = vi
      .fn()
      .mockRejectedValueOnce(new Error("합성 실패"))
      .mockResolvedValueOnce(undefined);
    render(<DeleteAllData reset={reset} navigate={vi.fn()} />);

    confirmDeletion();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "삭제하지 못했어요",
    );
    expect(screen.queryByText("삭제를 완료했어요")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(reset).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "삭제를 완료했어요",
    );
  });

  it("삭제 성공 뒤 온보딩으로 이동한다", async () => {
    const navigate = vi.fn();
    render(
      <DeleteAllData
        reset={() => Promise.resolve()}
        navigate={navigate}
      />,
    );

    confirmDeletion();
    fireEvent.click(
      await screen.findByRole("button", { name: "처음부터 시작하기" }),
    );

    expect(navigate).toHaveBeenCalledWith("/onboarding");
  });
});
