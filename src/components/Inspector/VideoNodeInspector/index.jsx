import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import styles from '../index.module.scss';
import useFlowStore from '../../../store/flowStore';
import { createDefaultVariable } from '../../../utils/variableHelper';

/**
 * VideoNode 专用的 Inspector 面板
 */
export default function VideoNodeInspector({ nodeId, data }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  
  // 本地输入状态
  const [localInputs, setLocalInputs] = useState({});
  
  // 字幕选中状态
  const [selectedSubtitleIds, setSelectedSubtitleIds] = useState([]);
  
  // 视频预览相关状态
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  
  // 文件输入引用
  const videoFileInputRef = useRef(null);
  const thumbnailFileInputRef = useRef(null);
  const audioFileInputRef = useRef(null);
  const memoryCoverInputRef = useRef(null);
  const dialogueAudioInputRef = useRef(null);
  
  // 初始化本地状态
  useEffect(() => {
    const textFields = ['nodeName', 'conditionDesc', 'achievementName', 'variableName', 'fillColor', 'statsKeyPoint', 'jumpPointId', 'jumpPointDesc', 'defaultValue', 'memoryId', 'memoryName', 'memoryDescription', 'dialogueText', 'typingSpeed', 'probabilityExpression'];
    setLocalInputs(prev => {
      const newInputs = {};
      textFields.forEach(field => {
        if (data[field] !== undefined) {
          newInputs[field] = data[field] || '';
        }
      });
      return newInputs;
    });
  }, [nodeId, data]);
  
  // 同步外部的 videoThumbnail（从 VideoNode 或其他来源）
  useEffect(() => {
    if (data.videoThumbnail && data.videoThumbnail !== videoThumbnail) {
      setVideoThumbnail(data.videoThumbnail);
      console.log('[VideoNodeInspector] 从 data 同步视频缩略图');
    }
  }, [data.videoThumbnail, videoThumbnail]);
  
  // 同步外部的 videoObjectUrl
  useEffect(() => {
    if (data.videoObjectUrl && data.videoObjectUrl !== videoObjectUrl) {
      setVideoObjectUrl(data.videoObjectUrl);
      console.log('[VideoNodeInspector] 从 data 同步 videoObjectUrl');
    }
  }, [data.videoObjectUrl, videoObjectUrl]);

  useEffect(() => () => {
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
  }, [videoObjectUrl]);
  
  // 处理输入变化
  const handleInputChange = useCallback((field, value) => {
    updateNode(nodeId, { [field]: value });
  }, [nodeId, updateNode]);
  
  // 处理文本输入变化
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
  
  // 提取视频第一帧作为缩略图
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
          console.warn('[VideoNodeInspector] 视频尺寸无效，无法捕获帧');
          cleanup();
          return reject(new Error('视频尺寸无效'));
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const thumbnail = canvas.toDataURL('image/jpeg', 0.9);
        
        console.log('[VideoNodeInspector] 成功捕获缩略图:', {
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
        console.log('[VideoNodeInspector] 视频元数据加载完成:', {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        });
        
        // 跳到视频中间的某一帧以避开黑屏
        const seekTime = video.duration > 1 ? 1.0 : (video.duration > 0.5 ? 0.5 : 0.1);
        video.currentTime = seekTime;
      };
      
      video.onseeked = () => {
        console.log('[VideoNodeInspector] 视频已 seek 到', video.currentTime, '秒');
        
        // 使用 requestAnimationFrame 确保帧已渲染
        requestAnimationFrame(() => {
          // 检查 readyState
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA
            captureFrame();
          } else {
            console.warn('[VideoNodeInspector] readyState 不足，等待 100ms 后再试');
            timeoutId = setTimeout(captureFrame, 100);
          }
        });
      };
      
      video.onerror = (e) => {
        console.error('[VideoNodeInspector] 视频加载错误:', e);
        cleanup();
        reject(new Error('视频加载失败'));
      };
      
      // 超时处理（15秒）
      timeoutId = setTimeout(() => {
        console.error('[VideoNodeInspector] 提取缩略图超时 (15秒)');
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
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

    updateNode(nodeId, {
      videoFile: fileName,
      nodeName: fileNameWithoutExt,
    });

    setLocalInputs(prev => ({
      ...prev,
      nodeName: fileNameWithoutExt,
    }));

    try {
      const { thumbnail, objectUrl } = await extractVideoThumbnail(file);
      setVideoThumbnail(thumbnail);
      if (videoObjectUrl && videoObjectUrl !== objectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
      setVideoObjectUrl(objectUrl);
      updateNode(nodeId, {
        videoThumbnail: thumbnail,
        videoObjectUrl: objectUrl,
      });
    } catch (error) {
      console.error('[VideoNodeInspector] 提取视频缩略图失败:', error);
    }
  }, [extractVideoThumbnail, nodeId, updateNode, videoObjectUrl]);

  const handleVideoFileSelect = async () => {
    videoFileInputRef.current?.click();
  };
  const handleThumbnailFileSelect = () => thumbnailFileInputRef.current?.click();
  const handleAudioFileSelect = (subtitleId) => {
    if (audioFileInputRef.current) {
      audioFileInputRef.current.dataset.subtitleId = subtitleId;
      audioFileInputRef.current.click();
    }
  };
  const handleMemoryCoverSelect = () => memoryCoverInputRef.current?.click();
  const handleDialogueAudioSelect = () => dialogueAudioInputRef.current?.click();
  
  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processSelectedVideoFile(file);
    }
  };
  
  const handleThumbnailFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleInputChange('thumbnail', file.name);
    }
  };
  
  const handleAudioFileChange = (e) => {
    const file = e.target.files?.[0];
    const subtitleId = audioFileInputRef.current?.dataset.subtitleId;
    if (file && subtitleId) {
      handleUpdateSubtitle(subtitleId, 'audioFile', file.name);
    }
  };

  const handleMemoryCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleInputChange('memoryCover', file.name);
    }
  };

  const handleDialogueAudioChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleInputChange('dialogueAudio', file.name);
    }
  };
  
  // 条件和效果处理
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
      value: '', 
      style: 'Accumulative' 
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
  
  // 字幕处理
  const handleAddSubtitle = () => {
    const newSubtitles = [...(data.subtitles || []), {
      id: Date.now(),
      startTime: 0,
      duration: 3,
      text: '新字幕',
      audioFile: '无 (音频剪辑)',
      autoNext: false,
      allowSkip: true
    }];
    handleInputChange('subtitles', newSubtitles);
  };
  
  const handleSelectSubtitle = (subtitleId) => {
    setSelectedSubtitleIds(prev =>
      prev.includes(subtitleId)
        ? prev.filter(id => id !== subtitleId)
        : [...prev, subtitleId]
    );
  };
  
  const handleUpdateSubtitle = (subtitleId, field, value) => {
    const updatedSubtitles = data.subtitles.map(sub =>
      sub.id === subtitleId ? { ...sub, [field]: value } : sub
    );
    handleInputChange('subtitles', updatedSubtitles);
  };
  
  const handleRemoveSubtitle = (subtitleId) => {
    const updatedSubtitles = data.subtitles.filter(sub => sub.id !== subtitleId);
    handleInputChange('subtitles', updatedSubtitles);
    setSelectedSubtitleIds(prev => prev.filter(id => id !== subtitleId));
  };
  
  return (
    <div className={styles.inspectorContent}>
      {/* 隐藏的文件输入 */}
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.ogg,.mov,.avi"
        onChange={handleVideoFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={thumbnailFileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        onChange={handleThumbnailFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        onChange={handleAudioFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={memoryCoverInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        onChange={handleMemoryCoverChange}
        style={{ display: 'none' }}
      />
      <input
        ref={dialogueAudioInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        onChange={handleDialogueAudioChange}
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
          <label>节点名称</label>
          <input 
            type="text" 
            value={getInputValue('nodeName')}
            onChange={(e) => handleTextInputChange('nodeName', e.target.value)}
            placeholder="输入节点名称"
          />
        </div>
        
        {/* 视频预览 */}
        {(videoThumbnail || data.videoThumbnail) && (
          <div className={styles.videoPreviewContainer}>
            <img 
              src={videoThumbnail || data.videoThumbnail} 
              alt="视频预览"
              className={styles.videoPreviewImage}
              onClick={() => setShowVideoPreview(true)}
              title="点击预览视频"
            />
          </div>
        )}
        
        <div className={styles.field}>
          <label>视频文件</label>
          <div className={styles.fileInput}>
            <input type="text" value={data.videoFile || '无 (视频剪辑)'} readOnly />
            <button onClick={handleVideoFileSelect} type="button">📁</button>
          </div>
        </div>
      </div>
      
      {/* 基本设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>基本设置</h3>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={data.isCheckpoint}
            onChange={() => handleCheckboxChange('isCheckpoint')}
          />
          <span>设为检查点</span>
        </label>
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
        <div className={styles.field}>
          <label>缩略图</label>
          <div className={styles.fileInput}>
            <input type="text" value={data.thumbnail || '无 (精灵)'} readOnly />
            <button onClick={handleThumbnailFileSelect} type="button">📁</button>
          </div>
        </div>
      </div>
      
      {/* 播放设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>播放设置</h3>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.autoPlayNext} onChange={() => handleCheckboxChange('autoPlayNext')} />
            <span>自动播放下一个节点</span>
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.loop} onChange={() => handleCheckboxChange('loop')} />
            <span>循环播放 (可与选项共存)</span>
          </label>
          <div className={styles.field}>
            <label>音量</label>
            <input 
              type="text" 
              value={data.volume}
              onChange={(e) => {
                const value = e.target.value;
                const numValue = parseFloat(value);
                handleInputChange('volume', isNaN(numValue) ? value : numValue);
              }}
              placeholder="输入音量"
            />
          </div>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.waitSubtitle} onChange={() => handleCheckboxChange('waitSubtitle')} />
            <span>等待字幕播放完成</span>
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.isEndpoint} onChange={() => handleCheckboxChange('isEndpoint')} />
            <span>设为终点节点</span>
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.isDeathPoint} onChange={() => handleCheckboxChange('isDeathPoint')} />
            <span>设为死亡点</span>
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.isBlackScreen} onChange={() => handleCheckboxChange('isBlackScreen')} />
            <span>设为黑屏视频节点</span>
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.isMemory} onChange={() => handleCheckboxChange('isMemory')} />
            <span>设为回忆节点</span>
          </label>
          {data.isMemory && (
            <div style={{ marginLeft: '20px', paddingLeft: '12px', borderLeft: '3px solid #9c27b0', marginTop: '8px', marginBottom: '12px' }}>
              <div className={styles.field}>
                <label>回忆ID</label>
                <input 
                  type="text" 
                  value={getInputValue('memoryId')}
                  onChange={(e) => handleTextInputChange('memoryId', e.target.value)}
                  placeholder="输入回忆ID"
                />
              </div>
              <div className={styles.field}>
                <label>回忆名称</label>
                <input 
                  type="text" 
                  value={getInputValue('memoryName')}
                  onChange={(e) => handleTextInputChange('memoryName', e.target.value)}
                  placeholder="输入回忆名称"
                />
              </div>
              <div className={styles.field}>
                <label>回忆说明</label>
                <textarea 
                  value={getInputValue('memoryDescription')}
                  onChange={(e) => handleTextInputChange('memoryDescription', e.target.value)}
                  placeholder="输入回忆说明"
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label>回忆封面</label>
                <div className={styles.fileInput}>
                  <input type="text" value={data.memoryCover || '无 (精灵)'} readOnly />
                  <button onClick={handleMemoryCoverSelect} type="button">📁</button>
                </div>
              </div>
            </div>
          )}
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={data.isDialogue} onChange={() => handleCheckboxChange('isDialogue')} />
            <span>设为对话节点</span>
          </label>
          {data.isDialogue && (
            <div style={{ marginLeft: '20px', paddingLeft: '12px', borderLeft: '3px solid #4caf50', marginTop: '8px', marginBottom: '12px' }}>
              <div className={styles.field}>
                <label>对话文本</label>
                <textarea 
                  value={getInputValue('dialogueText')}
                  onChange={(e) => handleTextInputChange('dialogueText', e.target.value)}
                  placeholder="输入对话文本"
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label>打字速度</label>
                <input 
                  type="text" 
                  value={getInputValue('typingSpeed')}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value);
                    handleTextInputChange('typingSpeed', value);
                    if (!isNaN(numValue)) {
                      handleInputChange('typingSpeed', numValue);
                    }
                  }}
                  placeholder="0.05"
                />
              </div>
              <div className={styles.field}>
                <label>对话音频</label>
                <div className={styles.fileInput}>
                  <input type="text" value={data.dialogueAudio || '无 (音频剪辑)'} readOnly />
                  <button onClick={handleDialogueAudioSelect} type="button">📁</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 条件判断 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>条件判断</h3>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.showConditionOnFail} onChange={() => handleCheckboxChange('showConditionOnFail')} />
          <span>条件不满足时显示</span>
        </label>
        <div className={styles.field}>
          <label>条件描述</label>
          <input 
            type="text" 
            value={getInputValue('conditionDesc')}
            onChange={(e) => handleTextInputChange('conditionDesc', e.target.value)}
            placeholder="输入条件描述"
          />
        </div>
        <button className={styles.addBtn} onClick={handleAddCondition}>
          添加条件
        </button>
        {data.conditions && data.conditions.length > 0 && (
          <div className={styles.listContainer}>
            {data.conditions.map((condition) => (
              <div key={condition.id} className={styles.listItem}>
                <input 
                  type="text" 
                  value={condition.leftValue || ''}
                  onChange={(e) => handleUpdateCondition(condition.id, 'leftValue', e.target.value)}
                  placeholder="变量"
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
                  placeholder="值"
                  style={{ flex: '1 1 0', minWidth: '50px' }}
                />
                <button 
                  className={styles.removeButton}
                  onClick={() => handleRemoveCondition(condition.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 字幕编辑器 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>字幕编辑器</h3>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.showSubtitleEditor} onChange={() => handleCheckboxChange('showSubtitleEditor')} />
          <span>显示字幕编辑器</span>
        </label>
        {data.showSubtitleEditor && (
          <>
            <button className={styles.addBtn} onClick={handleAddSubtitle}>
              添加字幕
            </button>
            {data.subtitles && data.subtitles.length > 0 && (
              <div className={styles.subtitleList}>
                {data.subtitles.map((subtitle) => (
                  <div key={subtitle.id} className={styles.subtitleItem}>
                    <div className={styles.subtitleHeader}>
                      <label className={styles.checkboxLabel}>
                        <input 
                          type="checkbox" 
                          checked={selectedSubtitleIds.includes(subtitle.id)}
                          onChange={() => handleSelectSubtitle(subtitle.id)}
                        />
                        <span>{subtitle.text}</span>
                      </label>
                      <button 
                        className={styles.removeButton}
                        onClick={() => handleRemoveSubtitle(subtitle.id)}
                      >
                        删除
                      </button>
                    </div>
                    {selectedSubtitleIds.includes(subtitle.id) && (
                      <div className={styles.subtitleDetail}>
                        <div className={styles.field}>
                          <label>开始时间(秒)</label>
                          <input 
                            type="text"
                            value={subtitle.startTime}
                            onChange={(e) => {
                              const value = e.target.value;
                              const numValue = parseFloat(value);
                              handleUpdateSubtitle(subtitle.id, 'startTime', isNaN(numValue) ? value : numValue);
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div className={styles.field}>
                          <label>持续时间(秒)</label>
                          <input 
                            type="text"
                            value={subtitle.duration}
                            onChange={(e) => {
                              const value = e.target.value;
                              const numValue = parseFloat(value);
                              handleUpdateSubtitle(subtitle.id, 'duration', isNaN(numValue) ? value : numValue);
                            }}
                            placeholder="3"
                          />
                        </div>
                        <div className={styles.field}>
                          <label>字幕文本</label>
                          <textarea 
                            value={subtitle.text}
                            onChange={(e) => handleUpdateSubtitle(subtitle.id, 'text', e.target.value)}
                            placeholder="新字幕"
                            rows={3}
                          />
                        </div>
                        <div className={styles.field}>
                          <label>音频文件</label>
                          <div className={styles.fileInput}>
                            <input type="text" value={subtitle.audioFile} readOnly />
                            <button onClick={() => handleAudioFileSelect(subtitle.id)} type="button">📁</button>
                          </div>
                        </div>
                        <label className={styles.checkboxLabel}>
                          <input 
                            type="checkbox" 
                            checked={subtitle.autoNext}
                            onChange={(e) => handleUpdateSubtitle(subtitle.id, 'autoNext', e.target.checked)}
                          />
                          <span>自动进入下一条</span>
                        </label>
                        <label className={styles.checkboxLabel}>
                          <input 
                            type="checkbox" 
                            checked={subtitle.allowSkip}
                            onChange={(e) => handleUpdateSubtitle(subtitle.id, 'allowSkip', e.target.checked)}
                          />
                          <span>允许跳过</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
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
                <select 
                  value={effect.style || 'Accumulative'}
                  onChange={(e) => handleUpdateEffect(effect.id, 'style', e.target.value)}
                  style={{ flex: '0 0 auto', minWidth: '100px', maxWidth: '140px' }}
                >
                  <option value="ChapterConstant">ChapterConstant</option>
                  <option value="Accumulative">Accumulative</option>
                  <option value="Shop">Shop</option>
                  <option value="NULL">NULL</option>
                </select>
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
        <div className={styles.field}>
          <label>成就名称</label>
          <input 
            type="text" 
            value={getInputValue('achievementName')}
            onChange={(e) => handleTextInputChange('achievementName', e.target.value)}
            placeholder="输入成就名称"
            disabled={!data.unlockAchievement}
          />
        </div>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.unlockAchievement} onChange={() => handleCheckboxChange('unlockAchievement')} />
          <span>经过该节点时解锁成就</span>
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.isRandomNode} onChange={() => handleCheckboxChange('isRandomNode')} />
          <span>随机节点</span>
        </label>
        {data.isRandomNode && (
          <div className={styles.field}>
            <label>概率表达式</label>
            <input 
              type="text" 
              value={getInputValue('probabilityExpression')}
              onChange={(e) => handleTextInputChange('probabilityExpression', e.target.value)}
              placeholder="输入概率表达式"
            />
          </div>
        )}
      </div>
      
      {/* 变量条设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>变量条设置</h3>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.showVariableBar} onChange={() => handleCheckboxChange('showVariableBar')} />
          <span>显示变量条</span>
        </label>
        <div className={styles.field}>
          <label>变量名</label>
          <input 
            type="text" 
            value={getInputValue('variableName')}
            onChange={(e) => handleTextInputChange('variableName', e.target.value)}
            placeholder="输入变量名"
            disabled={!data.showVariableBar}
          />
        </div>
        <div className={styles.field}>
          <label>默认值</label>
          <input 
            type="text" 
            value={getInputValue('defaultValue')}
            onChange={(e) => {
              const value = e.target.value;
              handleTextInputChange('defaultValue', value);
              // 尝试转换为数值
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                handleInputChange('defaultValue', numValue);
              }
            }}
            disabled={!data.showVariableBar}
            placeholder="输入数值"
          />
        </div>
        <div className={styles.field}>
          <label>填充颜色 (#RRGGBB)</label>
          <input 
            type="text" 
            value={getInputValue('fillColor')}
            onChange={(e) => handleTextInputChange('fillColor', e.target.value)}
            disabled={!data.showVariableBar}
          />
        </div>
        <div className={styles.field}>
          <label>显示位置</label>
          <select 
            value={data.barPosition}
            onChange={(e) => handleInputChange('barPosition', e.target.value)}
            disabled={!data.showVariableBar}
          >
            <option>上</option>
            <option>下</option>
          </select>
        </div>
      </div>
      
      {/* 数据统计设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>数据统计设置</h3>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.enableStats} onChange={() => handleCheckboxChange('enableStats')} />
          <span>启用数据统计</span>
        </label>
        <div className={styles.field}>
          <label>数据统计关键点</label>
          <input 
            type="text" 
            value={getInputValue('statsKeyPoint') || ''}
            onChange={(e) => handleTextInputChange('statsKeyPoint', e.target.value)}
            disabled={!data.enableStats}
            placeholder="默认关键点"
          />
        </div>
      </div>
      
      {/* 跳转点设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>跳转点设置</h3>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.isJumpPoint} onChange={() => handleCheckboxChange('isJumpPoint')} />
          <span>设为跳转点</span>
        </label>
        <div className={styles.field}>
          <label>跳转点ID</label>
          <input 
            type="text" 
            value={getInputValue('jumpPointId')}
            onChange={(e) => handleTextInputChange('jumpPointId', e.target.value)}
            placeholder="输入跳转点ID"
          />
        </div>
        <div className={styles.field}>
          <label>跳转点描述</label>
          <textarea 
            value={getInputValue('jumpPointDesc')}
            onChange={(e) => handleTextInputChange('jumpPointDesc', e.target.value)}
            placeholder="输入跳转点描述"
            rows="3"
          />
        </div>
      </div>
      
      {/* 带货设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>带货设置</h3>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={data.enableCommerce} onChange={() => handleCheckboxChange('enableCommerce')} />
          <span>启用带货功能</span>
        </label>
        
        {data.enableCommerce && (
          <>
            {/* 商品选择列表 */}
            <div className={styles.field}>
              <label>选择要展示的商品</label>
              <div className={styles.productList}>
                {/* 示例商品列表 - 实际应用中应该从store或其他数据源获取 */}
                {[
                  { id: '6216ba3d-af04-4d6f-a595-aa8adda4e385', name: '琉璃在床上' },
                  { id: '9673234d-61fb-47f8-8790-a6d7bed49cad', name: '琉璃床上写真' },
                  { id: '868bb8ad-5ce0-46f3-a4f5-e3e0aeafc81a', name: '莉莉丝床上写真' },
                  { id: 'b82a7ab8-23db-4bef-bcb4-b6ca0f80f2f8', name: '薇薇安床上写真' },
                  { id: 'eb3a56b3-e64b-412c-8d03-b1aa0eb46860', name: '幻想-伊莎贝拉' }
                ].map((product) => (
                  <label key={product.id} className={styles.productItem}>
                    <input
                      type="checkbox"
                      checked={(data.showcaseProductIds || []).includes(product.id)}
                      onChange={(e) => {
                        const currentIds = data.showcaseProductIds || [];
                        const newIds = e.target.checked
                          ? [...currentIds, product.id]
                          : currentIds.filter(id => id !== product.id);
                        handleInputChange('showcaseProductIds', newIds);
                      }}
                      disabled={!data.enableCommerce}
                    />
                    <span>{product.name} (ID: {product.id})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 展示时长 */}
            <div className={styles.field}>
              <label>展示时长（秒）</label>
              <input
                type="number"
                value={data.showcaseDisplayDuration || 10}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleInputChange('showcaseDisplayDuration', value);
                }}
                disabled={!data.enableCommerce}
                step="0.1"
                min="0"
              />
            </div>

            {/* 自动隐藏 */}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={data.showcaseAutoHide !== false}
                onChange={(e) => handleInputChange('showcaseAutoHide', e.target.checked)}
                disabled={!data.enableCommerce}
              />
              <span>自动隐藏</span>
            </label>

            {/* 显示位置 */}
            <div className={styles.field}>
              <label>显示位置（屏幕坐标0-1）</label>
              <div className={styles.inlineInputs}>
                <div className={styles.inlineField}>
                  <label>X</label>
                  <input
                    type="number"
                    value={data.showcasePosition?.x || 0.1}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleInputChange('showcasePosition', {
                        ...(data.showcasePosition || { x: 0.1, y: 0.9 }),
                        x: value
                      });
                    }}
                    disabled={!data.enableCommerce}
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
                <div className={styles.inlineField}>
                  <label>Y</label>
                  <input
                    type="number"
                    value={data.showcasePosition?.y || 0.9}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleInputChange('showcasePosition', {
                        ...(data.showcasePosition || { x: 0.1, y: 0.9 }),
                        y: value
                      });
                    }}
                    disabled={!data.enableCommerce}
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
              </div>
            </div>

            {/* 显示大小 */}
            <div className={styles.field}>
              <label>显示大小（屏幕比例）</label>
              <div className={styles.inlineInputs}>
                <div className={styles.inlineField}>
                  <label>X</label>
                  <input
                    type="number"
                    value={data.showcaseSize?.x || 0.3}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleInputChange('showcaseSize', {
                        ...(data.showcaseSize || { x: 0.3, y: 0.2 }),
                        x: value
                      });
                    }}
                    disabled={!data.enableCommerce}
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
                <div className={styles.inlineField}>
                  <label>Y</label>
                  <input
                    type="number"
                    value={data.showcaseSize?.y || 0.2}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleInputChange('showcaseSize', {
                        ...(data.showcaseSize || { x: 0.3, y: 0.2 }),
                        y: value
                      });
                    }}
                    disabled={!data.enableCommerce}
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
              </div>
            </div>

            {/* 只显示未购买的商品 */}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={data.showcaseOnlyShowUnpurchased !== false}
                onChange={(e) => handleInputChange('showcaseOnlyShowUnpurchased', e.target.checked)}
                disabled={!data.enableCommerce}
              />
              <span>只显示未购买的商品</span>
            </label>

            {/* 全部购买则隐藏 */}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={data.showcaseHideIfAllPurchased !== false}
                onChange={(e) => handleInputChange('showcaseHideIfAllPurchased', e.target.checked)}
                disabled={!data.enableCommerce}
              />
              <span>全部购买则隐藏</span>
            </label>

            {/* 启用滚动动画 */}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={data.showcaseEnableScrollAnimation !== false}
                onChange={(e) => handleInputChange('showcaseEnableScrollAnimation', e.target.checked)}
                disabled={!data.enableCommerce}
              />
              <span>启用滚动动画</span>
            </label>
          </>
        )}
      </div>
      
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
        {(videoObjectUrl || data.videoObjectUrl) ? (
          <video
            src={videoObjectUrl || data.videoObjectUrl}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '70vh' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            {(videoThumbnail || data.videoThumbnail) && (
              <img 
                src={videoThumbnail || data.videoThumbnail} 
                alt="视频缩略图"
                style={{ maxWidth: '100%', maxHeight: '50vh', marginBottom: '20px', borderRadius: '8px' }}
              />
            )}
            <p style={{ color: '#999', fontSize: '14px' }}>
              视频文件不可用，请重新选择视频文件以预览完整视频
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

