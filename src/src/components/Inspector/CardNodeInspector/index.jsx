import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import styles from '../index.module.scss';
import useFlowStore from '../../../store/flowStore';
import { createDefaultVariable } from '../../../utils/variableHelper';

/**
 * CardNode 专用的 Inspector 面板
 */
export default function CardNodeInspector({ nodeId, data }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});
  
  // 图片预览相关状态
  const [imagePreview, setImagePreview] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // Section 展开/收起状态
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    cardSettings: true,
    description: true,
    effects: true,
    conditions: true,
  });
  
  // 切换section展开/收起
  const toggleSection = useCallback((sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  }, []);
  
  // 文件输入引用
  const cardImageInputRef = useRef(null);

  // 初始化本地状态，确保外部 data 变化时同步到本地状态
  useEffect(() => {
    const textFields = ['nodeName', 'description', 'unavailableMessage'];
    setLocalInputs(prev => {
      const newInputs = { ...prev };
      // 同步所有字段的值，确保外部更新能够反映到界面
      textFields.forEach(field => {
        if (data[field] !== undefined) {
          // 如果外部值与当前值不同，则更新（这样可以响应外部修改，如从画布上修改 nodeName）
          if (newInputs[field] !== data[field]) {
            newInputs[field] = data[field] || '';
          }
        } else if (newInputs[field] === undefined) {
          // 如果字段不存在，初始化为空字符串
          newInputs[field] = '';
        }
      });
      return newInputs;
    });
  }, [nodeId, data]);

  // 同步外部的 cardImagePreview（从 store）
  useEffect(() => {
    if (data.cardImagePreview && data.cardImagePreview !== imagePreview) {
      setImagePreview(data.cardImagePreview);
      console.log('[CardNodeInspector] 从 data 同步卡牌图片预览');
    }
  }, [data.cardImagePreview, imagePreview]);

  // 处理输入变化（立即更新store，用于非文本输入）
  const handleInputChange = (field, value) => {
    updateNode(nodeId, { [field]: value });
  };

  // 处理文本输入变化（实时更新本地状态和store）
  const handleTextInputChange = useCallback((field, value) => {
    setLocalInputs(prev => ({ ...prev, [field]: value }));
    updateNode(nodeId, { [field]: value });  // 实时同步到 store
  }, [nodeId, updateNode]);

  // 获取输入框的值（优先使用本地状态）
  const getInputValue = useCallback((field) => {
    return localInputs[field] !== undefined ? localInputs[field] : (data[field] || '');
  }, [localInputs, data]);

  // 处理复选框变化
  const handleCheckboxChange = (field) => {
    updateNode(nodeId, { [field]: !data[field] });
  };

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
        updateNode(nodeId, {
          cardImagePreview: base64  // 保存 base64 数据
        });
        console.log('[CardNodeInspector] 成功保存卡牌图片预览到 store');
      };
      reader.readAsDataURL(file);
    }
  };

  // 添加条件
  const handleAddCondition = () => {
    let defaultVariableName = '';
    const variables = useFlowStore.getState().variables;
    if (variables.length === 0) {
      defaultVariableName = createDefaultVariable(useFlowStore);
    }
    
    const newConditions = [...(data.conditions || []), { 
      id: Date.now(), 
      leftValue: defaultVariableName, 
      operator: 'Equals', 
      rightValue: '' 
    }];
    handleInputChange('conditions', newConditions);
  };

  // 删除条件
  const handleRemoveCondition = (conditionId) => {
    const newConditions = (data.conditions || []).filter(condition => condition.id !== conditionId);
    handleInputChange('conditions', newConditions);
  };

  // 更新条件
  const handleUpdateCondition = (conditionId, field, value) => {
    const newConditions = (data.conditions || []).map(condition => 
      condition.id === conditionId ? { ...condition, [field]: value } : condition
    );
    handleInputChange('conditions', newConditions);
  };

  // 添加效果
  const handleAddEffect = () => {
    let defaultVariableName = '';
    const variables = useFlowStore.getState().variables;
    if (variables.length === 0) {
      defaultVariableName = createDefaultVariable(useFlowStore);
    }
    
    const newEffects = [...(data.effects || []), { 
      id: Date.now(), 
      variableName: defaultVariableName, 
      operation: 'Set', 
      value: '' 
    }];
    handleInputChange('effects', newEffects);
  };

  // 删除效果
  const handleRemoveEffect = (effectId) => {
    const newEffects = (data.effects || []).filter(effect => effect.id !== effectId);
    handleInputChange('effects', newEffects);
  };

  // 更新效果
  const handleUpdateEffect = (effectId, field, value) => {
    const newEffects = (data.effects || []).map(effect => 
      effect.id === effectId ? { ...effect, [field]: value } : effect
    );
    handleInputChange('effects', newEffects);
  };

  return (
    <div className={styles.inspectorContent}>
      {/* 隐藏的文件输入 */}
      <input
        ref={cardImageInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        onChange={handleCardImageChange}
        style={{ display: 'none' }}
      />

      {/* 基本信息 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('basicInfo')}>
          <h3 className={styles.sectionTitle}>基本信息</h3>
          <button 
            className={styles.expandButton}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSection('basicInfo');
            }}
          >
            {expandedSections.basicInfo ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.basicInfo && (
          <>
        <div className={styles.field}>
          <label>ID</label>
          <input 
            type="text" 
            value={data.id || ''} 
            readOnly 
            className={styles.readonly}
          />
        </div>

        <div className={styles.field}>
          <label>节点名称</label>
          <input 
            type="text" 
            value={getInputValue('nodeName') || ''}
            onChange={(e) => handleTextInputChange('nodeName', e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div className={styles.field}>
          <label>卡牌图片</label>
          {imagePreview && (
            <div style={{ marginBottom: '10px', textAlign: 'center' }}>
              <img 
                src={imagePreview} 
                alt="图片预览"
                style={{ maxWidth: '100%', maxHeight: '150px', cursor: 'pointer', borderRadius: '4px' }}
                onClick={() => setShowImagePreview(true)}
                title="点击查看大图"
              />
            </div>
          )}
          <div className={styles.fileInputGroup}>
            <input 
              type="text" 
              value={data.cardImage || '无 (精灵)'} 
              readOnly 
              className={styles.fileDisplay}
            />
            <button 
              className={styles.fileButton}
              onClick={handleCardImageSelect}
              type="button"
            >
              📁
            </button>
          </div>
        </div>
          </>
        )}
      </div>

      {/* 卡牌设置 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('cardSettings')}>
          <h3 className={styles.sectionTitle}>卡牌设置</h3>
          <button 
            className={styles.expandButton}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSection('cardSettings');
            }}
          >
            {expandedSections.cardSettings ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.cardSettings && (
          <>
        <div className={styles.field}>
          <label>卡牌大小 X</label>
          <input 
            type="text" 
            value={data.cardSizeX ?? 200}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                handleInputChange('cardSizeX', value);
              }
            }}
            placeholder="默认: 200"
          />
        </div>

        <div className={styles.field}>
          <label>卡牌大小 Y</label>
          <input 
            type="text" 
            value={data.cardSizeY ?? 300}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                handleInputChange('cardSizeY', value);
              }
            }}
            placeholder="默认: 300"
          />
        </div>

        <div className={styles.field}>
          <label>扇形角度</label>
          <input 
            type="text" 
            value={data.fanAngle ?? 30}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseFloat(value);
              handleInputChange('fanAngle', isNaN(numValue) ? value : numValue);
            }}
            placeholder="默认: 30"
          />
        </div>

        <div className={styles.field}>
          <label>动画时长（秒）</label>
          <input 
            type="text" 
            value={data.animationDuration ?? 0.5}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseFloat(value);
              handleInputChange('animationDuration', isNaN(numValue) ? value : numValue);
            }}
            placeholder="默认: 0.5"
          />
        </div>
          </>
        )}
      </div>

      {/* 描述和选项 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('description')}>
          <h3 className={styles.sectionTitle}>描述和选项</h3>
          <button 
            className={styles.expandButton}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSection('description');
            }}
          >
            {expandedSections.description ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.description && (
          <>
        <div className={styles.field}>
          <label>描述</label>
          <textarea 
            value={getInputValue('description') || ''}
            onChange={(e) => handleTextInputChange('description', e.target.value)}
            placeholder="输入描述"
            rows="3"
          />
        </div>

        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.showWhenConditionNotMet || false} 
            onChange={() => handleCheckboxChange('showWhenConditionNotMet')} 
          />
          <span>条件不满足时显示</span>
        </label>

        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.preDisplay || false} 
            onChange={() => handleCheckboxChange('preDisplay')} 
          />
          <span>提前显示</span>
        </label>

        <div className={styles.field}>
          <label>不可用时提示信息</label>
          <input 
            type="text" 
            value={getInputValue('unavailableMessage') || ''}
            onChange={(e) => handleTextInputChange('unavailableMessage', e.target.value)}
            placeholder="输入提示信息"
            disabled={!data.showWhenConditionNotMet}
          />
        </div>
          </>
        )}
      </div>

      {/* 变量效果 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('effects')}>
          <h3 className={styles.sectionTitle}>变量效果</h3>
          <button 
            className={styles.expandButton}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSection('effects');
            }}
          >
            {expandedSections.effects ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.effects && (
          <>
        <button 
          className={styles.addBtn}
          onClick={handleAddEffect}
        >
          + 添加效果
        </button>
        {data.effects && data.effects.length > 0 && (
          <div className={styles.list}>
            {data.effects.map((effect, index) => (
              <div key={effect.id} className={styles.listItem}>
                <input 
                  type="text" 
                  value={effect.variableName || ''}
                  onChange={(e) => handleUpdateEffect(effect.id, 'variableName', e.target.value)}
                  placeholder="变量名"
                />
                <select 
                  value={effect.operation || 'Set'}
                  onChange={(e) => handleUpdateEffect(effect.id, 'operation', e.target.value)}
                  style={{ width: '90px' }}
                >
                  <option value="Set">Set</option>
                  <option value="Add">Add</option>
                  <option value="Subtract">Subtract</option>
                  <option value="Multiply">Multiply</option>
                  <option value="Divide">Divide</option>
                </select>
                <input 
                  type="text" 
                  value={effect.value || ''}
                  onChange={(e) => handleUpdateEffect(effect.id, 'value', e.target.value)}
                  placeholder="值"
                />
                <button 
                  className={styles.removeBtn}
                  onClick={() => handleRemoveEffect(effect.id)}
                  title="删除效果"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>

      {/* 显示条件 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('conditions')}>
          <h3 className={styles.sectionTitle}>显示条件</h3>
          <button 
            className={styles.expandButton}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSection('conditions');
            }}
          >
            {expandedSections.conditions ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.conditions && (
          <>
        <button 
          className={styles.addBtn}
          onClick={handleAddCondition}
        >
          + 添加条件
        </button>
        {data.conditions && data.conditions.length > 0 && (
          <div className={styles.list}>
            {data.conditions.map((condition, index) => (
              <div key={condition.id} className={styles.listItem}>
                <input 
                  type="text" 
                  value={condition.leftValue || ''}
                  onChange={(e) => handleUpdateCondition(condition.id, 'leftValue', e.target.value)}
                  placeholder="左值"
                />
                <select 
                  value={condition.operator || 'Equals'}
                  onChange={(e) => handleUpdateCondition(condition.id, 'operator', e.target.value)}
                  style={{ width: '110px' }}
                >
                  <option value="Equals">Equals</option>
                  <option value="NotEquals">NotEquals</option>
                  <option value="GreaterThan">GreaterThan</option>
                  <option value="LessThan">LessThan</option>
                  <option value="GreaterOrEqual">GreaterOrEqual</option>
                  <option value="LessOrEqual">LessOrEqual</option>
                </select>
                <input 
                  type="text" 
                  value={condition.rightValue || ''}
                  onChange={(e) => handleUpdateCondition(condition.id, 'rightValue', e.target.value)}
                  placeholder="右值"
                />
                <button 
                  className={styles.removeBtn}
                  onClick={() => handleRemoveCondition(condition.id)}
                  title="删除条件"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>

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

