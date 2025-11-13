import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Modal } from 'antd';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';
import { createDefaultVariable } from '../../../../utils/variableHelper';

/**
 * 视频节点组件 - 基于原有 DraggableCard 设计
 * 添加了 React Flow 的输入输出端口
 */
export default function VideoNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  const startNodeId = useFlowStore((state) => state.startNodeId);
  
  
  // 字幕选中状态（支持多选）
  const [selectedSubtitleIds, setSelectedSubtitleIds] = useState([]);
  
  // 视频预览相关状态
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  const effectiveVideoUrl = videoObjectUrl || data.videoObjectUrl || null;
  const hasVideoPreview = !!effectiveVideoUrl;
  const hasThumbnailPreview = !!(videoThumbnail || data.videoThumbnail);
 
  // 本地输入状态，用于文本输入框（避免频繁更新store导致失去焦点）
  const [localInputs, setLocalInputs] = useState({});
  
  // 当外部data变化时，同步本地状态
  useEffect(() => {
    const textFields = ['nodeName', 'conditionDesc', 'achievementName', 'variableName', 'fillColor', 'statsKeyPoint', 'jumpPointId', 'jumpPointDesc', 'defaultValue'];
    setLocalInputs(prev => {
      const newInputs = { ...prev };
      // 同步所有字段的值，确保外部更新能够反映到界面
      textFields.forEach(field => {
        if (data[field] !== undefined) {
          // 如果外部值与当前值不同，则更新（这样可以响应外部修改，如从 Inspector 上传视频）
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
  }, [data]);
  
  // 同步外部的 videoThumbnail（从 Inspector 或其他来源）
  useEffect(() => {
    if (data.videoThumbnail && data.videoThumbnail !== videoThumbnail) {
      setVideoThumbnail(data.videoThumbnail);
      console.log('[VideoNode] 从 data 同步视频缩略图');
    }
  }, [data.videoThumbnail, videoThumbnail]);

  // 同步外部的 videoObjectUrl（例如 Inspector 选择文件）
  useEffect(() => {
    if (data.videoObjectUrl) {
      if (data.videoObjectUrl !== videoObjectUrl) {
        setVideoObjectUrl(data.videoObjectUrl);
      }
    } else if (videoObjectUrl) {
      setVideoObjectUrl(null);
    }
  }, [data.videoObjectUrl, videoObjectUrl]);
  
  // 文件输入引用
  const videoFileInputRef = useRef(null);
  const audioFileInputRef = useRef(null);
  
  // 处理输入变化（立即更新store，用于非文本输入）
  const handleInputChange = (field, value) => {
    updateNode(id, { [field]: value });
  };
  
  // 处理文本输入变化（只更新本地状态，不立即更新store）
  const handleTextInputChange = useCallback((field, value) => {
    // 只更新本地状态，不触发store更新
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

  // 处理复选框变化
  const handleCheckboxChange = (field) => {
    updateNode(id, { [field]: !data[field] });
  };


  // 处理卡片内容区的滚轮事件，阻止冒泡到画布
  const handleContentWheel = (e) => {
    e.stopPropagation();
  };

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

  // 添加条件
  const handleAddCondition = () => {
    // 如果变量管理器为空，自动创建一个新变量
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
    // 如果变量管理器为空，自动创建一个新变量
    let defaultVariableName = '';
    const variables = useFlowStore.getState().variables;
    if (variables.length === 0) {
      defaultVariableName = createDefaultVariable(useFlowStore);
    }
    
    const newEffects = [...(data.effects || []), { 
      id: Date.now(), 
      variableName: defaultVariableName, 
      operation: 'Set', 
      value: '',
      style: 'Accumulative'
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

  // 提取视频第一帧
  const extractVideoThumbnail = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 将视频元素临时添加到 DOM 中（隐藏）以确保正确渲染
      video.style.position = 'absolute';
      video.style.visibility = 'hidden';
      video.style.pointerEvents = 'none';
      video.style.left = '-9999px';
      video.preload = 'auto'; // 改为 auto 以确保加载足够的数据
      video.muted = true;
      video.playsInline = true;
      document.body.appendChild(video);
      
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      
      let timeoutId;
      
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        // 不在这里释放 objectUrl，因为需要用于视频播放
      };
      
      const captureFrame = () => {
        if (!video.videoWidth || !video.videoHeight) {
          console.warn('[VideoNode] 视频尺寸无效，无法捕获帧');
          cleanup();
          return reject(new Error('视频尺寸无效'));
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const thumbnail = canvas.toDataURL('image/jpeg', 0.9);
        
        console.log('[VideoNode] 成功捕获缩略图:', {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          currentTime: video.currentTime,
          thumbnailLength: thumbnail.length
        });
        
        cleanup();
        resolve({ thumbnail, objectUrl });
      };
      
      video.onloadedmetadata = () => {
        console.log('[VideoNode] 视频元数据加载完成:', {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        });
        
        // 跳到视频中间的某一帧以避开黑屏
        const seekTime = video.duration > 1 ? 1.0 : (video.duration > 0.5 ? 0.5 : 0.1);
        video.currentTime = seekTime;
      };
      
      video.onseeked = () => {
        console.log('[VideoNode] 视频已 seek 到', video.currentTime, '秒');
        
        // 使用 requestAnimationFrame 确保帧已渲染
        requestAnimationFrame(() => {
          // 检查 readyState
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA
            captureFrame();
          } else {
            console.warn('[VideoNode] readyState 不足，等待 100ms 后再试');
            timeoutId = setTimeout(captureFrame, 100);
          }
        });
      };
      
      video.onerror = (e) => {
        console.error('[VideoNode] 视频加载错误:', e);
        cleanup();
        reject(new Error('视频加载失败'));
      };
      
      // 超时处理（15秒）
      timeoutId = setTimeout(() => {
        console.error('[VideoNode] 提取缩略图超时 (15秒)');
        cleanup();
        reject(new Error('提取缩略图超时'));
      }, 15000);
    });
  }, []);

  const processSelectedVideoFile = useCallback(async (file) => {
    if (!file) {
      return;
    }

    const fileName = file.name;
    handleInputChange('videoFile', fileName);

    const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    handleInputChange('nodeName', fileNameWithoutExt);
    setLocalInputs(prev => ({ ...prev, nodeName: fileNameWithoutExt }));

    try {
      const { thumbnail, objectUrl } = await extractVideoThumbnail(file);
      setVideoThumbnail(thumbnail);
      if (videoObjectUrl && videoObjectUrl !== objectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
      setVideoObjectUrl(objectUrl);
      handleInputChange('videoThumbnail', thumbnail);
      handleInputChange('videoObjectUrl', objectUrl);
    } catch (error) {
      console.error('[VideoNode] 提取视频缩略图失败:', error);
    }
  }, [extractVideoThumbnail, handleInputChange, setLocalInputs, videoObjectUrl]);

  const handleVideoFileSelect = () => {
    videoFileInputRef.current?.click();
  };

  // 处理视频文件变化
  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processSelectedVideoFile(file);
    }
  };

  // 添加字幕
  const handleAddSubtitle = () => {
    const newSubtitles = [...(data.subtitles || []), {
      id: Date.now(),
      startTime: 0,
      duration: 3,
      text: '新字幕',
      audioFile: '无(音频剪辑)',
      autoNext: true,
      allowSkip: true
    }];
    handleInputChange('subtitles', newSubtitles);
  };

  // 删除字幕
  const handleRemoveSubtitle = (subtitleId) => {
    const newSubtitles = (data.subtitles || []).filter(sub => sub.id !== subtitleId);
    handleInputChange('subtitles', newSubtitles);
    // 从选中列表中移除被删除的字幕
    setSelectedSubtitleIds((prevIds) => prevIds.filter((id) => id !== subtitleId));
  };

  // 更新字幕
  const handleUpdateSubtitle = (subtitleId, field, value) => {
    const newSubtitles = (data.subtitles || []).map(sub =>
      sub.id === subtitleId ? { ...sub, [field]: value } : sub
    );
    handleInputChange('subtitles', newSubtitles);
  };

  // 选中字幕（支持多选）
  const handleSelectSubtitle = (subtitleId) => {
    setSelectedSubtitleIds((prevIds) => {
      if (prevIds.includes(subtitleId)) {
        // 如果已选中，则移除
        return prevIds.filter((id) => id !== subtitleId);
      } else {
        // 如果未选中，则添加
        return [...prevIds, subtitleId];
      }
    });
  };

  // 音频文件选择
  const handleAudioFileSelect = (subtitleId) => {
    if (audioFileInputRef.current) {
      audioFileInputRef.current.dataset.subtitleId = subtitleId;
      audioFileInputRef.current.click();
    }
  };

  // 处理音频文件变化
  const handleAudioFileChange = (e) => {
    const file = e.target.files?.[0];
    const subtitleId = parseInt(e.target.dataset.subtitleId);
    if (file && subtitleId) {
      handleUpdateSubtitle(subtitleId, 'audioFile', file.name);
    }
  };

  useEffect(() => () => {
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
  }, [videoObjectUrl]);

  return (
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.card} ${selected ? styles.selected : ''} ${hasVideoPreview ? styles.cardHasVideo : ''}`}
        tabIndex={0}
      >
        {/* 卡片头部 */}
        <div className={styles.header}>
          <h3 className={styles.title}>🎬 视频节点</h3>
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={!!data.isCheckpoint}
              onChange={() => handleCheckboxChange('isCheckpoint')}
              className="no-drag"
            />
            <span>设为检查点</span>
          </label>
        </div>

        {/* 输入输出标签 */}
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

        {/* 视频预览 - 顶部位置 */}
        {(hasVideoPreview || hasThumbnailPreview) && (
          <div
            className={styles.videoPreviewContainer}
            onClick={() => {
              if (hasVideoPreview) {
                setShowVideoPreview(true);
              }
            }}
            role="button"
            tabIndex={hasVideoPreview ? 0 : -1}
            onKeyDown={(event) => {
              if (hasVideoPreview && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                setShowVideoPreview(true);
              }
            }}
            title={hasVideoPreview ? '点击播放视频' : '未找到可播放的视频，点击右侧图标选择文件'}
          >
            {hasThumbnailPreview && (
              <img
                src={videoThumbnail || data.videoThumbnail}
                alt="视频缩略图"
                className={styles.videoPreviewImage}
              />
            )}
            {!hasThumbnailPreview && hasVideoPreview && (
              <div className={styles.videoPreviewPlaceholder}>点击查看视频预览</div>
            )}
            {!hasVideoPreview && !hasThumbnailPreview && (
              <div className={styles.videoPreviewPlaceholder}>未加载本地视频</div>
            )}
          </div>
        )}

        {/* 主内容区 - 可滚动 */}
        <div className={`${styles.content} no-drag`} onWheel={handleContentWheel}>
        {/* 基本信息区 */}
        <div className={styles.section}>
          <div className={styles.field}>
            <label>ID</label>
            <input type="text" value={data.id} readOnly className={styles.readonly} />
          </div>
          
          <div className={styles.field}>
            <label>节点名称</label>
            <input 
              type="text" 
              value={getInputValue('nodeName')}
              onChange={(e) => handleTextInputChange('nodeName', e.target.value)}
              onBlur={() => handleTextInputBlur('nodeName')}
              placeholder="输入节点名称"
            />
          </div>

          <div className={styles.field}>
            <label>视频文件</label>
            <div className={styles.fileInput}>
              <input type="text" value={data.videoFile} readOnly />
              <button 
                className={`${styles.iconBtn} no-drag`}
                onClick={handleVideoFileSelect}
                type="button"
              >
                📁
              </button>
            </div>
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.ogg,.mov,.avi"
              onChange={handleVideoFileChange}
              style={{ display: 'none' }}
              className="no-drag"
            />
          </div>

          <div className={styles.field}>
            <label>显示类型</label>
            <select 
              value={data.displayType}
              onChange={(e) => handleInputChange('displayType', e.target.value)}
            >
              <option>Auto</option>
              <option>Image</option>
              <option>Video</option>
            </select>
          </div>

        </div>
        </div>
      </div>

      {((data.conditions && data.conditions.length > 0) || startNodeId === id) && (
        <div className={styles.conditionTags}>
          {startNodeId === id && (
            <div className={`${styles.conditionTag} ${styles.startTag}`}>
              起始节点
            </div>
          )}
          {(data.conditions || []).map((condition, index) => (
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

      {/* 视频预览模态框 */}
      <Modal
        title="视频预览"
        open={showVideoPreview}
        onCancel={() => setShowVideoPreview(false)}
        footer={null}
        width={800}
        centered
        destroyOnClose
      >
        {hasVideoPreview && (
          <video
            key={`modal-${effectiveVideoUrl}`}
            src={effectiveVideoUrl}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '70vh' }}
          />
        )}
      </Modal>
    </div>
  );
}
