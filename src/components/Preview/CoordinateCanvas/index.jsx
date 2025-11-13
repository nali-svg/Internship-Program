import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './index.module.scss';

export default function CoordinateCanvas() {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 绘制画布
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 计算中心点
    const centerX = width / 2 + offset.x;
    const centerY = height / 2 + offset.y;

    // 绘制网格
    drawGrid(ctx, width, height, centerX, centerY, scale);

    // 绘制坐标轴
    drawAxes(ctx, width, height, centerX, centerY);

    // 绘制坐标轴标签
    drawAxisLabels(ctx, width, height, centerX, centerY, scale);

    // 显示坐标信息
    drawInfo(ctx, scale, offset);
  }, [scale, offset]);

  // 绘制网格
  const drawGrid = (ctx, width, height, centerX, centerY, scale) => {
    const gridSize = 50 * scale;
    
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // 垂直线
    for (let x = centerX % gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 水平线
    for (let y = centerY % gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // 绘制坐标轴
  const drawAxes = (ctx, width, height, centerX, centerY) => {
    ctx.strokeStyle = '#1890ff';
    ctx.lineWidth = 2;

    // X轴
    if (centerY >= 0 && centerY <= height) {
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }

    // Y轴
    if (centerX >= 0 && centerX <= width) {
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();
    }

    // 原点标记
    if (centerX >= 0 && centerX <= width && centerY >= 0 && centerY <= height) {
      ctx.fillStyle = '#1890ff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // 绘制坐标轴标签
  const drawAxisLabels = (ctx, width, height, centerX, centerY, scale) => {
    const gridSize = 250 * scale; // 从50改为100，增加间距
    
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // X轴标签
    if (centerY >= 0 && centerY <= height) {
      // 向右的标签
      for (let x = centerX; x < width; x += gridSize) {
        if (Math.abs(x - centerX) < 5) continue; // 跳过原点
        const coordValue = Math.round((x - centerX) / scale);
        
        // 绘制刻度线
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, centerY - 5);
        ctx.lineTo(x, centerY + 5);
        ctx.stroke();
        
        // 绘制数字
        ctx.fillText(coordValue.toString(), x, centerY + 8);
      }
      
      // 向左的标签
      for (let x = centerX - gridSize; x >= 0; x -= gridSize) {
        const coordValue = Math.round((x - centerX) / scale);
        
        // 绘制刻度线
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, centerY - 5);
        ctx.lineTo(x, centerY + 5);
        ctx.stroke();
        
        // 绘制数字
        ctx.fillText(coordValue.toString(), x, centerY + 8);
      }
    }
    
    // Y轴标签
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    if (centerX >= 0 && centerX <= width) {
      // 向上的标签
      for (let y = centerY; y >= 0; y -= gridSize) {
        if (Math.abs(y - centerY) < 5) continue; // 跳过原点
        const coordValue = Math.round((centerY - y) / scale);
        
        // 绘制刻度线
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 5, y);
        ctx.lineTo(centerX + 5, y);
        ctx.stroke();
        
        // 绘制数字
        ctx.fillText(coordValue.toString(), centerX - 8, y);
      }
      
      // 向下的标签
      for (let y = centerY + gridSize; y < height; y += gridSize) {
        const coordValue = Math.round((centerY - y) / scale);
        
        // 绘制刻度线
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 5, y);
        ctx.lineTo(centerX + 5, y);
        ctx.stroke();
        
        // 绘制数字
        ctx.fillText(coordValue.toString(), centerX - 8, y);
      }
    }
    
    // 原点标签
    if (centerX >= 20 && centerX <= width - 20 && centerY >= 20 && centerY <= height - 20) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#1890ff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('0', centerX - 8, centerY - 8);
    }
  };

  // 绘制信息
  const drawInfo = (ctx, scale, offset) => {
    // 保存当前状态
    ctx.save();
    
    // 重置变换，使文字不受画布缩放影响
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // 绘制信息文本，增加边距避免被裁剪
    ctx.fillText(`缩放: ${(scale * 100).toFixed(0)}%`, 20, 30);
    ctx.fillText(`偏移: (${offset.x.toFixed(0)}, ${offset.y.toFixed(0)})`, 20, 50);
    
    // 恢复之前的状态
    ctx.restore();
  };

  // 处理缩放
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
  }, []);

  // 处理拖拽开始
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  // 处理拖拽移动
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  // 处理拖拽结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 初始化画布大小和事件监听
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawCanvas();
    };

    resizeCanvas();
    
    // 使用 ResizeObserver 监听容器大小变化（包括拖拽分割栏）
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    
    resizeObserver.observe(canvas.parentElement);
    
    // 添加滚轮事件监听，使用 passive: false 确保可以阻止默认行为
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [drawCanvas, handleWheel]);

  // 重绘画布
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  return (
    <div className={styles.canvasContainer}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

