import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
} from "../../../config/canvas.js";
import { BoardCanvas } from "../../boards/BoardCanvas";
import { BoardProviders } from "../../boards/BoardProviders";
import { FloatingTools } from "../../boards/canvas/FloatingTools";
import { useColorVarsDoc } from "../../boards/colorVars/ColorVarsContext";
import type { DrawStyle } from "../../boards/drawing/DrawToolbar";
import {
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  type DrawTool,
  NO_FILL,
} from "../../boards/drawing/drawing";
import { FrameOpenProvider, frameLink } from "../../boards/FrameOpenContext";
import { useBoardHistory } from "../../boards/hooks/useBoardHistory";
import { useGraphRun } from "../../boards/hooks/useGraphRun";
import { useVideoNode, useVideoRunner } from "../../boards/hooks/useVideoNode";
import { CommentsPanel } from "../../boards/panels/CommentsPanel";
import { ElementModal } from "../../boards/panels/ElementModal";
import { InsertPalette } from "../../boards/panels/InsertPalette";
import type { BoardComment } from "../../services/comments";
import type {
  Board,
  BoardItem,
  BoardSource,
  BoardWire,
  Photo,
} from "../../types";
import { BoardEditorDialogs } from "./BoardEditorDialogs";
import { BoardInsertPanel } from "./BoardInsertPanel";
import { CustomCursor } from "./CustomCursor";
import "./BoardEditor.css";

import { BoardHeaderActions } from "./boardEditor/BoardHeaderActions";
import { BoardHeaderPanel } from "./boardEditor/BoardHeaderPanel";
import { BoardStatusBar } from "./boardEditor/BoardStatusBar";
import { BoardToolPanel } from "./boardEditor/BoardToolPanel";
import { useBoardDocument } from "./boardEditor/useBoardDocument";
import { useBoardInserts } from "./boardEditor/useBoardInserts";
import { useBoardItemActions } from "./boardEditor/useBoardItemActions";
import { useBoardItemEdits } from "./boardEditor/useBoardItemEdits";
import { useBoardRun } from "./boardEditor/useBoardRun";
import { useBoardUploads } from "./boardEditor/useBoardUploads";
import { useBoardVectorTools } from "./boardEditor/useBoardVectorTools";
import { useDropPoint } from "./boardEditor/useDropPoint";
import { useFrameDesign } from "./boardEditor/useFrameDesign";
import { useProofMark } from "./boardEditor/useProofMark";
import { useRecipes } from "./boardEditor/useRecipes";
import { useSelectedItem } from "./boardEditor/useSelectedItem";

/**
 * Full-screen board editor. Saves on a debounce rather than behind a button:
 * a drag has no natural moment where a person would think to press save. The
 * unsaved marker is what makes that honest.
 */
