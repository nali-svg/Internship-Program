import React, { useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Modal } from 'antd';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * 选项节点组件
 * 用于配置选项相关的参数和行为
 */
export default function OptionNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 直接从 store 获取最新节点数据
  const nodes = useFlowStore((state) => state.nodes);
  const currentNode = nodes.find(node => node.id === id);
  const nodeData = currentNode?.data || data;
  
  // 选项文本编辑状态
  const [isEditingOptionText, setIsEditingOptionText] = useState(false);
  const [editingOptionText, setEditingOptionText] = useState('');

  // 图片预览相关状态
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // 检查是否有图片预览 - 使用从 store 获取的最新数据
  const hasImagePreview = !!(nodeData.overlayImagePreview && nodeData.enableOverlayImage !== false);

  // 当 optionText 变化时，同步到编辑状态
  useEffect(() => {
    if (!isEditingOptionText) {
      setEditingOptionText(nodeData.optionText || '');
    }
  }, [nodeData.optionText, isEditingOptionText]);

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
        className={`${styles.card} ${selected ? styles.selected : ''} ${hasImagePreview ? styles.cardHasImage : ''}`}
        tabIndex={0}
      >
      {/* 标题栏 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>选项节点</h3>
          <span className={styles.nodeId}>ID:{nodeData.id}</span>
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
          {isEditingOptionText ? (
            <input
              type="text"
              value={editingOptionText}
              onChange={(e) => {
                const newValue = e.target.value;
                setEditingOptionText(newValue);
                // 实时更新 store，实现双向同步
                updateNode(id, { optionText: newValue });
              }}
              onBlur={() => {
                const finalValue = editingOptionText.trim() || '';
                updateNode(id, { optionText: finalValue });
                setIsEditingOptionText(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const finalValue = editingOptionText.trim() || '';
                  updateNode(id, { optionText: finalValue });
                  setIsEditingOptionText(false);
                  e.target.blur();
                } else if (e.key === 'Escape') {
                  setEditingOptionText(nodeData.optionText || '');
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
                setEditingOptionText(nodeData.optionText || '');
                setIsEditingOptionText(true);
              }}
              style={{ cursor: 'text' }}
              title="双击编辑"
            >
              {nodeData.optionText || '选择文本'}
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

      {/* 主内容区 - 可滚动 */}
      <div className={`${styles.content} no-drag`}>
        {/* 叠加图片选项区 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>叠加图片选项</h3>
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={nodeData.enableOverlayImage !== false}
              onChange={(e) => {
                updateNode(id, { enableOverlayImage: e.target.checked });
              }}
            />
            <span>启用叠加图片选项</span>
          </label>
          
          {/* 图片预览 - 当启用且有图片时显示 */}
          {nodeData.enableOverlayImage !== false && nodeData.overlayImagePreview && (
            <div className={styles.imagePreviewContainer}>
              <img
                src={nodeData.overlayImagePreview}
                alt="叠加图片预览"
                className={styles.imagePreviewImage}
                onClick={() => setShowImagePreview(true)}
                style={{ cursor: 'pointer' }}
                title="点击查看大图"
              />
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 条件判断标签 - 优先级最高，显示在最上面 */}
      {nodeData.conditions && nodeData.conditions.length > 0 && (
        <div className={styles.conditionTags}>
          {nodeData.conditions.map((condition, index) => (
            <div
              key={condition.id ?? `${condition.leftValue ?? ''}-${index}`}
              className={styles.conditionTag}
            >
              {formatConditionLabel(condition)}
            </div>
          ))}
        </div>
      )}

      {/* 变量效果标签 - 在条件标签下方 */}
      {nodeData.effects && nodeData.effects.length > 0 && (
        <div className={styles.effectTags}>
          {nodeData.effects.map((effect, index) => (
            <div
              key={effect.id ?? `effect-${index}`}
              className={styles.effectTag}
            >
              {formatEffectLabel(effect)}
            </div>
          ))}
        </div>
      )}

      {/* 显示设置标签 - 在效果标签下方 */}
      {(nodeData.preDisplay || nodeData.showWhenConditionNotMet) && (
        <div className={styles.optionTags}>
          {nodeData.preDisplay && (
            <div className={styles.optionTag}>
              提前显示
            </div>
          )}
          {nodeData.showWhenConditionNotMet && (
            <div className={styles.optionTag}>
              添加不满足时显示：{nodeData.unavailableMessage || '（无提示信息）'}
            </div>
          )}
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
        {hasImagePreview && nodeData.overlayImagePreview && (
          <img
            src={nodeData.overlayImagePreview}
            alt="图片预览"
            style={{ width: '100%', height: 'auto' }}
          />
        )}
      </Modal>
    </div>
  );
}
