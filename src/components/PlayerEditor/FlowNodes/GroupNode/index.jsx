import React, { useState, useEffect, useRef } from 'react';
import { useViewport } from '@xyflow/react';
import styles from './index.module.scss';
import useFlowStore from '../../../../store/flowStore';

/**
 * 分组节点组件（Group Node）
 * 用于作为子流程的父节点容器
 * 显示一个可见的矩形框来包含子节点
 * 子节点可以独立拖拽，父节点在空白区域可以拖拽
 */
export default function GroupNode({ id, data, selected }) {
  const updateNode = useFlowStore((state) => state.updateNode);
  const { zoom } = useViewport();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(16);

  // 当缩放小于0.5时，标题显示在矩形框内部
  const shouldShowTitleInside = zoom < 0.5;

  // 计算占满矩形框的字体大小
  useEffect(() => {
    if (shouldShowTitleInside && titleRef.current && containerRef.current) {
      // 使用 setTimeout 确保 DOM 已经更新
      const timer = setTimeout(() => {
        const container = containerRef.current;
        const titleElement = titleRef.current;
        if (!container || !titleElement) return;
        
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        if (containerWidth === 0 || containerHeight === 0) return;
        
        // 计算占满矩形框的字体大小
        const containerSize = Math.min(containerWidth, containerHeight);
        const text = titleElement.textContent || '';
        const textLength = text.length;
        
        // 保存原始样式
        const originalFontSize = titleElement.style.fontSize;
        const originalWidth = titleElement.style.width;
        const originalHeight = titleElement.style.height;
        const originalLineHeight = titleElement.style.lineHeight;
        
        // 临时设置样式来测量
        titleElement.style.width = '100%';
        titleElement.style.height = '100%';
        titleElement.style.lineHeight = '1.0';
        titleElement.style.display = 'flex';
        titleElement.style.alignItems = 'center';
        titleElement.style.justifyContent = 'center';
        
        // 使用二分查找找到最大的合适字体大小
        let minFontSize = Math.max(40, containerSize * 0.2);
        let maxFontSize = containerSize * 0.95;
        let optimalFontSize = minFontSize;
        
        const measureFontSize = (size) => {
          titleElement.style.fontSize = `${size}px`;
          void titleElement.offsetWidth;
          void titleElement.offsetHeight;
          const textWidth = titleElement.scrollWidth;
          const textHeight = titleElement.scrollHeight;
          const actualWidth = titleElement.offsetWidth;
          const actualHeight = titleElement.offsetHeight;
          return { textWidth, textHeight, actualWidth, actualHeight };
        };
        
        // 二分查找
        while (minFontSize <= maxFontSize) {
          const midFontSize = Math.floor((minFontSize + maxFontSize) / 2);
          const { textWidth, textHeight, actualWidth, actualHeight } = measureFontSize(midFontSize);
          
          const fitsWidth = textWidth <= containerWidth * 0.95 && actualWidth <= containerWidth * 0.95;
          const fitsHeight = textHeight <= containerHeight * 0.95 && actualHeight <= containerHeight * 0.95;
          
          if (fitsWidth && fitsHeight) {
            optimalFontSize = midFontSize;
            minFontSize = midFontSize + 1;
          } else {
            maxFontSize = midFontSize - 1;
          }
        }
        
        // 对于短文本，使用更大的字体
        if (textLength <= 6) {
          optimalFontSize = Math.max(optimalFontSize, Math.min(containerSize * 0.6, optimalFontSize * 1.2));
        } else {
          optimalFontSize = Math.max(optimalFontSize, containerSize * 0.35);
        }
        
        // 最终检查
        const finalCheck = measureFontSize(optimalFontSize);
        if (finalCheck.textWidth > containerWidth * 0.95 || finalCheck.textHeight > containerHeight * 0.95) {
          optimalFontSize = Math.floor(optimalFontSize * 0.9);
        }
        
        // 恢复原始样式
        titleElement.style.fontSize = originalFontSize;
        titleElement.style.width = originalWidth;
        titleElement.style.height = originalHeight;
        titleElement.style.lineHeight = originalLineHeight;
        titleElement.style.display = '';
        titleElement.style.alignItems = '';
        titleElement.style.justifyContent = '';
        
        setFontSize(optimalFontSize);
      }, 0);
      
      return () => clearTimeout(timer);
    } else {
      setFontSize(14);
    }
  }, [shouldShowTitleInside, data.title, data.childCount, zoom, data.width, data.height]);

  // 初始化编辑标题
  useEffect(() => {
    if (!isEditingTitle) {
      setEditingTitle(data.title || `${data.childCount || 0}个节点`);
    }
  }, [data.title, data.childCount, isEditingTitle]);

  // 处理标题编辑
  const handleTitleBlur = () => {
    const finalTitle = editingTitle.trim() || `${data.childCount || 0}个节点`;
    updateNode(id, { 
      ...data,
      title: finalTitle 
    });
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
      e.target.blur();
    } else if (e.key === 'Escape') {
      setEditingTitle(data.title || `${data.childCount || 0}个节点`);
      setIsEditingTitle(false);
    }
  };

  const displayTitle = data.title || `${data.childCount || 0}个节点`;

  // 使用 useEffect 动态更新节点的 z-index
  useEffect(() => {
    const nodeElement = containerRef.current?.closest('.react-flow__node');
    if (nodeElement) {
      if (shouldShowTitleInside) {
        // 当标题在内部时，提高 z-index
        nodeElement.style.zIndex = '100000';
      } else {
        // 当标题不在内部时，重置 z-index，确保子节点可以正常点击
        nodeElement.style.zIndex = '';
      }
    }
  }, [shouldShowTitleInside]);

  return (
    <div 
      ref={containerRef}
      className={`${styles.groupNode} ${selected ? styles.selected : ''} ${shouldShowTitleInside ? styles.titleInside : ''}`}
      style={{
        width: data.width || 400,
        height: data.height || 300,
        position: 'relative',
      }}
    >
      {/* 可编辑标题 - 根据缩放级别显示在上方或内部 */}
      <div className={`${styles.titleContainer} ${shouldShowTitleInside ? styles.titleContainerInside : ''}`}>
        {isEditingTitle ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className={`${styles.titleInput} ${shouldShowTitleInside ? styles.titleInputInside : ''}`}
            style={shouldShowTitleInside ? { fontSize: `${fontSize}px` } : {}}
            autoFocus
          />
        ) : (
          <span
            ref={titleRef}
            className={`${styles.titleText} ${shouldShowTitleInside ? styles.titleTextInside : ''}`}
            style={shouldShowTitleInside ? { fontSize: `${fontSize}px` } : {}}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(displayTitle);
              setIsEditingTitle(true);
            }}
            title="双击编辑"
          >
            {displayTitle}
          </span>
        )}
      </div>
    </div>
  );
}

