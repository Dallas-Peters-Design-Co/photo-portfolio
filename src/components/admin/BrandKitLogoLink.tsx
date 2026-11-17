import { type Dispatch, type SetStateAction, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { type BrandKitDoc, MAX_LOGOS } from "../../../config/brandKit.js";
import { componentLogoUrl, relinked } from "../../boards/components/logoSync";
import type { BrandComponent } from "../../boards/components/model";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { Button } from "../ui/button";
import { ConceptSelect } from "./ConceptControls";

/**
 * Logos drawn from the kit's canvas components (LogoEntry.componentId).
 *
 * Pick a component and it is drawn and added as a logo that follows it:
 * saving the component on a board (Edit component, then Done) draws it again
 * and puts the new picture in the logo's place (boards/components/logoSync.ts).
 */
export function BrandKitLogoLink({
  doc,
  kitId,
  setDoc,
}: {
  doc: BrandKitDoc;
  kitId: string;
  setDoc: Dispatch<SetStateAction<BrandKitDoc>>;
}) {
  const { data: components = [] } = useSWR(["kit-components", kitId], () =>
    componentsApi.list(kitId)
  );
  const [busy, setBusy] = useState<string | null>(null);
  const byId = new Map(components.map((c) => [c.id, c]));
  const linked = doc.logos.filter((l) => l.componentId);

  const draw = async (component: BrandComponent, add: boolean) => {
    setBusy(component.id);
    try {
      const url = await componentLogoUrl(component);
      setDoc((d) => ({
        ...d,
        logos: add
          ? [
              ...d.logos,
              {
                clearSpace: 0.5,
                componentId: component.id,
                label: component.name,
                minWidth: 24,
                rules: "",
                url,
              },
            ].slice(0, MAX_LOGOS)
          : relinked(d.logos, component.id, url),
      }));
      toast.success(
        add
          ? `${component.name} added as a logo. It follows the component from now on.`
          : `The logo now shows ${component.name} as it is.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't draw it");
    } finally {
      setBusy(null);
    }
  };

  const unlink = (componentId: string) =>
    setDoc((d) => ({
      ...d,
      logos: d.logos.map((l) => {
        if (l.componentId !== componentId) {
          return l;
        }
        const { componentId: _gone, ...rest } = l;
        return rest;
      }),
    }));

  if (components.length === 0 && linked.length === 0) {
    return (
      <p className="brand-kit__hint">
        Make a component on a board (select the logo's layers, then Make
        component) to draw a logo from it that updates when the component does.
      </p>
    );
  }

  return (
    <div className="stack stack--snug">
      {doc.logos.length < MAX_LOGOS && components.length > 0 ? (
        <ConceptSelect
          label="Add a logo drawn from a component"
          onChange={(id) => {
            const component = byId.get(id);
            if (component) {
              void draw(component, true);
            }
          }}
          options={components.map((c) => ({ label: c.name, value: c.id }))}
          placeholder={busy ? "Drawing…" : "Choose a component"}
          value=""
        />
      ) : null}
      {linked.map((logo) => {
        const component = byId.get(logo.componentId ?? "");
        return (
          <p className="brand-kit__hint" key={logo.componentId}>
            {logo.label || "A logo"} follows{" "}
            {component ? component.name : "a component that no longer exists"}:
            saving it on a board updates the logo.{" "}
            {component ? (
              <Button
                disabled={busy === component.id}
                onClick={() => void draw(component, false)}
                size="xs"
                type="button"
                variant="outline"
              >
                {busy === component.id ? "Drawing…" : "Update now"}
              </Button>
            ) : null}{" "}
            <Button
              onClick={() => unlink(logo.componentId ?? "")}
              size="xs"
              type="button"
              variant="ghost"
            >
              Unlink
            </Button>
          </p>
        );
      })}
    </div>
  );
}
