import { useEffect } from "react";

type Save = () => Promise<boolean>;
const saves = new Set<Save>();

export function useBeforeSiteReload(save: Save) {
  useEffect(() => {
    saves.add(save);
    return () => {
      saves.delete(save);
    };
  }, [save]);
}

export async function saveBeforeSiteReload() {
  const results = await Promise.allSettled([...saves].map((save) => save()));
  return results.every(
    (result) => result.status === "fulfilled" && result.value
  );
}
