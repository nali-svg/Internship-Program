import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Button, Tooltip, Dropdown, Menu, Modal, Input, Switch, Popover } from 'antd';
import { DownOutlined, PlusOutlined, DeleteOutlined, CheckOutlined, NodeIndexOutlined, SplitCellsOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styles from './index.module.scss';
import useFlowStore from '../../store/flowStore';
import VariableManager from '../VariableManager';
import PreviewCanvas from '../Preview/CoordinateCanvas';
import {
  convertVariablesToExportFormat,
  convertVariablesFromImportFormat,
} from '../../utils/variableHelper';
import { computeGroupLayout } from '../../utils/groupLayout';
import VideoNode from './FlowNodes/VideoNode';
import OptionNode from './FlowNodes/OptionNode';
import BgmNode from './FlowNodes/BgmNode';
import CardNode from './FlowNodes/CardNode';
import JumpNode from './FlowNodes/JumpNode';
import TaskNode from './FlowNodes/TaskNode';
import TipNode from './FlowNodes/TipNode';
import GroupOverlayLayer from './GroupOverlay';

// 节点类型映射
const nodeTypes = {
  videoNode: VideoNode,
  optionNode: OptionNode,
  bgmNode: BgmNode,
  cardNode: CardNode,
  jumpNode: JumpNode,
  taskNode: TaskNode,
  tipNode: TipNode,
};


// 边类型映射 - 使用默认的smooth边
const edgeTypes = {};

const templateVariablesSnapshot = Array.isArray(globalThis?.projectGraphTemplate?.variables)
  ? globalThis.projectGraphTemplate.variables
  : null;

const cloneTemplateVariables = () => {
  if (!templateVariablesSnapshot) {
    return [];
  }
  try {
    return JSON.parse(JSON.stringify(templateVariablesSnapshot));
  } catch (error) {
    console.warn('[convertPGToStoryData] 克隆模板变量失败:', error);
    return templateVariablesSnapshot.map(variable => ({ ...variable }));
  }
};

// 辅助函数：计算画布中心位置
function calculateCanvasCenter(viewport, containerSize) {
  const { x, y, zoom } = viewport;
  const { width, height } = containerSize;
  
  // 计算视口中心在画布坐标系中的位置
  const centerX = -x / zoom + (width / 2) / zoom;
  const centerY = -y / zoom + (height / 2) / zoom;
  
  return { x: centerX, y: centerY };
}

// 内部组件 - 在 ReactFlow 内部使用 useReactFlow hook
function FlowControls() {
  const { zoomIn, zoomOut } = useReactFlow();

  // 处理画布滚轮事件
  const handleCanvasWheel = useCallback((event) => {
    // 检查是否在节点上
    const isOnNode = event.target.closest('.react-flow__node');
    
    // 如果在节点上，不处理（让节点自己处理滚动）
    if (isOnNode) {
      return;
    }
    
    // 在画布空白区域，处理缩放
    event.preventDefault();
    
    if (event.deltaY < 0) {
      // 向上滚动，放大
      zoomIn({ duration: 100 });
    } else {
      // 向下滚动，缩小
      zoomOut({ duration: 100 });
    }
  }, [zoomIn, zoomOut]);

  // 使用 useEffect 来添加事件监听器
  React.useEffect(() => {
    const reactFlowElement = document.querySelector('.react-flow');
    if (reactFlowElement) {
      reactFlowElement.addEventListener('wheel', handleCanvasWheel, { passive: false });
      return () => {
        reactFlowElement.removeEventListener('wheel', handleCanvasWheel);
      };
    }
  }, [handleCanvasWheel]);

  return null; // 这个组件不渲染任何内容
}

const convertStoryDataToFlow = (content) => {
  const allNodes = [];
  const nodeIdToIdMap = new Map();
  const baseId = Date.now();
  let globalNodeCounter = 0;

  const numberToOperationMap = {
    0: 'Set',
    1: 'Add',
    2: 'Subtract',
    3: 'Multiply',
    4: 'Divide',
  };

  const mapEffects = (effects = []) =>
    effects.map((effect) => {
      if (effect && typeof effect.operation === 'number') {
        return {
          ...effect,
          operation: numberToOperationMap[effect.operation] || 'Set',
        };
      }
      return effect;
    });

  const registerNode = (node, type, data) => {
    if (!node?.nodeId) {
      return;
    }
    const reactFlowId = `node_${baseId}_${globalNodeCounter++}`;
    nodeIdToIdMap.set(node.nodeId, reactFlowId);
    const position =
      node.position &&
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number'
        ? node.position
        : { x: 0, y: 0 };
    allNodes.push({
      id: reactFlowId,
      type,
      position,
      data,
    });
  };

  // videoNodes
  (content.videoNodes || []).forEach((node) => {
    registerNode(node, 'videoNode', {
      id: node.nodeId,
      nodeName: node.nodeName || node.title || '',
      videoFile: node.videoClipPath || '无 (视频剪辑)',
      videoThumbnail: node.thumbnailPath || node.videoThumbnail || '',
      displayType:
        node.displayType !== undefined ? ['Auto', 'Fill', 'Fit'][node.displayType] : 'Auto',
      thumbnail: node.thumbnailPath || '无 (精灵)',
      isCheckpoint: node.isCheckpoint || false,
      isExpanded: false,
      autoPlayNext: node.autoPlayNext || false,
      loop: node.loop || false,
      volume: node.volume || 1,
      waitSubtitle: node.waitForSubtitles || false,
      isEndpoint: node.isEndpoint || false,
      isDeathPoint: node.isDeadpoint || false,
      isBlackScreen: node.isBlackScreen || false,
      isMemory: node.isMemory || false,
      isDialogue: node.isDialogNode || false,
      showConditionOnFail: !node.showWhenUnavailable || false,
      conditionDesc: node.description || '',
      showSubtitleEditor: false,
      subtitles: node.subtitles?.subtitles || [],
      achievementName: node.unlockAchievementName || '',
      unlockAchievement: node.unlockAchievement || false,
      isRandomNode: node.isRandom || false,
      probabilityExpression: node.probabilityExpression || '',
      showVariableBar: node.showVariableBar || false,
      variableName: node.variableBarName || '',
      defaultValue: node.variableBarDefaultValue || '0',
      fillColor: node.variableBarColor || '#ffffff',
      barPosition: node.variableBarPosition || '上',
      enableStats: !!node.analyticsKey,
      statsKeyPoint: node.analyticsKey || '',
      isJumpPoint: node.isJumpPoint || false,
      jumpPointId: node.jumpPointId || '',
      jumpPointDesc: node.jumpPointDescription || '',
      enableCommerce: node.isProductShowcase || false,
      showcaseProductIds: node.showcaseProductIds || [],
      showcaseDisplayDuration: node.showcaseDisplayDuration || 10.0,
      showcaseAutoHide: node.showcaseAutoHide !== undefined ? node.showcaseAutoHide : true,
      showcasePosition: node.showcasePosition || { x: 0.1, y: 0.9 },
      showcaseSize: node.showcaseSize || { x: 0.3, y: 0.2 },
      showcaseOnlyShowUnpurchased:
        node.showcaseOnlyShowUnpurchased !== undefined ? node.showcaseOnlyShowUnpurchased : true,
      showcaseHideIfAllPurchased:
        node.showcaseHideIfAllPurchased !== undefined ? node.showcaseHideIfAllPurchased : true,
      showcaseEnableScrollAnimation:
        node.showcaseEnableScrollAnimation !== undefined ? node.showcaseEnableScrollAnimation : true,
      memoryName: node.memoryName || '',
      memoryDescription: node.memoryDescription || '',
      memoryId: node.memoryId || '',
      dialogueText: node.dialogText || node.dialogueText || '',
      dialogueAudioPath: node.dialogAudioPath || node.dialogueAudioPath || '',
      typingSpeed: node.typingSpeed || 0.05,
      effects: mapEffects(node.effects || []),
      conditions: node.conditions || [],
      activeTab: 'input',
    });
  });

  const mapOptionData = (node, isChoice = false) => {
    const rawClickable = isChoice
      ? node.isClickable
      : node.optionClickable;
    const optionClickable = rawClickable !== false;
    return {
      id: node.nodeId,
      optionText: node.optionText || node.choiceText || '',
      description: node.description || '',
      appearTime: node.appearTime || 0,
      preDisplay: node.preDisplay || node.showEarly || false,
      showWhenConditionNotMet: node.showWhenUnavailable || false,
      unavailableMessage: node.unavailableMessage || '',
      enableOverlayImage: node.enableOverlayImage || node.isOverlayImageChoice || false,
      optionClickable,
      layerIndex: node.layerIndex ?? node.tierIndex ?? 0,
      overlayImage: node.overlayImagePath || '无 (精灵)',
      requiresAd: node.requiresAd || node.requireAd || false,
      isRewardedVideo: node.isRewardedAd || node.isRewardAd || false,
      conditions: node.conditions || [],
      effects: mapEffects(node.effects || []),
      isCheckpoint: node.isCheckpoint || false,
      isExpanded: false,
      activeTab: 'input',
    };
  };

  (content.optionNodes || []).forEach((node) => {
    registerNode(node, 'optionNode', mapOptionData(node));
  });
  (content.choiceNodes || []).forEach((node) => {
    registerNode(node, 'optionNode', mapOptionData(node, true));
  });

  (content.bgmNodes || []).forEach((node) => {
    registerNode(node, 'bgmNode', {
      id: node.nodeId,
      audioFile: node.audioClipPath || node.audioPath || '♫ 无 (音频剪辑)',
      loop: node.loop || false,
      volume: node.volume || 1,
      fadeInTime: node.fadeInTime || 0,
      fadeOutTime: node.fadeOutTime || 0,
      autoFadeOut: node.autoFadeOut || false,
      isCheckpoint: false,
      isExpanded: false,
      activeTab: 'input',
    });
  });

  (content.cardNodes || []).forEach((node) => {
    registerNode(node, 'cardNode', {
      id: node.nodeId,
      nodeName: node.nodeName || '',
      cardImage: node.cardImagePath || '无 (精灵)',
      cardSizeX: node.cardSize?.x || node.cardSizeX || 200,
      cardSizeY: node.cardSize?.y || node.cardSizeY || 300,
      fanAngle: node.fanAngle || 30,
      animationDuration: node.animationDuration || 0.5,
      description: node.description || '',
      showWhenConditionNotMet: node.showWhenUnavailable || false,
      preDisplay: node.preDisplay || false,
      unavailableMessage: node.unavailableMessage || '',
      effects: mapEffects(node.effects || []),
      conditions: node.conditions || [],
      isCheckpoint: false,
      isExpanded: false,
      activeTab: 'input',
    });
  });

  (content.jumpNodes || []).forEach((node) => {
    registerNode(node, 'jumpNode', {
      id: node.nodeId,
      jumpPointId: node.jumpPointId || '',
      jumpPointDesc: node.jumpPointDescription || '',
      jumpPointActive: node.jumpPointActive || false,
      isCheckpoint: false,
      isExpanded: false,
      activeTab: 'input',
    });
  });

  (content.taskNodes || []).forEach((node) => {
    registerNode(node, 'taskNode', {
      id: node.nodeId,
      maxDisplayCount: node.maxDisplayCount || 3,
      taskListInput: node.taskListInput || '',
      parsedTasks: node.parsedTasks || [],
      isCheckpoint: false,
      isExpanded: false,
      activeTab: 'input',
    });
  });

  (content.tipNodes || []).forEach((node) => {
    registerNode(node, 'tipNode', {
      id: node.nodeId,
      nodeName: node.nodeName || node.tipText || '提示',
      tipText: node.tipText || '',
      requireAd: node.requireAd || false,
      adType: node.adType || '',
      isResetToCP: node.isResetToCP || false,
      isCheckpoint: node.isCheckpoint || false,
      isExpanded: false,
      activeTab: 'input',
    });
  });

  const allNodeArrays = [
    ...(content.videoNodes || []),
    ...(content.optionNodes || []),
    ...(content.choiceNodes || []),
    ...(content.bgmNodes || []),
    ...(content.cardNodes || []),
    ...(content.jumpNodes || []),
    ...(content.taskNodes || []),
    ...(content.tipNodes || []),
  ];

  const allEdges = [];
  let edgeIndex = 0;

  allNodeArrays.forEach((node) => {
    if (
      node?.nodeId &&
      Array.isArray(node.nextNodeIds) &&
      node.nextNodeIds.length > 0
    ) {
      const sourceId = nodeIdToIdMap.get(node.nodeId);
      if (!sourceId) {
        return;
      }
      node.nextNodeIds.forEach((nextNodeId) => {
        const targetId = nodeIdToIdMap.get(nextNodeId);
        if (!targetId) {
          return;
        }
        allEdges.push({
          id: `edge_${baseId}_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          type: 'smooth',
          animated: false,
          style: { stroke: '#1890ff', strokeWidth: 2 },
          markerEnd: {
            type: 'arrowclosed',
            color: '#1890ff',
            width: 20,
            height: 20,
          },
        });
      });
    }
  });

  const variables = Array.isArray(content.variables)
    ? convertVariablesFromImportFormat(content.variables)
    : [];

  const mappedStartNodeId = content.startNodeId
    ? nodeIdToIdMap.get(content.startNodeId) || null
    : null;

  return {
    nodes: allNodes,
    edges: allEdges,
    variables,
    startNodeId: mappedStartNodeId,
    rawStartNodeId: content.startNodeId ?? null,
  };
};

const convertFlowToStoryData = (flowNodes = [], flowEdges = [], flowVariables = [], startNodeId = null) => {
  const storyData = {
    videoNodes: [],
    choiceNodes: [],
    bgmNodes: [],
    cardNodes: [],
    jumpNodes: [],
    taskNodes: [],
    tipNodes: [],
    variables: convertVariablesToExportFormat(Array.isArray(flowVariables) ? flowVariables : []).data,
    startNodeId: '',
    version: '1.0',
  };

  const safeNumber = (value, fallback = 0) =>
    typeof value === 'number' && !Number.isNaN(value) ? value : fallback;

  const safeBoolean = (value, fallback = false) =>
    typeof value === 'boolean' ? value : fallback;

  const safeString = (value, fallback = '') =>
    typeof value === 'string' ? value : fallback;

  const operationStringToNumberMap = {
    Set: 0,
    Add: 1,
    Subtract: 2,
    Multiply: 3,
    Divide: 4,
  };

  const normalizeOperation = (operation) => {
    if (typeof operation === 'number') {
      return Math.max(0, Math.min(4, Math.floor(operation)));
    }
    if (typeof operation === 'string') {
      return operationStringToNumberMap[operation] !== undefined
        ? operationStringToNumberMap[operation]
        : 0;
    }
    return 0;
  };

  const mapEffectsForExport = (effects = []) =>
    Array.isArray(effects)
      ? effects.map((effect) => ({
          ...effect,
          operation: normalizeOperation(effect?.operation),
          value: effect?.value ?? '',
        }))
      : [];

  const nodeIdMap = new Map();
  flowNodes.forEach((node) => {
    const dataId = node?.data?.id || node?.id || `${Date.now()}_${Math.random()}`;
    nodeIdMap.set(node.id, dataId);
  });

  const getNextNodeIds = (nodeId) => {
    const nextIds = flowEdges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => {
        const mapped = nodeIdMap.get(edge.target);
        if (mapped) {
          return mapped;
        }
        const targetNode = flowNodes.find((item) => item.id === edge.target);
        if (targetNode?.id) {
          return targetNode.id.replace(/^node_/, '');
        }
        return null;
      })
      .filter((id) => typeof id === 'string' && id.trim() !== '');
    return nextIds;
  };

  flowNodes.forEach((node) => {
    const safeNodeId = node?.data?.id || node?.id || `${Date.now()}_${Math.random()}`;
    const safeNodeName = node?.data?.nodeName || node?.data?.optionText || node?.id || '';
    const safePosition =
      node?.position && typeof node.position.x === 'number' && typeof node.position.y === 'number'
        ? node.position
        : { x: 0, y: 0 };
    const nextNodeIds = getNextNodeIds(node.id);

    switch (node.type) {
      case 'videoNode': {
        storyData.videoNodes.push({
          videoClipPath: safeString(node.data?.videoFile, 'Assets/Resources/Video/FallBackVideo.mp4'),
          imagePath: '',
          displayType: (() => {
            const index = ['Auto', 'Fill', 'Fit'].indexOf(node.data?.displayType);
            return index >= 0 ? index : 0;
          })(),
          thumbnailPath: safeString(
            node.data?.videoThumbnail || node.data?.thumbnail,
            ''
          ),
          autoPlayNext: safeBoolean(node.data?.autoPlayNext, false),
          loop: safeBoolean(node.data?.loop, false),
          volume: safeNumber(node.data?.volume, 1.0),
          waitForSubtitles: safeBoolean(node.data?.waitSubtitle, false),
          canSkipSubtitles: true,
          subtitles: {
            subtitles: Array.isArray(node.data?.subtitles) ? node.data.subtitles : [],
          },
          duration: -1.0,
          isEndpoint: safeBoolean(node.data?.isEndpoint, false),
          subtitleArray: [],
          subtitleTimes: [],
          isMemory: safeBoolean(node.data?.isMemory, false),
          memoryId: '',
          memoryName: '',
          memoryDescription: '',
          isDialogNode: safeBoolean(node.data?.isDialogue, false),
          dialogText: safeString(node.data?.dialogText, ''),
          dialogSpeaker: safeString(node.data?.dialogSpeaker, ''),
          typingSpeed: safeNumber(node.data?.typingSpeed, 0.05),
          dialogAudioPath: safeString(node.data?.dialogAudioPath, ''),
          effects: mapEffectsForExport(node.data?.effects),
          rateEffects: [],
          conditions: Array.isArray(node.data?.conditions) ? node.data.conditions : [],
          showWhenUnavailable: safeBoolean(node.data?.showWhenConditionNotMet, false),
          description: safeString(node.data?.conditionDesc, ''),
          tipNodeId: '',
          unlockAchievement: safeBoolean(node.data?.unlockAchievement, false),
          unlockAchievementName: safeString(node.data?.achievementName, ''),
          isRandom: safeBoolean(node.data?.isRandomNode, false),
          probabilityExpression: safeString(node.data?.probabilityExpression, ''),
          hasRandomTimeEvent: safeBoolean(node.data?.hasRandomTimeEvent, false),
          randomTimeMinSeconds: safeNumber(node.data?.randomTimeMinSeconds, 0),
          randomTimeMaxSeconds: safeNumber(node.data?.randomTimeMaxSeconds, 0),
          showVariableBar: safeBoolean(node.data?.showVariableBar, false),
          variableBarName: safeString(node.data?.variableName, ''),
          variableBarDefaultValue: safeString(node.data?.defaultValue, '0'),
          variableBarColor: safeString(node.data?.fillColor, '#ffffff'),
          variableBarPosition: safeString(node.data?.barPosition, '上'),
          isJumpPoint: safeBoolean(node.data?.isJumpPoint, false),
          jumpPointId: safeString(node.data?.jumpPointId, ''),
          jumpPointDescription: safeString(node.data?.jumpPointDesc, ''),
          analyticsKey: safeBoolean(node.data?.enableStats, false)
            ? safeString(node.data?.statsKeyPoint, '')
            : '',
          isBlackScreen: safeBoolean(node.data?.isBlackScreen, false),
          isProductShowcase: safeBoolean(node.data?.enableCommerce, false),
          showcaseProductIds: Array.isArray(node.data?.showcaseProductIds)
            ? node.data.showcaseProductIds
            : [],
          showcaseDisplayDuration: safeNumber(node.data?.showcaseDisplayDuration, 10),
          showcaseAutoHide:
            node.data?.showcaseAutoHide !== undefined ? !!node.data.showcaseAutoHide : true,
          showcasePosition:
            node.data?.showcasePosition &&
            typeof node.data.showcasePosition.x === 'number' &&
            typeof node.data.showcasePosition.y === 'number'
              ? node.data.showcasePosition
              : { x: 0.1, y: 0.9 },
          showcaseSize:
            node.data?.showcaseSize &&
            typeof node.data.showcaseSize.x === 'number' &&
            typeof node.data.showcaseSize.y === 'number'
              ? node.data.showcaseSize
              : { x: 0.3, y: 0.2 },
          showcaseOnlyShowUnpurchased:
            node.data?.showcaseOnlyShowUnpurchased !== undefined
              ? !!node.data.showcaseOnlyShowUnpurchased
              : true,
          showcaseHideIfAllPurchased:
            node.data?.showcaseHideIfAllPurchased !== undefined
              ? !!node.data.showcaseHideIfAllPurchased
              : true,
          showcaseEnableScrollAnimation:
            node.data?.showcaseEnableScrollAnimation !== undefined
              ? !!node.data.showcaseEnableScrollAnimation
              : true,
          nodeId: safeNodeId,
          nodeName: safeNodeName,
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeNodeName || safeNodeId,
          maxDefaultValueOverrides: Array.isArray(node.data?.maxDefaultValueOverrides)
            ? node.data.maxDefaultValueOverrides
            : [],
          minDefaultValueOverrides: Array.isArray(node.data?.minDefaultValueOverrides)
            ? node.data.minDefaultValueOverrides
            : [],
          isDeadpoint: safeBoolean(node.data?.isDeathPoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
        });
        break;
      }
      case 'optionNode': {
        const effects = mapEffectsForExport(node.data?.effects);
        storyData.choiceNodes.push({
          choiceText: safeString(node.data?.optionText, ''),
          description: safeString(node.data?.description, ''),
          appearTime: safeNumber(node.data?.appearTime, 0),
          conditions: Array.isArray(node.data?.conditions) ? node.data.conditions : [],
          effects,
          showWhenUnavailable: safeBoolean(node.data?.showWhenConditionNotMet, false),
          unavailableMessage: safeString(node.data?.unavailableMessage, ''),
          requireAd: safeBoolean(node.data?.requiresAd, false),
          isRewardAd: safeBoolean(node.data?.isRewardedVideo, false),
          adType: '',
          unlockAchievement: false,
          unlockAchievementName: '',
          hasDynamicText: false,
          dynamicTextPattern: '',
          isOverlayImageChoice: safeBoolean(node.data?.enableOverlayImage, false),
          overlayImagePath: safeString(node.data?.overlayImage, ''),
          isClickable: node.data?.optionClickable !== false,
          tierIndex: safeNumber(node.data?.layerIndex, 0),
          isProbabilityChoice: false,
          probability: 0.0,
          probabilityExpression: '',
          groupId: 0,
          maxCount: 0,
          showEarly: safeBoolean(node.data?.preDisplay, false),
          nodeId: safeNodeId,
          nodeName: safeNodeName,
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeString(node.data?.optionText, safeNodeName || safeNodeId),
          maxDefaultValueOverrides: [],
          minDefaultValueOverrides: [],
          isDeadpoint: safeBoolean(node.data?.isDeathPoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
        });
        break;
      }
      case 'bgmNode': {
        storyData.bgmNodes.push({
          nodeId: safeNodeId,
          nodeName: safeNodeName,
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeNodeName || safeNodeId,
          maxDefaultValueOverrides: [],
          minDefaultValueOverrides: [],
          isDeadpoint: safeBoolean(node.data?.isDeathPoint, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          audioClipPath: safeString(node.data?.audioFile, ''),
          volume: safeNumber(node.data?.volume, 1),
          isLoop: safeBoolean(node.data?.loop, false),
          fadeInTime: safeNumber(node.data?.fadeInTime, 0),
          fadeOutTime: safeNumber(node.data?.fadeOutTime, 0),
          autoFadeOut: safeBoolean(node.data?.autoFadeOut, false),
        });
        break;
      }
      case 'cardNode': {
        storyData.cardNodes.push({
          nodeId: safeNodeId,
          nodeName: safeNodeName,
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeNodeName || safeNodeId,
          maxDefaultValueOverrides: [],
          minDefaultValueOverrides: [],
          isDeadpoint: safeBoolean(node.data?.isDeathPoint, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          cardImagePath: safeString(node.data?.cardImage, ''),
          cardSize: {
            x: safeNumber(node.data?.cardSizeX, 200),
            y: safeNumber(node.data?.cardSizeY, 300),
          },
          fanAngle: safeNumber(node.data?.fanAngle, 30),
          conditions: Array.isArray(node.data?.conditions) ? node.data.conditions : [],
          effects: mapEffectsForExport(node.data?.effects),
          showWhenUnavailable: node.data?.showWhenConditionNotMet !== undefined
            ? !!node.data.showWhenConditionNotMet
            : true,
          unavailableMessage: safeString(node.data?.unavailableMessage, ''),
          animationDuration: safeNumber(node.data?.animationDuration, 0.5),
          description: safeString(node.data?.description, ''),
          requireAd: safeBoolean(node.data?.requiresAd, false),
          adType: '',
          unlockAchievement: false,
          unlockAchievementName: '',
          showEarly: safeBoolean(node.data?.preDisplay, false),
        });
        break;
      }
      case 'jumpNode': {
        storyData.jumpNodes.push({
          nodeId: safeNodeId,
          nodeName: safeNodeName,
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeNodeName || safeNodeId,
          maxDefaultValueOverrides: [],
          minDefaultValueOverrides: [],
          isDeadpoint: safeBoolean(node.data?.isDeadpoint, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          jumpPointId: safeString(node.data?.jumpPointId, ''),
          description: safeString(node.data?.jumpPointDesc, ''),
          jumpPointActive: safeBoolean(node.data?.jumpPointActive, false),
        });
        break;
      }
      case 'taskNode': {
        storyData.taskNodes.push({
          nodeId: safeNodeId,
          nodeName: safeNodeName,
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeNodeName || safeNodeId,
          maxDefaultValueOverrides: [],
          minDefaultValueOverrides: [],
          isDeadpoint: safeBoolean(node.data?.isDeadpoint, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          maxDisplayCount: safeNumber(node.data?.maxDisplayCount, 3),
          tasks: Array.isArray(node.data?.parsedTasks) ? node.data.parsedTasks : [],
        });
        break;
      }
      case 'tipNode': {
        storyData.tipNodes.push({
          nodeId: safeNodeId,
          nodeName: safeNodeName || safeString(node.data?.tipText, '提示'),
          nextNodeIds,
          isActive: true,
          position: safePosition,
          title: safeNodeName || safeNodeId,
          maxDefaultValueOverrides: [],
          minDefaultValueOverrides: [],
          isDeadpoint: safeBoolean(node.data?.isDeadpoint, false),
          isCheckpoint: safeBoolean(node.data?.isCheckpoint, false),
          isResetToCP: safeBoolean(node.data?.isResetToCP, false),
          tipText: safeString(node.data?.tipText, ''),
          requireAd: safeBoolean(node.data?.requireAd, false),
          adType: safeString(node.data?.adType, ''),
        });
        break;
      }
      default:
        break;
    }
  });

  if (startNodeId) {
    const startNode = flowNodes.find((node) => node.id === startNodeId);
    if (startNode?.data?.id) {
      storyData.startNodeId = startNode.data.id;
    } else if (startNodeId) {
      storyData.startNodeId = startNodeId.replace(/^node_/, '');
    }
  } else {
    storyData.startNodeId = '';
  }

  return storyData;
};


export default function PlayerEditor({ onNodeSelect }) {
  const { 
    nodes, 
    edges, 
    addNode,
    addOptionNode,
    addBgmNode,
    addCardNode,
    addJumpNode,
    addTaskNode,
    setNodes, 
    setEdges,
    selectedNodeId,
    selectedNodeIds,
    selectNode,
    setSelectedNodes,
    toggleSelectedNode,
    setStartNode,
    startNodeId,
    setVariables,
    isMultiSelectEnabled,
    toggleMultiSelect,
    isPanLocked,
    setPanLocked,
    groups,
    createGroup,
    recalculateAllGroupBounds,
    removeNodesFromGroups,
    selectedGroupId,
    selectGroup,
    clearGroupSelection,
    addNodesToGroup,
    updateNode,
  } = useFlowStore();


  // 获取 React Flow 实例（用于获取视口信息）
  const reactFlowInstance = useReactFlow();
  
  // 容器引用（用于获取容器尺寸）
  const containerRef = useRef(null);

  // 文件输入引用
  const loadFileInputRef = useRef(null);
  const importPGFileInputRef = useRef(null);
  
  // 最近一次通过文件系统加载的句柄信息
  const lastLoadedFileHandleRef = React.useRef(null);
  const lastLoadedFileNameRef = React.useRef('');
  
  // 删除区域状态
  const [isDraggingOverDelete, setIsDraggingOverDelete] = React.useState(false);
  const [draggingNode, setDraggingNode] = React.useState(null);
  
  // 选中的边
  const [selectedEdges, setSelectedEdges] = React.useState([]);
  
  // 拖拽连线的状态
  const [isDraggingEdge, setIsDraggingEdge] = React.useState(false);
  const activeGroup = useMemo(() => {
    if (!Array.isArray(groups) || !selectedGroupId) {
      return null;
    }
    return groups.find((group) => group.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  const pendingJoinNodeIds = useMemo(() => {
    if (!activeGroup || !Array.isArray(selectedNodeIds)) {
      return [];
    }
    const childSet = new Set(activeGroup.childNodeIds || []);
    return selectedNodeIds.filter((id) => id && !childSet.has(id));
  }, [activeGroup, selectedNodeIds]);

  const canJoinGroup = activeGroup && pendingJoinNodeIds.length > 0;
  const canPanOnDrag = !isPanLocked && !isMultiSelectEnabled;
  const canZoomOnScroll = !isPanLocked;
  
  // React Flow 的节点和边状态管理
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState(edges);

  const processLoadedJson = useCallback(
    (content, meta = {}) => {
      const { fileHandle = null, fileName = '' } = meta;
      try {
        const isReactFlowFormat =
          content && Array.isArray(content.nodes) && Array.isArray(content.edges);
        const isStoryDataFormat =
          content &&
          (
            (Array.isArray(content.videoNodes) && content.videoNodes.length > 0) ||
            (Array.isArray(content.optionNodes) && content.optionNodes.length > 0) ||
            (Array.isArray(content.choiceNodes) && content.choiceNodes.length > 0) ||
            (Array.isArray(content.bgmNodes) && content.bgmNodes.length > 0) ||
            (Array.isArray(content.cardNodes) && content.cardNodes.length > 0) ||
            (Array.isArray(content.jumpNodes) && content.jumpNodes.length > 0) ||
            (Array.isArray(content.taskNodes) && content.taskNodes.length > 0) ||
            (Array.isArray(content.tipNodes) && content.tipNodes.length > 0)
          );

        if (isReactFlowFormat) {
          const convertedVariables =
            content.variables && Array.isArray(content.variables)
              ? convertVariablesFromImportFormat(content.variables)
              : [];
          const nodeCount = content.nodes.length;
          const edgeCount = content.edges.length;
          const variableCount = convertedVariables.length;
          const confirmMessage = `确定要加载该项目吗？\n\n将覆盖当前数据：\n- 节点数: ${nodeCount}\n- 连线数: ${edgeCount}\n- 变量数: ${variableCount}`;
          if (!confirm(confirmMessage)) {
            return false;
          }

          setNodes(content.nodes);
          setEdges(content.edges);
          setReactFlowNodes(content.nodes);
          setReactFlowEdges(content.edges);
          setVariables(convertedVariables);
          if (content.startNodeId) {
            setStartNode(content.startNodeId);
          } else {
            setStartNode(null);
          }

          alert(`加载成功！\n节点数: ${nodeCount}\n连线数: ${edgeCount}\n变量数: ${variableCount}`);

          if (fileHandle && typeof fileHandle.createWritable === 'function') {
            lastLoadedFileHandleRef.current = fileHandle;
            lastLoadedFileNameRef.current = fileName || fileHandle.name || '';
          } else {
            lastLoadedFileHandleRef.current = null;
            lastLoadedFileNameRef.current = fileName || '';
          }
          return true;
        }

        if (isStoryDataFormat) {
          const {
            nodes: convertedNodes,
            edges: convertedEdges,
            variables: convertedVariables,
            startNodeId: convertedStartNodeId,
            rawStartNodeId,
          } = convertStoryDataToFlow(content);

          const totalNodes = convertedNodes.length;
          const totalEdges = convertedEdges.length;
          const totalVariables = convertedVariables.length;
          const confirmMessage = `确定要加载该项目吗？\n\n将覆盖当前数据：\n- 节点数: ${totalNodes}\n- 连线数: ${totalEdges}\n- 变量数: ${totalVariables}`;
          if (!confirm(confirmMessage)) {
            return false;
          }

          setNodes(convertedNodes);
          setEdges(convertedEdges);
          setReactFlowNodes(convertedNodes);
          setReactFlowEdges(convertedEdges);
          setVariables(convertedVariables);

          if (convertedStartNodeId) {
            setStartNode(convertedStartNodeId);
          } else if (rawStartNodeId) {
            setStartNode(rawStartNodeId);
          } else {
            setStartNode(null);
          }

          alert(`加载成功！\n节点数: ${totalNodes}\n连线数: ${totalEdges}\n变量数: ${totalVariables}`);
          if (fileHandle && typeof fileHandle.createWritable === 'function') {
            lastLoadedFileHandleRef.current = fileHandle;
            lastLoadedFileNameRef.current = fileName || fileHandle.name || '';
          } else {
            lastLoadedFileHandleRef.current = null;
            lastLoadedFileNameRef.current = fileName || '';
          }
          return true;
        }

        const errorDetails = [];
        if (!content.entities) errorDetails.push('缺少 entities 字段');
        else if (!Array.isArray(content.entities))
          errorDetails.push(`entities 不是数组，而是 ${typeof content.entities}`);
        if (!content.associations) errorDetails.push('缺少 associations 字段');
        else if (!Array.isArray(content.associations))
          errorDetails.push(`associations 不是数组，而是 ${typeof content.associations}`);
        if (!content.nodes) errorDetails.push('缺少 nodes 字段');
        else if (!Array.isArray(content.nodes))
          errorDetails.push(`nodes 不是数组，而是 ${typeof content.nodes}`);
        if (!content.edges) errorDetails.push('缺少 edges 字段');
        else if (!Array.isArray(content.edges))
          errorDetails.push(`edges 不是数组，而是 ${typeof content.edges}`);

        console.error('[handleLoadFileChange] 文件格式检查失败:', {
          contentKeys: Object.keys(content || {}),
          errorDetails,
        });
        alert(
          `文件格式错误：请选择story_data（包含 videoNodes 等）或 React Flow 格式（包含 nodes 和 edges）的文件。\n\n检测到的问题：\n${
            errorDetails.length > 0 ? errorDetails.join('\n') : '未知格式'
          }`
        );
        return false;
      } catch (error) {
        console.error('文件格式错误:', error);
        alert('文件格式错误，请选择正确的JSON文件');
        return false;
      }
    },
    [
      setNodes,
      setEdges,
      setReactFlowNodes,
      setReactFlowEdges,
      setVariables,
      setStartNode,
    ]
  );

  const [draggingEdge, setDraggingEdge] = React.useState(null);
  const [dragStartPosition, setDragStartPosition] = React.useState({ x: 0, y: 0 });
  const [dragOverlayPath, setDragOverlayPath] = React.useState(null);

  const pendingDisconnectRef = useRef(null);
  const connectSuccessRef = useRef(false);

  // 优化MiniMap的节点颜色函数
  const nodeColor = useMemo(() => {
    return (node) => {
      switch (node.type) {
        case 'videoNode':
          return '#1890ff';
        case 'optionNode':
          return '#ff6b6b';
        case 'bgmNode':
          return '#51cf66';
        case 'cardNode':
          return '#ffd43b';
        case 'jumpNode':
          return '#ff922b';
        case 'taskNode':
          return '#74c0fc';
        case 'tipNode':
          return '#94d82d';
        default:
          return '#999';
      }
    };
  }, []);

  // 同步 Zustand store 和 React Flow 状态（使用防抖优化）
  React.useEffect(() => {
    const selectedSet = new Set(
      (selectedNodeIds && selectedNodeIds.length > 0)
        ? selectedNodeIds
        : selectedNodeId ? [selectedNodeId] : []
    );
    const nodesWithSelection = nodes.map((node) => ({
      ...node,
      selected: selectedSet.has(node.id),
    }));
    setReactFlowNodes(nodesWithSelection);
  }, [nodes, setReactFlowNodes, selectedNodeId, selectedNodeIds]);

  React.useEffect(() => {
    setReactFlowEdges(edges);
  }, [edges, setReactFlowEdges]);

  const groupCount = groups ? groups.length : 0;

React.useEffect(() => {
    if (groupCount > 0) {
      recalculateAllGroupBounds();
    }
  }, [nodes, groupCount, recalculateAllGroupBounds]);

  // 同步 selectedNodeId 到父组件
  React.useEffect(() => {
    if (onNodeSelect) {
      onNodeSelect(selectedNodeId);
    }
  }, [selectedNodeId, onNodeSelect]);

  // 处理节点变化
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);

    let workingNodes = reactFlowNodes;
    let nodesChanged = false;
    let groupBoundsChanged = false;
    const groupDeltas = new Map();

    // 处理删除操作
    const removeChanges = changes.filter(change => change.type === 'remove');
    if (removeChanges.length > 0) {
      const removedIds = removeChanges.map(change => change.id);
      workingNodes = workingNodes.filter(node => !removedIds.includes(node.id));
      nodesChanged = true;
      removeNodesFromGroups(removedIds);
    }

    // 检测拖拽开始
    const dragStartChanges = changes.filter(change =>
      change.type === 'position' && change.dragging === true
    );
    if (dragStartChanges.length > 0) {
      const node = reactFlowNodes.find(n => n.id === dragStartChanges[0].id);
      setDraggingNode(node);
      setPanLocked(true);
    }

    // 处理位置变化和拖拽结束
    const dragEndChanges = changes.filter(change =>
      change.type === 'position' && change.dragging === false
    );

    // 处理位置变化（拖拽过程中）
    const positionChanges = changes.filter(change =>
      change.type === 'position' && change.dragging === true && change.position
    );

    positionChanges.forEach((change) => {
      const nodeId = change.id;
      const nodeBefore = reactFlowNodes.find(node => node.id === nodeId);
      const nodeAfter = change.position;
      if (!nodeBefore || !nodeAfter) {
        return;
      }

      const deltaX = nodeAfter.x - (nodeBefore.position?.x ?? 0);
      const deltaY = nodeAfter.y - (nodeBefore.position?.y ?? 0);
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      const group = groups.find((item) => Array.isArray(item.childNodeIds) && item.childNodeIds.includes(nodeId));
      if (!group) {
        return;
      }

      const childSet = new Set(group.childNodeIds || []);
      const updatedNodes = [];
      workingNodes = workingNodes.map((node) => {
        if (node.id === nodeId) {
              nodesChanged = true;
          updatedNodes.push(node.id);
              return {
            ...node,
            position: { x: nodeAfter.x, y: nodeAfter.y },
              };
            }
        if (childSet.has(node.id)) {
          const basePos = node.position || { x: 0, y: 0 };
              nodesChanged = true;
          updatedNodes.push(node.id);
              return {
            ...node,
                position: {
              x: basePos.x + deltaX,
              y: basePos.y + deltaY,
                },
              };
            }
        return node;
      });

      const currentBounds = group.bounds || { x: 0, y: 0, width: group.bounds?.width ?? 0, height: group.bounds?.height ?? 0 };
      const existingDelta = groupDeltas.get(group.id) || { dx: 0, dy: 0 };
      groupDeltas.set(group.id, {
        dx: existingDelta.dx + deltaX,
        dy: existingDelta.dy + deltaY,
      });
      const boundsDelta = groupDeltas.get(group.id);
      if (boundsDelta) {
        useFlowStore.getState().setGroupBounds(group.id, {
          x: currentBounds.x + boundsDelta.dx,
          y: currentBounds.y + boundsDelta.dy,
          width: currentBounds.width,
          height: currentBounds.height,
        });
        groupBoundsChanged = true;
      }
    });

    if (dragEndChanges.length > 0) {
      if (isDraggingOverDelete && draggingNode) {
        // 删除节点
        const updatedNodes = workingNodes.filter(node => node.id !== draggingNode.id);
        workingNodes = updatedNodes;
        nodesChanged = true;

        const updatedEdges = reactFlowEdges.filter(edge =>
          edge.source !== draggingNode.id && edge.target !== draggingNode.id
        );
        setEdges(updatedEdges);
        setReactFlowEdges(updatedEdges);
      } else {
        // 正常更新位置
        workingNodes = workingNodes.map(node => {
          const change = dragEndChanges.find(c => c.id === node.id);
          if (change && change.position) {
            return { ...node, position: change.position };
          }
          return node;
        });
        nodesChanged = true;
      }

      setDraggingNode(null);
      setIsDraggingOverDelete(false);
      setPanLocked(false);
    }

    if (nodesChanged) {
      setNodes(workingNodes);
      setReactFlowNodes(workingNodes);
    }

    if (groupBoundsChanged || dragEndChanges.length > 0) {
      recalculateAllGroupBounds();
      groupDeltas.clear();
    }
  }, [onNodesChange, reactFlowNodes, setNodes, setReactFlowNodes, isDraggingOverDelete, draggingNode, reactFlowEdges, setEdges, setReactFlowEdges, removeNodesFromGroups, recalculateAllGroupBounds, groups]);

  // 处理边变化
  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    
    // 处理删除操作
    const removeChanges = changes.filter(change => change.type === 'remove');
    if (removeChanges.length > 0) {
      const removedIds = removeChanges.map(change => change.id);
      const updatedEdges = reactFlowEdges.filter(edge => !removedIds.includes(edge.id));
      setEdges(updatedEdges);
    } else {
      setEdges(reactFlowEdges);
    }
  }, [onEdgesChange, reactFlowEdges, setEdges]);

  // 处理连接
  const onConnect = useCallback((params) => {
    connectSuccessRef.current = true;
    pendingDisconnectRef.current = null;
    const newEdge = addEdge(params, reactFlowEdges);
    setReactFlowEdges(newEdge);
    setEdges(newEdge);
  }, [reactFlowEdges, setReactFlowEdges, setEdges]);

  const removeEdgesForHandle = useCallback((nodeId, handleId) => {
    if (!nodeId) {
      return;
    }
    setEdges((prevEdges) => {
      let changed = false;
      const updatedEdges = prevEdges.filter((edge) => {
        if (edge.target !== nodeId) {
          return true;
        }
        if (!handleId) {
          changed = true;
          return false;
        }
        const edgeHandle = edge.targetHandle ?? 'input';
        if (edgeHandle === handleId) {
          changed = true;
          return false;
        }
        return true;
      });
      if (changed) {
        setReactFlowEdges(updatedEdges);
      }
      return updatedEdges;
    });
  }, [setEdges, setReactFlowEdges]);

  const handleConnectStart = useCallback((_event, params) => {
    connectSuccessRef.current = false;
    if (params?.handleType === 'target') {
      const handleId = params.handleId || 'input';
      pendingDisconnectRef.current = {
        nodeId: params.nodeId,
        handleId,
      };
    } else {
      pendingDisconnectRef.current = null;
    }
  }, []);

  const handleConnectStop = useCallback(() => {
    if (!connectSuccessRef.current && pendingDisconnectRef.current) {
      const { nodeId, handleId } = pendingDisconnectRef.current;
      removeEdgesForHandle(nodeId, handleId);
    }
    pendingDisconnectRef.current = null;
    connectSuccessRef.current = false;
  }, [removeEdgesForHandle]);

  // 处理节点选择
  const onSelectionChange = useCallback(({ nodes: selectedNodes = [], edges: selectedEdgesList = [] }) => {
    setSelectedEdges(selectedEdgesList || []);
    if (isMultiSelectEnabled) {
      return;
    }
    const selectedIds = selectedNodes.map((node) => node.id);
    setSelectedNodes(selectedIds);
    if (selectedIds.length > 0) {
      selectNode(selectedIds[selectedIds.length - 1]);
      } else {
        selectNode(null);
      }
  }, [isMultiSelectEnabled, setSelectedEdges, setSelectedNodes, selectNode]);

  // 获取画布中心位置的辅助函数
  const getCanvasCenterPosition = useCallback(() => {
    if (!containerRef.current || !reactFlowInstance) {
      return { x: 250, y: 150 }; // 默认位置
    }
    
    const viewport = reactFlowInstance.getViewport();
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerSize = {
      width: containerRect.width,
      height: containerRect.height
    };
    
    return calculateCanvasCenter(viewport, containerSize);
  }, [reactFlowInstance]);

  // 添加视频节点
  const handleAddVideoNode = () => {
    const centerPosition = getCanvasCenterPosition();
    addNode({
      nodeName: `视频节点_${Date.now()}`,
    }, centerPosition);
  };

  // 添加选项节点
  const handleAddOptionNode = () => {
    const centerPosition = getCanvasCenterPosition();
    addOptionNode({
      optionText: `选项_${Date.now()}`,
    }, centerPosition);
  };

  // 添加BGM节点
  const handleAddBgmNode = () => {
    const centerPosition = getCanvasCenterPosition();
    addBgmNode({
      audioFile: `♫ 无 (音频剪辑)`,
    }, centerPosition);
  };

  // 添加卡牌节点
  const handleAddCardNode = () => {
    const centerPosition = getCanvasCenterPosition();
    addCardNode({
      nodeName: `卡牌_${Date.now()}`,
    }, centerPosition);
  };

  // 添加跳转节点
  const handleAddJumpNode = () => {
    const centerPosition = getCanvasCenterPosition();
    addJumpNode({
      jumpPointId: `跳转点_${Date.now()}`,
    }, centerPosition);
  };

  // 添加任务节点
  const handleAddTaskNode = () => {
    const centerPosition = getCanvasCenterPosition();
    addTaskNode({
      maxDisplayCount: 3,
    }, centerPosition);
  };

  // 处理设置起始节点
  const handleSetStartNode = () => {
    if (selectedNodeId) {
      setStartNode(selectedNodeId);
      const startNode = nodes.find(n => n.id === selectedNodeId);
      alert(`已将节点 "${startNode?.data?.nodeName || selectedNodeId}" 设置为起始节点`);
    } else {
      alert('请选择一个节点作为起始节点');
    }
  };

  const handleNodeClick = useCallback((event, node) => {
    if (isMultiSelectEnabled) {
      event.preventDefault();
      event.stopPropagation();
      toggleSelectedNode(node.id);
    } else {
      clearGroupSelection();
      selectNode(node.id);
      setSelectedNodes([node.id]);
    }
  }, [isMultiSelectEnabled, toggleSelectedNode, selectNode, clearGroupSelection, setSelectedNodes]);

  const handlePaneClick = useCallback((event) => {
    if (isMultiSelectEnabled) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setSelectedNodes([]);
    } else {
      selectNode(null);
      setSelectedNodes([]);
    }
    clearGroupSelection();
  }, [isMultiSelectEnabled, setSelectedNodes, selectNode, clearGroupSelection]);

  const handleMultiSelectButtonClick = useCallback(() => {
    if (isMultiSelectEnabled) {
      if (selectedNodeIds.length > 0) {
        createGroup(selectedNodeIds);
      }
      setSelectedNodes([]);
    toggleMultiSelect();
    } else {
      toggleMultiSelect();
      if (selectedNodeId) {
        setSelectedNodes([selectedNodeId]);
      }
    }
    setPanLocked(false);
  }, [isMultiSelectEnabled, selectedNodeIds, selectedNodeId, toggleMultiSelect, createGroup, setSelectedNodes, setPanLocked]);

  const handleJoinGroupClick = useCallback(() => {
    if (!activeGroup || pendingJoinNodeIds.length === 0) {
      return;
    }
    addNodesToGroup(activeGroup.id, pendingJoinNodeIds);
      setSelectedNodes([]);
  }, [activeGroup, pendingJoinNodeIds, addNodesToGroup, setSelectedNodes]);

  // 处理删除区域鼠标进入
  const handleDeleteZoneEnter = () => {
    if (draggingNode) {
      setIsDraggingOverDelete(true);
    }
  };

  // 处理删除区域鼠标离开
  const handleDeleteZoneLeave = () => {
    setIsDraggingOverDelete(false);
  };

  // 处理边的点击事件（用于拖拽删除）
  const handleEdgeClick = useCallback((event, edge) => {
    // 阻止默认行为
    event.preventDefault();
    
    // 设置提示：可以拖拽此边到删除区域
    console.log('边被点击，可以拖拽到删除区域删除', edge);
  }, []);

  // 计算拖拽路径 - 使用屏幕坐标
  const computeDragPath = useCallback((pathData) => {
    if (!pathData) return '';
    
    const { sourceScreenPos, targetScreenPos, deltaX = 0, deltaY = 0 } = pathData;
    
    if (!sourceScreenPos || !targetScreenPos) return '';
    
    // 使用记录的屏幕坐标 + 拖拽偏移
    const sourceX = sourceScreenPos.x + deltaX;
    const sourceY = sourceScreenPos.y + deltaY;
    const targetX = targetScreenPos.x + deltaX;
    const targetY = targetScreenPos.y + deltaY;
    
    // 计算贝塞尔曲线的控制点
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2 - 20;
    
    const path = `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;
    console.log('计算路径 (屏幕坐标):', { sourceX, sourceY, targetX, targetY, deltaX, deltaY });
    return path;
  }, []);

  // 处理边的鼠标按下事件
  const handleEdgeMouseDown = useCallback((event, edge) => {
    event.preventDefault();
    
    // 获取连线的起点和终点节点
    const sourceNode = reactFlowNodes.find(n => n.id === edge.source);
    const targetNode = reactFlowNodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;
    
    // 获取 React Flow 容器的位置和变换信息
    const reactFlowWrapper = document.querySelector('.react-flow__viewport');
    const reactFlowContainer = document.querySelector('.react-flow');
    
    if (!reactFlowWrapper || !reactFlowContainer) {
      console.warn('无法找到 React Flow 容器');
      return;
    }
    
    const transform = reactFlowWrapper.style.transform;
    // 解析 transform: translate(x, y) scale(z)
    const match = transform.match(/translate\(([^,]+)px?,\s*([^)]+)px?\)\s*scale\(([^)]+)\)/);
    
    if (match) {
      const translateX = parseFloat(match[1]);
      const translateY = parseFloat(match[2]);
      const scale = parseFloat(match[3]);
      
      // 计算节点在屏幕上的位置
      const containerRect = reactFlowContainer.getBoundingClientRect();
      
      // 节点中心点坐标（假设节点宽度 300px，高度 100px）
      const sourceScreenPos = {
        x: containerRect.left + (sourceNode.position.x + 150) * scale + translateX,
        y: containerRect.top + (sourceNode.position.y + 50) * scale + translateY
      };
      
      const targetScreenPos = {
        x: containerRect.left + (targetNode.position.x + 150) * scale + translateX,
        y: containerRect.top + (targetNode.position.y + 50) * scale + translateY
      };
      
      console.log('屏幕坐标计算:', {
        translateX, translateY, scale,
        sourceScreenPos, targetScreenPos,
        sourceNodePos: sourceNode.position,
        targetNodePos: targetNode.position
      });
      
      // 创建覆盖层路径数据
      setDragOverlayPath({
        sourceNode,
        targetNode,
        edge,
        sourceScreenPos,
        targetScreenPos,
        deltaX: 0,
        deltaY: 0
      });
    } else {
      console.warn('无法解析 transform:', transform);
    }
    
    setIsDraggingEdge(true);
    setDraggingEdge(edge);
    setDragStartPosition({ x: event.clientX, y: event.clientY });
    console.log('开始拖拽连线:', edge.id);
  }, [reactFlowNodes]);

  // 处理边的拖拽移动
  const handleEdgeDragMove = useCallback((event) => {
    if (!isDraggingEdge || !dragOverlayPath) return;
    
    // 计算拖拽偏移
    const deltaX = event.clientX - dragStartPosition.x;
    const deltaY = event.clientY - dragStartPosition.y;
    
    // 更新覆盖层位置
    setDragOverlayPath(prev => ({
      ...prev,
      deltaX,
      deltaY
    }));
    
    console.log('拖拽移动:', { deltaX, deltaY });
    
    // 原始连线设置为半透明
    const updatedEdges = reactFlowEdges.map(edge => {
      if (edge.id === draggingEdge.id) {
        return {
          ...edge,
          style: { ...edge.style, opacity: 0.3 }
        };
      }
      return edge;
    });
    setReactFlowEdges(updatedEdges);
    
    // 检查是否在删除区域
    const deleteZone = document.querySelector(`.${styles.deleteZone}`);
    if (deleteZone) {
      const rect = deleteZone.getBoundingClientRect();
      const isOverDelete = event.clientX >= rect.left && 
                          event.clientX <= rect.right && 
                          event.clientY >= rect.top && 
                          event.clientY <= rect.bottom;
      
      setIsDraggingOverDelete(isOverDelete);
    }
  }, [isDraggingEdge, dragOverlayPath, dragStartPosition, reactFlowEdges, draggingEdge, styles.deleteZone]);

  // 处理边的拖拽结束
  const handleEdgeDragEnd = useCallback((event) => {
    if (!isDraggingEdge || !draggingEdge) return;
    
    // 检查是否在删除区域
    const deleteZone = document.querySelector(`.${styles.deleteZone}`);
    let shouldDelete = false;
    
    if (deleteZone) {
      const rect = deleteZone.getBoundingClientRect();
      shouldDelete = event.clientX >= rect.left && 
                    event.clientX <= rect.right && 
                    event.clientY >= rect.top && 
                    event.clientY <= rect.bottom;
    }
    
    if (shouldDelete) {
      // 删除连线
      const updatedEdges = reactFlowEdges.filter(edge => edge.id !== draggingEdge.id);
      setEdges(updatedEdges);
      setReactFlowEdges(updatedEdges);
      console.log('连线已删除:', draggingEdge.id);
    } else {
      // 恢复连线的透明度
      const updatedEdges = reactFlowEdges.map(edge => {
        if (edge.id === draggingEdge.id) {
          return {
            ...edge,
            style: { ...edge.style, opacity: 1 }
          };
        }
        return edge;
      });
      setReactFlowEdges(updatedEdges);
      console.log('连线已恢复');
    }
    
    // 清除覆盖层
    setDragOverlayPath(null);
    
    // 重置拖拽状态
    setIsDraggingEdge(false);
    setDraggingEdge(null);
    setIsDraggingOverDelete(false);
  }, [isDraggingEdge, draggingEdge, reactFlowEdges, setEdges, setReactFlowEdges, styles.deleteZone]);

  // 监听鼠标拖拽（用于检测拖拽选中的边）
  React.useEffect(() => {
    const handleMouseMove = (e) => {
      // 如果正在拖拽连线，调用拖拽移动处理
      if (isDraggingEdge) {
        handleEdgeDragMove(e);
        return;
      }
      
      // 如果有选中的边且鼠标按下（旧的方式，保留作为备选）
      if (selectedEdges.length > 0 && e.buttons === 1 && !isDraggingEdge) {
        // 获取删除区域的位置
        const deleteZone = document.querySelector(`.${styles.deleteZone}`);
        if (deleteZone) {
          const rect = deleteZone.getBoundingClientRect();
          const isOverDelete = e.clientX >= rect.left && 
                              e.clientX <= rect.right && 
                              e.clientY >= rect.top && 
                              e.clientY <= rect.bottom;
          
          if (isOverDelete) {
            setIsDraggingOverDelete(true);
          } else {
            setIsDraggingOverDelete(false);
          }
        }
      }
    };

    const handleMouseUp = (e) => {
      // 如果正在拖拽连线，调用拖拽结束处理
      if (isDraggingEdge) {
        handleEdgeDragEnd(e);
        return;
      }
      
      // 如果松开鼠标时在删除区域且有选中的边（旧的方式）
      if (isDraggingOverDelete && selectedEdges.length > 0) {
        // 删除选中的边
        const edgeIdsToDelete = selectedEdges.map(edge => edge.id);
        const updatedEdges = reactFlowEdges.filter(edge => !edgeIdsToDelete.includes(edge.id));
        setEdges(updatedEdges);
        setReactFlowEdges(updatedEdges);
        setSelectedEdges([]);
        console.log('已删除边:', edgeIdsToDelete);
      }
      setIsDraggingOverDelete(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedEdges, isDraggingOverDelete, reactFlowEdges, setEdges, setReactFlowEdges, styles.deleteZone, isDraggingEdge, handleEdgeDragMove, handleEdgeDragEnd]);

  // 处理加载文件选择
  const handleLoadFileSelect = useCallback(async () => {
    if (window.showOpenFilePicker) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'JSON 文件',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        if (!fileHandle) {
          return;
        }
        const file = await fileHandle.getFile();
        const text = await file.text();
        const content = JSON.parse(text);
        const success = processLoadedJson(content, {
          fileHandle,
          fileName: file.name || fileHandle.name || '',
        });
        if (!success) {
          lastLoadedFileHandleRef.current = null;
          lastLoadedFileNameRef.current = '';
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          console.log('用户取消了文件选择');
              } else {
          console.error('加载文件失败:', error);
          alert(`加载失败：${error?.message || error}`);
        }
        lastLoadedFileHandleRef.current = null;
        lastLoadedFileNameRef.current = '';
            }
          } else {
      lastLoadedFileHandleRef.current = null;
      lastLoadedFileNameRef.current = '';
      loadFileInputRef.current?.click();
    }
  }, [processLoadedJson]);

  // 处理加载文件变化
  const handleLoadFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    lastLoadedFileHandleRef.current = null;
    lastLoadedFileNameRef.current = file.name || '';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target.result);
        const success = processLoadedJson(content, {
          fileHandle: null,
          fileName: file.name || '',
        });
        if (!success) {
          lastLoadedFileNameRef.current = '';
        }
        } catch (error) {
          console.error('文件格式错误:', error);
          alert('文件格式错误，请选择正确的JSON文件');
        lastLoadedFileNameRef.current = '';
        }
      };
      reader.readAsText(file);
      
      // 重置文件输入，允许重复加载同一文件
      e.target.value = '';
  };

  // 处理导出节点
  const handleExportNodes = async () => {
      const { nodes, edges, variables, startNodeId } = useFlowStore.getState();
    const storyData = convertFlowToStoryData(nodes, edges, variables, startNodeId);

    const nodeCount =
      storyData.videoNodes.length +
      storyData.choiceNodes.length +
      storyData.bgmNodes.length +
      storyData.cardNodes.length +
      storyData.jumpNodes.length +
      storyData.taskNodes.length +
      storyData.tipNodes.length;
    const edgeCount = edges.length;
    const variableCount = storyData.variables.length;

    const json = JSON.stringify(storyData, null, 2);
    const suggestedName = lastLoadedFileNameRef.current
      ? lastLoadedFileNameRef.current
      : `moban_${Date.now()}.json`;

    const fileHandle = lastLoadedFileHandleRef.current;
    if (fileHandle && typeof fileHandle.createWritable === 'function') {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        alert(
          `节点导出成功！\n\n节点数: ${nodeCount}\n连线数: ${edgeCount}\n变量数: ${variableCount}`
        );
        return;
      } catch (error) {
        console.error('覆盖原文件失败，尝试另存为:', error);
      }
    }

    const saveWithPicker = async () => {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'JSON文件',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      lastLoadedFileHandleRef.current = handle;
      lastLoadedFileNameRef.current = handle.name || suggestedName;
    };

    const saveWithFallback = () => {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      lastLoadedFileHandleRef.current = null;
    };

    try {
      if (window.showSaveFilePicker) {
        await saveWithPicker();
        } else {
        saveWithFallback();
      }
      alert(
        `节点导出成功！\n\n节点数: ${nodeCount}\n连线数: ${edgeCount}\n变量数: ${variableCount}`
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        console.log('用户取消了文件保存');
        return;
      }
        console.error('导出节点失败:', error);
      alert(`导出失败！\n\n错误信息: ${error?.message || error}`);
    }
  };

  // 处理导出PG格式
  // 生成UUID（简化版）
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // 格式化条件文本为ProjectGraph格式
  const formatConditionForPG = (condition) => {
    if (condition.leftValue && /[+\-*/><=]/.test(condition.leftValue)) {
      return condition.leftValue;
    }
    const operatorMap = {
      'Equals': '==',
      'NotEquals': '!=',
      'GreaterThan': '>',
      'LessThan': '<',
      'GreaterOrEqual': '>=',
      'LessOrEqual': '<='
    };
    const op = operatorMap[condition.operator] || condition.operator || '==';
    return `${condition.leftValue || ''}${op}${condition.rightValue || ''}`;
  };

  // 格式化效果文本为ProjectGraph格式
  const formatEffectForPG = (effect) => {
    const variableName = effect.variableName || '';
    let operation = effect.operation || 'Set';
    const value = effect.value || '';
    const style = effect.style || 'Normal';
    
    // 如果operation是数字，转换为字符串
    // 0 = Set, 1 = Add, 2 = Subtract, 3 = Multiply, 4 = Divide
    if (typeof operation === 'number') {
      const numberToOperationMap = {
        0: 'Set',
        1: 'Add',
        2: 'Subtract',
        3: 'Multiply',
        4: 'Divide'
      };
      operation = numberToOperationMap[operation] || 'Set';
    }
    
    const operationMap = {
      'Set': '=',
      'Add': '+',
      'Subtract': '-',
      'Multiply': '*',
      'Divide': '/'
    };
    
    const operationSymbol = operationMap[operation] || operation;
    const prefix = style === 'Accumulative' ? 'A:' : '';
    
    if (value) {
      // 格式：<变量名 操作符 值> 或 <A:变量名 操作符 值>（累加变量）
      return `<${prefix}${variableName} ${operationSymbol} ${value}>`;
    } else {
      return `<${prefix}${variableName} ${operationSymbol}>`;
    }
  };

  // 格式化广告标记为ProjectGraph格式
  const formatAdMarkForPG = (requiresAd, adType, isRewardedVideo) => {
    if (!requiresAd) return '';
    
    // 如果有adType，根据adType生成对应的标记
    if (adType) {
      if (adType === 'fullscreen') {
        return '《AD:15》';
      } else if (adType === 'rewarded') {
        return '《AD:30》';
      } else if (adType === 'splash') {
        return '《AD:3》';
      }
    }
    
    // 如果没有adType，但isRewardedVideo为true，使用默认激励广告
    if (isRewardedVideo) {
      return '《AD:30》';
    }
    
    // 默认情况下使用基础广告标记
    return '《AD》';
  };

  // 生成节点文本内容（ProjectGraph格式）
  const generateNodeText = (node) => {
    const data = node.data || {};
    const parts = [];

    // VideoNode相关标签
    if (node.type === 'videoNode') {
      // 起点标记
      if (startNodeId === node.id) {
        parts.push('[起点]');
      }

      // 检查点标记
      if (data.isCheckpoint) {
        const checkpointName = data.nodeName || '';
        if (checkpointName) {
          parts.push(`[CP:${checkpointName}]`);
        } else {
          parts.push('[CP]');
        }
      }

      // 循环视频标记
      if (data.loop) {
        parts.push('[循环视频]');
      }

      // 随机时间事件标记
      if (data.hasRandomTimeEvent && data.randomTimeMinSeconds !== undefined && data.randomTimeMaxSeconds !== undefined) {
        const min = Math.round(data.randomTimeMinSeconds || 0);
        const max = Math.round(data.randomTimeMaxSeconds || 0);
        parts.push(`[随机时间事件(${min}-${max})]`);
      }

      // 对话框标记
      if (data.isDialogue && data.dialogueText) {
        const speaker = data.dialogueSpeaker || '';
        const audio = data.dialogueAudioPath || '';
        if (speaker) {
          parts.push(`[对话框(${speaker}):${data.dialogueText}${audio ? ':' + audio : ''}]`);
        } else {
          parts.push(`[对话框:${data.dialogueText}${audio ? ':' + audio : ''}]`);
        }
      }

      // 回忆节点标记
      if (data.isMemory && data.memoryName) {
        parts.push(`[回忆节点:${data.memoryName}]`);
      }

      // 死亡节点标记
      if (data.isDeathPoint) {
        parts.push('[死亡节点]');
      }

      // 结束节点标记
      if (data.isEndpoint) {
        parts.push('[结束节点]');
      }

      // 黑屏视频节点标记
      if (data.isBlackScreen) {
        parts.push('[黑屏视频节点]');
      }

      // 跳转点标记
      if (data.isJumpPoint && data.jumpPointId) {
        parts.push(`[跳转点:${data.jumpPointId}]`);
      }

      // 随机节点标记
      if (data.isRandomNode && data.probabilityExpression) {
        parts.push(`《${data.probabilityExpression}》`);
      }

      // 解锁成就标记
      if (data.unlockAchievement && data.achievementName) {
        parts.push(`[解锁成就:${data.achievementName}]`);
      }

      // 数据统计标记
      if (data.enableStats && data.statsKeyPoint) {
        parts.push(`[数据统计:${data.statsKeyPoint}]`);
      }

      // 变量条标记
      if (data.showVariableBar && data.variableName) {
        const color = data.fillColor || '#ffffff';
        const position = data.barPosition || '上';
        parts.push(`[变量条:${data.variableName}:${color}:${position}]`);
      }

      // 重置到CP点标记
      if (data.isResetToCP) {
        parts.push('[重置到CP点]');
      }

      // 条件标记（视频节点的条件）
      if (data.conditions && Array.isArray(data.conditions) && data.conditions.length > 0) {
        data.conditions.forEach(condition => {
          const conditionText = formatConditionForPG(condition);
          parts.push(`《${conditionText}》`);
        });
      }

      // 持续累加变量标记（循环视频中的每秒变化）
      if (data.loop && data.rateEffects && Array.isArray(data.rateEffects) && data.rateEffects.length > 0) {
        data.rateEffects.forEach(rateEffect => {
          const variableName = rateEffect.variableName || '';
          const rate = rateEffect.ratePerSecond || 0;
          if (variableName && rate !== 0) {
            const sign = rate >= 0 ? '+' : '';
            parts.push(`<${variableName} ${sign}${rate}/s>`);
          }
        });
      }

      // 效果标记
      if (data.effects && Array.isArray(data.effects) && data.effects.length > 0) {
        data.effects.forEach(effect => {
          parts.push(formatEffectForPG(effect));
        });
      }

      // 最小/最大默认值标记
      if (data.minDefaultValueOverrides && Array.isArray(data.minDefaultValueOverrides) && data.minDefaultValueOverrides.length > 0) {
        data.minDefaultValueOverrides.forEach(override => {
          const varName = override.variableName || '';
          const minValue = override.minValue || 0;
          if (varName) {
            parts.push(`<最小默认值:${varName}:${minValue}>`);
          }
        });
      }
      if (data.maxDefaultValueOverrides && Array.isArray(data.maxDefaultValueOverrides) && data.maxDefaultValueOverrides.length > 0) {
        data.maxDefaultValueOverrides.forEach(override => {
          const varName = override.variableName || '';
          const maxValue = override.maxValue || 0;
          if (varName) {
            parts.push(`<最大默认值:${varName}:${maxValue}>`);
          }
        });
      }

      // 节点名称（视频文件名称）
      const nodeName = data.nodeName || '';
      if (nodeName) {
        parts.push(nodeName);
      }
    }

    // OptionNode相关标签
    else if (node.type === 'optionNode') {
      // 条件标记
      if (data.conditions && Array.isArray(data.conditions) && data.conditions.length > 0) {
        data.conditions.forEach(condition => {
          const conditionText = formatConditionForPG(condition);
          parts.push(`《${conditionText}》`);
        });
      }

      // 广告标记（需要在选项标记之前）
      const adMark = formatAdMarkForPG(data.requiresAd, data.adType, data.isRewardedVideo);
      if (adMark) {
        parts.push(adMark);
      }

      // 叠加图片选项标记
      if (data.enableOverlayImage) {
        const clickable = data.optionClickable !== false; // 默认可点击
        parts.push(`[叠加图片选项:${clickable}]`);
        // 层级标记
        if (data.layerIndex !== undefined && data.layerIndex !== 0) {
          parts.push(`[层级:${data.layerIndex}]`);
        }
      }

      // 隐藏选项标记
      if (data.isHidden) {
        parts.push('[隐藏选项]');
      } else {
        parts.push('[选项]');
      }

      // 提前标记
      if (data.isEarly || data.preDisplay) {
        parts.push('[提前]');
      }

      // 效果标记
      if (data.effects && Array.isArray(data.effects) && data.effects.length > 0) {
        data.effects.forEach(effect => {
          parts.push(formatEffectForPG(effect));
        });
      }

      // 选项文本
      const optionText = data.optionText || '';
      if (optionText) {
        parts.push(optionText);
      }
    }

    // BgmNode相关标签
    else if (node.type === 'bgmNode') {
      parts.push('[BGM]');
      const bgmName = data.audioFile || data.bgmName || '';
      if (bgmName) {
        parts.push(bgmName);
      }
    }

    // CardNode相关标签
    else if (node.type === 'cardNode') {
      // 条件标记
      if (data.conditions && Array.isArray(data.conditions) && data.conditions.length > 0) {
        data.conditions.forEach(condition => {
          const conditionText = formatConditionForPG(condition);
          parts.push(`《${conditionText}》`);
        });
      }

      // 广告标记（需要在选项标记之前）
      const adMark = formatAdMarkForPG(data.requiresAd, data.adType, data.isRewardedVideo);
      if (adMark) {
        parts.push(adMark);
      }

      // 叠加图片选项标记（卡牌节点也可能有）
      if (data.enableOverlayImage) {
        const clickable = data.optionClickable !== false; // 默认可点击
        parts.push(`[叠加图片选项:${clickable}]`);
        // 层级标记
        if (data.layerIndex !== undefined && data.layerIndex !== 0) {
          parts.push(`[层级:${data.layerIndex}]`);
        }
      }

      // 隐藏选项标记
      if (data.isHidden) {
        parts.push('[隐藏]');
      }

      // 提前标记
      if (data.isEarly || data.preDisplay) {
        parts.push('[提前]');
      }

      parts.push('[卡牌选项]');
      
      // 卡牌名称
      const cardName = data.cardName || '';
      if (cardName) {
        parts.push(cardName);
      }

      // 效果标记
      if (data.effects && Array.isArray(data.effects) && data.effects.length > 0) {
        data.effects.forEach(effect => {
          parts.push(formatEffectForPG(effect));
        });
      }
    }

    // JumpNode相关标签
    else if (node.type === 'jumpNode') {
      parts.push('[跳转节点]');
      const jumpPointId = data.jumpPointId || '';
      if (jumpPointId) {
        parts.push(jumpPointId);
      }
    }

    // TaskNode相关标签
    else if (node.type === 'taskNode') {
      const maxDisplayCount = data.maxDisplayCount || 3;
      parts.push(`[任务节点:${maxDisplayCount}]`);
      const taskName = data.taskName || '';
      if (taskName) {
        parts.push(taskName);
      }
    }

    return parts.join('');
  };

  // 转换节点为ProjectGraph entities
  const convertNodesToEntities = (nodes) => {
    return nodes.map(node => {
      const data = node.data || {};
      const position = node.position || { x: 0, y: 0 };
      
      // 根据节点类型设置默认大小和颜色
      let defaultSize = [200, 76];
      let defaultColor = [0, 0, 0, 0];
      
      if (node.type === 'optionNode' || node.type === 'cardNode') {
        defaultColor = [168, 85, 247, 1]; // 紫色
      } else if (node.type === 'bgmNode') {
        defaultColor = [0, 0, 0, 0]; // 默认颜色
      } else if (node.type === 'jumpNode') {
        defaultColor = [22, 254, 250, 1]; // 青色
      } else if (data.isCheckpoint) {
        defaultColor = [22, 163, 74, 1]; // 绿色
      } else if (data.isDeathPoint) {
        defaultColor = [239, 68, 68, 1]; // 红色
      }

      return {
        location: [position.y, position.x], // ProjectGraph使用[y, x]格式
        size: defaultSize,
        text: generateNodeText(node),
        uuid: data.id || node.id.replace(/^node_/, ''),
        details: '',
        color: defaultColor,
        type: 'core:text_node',
        sizeAdjust: 'auto'
      };
    });
  };

  // 转换edges为ProjectGraph associations
  const convertEdgesToAssociations = (edges, nodes) => {
    return edges.map(edge => {
      // 获取源节点和目标节点的uuid
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      const sourceUuid = sourceNode?.data?.id || sourceNode?.id?.replace(/^node_/, '') || edge.source;
      const targetUuid = targetNode?.data?.id || targetNode?.id?.replace(/^node_/, '') || edge.target;

      return {
        source: sourceUuid,
        target: targetUuid,
        text: edge.label || '',
        uuid: edge.id || generateUUID(),
        type: 'core:line_edge',
        color: [0, 0, 0, 0],
        sourceRectRate: [0.5, 0.5],
        targetRectRate: [0.5, 0.5]
      };
    });
  };

  // 转换ProjectGraph格式
  const convertToProjectGraphFormat = (nodes, edges, startNodeId, variables) => {
    const entities = convertNodesToEntities(nodes);
    const associations = convertEdgesToAssociations(edges, nodes);

    const projectGraphData = {
      version: 17,
      entities: entities,
      associations: associations,
      tags: []
    };

    // 如果提供了变量信息，添加到PG格式中
    if (variables && Array.isArray(variables) && variables.length > 0) {
      projectGraphData.variables = variables;
    }

    return projectGraphData;
  };

  const handleExportPG = async () => {
    // 检查浏览器是否支持 File System Access API
    if (!('showSaveFilePicker' in window)) {
      // 降级到传统下载方式
      const { nodes, edges, variables } = useFlowStore.getState();
      const projectGraphData = convertToProjectGraphFormat(nodes, edges, startNodeId, variables);
      const json = JSON.stringify(projectGraphData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const variablesCount = projectGraphData.variables ? projectGraphData.variables.length : 0;
      alert(`导出成功！\n\n实体数: ${projectGraphData.entities.length}\n连接数: ${projectGraphData.associations.length}\n变量数: ${variablesCount}`);
      return;
    }

    try {
      const { nodes, edges, variables } = useFlowStore.getState();
      const projectGraphData = convertToProjectGraphFormat(nodes, edges, startNodeId, variables);
      
      // 让用户选择保存文件的位置和名称
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `project_${Date.now()}.json`,
        types: [{
          description: 'JSON文件',
          accept: { 'application/json': ['.json'] }
        }]
      });

      // 保存项目文件
      const projectJson = JSON.stringify(projectGraphData, null, 2);
      const writable = await fileHandle.createWritable();
      await writable.write(projectJson);
      await writable.close();

      const variablesCount = projectGraphData.variables ? projectGraphData.variables.length : 0;
      alert(`导出成功！\n\n实体数: ${projectGraphData.entities.length}\n连接数: ${projectGraphData.associations.length}\n变量数: ${variablesCount}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('用户取消了文件保存');
      } else {
        console.error('导出失败:', error);
        alert(`导出失败！\n\n错误信息: ${error.message}`);
      }
    }
  };

  // 处理导入PG格式文件选择
  const handleImportPGSelect = () => {
    importPGFileInputRef.current?.click();
  };

  // 将ProjectGraph格式转换为story_data格式
  const normalizeSymbols = (text = '') => {
    return text
      .replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/\u3000/g, ' ');
  };

  const convertPGToStoryData = (pgData) => {
    const storyData = {
      videoNodes: [],
      choiceNodes: [],
      bgmNodes: [],
      cardNodes: [],
      jumpNodes: [],
      taskNodes: [],
      tipNodes: []
    };

    // 用于存储提取的变量信息
    const extractedVariables = new Map(); // Map<变量名, {isAccumulative, isShop, isVariableBar, maxValue, minValue}>
    const supplementalVariables = [];

    const entities = Array.isArray(pgData.entities) ? pgData.entities : [];
    const associations = Array.isArray(pgData.associations) ? pgData.associations : [];

    // 创建UUID到nodeId的映射 & 实体映射
    const uuidToNodeIdMap = new Map();
    const entityMap = new Map();
    entities.forEach(entity => {
      if (entity && entity.uuid) {
      uuidToNodeIdMap.set(entity.uuid, entity.uuid);
        entityMap.set(entity.uuid, entity);
      }
    });

    // 创建原始连接关系映射（source uuid -> [target uuids]）以及反向映射
    const rawConnectionMap = new Map();
    const addConnection = (source, target) => {
      if (!source || !target) return;
      if (!rawConnectionMap.has(source)) {
        rawConnectionMap.set(source, []);
      }
      rawConnectionMap.get(source).push(target);
    };

    associations.forEach(assoc => {
      if (assoc && assoc.source && assoc.target) {
        addConnection(assoc.source, assoc.target);
      }
    });

    // 如果PG格式中包含variables字段，记录这个信息（但不立即添加到extractedVariables）
    // 我们会在后面优先使用这些完整的变量信息
    const hasPGVariables = pgData.variables && Array.isArray(pgData.variables) && pgData.variables.length > 0;
    if (hasPGVariables) {
      console.log('[convertPGToStoryData] PG格式中包含变量信息，数量:', pgData.variables.length);
    }

    // 解析每个entity并提取变量（从文本中提取额外的变量，补充到已有变量中）
    const supportedEntityTypes = new Set(['core:text_node', 'core:image_node', 'core:section']);

    const skipNodeIds = new Set();
    entities.forEach(entity => {
      if (!entity || !entity.uuid) return;
      const entityType = entity.type || 'core:text_node';
      if (!supportedEntityTypes.has(entityType)) {
        skipNodeIds.add(entity.uuid);
        return;
      }

      if (entityType !== 'core:image_node') {
        const text = typeof entity.text === 'string' ? entity.text : '';
        if (!text.trim()) {
          skipNodeIds.add(entity.uuid);
          return;
        }
        if (text.includes('[X]')) {
          skipNodeIds.add(entity.uuid);
          return;
        }
      }
    });

    const demoTipNodeIds = new Set();
    entities.forEach(entity => {
      if (!entity || entity.type !== 'core:section') {
        return;
      }
      const sectionTitle = typeof entity.text === 'string' ? normalizeSymbols(entity.text) : '';
      if (!sectionTitle) {
        return;
      }
      if (sectionTitle.includes('提示语法案例')) {
        if (Array.isArray(entity.children)) {
          entity.children.forEach(childId => {
            if (childId) {
              demoTipNodeIds.add(childId);
            }
          });
        }
      }
    });

    demoTipNodeIds.forEach(id => skipNodeIds.add(id));

    // 统计坐标范围，用于归一化位置
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let positionCount = 0;

    entities.forEach(entity => {
      if (!entity || !entity.uuid) return;
      if (skipNodeIds.has(entity.uuid)) return;

      const entityType = entity.type || 'core:text_node';
      if (!supportedEntityTypes.has(entityType)) {
        return;
      }

      const location = Array.isArray(entity.location) ? entity.location : null;
      if (!location || location.length < 2) {
        return;
      }

      const rawX = Number(location[1]);
      const rawY = Number(location[0]);

      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return;
      }

      positionCount += 1;
      minX = Math.min(minX, rawX);
      minY = Math.min(minY, rawY);
      maxX = Math.max(maxX, rawX);
      maxY = Math.max(maxY, rawY);
    });

    const margin = 200;
    let offsetX = 0;
    let offsetY = 0;

    if (positionCount > 0) {
      if (minX < margin) {
        offsetX = margin - minX;
      }
      if (minY < margin) {
        offsetY = margin - minY;
      }
    }

    const previousPositionTransform = currentPositionTransform;
    currentPositionTransform = {
      offsetX,
      offsetY,
      scale: 1
    };

    console.log('[convertPGToStoryData] 坐标归一化统计:', {
      count: positionCount,
      minX,
      minY,
      maxX,
      maxY,
      offsetX,
      offsetY
    });

    const resolvedConnectionMap = new Map();
    const resolveNextNodeIds = (nodeId, breadcrumb = new Set()) => {
      if (resolvedConnectionMap.has(nodeId)) {
        return resolvedConnectionMap.get(nodeId);
      }

      const results = new Set();
      const directTargets = rawConnectionMap.get(nodeId) || [];
      const currentChain = new Set(breadcrumb);
      currentChain.add(nodeId);

      directTargets.forEach(targetId => {
        if (!entityMap.has(targetId)) {
          return;
        }

        if (skipNodeIds.has(targetId)) {
          if (currentChain.has(targetId)) {
            return;
          }
          const cascadedTargets = resolveNextNodeIds(targetId, currentChain);
          cascadedTargets.forEach(id => results.add(id));
        } else {
          results.add(targetId);
        }
      });

      const resolved = Array.from(results);
      resolvedConnectionMap.set(nodeId, resolved);
      return resolved;
    };

    entities.forEach(entity => {
      if (!entity || !entity.uuid) return;
      resolveNextNodeIds(entity.uuid);
    });

    console.log('[convertPGToStoryData] 实体统计:', {
      total: entities.length,
      typeCounts: entities.reduce((acc, entity) => {
        if (!entity) return acc;
        const type = entity?.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    });

    const shouldExtractTextVariables = true;

    entities
      .filter(entity => {
        if (!entity || !entity.uuid) {
          return false;
        }
        if (skipNodeIds.has(entity.uuid)) {
          console.log('[convertPGToStoryData] 跳过标记为忽略的实体:', entity.type, entity.uuid);
          return false;
        }

        const entityType = entity.type || 'core:text_node';
        if (!supportedEntityTypes.has(entityType)) {
          console.log('[convertPGToStoryData] 跳过不支持的实体类型:', entity.type, entity.uuid);
          return false;
        }

        if (entityType !== 'core:image_node' && (typeof entity.text !== 'string' || !entity.text.trim())) {
          console.log('[convertPGToStoryData] 跳过缺少文本的实体:', entity.uuid);
          return false;
        }

        return true;
      })
      .forEach(entity => {
      const normalizedText = entity.type === 'core:image_node' ? '' : normalizeSymbols(entity.text || '');
      const normalizedEntity = { ...entity, text: normalizedText };
      const nodeType = identifyNodeType(normalizedEntity.text, normalizedEntity.type);
      let parsedNode;
      
      // 先提取变量（从原始文本中），这样即使节点解析失败也能提取到变量
      // 对于所有节点类型，都尝试从文本中提取变量
      if (shouldExtractTextVariables && normalizedEntity.text) {
        // 创建一个临时节点对象用于提取变量
        const tempNode = { conditions: [], effects: [] };
        extractVariablesFromNode(tempNode, normalizedEntity.text, extractedVariables);
      }
      
      switch (nodeType) {
        case 'videoNode':
          parsedNode = parseVideoNode(normalizedEntity, resolvedConnectionMap);
          storyData.videoNodes.push(parsedNode);
          // 再次提取变量（从解析后的节点对象中）
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        case 'choiceNode':
          parsedNode = parseChoiceNode(normalizedEntity, resolvedConnectionMap);
          storyData.choiceNodes.push(parsedNode);
          // 再次提取变量（从解析后的节点对象中）
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        case 'cardNode':
          parsedNode = parseCardNode(normalizedEntity, resolvedConnectionMap);
          storyData.cardNodes.push(parsedNode);
          // 再次提取变量（从解析后的节点对象中）
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        case 'bgmNode':
          parsedNode = parseBGMNode(normalizedEntity, resolvedConnectionMap);
          storyData.bgmNodes.push(parsedNode);
          // BGM节点也可能包含变量引用
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        case 'jumpNode':
          parsedNode = parseJumpNode(normalizedEntity, resolvedConnectionMap);
          storyData.jumpNodes.push(parsedNode);
          // 跳转节点也可能包含变量引用
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        case 'taskNode':
          parsedNode = parseTaskNode(normalizedEntity, resolvedConnectionMap);
          storyData.taskNodes.push(parsedNode);
          // 任务节点也可能包含变量引用
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        case 'tipNode':
          parsedNode = parseTipNode(normalizedEntity, resolvedConnectionMap);
          storyData.tipNodes.push(parsedNode);
          // 提示节点也可能包含变量引用
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
          break;
        default:
          // 默认为videoNode
          parsedNode = parseVideoNode(normalizedEntity, resolvedConnectionMap);
          storyData.videoNodes.push(parsedNode);
          // 再次提取变量（从解析后的节点对象中）
          if (shouldExtractTextVariables) {
            extractVariablesFromNode(parsedNode, normalizedEntity.text, extractedVariables);
          }
      }
    });

    // 处理变量：优先使用PG格式中的完整变量信息，然后合并从文本中提取的变量
    let finalVariables = [];
    
    const textExtractedVariables = convertExtractedVariablesToStoreFormat(extractedVariables);

    if (hasPGVariables) {
      console.log('[convertPGToStoryData] 使用PG格式中的完整变量信息，数量:', pgData.variables.length);
      const convertedPGVariables = convertVariablesFromImportFormat(pgData.variables);
      
      const pgVariablesMap = new Map();
      const pgVariablesLowerCaseMap = new Map();
      convertedPGVariables.forEach(variable => {
        if (variable?.name) {
          pgVariablesMap.set(variable.name, variable);
          pgVariablesLowerCaseMap.set(variable.name.toLowerCase(), variable.name);
        }
      });

      textExtractedVariables.forEach(textVar => {
        if (!textVar?.name) {
          return;
        }
        const keyName = textVar.name.trim();
        if (!keyName) {
          return;
        }
        const lowerKey = keyName.toLowerCase();
        const existingVarName = pgVariablesMap.has(keyName) ? keyName : pgVariablesLowerCaseMap.get(lowerKey);
        if (existingVarName) {
          const existingVar = pgVariablesMap.get(existingVarName);
          if (existingVar) {
          if (textVar.showAsProgress) {
            existingVar.showAsProgress = true;
          }
          if (textVar.maxValue && textVar.maxValue !== '1000000') {
            existingVar.maxValue = textVar.maxValue;
          }
          if (textVar.minValue && textVar.minValue !== '0') {
            existingVar.minValue = textVar.minValue;
          }
            console.log('[convertPGToStoryData] 已有变量补充属性:', existingVar.name);
        }
          return;
        }

        supplementalVariables.push({ ...textVar });
        console.log('[convertPGToStoryData] 发现补充变量:', keyName);
      });
      
      finalVariables = Array.from(pgVariablesMap.values()).sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        return orderA - orderB;
      });
      console.log('[convertPGToStoryData] 合并后的变量总数:', finalVariables.length);
    } else {
      console.log('[convertPGToStoryData] PG格式中没有变量信息，尝试使用模板变量集合');
      const fallbackVariables = cloneTemplateVariables();

      if (fallbackVariables.length === 0) {
        console.warn('[convertPGToStoryData] 模板变量集合不可用，退回到文本提取变量');
        finalVariables = textExtractedVariables;
      } else {
        const fallbackMap = new Map();
        const fallbackLowerCaseMap = new Map();

        fallbackVariables.forEach(variable => {
          if (variable?.name) {
            const clone = { ...variable };
            fallbackMap.set(clone.name, clone);
            fallbackLowerCaseMap.set(clone.name.toLowerCase(), clone.name);
          }
        });

        textExtractedVariables.forEach(textVar => {
          if (!textVar?.name) {
            return;
          }
          const keyName = textVar.name.trim();
          if (!keyName) {
            return;
          }
          const lowerKey = keyName.toLowerCase();
          const existingVarName = fallbackMap.has(keyName) ? keyName : fallbackLowerCaseMap.get(lowerKey);
          if (existingVarName) {
            const existingVar = fallbackMap.get(existingVarName);
            if (existingVar) {
              if (textVar.showAsProgress) {
                existingVar.showAsProgress = true;
              }
              if (textVar.maxValue && textVar.maxValue !== '1000000') {
                existingVar.maxValue = textVar.maxValue;
              }
              if (textVar.minValue && textVar.minValue !== '0') {
                existingVar.minValue = textVar.minValue;
              }
              if (textVar.persistenceType && !existingVar.persistenceType) {
                existingVar.persistenceType = textVar.persistenceType;
              }
            }
            return;
          }

          supplementalVariables.push({ ...textVar });
          console.log('[convertPGToStoryData] 模板集合外的补充变量:', keyName);
        });

        finalVariables = Array.from(fallbackMap.values()).sort((a, b) => {
          const orderA = a.order || 0;
          const orderB = b.order || 0;
          return orderA - orderB;
        });
        console.log('[convertPGToStoryData] 使用模板变量后的总数:', finalVariables.length);
      }
    }
    
    setVariables(finalVariables);

    // 将 variables 添加到 storyData 中，确保在后续处理中能正确转换类型
    storyData.variables = finalVariables;
    
    if (supplementalVariables.length > 0) {
      storyData.supplementalVariables = supplementalVariables;
      console.log('[convertPGToStoryData] 补充变量统计:', supplementalVariables.length);
    }
    
    // 查找起点节点（优先包含[起点]标签的节点，其次使用坐标最小的节点）
    let startNodeId = null;
    const explicitStartEntity = entities.find(entity => {
      if (!entity || !entity.uuid || skipNodeIds.has(entity.uuid)) return false;
      if (typeof entity.text !== 'string') return false;
      return entity.text.includes('[起点]') || entity.text.includes('[CP][起点]');
    });

    if (explicitStartEntity && explicitStartEntity.uuid) {
      startNodeId = explicitStartEntity.uuid;
    }

    if (!startNodeId) {
      let minY = Infinity;
      entities.forEach(entity => {
        if (!entity || !entity.uuid || skipNodeIds.has(entity.uuid)) return;
        if (Array.isArray(entity.location) && entity.location.length >= 2) {
          const y = entity.location[0];
          if (typeof y === 'number' && y < minY) {
            minY = y;
            startNodeId = entity.uuid;
          }
        }
      });
    }

    storyData.startNodeId = startNodeId || null;
    storyData.version = '1.0';

    console.log('[convertPGToStoryData] 转换完成:', {
      videoNodes: storyData.videoNodes.length,
      choiceNodes: storyData.choiceNodes.length,
      bgmNodes: storyData.bgmNodes.length,
      cardNodes: storyData.cardNodes.length,
      jumpNodes: storyData.jumpNodes.length,
      taskNodes: storyData.taskNodes.length,
      tipNodes: storyData.tipNodes.length,
      variables: storyData.variables.length,
      startNodeId: storyData.startNodeId,
      supplementalVariables: supplementalVariables.length
    });

    currentPositionTransform = previousPositionTransform;

    return storyData;
  };

  // 识别节点类型
  const identifyNodeType = (text, entityType = 'core:text_node') => {
    if (entityType === 'core:image_node') {
      return 'videoNode';
    }

    if (!text) return 'videoNode';
    
    if (text.includes('[提示]')) return 'tipNode';
    if (text.includes('[卡牌选项]')) return 'cardNode';
    if (text.includes('[跳转节点]')) return 'jumpNode';
    if (text.includes('[BGM]')) return 'bgmNode';
    if (text.match(/\[任务节点[：:]\d+\]/)) return 'taskNode';
    if (text.includes('[选项]') || text.includes('[隐藏选项]') || text.includes('[叠加图片选项]')) return 'choiceNode';
    
    return 'videoNode';
  };

  // 解析广告标记
  const parseAdMark = (text) => {
    let requireAd = false;
    let adType = '';
    const adMatch = text.match(/《AD([:：]?(\d{1,3}))?》/);
    if (adMatch) {
      requireAd = true;
      const num = adMatch[2];
      if (num === '15') adType = 'fullscreen';
      else if (num === '30') adType = 'rewarded';
      else if (num === '3') adType = 'splash';
      else adType = 'rewarded';
      text = text.replace(adMatch[0], '').trim();
    }
    return { text, requireAd, adType };
  };

  // 解析条件
  const parseConditions = (text) => {
    const conditions = [];
    const matches = text.matchAll(/《([^》]+?)》/g);
    
    for (const match of matches) {
      const conditionText = match[1];
      // 跳过概率标识和广告标记
      if (conditionText.match(/^\s*[^%]+%\s*(?:(?:[:：]\s*\d+)\s*)?$/) || 
          conditionText.startsWith('AD')) {
        continue;
      }
      
      // 解析条件：变量名==值、变量名>值等
      const condition = parseVariableCondition(conditionText);
      if (condition) {
        conditions.push(condition);
        text = text.replace(match[0], '').trim();
      }
    }
    
    return { text, conditions };
  };

  // 解析变量条件
  const parseVariableCondition = (conditionText) => {
    // 支持 ==, !=, >, <, >=, <=
    const patterns = [
      /^(.+?)\s*==\s*(.+)$/,
      /^(.+?)\s*!=\s*(.+)$/,
      /^(.+?)\s*>=\s*(.+)$/,
      /^(.+?)\s*<=\s*(.+)$/,
      /^(.+?)\s*>\s*(.+)$/,
      /^(.+?)\s*<\s*(.+)$/
    ];
    
    const operations = ['==', '!=', '>=', '<=', '>', '<'];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = conditionText.match(patterns[i]);
      if (match) {
        return {
          variableName: match[1].trim(),
          operation: operations[i],
          value: match[2].trim()
        };
      }
    }
    
    return null;
  };

  // 解析效果
  const parseEffects = (text) => {
    const effects = [];
    // 先移除《》包裹的内容，再匹配<>内的变量效果
    let textWithoutChineseBrackets = text.replace(/《[^》]*》/g, '');
    // 移除富文本标签
    textWithoutChineseBrackets = textWithoutChineseBrackets.replace(/<\/?color[^>]*>/gi, '');
    textWithoutChineseBrackets = textWithoutChineseBrackets.replace(/<\/?(b|i)>/gi, '');
    textWithoutChineseBrackets = textWithoutChineseBrackets.replace(/<\/?size[^>]*>/gi, '');
    
    // 匹配<变量名 操作符 值>格式
    const matches = textWithoutChineseBrackets.matchAll(/<\s*([^>]+?)\s*>/g);
    
    for (const match of matches) {
      const effectText = match[1].trim();
      
      // 跳过全局最大值/最小值标记
      if (effectText.match(/^\s*全局\s*最大值\s*[:：]/) || 
          effectText.match(/^\s*全局\s*最小值\s*[:：]/)) {
        continue;
      }
      
      // 跳过每秒变化标记（rateEffects）
      if (effectText.match(/\/\s*s\s*$/)) {
        continue;
      }
      
      // 解析效果：<变量名 +值>、<变量名=值>、<A:变量名 +值>（累加变量）
      const effect = parseVariableEffect(effectText);
      if (effect) {
        effects.push(effect);
        text = text.replace(match[0], '').trim();
      }
    }
    
    return { text, effects };
  };

  // 解析变量效果
  const parseVariableEffect = (effectText) => {
    // 检查累加变量前缀 A:
    let isAccumulative = false;
    if (effectText.startsWith('A:')) {
      isAccumulative = true;
      effectText = effectText.substring(2).trim();
    }
    
    // 处理特殊情况：< = 变量名> 格式（操作符在变量名前面）
    const specialPattern = /^=\s*(.+)$/;
    const specialMatch = effectText.match(specialPattern);
    if (specialMatch) {
      return {
        variableName: specialMatch[1].trim(),
        operation: 'Set',
        value: '',
        style: isAccumulative ? 'Accumulative' : 'Normal'
      };
    }
    
    // 支持 =, +, -, *, /
    const patterns = [
      /^(.+?)\s*=\s*(.+)$/,
      /^(.+?)\s*\+\s*(.+)$/,
      /^(.+?)\s*-\s*(.+)$/,
      /^(.+?)\s*\*\s*(.+)$/,
      /^(.+?)\s*\/\s*(.+)$/
    ];
    
    const operations = ['Set', 'Add', 'Subtract', 'Multiply', 'Divide'];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = effectText.match(patterns[i]);
      if (match) {
        const varName = match[1].trim();
        const value = match[2].trim();
        
        // 如果变量名为空或只包含运算符，跳过
        if (!varName || /^[+\-*/=<>!]+$/.test(varName)) {
          continue;
        }
        
        return {
          variableName: varName,
          operation: operations[i],
          value: value,
          style: isAccumulative ? 'Accumulative' : 'Normal'
        };
      }
    }
    
    return null;
  };

  // 清理文本（移除所有标记）
  const cleanText = (text) => {
    // 移除所有标记，保留纯文本
    let cleaned = text;
    // 移除各种标记
    cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
    cleaned = cleaned.replace(/《[^》]+》/g, '');
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    cleaned = cleaned.replace(/\{[^}]+\}/g, '');
    return cleaned.trim();
  };

  // 当前坐标变换信息（用于导入时归一化）
  let currentPositionTransform = null;

  // 位置转换：ProjectGraph的location [y, x] 转换为 story_data的position {x, y}
  const convertLocation = (location) => {
    if (!location || location.length < 2) {
      return { x: 0, y: 0 };
    }

    let x = Number(location[1]);
    let y = Number(location[0]);

    if (!Number.isFinite(x)) {
      x = 0;
    }

    if (!Number.isFinite(y)) {
      y = 0;
    }

    if (currentPositionTransform) {
      const { scale = 1, offsetX = 0, offsetY = 0 } = currentPositionTransform;
      x = x * scale + offsetX;
      y = y * scale + offsetY;
    }

    return { x, y };
  };

  // 从节点中提取变量
  const extractVariablesFromNode = (node, originalText, extractedVariables) => {
    // 提取条件中的变量
    if (node.conditions && Array.isArray(node.conditions)) {
      node.conditions.forEach(condition => {
        if (condition.variableName) {
          const varName = normalizeVariableName(condition.variableName);
          if (varName && !isNumericOrPercentage(varName)) {
            if (!extractedVariables.has(varName)) {
              extractedVariables.set(varName, {
                isAccumulative: false,
                isShop: isSpecialVariable(varName),
                isVariableBar: false,
                maxValue: null,
                minValue: null
              });
            }
          }
        }
      });
    }

    // 提取效果中的变量
    if (node.effects && Array.isArray(node.effects)) {
      node.effects.forEach(effect => {
        if (effect.variableName) {
          const varName = normalizeVariableName(effect.variableName);
          if (varName && !isNumericOrPercentage(varName)) {
            const isAccumulative = effect.style === 'Accumulative';
            const isShop = isSpecialVariable(varName);
            
            if (!extractedVariables.has(varName)) {
              extractedVariables.set(varName, {
                isAccumulative,
                isShop,
                isVariableBar: false,
                maxValue: null,
                minValue: null
              });
            } else {
              // 如果已存在，更新累加标记（累加优先级更高）
              const existing = extractedVariables.get(varName);
              if (isAccumulative) {
                existing.isAccumulative = true;
              }
            }
          }
        }
      });
    }

    // 从原始文本中提取变量条中的变量
    const variableBarMatch = originalText.match(/\[\s*变量条\s*[：:]\s*([^:#\]]+?)\s*[：:]/i);
    if (variableBarMatch) {
      const varName = normalizeVariableName(variableBarMatch[1].trim());
      if (varName && !isNumericOrPercentage(varName)) {
        if (!extractedVariables.has(varName)) {
          extractedVariables.set(varName, {
            isAccumulative: false,
            isShop: isSpecialVariable(varName),
            isVariableBar: true,
            maxValue: null,
            minValue: null
          });
        } else {
          extractedVariables.get(varName).isVariableBar = true;
        }
      }
    }

    // 从原始文本中提取全局最大值/最小值标记中的变量
    const globalMaxMatch = originalText.match(/<全局最大值[：:]([^>]+)>/);
    const globalMinMatch = originalText.match(/<全局最小值[：:]([^>]+)>/);
    if (globalMaxMatch || globalMinMatch) {
      // 全局最大值/最小值标记会影响所有变量，这里只记录值
      // 实际应用中，这些值应该应用到所有已提取的变量
    }

    // 从原始文本中提取最大/最小默认值标记中的变量
    const maxDefaultMatch = originalText.match(/<最大默认值[：:]([^:：]+)[：:]([^>]+)>/);
    const minDefaultMatch = originalText.match(/<最小默认值[：:]([^:：]+)[：:]([^>]+)>/);
    if (maxDefaultMatch) {
      const varName = normalizeVariableName(maxDefaultMatch[1].trim());
      const maxValue = maxDefaultMatch[2].trim();
      if (varName && !isNumericOrPercentage(varName)) {
        if (!extractedVariables.has(varName)) {
          extractedVariables.set(varName, {
            isAccumulative: false,
            isShop: isSpecialVariable(varName),
            isVariableBar: false,
            maxValue,
            minValue: null
          });
        } else {
          extractedVariables.get(varName).maxValue = maxValue;
        }
      }
    }
    if (minDefaultMatch) {
      const varName = normalizeVariableName(minDefaultMatch[1].trim());
      const minValue = minDefaultMatch[2].trim();
      if (varName && !isNumericOrPercentage(varName)) {
        if (!extractedVariables.has(varName)) {
          extractedVariables.set(varName, {
            isAccumulative: false,
            isShop: isSpecialVariable(varName),
            isVariableBar: false,
            maxValue: null,
            minValue
          });
        } else {
          extractedVariables.get(varName).minValue = minValue;
        }
      }
    }

    // ========== 从原始文本中直接提取所有变量引用 ==========
    if (!originalText) return;

    const extractedFromText = new Set(); // 用于记录从文本中提取的变量，便于调试

    // 1. 提取变量加减操作：<变量名 +1>, <变量名 -1>, <变量名 +1/s>, <变量名 + 1> 等
    // 匹配格式：<变量名 +数字>, <变量名 -数字>, <变量名 +数字/s>
    const varOperationMatches = originalText.matchAll(/<([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*)\s*[+\-]\s*\d+(?:\/\w+)?>/g);
    for (const match of varOperationMatches) {
      const varName = normalizeVariableName(match[1]);
      if (varName && !isNumericOrPercentage(varName)) {
        if (!extractedVariables.has(varName)) {
          extractedVariables.set(varName, {
            isAccumulative: false,
            isShop: isSpecialVariable(varName),
            isVariableBar: false,
            maxValue: null,
            minValue: null
          });
          extractedFromText.add(varName);
        }
      }
    }

    // 2. 提取变量赋值：<变量名=值>, <变量名 = 值>, <变量名=值> 等
    // 匹配格式：<变量名=值>, <变量名 = 值>
    const varAssignmentMatches = originalText.matchAll(/<([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*)\s*=\s*[^>]+>/g);
    for (const match of varAssignmentMatches) {
      const varName = normalizeVariableName(match[1]);
      if (varName && !isNumericOrPercentage(varName)) {
        if (!extractedVariables.has(varName)) {
          extractedVariables.set(varName, {
            isAccumulative: false,
            isShop: isSpecialVariable(varName),
            isVariableBar: false,
            maxValue: null,
            minValue: null
          });
          extractedFromText.add(varName);
        }
      }
    }

    // 3. 提取累加变量：<A:变量名>, <A:变量名 +1>, <A:变量名=值> 等
    // 匹配格式：<A:变量名>, <A:变量名 +数字>, <A:变量名=值>
    const accumulativeMatches = originalText.matchAll(/<A\s*[：:]\s*([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*)/g);
    for (const match of accumulativeMatches) {
      const varName = normalizeVariableName(match[1]);
      if (varName && !isNumericOrPercentage(varName)) {
        if (!extractedVariables.has(varName)) {
          extractedVariables.set(varName, {
            isAccumulative: true,
            isShop: isSpecialVariable(varName),
            isVariableBar: false,
            maxValue: null,
            minValue: null
          });
          extractedFromText.add(varName);
        } else {
          extractedVariables.get(varName).isAccumulative = true;
        }
      }
    }

    // 4. 提取条件判断中的变量：《变量名>0》, 《变量名==0》, 《变量名+变量名2>0》 等
    // 匹配格式：《变量名运算符数字》, 《变量名运算符变量名》, 《变量名+变量名运算符数字》
    // 使用更宽泛的匹配，提取所有可能的变量名
    const conditionMatches = originalText.matchAll(/《([^》]+?)》/g);
    for (const match of conditionMatches) {
      const conditionText = match[1];
      // 从条件文本中提取变量名（变量名通常是中文、英文、下划线开头，后面可以跟数字）
      const varNamesInCondition = conditionText.matchAll(/([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*)/g);
      for (const varMatch of varNamesInCondition) {
        const varName = normalizeVariableName(varMatch[1]);
        // 排除纯数字和运算符
        if (varName && !isNumericOrPercentage(varName) && 
            !['==', '!=', '>', '<', '>=', '<=', '+', '-', '*', '/', '%'].includes(varName)) {
          if (!extractedVariables.has(varName)) {
            extractedVariables.set(varName, {
              isAccumulative: false,
              isShop: isSpecialVariable(varName),
              isVariableBar: false,
              maxValue: null,
              minValue: null
            });
            extractedFromText.add(varName);
          }
        }
      }
    }

    // 5. 提取表达式中的变量：{变量名/2}, {变量名*2}, {变量名+变量名2} 等
    // 匹配格式：{变量名运算符数字}, {变量名运算符变量名}
    const expressionMatches = originalText.matchAll(/\{([^}]+?)\}/g);
    for (const match of expressionMatches) {
      const expressionText = match[1];
      // 从表达式中提取变量名
      const varNamesInExpression = expressionText.matchAll(/([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*)/g);
      for (const varMatch of varNamesInExpression) {
        const varName = normalizeVariableName(varMatch[1]);
        // 排除纯数字和运算符
        if (varName && !isNumericOrPercentage(varName) && 
            !['+', '-', '*', '/', '%', '(', ')'].includes(varName)) {
          if (!extractedVariables.has(varName)) {
            extractedVariables.set(varName, {
              isAccumulative: false,
              isShop: isSpecialVariable(varName),
              isVariableBar: false,
              maxValue: null,
              minValue: null
            });
          }
        }
      }
    }

    // 6. 提取其他可能的变量格式（如变量名单独出现的情况）
    // 注意：这个要谨慎使用，避免误提取普通文本中的词
    // 暂时不添加，因为可能会误提取太多

    // 调试日志：记录从文本中提取的变量
    if (extractedFromText.size > 0) {
      console.log(`[extractVariablesFromNode] 从文本 "${originalText.substring(0, 50)}..." 中提取到变量:`, Array.from(extractedFromText));
    }
  };

  // 检查是否为数字或百分比（不应作为变量）
  const isNumericOrPercentage = (str) => {
    return /^\d+(?:\.\d+)?$/.test(str) || str.includes('%');
  };

  // 检查是否为特殊变量（coin, BPEXP等）
  const isSpecialVariable = (varName) => {
    const specialVars = ['coin', 'BPEXP', 'VIPLevel'];
    return specialVars.includes(varName);
  };

  // 规范化变量名（移除运算符等）
  const normalizeVariableName = (varName) => {
    if (!varName) return '';
    // 移除常见的运算符和空格
    return varName.trim().replace(/^[+\-*/=<>!]+/, '').replace(/[+\-*/=<>!]+$/, '').trim();
  };

  // 将提取的变量转换为变量管理器格式
  const convertExtractedVariablesToStoreFormat = (extractedVariables) => {
    const variables = [];
    let order = 1;

    extractedVariables.forEach((info, varName) => {
      const normalizedName = normalizeVariableName(varName);
      if (!normalizedName || isNumericOrPercentage(normalizedName)) {
        return;
      }

      // 确定持久化类型
      let persistenceType = 'ChapterConstant';
      if (info.isShop) {
        persistenceType = 'Shop';
      } else if (info.isAccumulative) {
        persistenceType = 'Accumulative';
      }

      // 确定变量类型（默认为Integer）
      let type = 'Integer';

      variables.push({
        name: normalizedName,
        displayName: '',
        description: '',
        type: type,
        persistenceType: persistenceType,
        defaultValue: '0',
        minValue: info.minValue || '0',
        maxValue: info.maxValue || '1000000',
        priority: 0,
        isHidden: false,
        order: order++,
        iconPath: '',
        showAsProgress: info.isVariableBar || false,
        usePlayerPrefs: true
      });
    });

    return variables;
  };

  // 解析VideoNode
  const parseVideoNode = (entity, connectionMap) => {
    let text = entity.text || '';
    const originalText = text;
    
    const node = {
      videoClipPath: 'Assets/Resources/Video/FallBackVideo.mp4',
      imagePath: '',
      displayType: 0,
      thumbnailPath: '',
      autoPlayNext: false,
      loop: false,
      volume: 1.0,
      waitForSubtitles: true,
      canSkipSubtitles: true,
      subtitles: { subtitles: [] },
      duration: -1.0,
      isEndpoint: false,
      subtitleArray: [],
      subtitleTimes: [],
      isMemory: false,
      memoryId: '',
      memoryName: '',
      memoryDescription: '',
      isDialogNode: false,
      dialogText: '',
      dialogSpeaker: '',
      typingSpeed: 0.05,
      dialogAudioPath: '',
      effects: [],
      rateEffects: [],
      conditions: [],
      showWhenUnavailable: true,
      description: '',
      tipNodeId: '',
      unlockAchievement: false,
      unlockAchievementName: '',
      isRandom: false,
      probabilityExpression: '',
      hasRandomTimeEvent: false,
      randomTimeMinSeconds: 0.0,
      randomTimeMaxSeconds: 0.0,
      showVariableBar: false,
      variableBarName: '',
      variableBarDefaultValue: '0',
      variableBarColor: '#ffffff',
      variableBarPosition: '上',
      isJumpPoint: false,
      jumpPointId: '',
      jumpPointDescription: '',
      analyticsKey: '',
      isBlackScreen: false,
      isProductShowcase: false,
      showcaseProductIds: [],
      showcaseDisplayDuration: 10.0,
      showcaseAutoHide: true,
      showcasePosition: { x: 0.1, y: 0.9 },
      showcaseSize: { x: 0.3, y: 0.2 },
      showcaseOnlyShowUnpurchased: true,
      showcaseHideIfAllPurchased: true,
      showcaseEnableScrollAnimation: true,
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      maxDefaultValueOverrides: [],
      minDefaultValueOverrides: [],
      isDeadpoint: false,
      isResetToCP: false,
      isCheckpoint: false
    };

    if (entity.type === 'core:image_node') {
      node.videoClipPath = '';
      node.imagePath = entity.path || entity.details || '';
      node.displayType = 1;
      const fileName = (entity.path || entity.details || '').split(/[\\/]/).pop() || '';
      if (fileName) {
        node.nodeName = fileName.replace(/\.[^/.]+$/, '') || fileName;
        node.title = node.nodeName;
      }
    }

    // 解析广告标记
    const adResult = parseAdMark(text);
    text = adResult.text;

    // 解析变量条
    const variableBarMatch = text.match(/\[\s*变量条\s*[：:]\s*([^:#\]]+?)\s*[：:]\s*#?\s*([0-9a-fA-F]{6})\s*[：:]\s*([上下])\s*\]/i);
    if (variableBarMatch) {
      node.showVariableBar = true;
      node.variableBarName = variableBarMatch[1].trim();
      node.variableBarColor = '#' + variableBarMatch[2];
      node.variableBarPosition = variableBarMatch[3];
      text = text.replace(variableBarMatch[0], '').trim();
    }

    // 解析解锁成就
    const unlockAchMatch = text.match(/\[解锁成就[：:]([^\]]+)\]/);
    if (unlockAchMatch) {
      node.unlockAchievement = true;
      node.unlockAchievementName = unlockAchMatch[1].trim();
      text = text.replace(unlockAchMatch[0], '').trim();
    }

    // 解析黑屏视频
    if (text.includes('黑屏视频')) {
      node.isBlackScreen = true;
    }

    // 解析带货节点
    const showcaseMatch = text.match(/\[带货节点[：:]([^\]]*)\]/);
    if (showcaseMatch) {
      node.isProductShowcase = true;
      const productList = showcaseMatch[1].trim();
      if (productList) {
        node.showcaseProductIds = productList.split(';').map(p => p.trim()).filter(p => p);
      }
      text = text.replace(showcaseMatch[0], '').trim();
    }

    // 解析起点标记
    const isStartNode = text.includes('[起点]');
    if (isStartNode) {
      node.title = '起始节点';
      text = text.replace('[起点]', '').trim();
    }

    // 解析检查点
    const cpNameMatch = text.match(/\[CP[：:]([^\]]+)\]/);
    if (cpNameMatch) {
      node.isCheckpoint = true;
      const checkpointName = cpNameMatch[1].trim();
      node.title = `检查点: ${checkpointName}`;
      node.nodeName = checkpointName;
      node.description = `检查点: ${checkpointName}`;
      text = text.replace(cpNameMatch[0], '').trim();
    } else if (text.includes('[CP]')) {
      node.isCheckpoint = true;
      node.title = '检查点';
      text = text.replace('[CP]', '').trim();
    }

    // 解析循环视频
    if (text.includes('[循环视频]')) {
      node.loop = true;
      text = text.replace('[循环视频]', '').trim();
    }

    // 解析随机时间事件
    const randomTimeMatch = text.match(/\[随机时间事件[：:]?\((\d+)-(\d+)\)\]/);
    if (randomTimeMatch) {
      node.hasRandomTimeEvent = true;
      node.randomTimeMinSeconds = parseFloat(randomTimeMatch[1]) || 0;
      node.randomTimeMaxSeconds = parseFloat(randomTimeMatch[2]) || 0;
      text = text.replace(randomTimeMatch[0], '').trim();
    }

    // 解析对话框
    const dialogMatch = text.match(/\[对话框[：:]([^:]+)[：:]([^\]]+)\]/);
    if (dialogMatch) {
      node.isDialogNode = true;
      node.dialogText = dialogMatch[1].trim();
      node.dialogAudioPath = dialogMatch[2].trim();
      text = text.replace(dialogMatch[0], '').trim();
    }

    // 解析回忆节点
    const memoryMatch = text.match(/\[回忆节点[：:]([^\]]+)\]/);
    if (memoryMatch) {
      node.isMemory = true;
      node.memoryName = memoryMatch[1].trim();
      text = text.replace(memoryMatch[0], '').trim();
    }

    // 解析死亡节点
    if (text.includes('[死亡节点]')) {
      node.isDeadpoint = true;
      text = text.replace('[死亡节点]', '').trim();
    }

    // 解析结束节点
    if (text.includes('[结束节点]') || text.includes('[终点节点]')) {
      node.isEndpoint = true;
      text = text.replace(/\[(结束|终点)节点\]/g, '').trim();
    }

    // 解析重置到CP点
    if (text.includes('[重置到CP点]')) {
      node.isResetToCP = true;
      text = text.replace('[重置到CP点]', '').trim();
    }

    // 解析跳转点
    const jumpPointMatch = text.match(/\[跳转点[：:]([^\]]+)\]/);
    if (jumpPointMatch) {
      node.isJumpPoint = true;
      node.jumpPointId = jumpPointMatch[1].trim();
      text = text.replace(jumpPointMatch[0], '').trim();
    }

    // 解析随机节点概率
    const randomMatch = text.match(/《([^》]+)》/);
    if (randomMatch && !randomMatch[1].includes('%')) {
      node.isRandom = true;
      node.probabilityExpression = randomMatch[1].trim();
      text = text.replace(randomMatch[0], '').trim();
    }

    // 解析数据统计
    const statsMatch = text.match(/\[数据统计[：:]([^\]]+)\]/);
    if (statsMatch) {
      node.analyticsKey = statsMatch[1].trim();
      text = text.replace(statsMatch[0], '').trim();
    }

    // 解析条件
    const conditionResult = parseConditions(text);
    text = conditionResult.text;
    node.conditions = conditionResult.conditions;

    // 解析效果
    const effectResult = parseEffects(text);
    text = effectResult.text;
    node.effects = effectResult.effects;

    // 设置节点名称（清理后的文本）
    const cleanedText = cleanText(text);
    if (cleanedText) {
      node.nodeName = cleanedText;
    } else if (!node.nodeName) {
      node.nodeName = '视频节点';
    }

    if (!node.title) {
      node.title = node.nodeName;
    }

    return node;
  };

  // 解析ChoiceNode
  const parseChoiceNode = (entity, connectionMap) => {
    let text = entity.text || '';
    
    const node = {
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      choiceText: '',
      conditions: [],
      effects: [],
      requireAd: false,
      adType: '',
      isOverlayImageChoice: false,
      overlayImageName: '',
      isClickable: true,
      tierIndex: 0,
      showWhenUnavailable: true,
      unavailableMessage: '',
      unlockAchievement: false,
      unlockAchievementName: '',
      isDeadpoint: false,
      isProbabilityChoice: false,
      probability: 0,
      maxCount: 0,
      probabilityExpression: '',
      groupId: '',
      dynamicTextPattern: '',
      preDisplay: false,
      animationDuration: 0.5,
      description: ''
    };

    // 解析广告标记
    const adResult = parseAdMark(text);
    text = adResult.text;
    node.requireAd = adResult.requireAd;
    node.adType = adResult.adType;

    // 解析层级标记
    const tierMatch = text.match(/\[\s*层级\s*[：:]\s*(-?\d+)\s*\]/);
    if (tierMatch) {
      node.tierIndex = parseInt(tierMatch[1]) || 0;
      text = text.replace(tierMatch[0], '').trim();
    }

    // 解析解锁成就
    const unlockAchMatch = text.match(/\[解锁成就[：:]([^\]]+)\]/);
    if (unlockAchMatch) {
      node.unlockAchievement = true;
      node.unlockAchievementName = unlockAchMatch[1].trim();
      text = text.replace(unlockAchMatch[0], '').trim();
    }

    // 解析死亡节点
    if (text.includes('[死亡节点]')) {
      node.isDeadpoint = true;
      text = text.replace('[死亡节点]', '').trim();
    }

    // 解析起点标记
    if (text.includes('[起点]')) {
      node.title = '起始节点';
      text = text.replace('[起点]', '').trim();
    }

    // 解析选项标记
    if (text.startsWith('[选项]')) {
      text = text.replace('[选项]', '').trim();
    }

    // 解析叠加图片选项
    const overlayMatch = text.match(/\[\s*叠加图片选项\s*(?:[：:]\s*([^\]]+?)\s*)?\s*\]/);
    if (overlayMatch) {
      node.isOverlayImageChoice = true;
      const imageName = overlayMatch[1] ? overlayMatch[1].trim() : '';
      if (imageName.toLowerCase() === 'false') {
        node.isClickable = false;
      } else if (imageName) {
        node.overlayImageName = imageName;
      }
      text = text.replace(overlayMatch[0], '').trim();
    }

    // 解析隐藏选项
    if (text.includes('[隐藏选项]') || text.includes('[隐藏]')) {
      node.showWhenUnavailable = false;
      text = text.replace(/\[(隐藏选项|隐藏)\]/g, '').trim();
    }

    // 解析提前显示
    if (text.includes('[提前]')) {
      node.preDisplay = true;
      text = text.replace('[提前]', '').trim();
    }

    // 解析概率选项
    const probWithCountMatch = text.match(/《(\d+(?:\.\d+)?)%[：:](\d+)》/);
    const probSimpleMatch = text.match(/《(\d+(?:\.\d+)?)%》/);
    const probVarMatch = text.match(/《\s*([^》%]+?)\s*%》/);
    
    if (probWithCountMatch) {
      node.isProbabilityChoice = true;
      node.probability = parseFloat(probWithCountMatch[1]) || 0;
      node.maxCount = parseInt(probWithCountMatch[2]) || 0;
      text = text.replace(probWithCountMatch[0], '').trim();
    } else if (probSimpleMatch) {
      node.isProbabilityChoice = true;
      node.probability = parseFloat(probSimpleMatch[1]) || 0;
      text = text.replace(probSimpleMatch[0], '').trim();
    } else if (probVarMatch) {
      node.isProbabilityChoice = true;
      node.probabilityExpression = probVarMatch[1].trim();
      text = text.replace(probVarMatch[0], '').trim();
    }

    // 解析条件
    const conditionResult = parseConditions(text);
    text = conditionResult.text;
    node.conditions = conditionResult.conditions;

    // 解析效果
    const effectResult = parseEffects(text);
    text = effectResult.text;
    node.effects = effectResult.effects;

    // 解析动态文本表达式 {表达式}
    const dynamicTextMatch = text.match(/\{([^}]+)\}/);
    if (dynamicTextMatch) {
      node.dynamicTextPattern = dynamicTextMatch[1].trim();
    }

    // 设置选项文本（清理后的文本）
    const cleanedText = cleanText(text);
    node.choiceText = cleanedText || '';
    node.nodeName = cleanedText || '选项';
    node.title = cleanedText || '选项';

    return node;
  };

  // 解析CardNode（类似ChoiceNode）
  const parseCardNode = (entity, connectionMap) => {
    let text = entity.text || '';
    
    const node = {
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      cardName: '',
      cardSizeX: 1,
      cardSizeY: 1,
      conditions: [],
      effects: [],
      requireAd: false,
      adType: '',
      isOverlayImageChoice: false,
      overlayImageName: '',
      isClickable: true,
      tierIndex: 0,
      showWhenUnavailable: true,
      unavailableMessage: '',
      unlockAchievement: false,
      unlockAchievementName: '',
      isDeadpoint: false,
      preDisplay: false,
      animationDuration: 0.5,
      description: '',
      isCheckpoint: false
    };

    // 解析广告标记
    const adResult = parseAdMark(text);
    text = adResult.text;
    node.requireAd = adResult.requireAd;
    node.adType = adResult.adType;

    // 解析层级标记
    const tierMatch = text.match(/\[\s*层级\s*[：:]\s*(-?\d+)\s*\]/);
    if (tierMatch) {
      node.tierIndex = parseInt(tierMatch[1]) || 0;
      text = text.replace(tierMatch[0], '').trim();
    }

    // 解析解锁成就
    const unlockAchMatch = text.match(/\[解锁成就[：:]([^\]]+)\]/);
    if (unlockAchMatch) {
      node.unlockAchievement = true;
      node.unlockAchievementName = unlockAchMatch[1].trim();
      text = text.replace(unlockAchMatch[0], '').trim();
    }

    // 解析死亡节点
    if (text.includes('[死亡节点]')) {
      node.isDeadpoint = true;
      text = text.replace('[死亡节点]', '').trim();
    }

    // 解析卡牌选项标记
    if (text.includes('[卡牌选项]')) {
      text = text.replace('[卡牌选项]', '').trim();
    }

    // 解析叠加图片选项
    const overlayMatch = text.match(/\[\s*叠加图片选项\s*(?:[：:]\s*([^\]]+?)\s*)?\s*\]/);
    if (overlayMatch) {
      node.isOverlayImageChoice = true;
      const imageName = overlayMatch[1] ? overlayMatch[1].trim() : '';
      if (imageName.toLowerCase() === 'false') {
        node.isClickable = false;
      } else if (imageName) {
        node.overlayImageName = imageName;
      }
      text = text.replace(overlayMatch[0], '').trim();
    }

    // 解析隐藏选项
    if (text.includes('[隐藏]')) {
      node.showWhenUnavailable = false;
      text = text.replace('[隐藏]', '').trim();
    }

    // 解析提前显示
    if (text.includes('[提前]')) {
      node.preDisplay = true;
      text = text.replace('[提前]', '').trim();
    }

    // 解析条件
    const conditionResult = parseConditions(text);
    text = conditionResult.text;
    node.conditions = conditionResult.conditions;

    // 解析效果
    const effectResult = parseEffects(text);
    text = effectResult.text;
    node.effects = effectResult.effects;

    // 设置卡牌名称（清理后的文本）
    const cleanedText = cleanText(text);
    node.cardName = cleanedText || '';
    node.nodeName = cleanedText || '卡牌';
    node.title = cleanedText || '卡牌';

    return node;
  };

  // 解析BGMNode
  const parseBGMNode = (entity, connectionMap) => {
    let text = entity.text || '';
    
    const node = {
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      audioFile: '',
      volume: 1.0,
      isCheckpoint: false
    };

    // 解析广告标记（BGM节点不支持广告，仅清理）
    const adResult = parseAdMark(text);
    text = adResult.text;

    // 解析起点标记
    if (text.includes('[起点]')) {
      node.title = '起始节点';
      text = text.replace('[起点]', '').trim();
    }

    // 解析BGM标记
    text = text.replace('[BGM]', '').trim();

    // 解析音量设置
    const volumeMatch = text.match(/<S:BGM音量\s*=\s*([\d.]+)>/);
    if (volumeMatch) {
      node.volume = parseFloat(volumeMatch[1]) || 1.0;
      text = text.replace(volumeMatch[0], '').trim();
    }

    // 设置音频文件名（清理后的文本）
    const cleanedText = cleanText(text);
    node.audioFile = cleanedText || '';
    node.nodeName = cleanedText || 'BGM';
    node.title = cleanedText || 'BGM';

    return node;
  };

  // 解析JumpNode
  const parseJumpNode = (entity, connectionMap) => {
    let text = entity.text || '';
    
    const node = {
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      jumpPointId: '',
      description: '',
      jumpPointActive: false,
      isDeadpoint: false,
      isResetToCP: false,
      isCheckpoint: false
    };

    // 解析广告标记（JumpNode不支持广告，仅清理）
    const adResult = parseAdMark(text);
    text = adResult.text;

    // 解析跳转节点标记
    const jumpMatch = text.match(/\[跳转节点\]([^\]]*)/);
    if (jumpMatch) {
      node.jumpPointId = jumpMatch[1].trim();
      text = text.replace(jumpMatch[0], '').trim();
    }

    // 解析死亡节点
    if (text.includes('[死亡节点]')) {
      node.isDeadpoint = true;
      text = text.replace('[死亡节点]', '').trim();
    }

    // 解析重置到CP点
    if (text.includes('[重置到CP点]')) {
      node.isResetToCP = true;
      text = text.replace('[重置到CP点]', '').trim();
    }

    // 解析效果（JumpNode支持效果）
    const effectResult = parseEffects(text);
    text = effectResult.text;
    // JumpNode不存储effects，但需要解析以清理文本

    // 设置描述和名称
    const cleanedText = cleanText(text);
    if (cleanedText) {
      node.description = cleanedText;
      node.nodeName = cleanedText;
    } else {
      node.description = `跳转到: ${node.jumpPointId}`;
      node.nodeName = '跳转节点';
    }
    node.title = `跳转节点: ${node.jumpPointId}`;

    return node;
  };

  // 解析TaskNode
  const parseTaskNode = (entity, connectionMap) => {
    let text = entity.text || '';
    
    const node = {
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      maxDisplayCount: 0,
      tasks: [],
      isCheckpoint: false
    };

    // 解析任务节点标记
    const taskMatch = text.match(/\[任务节点[：:](\d+)\]/);
    if (taskMatch) {
      node.maxDisplayCount = parseInt(taskMatch[1]) || 0;
      text = text.replace(taskMatch[0], '').trim();
    }

    // 设置节点名称（清理后的文本）
    const cleanedText = cleanText(text);
    node.nodeName = cleanedText || '任务节点';
    node.title = cleanedText || '任务节点';

    return node;
  };

  // 解析TipNode
  const parseTipNode = (entity, connectionMap) => {
    let text = entity.text || '';
    
    const node = {
      nodeId: entity.uuid,
      nodeName: '',
      nextNodeIds: connectionMap.get(entity.uuid) || [],
      isActive: true,
      position: convertLocation(entity.location),
      title: '',
      tipText: '',
      requireAd: false,
      adType: '',
      isResetToCP: false
    };

    // 解析提示标记
    const tipMatch = text.match(/\[提示\]([\s\S]+)/);
    if (tipMatch) {
      node.tipText = tipMatch[1].trim();
      text = text.replace(tipMatch[0], '').trim();
    }

    // 解析广告标记
    const adResult = parseAdMark(text);
    text = adResult.text;
    node.requireAd = adResult.requireAd;
    node.adType = adResult.adType;

    // 解析重置到CP点
    if (text.includes('[重置到CP点]')) {
      node.isResetToCP = true;
      text = text.replace('[重置到CP点]', '').trim();
    }

    // 设置节点名称
    node.nodeName = node.tipText || '提示';
    node.title = node.tipText || '提示';

    return node;
  };

  // 处理导入PG格式文件变化
  const handleImportPGChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target.result);
        
        // 添加调试信息
        console.log('[handleImportPGChange] 文件内容结构:', {
          hasEntities: !!content.entities,
          entitiesType: Array.isArray(content.entities) ? 'array' : typeof content.entities,
          entitiesLength: Array.isArray(content.entities) ? content.entities.length : 'N/A',
          hasAssociations: !!content.associations,
          associationsType: Array.isArray(content.associations) ? 'array' : typeof content.associations,
          associationsLength: Array.isArray(content.associations) ? content.associations.length : 'N/A',
          hasNodes: !!content.nodes,
          hasEdges: !!content.edges,
          topLevelKeys: Object.keys(content)
        });
        
        // 检查是否为ProjectGraph格式（包含entities，associations可选）
        if (content.entities && Array.isArray(content.entities)) {
          // 确保associations是数组（如果不存在则使用空数组）
          if (!content.associations) {
            content.associations = [];
          } else if (!Array.isArray(content.associations)) {
            console.warn('[handleImportPGChange] associations不是数组，将使用空数组');
            content.associations = [];
          }
          
          // ProjectGraph格式，需要转换为story_data格式
          console.log('[handleImportPGChange] 开始转换PG格式数据...');
          const storyData = convertPGToStoryData(content);
          
          const totalNodes = storyData.videoNodes.length + storyData.choiceNodes.length + 
                           storyData.bgmNodes.length + storyData.cardNodes.length + 
                           storyData.jumpNodes.length + storyData.taskNodes.length + 
                           storyData.tipNodes.length;
          const totalVariables = storyData.variables ? storyData.variables.length : 0;
          
          // 确认导入
          const confirmMessage = `确定要导入项目吗？\n\n这将覆盖当前的所有数据：\n- 节点数: ${totalNodes}\n- 变量数: ${totalVariables}`;
          if (!confirm(confirmMessage)) {
            return;
          }

          // 将转换后的story_data格式转换为JSON字符串，然后使用handleLoadFileChange的逻辑
          const storyDataJson = JSON.stringify(storyData);
          const blob = new Blob([storyDataJson], { type: 'application/json' });
          const fakeFile = new File([blob], 'converted.json', { type: 'application/json' });
          
          // 创建一个模拟的事件对象
          const fakeEvent = {
            target: {
              files: [fakeFile]
            }
          };
          
          // 使用现有的handleLoadFileChange逻辑加载
          handleLoadFileChange(fakeEvent);
          
          // 成功提示
          alert(`导入成功！\n\n节点数: ${totalNodes}\n变量数: ${totalVariables}`);
        }
        // 检查是否为旧的React Flow格式（包含nodes和edges）
        else if (content.nodes && Array.isArray(content.nodes) && 
                 content.edges && Array.isArray(content.edges)) {
          // 旧的React Flow格式，直接导入
          const confirmMessage = `确定要导入项目吗？\n\n这将覆盖当前的所有数据：\n- 节点数: ${content.nodes.length}\n- 连线数: ${content.edges.length}\n- 变量数: ${content.variables?.length || 0}`;
          if (!confirm(confirmMessage)) {
            return;
          }

          // 导入项目数据
          // 转换变量格式：将数字类型的type和persistenceType转换为字符串类型
          const convertedVariables = content.variables && Array.isArray(content.variables)
            ? convertVariablesFromImportFormat(content.variables)
            : [];
          console.log('[handleImportPGChange] 转换后的变量数据示例:', convertedVariables[0]);
          
          importProject({
            nodes: content.nodes,
            edges: content.edges,
            variables: convertedVariables,
            startNodeId: content.startNodeId || null,
          });

          // 更新 React Flow 状态（View 层）
          setReactFlowNodes(content.nodes);
          setReactFlowEdges(content.edges);

          // 成功提示
          alert(`导入成功！\n\n节点数: ${content.nodes.length}\n连线数: ${content.edges.length}\n变量数: ${content.variables?.length || 0}`);
        }
        // 检查是否为 story_data / moban 格式（包含 videoNodes 等）
        else if (
          (content.videoNodes && Array.isArray(content.videoNodes)) ||
          (content.optionNodes && Array.isArray(content.optionNodes)) ||
          (content.choiceNodes && Array.isArray(content.choiceNodes)) ||
          (content.bgmNodes && Array.isArray(content.bgmNodes)) ||
          (content.cardNodes && Array.isArray(content.cardNodes)) ||
          (content.jumpNodes && Array.isArray(content.jumpNodes)) ||
          (content.taskNodes && Array.isArray(content.taskNodes)) ||
          (content.tipNodes && Array.isArray(content.tipNodes))
        ) {
          const totalNodes =
            (content.videoNodes?.length || 0) +
            (content.optionNodes?.length || 0) +
            (content.choiceNodes?.length || 0) +
            (content.bgmNodes?.length || 0) +
            (content.cardNodes?.length || 0) +
            (content.jumpNodes?.length || 0) +
            (content.taskNodes?.length || 0) +
            (content.tipNodes?.length || 0);
          const totalVariables = Array.isArray(content.variables) ? content.variables.length : 0;

          const confirmMessage = `确定要导入项目吗？\n\n这将覆盖当前的所有数据：\n- 节点数: ${totalNodes}\n- 变量数: ${totalVariables}`;
          if (!confirm(confirmMessage)) {
            return;
          }

          const storyData = convertStoryDataToFlow(content);
          importProject({
            nodes: storyData.nodes,
            edges: storyData.edges,
            variables: storyData.variables,
            startNodeId: storyData.startNodeId || null,
          });

          setReactFlowNodes(storyData.nodes);
          setReactFlowEdges(storyData.edges);
          if (storyData.variables.length > 0) {
            setVariables(storyData.variables);
          }
          if (storyData.startNodeId) {
            setStartNode(storyData.startNodeId);
          } else if (storyData.rawStartNodeId) {
            setStartNode(storyData.rawStartNodeId);
          }

          alert(`导入成功！\n\n节点数: ${storyData.nodes.length}\n连线数: ${storyData.edges.length}\n变量数: ${storyData.variables.length}`);
        } else {
          // 提供更详细的错误信息
          const errorDetails = [];
          if (!content.entities) errorDetails.push('缺少 entities 字段');
          else if (!Array.isArray(content.entities)) errorDetails.push(`entities 不是数组，而是 ${typeof content.entities}`);
          if (!content.associations) errorDetails.push('缺少 associations 字段');
          else if (!Array.isArray(content.associations)) errorDetails.push(`associations 不是数组，而是 ${typeof content.associations}`);
          if (!content.nodes) errorDetails.push('缺少 nodes 字段');
          else if (!Array.isArray(content.nodes)) errorDetails.push(`nodes 不是数组，而是 ${typeof content.nodes}`);
          if (!content.edges) errorDetails.push('缺少 edges 字段');
          else if (!Array.isArray(content.edges)) errorDetails.push(`edges 不是数组，而是 ${typeof content.edges}`);
          
          console.error('[handleImportPGChange] 文件格式检查失败:', {
            contentKeys: Object.keys(content),
            errorDetails
          });
          
          alert(`文件格式错误：请选择ProjectGraph格式（包含entities和associations）或React Flow格式（包含nodes和edges）的文件。\n\n检测到的问题：\n${errorDetails.join('\n')}`);
        }
      } catch (error) {
        console.error('文件格式错误:', error);
        alert('文件格式错误，请选择正确的PG格式文件');
      }
    };
    reader.readAsText(file);
    
    // 重置文件输入，允许重复导入同一文件
    e.target.value = '';
  };

  // 处理导出变量
  const handleExportVariables = async () => {
    // 检查浏览器是否支持 File System Access API
    if (!('showDirectoryPicker' in window)) {
      alert('您的浏览器不支持文件夹选择功能。\n请使用 Chrome 86+ 或 Edge 86+ 浏览器。\n\n建议：更新浏览器到最新版本。');
      return;
    }

    try {
      // 让用户选择保存文件夹
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });

      const { variables } = useFlowStore.getState();
      
      // 创建或获取目录结构 GameProduceFiles/Configs/VariableData/
      // { create: true } 表示：如果不存在则创建，如果已存在则使用现有的
      const gameDir = await dirHandle.getDirectoryHandle('GameProduceFiles', { create: true });
      const configsDir = await gameDir.getDirectoryHandle('Configs', { create: true });
      const variableDir = await configsDir.getDirectoryHandle('VariableData', { create: true });
      
      // 查找可用的文件名（如果 VariableData.json 已存在，则使用 VariableData_1.json, VariableData_2.json 等）
      let fileName = 'VariableData.json';
      let fileIndex = 1;
      
      // 检查文件是否存在
      while (true) {
        try {
          // 尝试获取文件（不创建）
          await variableDir.getFileHandle(fileName, { create: false });
          // 如果成功（文件存在），尝试下一个文件名
          fileName = `VariableData_${fileIndex}.json`;
          fileIndex++;
        } catch (error) {
          // 文件不存在，使用当前文件名
          break;
        }
      }
      
      // 转换并保存变量数据
      const variableData = convertVariablesToExportFormat(variables);
      const variableJson = JSON.stringify(variableData, null, 4);
      const variableFile = await variableDir.getFileHandle(fileName, { create: true });
      const variableWritable = await variableFile.createWritable();
      await variableWritable.write(variableJson);
      await variableWritable.close();

      alert(`变量导出成功！\n\n已保存到：\nGameProduceFiles/Configs/VariableData/${fileName}\n\n变量数: ${variables.length}`);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('用户取消了文件夹选择');
      } else {
        console.error('导出变量失败:', error);
        alert(`导出失败！\n\n错误信息: ${error.message}\n\n请确保：\n1. 您有权限写入选择的文件夹\n2. 文件夹未被其他程序占用`);
      }
    }
  };

  return (
    <div className={styles.leftColumn}>
        <div className={styles.header}>
        <Button onClick={handleLoadFileSelect}>加载</Button>
        <Button onClick={handleExportNodes}>导出节点</Button>
        <Button onClick={handleExportVariables}>导出变量</Button>
        <Button onClick={handleExportPG}>导出PG格式</Button>
        <Button onClick={handleImportPGSelect}>导入PG格式</Button>
         <Button onClick={handleAddVideoNode}>添加视频节点</Button>
        <Button onClick={handleAddOptionNode}>添加选项节点</Button>
        <Button onClick={handleAddBgmNode}>添加BGM节点</Button>
        <Button onClick={handleAddCardNode}>添加卡牌节点</Button>
        <Button onClick={handleAddJumpNode}>添加跳转节点</Button>
        <Button onClick={handleAddTaskNode}>添加任务节点</Button>
        <Button onClick={handleSetStartNode}>设置起始节点</Button>
        <Button
          type={isMultiSelectEnabled ? 'primary' : 'default'}
          onClick={handleMultiSelectButtonClick}
        >
          {isMultiSelectEnabled ? '确认' : '多选'}
        </Button>
        <Button
          type={canJoinGroup ? 'primary' : 'default'}
          disabled={!canJoinGroup}
          onClick={handleJoinGroupClick}
        >
          加入组合
        </Button>
        </div>
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* 变量管理器 - 固定在画布左上角 */}
        <div className={styles.variableManagerWrapper}>
          <VariableManager />
        </div>
        
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectStop}
          onNodeClick={handleNodeClick}
          onSelectionChange={onSelectionChange}
          onPaneClick={handlePaneClick}
          selectionOnDrag={false}
          elementsSelectable={!isMultiSelectEnabled}
          panOnDrag={canPanOnDrag}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
          minZoom={0.001}
          maxZoom={200}
          nodesDraggable={true}
          nodesConnectable={true}
          connectionLineType="smooth"
          zoomOnScroll={canZoomOnScroll}
          preventScrolling={false}
          deleteKeyCode="Backspace"
          panOnScroll={false}
          selectNodesOnDrag={false}
          elevateNodesOnSelect={false}
          onlyRenderVisibleElements={true}
          defaultEdgeOptions={{
            type: 'smooth',
            animated: false,
            style: { 
              stroke: '#1890ff', 
              strokeWidth: 2,
              strokeDasharray: 'none'
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#1890ff',
              width: 20,
              height: 20,
            },
            pathOptions: {
              offset: 0,
              borderRadius: 0,
            }
          }}
        >
          <Background 
            variant="dots"
            gap={40}
            size={1}
            color="#e0e0e0"
          />
          <Controls />
          <MiniMap 
            nodeColor={nodeColor}
            nodeStrokeWidth={3}
            zoomable
            pannable
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <FlowControls />
        </ReactFlow>
        <GroupOverlayLayer />

        {/* 拖拽连线覆盖层 - 使用 fixed 定位在屏幕坐标系 */}
        {dragOverlayPath && (
          <svg
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 9999
            }}
          >
            <defs>
              <marker
                id="dragging-arrow-fixed"
                markerWidth="20"
                markerHeight="20"
                refX="10"
                refY="10"
                orient="auto"
              >
                <path
                  d="M 0 0 L 20 10 L 0 20 z"
                  fill="#1890ff"
                  opacity="0.8"
                />
              </marker>
            </defs>
            <path
              d={computeDragPath(dragOverlayPath)}
              stroke="#1890ff"
              strokeWidth="3"
              strokeDasharray="8,4"
              fill="none"
              opacity="0.8"
              markerEnd="url(#dragging-arrow-fixed)"
              filter="drop-shadow(0 0 8px rgba(24, 144, 255, 0.6))"
            />
          </svg>
        )}
        
        {/* 删除区域 */}
        <div 
          className={`${styles.deleteZone} ${isDraggingOverDelete ? styles.deleteZoneActive : ''} ${(draggingNode || selectedEdges.length > 0 || isDraggingEdge) ? styles.deleteZoneVisible : ''}`}
          onMouseEnter={handleDeleteZoneEnter}
          onMouseLeave={handleDeleteZoneLeave}
        >
          <div className={styles.deleteZoneIcon}>🗑️</div>
          <div className={styles.deleteZoneText}>
            {isDraggingOverDelete 
              ? (draggingNode ? '松开鼠标删除节点' : '松开鼠标删除连线')
              : (draggingNode ? '拖拽到此处删除' : 
                 selectedEdges.length > 0 ? '拖拽连线到此处删除' : 
                 isDraggingEdge ? '拖拽连线到此处删除' : 
                 '拖拽到此处删除')}
          </div>
        </div>
    </div>

      {/* 隐藏的加载文件输入 */}
      <input
        ref={loadFileInputRef}
        type="file"
        accept=".json"
        onChange={handleLoadFileChange}
        style={{ display: 'none' }}
        className="no-drag"
      />
      
      {/* 隐藏的导入PG格式文件输入 */}
      <input
        ref={importPGFileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportPGChange}
        style={{ display: 'none' }}
        className="no-drag"
      />
    </div>
  );
}