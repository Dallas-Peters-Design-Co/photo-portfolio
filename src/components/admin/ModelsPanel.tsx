import AiBrain01Icon from "@hugeicons-pro/core-stroke-standard/AiBrain01Icon";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTrainingWatch } from "../../boards/hooks/useTrainingWatch";
import { modelsApi } from "../../services/portfolioService";
import type { AiModel } from "../../types";
import { Button } from "../ui/button";
import {
  AdminEmpty,
  AdminList,
  AdminListNote,
  AdminListPage,
} from "./AdminList";
import { useConfirm } from "./ConfirmProvider";
import { ModelForm } from "./ModelForm";
import { ModelRow } from "./ModelRow";

/**
 * The models a Generate node may use, editable without code.
 *
 * The list is data: add a model here with its exact fal id and it appears in
 * every node's picker and is accepted by the run endpoint. "auto" is the
 * default and is protected — it cannot be deleted, disabled, or given a
 * different shape.
 */
export function ModelsPanel() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [editing, setEditing] = useState<AiModel | "new" | null>(null);
  const { confirm } = useConfirm();

  const close = useCallback(() => setEditing(null), []);

  const refresh = useCallback(async () => {
    try {
      setModels(await modelsApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load models");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
   * Collects a training that lands while this panel is open.
   *
   * The same hook the board mounts, rather than a second copy of the polling.
   * The panel had the only implementation for a while, which is exactly why a
   * training started from a board was never collected — see useTrainingWatch.
   */
  useTrainingWatch(true, refresh);

  const saved = useCallback(() => {
    setEditing(null);
    void refresh();
  }, [refresh]);

  const handleRemoved = async (model: AiModel): Promise<void> => {
    const ok = await confirm({
      confirmLabel: "Delete",
      description:
        "Boards already set to this model fall back to Auto. This cannot be undone.",
      destructive: true,
      title: `Delete "${model.label}"?`,
    });
    if (!ok) {
      return;
    }
    try {
      await modelsApi.remove(model.id);
      toast.success("Model deleted");
      void refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete that model"
      );
    }
  };

  const handleToggled = async (model: AiModel): Promise<void> => {
    try {
      await modelsApi.update(model.id, { enabled: !model.enabled });
      void refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not toggle that model"
      );
    }
  };

  const handleMoved = async (id: string, direction: -1 | 1): Promise<void> => {
    const index = models.findIndex((model) => model.id === id);
    const other = models[index + direction];
    if (index < 0 || !other) {
      return;
    }
    try {
      await modelsApi.update(id, { sortOrder: other.sortOrder });
      await modelsApi.update(other.id, { sortOrder: models[index].sortOrder });
      void refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not reorder models"
      );
    }
  };

  return (
    <AdminListPage
      action={
        <Button
          onClick={() =>
            setEditing((current) => (current === "new" ? null : "new"))
          }
          type="button"
          variant="ghost"
        >
          {editing === "new" ? <X size={14} /> : <Plus size={14} />}
          {editing === "new" ? "Cancel" : "Add model"}
        </Button>
      }
      icon={AiBrain01Icon}
      title="Models"
    >
      <AdminListNote>
        These are the models a Generate node may use. Add a fal.ai model id,
        give it a label and its input shape, and it appears in every node
        without a code change.
      </AdminListNote>

      {/* A new model has no row to sit under, so it opens where the button
          that asked for it is. */}
      {editing === "new" ? (
        <ModelForm editing={null} onCancel={close} onSaved={saved} />
      ) : null}

      {models.length === 0 ? (
        <AdminEmpty>No models yet.</AdminEmpty>
      ) : (
        <AdminList>
          {models.map((model, index) => (
            <ModelRow
              // Under the row it belongs to, rather than above the whole list.
              // With thirty models the form opened somewhere off screen and
              // pressing Edit looked like it had done nothing — and the row it
              // was editing was nowhere near the fields describing it.
              below={
                editing !== "new" && editing?.id === model.id ? (
                  <ModelForm editing={model} onCancel={close} onSaved={saved} />
                ) : null
              }
              isFirst={index === 0}
              isLast={index === models.length - 1}
              key={model.id}
              model={model}
              onEdit={() => setEditing(model)}
              onMoved={(id, direction) => void handleMoved(id, direction)}
              onRemoved={(m) => void handleRemoved(m)}
              onToggled={(m) => void handleToggled(m)}
            />
          ))}
        </AdminList>
      )}
    </AdminListPage>
  );
}
