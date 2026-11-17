const boardSelect = document.getElementById("board");
const buttons = [
  document.getElementById("whole"),
  document.getElementById("view"),
];
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
  if (!result?.ok) {
    say(result?.error ?? "That didn't work.", true);
    return;
  }
  say(
    result.partial
      ? `Added to ${result.board}: only what's on screen (this page can't be scrolled by the extension).`
      : `Added to ${result.board}.`
  );
};

buttons[0].addEventListener("click", () => run(true));
buttons[1].addEventListener("click", () => run(false));
loadBoards();

document.getElementById("version").textContent =
  `v${chrome.runtime.getManifest().version}`;

// Collections: the default one for the right-click menu.
const collectionSelect = document.getElementById("collection");
const collectionStatus = document.getElementById("collection-status");
const collections = (message) =>
  chrome.runtime.sendMessage({ ...message, to: "collections" });

const showCollections = (result) => {
  const list = result?.collections ?? [];
  collectionSelect.replaceChildren(
    ...list.map((c) => {
      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = c.name;
      option.selected = c.id === result.defaultId;
      return option;
    })
  );
  collectionSelect.disabled = list.length === 0;
  let note = "";
  if (result?.error) {
    note = result.error;
  } else if (list.length === 0) {
    note = "No collections yet. Make one on dallaspeters.com.";
  }
  collectionStatus.textContent = note;
  collectionStatus.toggleAttribute("data-bad", Boolean(result?.error));
};

const refreshCollections = async () => {
  collectionStatus.textContent = "Loading collections…";
  showCollections(await collections({ type: "load" }));
};

collectionSelect.addEventListener("change", async () => {
  showCollections(
    await collections({
      defaultId: collectionSelect.value,
      type: "set-default",
    })
  );
});
document
  .getElementById("refresh")
  .addEventListener("click", () => void refreshCollections());
refreshCollections();
