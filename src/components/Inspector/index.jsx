import React from 'react';
import styles from './index.module.scss';
import useFlowStore from '../../store/flowStore';
import VideoNodeInspector from './VideoNodeInspector/index.jsx';
import OptionNodeInspector from './OptionNodeInspector/index.jsx';
import BgmNodeInspector from './BgmNodeInspector/index.jsx';
import CardNodeInspector from './CardNodeInspector/index.jsx';
import JumpNodeInspector from './JumpNodeInspector/index.jsx';
import TaskNodeInspector from './TaskNodeInspector/index.jsx';

/**
 * Inspector 组件 - Unity 风格的属性面板
 * 显示选中节点的所有属性并允许编辑
 */
export default function Inspector({ selectedNodeId }) {
  const nodes = useFlowStore((state) => state.nodes);
  
  // 获取选中的节点数据
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const data = selectedNode?.data || {};
  
  // 如果没有选中节点，显示空状态
  if (!selectedNode) {
    return (
      <div className={styles.inspector}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyText}>未选中节点</div>
          <div className={styles.emptyHint}>点击画布中的节点以查看和编辑其属性</div>
        </div>
      </div>
    );
  }
  
  // 根据节点类型显示不同的内容
  const nodeType = selectedNode.type;
  
  // 根据节点类型渲染不同的 Inspector
  if (nodeType === 'videoNode') {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <h2 className={styles.title}>🎬 视频节点</h2>
        </div>
        <div className={styles.content}>
          <VideoNodeInspector nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    );
  }
  
  if (nodeType === 'optionNode') {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <h2 className={styles.title}>📝 选项节点</h2>
        </div>
        <div className={styles.content}>
          <OptionNodeInspector nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    );
  }
  
  if (nodeType === 'bgmNode') {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <h2 className={styles.title}>🎵 BGM 节点</h2>
        </div>
        <div className={styles.content}>
          <BgmNodeInspector nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    );
  }
  
  if (nodeType === 'cardNode') {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <h2 className={styles.title}>🎴 卡牌节点</h2>
        </div>
        <div className={styles.content}>
          <CardNodeInspector nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    );
  }
  
  if (nodeType === 'jumpNode') {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <h2 className={styles.title}>🔀 跳转节点</h2>
        </div>
        <div className={styles.content}>
          <JumpNodeInspector nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    );
  }
  
  if (nodeType === 'taskNode') {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <h2 className={styles.title}>📋 任务节点</h2>
        </div>
        <div className={styles.content}>
          <TaskNodeInspector nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    );
  }
  
  // 其他节点类型的占位符
  return (
    <div className={styles.inspector}>
      <div className={styles.header}>
        <h2 className={styles.title}>节点属性</h2>
      </div>
      <div className={styles.content}>
        <div className={styles.section}>
          <p className={styles.placeholder}>暂不支持此节点类型的属性编辑</p>
        </div>
      </div>
    </div>
  );
}

