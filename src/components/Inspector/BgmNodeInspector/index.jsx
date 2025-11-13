import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../index.module.scss';
import useFlowStore from '../../../store/flowStore';

/**
 * BgmNode 专用的 Inspector 面板
 */
export default function BgmNodeInspector({ nodeId, data }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});
  
  // 文件输入引用
  const audioFileInputRef = useRef(null);

  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['volume', 'fadeInTime', 'fadeOutTime'];
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

  // 处理文本输入变化（只更新本地状态，不立即更新store）
  const handleTextInputChange = useCallback((field, value) => {
    setLocalInputs(prev => ({ ...prev, [field]: value }));
    updateNode(nodeId, { [field]: value });  // 实时同步到 store
  }, [nodeId, updateNode]);

  // 获取输入框的值（优先使用本地状态）
  const getInputValue = useCallback((field) => {
    return localInputs[field] !== undefined ? localInputs[field] : (data[field] ?? '');
  }, [localInputs, data]);

  // 处理复选框变化
  const handleCheckboxChange = (field) => {
    updateNode(nodeId, { [field]: !data[field] });
  };

  // 处理音频文件选择
  const handleAudioFileSelect = () => {
    audioFileInputRef.current?.click();
  };

  // 处理音频文件变化
  const handleAudioFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name;
      handleInputChange('audioFile', fileName);
    }
  };

  return (
    <div className={styles.inspectorContent}>
      {/* 隐藏的文件输入 */}
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        onChange={handleAudioFileChange}
        style={{ display: 'none' }}
      />

      {/* 基本信息 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>基本信息</h3>
        
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
          <label>音频文件</label>
          <div className={styles.fileInputGroup}>
            <input 
              type="text" 
              value={data.audioFile || '♫ 无 (音频剪辑)'} 
              readOnly 
              className={styles.fileDisplay}
            />
            <button 
              className={styles.fileButton}
              onClick={handleAudioFileSelect}
              type="button"
            >
              📁
            </button>
          </div>
        </div>
      </div>

      {/* 播放设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>播放设置</h3>
        
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.loop || false} 
            onChange={() => handleCheckboxChange('loop')} 
          />
          <span>循环播放</span>
        </label>

        <div className={styles.field}>
          <label>音量</label>
          <input 
            type="text" 
            value={getInputValue('volume')}
            onChange={(e) => handleTextInputChange('volume', e.target.value)}
            placeholder="0-1"
          />
          <div className={styles.hint}>取值范围：0（静音）到 1（最大音量）</div>
        </div>
      </div>

      {/* 淡入淡出设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>淡入淡出设置</h3>
        
        <div className={styles.field}>
          <label>淡入时间（秒）</label>
          <input 
            type="text" 
            value={getInputValue('fadeInTime')}
            onChange={(e) => handleTextInputChange('fadeInTime', e.target.value)}
            placeholder="0"
          />
        </div>

        <div className={styles.field}>
          <label>淡出时间（秒）</label>
          <input 
            type="text" 
            value={getInputValue('fadeOutTime')}
            onChange={(e) => handleTextInputChange('fadeOutTime', e.target.value)}
            placeholder="0"
          />
        </div>

        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.autoFadeOut || false} 
            onChange={() => handleCheckboxChange('autoFadeOut')} 
          />
          <span>自动淡出</span>
        </label>
      </div>
    </div>
  );
}

