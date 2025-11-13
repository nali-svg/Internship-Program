import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import styles from '../index.module.scss';
import useFlowStore from '../../../store/flowStore';
import { createDefaultVariable } from '../../../utils/variableHelper';

/**
 * OptionNode 专用的 Inspector 面板
 */
export default function OptionNodeInspector({ nodeId, data }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 本地输入状态
  const [localInputs, setLocalInputs] = useState({});
  
  // 图片预览相关状态
  const [imagePreview, setImagePreview] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // 文件输入引用
  const overlayImageInputRef = useRef(null);
  
  // 初始化本地状态
  useEffect(() => {
    const textFields = ['optionText', 'description', 'unavailableMessage'];
    setLocalInputs(prev => {
      const newInputs = {};
      textFields.forEach(field => {
        newInputs[field] = data[field] ?? '';
      });
      return newInputs;
    });
  }, [nodeId, data]);
  
  // 同步外部的 overlayImagePreview（从 store）
  useEffect(() => {
    if (data.overlayImagePreview && data.overlayImagePreview !== imagePreview) {
      setImagePreview(data.overlayImagePreview);
      console.log('[OptionNodeInspector] 从 data 同步叠加图片预览');
    }
  }, [data.overlayImagePreview, imagePreview]);
  
  // 处理输入变化
  const handleInputChange = useCallback((field, value) => {
    updateNode(nodeId, { [field]: value });
  }, [nodeId, updateNode]);
  
  // 处理文本输入变化（实时更新本地状态和store）
  const handleTextInputChange = useCallback((field, value) => {
    setLocalInputs(prev => ({ ...prev, [field]: value }));
    updateNode(nodeId, { [field]: value });  // 实时同步到 store
  }, [nodeId, updateNode]);
  
  // 获取输入框的值
  const getInputValue = useCallback((field) => {
    return localInputs[field] !== undefined ? localInputs[field] : (data[field] || '');
  }, [localInputs, data]);
  
  // 处理复选框变化
  const handleCheckboxChange = useCallback((field) => {
    updateNode(nodeId, { [field]: !data[field] });
  }, [nodeId, updateNode, data]);
  
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
      rightValue: '',
      useComplexExpression: false
    }];
    handleInputChange('conditions', newConditions);
  };
  
  const handleUpdateCondition = (conditionId, field, value) => {
    const updatedConditions = data.conditions.map(cond =>
      cond.id === conditionId ? { ...cond, [field]: value } : cond
    );
    handleInputChange('conditions', updatedConditions);
  };
  
  const handleRemoveCondition = (conditionId) => {
    const updatedConditions = data.conditions.filter(cond => cond.id !== conditionId);
    handleInputChange('conditions', updatedConditions);
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
  
  const handleUpdateEffect = (effectId, field, value) => {
    const updatedEffects = data.effects.map(eff =>
      eff.id === effectId ? { ...eff, [field]: value } : eff
    );
    handleInputChange('effects', updatedEffects);
  };
  
  const handleRemoveEffect = (effectId) => {
    const updatedEffects = data.effects.filter(eff => eff.id !== effectId);
    handleInputChange('effects', updatedEffects);
  };
  
  // 处理叠加图片文件选择
  const handleOverlayImageSelect = () => {
    overlayImageInputRef.current?.click();
  };
  
  const handleOverlayImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleInputChange('overlayImage', file.name);
      
      // 创建本地预览
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      
      // 读取为 base64 保存到 store（实现跨组件同步）
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        updateNode(nodeId, {
          overlayImagePreview: base64  // 保存 base64 数据
        });
        console.log('[OptionNodeInspector] 成功保存叠加图片预览到 store');
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <div className={styles.inspectorContent}>
      {/* 隐藏的文件输入 */}
      <input
        ref={overlayImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleOverlayImageChange}
        style={{ display: 'none' }}
      />
      
      {/* 基本信息 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>基本信息</h3>
        <div className={styles.field}>
          <label>ID</label>
          <input type="text" value={data.id} readOnly className={styles.readonly} />
        </div>
        <div className={styles.field}>
          <label>选项文本</label>
          <input 
            type="text" 
            value={getInputValue('optionText') || ''}
            onChange={(e) => handleTextInputChange('optionText', e.target.value)}
            placeholder="输入选项文本"
          />
        </div>
        <div className={styles.field}>
          <label>描述</label>
          <input 
            type="text" 
            value={getInputValue('description') || ''}
            onChange={(e) => handleTextInputChange('description', e.target.value)}
            placeholder="输入描述"
          />
        </div>
        <div className={styles.field}>
          <label>出现时间</label>
          <input 
            type="text" 
            value={data.appearTime ?? 0}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseFloat(value);
              handleInputChange('appearTime', isNaN(numValue) ? value : numValue);
            }}
            placeholder="输入时间"
          />
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            提示: 设置为0或负数将使选项在视频开始时立即显示
          </div>
        </div>
      </div>
      
      {/* 显示设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>显示设置</h3>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.preDisplay || false}
            onChange={() => handleCheckboxChange('preDisplay')}
          />
          <span>提前显示</span>
        </label>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.showWhenConditionNotMet || false}
            onChange={() => handleCheckboxChange('showWhenConditionNotMet')}
          />
          <span>条件不满足时显示</span>
        </label>
        <div className={styles.field}>
          <label>不可用时提示信息</label>
          <input 
            type="text" 
            value={getInputValue('unavailableMessage')}
            onChange={(e) => handleTextInputChange('unavailableMessage', e.target.value)}
            placeholder="输入提示信息"
          />
        </div>
      </div>
      
      {/* 叠加图片选项 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>叠加图片选项</h3>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.enableOverlayImage !== false}
            onChange={() => handleCheckboxChange('enableOverlayImage')}
          />
          <span>启用叠加图片选项</span>
        </label>
        
        {data.enableOverlayImage !== false && (
          <>
            {/* 图片预览 */}
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
            
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={data.optionClickable || false}
                onChange={() => handleCheckboxChange('optionClickable')}
              />
              <span>选项可点击</span>
            </label>
            <div className={styles.field}>
              <label>层级索引</label>
              <input 
                type="text" 
                value={data.layerIndex || 0}
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = parseFloat(value);
                  handleInputChange('layerIndex', isNaN(numValue) ? value : numValue);
                }}
                placeholder="输入层级索引"
              />
            </div>
            <div className={styles.field}>
              <label>叠加图片</label>
              <div className={styles.fileInput}>
                <input type="text" value={data.overlayImage || '无 (精灵)'} readOnly />
                <button onClick={handleOverlayImageSelect} type="button">📁</button>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 广告设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>广告设置</h3>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.requiresAd || false}
            onChange={() => handleCheckboxChange('requiresAd')}
          />
          <span>需要播放广告</span>
        </label>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.isRewardedVideo || false}
            onChange={() => handleCheckboxChange('isRewardedVideo')}
          />
          <span>是否为激励视频</span>
        </label>
      </div>
      
      {/* 条件判断 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>条件判断</h3>
        <button className={styles.addBtn} onClick={handleAddCondition}>
          添加条件
        </button>
        {data.conditions && data.conditions.length > 0 && (
          <div className={styles.listContainer}>
            {data.conditions.map((condition) => (
              <div key={condition.id} style={{ marginBottom: '15px' }}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={condition.useComplexExpression || false}
                    onChange={(e) => handleUpdateCondition(condition.id, 'useComplexExpression', e.target.checked)}
                  />
                  <span>使用复杂表达式</span>
                </label>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>支持数学运算,如:(变量A+变量B)*4</div>
                <div className={styles.listItem}>
                  <input 
                    type="text" 
                    value={condition.leftValue || ''}
                    onChange={(e) => handleUpdateCondition(condition.id, 'leftValue', e.target.value)}
                    placeholder={condition.useComplexExpression ? "表达式" : "变量"}
                    style={{ flex: '1 1 0', minWidth: '50px' }}
                  />
                  <select 
                    value={condition.operator || 'Equals'}
                    onChange={(e) => handleUpdateCondition(condition.id, 'operator', e.target.value)}
                    style={{ flex: '0 0 auto', minWidth: '90px', maxWidth: '120px' }}
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
                    placeholder={condition.useComplexExpression ? "比较值" : "值"}
                    style={{ flex: '1 1 0', minWidth: '50px' }}
                  />
                  <button 
                    className={styles.removeButton}
                    onClick={() => handleRemoveCondition(condition.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 变量效果 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>变量效果</h3>
        <button className={styles.addBtn} onClick={handleAddEffect}>
          添加效果
        </button>
        {data.effects && data.effects.length > 0 && (
          <div className={styles.listContainer}>
            {data.effects.map((effect) => (
              <div key={effect.id} className={styles.listItem}>
                <input 
                  type="text" 
                  value={effect.variableName || ''}
                  onChange={(e) => handleUpdateEffect(effect.id, 'variableName', e.target.value)}
                  placeholder="变量"
                  style={{ flex: '1 1 0', minWidth: '50px' }}
                />
                <select 
                  value={effect.operation || 'Set'}
                  onChange={(e) => handleUpdateEffect(effect.id, 'operation', e.target.value)}
                  style={{ flex: '0 0 auto', minWidth: '75px', maxWidth: '100px' }}
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
                  style={{ flex: '1 1 0', minWidth: '50px' }}
                />
                <button 
                  className={styles.removeButton}
                  onClick={() => handleRemoveEffect(effect.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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

