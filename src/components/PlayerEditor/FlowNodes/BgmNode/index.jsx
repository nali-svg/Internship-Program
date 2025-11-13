import React, { useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * BGM节点组件
 * 用于配置背景音乐相关的参数
 */
export default function BgmNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 文件输入引用
  const audioFileInputRef = useRef(null);

  // 处理输入变化
  const handleInputChange = (field, value) => {
    updateNode(id, { [field]: value });
  };

  // 处理复选框变化
  const handleCheckboxChange = (field) => {
    updateNode(id, { [field]: !data[field] });
  };

  // 处理卡片内容区的滚轮事件，阻止冒泡到画布
  const handleContentWheel = (e) => {
    e.stopPropagation();
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
      
      // 如果需要预览或使用音频，可以创建 Object URL
      // const objectUrl = URL.createObjectURL(file);
      // handleInputChange('audioFileUrl', objectUrl);
    }
  };

  return (
    <div 
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      tabIndex={0}
    >
      {/* 标题栏 */}
      <div className={styles.header}>
        <h3 className={styles.title}>🎵 BGM节点</h3>
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
        <div className={`${styles.tab} ${styles.inputTab} ${styles.active}`}>
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
            <label>ID</label>
            <input type="text" value={data.id} readOnly className={styles.readonly} />
          </div>
          
          <div className={styles.field}>
            <label>音频文件</label>
            <div className={styles.fileInput}>
              <input type="text" value={data.audioFile || '♫ 无 (音频剪辑)'} readOnly />
              <button 
                className={`${styles.iconBtn} no-drag`}
                onClick={handleAudioFileSelect}
                type="button"
              >
                📁
              </button>
            </div>
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              onChange={handleAudioFileChange}
              style={{ display: 'none' }}
              className="no-drag"
            />
          </div>

          <div className={styles.checkboxGroup}>
            <label>
              <input 
                type="checkbox" 
                checked={data.loop || false} 
                onChange={() => handleCheckboxChange('loop')} 
              />
              <span>循环播放</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

