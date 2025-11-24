import React from 'react';
import { useOnViewportChange, useReactFlow } from '@xyflow/react';
import useFlowStore from '../../../store/flowStore';
import styles from './index.module.scss';

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

const mapBoundsToViewport = (bounds, viewport) => {
  if (!bounds || !viewport) {
    return null;
  }
  const zoom = viewport.zoom ?? 1;
  return {
    left: bounds.x * zoom + (viewport.x ?? 0),
    top: bounds.y * zoom + (viewport.y ?? 0),
    width: bounds.width * zoom,
    height: bounds.height * zoom,
  };
};

function GroupOverlayLayer() {
  const groups = useFlowStore((state) => state.groups);
  const selectedGroupId = useFlowStore((state) => state.selectedGroupId);
  const selectGroup = useFlowStore((state) => state.selectGroup);
  const renameGroup = useFlowStore((state) => state.renameGroup);
  const reactFlow = useReactFlow();
  const [viewport, setViewport] = React.useState(() => {
    const initial = reactFlow?.getViewport?.();
    if (initial && typeof initial.zoom === 'number') {
      return initial;
    }
    return DEFAULT_VIEWPORT;
  });

  const [editingGroupId, setEditingGroupId] = React.useState(null);
  const [draftTitle, setDraftTitle] = React.useState('');

  useOnViewportChange({
    onChange: setViewport,
  });

  const startEditingTitle = React.useCallback((group) => {
    if (!group) {
      return;
    }
    setEditingGroupId(group.id);
    setDraftTitle(group.title || '');
  }, []);

  const commitEditingTitle = React.useCallback(() => {
    if (!editingGroupId) {
      return;
    }
    renameGroup(editingGroupId, draftTitle);
    setEditingGroupId(null);
    setDraftTitle('');
  }, [editingGroupId, draftTitle, renameGroup]);

  const cancelEditingTitle = React.useCallback(() => {
    setEditingGroupId(null);
    setDraftTitle('');
  }, []);

  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <div className={styles.overlayRoot}>
      {groups.map((group) => {
        const rect = mapBoundsToViewport(group.bounds, viewport);
        if (!rect) {
          return null;
        }

        const startResize = (direction) => (event) => {
          selectGroup(group.id);
          event.preventDefault();
          event.stopPropagation();

          const zoom = viewport.zoom ?? 1;
          const startPoint = { x: event.clientX, y: event.clientY };
          const store = useFlowStore.getState();

          const initialBounds = {
            x: group.bounds?.x ?? 0,
            y: group.bounds?.y ?? 0,
            width: group.bounds?.width ?? group.minWidth ?? 200,
            height: group.bounds?.height ?? group.minHeight ?? 160,
          };

          const minWidth = Math.max(160, group.minWidth ?? 160);
          const minHeight = Math.max(120, group.minHeight ?? 120);

          store.setPanLocked?.(true);

          const handlePointerMove = (moveEvent) => {
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            const deltaX = (moveEvent.clientX - startPoint.x) / zoom;
            const deltaY = (moveEvent.clientY - startPoint.y) / zoom;

            let nextX = initialBounds.x;
            let nextY = initialBounds.y;
            let nextWidth = initialBounds.width;
            let nextHeight = initialBounds.height;

            if (direction.left) {
              const rawWidth = initialBounds.width - deltaX;
              const clampedWidth = Math.max(minWidth, rawWidth);
              const applied = initialBounds.width - clampedWidth;
              nextWidth = clampedWidth;
              nextX = initialBounds.x + applied;
            }

            if (direction.right) {
              const rawWidth = initialBounds.width + deltaX;
              nextWidth = Math.max(minWidth, rawWidth);
            }

            if (direction.top) {
              const rawHeight = initialBounds.height - deltaY;
              const clampedHeight = Math.max(minHeight, rawHeight);
              const applied = initialBounds.height - clampedHeight;
              nextHeight = clampedHeight;
              nextY = initialBounds.y + applied;
            }

            if (direction.bottom) {
              const rawHeight = initialBounds.height + deltaY;
              nextHeight = Math.max(minHeight, rawHeight);
            }

            const currentStore = useFlowStore.getState();
            currentStore.setGroupBounds(group.id, {
              x: nextX,
              y: nextY,
              width: nextWidth,
              height: nextHeight,
            });
          };

          const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            const currentStore = useFlowStore.getState();
            currentStore.recalculateGroupBounds(group.id);
            currentStore.setPanLocked?.(false);
          };

          window.addEventListener('pointermove', handlePointerMove);
          window.addEventListener('pointerup', handlePointerUp, { once: true });
        };

        const startGroupDrag = (event) => {
          selectGroup(group.id);
          event.preventDefault();
          event.stopPropagation();

          const zoom = viewport.zoom ?? 1;
          const startPoint = { x: event.clientX, y: event.clientY };
          const store = useFlowStore.getState();
          store.setPanLocked?.(true);
          const childSet = new Set(group.childNodeIds || []);

          const initialBounds = {
            x: group.bounds?.x ?? 0,
            y: group.bounds?.y ?? 0,
            width: group.bounds?.width ?? 0,
            height: group.bounds?.height ?? 0,
          };

          const initialPositions = new Map();
          store.nodes.forEach((node) => {
            if (childSet.has(node.id)) {
              const base = node.position || { x: 0, y: 0 };
              initialPositions.set(node.id, { ...base });
            }
          });

          const handlePointerMove = (moveEvent) => {
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            const deltaX = (moveEvent.clientX - startPoint.x) / zoom;
            const deltaY = (moveEvent.clientY - startPoint.y) / zoom;

            const currentStore = useFlowStore.getState();
            const updatedNodes = currentStore.nodes.map((node) => {
              if (!childSet.has(node.id)) {
                return node;
              }
              const base = initialPositions.get(node.id) || node.position || { x: 0, y: 0 };
              return {
                ...node,
                position: {
                  x: base.x + deltaX,
                  y: base.y + deltaY,
                },
              };
            });

                currentStore.setNodes(updatedNodes);
                if (reactFlow && typeof reactFlow.setNodes === 'function') {
                  reactFlow.setNodes(updatedNodes);
                }
            currentStore.setGroupBounds(group.id, {
              x: initialBounds.x + deltaX,
              y: initialBounds.y + deltaY,
              width: initialBounds.width,
              height: initialBounds.height,
            });
          };

          const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            const currentStore = useFlowStore.getState();
            currentStore.recalculateGroupBounds(group.id);
            currentStore.setPanLocked?.(false);
          };

          window.addEventListener('pointermove', handlePointerMove);
          window.addEventListener('pointerup', handlePointerUp, { once: true });
        };

        const frameClassName = `${styles.frame} ${selectedGroupId === group.id ? styles.frameActive : ''}`;
        const headerClassName = `${styles.header} ${selectedGroupId === group.id ? styles.headerActive : ''}`;
        const isEditing = editingGroupId === group.id;
        const shouldEmbedTitle = (viewport.zoom ?? 1) <= 0.5;

        return (
          <React.Fragment key={group.id}>
            <div
              className={styles.dragSurface}
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
              onPointerDown={startGroupDrag}
            />
            <div
              className={frameClassName}
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
            />
            <div
              className={`${styles.edge} ${styles.edgeTop}`}
              style={{
                left: rect.left - 4,
                top: rect.top - 6,
                width: rect.width + 8,
              }}
              onPointerDown={startResize({ top: true })}
            />
            <div
              className={`${styles.edge} ${styles.edgeBottom}`}
              style={{
                left: rect.left - 4,
                top: rect.top + rect.height - 6,
                width: rect.width + 8,
              }}
              onPointerDown={startResize({ bottom: true })}
            />
            <div
              className={`${styles.edge} ${styles.edgeLeft}`}
              style={{
                left: rect.left - 6,
                top: rect.top - 4,
                height: rect.height + 8,
              }}
              onPointerDown={startResize({ left: true })}
            />
            <div
              className={`${styles.edge} ${styles.edgeRight}`}
              style={{
                left: rect.left + rect.width - 6,
                top: rect.top - 4,
                height: rect.height + 8,
              }}
              onPointerDown={startResize({ right: true })}
            />
            <div
              className={`${styles.corner} ${styles.cornerTopLeft}`}
              style={{
                left: rect.left - 8,
                top: rect.top - 8,
              }}
              onPointerDown={startResize({ top: true, left: true })}
            />
            <div
              className={`${styles.corner} ${styles.cornerTopRight}`}
              style={{
                left: rect.left + rect.width - 8,
                top: rect.top - 8,
              }}
              onPointerDown={startResize({ top: true, right: true })}
            />
            <div
              className={`${styles.corner} ${styles.cornerBottomLeft}`}
              style={{
                left: rect.left - 8,
                top: rect.top + rect.height - 8,
              }}
              onPointerDown={startResize({ bottom: true, left: true })}
            />
            <div
              className={`${styles.corner} ${styles.cornerBottomRight}`}
              style={{
                left: rect.left + rect.width - 8,
                top: rect.top + rect.height - 8,
              }}
              onPointerDown={startResize({ bottom: true, right: true })}
            />
            {shouldEmbedTitle ? (
              <div
                className={styles.titleOverlay}
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startEditingTitle(group);
                }}
              >
                {isEditing ? (
                  <input
                    className={styles.titleInputInline}
                    value={draftTitle}
                    autoFocus
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={commitEditingTitle}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitEditingTitle();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelEditingTitle();
                      }
                    }}
                  />
                ) : (
                  <span className={styles.titleInlineText}>{group.title || '分组'}</span>
                )}
              </div>
            ) : (
              <div
                className={headerClassName}
                style={{
                  left: rect.left,
                  top: rect.top - 32,
                }}
                onPointerDown={(event) => {
                  if (isEditing) {
                    return;
                  }
                  startGroupDrag(event);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startEditingTitle(group);
                }}
              >
                {isEditing ? (
                  <input
                    className={styles.titleInput}
                    value={draftTitle}
                    autoFocus
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={commitEditingTitle}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitEditingTitle();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelEditingTitle();
                      }
                    }}
                  />
                ) : (
                  <>
                    <span className={styles.titleText}>{group.title || '分组'}</span>
                    <span className={styles.count}>共 {group.childNodeIds?.length ?? 0} 个节点</span>
                  </>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default GroupOverlayLayer;

