import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BoardHeaderActions } from "./BoardHeaderActions";

describe("BoardHeaderActions", () => {
  it("is icons only, each named in its tooltip, with counts as badges", () => {
    const onPublish = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <BoardHeaderActions
          commentCount={3}
          hasNodes
          isPublic
          isPublishing={false}
          isRunning={false}
          items={[]}
          onCancelRun={() => undefined}
          onClose={() => undefined}
          onPublish={onPublish}
          onRun={() => undefined}
          onToggleComments={() => undefined}
          publicUrl="https://example.com/board/x"
          showComments={false}
        />
      )
    );
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.map((b) => b.title)).toEqual([
      "Run the board",
      "Comments",
      "Copy the link: example.com/board/x",
      "Present",
      "Published · click to unpublish",
      "Theme: System",
      "Close board",
    ]);
    // No words beside the icons, only the comment count.
    expect(host.textContent).toBe("3");
    act(() => buttons[4]?.click());
    expect(onPublish).toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});
