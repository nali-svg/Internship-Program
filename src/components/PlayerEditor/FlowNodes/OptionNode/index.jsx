import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Modal } from 'antd';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * 选项节点组件
 * 用于配置选项相关的参数和行为
 */
export default function OptionNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  const { updateNodeInternals } = useReactFlow();
  
  // 展开/收起状态
  const [isExpanded, setIsExpanded] = useState(data.isExpanded || false);
  
  // 计算是否有条件或效果
  const hasConditionsOrEffects = useMemo(() => {
    const hasConditions = Array.isArray(data.conditions) && data.conditions.length > 0;
    const hasEffects = Array.isArray(data.effects) && data.effects.length > 0;
    return hasConditions || hasEffects;
  }, [data.conditions, data.effects]);
  
  // 当条件或效果变化时，更新节点内部尺寸
  useEffect(() => {
    if (updateNodeInternals) {
      // 使用 setTimeout 确保 DOM 更新完成后再通知 React Flow
      const timer = setTimeout(() => {
        updateNodeInternals(id);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [id, hasConditionsOrEffects, updateNodeInternals]);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});

  // 选项文本编辑状态
  const [isEditingOptionText, setIsEditingOptionText] = useState(false);
  const [editingOptionText, setEditingOptionText] = useState('');

  // 图片预览相关状态
  const [imagePreview, setImagePreview] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);

  // 同步外部的 overlayImagePreview（从 Inspector 或其他来源）
  useEffect(() => {
    if (data.overlayImagePreview && data.overlayImagePreview !== imagePreview) {
      setImagePreview(data.overlayImagePreview);
    }
  }, [data.overlayImagePreview, imagePreview]);

  // 计算是否有图片预览
  const hasImagePreview = !!(imagePreview || data.overlayImagePreview);
  const enableOverlayImage = data.enableOverlayImage !== false;

  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['optionText', 'description'];
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

  // 当 optionText 变化时，同步到编辑状态
  useEffect(() => {
    if (!isEditingOptionText) {
      setEditingOptionText(getInputValue('optionText') || '');
    }
  }, [data.optionText, isEditingOptionText, getInputValue]);

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

  // 格式化条件标签
  const formatConditionLabel = useCallback((condition) => {
    if (!condition) {
      return '';
    }
    const operatorMap = {
      Equals: '==',
      NotEquals: '≠',
      GreaterThan: '>',
      LessThan: '<',
      GreaterOrEqual: '≥',
      LessOrEqual: '≤',
    };
    const left = condition.leftValue ?? '';
    const operator = operatorMap[condition.operator] || condition.operator || '';
    const right = condition.rightValue ?? '';
    return `${left} ${operator} ${right}`.trim();
  }, []);

  // 格式化效果标签
  const formatEffectLabel = useCallback((effect) => {
    if (!effect) {
      return '';
    }
    const operationMap = {
      Set: '=',
      Add: '+',
      Subtract: '-',
      Multiply: '*',
      Divide: '/',
    };
    const variable = effect.variableName ?? '';
    const operation = operationMap[effect.operation] || effect.operation || '';
    const value = effect.value ?? '';
    return value !== '' ? `${variable} ${operation} ${value}` : `${variable} ${operation}`.trim();
  }, []);

  return (
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.card} ${selected ? styles.selected : ''} ${isExpanded ? styles.expanded : ''}`}
        tabIndex={0}
      >
      {/* 标题栏 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>选项节点</h3>
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
          {isEditingOptionText ? (
            <input
              type="text"
              value={editingOptionText}
              onChange={(e) => setEditingOptionText(e.target.value)}
              onBlur={() => {
                if (editingOptionText !== (getInputValue('optionText') || '')) {
                  handleTextInputChange('optionText', editingOptionText);
                  handleTextInputBlur('optionText');
                }
                setIsEditingOptionText(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingOptionText !== (getInputValue('optionText') || '')) {
                    handleTextInputChange('optionText', editingOptionText);
                    handleTextInputBlur('optionText');
                  }
                  setIsEditingOptionText(false);
                } else if (e.key === 'Escape') {
                  setEditingOptionText(getInputValue('optionText') || '');
                  setIsEditingOptionText(false);
                }
              }}
              className={styles.optionTextInput}
              autoFocus
            />
          ) : (
            <span 
              className={styles.optionTextLabel}
              onDoubleClick={() => {
                setEditingOptionText(getInputValue('optionText') || '');
                setIsEditingOptionText(true);
              }}
              style={{ cursor: 'text' }}
              title="双击编辑"
            >
              {getInputValue('optionText') || '选择文本'}
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

      {/* 图片预览 - 顶部位置（当启用叠加图片且有图片时显示） */}
      {enableOverlayImage && hasImagePreview && (
        <div
          className={styles.imagePreviewContainer}
          onClick={() => setShowImagePreview(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setShowImagePreview(true);
            }
          }}
          title="点击查看大图"
        >
          <img
            src={imagePreview || data.overlayImagePreview}
            alt="叠加图片预览"
            className={styles.imagePreviewImage}
          />
        </div>
      )}

      {/* 主内容区 - 可滚动 */}
      <div className={`${styles.content} no-drag`} onWheel={handleContentWheel}>
        {/* 基本信息区 */}
        <div className={styles.section}>
          <div className={styles.field}>
            <label>描述</label>
            <input 
              type="text" 
              value={getInputValue('description') || ''}
              onChange={(e) => handleTextInputChange('description', e.target.value)}
              onBlur={() => handleTextInputBlur('description')}
              placeholder="输入描述"
            />
          </div>
        </div>
      </div>
      </div>

      {data.conditions && data.conditions.length > 0 && (
        <div className={styles.conditionTags}>
          {data.conditions.map((condition, index) => (
            <div
              key={condition.id ?? `${condition.leftValue ?? ''}-${index}`}
              className={styles.conditionTag}
            >
              {formatConditionLabel(condition)}
            </div>
          ))}
        </div>
      )}

      {data.effects && data.effects.length > 0 && (
        <div className={styles.effectTags}>
          {data.effects.map((effect, index) => (
            <div
              key={effect.id ?? `effect-${index}`}
              className={styles.effectTag}
            >
              {formatEffectLabel(effect)}
            </div>
          ))}
        </div>
      )}

      {/* 图片预览模态框 */}
      <Modal
        title="图片预览"
        open={showImagePreview}
        onCancel={() => setShowImagePreview(false)}
        footer={null}
        width={800}
        centered
        destroyOnClose
      >
        {hasImagePreview && (
          <img
            src={imagePreview || data.overlayImagePreview}
            alt="叠加图片"
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        )}
      </Modal>
    </div>
  );
}

