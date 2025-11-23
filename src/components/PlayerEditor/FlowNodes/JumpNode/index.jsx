import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * 跳转节点组件
 * 用于配置跳转相关的参数
 */
export default function JumpNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);

  // 节点名称编辑状态（使用 jumpPointId 作为节点名称）
  const [isEditingNodeName, setIsEditingNodeName] = useState(false);
  const [editingNodeName, setEditingNodeName] = useState('');

  // 当 jumpPointId 变化时，同步到编辑状态
  useEffect(() => {
    if (!isEditingNodeName) {
      setEditingNodeName(data.jumpPointId || '');
    }
  }, [data.jumpPointId, isEditingNodeName]);

  return (
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.card} ${selected ? styles.selected : ''}`}
        tabIndex={0}
      >
        {/* 标题栏 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>跳转节点</h3>
            <span className={styles.nodeId}>ID:{data.id}</span>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className={styles.tabs}>
          <div className={`${styles.tab} ${styles.inputTab}`}>
            <Handle
              type="target"
              position={Position.Left}
              id="input"
              className={`${styles.portHandle} ${styles.inputHandle}`}
              isConnectable={true}
              data-port-type="in"
              data-port-id="input"
              style={{
                background: '#1890ff',
                width: 14,
                height: 14,
                border: '2px solid #fff',
                borderRadius: '4px',
              }}
            />
            <span className={styles.tabLabel}>输入</span>
          </div>
          <div className={styles.tabCenter}>
            {isEditingNodeName ? (
              <input
                type="text"
                value={editingNodeName}
              onChange={(e) => {
                const newValue = e.target.value;
                setEditingNodeName(newValue);
                // 实时更新 store，实现双向同步
                updateNode(id, { jumpPointId: newValue });
              }}
              onBlur={() => {
                const finalValue = editingNodeName.trim() || '';
                updateNode(id, { jumpPointId: finalValue });
                setIsEditingNodeName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const finalValue = editingNodeName.trim() || '';
                  updateNode(id, { jumpPointId: finalValue });
                  setIsEditingNodeName(false);
                  e.target.blur();
                } else if (e.key === 'Escape') {
                  setEditingNodeName(data.jumpPointId || '');
                  setIsEditingNodeName(false);
                }
              }}
                className={styles.nodeNameInput}
                autoFocus
              />
            ) : (
              <span 
                className={styles.nodeNameLabel}
                onDoubleClick={() => {
                  setEditingNodeName(data.jumpPointId || '');
                  setIsEditingNodeName(true);
                }}
                style={{ cursor: 'text' }}
                title="双击编辑"
              >
                {data.jumpPointId || '跳转点ID'}
              </span>
            )}
          </div>
          <div className={`${styles.tab} ${styles.outputTab}`}>
            <span className={styles.tabLabel}>输出</span>
            <Handle
              type="source"
              position={Position.Right}
              id="output"
              className={`${styles.portHandle} ${styles.outputHandle}`}
              isConnectable={true}
              data-port-type="out"
              data-port-id="output"
              style={{
                background: '#52c41a',
                width: 14,
                height: 14,
                border: '2px solid #fff',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      </div>

      {/* 跳转点激活标签 */}
      {data.jumpPointActive && (
        <div className={styles.optionTags}>
          <div className={styles.optionTag}>
            跳转点激活
          </div>
        </div>
      )}
    </div>
  );
}

