import React, { useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * 跳转节点组件
 * 用于配置跳转相关的参数
 */
export default function JumpNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 展开/收起状态
  const [isExpanded, setIsExpanded] = useState(data.isExpanded || false);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});

  // 节点名称编辑状态（使用 jumpPointId 作为节点名称）
  const [isEditingNodeName, setIsEditingNodeName] = useState(false);
  const [editingNodeName, setEditingNodeName] = useState('');
  
  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['jumpPointId', 'jumpPointDesc'];
    setLocalInputs(prev => {
      const newInputs = { ...prev };
      textFields.forEach(field => {
        if (newInputs[field] === undefined && data[field] !== undefined) {
          newInputs[field] = data[field] || '';
        }
      });
      return newInputs;
    });
  }, [data]);
  
  // 处理输入变化（立即更新store，用于非文本输入）
  const handleInputChange = (field, value) => {
    updateNode(id, { [field]: value });
  };
  
  // 处理文本输入变化（只更新本地状态，不立即更新store）
  const handleTextInputChange = useCallback((field, value) => {
    setLocalInputs(prev => ({ ...prev, [field]: value }));
  }, []);
  
  // 处理文本输入失去焦点（此时才更新store）
  const handleTextInputBlur = useCallback((field) => {
    const value = localInputs[field] !== undefined ? localInputs[field] : (data[field] || '');
    updateNode(id, { [field]: value });
  }, [id, updateNode, localInputs, data]);
  
  // 获取输入框的值（优先使用本地状态）
  const getInputValue = useCallback((field) => {
    return localInputs[field] !== undefined ? localInputs[field] : (data[field] || '');
  }, [localInputs, data]);

  // 当 jumpPointId 变化时，同步到编辑状态
  useEffect(() => {
    if (!isEditingNodeName) {
      setEditingNodeName(getInputValue('jumpPointId') || '');
    }
  }, [data.jumpPointId, isEditingNodeName, getInputValue]);

  // 处理复选框变化
  const handleCheckboxChange = (field) => {
    updateNode(id, { [field]: !data[field] });
  };

  // 处理展开/收起
  const toggleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    updateNode(id, { isExpanded: newExpandedState });
  };

  // 处理卡片内容区的滚轮事件，阻止冒泡到画布
  const handleContentWheel = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.card} ${selected ? styles.selected : ''} ${isExpanded ? styles.expanded : ''}`}
        tabIndex={0}
      >
        {/* 标题栏 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>跳转节点</h3>
            <span className={styles.nodeId}>ID:{data.id}</span>
          </div>
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={data.isCheckpoint}
              onChange={() => handleCheckboxChange('isCheckpoint')}
              className="no-drag"
            />
            <span>设为检查点</span>
          </label>
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
                onChange={(e) => setEditingNodeName(e.target.value)}
                onBlur={() => {
                  if (editingNodeName !== (getInputValue('jumpPointId') || '')) {
                    handleTextInputChange('jumpPointId', editingNodeName);
                    handleTextInputBlur('jumpPointId');
                  }
                  setIsEditingNodeName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingNodeName !== (getInputValue('jumpPointId') || '')) {
                      handleTextInputChange('jumpPointId', editingNodeName);
                      handleTextInputBlur('jumpPointId');
                    }
                    setIsEditingNodeName(false);
                  } else if (e.key === 'Escape') {
                    setEditingNodeName(getInputValue('jumpPointId') || '');
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
                  setEditingNodeName(getInputValue('jumpPointId') || '');
                  setIsEditingNodeName(true);
                }}
                style={{ cursor: 'text' }}
                title="双击编辑"
              >
                {getInputValue('jumpPointId') || '跳转点ID'}
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

        {/* 主内容区 - 可滚动 */}
        <div className={`${styles.content} no-drag`} onWheel={handleContentWheel}>
          {/* 基本信息区 */}
          <div className={styles.section}>
            <div className={styles.field}>
              <label>跳转点描述</label>
              <input 
                type="text" 
                value={getInputValue('jumpPointDesc') || ''}
                onChange={(e) => handleTextInputChange('jumpPointDesc', e.target.value)}
                onBlur={() => handleTextInputBlur('jumpPointDesc')}
                placeholder="输入跳转点描述"
              />
            </div>

            <div className={styles.checkboxGroup}>
              <label>
                <input 
                  type="checkbox" 
                  checked={data.jumpPointActive || false} 
                  onChange={() => handleCheckboxChange('jumpPointActive')} 
                />
                <span>跳转点激活</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

