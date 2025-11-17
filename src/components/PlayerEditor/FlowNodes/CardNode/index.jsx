import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Modal } from 'antd';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * 卡牌节点组件
 * 用于配置卡牌相关的参数
 */
export default function CardNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 展开/收起状态
  const [isExpanded, setIsExpanded] = useState(data.isExpanded || false);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});

  // 节点名称编辑状态
  const [isEditingNodeName, setIsEditingNodeName] = useState(false);
  const [editingNodeName, setEditingNodeName] = useState('');
  
  // 图片预览相关状态
  const [imagePreview, setImagePreview] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['nodeName', 'description', 'unavailableMessage'];
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

  // 同步外部的 cardImagePreview（从 store）
  useEffect(() => {
    if (data.cardImagePreview && data.cardImagePreview !== imagePreview) {
      setImagePreview(data.cardImagePreview);
      console.log('[CardNode] 从 data 同步卡牌图片预览');
    }
  }, [data.cardImagePreview, imagePreview]);
  
  // 文件输入引用
  const cardImageInputRef = useRef(null);
  
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

  // 当 nodeName 变化时，同步到编辑状态
  useEffect(() => {
    if (!isEditingNodeName) {
      setEditingNodeName(getInputValue('nodeName') || '');
    }
  }, [data.nodeName, isEditingNodeName, getInputValue]);

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

  // 处理卡牌图片选择
  const handleCardImageSelect = () => {
    cardImageInputRef.current?.click();
  };

  // 处理卡牌图片文件变化
  const handleCardImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name;
      handleInputChange('cardImage', fileName);
      
      // 创建本地预览
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      
      // 读取为 base64 保存到 store（实现跨组件同步）
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        updateNode(id, {
          cardImagePreview: base64  // 保存 base64 数据
        });
        console.log('[CardNode] 成功保存卡牌图片预览到 store');
      };
      reader.readAsDataURL(file);
    }
  };

  // 计算是否有图片预览
  const hasImagePreview = !!(imagePreview || data.cardImagePreview);

  return (
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.card} ${selected ? styles.selected : ''} ${isExpanded ? styles.expanded : ''} ${hasImagePreview ? styles.hasImage : ''}`}
        tabIndex={0}
      >
        {/* 标题栏 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>卡牌节点</h3>
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
                  if (editingNodeName !== (getInputValue('nodeName') || '')) {
                    handleTextInputChange('nodeName', editingNodeName);
                    handleTextInputBlur('nodeName');
                  }
                  setIsEditingNodeName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingNodeName !== (getInputValue('nodeName') || '')) {
                      handleTextInputChange('nodeName', editingNodeName);
                      handleTextInputBlur('nodeName');
                    }
                    setIsEditingNodeName(false);
                  } else if (e.key === 'Escape') {
                    setEditingNodeName(getInputValue('nodeName') || '');
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
                  setEditingNodeName(getInputValue('nodeName') || '');
                  setIsEditingNodeName(true);
                }}
                style={{ cursor: 'text' }}
                title="双击编辑"
              >
                {getInputValue('nodeName') || '节点名称'}
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

        {/* 图片预览 - 顶部位置（当有图片时显示） */}
        {hasImagePreview && (
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
              src={imagePreview || data.cardImagePreview}
              alt="卡牌图片预览"
              className={styles.imagePreviewImage}
            />
          </div>
        )}

        {/* 主内容区 - 可滚动 */}
        <div className={`${styles.content} no-drag`} onWheel={handleContentWheel}>
          {/* 基本信息区 */}
          <div className={styles.section}>
            <div className={styles.field}>
              <label>卡牌图片</label>
              <div className={styles.fileInput}>
                <input type="text" value={data.cardImage || '无 (精灵)'} readOnly />
                <button 
                  className={`${styles.iconBtn} no-drag`}
                  onClick={handleCardImageSelect}
                  type="button"
                >
                  📁
                </button>
              </div>
              <input
                ref={cardImageInputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleCardImageChange}
                style={{ display: 'none' }}
                className="no-drag"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 条件标签 */}
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

      {/* 效果标签 */}
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
        {imagePreview && (
          <img
            src={imagePreview}
            alt="图片预览"
            style={{ width: '100%', height: 'auto' }}
          />
        )}
      </Modal>
    </div>
  );
}

