import { useState } from "react";
import { toast } from "sonner";
import { MAX_BATCH_COUNT } from "../../../config/nodes/limits.js";
import {
  buildLogoBoard,
  type LogoBrief,
  logoBoardTitle,
} from "../../boards/logo/buildLogoBoard";
import {
  DEFAULT_LOGO_MODEL,
  DEFAULT_LOGO_STYLES,
  LOGO_MODELS,
  LOGO_STYLES,
  type LogoModelId,
  type LogoStyleId,
} from "../../boards/logo/logoStyles";
import { useBrandKits } from "../../hooks/useBrandKits";
import posthog from "../../lib/posthog";
import { boardsApi } from "../../services/portfolioService";
import type { Board } from "../../types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { LogoColorPicker } from "./LogoColorPicker";
import "./LogoBoardDialog.css";

/**
 * The brief for a new logo board.
 *
 * Only what the board can't guess: the name, what it is for, which directions
 * to start, and optionally a brand kit to pull colours from. Everything after
 * this happens on the board — the prompt, the model and the count are all
 * ordinary node settings there, editable like any others.
 *
 * Two calls rather than one, the shape useProofBoard and copyFrameToBoard use:
 * boards are created empty and the arrangement follows in an ordinary save. If
 * the second fails the board still exists, empty, and the error says so.
 */
export function LogoBoardDialog({
  onClose,
  onCreated,
  open,
}: {
  onClose: () => void;
  onCreated: (board: Board) => void;
  open: boolean;
}) {
  const { kits } = useBrandKits();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [brandKitId, setBrandKitId] = useState("");
  const [styles, setStyles] = useState<LogoStyleId[]>(DEFAULT_LOGO_STYLES);
  const [iterations, setIterations] = useState(5);
  const [model, setModel] = useState<LogoModelId>(DEFAULT_LOGO_MODEL);
  const [busy, setBusy] = useState(false);

  const toggle = (id: LogoStyleId) =>
    setStyles((current) =>
      current.includes(id)
        ? current.filter((s) => s !== id)
        : // Kept in the list's own order, so the board reads the same way.
          LOGO_STYLES.map((s) => s.id).filter(
            (s) => s === id || current.includes(s)
          )
    );

  const total = styles.length * iterations;
  const ready = name.trim().length > 0 && styles.length > 0 && !busy;

  const create = async () => {
    if (!ready) {
      return;
    }
    const brief: LogoBrief = {
      brandKitId: brandKitId || null,
      colors,
      description,
      iterations,
      model,
      name,
      styles,
    };
    setBusy(true);
    let board: Board | null = null;
    try {
      board = await boardsApi.create(logoBoardTitle(brief));
      await boardsApi.update(board.id, buildLogoBoard(brief));
      posthog.capture("logo_board_created", {
        directions: styles.length,
        iterations,
        model,
        with_brand_kit: Boolean(brief.brandKitId),
      });
      onCreated(board);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      toast.error(
        board
          ? `The board was created but could not be laid out: ${reason}`
          : `Could not create the board: ${reason}`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!(next || busy)) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="admin-dialog logo-board-dialog">
        <DialogHeader>
          <DialogTitle className="admin-dialog__title">
            New logo board
          </DialogTitle>
          <DialogDescription className="admin-dialog__body">
            Your brief runs through an Iterate node, one line per direction,
            into a single Generate. One Run makes every direction; drag the
            keepers into Picks.
          </DialogDescription>
        </DialogHeader>

        <form
          className="logo-board-dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="logo-board-dialog__field" htmlFor="logo-name">
            <span className="admin-label admin-label--quiet">Name</span>
            <input
              autoFocus
              className="admin-field"
              id="logo-name"
              name="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Back Acres"
              value={name}
            />
          </label>

          <label
            className="logo-board-dialog__field"
            htmlFor="logo-description"
          >
            <span className="admin-label admin-label--quiet">
              What it's for
            </span>
            <textarea
              className="admin-field logo-board-dialog__textarea"
              id="logo-description"
              name="description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short-term rental on five acres outside Amarillo. Quiet, a little rustic."
              rows={3}
              value={description}
            />
          </label>

          <label className="logo-board-dialog__field" htmlFor="logo-kit">
            <span className="admin-label admin-label--quiet">Brand kit</span>
            <select
              className="admin-field"
              id="logo-kit"
              name="brandKitId"
              onChange={(e) => setBrandKitId(e.target.value)}
              value={brandKitId}
            >
              <option value="">None — pick colours below</option>
              {kits.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                </option>
              ))}
            </select>
          </label>

          <div className="logo-board-dialog__field">
            <span className="admin-label admin-label--quiet">Colours</span>
            <LogoColorPicker
              colors={colors}
              kit={kits.find((kit) => kit.id === brandKitId) ?? null}
              onChange={setColors}
            />
          </div>

          <fieldset className="logo-board-dialog__styles">
            <legend className="admin-label admin-label--quiet">Model</legend>
            {LOGO_MODELS.map((option) => (
              <label
                className={`logo-board-dialog__style ${
                  model === option.id ? "logo-board-dialog__style--on" : ""
                }`}
                htmlFor={`logo-model-${option.id}`}
                key={option.id}
              >
                <input
                  checked={model === option.id}
                  className="logo-board-dialog__check"
                  id={`logo-model-${option.id}`}
                  name="model"
                  onChange={() => setModel(option.id)}
                  type="radio"
                  value={option.id}
                />
                {option.label}
              </label>
            ))}
            <p className="admin-note logo-board-dialog__hint">
              {LOGO_MODELS.find((option) => option.id === model)?.hint}
            </p>
          </fieldset>

          <fieldset className="logo-board-dialog__styles">
            <legend className="admin-label admin-label--quiet">
              Directions
            </legend>
            {LOGO_STYLES.map((style) => (
              <label
                className={`logo-board-dialog__style ${
                  styles.includes(style.id)
                    ? "logo-board-dialog__style--on"
                    : ""
                }`}
                htmlFor={`logo-style-${style.id}`}
                key={style.id}
              >
                <input
                  checked={styles.includes(style.id)}
                  className="logo-board-dialog__check"
                  id={`logo-style-${style.id}`}
                  name="styles"
                  onChange={() => toggle(style.id)}
                  type="checkbox"
                  value={style.id}
                />
                {style.label}
              </label>
            ))}
          </fieldset>

          <label className="logo-board-dialog__field" htmlFor="logo-iterations">
            <span className="admin-label admin-label--quiet">
              Variations per direction
            </span>
            <span className="logo-board-dialog__count">
              <input
                className="logo-board-dialog__range"
                id="logo-iterations"
                max={MAX_BATCH_COUNT}
                min={1}
                name="iterations"
                onChange={(e) => setIterations(Number(e.target.value))}
                type="range"
                value={iterations}
              />
              <span className="admin-note">
                {iterations} each · {total} logos when all run
              </span>
            </span>
          </label>

          <DialogFooter className="row row--tight">
            <Button
              disabled={busy}
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={!ready} type="submit" variant="outline">
              {busy ? "Creating…" : "Create board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