export function BoardEditor({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { dropPoint, viewCentreRef } = useDropPoint();
  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [wires, setWires] = useState<BoardWire[]>([]);
  const [sources, setSources] = useState<BoardSource[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  /**
   * Whether the board has actually arrived.
   *
   * The save replaces the whole arrangement, and `items` starts empty — so a
   * save that runs before the load lands writes an empty board and deletes
   * every item on it. Nothing may be written until there is something to
   * compare against.
   */
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  /**
   * The selection waiting to be named, or null. Held here, not in the modal:
   * what is saved should be what was chosen when it was chosen.
   */
  const [elementDraft, setElementDraft] = useState<{
    description: string;
    images: string[];
  } | null>(null);
  /**
   * Which tab the insert panel opens on (undefined: its own default). Naming
   * an element ends on its library, so it can be placed without hunting.
   */
  const [pickAt, setPickAt] = useState<"elements" | undefined>();
  const history = useBoardHistory();
  const [drawTool, setDrawTool] = useState<DrawTool | null>(null);
  const selection = useSelectedItem(items);
  const [drawStyle, setDrawStyle] = useState<DrawStyle>({
    fill: NO_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  });

  // Saved items are keyed by id, unsaved by their creation key; both survive edits.
  const keyOf = useCallback((item: BoardItem) => item.id, []);

  const {
    attachSource,
    change,
    close,
    displayName,
    changeConfig,
    changeWires,
    detachSource,
    pending,
    publicUrl,
    publish,
    rename,
    save,
    saveColorVars,
  } = useBoardDocument({
    board,
    boardId,
    history,
    isDirty,
    isLoaded,
    items,
    setBoard,
    setComments,
    setDrawTool,
    setIsDirty,
    setIsInserting,
    setIsLoaded,
    setIsPublishing,
    setIsSaving,
    setItems,
    setPhotos,
    setSources,
    setWires,
    sources,
    wires,
  });

  const { proofMark } = useProofMark(items, change, dropPoint);
  const { applyRun, createFromPort, flushBeforeRun } = useBoardRun({
    items,
    pending,
    save,
    setIsDirty,
    setItems,
    setWires,
    wires,
  });

  const videoRun = useVideoRunner(boardId, items, wires, change);
  const graphRun = useGraphRun({
    beforeRun: flushBeforeRun,
    boardId,
    items,
    onPatch: applyRun,
    runVideo: videoRun,
    wires,
  });

  useEffect(() => {
    if (graphRun.error) {
      toast.error(graphRun.error);
    }
  }, [graphRun.error]);
  const runNode = useVideoNode(items, videoRun, graphRun.runNode);

  const { placeRecipe, recipes, saveRecipe, uses } = useRecipes({
    board,
    boardId,
    dropPoint,
    flush: flushBeforeRun,
    items,
    setItems,
    setWires,
  });

  const {
    addElement,
    addExternal,
    addFrame,
    addNode,
    addPhoto,
    addShader,
    addWritable,
    autoArrange,
    beginElement,
    exportItem,
    groupIntoFrame,
  } = useBoardInserts({
    boardId,
    change,
    dropPoint,
    items,
    setAutoEditId,
    setElementDraft,
    setIsPicking,
    viewCentreRef,
    wires,
  });

  const { dropFiles, importSvg, pendingSvg, setPendingSvg } = useBoardUploads({
    change,
    items,
  });
  const frameDesign = useFrameDesign(items, change, dropFiles, dropPoint);

  const {
    addDrawing,
    addMaskStroke,
    changeMask,
    copyFrameToBoard,
    dropImage,
    removeVersion,
    trainOnFrame,
  } = useBoardItemEdits({
    boardId,
    change,
    items,
    navigate,
    setDrawTool,
    setIsDirty,
    setItems,
    wires,
  });

  const {
    bringToFront,
    shaderActions,
    canvaTarget,
    openSendToCanva,
    resolveComment,
    sendToBack,
    sendVersions,
    setCanvaTarget,
  } = useBoardItemActions({
    addExternal,
    boardId,
    change,
    dropPoint,
    items,
    setComments,
    wires,
  });

  const { editorNode, itemTools, openEditor } = useBoardVectorTools({
    boardId,
    graphRun,
    items,
    pending,
    save,
    setIsDirty,
    setItems,
    setWires,
  });

  const colours = useColorVarsDoc(
    board?.colorVars,
    pending,
    change,
    saveColorVars
  );
  return (
    <BoardProviders boardId={boardId} colours={colours}>
      {/* `text-board-ink` establishes the board's own writing color for
          everything inside. Without it the subtree inherits the *site's*
          foreground — the branded near-white that SiteSettingsProvider pins to
          <html> — so anything without an explicit color came out white on a
          white board. The site's palette is right for the site and has no say
          here. */}
      {/* data-surface re-points --btn-* at the board's ink (see index.css). */}
      <CustomCursor cursorColor="#9100FF" userName={displayName} />
      <div
        className="board"
        data-editing={editorNode ? "" : undefined}
        data-surface="board"
      >
        {/* Wraps rather than overflowing: the palette has grown past what fits on
          one line at laptop width, and a row of shrink-0 buttons pushed Publish
          and Close off the edge instead of moving them down. */}
        <BoardStatusBar
          isDirty={isDirty}
          isSaving={isSaving}
          onRename={() => void rename()}
          onSwitch={(to) => void close(() => navigate(to))}
          title={board?.title ?? "Board"}
        />

        <BoardHeaderPanel>
          <BoardHeaderActions
            commentCount={comments.length}
            hasNodes={items.some((item) => item.kind === "op")}
            isPublic={board?.isPublic ?? false}
            isPublishing={isPublishing}
            isRunning={graphRun.isRunning}
            items={items}
            onCancelRun={() => graphRun.cancel()}
            onClose={() => void close(onClose)}
            onPublish={() => void publish(!board?.isPublic)}
            onRun={() => void graphRun.runBoard()}
            onToggleComments={() => setShowComments((open) => !open)}
            publicUrl={publicUrl}
            showComments={showComments}
          />
        </BoardHeaderPanel>

        {/* The layer every board overlay belongs in. Named so a panel escaping
            its own transform has somewhere to escape to — see ElementsTab. */}
        <div className="board__overlays" data-board-overlays>
          <FloatingTools
            drawStyle={drawStyle}
            drawTool={drawTool}
            items={items}
            onConfigChange={changeConfig}
            onMaskChange={changeMask}
            onStyle={setDrawStyle}
            onTool={setDrawTool}
            selected={selection.item}
            shaderActions={shaderActions}
            wires={wires}
          />

          <BoardToolPanel
            onAddFrame={addFrame}
            onAddNode={addNode}
            onAddWritable={addWritable}
            onInsertImage={addExternal}
            onTogglePicker={() => setIsPicking((v) => !v)}
          />

          {/* Frame actions, and its link once published (nothing to open). */}
          <FrameOpenProvider
            designFrame={frameDesign.designFrame}
            duplicateFrame={frameDesign.duplicateFrame}
            fitFrame={frameDesign.fitFrame}
            linkFor={(id) => frameLink(publicUrl, items, id)}
            onTrainOnFrame={(id) => void trainOnFrame(id)}
            resetScale={frameDesign.resetScale}
          >
            <BoardCanvas
              autoEditId={autoEditId}
              boardId={boardId}
              comments={comments}
              drawStyle={drawStyle}
              drawTool={drawTool}
              items={items}
              keyOf={keyOf}
              onAddEffects={itemTools.addEffects}
              onArrangeFrame={autoArrange}
              onBringToFront={bringToFront}
              onCancel={graphRun.cancel}
              onChange={change}
              onConfigChange={changeConfig}
              onCopyFrame={(frames, to) => void copyFrameToBoard(frames, to)}
              onCreateFromPort={createFromPort}
              onDraw={addDrawing}
              onDrawTool={setDrawTool}
              onDropFiles={(files, point) => void dropFiles(files, point)}
              onDropImage={dropImage}
              onEditImage={openEditor}
              onExportItem={(itemId) => void exportItem(itemId)}
              onGroupIntoFrame={groupIntoFrame}
              onMaskStroke={addMaskStroke}
              onOpenInAffinity={itemTools.openInAffinity}
              onProofMark={(id) => void proofMark(id)}
              onRemoveVersion={(itemId, index) =>
                void removeVersion(itemId, index)
              }
              onRun={(itemId, force) => void runNode(itemId, force)}
              onSaveElement={beginElement}
              onSaveRecipe={(chosen, name) => void saveRecipe(chosen, name)}
              onSelectionChange={selection.select}
              onSendToBack={sendToBack}
              onSendToCanva={openSendToCanva}
              onSendVersions={sendVersions}
              onVectorize={itemTools.vectorize}
              onWiresChange={changeWires}
              recipeUses={uses}
              viewCentreRef={viewCentreRef}
              wires={wires}
            />
            {frameDesign.designer}
          </FrameOpenProvider>

          <BoardEditorDialogs
            canvaTarget={canvaTarget}
            onCloseCanva={() => setCanvaTarget(null)}
            onDismissSvg={() => setPendingSvg(null)}
            onImportSvg={importSvg}
            pendingSvg={pendingSvg}
          />

          {showComments ? (
            <CommentsPanel
              comments={comments}
              items={items}
              onClose={() => setShowComments(false)}
              onResolve={(commentId, resolved) =>
                void resolveComment(commentId, resolved)
              }
            />
          ) : null}

          {isInserting ? (
            <InsertPalette
              onChoose={(action) => {
                setIsInserting(false);
                if (action.kind === "recipe") {
                  void placeRecipe(action.recipeId);
                  return;
                }
                if (action.kind === "writable") {
                  addWritable(action.writable);
                } else if (action.kind === "frame") {
                  addFrame();
                } else if (action.kind === "node") {
                  addNode(action.nodeType);
                } else if (action.kind === "shader") {
                  addShader(action.name);
                } else {
                  // Images need a source chosen, so the palette hands over.
                  setIsPicking(true);
                }
              }}
              onDismiss={() => setIsInserting(false)}
              recipes={recipes}
            />
          ) : null}

          <AnimatePresence>
            {isPicking ? (
              <BoardInsertPanel
                initialTab={pickAt}
                onAddElement={(element) => {
                  addElement(element);
                  setIsPicking(false);
                }}
                onAddExternal={addExternal}
                onAddFiles={(files) =>
                  void dropFiles(
                    files,
                    dropPoint(items, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT)
                  )
                }
                onAddNode={addNode}
                onAddPhoto={addPhoto}
                onAddShader={addShader}
                onAttachSource={attachSource}
                onDetachSource={detachSource}
                photos={photos}
                setIsOpen={(open) => {
                  setIsPicking(open);
                  if (!open) {
                    // Cleared on close so the next opening starts on the first tab.
                    setPickAt(undefined);
                  }
                }}
                sources={sources}
              />
            ) : null}
          </AnimatePresence>

          {editorNode}

          {elementDraft ? (
            <ElementModal
              description={elementDraft.description}
              images={elementDraft.images}
              onCancel={() => setElementDraft(null)}
              onSaved={() => {
                // Ends on the library the element was just added to.
                setElementDraft(null);
                setPickAt("elements");
                setIsPicking(true);
              }}
            />
          ) : null}
        </div>
      </div>
    </BoardProviders>
  );
}
