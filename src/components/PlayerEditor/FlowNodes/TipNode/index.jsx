import React from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './index.module.scss';

export default function TipNode({ data }) {
  const title = data?.nodeName || data?.tipText || '提示';
  const tipText = data?.tipText || '';
  const requireAd = !!data?.requireAd;
  const adType = data?.adType || '';
  const isResetToCP = !!data?.isResetToCP;

  return (
    <div className={styles.tipNode}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.header}>{title}</div>
      <div className={styles.body}>
        <div className={styles.tipText}>{tipText || '（无提示文本）'}</div>
        <div className={styles.meta}>
          {requireAd && (
            <span className={styles.badge}>
              广告{adType ? `: ${adType}` : ''}
            </span>
          )}
          {isResetToCP && <span className={styles.badge}>重置到CP</span>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}

