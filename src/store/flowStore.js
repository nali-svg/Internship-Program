import { create } from 'zustand';
import { computeGroupLayout } from '../utils/groupLayout';

// 全局节点ID计数器，确保每个节点的data.id全局唯一
let nodeIdCounter = 0;

/**
 * Flow Store - 使用 Zustand 管理节点和连接线状态
 */
const useFlowStore = create((set, get) => ({
  // 节点数组
  nodes: [],
  
  // 连接线数组
  edges: [],
  
  // 选中的节点ID
  selectedNodeId: null,

  // 多选节点 ID 列表
  selectedNodeIds: [],

  // 当前选中的分组 ID
  selectedGroupId: null,

  // 是否启用多选模式
  isMultiSelectEnabled: false,

  // 是否锁定画布平移（用于组拖拽/缩放）
  isPanLocked: false,

  // 起始节点ID
  startNodeId: null,

  // 变量数组
  variables: [],

  /**
   * 设置变量列表
   * @param {Array} variables
   */
  setVariables: (variables = []) => {
    const normalized = Array.isArray(variables)
      ? variables.map((item) => ({ ...item }))
      : [];
    set({ variables: normalized });
  },

  /**
   * 添加视频节点
   * @param {Object} nodeData - 节点数据
   * @param {Object} position - 节点位置 { x, y }
   */
  addNode: (nodeData, position) => {
    const nodeId = `${Date.now()}_${nodeIdCounter++}`;
    const defaultPosition = position || { x: 250, y: 150 };
    const newNode = {
         id: `node_${nodeId}`,
         type: 'videoNode',
         position: defaultPosition,
         data: {
           id: nodeId,
           nodeName: '',
           videoFile: '无 (视频剪辑)',
           displayType: 'Auto',
           thumbnail: '无 (精灵)',
           videoThumbnail: null,  // 视频缩略图数据（base64）
           videoObjectUrl: null,  // 视频预览 URL（blob URL，仅会话有效）
           isCheckpoint: false,
           isExpanded: false,
        autoPlayNext: false,
        loop: false,
        volume: 1,
        waitSubtitle: false,
        isEndpoint: false,
        isDeathPoint: false,
        isBlackScreen: false,
        isMemory: false,
        isDialogue: false,
        showConditionOnFail: false,
        conditionDesc: '',
        showSubtitleEditor: false,
        subtitles: [],
        achievementName: '',
        unlockAchievement: false,
        isRandomNode: false,
        showVariableBar: false,
        variableName: '',
        defaultValue: 0,
        fillColor: '#ffffff',
        barPosition: '上',
        enableStats: false,
        statsKeyPoint: '',
        isJumpPoint: false,
        jumpPointId: '',
        jumpPointDesc: '',
        enableCommerce: false,
        activeTab: 'input',
        ...nodeData,
      },
    };
    
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode.id;
  },

  /**
   * 添加选项节点
   * @param {Object} nodeData - 节点数据
   * @param {Object} position - 节点位置 { x, y }
   */
  addOptionNode: (nodeData, position) => {
    const nodeId = `${Date.now()}_${nodeIdCounter++}`;
    const defaultPosition = position || { x: 250, y: 150 };
    const newNode = {
      id: `node_${nodeId}`,
      type: 'optionNode',
      position: defaultPosition,
      data: {
        id: nodeId,
        optionText: '',
        description: '',
        appearTime: 0,
        preDisplay: false,
        showWhenConditionNotMet: false,
        unavailableMessage: '',
        enableOverlayImage: false,
        optionClickable: false,
        layerIndex: 0,
        overlayImage: '无 (精灵)',
        overlayImagePreview: null,  // 叠加图片预览（base64）
        requiresAd: false,
        isRewardedVideo: false,
        conditions: [],
        effects: [],
        isCheckpoint: false,
        isExpanded: false,
        activeTab: 'input',
        ...nodeData,
      },
    };
    
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode.id;
  },

  /**
   * 添加BGM节点
   * @param {Object} nodeData - 节点数据
   * @param {Object} position - 节点位置 { x, y }
   */
  addBgmNode: (nodeData, position) => {
    const nodeId = `${Date.now()}_${nodeIdCounter++}`;
    const defaultPosition = position || { x: 250, y: 150 };
    const newNode = {
      id: `node_${nodeId}`,
      type: 'bgmNode',
      position: defaultPosition,
      data: {
        id: nodeId,
        audioFile: '♫ 无 (音频剪辑)',
        loop: false,
        volume: 1,
        fadeInTime: 0,
        fadeOutTime: 0,
        autoFadeOut: false,
        isCheckpoint: false,
        isExpanded: false,
        activeTab: 'input',
        ...nodeData,
      },
    };
    
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode.id;
  },

  /**
   * 添加卡牌节点
   * @param {Object} nodeData - 节点数据
   * @param {Object} position - 节点位置 { x, y }
   */
  addCardNode: (nodeData, position) => {
    const nodeId = `${Date.now()}_${nodeIdCounter++}`;
    const defaultPosition = position || { x: 250, y: 150 };
    const newNode = {
      id: `node_${nodeId}`,
      type: 'cardNode',
      position: defaultPosition,
      data: {
        id: nodeId,
        nodeName: '',
        cardImage: '无 (精灵)',
        cardSizeX: 200,
        cardSizeY: 300,
        fanAngle: 30,
        animationDuration: 0.5,
        description: '',
        showWhenConditionNotMet: false,
        preDisplay: false,
        unavailableMessage: '',
        effects: [],
        conditions: [],
        isCheckpoint: false,
        isExpanded: false,
        activeTab: 'input',
        ...nodeData,
      },
    };
    
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode.id;
  },

  /**
   * 添加跳转节点
   * @param {Object} nodeData - 节点数据
   * @param {Object} position - 节点位置 { x, y }
   */
  addJumpNode: (nodeData, position) => {
    const nodeId = `${Date.now()}_${nodeIdCounter++}`;
    const defaultPosition = position || { x: 250, y: 150 };
    const newNode = {
      id: `node_${nodeId}`,
      type: 'jumpNode',
      position: defaultPosition,
      data: {
        id: nodeId,
        jumpPointId: '',
        jumpPointDesc: '',
        jumpPointActive: false,
        isCheckpoint: false,
        isExpanded: false,
        activeTab: 'input',
        ...nodeData,
      },
    };
    
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode.id;
  },

  /**
   * 添加任务节点
   * @param {Object} nodeData - 节点数据
   * @param {Object} position - 节点位置 { x, y }
   */
  addTaskNode: (nodeData, position) => {
    const nodeId = `${Date.now()}_${nodeIdCounter++}`;
    const defaultPosition = position || { x: 250, y: 150 };
    const newNode = {
      id: `node_${nodeId}`,
      type: 'taskNode',
      position: defaultPosition,
      data: {
        id: nodeId,
        maxDisplayCount: 3,
        taskListInput: '',
        parsedTasks: [],
        isCheckpoint: false,
        isExpanded: false,
        activeTab: 'input',
        ...nodeData,
      },
    };
    
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode.id;
  },

  /**
   * 更新节点数据
   * @param {string} nodeId - 节点ID
   * @param {Object} nodeData - 更新的数据
   */
  updateNode: (nodeId, nodeData) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...nodeData } }
          : node
      ),
    }));
  },

  /**
   * 更新节点位置
   * @param {string} nodeId - 节点ID
   * @param {Object} position - 新位置 {x, y}
   */
  updateNodePosition: (nodeId, position) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node
      ),
    }));
  },

  /**
   * 删除节点
   * @param {string} nodeId - 节点ID
   */
  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    }));

    // 同步从多选与分组中移除
    get().setSelectedNodes((prev) => prev.filter((id) => id !== nodeId));
    get().removeNodesFromGroups([nodeId]);
  },

  /**
   * 添加连接线
   * @param {Object} connection - 连接数据 {source, target, sourceHandle, targetHandle}
   */
  addEdge: (connection) => {
    const newEdge = {
      id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'smooth', // 使用平滑的曲线连接线
      animated: false,
      style: { stroke: '#1890ff', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed',
        color: '#1890ff',
        width: 20,
        height: 20,
      },
    };
    
    set((state) => ({
      edges: [...state.edges, newEdge],
    }));
  },

  /**
   * 删除连接线
   * @param {string} edgeId - 连接线ID
   */
  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    }));
  },

  /**
   * 设置节点数组 (用于 React Flow 的 onNodesChange)
   * @param {Array} nodes - 新的节点数组
   */
  setNodes: (nodes) => {
    set({ nodes });
  },

  /**
   * 设置连接线数组 (用于 React Flow 的 onEdgesChange)
   * @param {Array} edges - 新的连接线数组
   */
  setEdges: (edges) => {
    set({ edges });
  },

  /**
   * 选中节点
   * @param {string} nodeId - 节点ID
   */
  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  /**
   * 设置多选节点数组
   * @param {string[]|function} nodeIds
   */
  setSelectedNodes: (nodeIds) => {
    if (typeof nodeIds === 'function') {
      set((state) => {
        const result = nodeIds([...state.selectedNodeIds]);
        const next = Array.isArray(result)
          ? Array.from(new Set(result.filter(Boolean)))
          : [];
        return { selectedNodeIds: next };
      });
      return;
    }

    const normalized = Array.isArray(nodeIds)
      ? Array.from(new Set(nodeIds.filter(Boolean)))
      : [];
    set({ selectedNodeIds: normalized });
  },

  /**
   * 切换节点的多选状态
   * @param {string} nodeId
   */
  toggleSelectedNode: (nodeId) => {
    if (!nodeId) {
      return;
    }
    set((state) => {
      const current = new Set(state.selectedNodeIds || []);
      if (current.has(nodeId)) {
        current.delete(nodeId);
      } else {
        current.add(nodeId);
      }
      return { selectedNodeIds: Array.from(current) };
    });
  },

  /**
   * 切换多选模式
   */
  toggleMultiSelect: () => {
    set((state) => ({
      isMultiSelectEnabled: !state.isMultiSelectEnabled,
    }));
  },

  /**
   * 设置画布平移锁定
   * @param {boolean} locked
   */
  setPanLocked: (locked) => {
    set({ isPanLocked: !!locked });
  },

  /**
   * 设置当前选中的分组
   * @param {string|null} groupId
   */
  selectGroup: (groupId) => {
    set({ selectedGroupId: groupId || null });
  },

  /**
   * 清空分组选中状态
   */
  clearGroupSelection: () => {
    set({ selectedGroupId: null });
  },

  /**
   * 清空选中
   */
  clearSelection: () => {
    set({ selectedNodeId: null });
  },

  /**
   * 清空所有节点和连接线
   */
  clearAll: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedNodeIds: [],
      startNodeId: null,
      groups: [],
      selectedGroupId: null,
    });
  },

  /**
   * 设置起始节点
   * @param {string} nodeId - 节点ID
   */
  setStartNode: (nodeId) => {
    set({ startNodeId: nodeId });
  },

  /**
   * 导出项目数据
   * @returns {Object} 包含 nodes 和 edges 的对象
   */
  exportProject: () => {
    const { nodes, edges, variables } = get();
    return {
      nodes,
      edges,
      variables,
      exportTime: new Date().toISOString(),
      version: '1.0'
    };
  },

  /**
   * 添加变量
   * @param {Object} variableData - 变量数据
   */
  addVariable: (variableData) => {
    const newVariable = {
      name: variableData.name,
      displayName: variableData.displayName || '',
      description: variableData.description || '',
      type: variableData.type || 'Integer',
      persistenceType: variableData.persistenceType || 'ChapterConstant',
      defaultValue: variableData.defaultValue || '0',
      minValue: variableData.minValue || '0',
      maxValue: variableData.maxValue || '1000000',
      priority: variableData.priority !== undefined ? variableData.priority : 0,
      isHidden: variableData.isHidden !== undefined ? variableData.isHidden : false,
      order: variableData.order !== undefined ? variableData.order : (get().variables.length + 1),
      iconPath: variableData.iconPath || '',
      showAsProgress: variableData.showAsProgress !== undefined ? variableData.showAsProgress : false,
      usePlayerPrefs: variableData.usePlayerPrefs !== undefined ? variableData.usePlayerPrefs : true,
    };

    set((state) => ({
      variables: [...state.variables, newVariable],
    }));
  },

  /**
   * 更新变量
   * @param {string} variableName - 变量名
   * @param {Object} updates - 更新的数据
   */
  updateVariable: (variableName, updates) => {
    set((state) => ({
      variables: state.variables.map((v) =>
        v.name === variableName ? { ...v, ...updates } : v
      ),
    }));
  },

  /**
   * 删除变量
   * @param {string} variableName - 变量名
   */
  deleteVariable: (variableName) => {
    set((state) => ({
      variables: state.variables.filter((v) => v.name !== variableName),
    }));
  },

  /**
   * 根据名称获取变量
   * @param {string} variableName - 变量名
   * @returns {Object|undefined} 变量对象
   */
  getVariable: (variableName) => {
    return get().variables.find((v) => v.name === variableName);
  },

  /**
   * 在所有节点中重命名变量引用
   * @param {string} oldName - 旧变量名
   * @param {string} newName - 新变量名
   */
  renameVariableInNodes: (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) {
      return;
    }

    set((state) => ({
      nodes: state.nodes.map((node) => {
        // 创建节点数据的副本
        const updatedData = { ...node.data };
        let hasChanges = false;

        // 处理条件判断中的变量引用
        if (updatedData.conditions && Array.isArray(updatedData.conditions)) {
          updatedData.conditions = updatedData.conditions.map((condition) => {
            const updatedCondition = { ...condition };
            if (updatedCondition.leftValue === oldName) {
              updatedCondition.leftValue = newName;
              hasChanges = true;
            }
            if (updatedCondition.rightValue === oldName) {
              updatedCondition.rightValue = newName;
              hasChanges = true;
            }
            return updatedCondition;
          });
        }

        // 处理变量效果中的变量引用
        if (updatedData.effects && Array.isArray(updatedData.effects)) {
          updatedData.effects = updatedData.effects.map((effect) => {
            const updatedEffect = { ...effect };
            if (updatedEffect.variableName === oldName) {
              updatedEffect.variableName = newName;
              hasChanges = true;
            }
            return updatedEffect;
          });
        }

        // 处理字幕中的变量引用（如果存在）
        if (updatedData.subtitles && Array.isArray(updatedData.subtitles)) {
          updatedData.subtitles = updatedData.subtitles.map((subtitle) => {
            const updatedSubtitle = { ...subtitle };
            if (updatedSubtitle.variableName === oldName) {
              updatedSubtitle.variableName = newName;
              hasChanges = true;
            }
            return updatedSubtitle;
          });
        }

        // 处理变量条设置中的变量引用
        if (updatedData.variableName === oldName) {
          updatedData.variableName = newName;
          hasChanges = true;
        }

        // 如果有修改，返回更新后的节点，否则返回原节点
        return hasChanges ? { ...node, data: updatedData } : node;
      }),
    }));
  },

  /**
   * 分组列表
   */
  groups: [],

  /**
   * 创建分组
   * @param {string[]} childIds
   * @param {Object} options
   */
  createGroup: (childIds = [], options = {}) => {
    const ids = Array.isArray(childIds)
      ? Array.from(new Set(childIds.filter(Boolean)))
      : [];
    if (ids.length === 0) {
      return;
    }
    set((state) => {
      const layout = computeGroupLayout(state.nodes, ids);
      if (!layout) {
        return {};
      }
      const groupId = options.id || `group_${Date.now()}`;
      const title = options.title || `分组 (${ids.length})`;
      const nextGroup = {
        id: groupId,
        title,
        childNodeIds: [...ids],
        bounds: {
          x: layout.position.x,
          y: layout.position.y,
          width: layout.width,
          height: layout.height,
        },
        minWidth: layout.minWidth,
        minHeight: layout.minHeight,
        meta: options.meta || {},
      };
      return {
        groups: [...(state.groups || []), nextGroup],
        selectedGroupId: groupId,
      };
    });
  },

  /**
   * 设置分组边界
   * @param {string} groupId
   * @param {{x:number,y:number,width:number,height:number}} bounds
   */
  setGroupBounds: (groupId, bounds) => {
    if (!groupId || !bounds) {
      return;
    }
    const { x, y, width, height } = bounds;
    if (![x, y, width, height].every((value) => Number.isFinite(value))) {
      return;
    }
    set((state) => ({
      groups: (state.groups || []).map((group) =>
        group.id === groupId
          ? {
              ...group,
              bounds: { x, y, width, height },
            }
          : group,
      ),
    }));
  },

  /**
   * 重新计算指定分组的边界
   * @param {string} groupId
   */
  recalculateGroupBounds: (groupId) => {
    if (!groupId) {
      return;
    }
    set((state) => {
      const group = (state.groups || []).find((item) => item.id === groupId);
      if (!group) {
        return {};
      }
      const layout = computeGroupLayout(state.nodes, group.childNodeIds);
      if (!layout) {
        return {};
      }
      const currentBounds = group.bounds || {
        x: layout.position.x,
        y: layout.position.y,
        width: layout.width,
        height: layout.height,
      };
      const layoutLeft = layout.position.x;
      const layoutTop = layout.position.y;
      const layoutRight = layoutLeft + layout.width;
      const layoutBottom = layoutTop + layout.height;
      const boundsLeft = Number.isFinite(currentBounds.x) ? currentBounds.x : layoutLeft;
      const boundsTop = Number.isFinite(currentBounds.y) ? currentBounds.y : layoutTop;
      const boundsRight = boundsLeft + (Number.isFinite(currentBounds.width) ? currentBounds.width : layout.width);
      const boundsBottom = boundsTop + (Number.isFinite(currentBounds.height) ? currentBounds.height : layout.height);
      const nextLeft = Math.min(boundsLeft, layoutLeft);
      const nextTop = Math.min(boundsTop, layoutTop);
      const nextRight = Math.max(boundsRight, layoutRight);
      const nextBottom = Math.max(boundsBottom, layoutBottom);
      return {
        groups: (state.groups || []).map((item) =>
          item.id === groupId
            ? {
                ...item,
                bounds: {
                  x: nextLeft,
                  y: nextTop,
                  width: Math.max(layout.width, nextRight - nextLeft),
                  height: Math.max(layout.height, nextBottom - nextTop),
                },
                minWidth: Math.max(layout.minWidth, item.minWidth ?? 0),
                minHeight: Math.max(layout.minHeight, item.minHeight ?? 0),
              }
            : item,
        ),
      };
    });
  },

  /**
   * 重新计算所有分组边界
   */
  recalculateAllGroupBounds: () => {
    set((state) => {
      const groups = state.groups || [];
      if (groups.length === 0) {
        return {};
      }
      const nextGroups = groups.map((group) => {
        const layout = computeGroupLayout(state.nodes, group.childNodeIds);
        if (!layout) {
          return group;
        }
        const currentBounds = group.bounds || {
          x: layout.position.x,
          y: layout.position.y,
          width: layout.width,
          height: layout.height,
        };
        const layoutLeft = layout.position.x;
        const layoutTop = layout.position.y;
        const layoutRight = layoutLeft + layout.width;
        const layoutBottom = layoutTop + layout.height;
        const boundsLeft = Number.isFinite(currentBounds.x) ? currentBounds.x : layoutLeft;
        const boundsTop = Number.isFinite(currentBounds.y) ? currentBounds.y : layoutTop;
        const boundsRight = boundsLeft + (Number.isFinite(currentBounds.width) ? currentBounds.width : layout.width);
        const boundsBottom = boundsTop + (Number.isFinite(currentBounds.height) ? currentBounds.height : layout.height);
        const nextLeft = Math.min(boundsLeft, layoutLeft);
        const nextTop = Math.min(boundsTop, layoutTop);
        const nextRight = Math.max(boundsRight, layoutRight);
        const nextBottom = Math.max(boundsBottom, layoutBottom);
        return {
          ...group,
          bounds: {
            x: nextLeft,
            y: nextTop,
            width: Math.max(layout.width, nextRight - nextLeft),
            height: Math.max(layout.height, nextBottom - nextTop),
          },
          minWidth: Math.max(layout.minWidth, group.minWidth ?? 0),
          minHeight: Math.max(layout.minHeight, group.minHeight ?? 0),
        };
      });
      return { groups: nextGroups };
    });
  },

  /**
   * 将节点添加到指定分组
   * @param {string} groupId
   * @param {string[]} nodeIds
   */
  addNodesToGroup: (groupId, nodeIds = []) => {
    if (!groupId || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return;
    }
    set((state) => {
      const targetGroup = (state.groups || []).find((group) => group.id === groupId);
      if (!targetGroup) {
        return {};
      }
      const existingIds = new Set(targetGroup.childNodeIds || []);
      const appendIds = nodeIds.filter((id) => id && !existingIds.has(id));
      if (appendIds.length === 0) {
        return { selectedGroupId: groupId };
      }
      const nextChildIds = [...targetGroup.childNodeIds, ...appendIds];
      const layout = computeGroupLayout(state.nodes, nextChildIds);
      if (!layout) {
        return {};
      }
      const currentBounds = targetGroup.bounds || {
        x: layout.position.x,
        y: layout.position.y,
        width: layout.width,
        height: layout.height,
      };
      const layoutLeft = layout.position.x;
      const layoutTop = layout.position.y;
      const layoutRight = layoutLeft + layout.width;
      const layoutBottom = layoutTop + layout.height;
      const boundsLeft = Number.isFinite(currentBounds.x) ? currentBounds.x : layoutLeft;
      const boundsTop = Number.isFinite(currentBounds.y) ? currentBounds.y : layoutTop;
      const boundsRight = boundsLeft + (Number.isFinite(currentBounds.width) ? currentBounds.width : layout.width);
      const boundsBottom = boundsTop + (Number.isFinite(currentBounds.height) ? currentBounds.height : layout.height);
      const nextLeft = Math.min(boundsLeft, layoutLeft);
      const nextTop = Math.min(boundsTop, layoutTop);
      const nextRight = Math.max(boundsRight, layoutRight);
      const nextBottom = Math.max(boundsBottom, layoutBottom);
      return {
        groups: (state.groups || []).map((group) =>
          group.id === groupId
            ? {
                ...group,
                childNodeIds: nextChildIds,
                bounds: {
                  x: nextLeft,
                  y: nextTop,
                  width: Math.max(layout.width, nextRight - nextLeft),
                  height: Math.max(layout.height, nextBottom - nextTop),
                },
                minWidth: Math.max(layout.minWidth, group.minWidth ?? 0),
                minHeight: Math.max(layout.minHeight, group.minHeight ?? 0),
              }
            : group,
        ),
        selectedGroupId: groupId,
      };
    });
  },

  /**
   * 重命名分组
   * @param {string} groupId
   * @param {string} title
   */
  renameGroup: (groupId, title) => {
    if (!groupId) {
      return;
    }
    const trimmed = typeof title === 'string' ? title.trim() : '';
    set((state) => ({
      groups: (state.groups || []).map((group) =>
        group.id === groupId
          ? {
              ...group,
              title: trimmed || group.title || '分组',
            }
          : group,
      ),
    }));
  },

  /**
   * 从所有分组中移除指定节点
   * @param {string[]} nodeIds
   */
  removeNodesFromGroups: (nodeIds = []) => {
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
      return;
    }
    const targetSet = new Set(nodeIds.filter(Boolean));
    set((state) => {
      let selectedGroupId = state.selectedGroupId;
      const nextGroups = (state.groups || [])
        .map((group) => {
          const remainingIds = (group.childNodeIds || []).filter((id) => !targetSet.has(id));
          if (remainingIds.length === 0) {
            if (selectedGroupId === group.id) {
              selectedGroupId = null;
            }
            return null;
          }
          const layout = computeGroupLayout(state.nodes, remainingIds);
          if (!layout) {
            if (selectedGroupId === group.id) {
              selectedGroupId = null;
            }
            return null;
          }
          return {
            ...group,
            childNodeIds: remainingIds,
            bounds: {
              x: layout.position.x,
              y: layout.position.y,
              width: layout.width,
              height: layout.height,
            },
            minWidth: layout.minWidth,
            minHeight: layout.minHeight,
          };
        })
        .filter(Boolean);
      return {
        groups: nextGroups,
        selectedGroupId,
      };
    });
  },
}));

export default useFlowStore;

