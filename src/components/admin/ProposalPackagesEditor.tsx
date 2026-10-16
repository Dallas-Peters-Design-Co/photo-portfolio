import { Plus, Star, Trash2 } from "lucide-react";
import {
  newItemId,
  type ProposalAddOn,
  type ProposalDoc,
  type ProposalPackage,
} from "../../../config/proposal.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const labelClass = "text-[10px] uppercase tracking-widest text-white/90";
const inputClass =
  "min-h-11 text-base bg-black/40 border-white/10 focus:border-white/40 transition-colors";
const textareaClass =
  "w-full min-h-28 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-base leading-relaxed text-white/90 transition-colors placeholder:text-white/30 focus:border-white/40 focus:outline-none";
const fieldsetTitleClass =
  "text-[11px] uppercase tracking-[0.2em] text-white/70";

const emptyPackage = (): ProposalPackage => ({
  bestFor: "",
  id: newItemId(),
  includes: [],
  name: "",
  payment: "",
  price: "",
  priceNote: "",
  recommended: false,
  revisions: "",
  timeline: "",
});

const emptyAddOn = (): ProposalAddOn => ({
  id: newItemId(),
  name: "",
  price: "",
});

/**
 * The priced part of the proposal: the packages side by side, and the add-ons
 * underneath. Split out of ProposalEditor so neither file crosses the
 * 500-line ceiling, and because this is the part that changes per client
 * while the rest mostly carries over.
 */
export function ProposalPackagesEditor({
  doc,
  onChange,
}: {
  doc: ProposalDoc;
  onChange: (patch: Partial<ProposalDoc>) => void;
}) {
  const updatePackage = (id: string, patch: Partial<ProposalPackage>) =>
    onChange({
      packages: doc.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  // One recommended option at a time: the page leads with it, and two leads
  // is none.
  const recommend = (id: string) =>
    onChange({
      packages: doc.packages.map((p) => ({
        ...p,
        recommended: p.id === id ? !p.recommended : false,
      })),
    });

  const updateAddOn = (id: string, patch: Partial<ProposalAddOn>) =>
    onChange({
      addOns: doc.addOns.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={fieldsetTitleClass}>Packages</h3>
          <Button
            onClick={() =>
              onChange({ packages: [...doc.packages, emptyPackage()] })
            }
            type="button"
            variant="ghost"
          >
            <Plus size={14} /> Add package
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {doc.packages.map((pkg, index) => (
            <div
              className={`space-y-3 rounded-md border p-4 ${
                pkg.recommended ? "border-white/40" : "border-white/10"
              }`}
              key={pkg.id}
            >
              <div className="flex items-center justify-between">
                <span className={labelClass}>Option {index + 1}</span>
                <div className="flex items-center gap-1">
                  <Button
                    aria-label="Mark as recommended"
                    aria-pressed={pkg.recommended}
                    onClick={() => recommend(pkg.id)}
                    type="button"
                    variant="ghost"
                  >
                    <Star
                      fill={pkg.recommended ? "currentColor" : "none"}
                      size={14}
                    />
                  </Button>
                  <Button
                    aria-label="Remove package"
                    onClick={() =>
                      onChange({
                        packages: doc.packages.filter((p) => p.id !== pkg.id),
                      })
                    }
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass} htmlFor={`pkg-name-${pkg.id}`}>
                  Name
                </Label>
                <Input
                  className={inputClass}
                  id={`pkg-name-${pkg.id}`}
                  onChange={(e) =>
                    updatePackage(pkg.id, { name: e.target.value })
                  }
                  placeholder="Launch Package"
                  value={pkg.name}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className={labelClass} htmlFor={`pkg-price-${pkg.id}`}>
                    Price
                  </Label>
                  <Input
                    className={inputClass}
                    id={`pkg-price-${pkg.id}`}
                    onChange={(e) =>
                      updatePackage(pkg.id, { price: e.target.value })
                    }
                    placeholder="$9,500"
                    value={pkg.price}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass} htmlFor={`pkg-note-${pkg.id}`}>
                    Price note
                  </Label>
                  <Input
                    className={inputClass}
                    id={`pkg-note-${pkg.id}`}
                    onChange={(e) =>
                      updatePackage(pkg.id, { priceNote: e.target.value })
                    }
                    placeholder="fixed"
                    value={pkg.priceNote}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass} htmlFor={`pkg-time-${pkg.id}`}>
                  Timeline
                </Label>
                <Input
                  className={inputClass}
                  id={`pkg-time-${pkg.id}`}
                  onChange={(e) =>
                    updatePackage(pkg.id, { timeline: e.target.value })
                  }
                  placeholder="6 to 8 weeks"
                  value={pkg.timeline}
                />
              </div>

              <div className="space-y-2">
                <Label className={labelClass} htmlFor={`pkg-for-${pkg.id}`}>
                  Best for
                </Label>
                <Input
                  className={inputClass}
                  id={`pkg-for-${pkg.id}`}
                  onChange={(e) =>
                    updatePackage(pkg.id, { bestFor: e.target.value })
                  }
                  value={pkg.bestFor}
                />
              </div>

              <div className="space-y-2">
                <Label className={labelClass} htmlFor={`pkg-inc-${pkg.id}`}>
                  Includes (one per line)
                </Label>
                <textarea
                  className={textareaClass}
                  id={`pkg-inc-${pkg.id}`}
                  onChange={(e) =>
                    updatePackage(pkg.id, {
                      includes: e.target.value.split("\n"),
                    })
                  }
                  value={pkg.includes.join("\n")}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className={labelClass} htmlFor={`pkg-rev-${pkg.id}`}>
                    Revisions
                  </Label>
                  <Input
                    className={inputClass}
                    id={`pkg-rev-${pkg.id}`}
                    onChange={(e) =>
                      updatePackage(pkg.id, { revisions: e.target.value })
                    }
                    placeholder="2 rounds"
                    value={pkg.revisions}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass} htmlFor={`pkg-pay-${pkg.id}`}>
                    Payment
                  </Label>
                  <Input
                    className={inputClass}
                    id={`pkg-pay-${pkg.id}`}
                    onChange={(e) =>
                      updatePackage(pkg.id, { payment: e.target.value })
                    }
                    placeholder="50% to start"
                    value={pkg.payment}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={fieldsetTitleClass}>Add-ons</h3>
          <Button
            onClick={() => onChange({ addOns: [...doc.addOns, emptyAddOn()] })}
            type="button"
            variant="ghost"
          >
            <Plus size={14} /> Add
          </Button>
        </div>
        {doc.addOns.map((addOn) => (
          <div
            className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]"
            key={addOn.id}
          >
            <Input
              aria-label="Add-on name"
              className={inputClass}
              onChange={(e) => updateAddOn(addOn.id, { name: e.target.value })}
              placeholder="Landing page built in Framer"
              value={addOn.name}
            />
            <Input
              aria-label="Add-on price"
              className={inputClass}
              onChange={(e) => updateAddOn(addOn.id, { price: e.target.value })}
              placeholder="+$1,500"
              value={addOn.price}
            />
            <Button
              aria-label="Remove add-on"
              onClick={() =>
                onChange({
                  addOns: doc.addOns.filter((a) => a.id !== addOn.id),
                })
              }
              type="button"
              variant="ghost"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </section>
    </>
  );
}
