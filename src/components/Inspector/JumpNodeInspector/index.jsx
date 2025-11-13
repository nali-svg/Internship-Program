import React, { useState, useEffect, useCallback } from 'react';
import styles from '../index.module.scss';
import useFlowStore from '../../../store/flowStore';

/**
 * 跳转节点 Inspector 组件
 * 用于在右侧面板中编辑跳转节点的详细属性
 */
export default function JumpNodeInspector({ nodeId, data }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});
  
  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['jumpPointId', 'jumpPointDesc'];
    setLocalInputs(prev => {
      const newInputs = {};
      textFields.forEach(field => {
        newInputs[field] = data[field] ?? '';
      });
      return newInputs;
    });
  }, [nodeId, data]);
  
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

  return (
    <div className={styles.inspectorContent}>
      {/* 基本信息 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>基本信息</h3>
        <div className={styles.field}>
          <label>ID</label>
          <input type="text" value={data.id} readOnly className={styles.readonly} />
        </div>
      </div>

      {/* 跳转设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>跳转设置</h3>
        
        <div className={styles.field}>
          <label>跳转点ID</label>
          <input 
            type="text" 
            value={getInputValue('jumpPointId') || ''}
            onChange={(e) => handleTextInputChange('jumpPointId', e.target.value)}
            placeholder="输入跳转点ID"
          />
        </div>

        <div className={styles.field}>
          <label>跳转点描述</label>
          <input 
            type="text" 
            value={getInputValue('jumpPointDesc') || ''}
            onChange={(e) => handleTextInputChange('jumpPointDesc', e.target.value)}
            placeholder="输入跳转点描述"
          />
        </div>

        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.jumpPointActive || false} 
            onChange={() => handleCheckboxChange('jumpPointActive')} 
          />
          <span>跳转点激活</span>
        </label>
      </div>
    </div>
  );
}

