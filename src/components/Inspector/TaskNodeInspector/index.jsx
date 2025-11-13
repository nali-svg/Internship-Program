import React, { useState, useEffect, useCallback } from 'react';
import styles from '../index.module.scss';
import useFlowStore from '../../../store/flowStore';

/**
 * 任务节点 Inspector 组件
 * 用于在右侧面板中编辑任务节点的详细属性
 */
export default function TaskNodeInspector({ nodeId, data }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});
  
  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['taskListInput'];
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

      {/* 任务设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>任务设置</h3>
        
        <div className={styles.field}>
          <label>最大显示数量</label>
          <input 
            type="number" 
            value={data.maxDisplayCount ?? 3}
            onChange={(e) => handleInputChange('maxDisplayCount', parseInt(e.target.value) || 0)}
          />
        </div>

        <div className={styles.field}>
          <label>任务列表输入</label>
          <textarea 
            value={getInputValue('taskListInput') || ''}
            onChange={(e) => handleTextInputChange('taskListInput', e.target.value)}
            placeholder="输入任务列表"
            rows="4"
            style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
          />
        </div>

        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          background: '#f5f5f5', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{ marginBottom: '5px', fontWeight: '500' }}>
            格式: 任务名:《条件》:&lt;奖励&gt;;任务名2:《条件2》:&lt;奖励2&gt;;
          </div>
          <div style={{ color: '#999' }}>
            示例: 收集金币:《金币&gt;100》:&lt;体力+=10&gt;;打败敌人:《敌人击败数&gt;=5》:&lt;经验值+=50&gt;;
          </div>
        </div>
      </div>
    </div>
  );
}

