const boardSelect = document.getElementById("board");
const buttons = [document.getElementById("whole"), document.getElementById("view")];
const status = document.getElementById("status");

const say = (text, bad = false) => {
  status.textContent = text;
  status.toggleAttribute("data-bad", bad);
};

const background = (message) =>
  chrome.runtime.sendMessage({ ...message, to: "background" });

const enable = (on) => {
  for (const button of buttons) {
    button.disabled = !on;
  }
};

const loadBoards = async () => {
  enable(false);
  const boards = (await background({ type: "boards" })) ?? [];
  boardSelect.replaceChildren(
    ...boards.map((b) => {
      const option = document.createElement("option");
      option.value = String(b.tabId);
      option.textContent = b.name;
      return option;
    })
  );
  if (boards.length === 0) {
    say("Open a board in another tab (reload it once after installing).", true);
    return;
  }
  say("");
  enable(true);
};

const run = async (whole) => {
  enable(false);
  say("Capturing…");
  const result = await background({
    boardTabId: Number(boardSelect.value),
    type: "capture",
    whole,
  });
  enable(true);
  say(
    result?.ok ? `Added to ${result.board}.` : (result?.error ?? "That didn't work."),
    !result?.ok
  );
};

buttons[0].addEventListener("click", () => run(true));
buttons[1].addEventListener("click", () => run(false));
loadBoards();
