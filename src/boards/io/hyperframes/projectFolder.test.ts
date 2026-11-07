import { describe, expect, it } from "vitest";
import { writeProject } from "./projectFolder";

const text = (s: string) => new TextEncoder().encode(s);

const read = async (dir: FileSystemDirectoryHandle, path: string) => {
  const parts = path.split("/");
  const leaf = parts.pop() ?? "";
  const at = await parts.reduce<Promise<FileSystemDirectoryHandle>>(
    async (d, part) => (await d).getDirectoryHandle(part),
    Promise.resolve(dir)
  );
  return (await (await at.getFileHandle(leaf)).getFile()).text();
};

describe("writing a project into a folder", () => {
  it("writes nested files and updates them in place, leaving others alone", async () => {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(`test-${Date.now()}`, {
      create: true,
    });
    await writeProject(folder, "poster", [
      { bytes: text("<html>1</html>"), name: "index.html" },
      { bytes: text("js"), name: "assets/studio.js" },
      { bytes: text("font"), name: "assets/fonts/a.woff" },
    ]);
    const project = await folder.getDirectoryHandle("poster");
    const own = await project.getFileHandle("render.mp4", { create: true });
    const out = await own.createWritable();
    await out.write(text("video"));
    await out.close();

    await writeProject(folder, "poster", [
      { bytes: text("<html>2</html>"), name: "index.html" },
    ]);
    expect(await read(project, "index.html")).toBe("<html>2</html>");
    expect(await read(project, "assets/fonts/a.woff")).toBe("font");
    expect(await read(project, "render.mp4")).toBe("video");
    await root.removeEntry(folder.name, { recursive: true });
  });
});
