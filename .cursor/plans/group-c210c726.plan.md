<!-- c210c726-f5e8-4bd1-ab44-e2bbb8e05af2 ca44bfbb-fff8-4141-aaf7-0fc24eb9f2bd -->
# 支持视频节点记录/回放本地文件

1. **封装文件系统访问工具**  
   - 新增 [src/utils/fileSystem.js](src/utils/fileSystem.js)，管理浏览器 File System Access API：缓存已授权的媒体目录（alias ↔ directoryHandle），提供选择目录/文件、根据 alias+relativePath 还原文件并读取 Blob 的方法。

2. **节点与 Store 增加本地视频信息**  
   - 在 [src/store/flowStore.js](src/store/flowStore.js) 给视频节点 data 增加 `videoLocalPath`(包含 `baseAlias`、`relativePath`)、`videoBaseAlias` 等字段。  
   - 更新 [src/components/PlayerEditor/FlowNodes/VideoNode/index.jsx](src/components/PlayerEditor/FlowNodes/VideoNode/index.jsx) 与 [src/components/Inspector/VideoNodeInspector/index.jsx](src/components/Inspector/VideoNodeInspector/index.jsx)：选择视频时调用工具类获取文件句柄、生成预览，并同步保存本地路径元数据。

3. **导入导出串联本地路径**  
   - 修改 [src/components/PlayerEditor/index.jsx](src/components/PlayerEditor/index.jsx) 的 `convertFlowToStoryData`/`convertStoryDataToFlow`：导出写入 `videoLocalPath`，导入读取后落到节点 data。  
   - 在加载流程中汇总所有 `videoLocalPath`，按 alias 提示用户授权目录，尝试读取真实文件生成预览；若读取失败则清空预览（不显示占位）。

4. **导出覆写原文件**  
   - 维持现有 File System Access 覆写逻辑，确保包含本地路径的新字段被写回原 `moban.json`。