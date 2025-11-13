<!-- 5b70b515-1ecd-4299-8b1a-32d6fa5a1395 4dc62e48-e9a9-4af5-8b62-885258b95cf8 -->
# 恢复视频节点输入/输出与检查点样式

- 检查 `src/components/PlayerEditor/FlowNodes/VideoNode/index.jsx`，确认输入/输出标签内是否仍包含 `Handle` 元素，并恢复设为检查点的复选框及 `startTag` 显示逻辑。
- 对比 `VideoNode/index.module.scss`，还原 `.tab`、`.tabLabel`、`.inputTab`、`.outputTab`、`.portHandle` 等样式，确保蓝/绿圆点和复选框样式重现。
- 验证 `OptionNode` 等其他节点不受影响，并在画布中测试视频节点的输入输出按钮及“设为检查点”功能。
