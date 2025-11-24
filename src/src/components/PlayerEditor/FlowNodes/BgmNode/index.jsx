import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * BGM节点组件
 * 用于配置背景音乐相关的参数
 */
export default function BgmNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 展开/收起状态
  const [isExpanded, setIsExpanded] = useState(data.isExpanded || false);
  
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});

  // 节点名称编辑状态
  const [isEditingNodeName, setIsEditingNodeName] = useState(false);
  const [editingNodeName, setEditingNodeName] = useState('');

  // 文件输入引用
  const audioFileInputRef = useRef(null);

  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['nodeName'];
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

  // 处理输入变化
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
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.card} ${selected ? styles.selected : ''} ${isExpanded ? styles.expanded : ''}`}
        tabIndex={0}
      >
        {/* 标题栏 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>BGM节点</h3>
            <span className={styles.nodeId}>ID:{data.id}</span>
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
        <div className={`${styles.content} no-drag`} onWheel={handleContentWheel}>
          {/* 基本信息区 */}
          <div className={styles.section}>
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
          </div>
        </div>
      </div>

      {/* 循环播放和自动淡出标签 */}
      {(data.loop || data.autoFadeOut) && (
        <div className={styles.optionTags}>
          {data.loop && (
            <div className={styles.optionTag}>
              循环播放
            </div>
          )}
          {data.autoFadeOut && (
            <div className={styles.optionTag}>
              自动淡出
            </div>
          )}
        </div>
      )}
    </div>
  );
}

