using Managers;
using Microsoft.Unity.VisualStudio.Editor;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Globalization;
using UnityEditor;
using UnityEngine;
using VideoGameFramework.Models;
using VideoGameFramework.Tools;

namespace VideoGameFramework.Editor
{
    /// <summary>
    /// 自定义JSON转换器，将枚举序列化为数字而不是字符串
    /// </summary>
    public class EnumAsIntConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            return objectType.IsEnum;
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Integer)
            {
                return Enum.ToObject(objectType, Convert.ToInt32(reader.Value));
            }
            else if (reader.TokenType == JsonToken.String)
            {
                return Enum.Parse(objectType, reader.Value.ToString());
            }
            return existingValue;
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            if (value != null)
            {
                writer.WriteValue(Convert.ToInt32(value));
            }
        }
    }

    public class StoryConverterCore : ScriptableObject
    {
        private int order = 0;
        private static StoryConverterCore instance;
        public static StoryConverterCore Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = CreateInstance<StoryConverterCore>();
                }
                return instance;
            }
        }

        //匹配信息
        private List<string> videoNodeInfo = new List<string>();//视频节点信息日志
        private List<string> missingVideos = new List<string>();//未找到视频信息列表
        private List<string> videoMatchLogs = new List<string>();//视频匹配日志
        private List<string> overlayImageMatchLogs = new List<string>();//叠加图片选项匹配日志
        private List<string> cardImageMatchLogs = new List<string>();//卡牌图片匹配日志
        private int foundImagesCount = 0;//匹配的图片数量统计

        //配置数据
        private string inputPath = "";//ProjectGraph制作的章节剧情路径
        private string outputPath = "";//导出章节剧情json文件路径
        private bool extractVariables = true; // 是否开启变量提取
        private bool clearOldVariables = false; // 是否清理旧变量文件

        //视频坐标缩放配置
        private float scaleFactorX = 4f;//X轴缩放
        private float scaleFactorY = 4f;//Y轴缩放
        private bool invertY = true;//Y轴反转

        private bool testMode = false;//测试模式
        private string testVideoPath = "Resources/Video/TestVideo.mp4";//测试模式下的视频路径
        private string fallbackVideoPath = "Resources/Video/TestVideo.mp4";//替补视频路径
        private bool userMode;//是否为窗口编辑器调用：true为EditorWindow，false为其他

        private List<VariableData> extractedVariables = new List<VariableData>(); // 提取的变量列表
        private string globalMaxValueOverride = null; // 全局最大值标记（若存在则覆盖所有变量的最大值）
        private string xlsxFilePath = Path.Combine("Assets","FlexReaderPath","VariableExtractorPath","变量配置.xlsx");

        #region 配置数据的GS方法
        public string InputPath { get => inputPath; set => inputPath = value; }
        public string OutputPath { get => outputPath; set => outputPath = value; }
        public bool ExtractVariables { get => extractVariables; set => extractVariables = value; }
        public bool ClearOldVariables { get => clearOldVariables; set => clearOldVariables = value; }
        public float ScaleFactorX { get => scaleFactorX; set => scaleFactorX = value; }
        public float ScaleFactorY { get => scaleFactorY; set => scaleFactorY = value; }
        public bool InvertY { get => invertY; set => invertY = value; }
        public bool TestMode { get => testMode; set => testMode = value; }
        public string TestVideoPath { get => testVideoPath; set => testVideoPath = value; }
        public string FallbackVideoPath { get => fallbackVideoPath; set => fallbackVideoPath = value; }

        private string FallbackImagePath;//叠加图片替补图片路径

        public bool UserMode { get => userMode; set => userMode = value; }
        public List<VariableData> ExtractedVariables { get => extractedVariables; set => extractedVariables = value; }
        #endregion

        /// <summary>
        /// 配置数据并且开始转换
        /// </summary>
        /// <param name="inputPath">输入路径</param>
        /// <param name="outputPath">输出路径</param>
        /// <param name="extractVariables">是否开启变量提取</param>
        /// <param name="clearOldVariables">是否清理旧变量文件</param>
        /// <param name="userMode">是否为窗口编辑器调用</param>
        public void SetConfigsAndConverted(string inputPath, string outputPath, bool extractVariables, bool clearOldVariables, bool userMode)
        {
            this.InputPath = inputPath;
            this.OutputPath = outputPath;
            this.ExtractVariables = extractVariables;
            this.ClearOldVariables = clearOldVariables;
            this.UserMode = userMode;
            ConvertStory();
        }

        /// <summary>
        /// 配置数据并且开始转换
        /// </summary>
        /// <param name="inputPath">输入路径</param>
        /// <param name="outputPath">输出路径</param>
        /// <param name="extractVariables">是否开启变量提取</param>
        /// <param name="clearOldVariables">是否清理旧变量文件</param>
        /// <param name="userMode">是否为窗口编辑器调用</param>
        /// <param name="fallbackVideoPath">替换视频路径</param>
        public void SetConfigsAndConverted(string inputPath, string outputPath, bool extractVariables,
            bool clearOldVariables, bool userMode, string fallbackVideoPath, string fallbackImagePath,string xlsxFilePath)
        {
            this.InputPath = inputPath;
            this.OutputPath = outputPath;
            this.ExtractVariables = extractVariables;
            this.ClearOldVariables = clearOldVariables;
            this.UserMode = userMode;
            this.FallbackVideoPath = fallbackVideoPath;
            this.FallbackImagePath = fallbackImagePath;
            this.xlsxFilePath = xlsxFilePath;
            ConvertStory();
        }

        /// <summary>
        /// 配置所有数据并开始转换
        /// </summary>
        /// <param name="inputPath">输入路径</param>
        /// <param name="outputPath">输出路径</param>
        /// <param name="extractVariables">是否开启变量提取</param>
        /// <param name="clearOldVariables">是否清理旧变量文件</param>
        /// <param name="userMode">是否为窗口编辑器使用</param>
        /// <param name="scaleFactorX">X轴缩放</param>
        /// <param name="scaleFactorY">Y轴缩放</param>
        /// <param name="invertY">是否反转Y轴</param>
        /// <param name="testMode">是否为测试模式</param>
        /// <param name="testVideoPath">测试视频路径</param>
        /// <param name="fallbackVideoPath">替换视频路径</param>
        public void SetConfigsAndConverted(string inputPath, string outputPath, bool extractVariables,
                                           bool clearOldVariables, bool userMode, float scaleFactorX, float scaleFactorY,
                                           bool invertY, bool testMode, string testVideoPath, string fallbackVideoPath, string fallbackImagePath)
        {
            this.InputPath = inputPath;
            this.OutputPath = outputPath;
            this.ExtractVariables = extractVariables;
            this.ClearOldVariables = clearOldVariables;
            this.UserMode = userMode;
            this.ScaleFactorX = scaleFactorX;
            this.ScaleFactorY = scaleFactorY;
            this.InvertY = invertY;
            this.testMode = testMode;
            this.testVideoPath = testVideoPath;
            this.fallbackVideoPath = fallbackVideoPath;
            this.FallbackImagePath = fallbackImagePath;
            ConvertStory();
        }
        public void ConvertStory()
        {
            try
            {
                // 每次转换前重置全局最大值标记
                globalMaxValueOverride = null;
                // 如果启用了清理旧变量，先删除旧的变量文件
                if (ExtractVariables && ClearOldVariables)
                {
                    ClearOldVariableFiles();
                    // 新增：清空视频匹配日志
                    videoMatchLogs.Clear();
                    overlayImageMatchLogs.Clear();
                    cardImageMatchLogs.Clear();

                    //清空视频节点信息列表
                    videoNodeInfo.Clear();
                }

                // 在清空之前，先读取之前章节的变量文件，保持累加变量的优先级
                List<VariableData> previousVariables = new List<VariableData>();
                if (ExtractVariables && !ClearOldVariables)
                {
                    previousVariables = LoadPreviousChapterVariables();
                }

                // 清空之前提取的变量和未找到的视频
                ExtractedVariables.Clear();
                //将xlsx表格提取出的变量先赋值
                ExtractedVariables = GetVariableDatasFromXlsx();

                // 合并之前章节的变量，保持累加变量的优先级
                if (previousVariables.Count > 0)
                {
                    MergePreviousVariables(previousVariables);
                }
                order = extractedVariables.Count;
                missingVideos.Clear();
                foundImagesCount = 0;

                var json = File.ReadAllText(inputPath);
                var storyGraph = JsonConvert.DeserializeObject<StoryGraph>(json);

                var storyData = ConvertToStoryData(storyGraph);

                // 如果选择了提取变量，则处理提取到的变量
                if (ExtractVariables && ExtractedVariables.Count > 0)
                {
                    // 若存在全局最大值标记，先覆盖当前提取结果
                    ApplyGlobalMaxToExtractedVariables();
                    // 将提取的变量添加到storyData中
                    storyData.variables = new List<VariableData>(ExtractedVariables);
                    SaveExtractedVariables();
                }

                // 创建序列化设置
                var settings = new JsonSerializerSettings
                {
                    // 忽略循环引用
                    ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    // 忽略空值
                    NullValueHandling = NullValueHandling.Ignore,
                    // 使用缩进格式
                    Formatting = Formatting.Indented,
                    // 枚举序列化为数字
                    Converters = new List<JsonConverter> { new EnumAsIntConverter() }
                };

                // 转换Unity的Vector2为简单类型，避免序列化问题
                foreach (var videoNode in storyData.videoNodes)
                {
                    // 保存原始position的x和y值
                    float x = videoNode.position.x;
                    float y = videoNode.position.y;

                    // 创建一个新的Vector2，避免使用Unity的Vector2的复杂属性
                    videoNode.position = new Vector2(x, y);
                }

                foreach (var choiceNode in storyData.choiceNodes)
                {
                    // 同样处理选项节点
                    float x = choiceNode.position.x;
                    float y = choiceNode.position.y;
                    choiceNode.position = new Vector2(x, y);
                }

                foreach (var jumpNode in storyData.jumpNodes)
                {
                    // 处理跳转节点
                    float x = jumpNode.position.x;
                    float y = jumpNode.position.y;
                    jumpNode.position = new Vector2(x, y);
                }

                // 验证跳转点功能
                ValidateJumpPoints(storyData);

                // 使用设置后的序列化器
                var outputJson = JsonConvert.SerializeObject(storyData, settings);

                // 针对IsCheckpoint进行特定处理
                outputJson = outputJson.Replace("\"IsCheckpoint\":", "\"isCheckpoint\":");

                // 检查并创建目录
                string directory = Path.GetDirectoryName(OutputPath);
                if (!Directory.Exists(directory))
                {
                    LogManager.Log($"创建目录: {directory}");
                    Directory.CreateDirectory(directory);
                }

                // 写入文件并确认
                File.WriteAllText(OutputPath, outputJson);

                // 验证文件是否确实创建
                if (File.Exists(OutputPath))
                {
                    LogManager.Log($"文件成功写入: {OutputPath}, 大小: {new FileInfo(OutputPath).Length} 字节");

                    // 如果文件在Unity项目内部，刷新资源数据库
                    if (OutputPath.StartsWith(Application.dataPath))
                    {
                        AssetDatabase.Refresh();
                        LogManager.Log("已刷新Unity资产数据库");
                    }

                    string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                    string fileName = $"videoMatchLogs_{timestamp}.txt";
                    string directoryPath = "Assets/VideoMatchLogs/";
                    string filePath = Path.Combine(directoryPath, fileName);

                    // 创建分类的日志内容
                    List<string> allLogs = new List<string>();

                    // 添加视频匹配日志
                    if (videoMatchLogs.Count > 0)
                    {
                        allLogs.Add("=== 视频匹配日志 ===");
                        allLogs.AddRange(videoMatchLogs);
                        allLogs.Add(""); // 空行分隔
                    }

                    // 添加叠加图片选项匹配日志
                    if (overlayImageMatchLogs.Count > 0)
                    {
                        allLogs.Add("=== 叠加图片选项匹配日志 ===");
                        allLogs.AddRange(overlayImageMatchLogs);
                        allLogs.Add(""); // 空行分隔
                    }

                    // 添加卡牌匹配日志
                    if (cardImageMatchLogs.Count > 0)
                    {
                        allLogs.Add("=== 卡牌匹配日志 ===");
                        allLogs.AddRange(cardImageMatchLogs);
                        allLogs.Add(""); // 空行分隔
                    }

                    // 输出到控制台和LogManager
                    string combinedLogs = string.Join("\n", allLogs);
                    LogManager.LogWarning("【匹配日志汇总】\n" + combinedLogs);
                    LogManager.LogWarning("【匹配日志汇总】\n" + combinedLogs, LogTag.Video);

                    // 写入分类日志到文件
                    // 确保目录存在
                    Directory.CreateDirectory(directoryPath);
                    File.WriteAllLines(filePath, allLogs);

                    string videoNodeinfoFileName = $"videoNodeInfoLogs_{timestamp}.txt";
                    string videoNodeInfoDirectoryPath = "Assets/videoNodeInfo/";
                    string videoNodeinfoFilePath = Path.Combine(videoNodeInfoDirectoryPath, videoNodeinfoFileName);
                    // 确保目录存在
                    Directory.CreateDirectory(videoNodeInfoDirectoryPath);
                    File.WriteAllLines(videoNodeinfoFilePath, videoNodeInfo);

                    if (File.Exists(videoNodeinfoFilePath) && File.Exists(filePath))
                    {
                        if (videoNodeinfoFilePath.StartsWith(Application.dataPath) && filePath.StartsWith(Application.dataPath))
                        {
                            LogManager.Log("已刷新Unity资产数据库");
                            LogManager.LogWarning("【视频匹配日志】已写入 Assets/VideoMatchLogs/");
                            LogManager.LogWarning("【视频节点信息】日志已经写入Assets/videoNodeInfo/");
                            AssetDatabase.Refresh();
                        }
                    }
                    // 输出统一的未找到视频日志
                    if (missingVideos.Count > 0)
                    {
                        string missingVideoLog = "[节点转换] 未找到以下视频:\n" + string.Join("\n", missingVideos);
                        LogManager.LogWarning(missingVideoLog);
                    }

                    string successMessage = $"转换完成，已保存至:\n{OutputPath}\n已提取 {ExtractedVariables.Count} 个变量";

                    if (TestMode)
                    {
                        successMessage += $"\n【测试模式】所有视频节点使用测试视频: {TestVideoPath}";
                    }
                    else
                    {
                        if (foundImagesCount > 0)
                        {
                            successMessage += $"\n找到 {foundImagesCount} 个图片节点，未找到 {missingVideos.Count} 个视频";
                        }
                        else
                        {
                            successMessage += $"\n未找到 {missingVideos.Count} 个视频";
                        }
                    }
                    if (UserMode)
                    {
                        AssetDatabase.Refresh();
                        EditorUtility.DisplayDialog("成功", successMessage, "确定");
                    }
                }
                else
                {
                    string errorMsg = $"文件写入操作完成，但无法找到输出文件: {OutputPath}";
                    LogManager.LogError(errorMsg);
                    if (UserMode)
                    {
                        EditorUtility.DisplayDialog("警告", errorMsg, "确定");
                    }
                }
            }
            catch (System.Exception e)
            {
                LogManager.LogError($"转换失败: {e.Message}\n{e.StackTrace}");
                if (UserMode)
                {
                    EditorUtility.DisplayDialog("错误", $"转换失败: {e.Message}", "确定");
                }
            }
        }

        private StoryData ConvertToStoryData(StoryGraph graph)
        {
            var storyData = new StoryData();
            var nodeMap = new Dictionary<string, BaseNode>();
            var entityMap = graph.entities.ToDictionary(e => e.uuid, e => e);

            // 存储被跳过的节点及其连接关系
            var skippedNodes = new Dictionary<string, List<string>>();
            // 存储死亡节点和终点节点ID
            var deadEndNodeIds = new HashSet<string>();

            // 找到具有最小y值的节点作为起始节点
            StoryGraphEntity startEntity = null;
            float minY = float.MaxValue;

            // 先检查是否有带[起点]标记的节点
            foreach (var entity in graph.entities)
            {
                if (entity.text != null && entity.text.Contains("[起点]"))
                {
                    startEntity = entity;
                    LogManager.Log($"找到带[起点]标记的节点作为起始节点: {entity.uuid}, 文本: {entity.text}");
                    break;
                }
            }

            // 如果没有找到带[起点]标记的节点，则使用Y坐标最小的节点
            if (startEntity == null)
            {
                foreach (var entity in graph.entities)
                {
                    if (entity.location != null && entity.location.Length >= 2)
                    {
                        float y = entity.location[0];
                        if (y < minY)
                        {
                            minY = y;
                            startEntity = entity;
                        }
                    }
                }
            }

            // 设置起始节点ID
            if (startEntity != null)
            {
                storyData.startNodeId = startEntity.uuid;
                LogManager.Log($"设置起始节点ID: {startEntity.uuid}, 文本: {startEntity.text}");
            }

            // 第一遍：创建所有节点，并找出被跳过的节点
            foreach (var entity in graph.entities)
            {
                BaseNode node = CreateNode(entity);

                // 如果节点为null，说明该节点被标记为[X]，应跳过
                if (node == null)
                {
                    skippedNodes[entity.uuid] = new List<string>();
                    continue;
                }

                nodeMap[entity.uuid] = node;

                // 检查是否是死亡节点或终点节点（死亡节点适用于任意节点类型；终点节点目前仅视频节点支持）
                bool isDeadpoint = node != null && node.isDeadpoint;
                bool isEndpoint = (node as VideoNode)?.isEndpoint == true;
                if (isDeadpoint || isEndpoint)
                {
                    deadEndNodeIds.Add(node.nodeId);
                    LogManager.Log($"识别到死亡/终点节点: {node.nodeId}");
                }

                // 根据节点类型添加到对应列表
                if (node is VideoNode)
                    storyData.videoNodes.Add(node as VideoNode);
                else if (node is ChoiceNode)
                    storyData.choiceNodes.Add(node as ChoiceNode);
                else if (node is BGMNode)
                    storyData.bgmNodes.Add(node as BGMNode);
                else if (node is CardNode)
                    storyData.cardNodes.Add(node as CardNode);
                else if (node is JumpNode)
                    storyData.jumpNodes.Add(node as JumpNode);
                else if (node is TipNode)
                    storyData.tipNodes.Add(node as TipNode);
                else if (node is TaskNode)
                    storyData.taskNodes.Add(node as TaskNode);
            }

            // 第二遍：处理节点连接，建立跳过节点的连接图
            foreach (var association in graph.associations)
            {
                // 如果目标节点被跳过，记录该连接以便后续处理
                if (skippedNodes.ContainsKey(association.target))
                {
                    skippedNodes[association.target].Add(association.source);
                    continue;
                }

                // 如果源节点被跳过，跳过该连接
                if (skippedNodes.ContainsKey(association.source))
                {
                    continue;
                }

                // 正常节点之间的连接
                if (nodeMap.ContainsKey(association.source) && nodeMap.ContainsKey(association.target))
                {
                    // 移除对死亡节点的特殊处理，让死亡节点也能正常建立连接
                    var sourceNode = nodeMap[association.source];
                    sourceNode.nextNodeIds.Add(association.target);
                }
            }

            // 第三遍：处理被跳过的节点，建立直接连接
            if (skippedNodes.Count > 0)
            {
                LogManager.Log($"处理 {skippedNodes.Count} 个被跳过的节点");

                // 创建节点关系的连接图
                var connectionGraph = new Dictionary<string, List<string>>();
                foreach (var association in graph.associations)
                {
                    if (!connectionGraph.ContainsKey(association.source))
                    {
                        connectionGraph[association.source] = new List<string>();
                    }
                    connectionGraph[association.source].Add(association.target);
                }

                // 处理每个被跳过的节点
                foreach (var skippedNode in skippedNodes)
                {
                    string skippedId = skippedNode.Key;
                    List<string> previousNodeIds = skippedNode.Value;

                    // 如果没有后续节点，跳过
                    if (!connectionGraph.ContainsKey(skippedId))
                    {
                        continue;
                    }

                    // 为每一个前节点处理连接
                    foreach (string prevId in previousNodeIds)
                    {
                        // 如果前节点也被跳过，跳过处理
                        if (skippedNodes.ContainsKey(prevId))
                            continue;

                        // 如果前节点存在于nodeMap中
                        if (nodeMap.ContainsKey(prevId))
                        {
                            var prevNode = nodeMap[prevId];

                            // 移除到被跳过节点的连接
                            prevNode.nextNodeIds.Remove(skippedId);

                            // 查找所有最终的非跳过节点并添加连接
                            FindAndAddFinalTargets(connectionGraph, skippedId, prevNode, skippedNodes, nodeMap, deadEndNodeIds);
                        }
                    }
                }
            }

            // 第四遍：根据后续节点类型设置视频节点的自动播放属性
            foreach (var videoNode in storyData.videoNodes)
            {
                // 默认自动播放
                videoNode.autoPlayNext = true;

                // 如果没有后续节点，跳过
                if (videoNode.nextNodeIds == null || videoNode.nextNodeIds.Count == 0)
                    continue;

                // 检查后续节点的类型
                bool hasChoiceNode = false;

                foreach (var nextNodeId in videoNode.nextNodeIds)
                {
                    // 检查是否连接到选项节点
                    if (storyData.choiceNodes.Any(n => n.nodeId == nextNodeId))
                    {
                        if (!storyData.choiceNodes.Find(n => n.nodeId == nextNodeId).showEarly)
                        {

                            hasChoiceNode = true;
                            break; // 只要有一个选项节点且不是提前选项，就不自动播放
                        }
                        else
                        {
                            hasChoiceNode = false;//提前选项，自动播放
                        }
                    }

                    // 检查是否连接到视频节点
                    if (storyData.videoNodes.Any(n => n.nodeId == nextNodeId))
                    {
                    }
                }

                // 如果连接到选项节点，则设置为不自动播放
                if (hasChoiceNode)
                {
                    videoNode.autoPlayNext = false;
                    LogManager.Log($"视频节点 {videoNode.nodeId} 连接到选项节点，不自动播放");
                }
                else
                {
                    LogManager.Log($"设置视频节点 {videoNode.nodeId} 自动播放下一个节点");
                }
            }

            return storyData;
        }

        private BaseNode CreateNode(StoryGraphEntity entity)
        {
            LogManager.Log($"【转换排查】CreateNode开始处理节点: {entity.uuid}, 原始文本: \"{entity.text}\"");
            LogManager.Log($"【转换与视频变选项排查】开始节点类型识别，节点ID: {entity.uuid}");

            string text = entity.text ?? "";
            LogManager.Log($"【转换与视频变选项排查】处理前的文本: \"{text}\"");

            // 统一符号标准化处理 - 将全角符号转换为半角符号
            text = NormalizeSymbols(text);
            //转换后写回
            entity.text = text;
            LogManager.Log($"【转换与视频变选项排查】符号标准化后的文本: \"{text}\"");

            // 统一解析广告标记
            ParseAdMark(ref text, out bool requireAd, out string adType);
            LogManager.Log($"【转换与视频变选项排查】解析广告标记后的文本: \"{text}\"");

            // 新增：提示节点识别
            var tipMatch = Regex.Match(text, @"\[提示\]([\s\S]+)");
            if (tipMatch.Success)
            {
                var tipNode = new TipNode();
                tipNode.nodeId = entity.uuid;
                tipNode.tipText = tipMatch.Groups[1].Value.Trim();
                tipNode.requireAd = requireAd;
                tipNode.adType = adType;

                // 处理重置到CP点标记
                bool isResetToCP = text.Contains("[重置到CP点]");
                if (isResetToCP)
                {
                    tipNode.isResetToCP = true;
                    LogManager.Log($"【重置到CP点】设置提示节点 {tipNode.nodeId} 为重置到CP点节点");
                }

                // 位置
                if (entity.location != null && entity.location.Length >= 2)
                {
                    float yMult = InvertY ? -1f : 1f;
                    tipNode.position = new UnityEngine.Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
                }
                // 直接返回null，主流程不处理，ConvertToStoryData中单独收集
                return tipNode;
            }

            LogManager.Log($"【转换排查】节点识别开始处理节点文本: \"{text}\"");

            // 检查是否包含[X]标记（跳过该节点不生成）
            if (text.Contains("[X]"))
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 包含[X]标记，跳过生成");
                return null;
            }

            // 检查是否是卡牌节点 - 使用更严格的正则表达式匹配
            bool isCardNode = false;
            if (text.IndexOf("[卡牌选项]", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                isCardNode = true;
                LogManager.Log($"【转换排查】通过[卡牌选项]标记识别为卡牌节点: \"{text}\"");
            }
            else if (text.IndexOf("[卡牌选项:", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                isCardNode = true;
                LogManager.Log($"【转换排查】通过[卡牌选项:xxx]标记识别为卡牌节点: \"{text}\"");
            }

            if (isCardNode)
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 确认为卡牌节点: \"{text}\"");
                return CreateCardNode(entity);
            }

            // 检查是否是跳转节点 [跳转节点]xxxx
            var jumpNodeMatch = Regex.Match(text, @"\[跳转节点\]([^\]]*)");
            if (jumpNodeMatch.Success)
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 标记为跳转节点");
                return CreateJumpNode(entity);
            }

            // 检查是否是BGM节点
            if (text.Contains("[BGM]"))
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 标记为BGM节点");
                return CreateBGMNode(entity);
            }

            // 检查是否是任务节点 [任务节点:数字]
            var taskNodeMatch = Regex.Match(text, @"\[任务节点:?(\d*)\]");
            if (taskNodeMatch.Success)
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 标记为任务节点");
                return CreateTaskNode(entity);
            }

            // 检查是否是选项节点 - 同时支持[选项]、[隐藏选项]、[叠加图片选项]和[叠加图片选项:false]标记
            bool hasChoiceMarker = text.Contains("[选项]") || text.Contains("[隐藏选项]") || text.Contains("[叠加图片选项]")||text.Contains("[叠加图片选项:false]");
            LogManager.Log($"【转换与视频变选项排查】选项标记检查结果: {hasChoiceMarker}");
            LogManager.Log($"【转换与视频变选项排查】包含[选项]: {text.Contains("[选项]")}");
            LogManager.Log($"【转换与视频变选项排查】包含[隐藏选项]: {text.Contains("[隐藏选项]")}");
            LogManager.Log($"【转换与视频变选项排查】包含[叠加图片选项]: {text.Contains("[叠加图片选项]")}");

            if (hasChoiceMarker)
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 标记为选项节点");
                LogManager.Log($"【转换与视频变选项排查】确认创建选项节点，文本: \"{text}\"");
                return CreateChoiceNode(entity);
            }
            // 如果不是选项节点，则创建视频节点
            else
            {
                LogManager.Log($"【转换排查】节点 {entity.uuid} 识别为视频节点");
                LogManager.Log($"【转换与视频变选项排查】确认创建视频节点，文本: \"{text}\"");
                return CreateVideoNode(entity);
            }
        }

        private VideoNode CreateVideoNode(StoryGraphEntity entity)
        {
            LogManager.Log($"【转换排查】CreateVideoNode开始处理节点: {entity.uuid}, 文本: \"{entity.text}\"");

            var node = new VideoNode();
            node.nodeId = entity.uuid;
            string text = entity.text;
            string originalText = text; // 保存原始文本

            videoNodeInfo.Add($"节点uuid：【{node.nodeId}】\n节点文本：【{originalText}】\n标准化后：【{text}】\n\n");

            // 仅移除广告标记，不赋值requireAd/adType
            ParseAdMark(ref text, out _, out _);

            //处理[变量条:变量名:#ffffff:上/下]（放宽空格与#可选）
            Regex regex = new Regex(@"\[\s*变量条\s*[：:]\s*([^:#\]]+?)\s*[：:]\s*#?\s*([0-9a-fA-F]{6})\s*[：:]\s*([上下])\s*\]");
            Match match = regex.Match(originalText);
            if (match.Success)
            {
                node.showVariableBar = true;
                node.variableBarName = match.Groups[1].Value.Trim();
                // 确保提取列表存在该变量（不再设置默认值）
                if (ExtractVariables)
                {
                    var matchVariable = ExtractedVariables.FirstOrDefault(v => v.name == node.variableBarName);
                    if (matchVariable == null)
                    {
                        AddVariableToExtractedList(node.variableBarName, true);
                        LogManager.Log($"【变量条标记处理】自动添加变量: {node.variableBarName}");
                    }
                }
                node.variableBarColor = "#" + match.Groups[2].Value;
                node.variableBarPosition = match.Groups[3].Value;
            }
            else
            {
                //默认设置为false
                node.showVariableBar = false;
            }

            // 清理层级标记（视频节点不使用该值，仅清理）
            TryExtractAndRemoveTierIndex(ref text, out _);

            // 处理[解锁成就:XXX]标记
            var unlockAchMatch = Regex.Match(text, @"\[解锁成就[：:]([^\]]+)\]");
            if (unlockAchMatch.Success)
            {
                node.unlockAchievement = true;
                node.unlockAchievementName = unlockAchMatch.Groups[1].Value.Trim();
                text = text.Replace(unlockAchMatch.Value, "").Trim();
                LogManager.Log($"【解锁成就】检测到解锁成就标记: {node.unlockAchievementName}");
            }

            // 处理黑屏视频标记
            bool isBlackScreenVideo = text.Contains("黑屏视频");
            if (isBlackScreenVideo)
            {
                node.isBlackScreen = true;
                LogManager.Log($"【黑屏视频】检测到黑屏视频节点: {node.nodeId}");
            }

            // 处理[带货节点:商品名1;商品名2]标记
            var showcaseMatch = Regex.Match(text, @"\[带货节点[：:]([^\]]*)\]");
            if (showcaseMatch.Success)
            {
                node.isProductShowcase = true;
                // 清空现有商品列表，因为标签中指定了新的商品
                node.showcaseProductIds.Clear();
                
                string productList = showcaseMatch.Groups[1].Value.Trim();
                if (!string.IsNullOrEmpty(productList))
                {
                    // 按分号分割商品名
                    var productNames = productList.Split(';');
                    foreach (var productName in productNames)
                    {
                        string trimmedName = productName.Trim();
                        if (!string.IsNullOrEmpty(trimmedName))
                        {
                            // 根据商品名称查找商品ID
                            string productId = FindProductIdByName(trimmedName);
                            if (!string.IsNullOrEmpty(productId))
                            {
                                node.showcaseProductIds.Add(productId);
                                LogManager.Log($"【带货节点】找到商品: {trimmedName} -> {productId}");
                            }
                            else
                            {
                                LogManager.LogWarning($"【带货节点】未找到商品: {trimmedName}，将使用商品名称作为ID");
                                node.showcaseProductIds.Add(trimmedName);
                            }
                        }
                    }
                }
                text = text.Replace(showcaseMatch.Value, "").Trim();
                LogManager.Log($"【带货节点】视频节点 {node.nodeId} 设置为带货节点，商品数量: {node.showcaseProductIds.Count}");
            }

            // 处理起点标记
            bool isStartNode = text.Contains("[起点]");
            text = text.Replace("[起点]", "").Trim();
            if (isStartNode)
            {
                node.title = "起始节点";
                LogManager.Log($"设置视频节点为起始节点: {node.nodeId}");
            }

            // 处理检查点标记
            bool isCheckpoint = false;
            string checkpointName = "";

            LogManager.Log($"开始处理节点文本: \"{text}\"");

            // 检查带名称的检查点格式 [CP:XXX]
            var cpNameMatch = Regex.Match(text, @"\[CP[：:]([^\]]+)\]");
            if (cpNameMatch.Success)
            {
                isCheckpoint = true;
                checkpointName = cpNameMatch.Groups[1].Value.Trim();
                text = text.Replace(cpNameMatch.Value, "").Trim();
                LogManager.Log($"识别到带名称的检查点: {node.nodeId}, 名称: \"{checkpointName}\", 剩余文本: \"{text}\"");

                // 设置节点的名称相关属性
                node.title = $"检查点: {checkpointName}";
                node.nodeName = checkpointName;  // 优先使用[CP:XXX]中的XXX作为节点名称
                node.description = $"检查点: {checkpointName}";

                // 尝试设置 checkpointName 字段（如果存在）
                var nameField = typeof(BaseNode).GetField("checkpointName", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                if (nameField != null)
                {
                    nameField.SetValue(node, checkpointName);
                    LogManager.Log($"设置检查点名称字段: {checkpointName}");
                }
            }
            // 检查普通检查点格式 [CP]
            else if (text.Contains("[CP]"))
            {
                isCheckpoint = true;
                string beforeClean = text;
                text = text.Replace("[CP]", "").Trim();
                LogManager.Log($"识别到普通检查点: {node.nodeId}");
                LogManager.Log($"移除[CP]前: \"{beforeClean}\", 移除后: \"{text}\"");

                // 为普通检查点设置名称为清理后的文本内容
                node.title = "检查点";

                // 清理文本中的其他标记，使用纯文本作为节点名称
                string cleanedText = CleanText(text);
                LogManager.Log($"清理后的文本: \"{cleanedText}\"");

                if (!string.IsNullOrEmpty(cleanedText))
                {
                    node.nodeName = cleanedText;
                    node.description = $"检查点: {cleanedText}";
                    LogManager.Log($"设置检查点节点名称为清理后文本: \"{cleanedText}\"");
                }
                else
                {
                    // 如果清理后的文本为空，使用默认名称
                    node.nodeName = "检查点";
                    node.description = "检查点";
                    LogManager.Log($"清理后文本为空，使用默认名称'检查点'");
                }
            }

            // 设置检查点标志
            var field = typeof(BaseNode).GetField("isCheckpoint", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(node, isCheckpoint);
                if (isCheckpoint)
                {
                    LogManager.Log($"设置检查点节点: {node.nodeId}, isCheckpoint已设置为 {isCheckpoint}");

                    // 如果是检查点，查找缩略图
                    string thumbnailPath = FindCheckpointThumbnail(originalText, text);
                    if (!string.IsNullOrEmpty(thumbnailPath))
                    {
                        // 直接设置VideoNode的缩略图路径属性
                        // 处理缩略图路径格式，确保是相对于Resources文件夹的路径

                        // 1. 将反斜杠转换为正斜杠
                        thumbnailPath = thumbnailPath.Replace("\\", "/");

                        // 2. 如果是绝对路径，提取相对于Resources的路径
                        int resourcesIndex = thumbnailPath.IndexOf("/Resources/", StringComparison.OrdinalIgnoreCase);
                        if (resourcesIndex >= 0)
                        {
                            thumbnailPath = thumbnailPath.Substring(resourcesIndex + "/Resources/".Length);
                            LogManager.Log($"【匹配缩略图】提取Resources相对路径: {thumbnailPath}");
                        }
                        else if (thumbnailPath.StartsWith("Assets/Resources/"))
                        {
                            thumbnailPath = thumbnailPath.Substring("Assets/Resources/".Length);
                            LogManager.Log($"【匹配缩略图】移除Assets/Resources/前缀: {thumbnailPath}");
                        }

                        // 3. 移除文件扩展名
                        thumbnailPath = System.IO.Path.ChangeExtension(thumbnailPath, null);

                        // 4. 设置缩略图路径
                        node.thumbnailPath = thumbnailPath;
                        LogManager.Log($"【匹配缩略图】最终设置检查点缩略图路径: {node.thumbnailPath}");
                    }
                }
            }
            else
            {
                LogManager.LogError("无法找到isCheckpoint私有字段，请检查BaseNode类的实现");
                node.IsCheckpoint = isCheckpoint; // 如果反射失败，仍使用属性设置
            }

            // 处理条件，与ChoiceNode相同的方式
            ProcessVideoConditions(text, node);

            // 处理死亡节点标记（适用于任意节点类型，视频节点也保持解析）
            if (text.Contains("[死亡节点]"))
            {
                node.isDeadpoint = true;
                text = text.Replace("[死亡节点]", "").Trim();
            }

            // 处理终点节点标记（支持[终点节点]和[结束节点]，同时支持全角和半角方括号）
            node.isEndpoint = text.Contains("[终点节点]") || text.Contains("[结束节点]") || 
                             text.Contains("［终点节点］") || text.Contains("［结束节点］");
            text = text.Replace("[终点节点]", "").Replace("[结束节点]", "").Trim();
            text = text.Replace("［终点节点］", "").Replace("［结束节点］", "").Trim();

            // 处理重置到CP点标记
            bool isResetToCP = text.Contains("[重置到CP点]");
            if (isResetToCP)
            {
                node.isResetToCP = true;
                LogManager.Log($"【重置到CP点】设置节点 {node.nodeId} 为重置到CP点节点");

                // 从文本中移除标记
                text = text.Replace("[重置到CP点]", "").Trim();

                // 如果有标题，添加重置到CP点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "重置到CP点";
                }
                else
                {
                    node.title += " | 重置到CP点";
                }
            }

            // 处理循环视频标记
            if (text.Contains("[循环视频]"))
            {
                node.loop = true;
                text = text.Replace("[循环视频]", "").Trim();
                LogManager.Log($"【循环视频】设置节点 {node.nodeId} 为循环播放视频");

                // 如果有标题，添加循环视频标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "循环视频";
                }
                else
                {
                    node.title += " | 循环视频";
                }
            }

            // 处理随机时间事件标记 [随机时间事件(a-b)]，单位为秒，仅用于视频节点
            var randomTimeEventMatch = Regex.Match(text, @"\[\s*随机时间事件\s*[\(（]\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*[\)）]\s*\]");
            if (randomTimeEventMatch.Success)
            {
                if (float.TryParse(randomTimeEventMatch.Groups[1].Value, out float a) && float.TryParse(randomTimeEventMatch.Groups[2].Value, out float b))
                {
                    node.hasRandomTimeEvent = true;
                    node.randomTimeMinSeconds = Mathf.Min(a, b);
                    node.randomTimeMaxSeconds = Mathf.Max(a, b);
                    text = text.Replace(randomTimeEventMatch.Value, "").Trim();
                    LogManager.Log($"【随机时间事件】设置节点 {node.nodeId} 随机时间区间: [{node.randomTimeMinSeconds}, {node.randomTimeMaxSeconds}] 秒");
                }
                else
                {
                    LogManager.LogWarning($"【随机时间事件】节点 {node.nodeId} 解析失败: '{randomTimeEventMatch.Value}'");
                }
            }

            // 处理随机节点标记 [随机:概率表达式] 或 《概率表达式%》
            var randomMatch = Regex.Match(text, @"\[随机[：:]([^\]]+)\]");
            var randomPercentMatch = Regex.Match(text, @"《([^》]+)%》");

            if (randomMatch.Success)
            {
                node.isRandom = true;
                node.probabilityExpression = randomMatch.Groups[1].Value.Trim();
                text = text.Replace(randomMatch.Value, "").Trim();
                LogManager.Log($"【随机节点】设置节点 {node.nodeId} 为随机节点，概率表达式: {node.probabilityExpression}");

                // 如果有标题，添加随机节点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "随机节点";
                }
                else
                {
                    node.title += " | 随机节点";
                }
            }
            else if (randomPercentMatch.Success)
            {
                node.isRandom = true;
                node.probabilityExpression = randomPercentMatch.Groups[1].Value.Trim();
                text = text.Replace(randomPercentMatch.Value, "").Trim();
                LogManager.Log($"【随机节点】设置节点 {node.nodeId} 为随机节点，概率表达式: {node.probabilityExpression}");

                // 如果有标题，添加随机节点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "随机节点";
                }
                else
                {
                    node.title += " | 随机节点";
                }
            }

            // 处理跳转点标记 [跳转点：xxxx] - 必须在对话框处理之前
            var jumpPointMatch = Regex.Match(text, @"\[跳转点[：:]([^\]]+)\]");
            if (jumpPointMatch.Success)
            {
                node.isJumpPoint = true;
                node.jumpPointId = jumpPointMatch.Groups[1].Value.Trim();
                text = text.Replace(jumpPointMatch.Value, "").Trim();

                // 设置跳转点描述（使用清理后的文本）
                string cleanedTextForDescription = CleanText(text);
                if (!string.IsNullOrEmpty(cleanedTextForDescription))
                {
                    node.jumpPointDescription = cleanedTextForDescription;
                }
                else
                {
                    node.jumpPointDescription = $"跳转点: {node.jumpPointId}";
                }

                LogManager.Log($"【跳转点】检测到跳转点标记: {node.nodeId}, 跳转点ID: {node.jumpPointId}, 描述: {node.jumpPointDescription}");

                // 如果有标题，添加跳转点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = $"跳转点: {node.jumpPointId}";
                }
                else
                {
                    node.title += $" | 跳转点: {node.jumpPointId}";
                }
            }

            // 处理CG标记
            ProcessCGMarkers(text, node);

            // 处理对话框标记
            ProcessDialogMarkers(text, node);

            // 处理变量效果
            ProcessVariableEffects(text, node);

            // 设置视频路径 - 黑屏视频节点跳过视频匹配
            if (isBlackScreenVideo)
            {
                // 黑屏视频节点不需要匹配实际视频文件，保持空的视频路径
                node.videoClipPath = "";
                node.displayType = VideoNodeDisplayType.Video; // 黑屏视频仍然使用视频显示类型
                LogManager.Log($"【黑屏视频】跳过视频匹配，节点 {node.nodeId} 设置为黑屏视频");
            }
            else if (TestMode && !string.IsNullOrEmpty(TestVideoPath))
            {
                // 测试模式：使用指定的测试视频
                node.videoClipPath = FormatResourcePath(TestVideoPath);
                node.displayType = VideoNodeDisplayType.Video;
                LogManager.Log($"【测试模式】视频节点 {node.nodeId} 使用测试视频: {node.videoClipPath}");
            }
            else
            {
                // 统一资源查找逻辑：先查视频，再查图片
                string videoPath = FindVideoPath(text);
                if (!string.IsNullOrEmpty(videoPath))
                {
                    node.videoClipPath = videoPath;
                    node.displayType = VideoNodeDisplayType.Video;
                    LogManager.Log($"【视频节点】{node.nodeId} 找到视频，使用视频模式: {videoPath}");
                }
                else
                {
                    string imagePath = FindImagePath(text, "视频节点图片匹配");
                    if (!string.IsNullOrEmpty(imagePath))
                    {
                        node.imagePath = imagePath;
                        node.displayType = VideoNodeDisplayType.Image;
                        node.videoClipPath = "";
                        foundImagesCount++;
                        LogManager.Log($"【图片节点】{node.nodeId} 找到图片，使用图片模式: {imagePath}");
                        // 若为检查点且尚未设置缩略图，则将图片用作检查点缩略图
                        if (node.IsCheckpoint && string.IsNullOrEmpty(node.thumbnailPath))
                        {
                            node.thumbnailPath = imagePath;
                            LogManager.Log($"【匹配缩略图】图片节点作为检查点，未找到专属缩略图，使用自身图片作为缩略图: {node.thumbnailPath}");
                        }
                    }
                }
            }

            // 兜底：如果既没有视频也没有图片，强制用替补视频（黑屏视频节点除外）
            if (string.IsNullOrEmpty(node.videoClipPath) && string.IsNullOrEmpty(node.imagePath) && !isBlackScreenVideo)
            {
                node.videoClipPath = FallbackVideoPath;
                node.displayType = VideoNodeDisplayType.Video;
                LogManager.Log($"【兜底替补】视频节点 {node.nodeId} 没有视频和图片，强制使用替补视频: {FallbackVideoPath}");
            }

            // 设置位置信息 - 将竖向坐标系转换为横向坐标系
            if (entity.location != null && entity.location.Length >= 2)
            {
                // 使用从界面设置的缩放因子
                float yMult = InvertY ? -1f : 1f;
                node.position = new Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
                LogManager.Log($"节点位置转换: 原始位置({entity.location[0]}, {entity.location[1]}) -> Unity位置({node.position.x}, {node.position.y})");
            }



            // 为所有视频节点设置节点名称（如果还没有设置的话）
            if (string.IsNullOrEmpty(node.nodeName))
            {
                // 清理文本中的特殊标记，使用纯文本作为节点名称
                string cleanedText = CleanText(text);
                LogManager.Log($"为视频节点设置名称，清理后文本: \"{cleanedText}\"");

                if (!string.IsNullOrEmpty(cleanedText))
                {
                    node.nodeName = cleanedText;
                    LogManager.Log($"设置视频节点名称为: \"{cleanedText}\"");
                }
                else
                {
                    // 如果清理后的文本为空，使用默认名称
                    node.nodeName = "视频节点";
                    LogManager.Log($"清理后文本为空，使用默认名称'视频节点'");
                }
            }

            return node;
        }

        private JumpNode CreateJumpNode(StoryGraphEntity entity)
        {
            LogManager.Log($"【转换排查】CreateJumpNode开始处理节点: {entity.uuid}, 文本: \"{entity.text}\"");

            var node = new JumpNode();
            node.nodeId = entity.uuid;
            string text = entity.text ?? "";

            // 统一解析广告标记（JumpNode不支持广告，仅解析但不设置）
            ParseAdMark(ref text, out bool requireAd, out string adType);
            // JumpNode不支持广告功能，跳过设置requireAd和adType

            // 清理层级标记（跳转节点不使用该值，仅清理）
            TryExtractAndRemoveTierIndex(ref text, out _);

            // 处理跳转节点标记 [跳转节点]xxxx
            var jumpNodeMatch = Regex.Match(text, @"\[跳转节点\]([^\]]*)");
            if (jumpNodeMatch.Success)
            {
                node.jumpPointId = jumpNodeMatch.Groups[1].Value.Trim();
                text = text.Replace(jumpNodeMatch.Value, "").Trim();

                // 设置跳转点描述（使用清理后的文本）
                string cleanedTextForDescription = CleanText(text);
                if (!string.IsNullOrEmpty(cleanedTextForDescription))
                {
                    node.description = cleanedTextForDescription;
                }
                else
                {
                    node.description = $"跳转到: {node.jumpPointId}";
                }

                LogManager.Log($"【跳转节点】检测到跳转节点标记: {node.nodeId}, 跳转点ID: {node.jumpPointId}, 描述: {node.description}");

                // 设置节点标题
                node.title = $"跳转节点: {node.jumpPointId}";
            }

            // 处理起点标记
            bool isStartNode = text.Contains("[起点]");
            text = text.Replace("[起点]", "").Trim();
            if (isStartNode)
            {
                node.title = "起始跳转节点";
                LogManager.Log($"设置跳转节点为起始节点: {node.nodeId}");
            }

            // 处理检查点标记
            bool isCheckpoint = false;
            string checkpointName = "";

            // 检查带名称的检查点格式 [CP:XXX]
            var cpNameMatch = Regex.Match(text, @"\[CP[：:]([^\]]+)\]");
            if (cpNameMatch.Success)
            {
                isCheckpoint = true;
                checkpointName = cpNameMatch.Groups[1].Value.Trim();
                text = text.Replace(cpNameMatch.Value, "").Trim();
                LogManager.Log($"识别到带名称的检查点: {node.nodeId}, 名称: \"{checkpointName}\"");

                // 设置节点的名称相关属性
                node.title = $"跳转节点检查点: {checkpointName}";
                node.nodeName = checkpointName;
                node.description = $"跳转节点检查点: {checkpointName}";
            }
            // 检查普通检查点格式 [CP]
            else if (text.Contains("[CP]"))
            {
                isCheckpoint = true;
                text = text.Replace("[CP]", "").Trim();
                LogManager.Log($"识别到普通检查点: {node.nodeId}");

                // 清理文本中的其他标记，使用纯文本作为节点名称
                string cleanedText = CleanText(text);
                LogManager.Log($"清理后的文本: \"{cleanedText}\"");

                if (!string.IsNullOrEmpty(cleanedText))
                {
                    node.nodeName = cleanedText;
                    node.description = $"跳转节点检查点: {cleanedText}";
                    LogManager.Log($"设置跳转节点检查点名称为清理后文本: \"{cleanedText}\"");
                }
                else
                {
                    // 如果清理后的文本为空，使用默认名称
                    node.nodeName = "跳转节点检查点";
                    node.description = "跳转节点检查点";
                    LogManager.Log($"清理后文本为空，使用默认名称'跳转节点检查点'");
                }
            }

            // 设置检查点标志
            var field = typeof(BaseNode).GetField("isCheckpoint", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(node, isCheckpoint);
                if (isCheckpoint)
                {
                    LogManager.Log($"设置跳转节点检查点: {node.nodeId}, isCheckpoint已设置为 {isCheckpoint}");
                }
            }
            else
            {
                LogManager.LogError("无法找到isCheckpoint私有字段，请检查BaseNode类的实现");
                node.IsCheckpoint = isCheckpoint; // 如果反射失败，仍使用属性设置
            }

            // 处理条件，与VideoNode相同的方式（JumpNode不支持条件，跳过）
            // ProcessVideoConditions(text, node); // JumpNode不支持条件功能

            // 处理重置到CP点标记
            bool isResetToCP = text.Contains("[重置到CP点]");
            if (isResetToCP)
            {
                node.isResetToCP = true;
                LogManager.Log($"【重置到CP点】设置跳转节点 {node.nodeId} 为重置到CP点节点");

                // 从文本中移除标记
                text = text.Replace("[重置到CP点]", "").Trim();

                // 如果有标题，添加重置到CP点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "重置到CP点";
                }
                else
                {
                    node.title += " | 重置到CP点";
                }
            }

            // 处理变量效果
            ProcessVariableEffects(text, node);

            // 设置位置信息 - 将竖向坐标系转换为横向坐标系
            if (entity.location != null && entity.location.Length >= 2)
            {
                // 使用从界面设置的缩放因子
                float yMult = InvertY ? -1f : 1f;
                node.position = new Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
                LogManager.Log($"跳转节点位置转换: 原始位置({entity.location[0]}, {entity.location[1]}) -> Unity位置({node.position.x}, {node.position.y})");
            }

            // 为跳转节点设置节点名称（如果还没有设置的话）
            if (string.IsNullOrEmpty(node.nodeName))
            {
                // 清理文本中的特殊标记，使用纯文本作为节点名称
                string cleanedText = CleanText(text);
                LogManager.Log($"为跳转节点设置名称，清理后文本: \"{cleanedText}\"");

                if (!string.IsNullOrEmpty(cleanedText))
                {
                    node.nodeName = cleanedText;
                    LogManager.Log($"设置跳转节点名称为: \"{cleanedText}\"");
                }
                else
                {
                    // 如果清理后的文本为空，使用默认名称
                    node.nodeName = "跳转节点";
                    LogManager.Log($"清理后文本为空，使用默认名称'跳转节点'");
                }
            }

            return node;
        }

        private ChoiceNode CreateChoiceNode(StoryGraphEntity entity)
        {
            var node = new ChoiceNode();
            node.nodeId = entity.uuid;

            string text = entity.text;

            // 统一解析广告标记
            ParseAdMark(ref text, out bool requireAd, out string adType);
            node.requireAd = requireAd;
            node.adType = adType;

            // 解析并设置层级标记（默认为0）
            node.tierIndex = 0;
            int parsedTier;
            if (TryExtractAndRemoveTierIndex(ref text, out parsedTier))
            {
                node.tierIndex = parsedTier;
                LogManager.Log($"【层级标记】设置选项节点 {node.nodeId} 的 tierIndex={node.tierIndex}");
            }

            // 处理[解锁成就:XXX]标记
            var unlockAchMatch = Regex.Match(text, @"\[解锁成就:([^\]]+)\]");
            if (unlockAchMatch.Success)
            {
                node.unlockAchievement = true;
                node.unlockAchievementName = unlockAchMatch.Groups[1].Value.Trim();
                text = text.Replace(unlockAchMatch.Value, "").Trim();
                LogManager.Log($"【解锁成就】检测到解锁成就标记: {node.unlockAchievementName}");
            }

            // 处理死亡节点标记（适用于任意节点类型）
            if (text.Contains("[死亡节点]"))
            {
                node.isDeadpoint = true;
                text = text.Replace("[死亡节点]", "").Trim();
            }

            // 处理起点标记
            bool isStartNode = text.Contains("[起点]");
            text = text.Replace("[起点]", "").Trim();
            if (isStartNode)
            {
                node.title = "起始节点";
                LogManager.Log($"设置选项节点为起始节点: {node.nodeId}");
            }

            // 处理选项节点标记
            if (text.StartsWith("[选项]"))
            {
                text = text.Replace("[选项]", "").Trim();
            }

            // 新增：处理叠加图片选项标记 [叠加图片选项] 或 [叠加图片选项:图片名] 或 [叠加图片选项:false]
            // 支持标记中可能包含的空格，如 [ 叠加图片选项 : 图片名 ] 或 [ 叠加图片选项 : false ]
            var overlayImageMatch = Regex.Match(text, @"\[\s*叠加图片选项\s*(?:[：:]\s*([^\]]+?)\s*)?\s*\]");
            if (overlayImageMatch.Success)
            {
                node.isOverlayImageChoice = true;
                string imageName = overlayImageMatch.Groups[1].Success ? overlayImageMatch.Groups[1].Value.Trim() : "";
                text = text.Replace(overlayImageMatch.Value, "").Trim();

                // 检查是否指定了false（不可点击）
                if (imageName.Equals("false", StringComparison.OrdinalIgnoreCase))
                {
                    node.isClickable = false;
                    LogManager.Log($"【叠加图片选项】设置叠加图片选项: {node.nodeId} 为不可点击状态");
                }

                // 统一处理图片路径匹配逻辑
                string searchText = "";
                string logPrefix = "";
                
                if (!string.IsNullOrEmpty(imageName) && !imageName.Equals("false", StringComparison.OrdinalIgnoreCase))
                {
                    // 使用指定的图片名
                    searchText = imageName;
                    logPrefix = "指定图片";
                }
                else
                {
                    // 使用清理后的文本
                    searchText = CleanText(text);
                    logPrefix = imageName.Equals("false", StringComparison.OrdinalIgnoreCase) ? "不可点击选项" : "清理后文本";
                }

                // 查找图片路径
                if (!string.IsNullOrEmpty(searchText))
                {
                    node.overlayImagePath = FindImagePath(searchText, "叠加图片选项匹配");
                    if (string.IsNullOrEmpty(FindImagePath(searchText, "叠加图片选项匹配")))
                    {
                        node.overlayImagePath = FallbackImagePath;
                    }
                    
                    // 设置图片信息
                    if (!String.IsNullOrEmpty(CleanPathTool.FullPath(node.overlayImagePath)))
                    {
                        SetImageInfo(CleanPathTool.FullPath(node.overlayImagePath));
                    }
                    
                    LogManager.Log($"【叠加图片选项】{logPrefix}查找图片: {searchText} -> {node.overlayImagePath}");
                }

                LogManager.Log($"【叠加图片选项】设置叠加图片选项: {node.nodeId}, 图片路径: {node.overlayImagePath}, 可点击: {node.isClickable}");
            }

            // 处理隐藏选项标记 - 条件不满足时完全不显示（支持[隐藏选项]和[隐藏]两种标记）
            bool isHiddenOption = text.Contains("[隐藏选项]") || text.Contains("[隐藏]");
            if (isHiddenOption)
            {
                if (text.Contains("[隐藏选项]"))
                {
                    text = text.Replace("[隐藏选项]", "").Trim();
                }
                if (text.Contains("[隐藏]"))
                {
                    text = text.Replace("[隐藏]", "").Trim();
                }
                node.showWhenUnavailable = false;
                LogManager.Log($"设置隐藏选项节点: {node.nodeId}, 文本: \"{text}\", 条件不满足时不显示");
            }
            else
            {
                // 默认情况下，不满足条件的选项仍然会显示
                node.showWhenUnavailable = true;
            }

            // 新增：处理概率选项标记 《概率%:数量》 或 《概率%：数量》 或 《概率%》 或 《变量名%》
            var probabilityMatchWithCount = Regex.Match(text, @"《(\d+(?:\.\d+)?)%[：:](\d+)》");
            var probabilityMatchSimple = Regex.Match(text, @"《(\d+(?:\.\d+)?)%》");
            var probabilityMatchVar = Regex.Match(text, @"《\s*([^》%]+?)\s*%》"); // 捕获《变量名%》，忽略前后空格

            if (probabilityMatchWithCount.Success)
            {
                node.isProbabilityChoice = true;
                if (float.TryParse(probabilityMatchWithCount.Groups[1].Value, out float prob))
                {
                    node.probability = prob;
                }
                if (int.TryParse(probabilityMatchWithCount.Groups[2].Value, out int maxCount))
                {
                    node.maxCount = maxCount;
                }
                text = text.Replace(probabilityMatchWithCount.Value, "").Trim();
                LogManager.Log($"【概率选项】检测到概率选项(带数量): {node.nodeId}, 概率={node.probability}%, 最大数量={node.maxCount}");
            }
            else if (probabilityMatchSimple.Success)
            {
                node.isProbabilityChoice = true;
                if (float.TryParse(probabilityMatchSimple.Groups[1].Value, out float prob))
                {
                    node.probability = prob;
                }
                // 调整：简单格式《x%》不受组数限制，设为独立掷骰
                node.maxCount = 0;
                text = text.Replace(probabilityMatchSimple.Value, "").Trim();
                LogManager.Log($"【概率选项】检测到概率选项(简单格式-独立掷骰): {node.nodeId}, 概率={node.probability}%");
            }
            // 变量概率：《变量名%》 -> 设置表达式，独立掷骰
            else if (probabilityMatchVar.Success)
            {
                string exprName = probabilityMatchVar.Groups[1].Value.Trim();
                
                // 检查是否为纯数字，如果是则跳过（避免与数字概率混淆）
                if (float.TryParse(exprName, out _))
                {
                    // 纯数字，跳过这个匹配，让其他正则处理
                }
                else
                {
                    node.isProbabilityChoice = true;
                    node.probabilityExpression = exprName; // 不带%，已去除空格
                    node.maxCount = 0; // 独立掷骰
                    text = text.Replace(probabilityMatchVar.Value, "").Trim();
                    LogManager.Log($"【概率选项】检测到变量概率选项: {node.nodeId}, 表达式={node.probabilityExpression}%");

                    // 可选：将变量加入提取列表，便于变量系统识别
                    if (ExtractVariables && !string.IsNullOrEmpty(node.probabilityExpression))
                    {
                        AddVariableToExtractedList(node.probabilityExpression);
                    }
                }
            }

            // 新增：处理提前显示标记 [提前]
            bool isShowEarly = text.Contains("[提前]");
            if (isShowEarly)
            {
                node.showEarly = true;
                text = text.Replace("[提前]", "").Trim();
                LogManager.Log($"【提前显示】检测到提前显示标记: {node.nodeId}, 文本: \"{text}\"");
            }

            // 处理重置到CP点标记
            bool isResetToCP = text.Contains("[重置到CP点]");
            LogManager.Log($"【转换调试】选项节点 {node.nodeId} 检查重置到CP点标记: {isResetToCP}, 原始文本: \"{text}\"");
            if (isResetToCP)
            {
                node.isResetToCP = true;
                LogManager.Log($"【重置到CP点】设置选项节点 {node.nodeId} 为重置到CP点节点");

                // 从文本中移除标记
                text = text.Replace("[重置到CP点]", "").Trim();

                // 如果有标题，添加重置到CP点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "重置到CP点";
                }
                else
                {
                    node.title += " | 重置到CP点";
                }
            }

            // 处理条件
            text = ProcessConditions(text, node);

            // 处理变量效果
            ProcessVariableEffects(text, node);

            // 设置选项文本（移除所有标记后的文本）
            string cleanedText = CleanText(text);
            node.choiceText = cleanedText;

            // 检测并设置动态文本模式
            node.DetectAndSetDynamicText(cleanedText);

            // 设置位置信息 - 将竖向坐标系转换为横向坐标系
            if (entity.location != null && entity.location.Length >= 2)
            {
                // 使用与VideoNode相同的转换逻辑
                float yMult = InvertY ? -1f : 1f;
                node.position = new Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
            }

            return node;
        }

        private void ProcessCGMarkers(string text, VideoNode node)
        {
            var cgStartMatch = Regex.Match(text, @"\[CG Start ([^\]]+)\]");
            var cgEndMatch = Regex.Match(text, @"\[CG End ([^\]]+)\]");

            if (cgStartMatch.Success)
            {
                // 将CG信息存储在节点标题中，暂时存储
                node.title = "CG开始: " + cgStartMatch.Groups[1].Value;
                // 注意：我们现在不使用直接的cgStart和cgId属性，而是将信息存储在node.title中
            }

            if (cgEndMatch.Success)
            {
                // 同样将CG结束信息存储在备注字段中
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "CG结束: " + cgEndMatch.Groups[1].Value;
                }
                else
                {
                    node.title += " | CG结束";
                }
            }
        }

        /// <summary>
        /// 处理对话框标记 [对话框:XXXX] 或 [对话框:XXXX:音频名] 或 [对话框（说话人）：对话内容]
        /// </summary>
        private void ProcessDialogMarkers(string text, VideoNode node)
        {
            LogManager.Log($"【转换排查】ProcessDialogMarkers开始处理文本: \"{text}\"");

            // 新正则：支持跨行匹配 [对话框:内容]、[对话框:内容:音频]、[对话框(说话人):内容]、[对话框(说话人):内容:音频]
            var dialogMatch = Regex.Match(
                text,
                @"[\[［]对话框\s*(?:[（(]\s*(?<speaker>[^）)]+)\s*[）)])?\s*[：:]\s*(?<content>[\s\S]*?)[\]］]",
                RegexOptions.Singleline
            );
            LogManager.Log($"【转换排查】对话框正则匹配结果: Success={dialogMatch.Success}, Value=\"{dialogMatch.Value}\"");

            if (dialogMatch.Success)
            {
                string speakerName = dialogMatch.Groups["speaker"].Success ? dialogMatch.Groups["speaker"].Value.Trim() : "";
                string content = dialogMatch.Groups["content"].Value.Trim();
                LogManager.Log($"【转换排查】提取的speaker: {speakerName}, content: {content}");

                // 原有格式处理（调整规则）：
                // 仅当内容中包含两个或以上冒号时，才将最后一段视为音频名；
                // 只有一个冒号时，不视为音频名，全部作为对话内容。
                var parts = content.Split(new[] { ':', '：' });
                string dialogText, audioName;
                if (parts.Length > 2)
                {
                    audioName = parts[parts.Length - 1].Trim();
                    dialogText = string.Join(":", parts.Take(parts.Length - 1)).Trim();
                    LogManager.Log($"【转换排查】分割后（>=2个冒号）：对话内容={dialogText}, 音频={audioName}");
                }
                else
                {
                    dialogText = content;
                    audioName = string.Empty;
                    LogManager.Log($"【转换排查】按规则不提取音频名（<2个冒号）：对话内容={dialogText}");
                }

                // 规范化对话内容中的颜色标签
                dialogText = NormalizeColorTags(dialogText);

                // 设置节点为对话节点
                node.isDialogNode = true;
                node.dialogText = dialogText;
                node.dialogSpeaker = speakerName;
                node.typingSpeed = GameGlobalConfig.TypingSpeed; // 默认打字速度0.05f

                // 设置对话音频路径
                if (!string.IsNullOrEmpty(audioName))
                {
                    node.dialogAudioPath = FindSpecifiedAudioPath(audioName);
                }
                else
                {
                    // 未显式指定音频名：先移除文本中的 #...# 标记，避免将标记音频误判为对话音频线索
                    string cleanedForAudioGuess = System.Text.RegularExpressions.Regex.Replace(dialogText, "#([^#]+)#", string.Empty);
                    node.dialogAudioPath = FindDialogAudioPath(cleanedForAudioGuess);
                }

                LogManager.Log($"【转换排查】设置对话节点: nodeId={node.nodeId}, speaker=\"{speakerName}\", dialogText=\"{dialogText}\", dialogAudioPath=\"{node.dialogAudioPath}\"");

                // 如果节点标题为空，设置为"对话节点"
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "对话节点";
                }
                else
                {
                    node.title += " | 对话节点";
                }

                // 为对话框节点设置正确的节点名称
                string originalText = text;
                string nodeName = "";
                string remainingText = originalText.Replace(dialogMatch.Value, "").Trim();
                LogManager.Log($"【转换排查】对话框节点剩余文本: \"{remainingText}\"");
                if (!string.IsNullOrEmpty(remainingText))
                {
                    string cleanedRemainingText = CleanText(remainingText);
                    cleanedRemainingText = NormalizeColorTags(cleanedRemainingText);
                    if (!string.IsNullOrEmpty(cleanedRemainingText))
                    {
                        nodeName = cleanedRemainingText;
                        LogManager.Log($"【转换排查】设置对话框节点名称为: \"{nodeName}\"");
                    }
                }
                if (!string.IsNullOrEmpty(nodeName))
                {
                    node.nodeName = nodeName;
                }
                else
                {
                    node.nodeName = dialogText;
                    LogManager.Log($"【转换排查】使用对话内容作为节点名称: \"{dialogText}\"");
                }

                // 查找图片 - 测试模式下跳过图片查找，使用测试视频
                if (TestMode && !string.IsNullOrEmpty(TestVideoPath))
                {
                    LogManager.Log($"【测试模式】对话框节点 {node.nodeId} 在测试模式下跳过图片查找，将使用测试视频");
                    // 不设置图片路径，让后续的测试模式逻辑处理
                }
                else
                {
                    string imagePath = "";
                    if (!string.IsNullOrEmpty(node.nodeName))
                    {
                        imagePath = FindImagePath(node.nodeName, "对话框图片匹配");
                        LogManager.Log($"【对话框图片】使用节点名称查找图片: \"{node.nodeName}\"");
                    }
                    else
                    {
                        imagePath = FindImagePath(text, "对话框图片匹配");
                        LogManager.Log($"【对话框图片】使用原始文本查找图片: \"{text}\"");
                    }
                    if (!string.IsNullOrEmpty(imagePath))
                    {
                        node.imagePath = imagePath;
                        node.displayType = VideoNodeDisplayType.Image;
                        foundImagesCount++;
                        LogManager.Log($"【图片节点】对话框节点 {node.nodeId} 设置为图片模式，图片路径: {node.imagePath}");
                    }
                    else
                    {
                        node.displayType = VideoNodeDisplayType.Video;
                        LogManager.Log($"【对话节点】对话框节点 {node.nodeId} 未找到图片，使用视频模式");
                    }
                }

            }
            else
            {
                LogManager.Log($"【转换排查】未检测到对话框标记，文本: \"{text}\"");
            }
        }

        /// <summary>
        /// 查找指定名称的音频路径
        /// </summary>
        private string FindSpecifiedAudioPath(string audioName)
        {
            if (string.IsNullOrEmpty(audioName))
            {
                return string.Empty;
            }

            // 根据存放文件说明，更新指定音频查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/Dialogues",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/VoiceOver",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/BGM",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/SoundEffects",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/StoryCollections/CollectionBGM",
                "Assets/Resources/Audio/Dialog",
                "Assets/Resources/Audio/Voice",
                "Assets/Resources/Audio",
                "Assets/Resources/BGM",
                "Assets/Resources/Voice",
                "Assets/Resources/Dialog",
                "Assets/Resources"
            };

            // 搜集所有可能的音频文件
            List<string> allAudioFiles = new List<string>();
            foreach (var directory in searchDirectories)
            {
                // 确保目录存在
                if (!Directory.Exists(directory))
                {
                    continue;
                }

                // 搜索目录下的所有音频文件
                string[] audioExtensions = new string[] { "*.mp3", "*.wav", "*.ogg" };

                foreach (var extension in audioExtensions)
                {
                    try
                    {
                        allAudioFiles.AddRange(Directory.GetFiles(directory, extension, SearchOption.AllDirectories));
                    }
                    catch (System.Exception ex)
                    {
                        LogManager.LogWarning($"【音频查找】搜索目录时出错: {directory}, {extension}, 错误: {ex.Message}");
                    }
                }
            }

            // 查找包含指定音频名的文件
            foreach (var file in allAudioFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Contains(audioName) || audioName.Contains(fileName))
                {
                    string formattedPath = FormatResourcePath(file);
                    LogManager.Log($"【音频查找】找到音频文件: {file} -> {formattedPath}");
                    return formattedPath;
                }
            }

            // 找不到音频文件时，输出错误信息但继续处理
            LogManager.Log($"【音频查找】未找到音频文件: {audioName}，跳过音频播放，继续处理对话节点");
            return string.Empty;
        }

        /// <summary>
        /// 查找对话音频路径
        /// </summary>
        private string FindDialogAudioPath(string dialogText)
        {
            LogManager.Log($"【对话音频】开始查找对话音频: \"{dialogText}\"");

            // 提取对话的前几个字符作为音频文件名的一部分
            string audioNameBase = dialogText;

            // 如果对话文本包含冒号，提取冒号前的部分作为角色名
            string characterName = "";
            int colonIndex = dialogText.IndexOf('：');
            if (colonIndex >= 0)
            {
                characterName = dialogText.Substring(0, colonIndex).Trim();
                LogManager.Log($"【对话音频】提取角色名: \"{characterName}\"");
            }

            // 根据存放文件说明，更新对话音频查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/Dialogues",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/VoiceOver",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/BGM",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/SoundEffects",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/StoryCollections/CollectionBGM",
                "Assets/Resources/Audio/Dialog",
                "Assets/Resources/Audio/Voice",
                "Assets/Resources/Audio",
                "Assets/Resources/BGM",
                "Assets/Resources/Voice",
                "Assets/Resources/Dialog",
                "Assets/Resources"
            };

            // 搜集所有可能的音频文件
            List<string> allAudioFiles = new List<string>();
            foreach (var directory in searchDirectories)
            {
                // 确保目录存在
                if (!Directory.Exists(directory))
                {
                    LogManager.Log($"【对话音频】目录不存在，跳过: {directory}");
                    continue;
                }

                // 搜索目录下的所有音频文件
                string[] audioExtensions = new string[] { "*.mp3", "*.wav", "*.ogg" };

                foreach (var extension in audioExtensions)
                {
                    try
                    {
                        allAudioFiles.AddRange(Directory.GetFiles(directory, extension, SearchOption.AllDirectories));
                    }
                    catch (System.Exception ex)
                    {
                        LogManager.LogWarning($"【对话音频】搜索目录时出错: {directory}, {extension}, 错误: {ex.Message}");
                    }
                }
            }

            LogManager.Log($"【对话音频】共找到 {allAudioFiles.Count} 个音频文件");

            if (allAudioFiles.Count == 0)
            {
                LogManager.LogError($"【对话音频】未找到任何音频文件，跳过音频播放，继续处理对话节点");
                return string.Empty;
            }

            // 1. 如果提取到了角色名，优先查找包含角色名的音频文件
            if (!string.IsNullOrEmpty(characterName))
            {
                foreach (var file in allAudioFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.Contains(characterName))
                    {
                        string formattedPath = FormatResourcePath(file);
                        LogManager.Log($"【对话音频】找到包含角色名的音频: {file} -> {formattedPath}");
                        return formattedPath;
                    }
                }
            }

            // 2. 尝试查找包含对话文本前几个字符的音频文件
            if (dialogText.Length > 5)
            {
                string shortText = dialogText.Substring(0, Math.Min(10, dialogText.Length));
                foreach (var file in allAudioFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.Contains(shortText) || shortText.Contains(fileName))
                    {
                        string formattedPath = FormatResourcePath(file);
                        LogManager.Log($"【对话音频】找到包含对话文本前几个字符的音频: {file} -> {formattedPath}");
                        return formattedPath;
                    }
                }
            }

            // 3. 如果没有找到匹配的音频，输出错误信息但继续处理
            LogManager.Log($"【对话音频】未找到匹配的音频，跳过音频播放，继续处理对话节点");
            return string.Empty;
        }

        private void ProcessVariableEffects(string text, BaseNode node)
        {
            var effects = new List<VariableEffect>();
            var rateEffects = new List<VideoGameFramework.Models.VariableRateEffect>();
            // 先移除《》包裹的内容，再匹配<>内的变量效果，避免复杂的不定长回溯
            string textWithoutChineseBrackets = Regex.Replace(text, "《[^》]*》", "");
            // 跳过富文本标签，避免被当作变量效果解析（允许空格变体）
            textWithoutChineseBrackets = Regex.Replace(textWithoutChineseBrackets, @"<\s*/?\s*color\s*(=\s*[^>]*)?\s*>", "", RegexOptions.IgnoreCase);
            textWithoutChineseBrackets = Regex.Replace(textWithoutChineseBrackets, @"<\s*/?\s*(b|i)\s*>", "", RegexOptions.IgnoreCase);
            textWithoutChineseBrackets = Regex.Replace(textWithoutChineseBrackets, @"<\s*/?\s*size\s*(=\s*[^>]*)?\s*>", "", RegexOptions.IgnoreCase);
            // 放宽尖括号匹配，允许括号内外存在空格
            var matches = Regex.Matches(textWithoutChineseBrackets, @"<\s*([^>]+?)\s*>");

            LogManager.Log($"【变量效果处理】开始处理节点文本: '{text}'");
            LogManager.Log($"【变量效果处理】找到 {matches.Count} 个变量效果标记");

            foreach (Match match in matches)
            {
                // 去除括号内内容的前后空白，避免因前导空格导致解析失败
                string effectText = match.Groups[1].Value.Trim();
                LogManager.Log($"【变量效果处理】处理效果文本: '{effectText}'");

                // 新增：检测全局最大值标记，例如 <全局最大值:999> 或 <全局最大值：999>
                var globalMaxMatch = Regex.Match(effectText, @"^\s*全局\s*最大值\s*[:：]\s*(.+?)\s*$");
                if (globalMaxMatch.Success)
                {
                    globalMaxValueOverride = globalMaxMatch.Groups[1].Value.Trim();
                    LogManager.Log($"【变量效果处理】检测到全局最大值标记，全局最大值设置为: {globalMaxValueOverride}");
                    // 立刻应用到当前已提取的变量
                    ApplyGlobalMaxToExtractedVariables();
                    continue;
                }

                // 新增：检测全局最小值标记，例如 <全局最小值:0> 或 <全局最小值：0>
                var globalMinMatch = Regex.Match(effectText, @"^\s*全局\s*最小值\s*[:：]\s*(.+?)\s*$");
                if (globalMinMatch.Success)
                {
                    string globalMinValue = globalMinMatch.Groups[1].Value.Trim();
                    LogManager.Log($"【变量效果处理】检测到全局最小值标记，全局最小值设置为: {globalMinValue}");
                    // 应用到当前已提取的变量的 minValue
                    if (ExtractedVariables != null)
                    {
                        foreach (var v in ExtractedVariables)
                        {
                            if (v != null)
                            {
                                v.minValue = globalMinValue;
                            }
                        }
                    }
                    continue;
                }

                // 新增：检测每秒变化标记，仅对视频节点有效，格式如 <变量 +x/s> 或 <变量 -x/s>
                var rateMatch = Regex.Match(effectText, @"^\s*(.+?)\s*([+\-])\s*(\d+(?:\.\d+)?)\s*/\s*s\s*$", RegexOptions.IgnoreCase);
                if (rateMatch.Success)
                {
                    if (node is VideoGameFramework.Models.VideoNode)
                    {
                        string varName = rateMatch.Groups[1].Value.Trim();
                        string sign = rateMatch.Groups[2].Value;
                        string num = rateMatch.Groups[3].Value;
                        if (float.TryParse(num, out float magnitude))
                        {
                            float rate = sign == "-" ? -magnitude : magnitude;
                            rateEffects.Add(new VideoGameFramework.Models.VariableRateEffect
                            {
                                variableName = varName,
                                ratePerSecond = rate
                            });
                            LogManager.Log($"【变量效果处理】检测到每秒变化标记: {varName} {(rate >= 0 ? "+" : "")}{rate}/s");
                            // 变量提取
                            if (ExtractVariables)
                            {
                                AddVariableToExtractedList(varName);
                            }
                        }
                    }
                    else
                    {
                        LogManager.Log($"【变量效果处理】每秒变化标记仅对视频节点生效，已忽略: '{effectText}'");
                    }
                    continue;
                }

                // 新增：检测最大默认值标记，例如 <最大默认值:体力:150> 或 <最大默认值：体力：150>
                var nodeMaxOverrideMatch = Regex.Match(effectText, @"^\s*最大\s*默认值\s*[:：]\s*([^:：]+?)\s*[:：]\s*(.+?)\s*$");
                LogManager.Log($"【变量效果处理】最大默认值匹配测试: '{effectText}' -> Success={nodeMaxOverrideMatch.Success}");
                if (nodeMaxOverrideMatch.Success)
                {
                    string varName = nodeMaxOverrideMatch.Groups[1].Value.Trim();
                    string maxVal = nodeMaxOverrideMatch.Groups[2].Value.Trim();
                    LogManager.Log($"【变量效果处理】最大默认值解析结果: 变量名='{varName}', 最大值='{maxVal}'");
                    if (node != null)
                    {
                        if (node.maxDefaultValueOverrides == null)
                        {
                            node.maxDefaultValueOverrides = new List<VideoGameFramework.Models.VariableMaxOverride>();
                        }
                        node.maxDefaultValueOverrides.Add(new VideoGameFramework.Models.VariableMaxOverride
                        {
                            variableName = varName,
                            maxValue = maxVal
                        });
                        LogManager.Log($"【变量效果处理】记录节点级最大默认值覆盖: {varName} -> {maxVal}");
                    }
                    continue;
                }

                // 新增：检测最小默认值标记，例如 <最小默认值:体力:10> 或 <最小默认值：体力：10>
                var nodeMinOverrideMatch = Regex.Match(effectText, @"^\s*最小\s*默认值\s*[:：]\s*([^:：]+?)\s*[:：]\s*(.+?)\s*$");
                if (nodeMinOverrideMatch.Success)
                {
                    string varName = nodeMinOverrideMatch.Groups[1].Value.Trim();
                    string minVal = nodeMinOverrideMatch.Groups[2].Value.Trim();
                    if (node != null)
                    {
                        if (node.minDefaultValueOverrides == null)
                        {
                            node.minDefaultValueOverrides = new List<VideoGameFramework.Models.VariableMinOverride>();
                        }
                        node.minDefaultValueOverrides.Add(new VideoGameFramework.Models.VariableMinOverride
                        {
                            variableName = varName,
                            minValue = minVal
                        });
                        LogManager.Log($"【变量效果处理】记录节点级最小默认值覆盖: {varName} -> {minVal}");
                    }
                    continue;
                }

                // 检查是否是默认值设置标记
                if (effectText.StartsWith("默认 "))
                {
                    LogManager.Log($"【变量效果处理】识别为默认值设置标记");
                    // 处理默认值设置
                    ProcessDefaultValueSetting(effectText.Substring(3).Trim());
                    continue;
                }

                // 检查是否是A:变量名=值的格式（既作为默认值设置，也作为变量效果）
                if (effectText.Contains("=") && (effectText.StartsWith("A:") || effectText.StartsWith("A：")))
                {
                    LogManager.Log($"【变量效果处理】识别为A:变量名=值格式，同时处理默认值设置和变量效果");

                    // 1. 先处理为默认值设置（确保变量存在）
                    ProcessDefaultValueSetting(effectText);

                    // 2. 再处理为变量效果（运行时赋值）
                    var defaultEffect = ParseVariableEffect(effectText);
                    if (defaultEffect != null)
                    {
                        effects.Add(defaultEffect);
                        LogManager.Log($"【变量效果处理】成功添加变量效果: {defaultEffect.variableName} = {defaultEffect.value}");
                    }
                    continue;
                }

                LogManager.Log($"【变量效果处理】尝试解析为变量效果");
                var effect = ParseVariableEffect(effectText);
                if (effect != null)
                {
                    effects.Add(effect);
                    LogManager.Log($"【变量效果处理】成功添加变量效果: {effect.variableName}");

                    // 如果启用了变量提取，将变量添加到提取列表
                    if (ExtractVariables)
                    {
                        // 仅当设置操作时，根据=右侧值推断类型
                        string rhs = effect.operation == VariableEffectOperation.Set ? effect.value : null;
                        AddVariableToExtractedList(effect.variableName, false, rhs);
                    }
                }
                else
                {
                    LogManager.LogWarning($"【变量效果处理】无法解析变量效果: '{effectText}'");
                }
            }

            if (node is VideoNode videoNode)
            {
                videoNode.effects = effects;
                videoNode.rateEffects = rateEffects;
            }
            else if (node is ChoiceNode choiceNode)
            {
                choiceNode.effects = effects;
            }
            else if (node is CardNode cardNode)
            {
                cardNode.effects = effects;
                LogManager.Log($"为卡牌节点 {cardNode.nodeId} 设置 {effects.Count} 个变量效果");
            }
        }

        // 添加处理默认值设置的方法
        private void ProcessDefaultValueSetting(string text)
        {
            LogManager.Log($"【默认值设置】开始处理: {text}");

            // 先检查是否是全局最大值直接设置（允许用户把它写成默认值行里）
            var globalMaxLine = Regex.Match(text, @"^\s*全局最大值\s*[:：]\s*(.+?)\s*$");
            if (globalMaxLine.Success)
            {
                globalMaxValueOverride = globalMaxLine.Groups[1].Value.Trim();
                LogManager.Log($"【默认值设置】识别到全局最大值标记，全局最大值设置为: {globalMaxValueOverride}");
                ApplyGlobalMaxToExtractedVariables();
                return;
            }

            // 匹配格式: [A:]或[A：]变量名 =值
            var match = Regex.Match(text, @"^(A[:：])?(.*?)\s*=\s*(.*)$");
            if (!match.Success)
            {
                LogManager.LogWarning($"【默认值设置】格式不正确: {text}");
                return;
            }

            bool isAccumulative = match.Groups[1].Success; // 检查是否有A:前缀
            string variableName = match.Groups[2].Value.Trim();
            string rhsValue = match.Groups[3].Value.Trim();

            // 统一规范化变量名
            variableName = NormalizeVariableName(variableName);
            LogManager.Log($"【默认值设置】解析结果: 累加={isAccumulative}, 变量名='{variableName}', 默认值='{rhsValue}'");

            // 如果启用了变量提取，添加或更新变量
            if (ExtractVariables)
            {
                // 检查变量是否已存在
                var existingVariable = ExtractedVariables.FirstOrDefault(v => v.name == variableName);
                if (existingVariable != null)
                {
                    LogManager.Log($"[aiyouwei]{existingVariable.name},类型{existingVariable.persistenceType}");
                    // 已存在且为累加类型
                    if (existingVariable.persistenceType == VariablePersistenceType.Accumulative)
                    {
                        LogManager.Log($"[aiyouwei]{existingVariable.name},类型{existingVariable.persistenceType}[]");
                        // 更新类型与默认值（依据 RHS 推断）
                        var inferredTypeLocal = InferVariableTypeFromValue(rhsValue, out var _);
                        existingVariable.type = inferredTypeLocal;
                        existingVariable.defaultValue = GetDefaultValueByType(inferredTypeLocal);
                        existingVariable.minValue = "0";
                        existingVariable.maxValue = "100";
                        existingVariable.usePlayerPrefs = true;
                        existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(inferredTypeLocal);
                        existingVariable.showAsProgress = true;
                        existingVariable.iconPath = string.Empty;
                        existingVariable.isHidden = existingVariable.isHidden == false ? false : true;
                        existingVariable.order = (existingVariable.order == -1 || existingVariable.order == 0) ? ++order : existingVariable.order;
                        return;
                    }
                    // 已存在且为章节类型
                    else if (existingVariable.persistenceType == VariablePersistenceType.ChapterConstant)
                    {
                        if (isAccumulative)
                        {
                            // 删除原有章节类型变量，准备添加累加类型变量
                            ExtractedVariables.Remove(existingVariable);
                            LogManager.Log($"【变量提取】变量 {variableName} 已存在且为章节类型，删除原变量，准备添加累加类型变量");
                            // 继续往下走，创建新变量
                        }
                        else
                        {
                            // 更新类型与默认值（依据 RHS 推断）
                            LogManager.Log($"【变量提取】变量 {variableName} 已存在且为章节类型，更新字段");
                            var inferredTypeLocal2 = InferVariableTypeFromValue(rhsValue, out var _);
                            existingVariable.type = inferredTypeLocal2;
                            existingVariable.defaultValue = GetDefaultValueByType(inferredTypeLocal2);
                            existingVariable.minValue = "0";
                            existingVariable.maxValue = "100";
                            existingVariable.usePlayerPrefs = true;
                            existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(inferredTypeLocal2);
                            existingVariable.showAsProgress = true;
                            existingVariable.iconPath = string.Empty;
                            existingVariable.isHidden = existingVariable.isHidden == false ? false : true;
                            existingVariable.order = (existingVariable.order == -1 || existingVariable.order == 0) ? ++order : existingVariable.order;
                            return;
                        }
                    }
                    // 已存在且为 NULL：更新字段并按“累加优先，否则章节”，默认值置0
                    else if (existingVariable.persistenceType == VariablePersistenceType.NULL)
                    {
                        var targetType = isAccumulative ? VariablePersistenceType.Accumulative : VariablePersistenceType.ChapterConstant;
                        existingVariable.persistenceType = targetType;
                        var inferredTypeLocal3 = InferVariableTypeFromValue(rhsValue, out var _);
                        existingVariable.type = inferredTypeLocal3;
                        existingVariable.defaultValue = GetDefaultValueByType(inferredTypeLocal3);
                        existingVariable.minValue = "0";
                        existingVariable.maxValue = "100";
                        existingVariable.usePlayerPrefs = true;
                        existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(inferredTypeLocal3);
                        existingVariable.showAsProgress = true;
                        existingVariable.iconPath = string.Empty;
                        existingVariable.isHidden = existingVariable.isHidden == false ? false : true;
                        existingVariable.order = (existingVariable.order == -1 || existingVariable.order == 0) ? ++order : existingVariable.order;
                        LogManager.Log($"【默认值设置】变量 {variableName} 为NULL类型，已更新字段并设置类型为 {existingVariable.persistenceType}");
                        return;
                    }
                    else
                    {
                        // 创建新的变量数据，格式与Chapter1.json一致
                        var inferredTypeNewLocal = InferVariableTypeFromValue(rhsValue, out var inferredFromVar);
                        var variableData = new VariableData
                        {
                            name = variableName,
                            displayName = variableName,
                            description = $"从剧情文件 {Path.GetFileName(inputPath)} 中提取的{(isAccumulative ? "累加" : "章节")}变量",
                            type = inferredTypeNewLocal,
                            persistenceType = isAccumulative ? VariablePersistenceType.Accumulative : VariablePersistenceType.ChapterConstant,
                            defaultValue = GetDefaultValueByType(inferredTypeNewLocal),
                            minValue = "0",
                            maxValue = "100",
                            usePlayerPrefs = true,
                            playerPrefsDefaultValue = GetDefaultValueByType(inferredTypeNewLocal),
                            showAsProgress = true,
                            iconPath = string.Empty, // 初始化为空字符串
                            isHidden = false,
                            order = ++order
                        };
                        ExtractedVariables.Add(variableData);
                        LogManager.Log($"【默认值设置】创建{(isAccumulative ? "累加" : "章节")}变量 {variableName}，类型={inferredTypeNewLocal}，默认值={variableData.defaultValue}");
                        return;
                    }
                }
                // 如果 existingVariable 为 null，走新建变量逻辑
                var inferredTypeNew = InferVariableTypeFromValue(rhsValue, out var inferredFromVarNew);
                var newVariableData = new VariableData
                {
                    name = variableName,
                    displayName = variableName,
                    description = $"从剧情文件 {Path.GetFileName(inputPath)} 中提取的{(isAccumulative ? "累加" : "章节")}变量",
                    type = inferredTypeNew,
                    persistenceType = isAccumulative ? VariablePersistenceType.Accumulative : VariablePersistenceType.ChapterConstant,
                    defaultValue = GetDefaultValueByType(inferredTypeNew),
                    minValue = "0",
                    maxValue = "100",
                    usePlayerPrefs = true,
                    playerPrefsDefaultValue = GetDefaultValueByType(inferredTypeNew),
                    showAsProgress = true,
                    iconPath = string.Empty, // 初始化为空字符串
                    isHidden = true,
                    order = ++order
                };
                ExtractedVariables.Add(newVariableData);
                LogManager.Log($"【默认值设置】创建{(isAccumulative ? "累加" : "章节")}变量 {variableName}，类型={inferredTypeNew}，默认值={newVariableData.defaultValue}");
            }
        }

        private string ProcessConditions(string text, ChoiceNode node)
        {
            var conditions = new List<VariableCondition>();
            // 修改正则表达式以使用非贪婪匹配
            var matches = Regex.Matches(text, @"《(.*?)》");
            string processedText = text; // 用于存储处理后的文本

            LogManager.Log($"【条件处理】选项节点 {node.nodeId} 开始处理条件");
            LogManager.Log($"【条件处理】原始文本: '{text}'");
            LogManager.Log($"【条件处理】共找到 {matches.Count} 个条件标记");

            // 如果没有找到条件标记，尝试查找其他格式
            if (matches.Count == 0)
            {
                LogManager.Log($"【条件处理】未找到《》格式的条件标记，尝试查找其他格式");
                // 可以在这里添加其他条件格式的支持
            }

            foreach (Match match in matches)
            {
                string conditionText = match.Groups[1].Value;
                LogManager.Log($"处理选项节点条件: 《{conditionText}》");

                // 跳过概率标识（包括数字或变量的百分比，如《50%》《幸运值%》《幸运值%:2》）
                if (Regex.IsMatch(conditionText, @"^\s*[^%]+%\s*(?:(?:[:：]\s*\d+)\s*)?$"))
                {
                    LogManager.Log($"跳过概率选项标识《{conditionText}》，不转换为条件");
                    continue;
                }

                // 跳过非条件的书名号/引用文本（不包含任何条件符号或关键字）
                if (!IsLikelyConditionText(conditionText))
                {
                    LogManager.Log($"跳过非条件文本（可能是书名号/引用）《{conditionText}》");
                    continue;
                }

                if (!conditionText.StartsWith("AD")) // 跳过广告标记
                {
                    var condition = ParseVariableCondition(conditionText);
                    if (condition != null)
                    {
                        conditions.Add(condition);
                        // 添加到描述
                        node.description += $"需{conditionText}; ";

                        // 注意：条件判断中的变量不应该被自动提取为独立变量
                        // 只有在变量效果中出现的变量才应该被提取

                        LogManager.Log($"为选项节点 {node.nodeId} 添加条件: {conditionText}, 解析结果: 变量={condition.variableName}, 操作={condition.operation}, 值={condition.value}");
                    }
                    else
                    {
                        LogManager.LogWarning($"选项节点 {node.nodeId} 条件 《{conditionText}》 解析失败");
                    }
                }
                else
                {
                    LogManager.Log($"跳过广告标记《{conditionText}》，不转换为变量");
                }

                // 从文本中移除这个条件标记（概率标识已在上面continue跳过）
                if (true)
                {
                    string beforeReplace = processedText;
                    processedText = processedText.Replace(match.Value, "");
                    string afterReplace = processedText;
                    LogManager.Log($"【条件处理】移除条件标记: '{match.Value}'");
                    LogManager.Log($"【条件处理】移除前: '{beforeReplace}'");
                    LogManager.Log($"【条件处理】移除后: '{afterReplace}'");
                }
            }

            node.conditions = conditions;

            // 如果有条件，自动设置不可用时提示信息
            if (conditions.Count > 0 && string.IsNullOrEmpty(node.unavailableMessage))
            {
                // 去掉描述末尾的分号和空格
                string description = node.description.TrimEnd(' ', ';');
                description = description.Replace("A:", "");
                // 使用富文本标签为文本添加红色
                node.unavailableMessage = $"\n<color=red><size=42>{description}</size></color>";
                LogManager.Log($"设置选项节点 {node.nodeId} 不可用时提示信息: {description} (红色文字)");
            }

            LogManager.Log($"【条件处理】选项节点 {node.nodeId} 条件处理完成，共添加了 {conditions.Count} 个条件");
            LogManager.Log($"【条件处理】最终处理后的文本: '{processedText}'");

            // 返回处理后的文本，移除条件标记
            return processedText;
        }

        private VariableEffect ParseVariableEffect(string text)
        {
            LogManager.Log($"【变量效果解析】开始解析: '{text}'");

            // 首先尝试空格分隔的格式：变量名 操作 值
            var parts = text.Split(new[] { ' ' }, 2);
            LogManager.Log($"【变量效果解析】空格分割结果: 长度={parts.Length}, 第一部分='{parts[0]}', 第二部分='{(parts.Length > 1 ? parts[1] : "无")}'");

            if (parts.Length == 2)
            {
                LogManager.Log($"【变量效果解析】使用空格分隔解析");
                return ParseSpaceSeparatedEffect(parts[0].Trim(), parts[1].Trim());
            }

            // 如果没有空格，尝试直接解析格式：变量名+值 或 变量名-值 等
            LogManager.Log($"【变量效果解析】使用直接格式解析");
            return ParseDirectEffect(text);
        }

        /// <summary>
        /// 解析空格分隔的变量效果格式：变量名 操作 值
        /// </summary>
        private VariableEffect ParseSpaceSeparatedEffect(string variableName, string valuePart)
        {
            LogManager.Log($"【变量效果解析】解析空格分隔格式: 变量='{variableName}', 值='{valuePart}'");

            var effect = new VariableEffect();

            // 检查是否使用A:或A：前缀标记累加变量
            bool isAccumulative = false;
            if (variableName.StartsWith("A:") || variableName.StartsWith("A："))
            {
                isAccumulative = true;
                // 移除A:或A：前缀
                if (variableName.StartsWith("A:"))
                {
                    variableName = variableName.Substring(2);
                }
                else if (variableName.StartsWith("A："))
                {
                    variableName = variableName.Substring(2);
                }
                LogManager.Log($"检测到累加变量: {variableName}");
            }

            // 统一规范化变量名
            variableName = NormalizeVariableName(variableName);
            effect.variableName = variableName;

            // 存储累加标记信息到额外字段（如果支持）
            var field = typeof(VariableEffect).GetField("isAccumulative", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(effect, isAccumulative);
            }

            // 检查是否为复杂表达式
            if (IsComplexExpression(valuePart))
            {
                return ParseComplexExpressionEffect(variableName, valuePart, isAccumulative);
            }

            // 原有的简单运算处理
            if (valuePart.StartsWith("+"))
            {
                effect.operation = VariableEffectOperation.Add;
                effect.value = valuePart.Substring(1);
            }
            else if (valuePart.StartsWith("-"))
            {
                effect.operation = VariableEffectOperation.Subtract;
                effect.value = valuePart.Substring(1);
            }
            else
            {
                // 修正：去掉前导等号
                if (valuePart.StartsWith("="))
                    valuePart = valuePart.Substring(1).Trim();

                effect.operation = VariableEffectOperation.Set;
                effect.value = valuePart;
            }

            // 如果启用了变量提取，将变量添加到提取列表（包含累加信息）
            if (ExtractVariables)
            {
                string rhsForType = effect.operation == VariableEffectOperation.Set ? effect.value : null;
                AddVariableToExtractedList(effect.variableName, isAccumulative, rhsForType);
            }

            LogManager.Log($"【变量效果解析】成功解析空格分隔格式: {effect.variableName} {effect.operation} {effect.value}");
            return effect;
        }

        /// <summary>
        /// 解析直接格式的变量效果：变量名+值 或 变量名-值 等
        /// </summary>
        private VariableEffect ParseDirectEffect(string text)
        {
            LogManager.Log($"【变量效果解析】尝试解析直接格式: '{text}'");

            // 使用正则表达式匹配变量名和操作符
            var addMatch = Regex.Match(text, @"^(.+?)\+(\d+(?:\.\d+)?)$");
            var subtractMatch = Regex.Match(text, @"^(.+?)\-(\d+(?:\.\d+)?)$");
            var multiplyMatch = Regex.Match(text, @"^(.+?)\*(\d+(?:\.\d+)?)$");
            var divideMatch = Regex.Match(text, @"^(.+?)/(\d+(?:\.\d+)?)$");
            var setMatch = Regex.Match(text, @"^(.+?)=(.+)$");

            LogManager.Log($"【变量效果解析】正则匹配结果: 加法={addMatch.Success}, 减法={subtractMatch.Success}, 乘法={multiplyMatch.Success}, 除法={divideMatch.Success}, 设置={setMatch.Success}");

            string variableName = "";
            string value = "";
            VariableEffectOperation operation = VariableEffectOperation.Set;

            if (addMatch.Success)
            {
                variableName = addMatch.Groups[1].Value.Trim();
                value = addMatch.Groups[2].Value.Trim();
                operation = VariableEffectOperation.Add;
                LogManager.Log($"【变量效果解析】匹配加法格式: {variableName} + {value}");
            }
            else if (subtractMatch.Success)
            {
                variableName = subtractMatch.Groups[1].Value.Trim();
                value = subtractMatch.Groups[2].Value.Trim();
                operation = VariableEffectOperation.Subtract;
                LogManager.Log($"【变量效果解析】匹配减法格式: {variableName} - {value}");
            }
            else if (multiplyMatch.Success)
            {
                variableName = multiplyMatch.Groups[1].Value.Trim();
                value = multiplyMatch.Groups[2].Value.Trim();
                operation = VariableEffectOperation.Multiply;
                LogManager.Log($"【变量效果解析】匹配乘法格式: {variableName} * {value}");
            }
            else if (divideMatch.Success)
            {
                variableName = divideMatch.Groups[1].Value.Trim();
                value = divideMatch.Groups[2].Value.Trim();
                operation = VariableEffectOperation.Divide;
                LogManager.Log($"【变量效果解析】匹配除法格式: {variableName} / {value}");
            }
            else if (setMatch.Success)
            {
                variableName = setMatch.Groups[1].Value.Trim();
                value = setMatch.Groups[2].Value.Trim();
                operation = VariableEffectOperation.Set;
                LogManager.Log($"【变量效果解析】匹配设置格式: {variableName} = {value}");
            }
            else
            {
                LogManager.LogWarning($"【变量效果解析】无法解析直接格式: '{text}'");
                return null;
            }

            var effect = new VariableEffect();
            // 统一规范化变量名
            variableName = NormalizeVariableName(variableName);
            // 统一规范化变量名
            variableName = NormalizeVariableName(variableName);
            effect.variableName = variableName;
            effect.operation = operation;
            effect.value = value;

            // 检查是否使用A:或A：前缀标记累加变量
            bool isAccumulative = false;
            if (variableName.StartsWith("A:") || variableName.StartsWith("A："))
            {
                isAccumulative = true;
                // 移除A:或A：前缀
                if (variableName.StartsWith("A:"))
                {
                    effect.variableName = variableName.Substring(2);
                }
                else if (variableName.StartsWith("A："))
                {
                    effect.variableName = variableName.Substring(2);
                }
                LogManager.Log($"检测到累加变量: {effect.variableName}");
            }

            // 存储累加标记信息到额外字段（如果支持）
            var field = typeof(VariableEffect).GetField("isAccumulative", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(effect, isAccumulative);
            }

            // 如果启用了变量提取，将变量添加到提取列表（包含累加信息）
            if (ExtractVariables)
            {
                string rhsForType = operation == VariableEffectOperation.Set ? value : null;
                AddVariableToExtractedList(effect.variableName, isAccumulative, rhsForType);
            }

            LogManager.Log($"【变量效果解析】成功解析直接格式: {effect.variableName} {effect.operation} {effect.value}");
            return effect;
        }

        /// <summary>
        /// 解析复杂表达式效果
        /// </summary>
        private VariableEffect ParseComplexExpressionEffect(string variableName, string expression, bool isAccumulative)
        {
            LogManager.Log($"解析复杂表达式效果: 变量={variableName}, 表达式=\"{expression}\"");

            var effect = new VariableEffect();
            // 统一规范化变量名
            variableName = NormalizeVariableName(variableName);
            effect.variableName = variableName;

            // 存储累加标记信息到额外字段（如果支持）
            var field = typeof(VariableEffect).GetField("isAccumulative", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(effect, isAccumulative);
            }

            // 检查表达式是否以=、+、-、*、/开头，表示不同的操作
            if (expression.StartsWith("="))
            {
                effect.operation = VariableEffectOperation.Set;
                effect.value = expression.Substring(1).Trim();
                effect.expression = effect.value; // 设置表达式字段
                LogManager.Log($"复杂表达式效果：设置操作，表达式={effect.value}");
            }
            else if (expression.StartsWith("+"))
            {
                effect.operation = VariableEffectOperation.Add;
                effect.value = expression.Substring(1).Trim();
                effect.expression = effect.value; // 设置表达式字段
                LogManager.Log($"复杂表达式效果：累加操作，表达式={effect.value}");
            }
            else if (expression.StartsWith("-"))
            {
                effect.operation = VariableEffectOperation.Subtract;
                effect.value = expression.Substring(1).Trim();
                effect.expression = effect.value; // 设置表达式字段
                LogManager.Log($"复杂表达式效果：减少操作，表达式={effect.value}");
            }
            else if (expression.StartsWith("*"))
            {
                effect.operation = VariableEffectOperation.Multiply;
                effect.value = expression.Substring(1).Trim();
                effect.expression = effect.value; // 设置表达式字段
                LogManager.Log($"复杂表达式效果：乘法操作，表达式={effect.value}");
            }
            else if (expression.StartsWith("/"))
            {
                effect.operation = VariableEffectOperation.Divide;
                effect.value = expression.Substring(1).Trim();
                effect.expression = effect.value; // 设置表达式字段
                LogManager.Log($"复杂表达式效果：除法操作，表达式={effect.value}");
            }
            else
            {
                effect.operation = VariableEffectOperation.Set;
                effect.value = expression;
                effect.expression = expression; // 设置表达式字段
                LogManager.Log($"复杂表达式效果：设置操作，表达式={effect.value}");
            }

            // 标记为使用表达式
            effect.useExpression = true;

            // 如果启用了变量提取，从表达式中提取变量
            if (ExtractVariables)
            {
                // 传入表达式右侧用于尝试类型推断（纯数字或单一变量名可被识别）
                AddVariableToExtractedList(effect.variableName, isAccumulative, effect.value);
                ExtractVariablesFromExpression(effect.value, isAccumulative);
            }

            return effect;
        }

        private VariableCondition ParseVariableCondition(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                LogManager.Log($"【转换与视频变选项排查】条件文本为空，返回null");
                return null;
            }

            var condition = new VariableCondition();

            // 增加调试日志
            LogManager.Log($"解析条件: \"{text}\"");
            LogManager.Log($"【转换与视频变选项排查】开始解析条件: \"{text}\"");

            // 检查是否使用A:或A：前缀标记累加变量
            bool isAccumulative = false;
            if (text.StartsWith("A:") || text.StartsWith("A："))
            {
                isAccumulative = true;
                // 移除A:或A：前缀
                if (text.StartsWith("A:"))
                {
                    text = text.Substring(2);
                }
                else if (text.StartsWith("A："))
                {
                    text = text.Substring(2);
                }
                LogManager.Log($"检测到条件中的累加变量: {text}");
            }

            // 检查是否为复杂表达式
            bool isComplex = IsComplexExpression(text);
            LogManager.Log($"【转换与视频变选项排查】复杂表达式检查结果: {isComplex}");

            if (isComplex)
            {
                LogManager.Log($"【转换与视频变选项排查】作为复杂表达式处理: \"{text}\"");
                return ParseComplexExpression(text, isAccumulative);
            }

            // 使用正则表达式匹配各种操作符格式（简单变量）
            // 支持全角和半角操作符，以及多个空格
            var geMatch = Regex.Match(text, @"^(.*?)\s*[>＞]\s*=\s*(.*)$");
            var leMatch = Regex.Match(text, @"^(.*?)\s*[<＜]\s*=\s*(.*)$");
            var eqMatch = Regex.Match(text, @"^(.*?)\s*==\s*(.*)$");
            var neMatch = Regex.Match(text, @"^(.*?)\s*!=\s*(.*)$");
            var gtMatch = Regex.Match(text, @"^(.*?)\s*[>＞]\s*(?!\s*=)(.*)$");
            var ltMatch = Regex.Match(text, @"^(.*?)\s*[<＜]\s*(?!\s*=)(.*)$");

            string variableName = "";

            if (geMatch.Success)
            {
                variableName = geMatch.Groups[1].Value.Trim();
                condition.operation = VariableOperation.GreaterOrEqual;
                condition.value = geMatch.Groups[2].Value.Trim();
                LogManager.Log($"匹配 >=: 变量={variableName}, 值={condition.value}");
            }
            else if (leMatch.Success)
            {
                variableName = leMatch.Groups[1].Value.Trim();
                condition.operation = VariableOperation.LessOrEqual;
                condition.value = leMatch.Groups[2].Value.Trim();
                LogManager.Log($"匹配 <=: 变量={variableName}, 值={condition.value}");
            }
            else if (eqMatch.Success)
            {
                variableName = eqMatch.Groups[1].Value.Trim();
                condition.operation = VariableOperation.Equals;
                condition.value = eqMatch.Groups[2].Value.Trim();
                LogManager.Log($"匹配 ==: 变量={variableName}, 值={condition.value}");
            }
            else if (neMatch.Success)
            {
                variableName = neMatch.Groups[1].Value.Trim();
                condition.operation = VariableOperation.NotEquals;
                condition.value = neMatch.Groups[2].Value.Trim();
                LogManager.Log($"匹配 !=: 变量={variableName}, 值={condition.value}");
            }
            else if (gtMatch.Success)
            {
                variableName = gtMatch.Groups[1].Value.Trim();
                condition.operation = VariableOperation.GreaterThan;
                condition.value = gtMatch.Groups[2].Value.Trim();
                LogManager.Log($"匹配 >: 变量={variableName}, 值={condition.value}");
            }
            else if (ltMatch.Success)
            {
                variableName = ltMatch.Groups[1].Value.Trim();
                condition.operation = VariableOperation.LessThan;
                condition.value = ltMatch.Groups[2].Value.Trim();
                LogManager.Log($"匹配 <: 变量={variableName}, 值={condition.value}");
            }
            else
            {
                // 如果没有操作符，默认为相等操作(变量存在且不为0/false/null)
                variableName = text.Trim();
                condition.operation = VariableOperation.Equals;
                condition.value = "true";
                LogManager.Log($"无操作符，默认为存在判断: 变量={variableName}");
            }

            // 统一规范化变量名，去除尾随运算符等异常字符
            variableName = NormalizeVariableName(variableName);
            condition.variableName = variableName;
            condition.useExpression = false;

            // 存储累加标记信息到额外字段（如果支持）
            var field = typeof(VariableCondition).GetField("isAccumulative", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(condition, isAccumulative);
            }

            // 新增：简单条件也进行变量提取（此前仅复杂表达式会提取）
            if (ExtractVariables && !string.IsNullOrEmpty(variableName))
            {
                AddVariableToExtractedList(variableName, isAccumulative);
                LogManager.Log($"【条件解析】简单条件触发变量提取: 变量={variableName}, 累加={isAccumulative}");
            }

            LogManager.Log($"【条件解析】解析条件完成: 变量={variableName}, 操作={condition.operation}, 值={condition.value}, 累加={isAccumulative}");

            return condition;
        }

        /// <summary>
        /// 检查是否为复杂表达式
        /// </summary>
        private bool IsComplexExpression(string text)
        {
            // 检查是否包含数学运算符
            bool hasOperators = text.Contains("+") || text.Contains("-") || text.Contains("*") ||
                               text.Contains("/") || text.Contains("(") || text.Contains(")");

            // 如果有运算符，就认为是复杂表达式
            // 不再检查变量数量，因为像"灵石-1"这样的表达式也应该被识别为复杂表达式
            return hasOperators;
        }

        /// <summary>
        /// 解析复杂表达式条件
        /// </summary>
        private VariableCondition ParseComplexExpression(string text, bool isAccumulative)
        {
            LogManager.Log($"解析复杂表达式: \"{text}\"");
            LogManager.Log($"【转换与视频变选项排查】开始解析复杂表达式: \"{text}\", 累加标记: {isAccumulative}");

            var condition = new VariableCondition();
            condition.useExpression = true;

            // 匹配表达式和比较值
            // 支持全角和半角操作符，以及多个空格
            var geMatch = Regex.Match(text, @"^(.*?)\s*[>＞]\s*=\s*(.*)$");
            var leMatch = Regex.Match(text, @"^(.*?)\s*[<＜]\s*=\s*(.*)$");
            var eqMatch = Regex.Match(text, @"^(.*?)\s*==\s*(.*)$");
            var neMatch = Regex.Match(text, @"^(.*?)\s*!=\s*(.*)$");
            var gtMatch = Regex.Match(text, @"^(.*?)\s*[>＞]\s*(?!\s*=)(.*)$");
            var ltMatch = Regex.Match(text, @"^(.*?)\s*[<＜]\s*(?!\s*=)(.*)$");

            string expression = "";
            string compareValue = "";

            if (geMatch.Success)
            {
                expression = geMatch.Groups[1].Value.Trim();
                compareValue = geMatch.Groups[2].Value.Trim();
                condition.operation = VariableOperation.GreaterOrEqual;
                LogManager.Log($"复杂表达式匹配 >=: 表达式={expression}, 比较值={compareValue}");
                LogManager.Log($"【转换与视频变选项排查】匹配到 >= 操作符");
            }
            else if (leMatch.Success)
            {
                expression = leMatch.Groups[1].Value.Trim();
                compareValue = leMatch.Groups[2].Value.Trim();
                condition.operation = VariableOperation.LessOrEqual;
                LogManager.Log($"复杂表达式匹配 <=: 表达式={expression}, 比较值={compareValue}");
                LogManager.Log($"【转换与视频变选项排查】匹配到 <= 操作符");
            }
            else if (eqMatch.Success)
            {
                expression = eqMatch.Groups[1].Value.Trim();
                compareValue = eqMatch.Groups[2].Value.Trim();
                condition.operation = VariableOperation.Equals;
                LogManager.Log($"复杂表达式匹配 ==: 表达式={expression}, 比较值={compareValue}");
                LogManager.Log($"【转换与视频变选项排查】匹配到 == 操作符");
            }
            else if (neMatch.Success)
            {
                expression = neMatch.Groups[1].Value.Trim();
                compareValue = neMatch.Groups[2].Value.Trim();
                condition.operation = VariableOperation.NotEquals;
                LogManager.Log($"复杂表达式匹配 !=: 表达式={expression}, 比较值={compareValue}");
                LogManager.Log($"【转换与视频变选项排查】匹配到 != 操作符");
            }
            else if (gtMatch.Success)
            {
                expression = gtMatch.Groups[1].Value.Trim();
                compareValue = gtMatch.Groups[2].Value.Trim();
                condition.operation = VariableOperation.GreaterThan;
                LogManager.Log($"复杂表达式匹配 >: 表达式={expression}, 比较值={compareValue}");
                LogManager.Log($"【转换与视频变选项排查】匹配到 > 操作符，表达式: '{expression}', 比较值: '{compareValue}'");
            }
            else if (ltMatch.Success)
            {
                expression = ltMatch.Groups[1].Value.Trim();
                compareValue = ltMatch.Groups[2].Value.Trim();
                condition.operation = VariableOperation.LessThan;
                LogManager.Log($"复杂表达式匹配 <: 表达式={expression}, 比较值={compareValue}");
                LogManager.Log($"【转换与视频变选项排查】匹配到 < 操作符");
            }
            else
            {
                LogManager.LogWarning($"复杂表达式格式不正确: {text}");
                LogManager.Log($"【转换与视频变选项排查】复杂表达式格式不正确，无法匹配任何操作符: '{text}'");
                return null;
            }

            condition.expression = expression;
            condition.value = compareValue;
            condition.variableName = ""; // 复杂表达式不使用简单变量名

            // 如果启用了变量提取，从复杂表达式中提取变量
            if (ExtractVariables)
            {
                LogManager.Log($"【转换与视频变选项排查】开始从复杂表达式提取变量: '{expression}'");
                ExtractVariablesFromExpression(expression, isAccumulative);
                LogManager.Log($"【复杂条件解析】从复杂表达式中提取变量: {expression}");
            }
            else
            {
                LogManager.Log($"【转换与视频变选项排查】变量提取已禁用，跳过变量提取");
            }

            LogManager.Log($"复杂表达式解析完成: 表达式={expression}, 操作={condition.operation}, 比较值={compareValue}");
            LogManager.Log($"【转换与视频变选项排查】复杂表达式解析完成");
            return condition;
        }

        /// <summary>
        /// 从表达式中提取变量
        /// </summary>
        private void ExtractVariablesFromExpression(string expression, bool isAccumulative)
        {
            LogManager.Log($"【表达式变量提取】开始从表达式提取变量: '{expression}'");
            LogManager.Log($"【转换与视频变选项排查】变量提取开始，表达式: '{expression}', 累加标记: {isAccumulative}");

            // 新增：检查是否包含概率选项标识，如果包含则跳过变量提取
            bool hasProbabilityPattern = Regex.IsMatch(expression, @"《\d+(?:\.\d+)?%[：:]\d+》");
            LogManager.Log($"【转换与视频变选项排查】概率选项检查结果: {hasProbabilityPattern}");

            if (hasProbabilityPattern)
            {
                LogManager.Log($"【表达式变量提取】检测到概率选项标识，跳过变量提取: '{expression}'");
                LogManager.Log($"【转换与视频变选项排查】因概率选项标识跳过变量提取");
                return;
            }

            // 首先按运算符分割表达式，然后提取每个部分中的变量名
            // 这样可以避免将"灵石-1"这样的表达式当作一个变量名
            string[] parts = Regex.Split(expression, @"[+\-*/=><]");
            LogManager.Log($"【转换与视频变选项排查】按运算符分割表达式，共得到 {parts.Length} 个部分");
            for (int i = 0; i < parts.Length; i++)
            {
                LogManager.Log($"【转换与视频变选项排查】分割部分[{i}]: '{parts[i]}'");
            }

            foreach (string part in parts)
            {
                string trimmedPart = part.Trim();
                if (string.IsNullOrEmpty(trimmedPart))
                {
                    LogManager.Log($"【转换与视频变选项排查】跳过空白部分");
                    continue;
                }

                LogManager.Log($"【表达式变量提取】处理分割后的部分: '{trimmedPart}'");
                LogManager.Log($"【转换与视频变选项排查】开始处理部分: '{trimmedPart}'");

                // 检查是否包含A:前缀，如果有则移除前缀并标记为累加变量
                bool isPartAccumulative = false;
                string processedPart = trimmedPart;

                if (trimmedPart.StartsWith("A:") || trimmedPart.StartsWith("A："))
                {
                    isPartAccumulative = true;
                    if (trimmedPart.StartsWith("A:"))
                    {
                        processedPart = trimmedPart.Substring(2);
                    }
                    else if (trimmedPart.StartsWith("A："))
                    {
                        processedPart = trimmedPart.Substring(2);
                    }
                    LogManager.Log($"【表达式变量提取】检测到A:前缀，移除前缀后: '{processedPart}'");
                }

                // 使用正则表达式匹配变量名（只匹配字母、中文、数字、下划线）
                // 去除末尾运算符，防止把 '变量=' 这类形式连在一起
                processedPart = Regex.Replace(processedPart, @"[=+\-*/><:：]+$", "").Trim();
                var variableMatches = Regex.Matches(processedPart, @"[a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5_]*");
                LogManager.Log($"【转换与视频变选项排查】在部分 '{processedPart}' 中匹配到 {variableMatches.Count} 个候选变量");

                foreach (Match match in variableMatches)
                {
                    string variableName = NormalizeVariableName(match.Value);

                    LogManager.Log($"【表达式变量提取】匹配到候选变量名: '{variableName}'");
                    LogManager.Log($"【转换与视频变选项排查】候选变量名: '{variableName}'");

                    // 跳过数学函数和常量
                    if (IsMathFunctionOrConstant(variableName))
                    {
                        LogManager.Log($"【表达式变量提取】跳过数学函数或常量: '{variableName}'");
                        LogManager.Log($"【转换与视频变选项排查】跳过数学函数或常量: '{variableName}'");
                        continue;
                    }

                    // 检查变量名是否包含任何运算符（有运算符就是运算，不是变量）
                    if (Regex.IsMatch(variableName, @"[+\-*/=><]"))
                    {
                        LogManager.Log($"【表达式变量提取】跳过包含运算符的变量名: '{variableName}'（有运算符就是运算，不是变量）");
                        LogManager.Log($"【转换与视频变选项排查】跳过包含运算符的变量名: '{variableName}'");
                        continue;
                    }

                    // 检查变量名是否以数字开头（这表示它是数字而不是变量名）
                    if (Regex.IsMatch(variableName, @"^\d"))
                    {
                        LogManager.Log($"【表达式变量提取】跳过以数字开头的变量名: '{variableName}'");
                        LogManager.Log($"【转换与视频变选项排查】跳过以数字开头的变量名: '{variableName}'");
                        continue;
                    }

                    // 新增：检查变量名是否为纯数字或包含百分号的数字（可能是概率选项标识中的数字）
                    if (Regex.IsMatch(variableName, @"^\d+(?:\.\d+)?$") || variableName.Contains("%"))
                    {
                        LogManager.Log($"【表达式变量提取】跳过纯数字或包含百分号的变量名: '{variableName}'");
                        LogManager.Log($"【转换与视频变选项排查】跳过纯数字或包含百分号的变量名: '{variableName}'");
                        continue;
                    }

                    // 使用当前部分的累加标记，如果没有则使用传入的isAccumulative
                    bool finalIsAccumulative = isPartAccumulative || isAccumulative;
                    LogManager.Log($"【转换与视频变选项排查】准备添加变量到提取列表: '{variableName}', 累加标记: {finalIsAccumulative}");
                    AddVariableToExtractedList(variableName, finalIsAccumulative);
                    LogManager.Log($"【表达式变量提取】成功提取变量: '{variableName}', 累加标记: {finalIsAccumulative}");
                    LogManager.Log($"【转换与视频变选项排查】成功提取变量: '{variableName}', 累加标记: {finalIsAccumulative}");
                }
            }
        }

        /// <summary>
        /// 检查是否为数学函数或常量
        /// </summary>
        private bool IsMathFunctionOrConstant(string name)
        {
            string[] mathFunctions = { "sin", "cos", "tan", "sqrt", "abs", "max", "min", "pow" };
            string[] constants = { "pi", "e" };

            return Array.Exists(mathFunctions, x => x.Equals(name, StringComparison.OrdinalIgnoreCase)) ||
                   Array.Exists(constants, x => x.Equals(name, StringComparison.OrdinalIgnoreCase));
        }

        // 添加变量到提取列表 - 创建与Chapter1.json相同格式的变量
        private void AddVariableToExtractedList(string variableName, bool isAccumulative = false, string rhsForType = null)
        {
            // 统一规范化变量名，去掉尾随运算符等
            variableName = NormalizeVariableName(variableName);
            LogManager.Log($"【变量提取】开始处理变量: {variableName}, isAccumulative={isAccumulative}");

            if (string.IsNullOrEmpty(variableName))
            {
                LogManager.Log($"【变量提取】变量名为空，跳过");
                return;
            }

            // 新增：检查变量名是否为纯数字或包含百分号的数字（可能是概率选项标识中的数字）
            if (Regex.IsMatch(variableName, @"^\d+(?:\.\d+)?$") || variableName.Contains("%"))
            {
                LogManager.Log($"【变量提取】跳过纯数字或包含百分号的变量名（可能是概率选项标识中的数字）: {variableName}");
                return;
            }

            // 查找是否已存在
            var existingVariable = ExtractedVariables.FirstOrDefault(v => v.name == variableName);
            if (existingVariable != null)
            {
                // 已存在且为累加类型
                if (existingVariable.persistenceType == VariablePersistenceType.Accumulative)
                {
                    LogManager.Log($"【变量提取】变量 {variableName} 已存在且为累加类型，更新字段");
                    if (!string.IsNullOrEmpty(rhsForType))
                    {
                        var inferredType = InferVariableTypeFromValue(rhsForType, out var _);
                        existingVariable.type = inferredType;
                        existingVariable.defaultValue = GetDefaultValueByType(inferredType);
                        existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(inferredType);
                    }
                    else
                    {
                        existingVariable.defaultValue = GetDefaultValueByType(existingVariable.type);
                        existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(existingVariable.type);
                    }
                    existingVariable.minValue = "0";
                    existingVariable.maxValue = "100";
                    existingVariable.usePlayerPrefs = true;
                    existingVariable.showAsProgress = true;
                    existingVariable.iconPath = string.Empty;
                    existingVariable.isHidden = existingVariable.isHidden == false ? false : true;
                    existingVariable.order = (existingVariable.order == -1 || existingVariable.order == 0) ? ++order : existingVariable.order;
                    return;
                }
                // 已存在且为章节类型
                else if (existingVariable.persistenceType == VariablePersistenceType.ChapterConstant)
                {
                    if (isAccumulative)
                    {
                        // 删除原有章节类型变量，准备添加累加类型变量
                        ExtractedVariables.Remove(existingVariable);
                        LogManager.Log($"【变量提取】变量 {variableName} 已存在且为章节类型，删除原变量，准备添加累加类型变量");
                        // 继续往下走，创建新变量
                    }
                    else
                    {
                        LogManager.Log($"【变量提取】变量 {variableName} 已存在且为章节类型，更新字段");
                        if (!string.IsNullOrEmpty(rhsForType))
                        {
                            var inferredType = InferVariableTypeFromValue(rhsForType, out var _);
                            existingVariable.type = inferredType;
                            existingVariable.defaultValue = GetDefaultValueByType(inferredType);
                            existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(inferredType);
                        }
                        else
                        {
                            existingVariable.defaultValue = GetDefaultValueByType(existingVariable.type);
                            existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(existingVariable.type);
                        }
                        existingVariable.minValue = "0";
                        existingVariable.maxValue = "100";
                        existingVariable.usePlayerPrefs = true;
                        existingVariable.showAsProgress = true;
                        existingVariable.iconPath = string.Empty;
                        existingVariable.isHidden = existingVariable.isHidden == false ? false : true;
                        existingVariable.order = (existingVariable.order == -1 || existingVariable.order == 0) ? ++order : existingVariable.order;
                        return;
                    }
                }
                // 已存在且为 NULL：更新字段并按“累加优先，否则章节”设置类型
                else if (existingVariable.persistenceType == VariablePersistenceType.NULL)
                {
                    existingVariable.persistenceType = isAccumulative ? VariablePersistenceType.Accumulative : VariablePersistenceType.ChapterConstant;
                    if (!string.IsNullOrEmpty(rhsForType))
                    {
                        var inferredType = InferVariableTypeFromValue(rhsForType, out var _);
                        existingVariable.type = inferredType;
                        existingVariable.defaultValue = GetDefaultValueByType(inferredType);
                        existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(inferredType);
                    }
                    else
                    {
                        existingVariable.defaultValue = GetDefaultValueByType(existingVariable.type);
                        existingVariable.playerPrefsDefaultValue = GetDefaultValueByType(existingVariable.type);
                    }
                    existingVariable.minValue = "0";
                    existingVariable.maxValue = "100";
                    existingVariable.usePlayerPrefs = true;
                    existingVariable.showAsProgress = true;
                    existingVariable.iconPath = string.Empty;
                    existingVariable.isHidden = existingVariable.isHidden == false ? false : true;
                    existingVariable.order = (existingVariable.order == -1 || existingVariable.order == 0) ? ++order : existingVariable.order;
                    LogManager.Log($"【变量提取】变量 {variableName} 原类型为NULL，已更新字段并设置类型为 {existingVariable.persistenceType}");
                    return;
                }
                else
                {
                    // 其他类型，按原逻辑处理
                    LogManager.Log($"【变量提取】变量 {variableName} 已存在且为其他类型，按原逻辑处理");
                    return;
                }
            }

            // 创建新变量
            VariableType inferredTypeForNew = !string.IsNullOrEmpty(rhsForType)
                ? InferVariableTypeFromValue(rhsForType, out var _)
                : GuessVariableType(variableName);
            var variableData = new VariableData
            {
                name = variableName,
                displayName = variableName,
                description = $"从剧情文件 {inputPath} 中提取的{(isAccumulative ? "累加" : "章节")}变量",
                type = inferredTypeForNew,
                persistenceType = isAccumulative ? VariablePersistenceType.Accumulative : VariablePersistenceType.ChapterConstant,
                defaultValue = GetDefaultValueByType(inferredTypeForNew),
                maxValue = string.IsNullOrEmpty(globalMaxValueOverride) ? "100" : globalMaxValueOverride,
                usePlayerPrefs = true,
                playerPrefsDefaultValue = GetDefaultValueByType(inferredTypeForNew),
                showAsProgress = true,
                iconPath = string.Empty, // 初始化为空字符串
                isHidden = true,
                order = ++order
            };

            ExtractedVariables.Add(variableData);
            LogManager.Log($"【变量提取】创建新变量: {variableName}, 类型: {variableData.type}, persistenceType: {variableData.persistenceType}");
        }

        // 根据变量名猜测变量类型
        private VariableType GuessVariableType(string variableName)
        {
            // 根据变量名称猜测类型
            string lowerName = variableName.ToLower();

            if (lowerName.Contains("flag") || lowerName.Contains("开关") || lowerName.Contains("是否"))
                return VariableType.Boolean;

            if (lowerName.Contains("好感") || lowerName.Contains("进度") ||
                lowerName.Contains("度") || lowerName.Contains("值"))
                return VariableType.Integer;

            if (lowerName.Contains("名字") || lowerName.Contains("name") ||
                lowerName.Contains("描述") || lowerName.Contains("文本"))
                return VariableType.String;

            // 默认类型为整数
            return VariableType.Integer;
        }

        // 基于"= 右侧"的值推断变量类型；若解析失败且匹配到现有变量名，则继承其类型
        private VariableType InferVariableTypeFromValue(string rhsValue, out bool inferredFromExistingVariable)
        {
            inferredFromExistingVariable = false;
            if (string.IsNullOrEmpty(rhsValue))
            {
                return VariableType.String;
            }

            string value = rhsValue.Trim();

            // 去引号
            if ((value.StartsWith("\"") && value.EndsWith("\"")) || (value.StartsWith("'") && value.EndsWith("'")))
            {
                value = value.Substring(1, value.Length - 2).Trim();
            }

            // 优先整数
            if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out _))
            {
                return VariableType.Integer;
            }

            // 其次浮点
            if (float.TryParse(value, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out _))
            {
                return VariableType.Float;
            }

            // 新增：检查是否包含数学运算符（表示是数值表达式）
            bool hasMathOperators = value.Contains("+") || value.Contains("-") || 
                                   value.Contains("*") || value.Contains("/") || 
                                   value.Contains("(") || value.Contains(")");
            
            // 如果包含数学运算符且包含数字，推断为数值类型
            if (hasMathOperators)
            {
                // 检查表达式中是否包含数字
                bool hasNumber = Regex.IsMatch(value, @"\d");
                if (hasNumber)
                {
                    // 如果包含小数点，推断为Float，否则为Integer
                    if (value.Contains("."))
                    {
                        LogManager.Log($"【类型推断】表达式 '{value}' 包含数学运算符和小数点，推断为 Float");
                        return VariableType.Float;
                    }
                    else
                    {
                        LogManager.Log($"【类型推断】表达式 '{value}' 包含数学运算符和数字，推断为 Integer");
                        return VariableType.Integer;
                    }
                }
            }

            // 否则尝试匹配已提取变量名
            string normalized = NormalizeVariableName(value);
            if (!string.IsNullOrEmpty(normalized) && ExtractedVariables != null)
            {
                var existed = ExtractedVariables.FirstOrDefault(v => v != null && v.name == normalized);
                if (existed != null)
                {
                    inferredFromExistingVariable = true;
                    return existed.type;
                }
            }

            // 默认字符串
            return VariableType.String;
        }

        private string GetDefaultValueByType(VariableType type)
        {
            switch (type)
            {
                case VariableType.Integer:
                    return "0";
                case VariableType.Float:
                    return "0.0";
                case VariableType.Boolean:
                    return "false";
                case VariableType.String:
                default:
                    return "";
            }
        }

        // 保存提取的变量
        private void SaveExtractedVariables()
        {
            try
            {
                // 若存在全局最大值标记，在保存前统一覆盖
                ApplyGlobalMaxToExtractedVariables();
                // 创建变量管理器资源目录
                string variableDir = "Assets/Resources/GameProduceFiles/Configs/Variables";
                if (!Directory.Exists(variableDir))
                {
                    Directory.CreateDirectory(variableDir);
                }

                // 使用统一的变量文件名，所有章节共享同一个文件
                string variableFileName = "Variables.json";
                string variablePath = Path.Combine(variableDir, variableFileName);

                // 如果文件已存在，先读取现有变量
                List<VariableData> existingVariables = new List<VariableData>();
                if (File.Exists(variablePath))
                {
                    try
                    {
                        string existingJson = File.ReadAllText(variablePath);
                        existingVariables = JsonConvert.DeserializeObject<List<VariableData>>(existingJson) ?? new List<VariableData>();
                        LogManager.Log($"【变量合并】从现有文件加载了 {existingVariables.Count} 个变量");
                    }
                    catch (Exception ex)
                    {
                        LogManager.LogWarning($"读取现有变量文件时出错: {ex.Message}");
                    }
                }

                // 合并现有变量和新提取的变量，保持累加变量的优先级
                List<VariableData> finalVariables = MergeVariablesWithExisting(existingVariables, ExtractedVariables);

                // 保险：对合并后的变量再次应用全局最大值（避免外部遗留）
                if (!string.IsNullOrEmpty(globalMaxValueOverride))
                {
                    foreach (var v in finalVariables)
                    {
                        v.maxValue = globalMaxValueOverride;
                    }
                }

                // 序列化变量数据
                string variableJson = JsonConvert.SerializeObject(finalVariables, Formatting.Indented);
                File.WriteAllText(variablePath, variableJson);

                LogManager.Log($"【变量保存】变量已保存至: {variablePath}，总共 {finalVariables.Count} 个变量");
                AssetDatabase.Refresh();
            }
            catch (Exception ex)
            {
                LogManager.LogError($"保存变量时出错: {ex.Message}");
            }
        }

        // 合并现有变量和新提取的变量，保持累加变量的优先级
        private List<VariableData> MergeVariablesWithExisting(List<VariableData> existingVariables, List<VariableData> newVariables)
        {
            List<VariableData> finalVariables = new List<VariableData>();
            Dictionary<string, VariableData> variableDict = new Dictionary<string, VariableData>();

            // 先添加现有变量
            foreach (var existingVar in existingVariables)
            {
                variableDict[existingVar.name] = existingVar;
            }

            // 处理新提取的变量
            foreach (var newVar in newVariables)
            {
                if (variableDict.ContainsKey(newVar.name))
                {
                    var existingVar = variableDict[newVar.name];

                    // 合并类型：任一为累加则累加，否则为章节
                    if (newVar.persistenceType == VariablePersistenceType.Accumulative || existingVar.persistenceType == VariablePersistenceType.Accumulative)
                    {
                        existingVar.persistenceType = VariablePersistenceType.Accumulative;
                        LogManager.Log($"【变量合并】变量 {newVar.name} 设为累加类型（累加优先）");
                    }
                    else
                    {
                        existingVar.persistenceType = VariablePersistenceType.ChapterConstant;
                        LogManager.Log($"【变量合并】变量 {newVar.name} 设为章节类型（非累加统一为章节）");
                    }

                    // 更新其他属性（如默认值、描述等）
                    existingVar.defaultValue = newVar.defaultValue;
                    existingVar.playerPrefsDefaultValue = newVar.playerPrefsDefaultValue;
                    existingVar.description = newVar.description;
                    // 若存在全局最大值标记，覆盖最大值
                    if (!string.IsNullOrEmpty(globalMaxValueOverride))
                    {
                        existingVar.maxValue = globalMaxValueOverride;
                    }
                }
                else
                {
                    // 新变量，直接添加
                    if (!string.IsNullOrEmpty(globalMaxValueOverride))
                    {
                        newVar.maxValue = globalMaxValueOverride;
                    }
                    variableDict[newVar.name] = newVar;
                    LogManager.Log($"【变量合并】添加新变量: {newVar.name}, 类型: {newVar.persistenceType}");
                }
            }

            // 转换为列表
            finalVariables = variableDict.Values.ToList();

            LogManager.Log($"【变量合并】合并完成，最终共有 {finalVariables.Count} 个变量");
            return finalVariables;
        }

        // 加载之前章节的变量文件
        private List<VariableData> LoadPreviousChapterVariables()
        {
            List<VariableData> previousVariables = new List<VariableData>();

            try
            {
                string variableDir = "Assets/Resources/GameProduceFiles/Configs/Variables";
                if (!Directory.Exists(variableDir))
                {
                    return previousVariables;
                }

                // 现在只需要读取统一的Variables.json文件
                string variablePath = Path.Combine(variableDir, "Variables.json");

                if (File.Exists(variablePath))
                {
                    try
                    {
                        string jsonContent = File.ReadAllText(variablePath);
                        var variables = JsonConvert.DeserializeObject<List<VariableData>>(jsonContent);
                        if (variables != null)
                        {
                            previousVariables.AddRange(variables);
                            LogManager.Log($"【跨章节变量】从统一变量文件加载了 {variables.Count} 个变量");
                        }
                    }
                    catch (Exception ex)
                    {
                        LogManager.LogWarning($"读取统一变量文件时出错: {ex.Message}");
                    }
                }
                else
                {
                    LogManager.Log("【跨章节变量】统一变量文件不存在，将创建新的变量文件");
                }

                LogManager.Log($"【跨章节变量】总共加载了 {previousVariables.Count} 个现有变量");
            }
            catch (Exception ex)
            {
                LogManager.LogError($"加载现有变量时出错: {ex.Message}");
            }

            return previousVariables;
        }

        // 合并之前章节的变量，保持累加变量的优先级
        private void MergePreviousVariables(List<VariableData> previousVariables)
        {
            LogManager.Log($"【跨章节变量】开始合并 {previousVariables.Count} 个之前章节的变量");

            foreach (var previousVar in previousVariables)
            {
                // 检查当前提取的变量列表中是否已存在同名变量
                var existingVar = ExtractedVariables.FirstOrDefault(v => v.name == previousVar.name);

                if (existingVar != null)
                {
                    // 如果之前章节的变量是累加类型，保持累加类型不变
                    if (previousVar.persistenceType == VariablePersistenceType.Accumulative)
                    {
                        if (existingVar.persistenceType != VariablePersistenceType.Accumulative)
                        {
                            existingVar.persistenceType = VariablePersistenceType.Accumulative;
                            LogManager.Log($"【跨章节累加变量】变量 {previousVar.name} 从之前章节继承累加类型");
                        }
                        else
                        {
                            LogManager.Log($"【跨章节累加变量】变量 {previousVar.name} 已经是累加类型，无需更新");
                        }
                    }
                    else
                    {
                        // 如果之前章节的变量不是累加类型，但当前是累加类型，保持当前类型
                        if (existingVar.persistenceType == VariablePersistenceType.Accumulative)
                        {
                            LogManager.Log($"【跨章节累加变量】变量 {previousVar.name} 保持当前累加类型（优先级更高）");
                        }
                        else
                        {
                            LogManager.Log($"【跨章节变量】变量 {previousVar.name} 保持当前类型: {existingVar.persistenceType}");
                        }
                    }
                }
                else
                {
                    // 如果当前章节没有这个变量，直接添加
                    ExtractedVariables.Add(previousVar);
                    LogManager.Log($"【跨章节变量】添加之前章节的变量: {previousVar.name}, 类型: {previousVar.persistenceType}");
                }
            }

            LogManager.Log($"【跨章节变量】合并完成，当前共有 {ExtractedVariables.Count} 个变量");
        }

        // 打开变量管理器窗口
        public void OpenVariableManager()
        {
            // 打开StoryNodeEditor窗口，它包含变量管理器
            var window = EditorWindow.GetWindow<StoryNodeEditor>();
            window.titleContent = new GUIContent("故事节点编辑器");
            window.Focus();

            // 尝试将变量传递到变量管理器
            // 注意：这需要实现一个公共方法来加载变量
            EditorUtility.DisplayDialog("变量管理",
                $"已打开故事节点编辑器\n变量需要从左侧面板的变量管理器加载\n已提取 {ExtractedVariables.Count} 个变量",
                "确定");
        }
        ///// <summary>
        ///// 从进度条格式中提取视频名称
        ///// 格式: [变量条:变量名:默认值:#颜色:上/下]视频A0001
        ///// </summary>
        ///// <param name="text"></param>
        ///// <returns></returns>
        //private string ExtractVariablesFromVariableBar(string text)
        //{
        //    // 匹配变量条格式
        //    var variableBarMatch = Regex.Match(text, @"\[变量条:[^\]]+\](.+)");
        //    if (variableBarMatch.Success)
        //    {
        //        string videoName = variableBarMatch.Groups[1].Value.Trim();
        //        LogManager.Log($"【变量条】从变量条格式提取视频名称: {videoName}");
        //        return videoName;
        //    }
        //    return null;
        //}

        private string FindVideoPath(string text)
        {
            LogManager.Log($"【转换排查】FindVideoPath开始处理文本: \"{text}\"");

            // 保留原始文本用于完整匹配
            string originalText = text.Trim();

            // 清理标记后的文本
            string cleanedText = CleanText(text);
            LogManager.Log($"【转换排查】查找视频: 原始文本=\"{text}\", 清理后=\"{cleanedText}\"");

            if (string.IsNullOrEmpty(cleanedText))
            {
                return FallbackVideoPath;
            }

            // 根据存放文件说明，更新视频查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterVideos/StoryVideos",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterVideos/ChapterPreviewVideos",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/StoryCollections/CollectionPreviewVideos",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopVideos/CardVideos",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopVideos/RewardVideos",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopVideos/RewardVideoCovers",
                "Assets/Resources/Video",
                "Assets/Resources/Videos",
                "Assets/Resources"
            };

            // 搜集所有可能的视频文件
            List<string> allVideoFiles = new List<string>();
            foreach (var directory in searchDirectories)
            {
                // 确保目录存在
                if (!Directory.Exists(directory))
                {
                    LogManager.Log($"目录不存在，跳过: {directory}");
                    continue;
                }

                // 搜索目录下的所有视频文件
                string[] videoExtensions = new string[] { "*.mp4", "*.mov", "*.avi", "*.wmv" };

                foreach (var extension in videoExtensions)
                {
                    try
                    {
                        allVideoFiles.AddRange(Directory.GetFiles(directory, extension, SearchOption.AllDirectories));
                    }
                    catch (System.Exception ex)
                    {
                        LogManager.LogWarning($"搜索目录时出错: {directory}, {extension}, 错误: {ex.Message}");
                    }
                }
            }

            LogManager.Log($"共找到 {allVideoFiles.Count} 个视频文件");


            if (allVideoFiles.Count == 0)
            {
                // 没有找到任何视频文件，尝试查找图片
                string imagePath = FindImagePath(text, "视频替补图片匹配");
                if (!string.IsNullOrEmpty(imagePath))
                {
                    LogManager.Log($"未找到视频文件，但找到图片: {imagePath}");
                    return string.Empty; // 返回空字符串表示没有视频，但有图片
                }
                else
                {
                    // 没有找到任何视频文件，直接返回替补视频路径
                    string defaultPath = FallbackVideoPath;
                    missingVideos.Add($"[未找到视频]{cleanedText}.mp4");
                    LogManager.Log($"未找到任何视频文件，将使用替补视频路径: {defaultPath}");
                    return defaultPath;
                }
            }

            // 1. 方式一：完全匹配（保留特殊字符），与Resources中的视频文件比较
            foreach (var file in allVideoFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(originalText, StringComparison.OrdinalIgnoreCase))
                {
                    videoMatchLogs.Add($"[视频匹配]{fileName}视频精确匹配成功");
                    return file.Replace("\\", "/");
                }
            }

            // 2. 方式二：清理标记后的文本匹配
            foreach (var file in allVideoFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(cleanedText, StringComparison.OrdinalIgnoreCase) ||
                    fileName.StartsWith(cleanedText, StringComparison.OrdinalIgnoreCase))
                {
                    videoMatchLogs.Add($"[视频匹配]{fileName}视频精确匹配成功");
                    return file.Replace("\\", "/");
                }
            }

            // 3. 方式三：如果文本长度超过10个字符，尝试匹配前10个字符
            if (cleanedText.Length > 10)
            {
                string first10Chars = cleanedText.Substring(0, 10);
                foreach (var file in allVideoFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.StartsWith(first10Chars, StringComparison.OrdinalIgnoreCase))
                    {
                        videoMatchLogs.Add($"[视频匹配]{fileName}视频精确匹配成功");
                        return file.Replace("\\", "/");
                    }
                }
            }

            // 4. 尝试模糊匹配
            List<Tuple<string, float>> scoredFiles = new List<Tuple<string, float>>();
            foreach (var file in allVideoFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                float similarity = CalculateSimilarity(cleanedText, fileName);
                scoredFiles.Add(new Tuple<string, float>(file, similarity));
            }

            // 按相似度排序
            scoredFiles.Sort((a, b) => b.Item2.CompareTo(a.Item2));

            // 如果最高分达到阈值，则使用
            if (scoredFiles.Count > 0 && scoredFiles[0].Item2 > 0.5f)
            {
                string bestMatch = scoredFiles[0].Item1;
                string bestMatchName = Path.GetFileNameWithoutExtension(bestMatch);
                videoMatchLogs.Add($"[视频匹配]视频精确匹配失败：{cleanedText}，模糊匹配到了{bestMatchName}");
                return bestMatch.Replace("\\", "/");
            }

            // 5. 如果所有视频匹配方法都失败，尝试查找图片
            string fallbackImagePath = FindImagePath(text, "视频替补图片匹配");
            if (!string.IsNullOrEmpty(fallbackImagePath))
            {
                LogManager.Log($"未找到匹配的视频，但找到图片: {fallbackImagePath}");
                return string.Empty; // 返回空字符串表示没有视频，但有图片
            }

            // 6. 如果所有方法都失败，返回替补视频路径并添加到未找到视频列表
            string sanitizedName = SanitizePathString(cleanedText);
            if (string.IsNullOrEmpty(sanitizedName))
            {
                sanitizedName = "video_placeholder";
            }
            string defaultVideoPath = FallbackVideoPath;
            missingVideos.Add($"[未找到视频]{cleanedText}.mp4");
            videoMatchLogs.Add($"[视频匹配]视频精确匹配失败：{cleanedText}，将使用替补视频路径: {defaultVideoPath}");
            LogManager.Log($"未找到视频，将使用替补视频路径: {defaultVideoPath}");
            return defaultVideoPath;
        }
        /// <summary>
        /// 查找图片路径，与FindVideoPath类似的逻辑
        /// </summary>
        private string FindImagePath(string text, string context = "通用图片匹配")
        {
            LogManager.Log($"【转换排查】FindImagePath开始处理文本: \"{text}\"");

            // 保留原始文本用于完整匹配
            string originalText = text.Trim();

            // 清理标记后的文本
            string cleanedText = CleanText(text);
            LogManager.Log($"【转换排查】查找图片: 原始文本=\"{text}\", 清理后=\"{cleanedText}\"");

            // 根据存放文件说明，更新图片查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Stories/ChapterImages",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/ChapterImages/ChapterThumbnails",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/ChapterVideos/StoryVideos",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/CommodityIcons",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/CardImages",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/RewardImages",
                "Assets/Resources/GameProduceFiles/GameResources/Achievements/AchievementIcons",
                "Assets/Resources/GameProduceFiles/GameResources/GameIcons",
                "Assets/Resources/Images",
                "Assets/Resources/Image",
                "Assets/Resources/Pictures",
                "Assets/Resources/Picture",
                "Assets/Resources"
            };

            // 搜集所有可能的图片文件
            List<string> allImageFiles = new List<string>();
            foreach (var directory in searchDirectories)
            {
                // 确保目录存在
                if (!Directory.Exists(directory))
                {
                    LogManager.Log($"图片目录不存在，跳过: {directory}");
                    continue;
                }

                // 搜索目录下的所有图片文件
                string[] imageExtensions = new string[] { "*.png", "*.jpg", "*.jpeg", "*.tga", "*.bmp" };

                foreach (var extension in imageExtensions)
                {
                    try
                    {
                        allImageFiles.AddRange(Directory.GetFiles(directory, extension, SearchOption.AllDirectories));
                    }
                    catch (System.Exception ex)
                    {
                        LogManager.LogWarning($"搜索图片目录时出错: {directory}, {extension}, 错误: {ex.Message}");
                    }
                }
            }

            LogManager.Log($"共找到 {allImageFiles.Count} 个图片文件");

            if (allImageFiles.Count == 0)
            {
                LogManager.Log($"未找到任何图片文件");
                return string.Empty;
            }

            // 2. 方式二：清理标记后的文本匹配
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(cleanedText, StringComparison.OrdinalIgnoreCase))
                    //||fileName.StartsWith(cleanedText, StringComparison.OrdinalIgnoreCase))
                {
                    string formattedPath = FormatResourcePath(file);
                    LogManager.Log($"找到清理标记后匹配的图片: {file} -> {formattedPath}, 匹配文本: \"{cleanedText}\"");
                    AddToAppropriateLogList(context, $"{fileName}图片精确匹配成功方式二");
                    return formattedPath;
                }
            }

            // 3. 方式三：如果文本长度超过10个字符，尝试匹配前10个字符
            if (cleanedText.Length > 10)
            {
                string first10Chars = cleanedText.Substring(0, 10);
                foreach (var file in allImageFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.StartsWith(first10Chars, StringComparison.OrdinalIgnoreCase))
                    {
                        string formattedPath = FormatResourcePath(file);
                        LogManager.Log($"找到前10字符匹配的图片: {file} -> {formattedPath}, 匹配文本: \"{first10Chars}\"");
                        AddToAppropriateLogList(context, $"{fileName}图片精确匹配成功方式三");
                        return formattedPath;
                    }
                }
            }

            // 3.5 针对包含中文的名称，放宽子串匹配阈值（最小长度2），逐步缩短匹配片段
            {
                bool cleanedHasCjk = HasCJK(cleanedText);
                int minLen = cleanedHasCjk ? 2 : 5;
                int startLen = Math.Min(30, cleanedText.Length);
                for (int length = startLen; length >= minLen; length -= (cleanedHasCjk ? 1 : 5))
                {
                    string textToMatch = cleanedText.Substring(0, length);
                    foreach (var file in allImageFiles)
                    {
                        string fileName = Path.GetFileNameWithoutExtension(file);
                        if (fileName.Contains(textToMatch))
                        {
                            string formattedPath = FormatResourcePath(file);
                            LogManager.Log($"找到中文放宽子串匹配的图片: {file} -> {formattedPath}, 片段: \"{textToMatch}\"");
                            AddToAppropriateLogList(context, $"{fileName}图片精确匹配成功方式三点五");
                            return formattedPath;
                        }
                    }
                }
            }
            // 1. 方式一：完全匹配（保留特殊字符），与Resources中的图片文件比较
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(originalText, StringComparison.OrdinalIgnoreCase))
                {
                    string formattedPath = FormatResourcePath(file);
                    LogManager.Log($"找到完全匹配的图片: {file} -> {formattedPath}");
                    AddToAppropriateLogList(context, $"{fileName}图片精确匹配成功方式一");
                    return formattedPath;
                }
            }
            // 4. 尝试模糊匹配
            List<Tuple<string, float>> scoredFiles = new List<Tuple<string, float>>();
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                float similarity = CalculateSimilarity(cleanedText, fileName);
                scoredFiles.Add(new Tuple<string, float>(file, similarity));
            }

            // 按相似度排序
            scoredFiles.Sort((a, b) => b.Item2.CompareTo(a.Item2));

            // 如果最高分达到阈值，则使用
            if (scoredFiles.Count > 0 && scoredFiles[0].Item2 > 0.5f)
            {
                string bestMatch = scoredFiles[0].Item1;
                string bestMatchName = Path.GetFileNameWithoutExtension(bestMatch);
                string formattedPath = FormatResourcePath(bestMatch);
                LogManager.Log($"使用最佳模糊匹配的图片: {bestMatch} -> {formattedPath}, 相似度: {scoredFiles[0].Item2}");
                AddToAppropriateLogList(context, $"图片精确匹配失败：{cleanedText}，模糊匹配到了{bestMatchName}");
                return formattedPath;
            }

            // 5. 文本包含文件名（放宽中文名的长度阈值）
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                int minNameLen = HasCJK(fileName) ? 2 : 5;
                if (fileName.Length >= minNameLen && cleanedText.Contains(fileName))
                {
                    string formattedPath = FormatResourcePath(file);
                    LogManager.Log($"找到文本包含文件名的图片: {file} -> {formattedPath}");
                    AddToAppropriateLogList(context, $"{fileName}图片精确匹配成功方式五");
                    return formattedPath;
                }
            }

            // 6. 如果所有方法都失败，返回空字符串
            LogManager.Log($"未找到匹配的图片: {cleanedText}");
            AddToAppropriateLogList(context, $"图片精确匹配失败：{cleanedText}，未找到匹配的图片");
            return string.Empty;
        }

        /// <summary>
        /// 根据上下文将日志添加到适当的列表中
        /// </summary>
        private void AddToAppropriateLogList(string context, string logMessage)
        {
            if (context.Contains("叠加图片选项匹配"))
            {
                overlayImageMatchLogs.Add(logMessage);
            }
            else if (context.Contains("卡牌匹配"))
            {
                cardImageMatchLogs.Add(logMessage);
            }
            else
            {
                // 其他情况（视频节点图片匹配、对话框图片匹配、视频替补图片匹配等）都添加到视频匹配日志中
                videoMatchLogs.Add($"[{context}]{logMessage}");
            }
        }

        private float CalculateSimilarity(string s1, string s2)
        {
            if (string.IsNullOrEmpty(s1) || string.IsNullOrEmpty(s2))
                return 0f;

            // 简单的编辑距离计算
            int[,] d = new int[s1.Length + 1, s2.Length + 1];

            for (int i = 0; i <= s1.Length; i++)
                d[i, 0] = i;

            for (int j = 0; j <= s2.Length; j++)
                d[0, j] = j;

            for (int i = 1; i <= s1.Length; i++)
            {
                for (int j = 1; j <= s2.Length; j++)
                {
                    int cost = (s1[i - 1] == s2[j - 1]) ? 0 : 1;

                    d[i, j] = System.Math.Min(
                        System.Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                        d[i - 1, j - 1] + cost);
                }
            }

            // 将编辑距离转换为相似度（0-1范围）
            float maxLength = System.Math.Max(s1.Length, s2.Length);
            if (maxLength == 0) return 1f; // 两个空字符串是相同的

            float similarity = 1f - (d[s1.Length, s2.Length] / maxLength);
            return similarity;
        }

        private bool HasCJK(string s)
        {
            if (string.IsNullOrEmpty(s)) return false;
            foreach (char c in s)
            {
                // 基本中日韩统一表意文字范围
                if (c >= '\u4e00' && c <= '\u9fff') return true;
                // 全角标点等常用扩展
                if (c >= '\u3000' && c <= '\u303f') return true;
            }
            return false;
        }

        // 清理路径字符串中的非法字符
        private string SanitizePathString(string path)
        {
            if (string.IsNullOrEmpty(path))
                return "";

            // 移除路径中的非法字符
            char[] invalidChars = Path.GetInvalidFileNameChars();
            string result = new string(path.Where(c => !invalidChars.Contains(c)).ToArray());

            // 移除常见的特殊字符，这些在文件名中可能不太适合
            result = result.Replace("\\", "").Replace("/", "").Replace(":", "")
                         .Replace("*", "").Replace("?", "").Replace("\"", "")
                         .Replace("<", "").Replace(">", "").Replace("|", "");

            LogManager.Log($"路径清理: \"{path}\" -> \"{result}\"");
            return result;
        }

        // 规范化变量名：去掉首尾空白、包裹引号以及尾随运算符/分隔符
        private string NormalizeVariableName(string name)
        {
            if (string.IsNullOrEmpty(name)) return string.Empty;
            string result = name.Trim();
            if (result.Length == 0) return string.Empty;

            // 去除包裹引号
            if ((result.StartsWith("\"") && result.EndsWith("\"")) || (result.StartsWith("'") && result.EndsWith("'")))
            {
                result = result.Substring(1, result.Length - 2).Trim();
            }

            // 移除末尾的运算符或分隔符
            while (result.Length > 0)
            {
                char c = result[result.Length - 1];
                if (c == '=' || c == '+' || c == '-' || c == '*' || c == '/' || c == '>' || c == '<' || c == ':' || c == '：')
                {
                    result = result.Substring(0, result.Length - 1).TrimEnd();
                    continue;
                }
                break;
            }

            return result.Trim();
        }

        private string CleanText(string text)
        {
            LogManager.Log($"开始清理文本，原始文本: \"{text}\"");

            // 首先去除所有回车和换行符
            text = text.Replace("\r\n", "").Replace("\n", "").Replace("\r", "");
            LogManager.Log($"去除回车换行后: \"{text}\"");

            // 先移除带冒号的特殊标记，如[CP:XXX]和[对话框:XXX:音频名]
            text = Regex.Replace(text, @"\[CP[：:][^\]]*\]", "");
            LogManager.Log($"移除[CP:XXX]后: \"{text}\"");

            text = Regex.Replace(text, @"\[对话框[：:][^\]]*\]", "");
            LogManager.Log($"移除[对话框:XXX]或[对话框:XXX:音频名]后: \"{text}\"");

            text = Regex.Replace(text, @"\[变量条[：:][^\]]+\]", "");
            LogManager.Log($"移除[变量条:变量名:#123418:上/下]后：\"{text}\"");

            // 移除其他标记
            text = Regex.Replace(text, @"\[[^\]]*\]", ""); // 修改为匹配任意[]内的内容
            LogManager.Log($"移除[]标记后: \"{text}\"");

            // 先规范化允许的富文本标签形式
            text = NormalizeColorTags(text);
            // 仅移除非允许标签且不跨越中文书名号《》的尖括号片段，避免吞噬中间文本
            // 允许的标签：color/size/b/i（含打开与关闭，大小写不敏感）
            text = Regex.Replace(
                text,
                @"<(?!/?\s*(?:color|size|b|i)\b)[^《》>]*>",
                string.Empty,
                RegexOptions.IgnoreCase
            );
            LogManager.Log($"移除<>标记后(仅移除非允许且不跨越《》的<>): \"{text}\"");

            // 移除《》标记，但保留随机节点标记《概率表达式%》和概率选项标识《数字%:数字》
            text = Regex.Replace(text, @"《[^》]*》", ""); // 只移除不以%开头的《》标记
            LogManager.Log($"移除《》标记后: \"{text}\"");

            // 注意：保留大括号格式 {表达式} 和 ｛表达式｝，这是用于动态文本计算的
            // 不在这里移除大括号内容，让ChoiceNode的DetectAndSetDynamicText方法处理

            string result = text.Trim();
            LogManager.Log($"最终清理结果: \"{result}\"");

            return result;
        }

        // 规范化颜色富文本标签，将含空格的形式转换为标准的<color=...>与</color>
        private string NormalizeColorTags(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;

            // 规范化打开标签：< color = xxx > 或 <color   =xxx> -> <color=xxx>
            input = Regex.Replace(
                input,
                @"<\s*color\s*(=\s*([^>]*?))?\s*>",
                new MatchEvaluator(m =>
                {
                    var g = m.Groups[2];
                    string value = g.Success ? g.Value.Trim() : string.Empty;
                    return string.IsNullOrEmpty(value) ? "<color>" : $"<color={value}>";
                }),
                RegexOptions.IgnoreCase
            );

            // 规范化关闭标签：< / color > -> </color>
            input = Regex.Replace(
                input,
                @"<\s*/\s*color\s*>",
                "</color>",
                RegexOptions.IgnoreCase
            );

            // 规范化<b>、</b>、<i>、</i>
            input = Regex.Replace(input, @"<\s*b\s*>", "<b>", RegexOptions.IgnoreCase);
            input = Regex.Replace(input, @"<\s*/\s*b\s*>", "</b>", RegexOptions.IgnoreCase);
            input = Regex.Replace(input, @"<\s*i\s*>", "<i>", RegexOptions.IgnoreCase);
            input = Regex.Replace(input, @"<\s*/\s*i\s*>", "</i>", RegexOptions.IgnoreCase);

            // 规范化<size=...>与</size>
            input = Regex.Replace(
                input,
                @"<\s*size\s*(=\s*([^>]*?))?\s*>",
                new MatchEvaluator(m =>
                {
                    var g = m.Groups[2];
                    string value = g.Success ? g.Value.Trim() : string.Empty;
                    return string.IsNullOrEmpty(value) ? "<size>" : $"<size={value}>";
                }),
                RegexOptions.IgnoreCase
            );
            input = Regex.Replace(input, @"<\s*/\s*size\s*>", "</size>", RegexOptions.IgnoreCase);

            return input;
        }

        // 添加处理视频节点条件的方法，与选项节点条件处理类似
        private void ProcessVideoConditions(string text, VideoNode node)
        {
            LogManager.Log($"【转换与视频变选项排查】开始处理视频节点条件，节点ID: {node.nodeId}, 文本: '{text}'");

            var conditions = new List<VariableCondition>();
            // 修改正则表达式以匹配所有《》包围的内容，然后在循环中过滤概率表达式
            var matches = Regex.Matches(text, @"《(.*?)》");
            LogManager.Log($"【转换与视频变选项排查】找到 {matches.Count} 个条件标记");

            // 处理隐藏标记
            bool isHidden = text.Contains("[隐藏]");
            if (isHidden)
            {
                text = text.Replace("[隐藏]", "").Trim();
                node.showWhenUnavailable = false;
                LogManager.Log($"设置隐藏视频节点: {node.nodeId}, 条件不满足时不显示");
            }

            // 处理数据统计标记 [数据统计:XXXX]
            var analyticsMatch = Regex.Match(text, @"\[数据统计[：:]([^\]]+)\]");
            if (analyticsMatch.Success)
            {
                string analyticsKey = analyticsMatch.Groups[1].Value.Trim();
                node.analyticsKey = analyticsKey;
                text = text.Replace(analyticsMatch.Value, "").Trim();
                LogManager.Log($"【数据统计】设置节点 {node.nodeId} 为数据统计节点，关键点: {analyticsKey}");

                // 如果有标题，添加数据统计标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = $"数据统计: {analyticsKey}";
                }
                else
                {
                    node.title += $" | 数据统计: {analyticsKey}";
                }
            }

            LogManager.Log($"视频节点 {node.nodeId} 开始处理条件，共找到 {matches.Count} 个条件标记");

            foreach (Match match in matches)
            {
                string conditionText = match.Groups[1].Value;
                LogManager.Log($"处理视频节点条件: 《{conditionText}》");
                LogManager.Log($"【转换与视频变选项排查】处理条件文本: '{conditionText}'");

                // 跳过概率标识（包括数字或变量的百分比，如《50%》《幸运值%》《幸运值%:2》）
                if (Regex.IsMatch(conditionText, @"^\s*[^%]+%\s*(?:(?:[:：]\s*\d+)\s*)?$"))
                {
                    LogManager.Log($"跳过概率选项标识《{conditionText}》，不转换为条件");
                    LogManager.Log($"【转换与视频变选项排查】跳过概率选项标识");
                    continue;
                }

                // 跳过非条件的书名号/引用文本（不包含任何条件符号或关键字）
                if (!IsLikelyConditionText(conditionText))
                {
                    LogManager.Log($"【转换与视频变选项排查】跳过非条件文本（可能是书名号/引用）《{conditionText}》");
                    continue;
                }

                // 特殊判断：如果是《AD》标记，跳过，不转换为变量
                if (conditionText == "AD")
                {
                    LogManager.Log($"跳过广告标记《AD》，不转换为变量");
                    LogManager.Log($"【转换与视频变选项排查】跳过广告标记");
                    continue;
                }

                LogManager.Log($"【转换与视频变选项排查】开始解析条件: '{conditionText}'");
                var condition = ParseVariableCondition(conditionText);
                if (condition != null)
                {
                    conditions.Add(condition);
                    // 添加到描述
                    if (string.IsNullOrEmpty(node.description))
                        node.description = $"需满足{conditionText}";
                    else
                        node.description += $"; 需满足{conditionText}";

                    // 注意：条件判断中的变量不应该被自动提取为独立变量
                    // 只有在变量效果中出现的变量才应该被提取

                    LogManager.Log($"为视频节点 {node.nodeId} 添加条件: {conditionText}, 解析结果: 变量={condition.variableName}, 操作={condition.operation}, 值={condition.value}");
                    LogManager.Log($"【转换与视频变选项排查】成功添加条件: '{conditionText}'");
                }
                else
                {
                    LogManager.LogWarning($"视频节点 {node.nodeId} 条件 《{conditionText}》 解析失败");
                    LogManager.Log($"【转换与视频变选项排查】条件解析失败: '{conditionText}'");
                }
            }

            node.conditions = conditions;
            LogManager.Log($"视频节点 {node.nodeId} 条件处理完成，共添加了 {conditions.Count} 个条件");
        }

        // 判断《……》中的文本是否更像条件表达式而非书名号/引用
        private bool IsLikelyConditionText(string content)
        {
            if (string.IsNullOrWhiteSpace(content)) return false;

            // 常见的比较/逻辑/包含关键字或符号
            string[] keywords = { ">=", "<=", ">", "<", "==", "!=", "=", "%","+","-","*","/"};
            foreach (var k in keywords)
            {
                if (content.Contains(k)) return true;
            }

            return false;
        }

        // 递归查找最终的非跳过目标节点
        private void FindAndAddFinalTargets(
            Dictionary<string, List<string>> connectionGraph,
            string currentNodeId,
            BaseNode sourceNode,
            Dictionary<string, List<string>> skippedNodes,
            Dictionary<string, BaseNode> nodeMap,
            HashSet<string> deadEndNodeIds = null)
        {
            // 获取当前节点的所有后续节点
            if (!connectionGraph.ContainsKey(currentNodeId))
            {
                LogManager.Log($"跳过节点 {currentNodeId} 没有后续节点，不为 {sourceNode.nodeId} 创建连接");
                return; // 当前节点没有后续节点
            }

            List<string> nextNodeIds = connectionGraph[currentNodeId];
            bool foundValidTarget = false; // 是否找到有效的目标节点

            foreach (string nextId in nextNodeIds)
            {
                // 如果后续节点也被跳过，递归处理
                if (skippedNodes.ContainsKey(nextId))
                {
                    FindAndAddFinalTargets(connectionGraph, nextId, sourceNode, skippedNodes, nodeMap, deadEndNodeIds);
                }
                // 如果是有效的非跳过节点，直接添加连接
                else if (nodeMap.ContainsKey(nextId))
                {
                    // 避免重复添加
                    if (!sourceNode.nextNodeIds.Contains(nextId))
                    {
                        // 移除对死亡节点目标的特殊处理，允许任何类型的连接
                        sourceNode.nextNodeIds.Add(nextId);
                        LogManager.Log($"创建跳过连接: {sourceNode.nodeId} -> {nextId}");
                        foundValidTarget = true;
                    }
                }
            }

            if (!foundValidTarget)
            {
                LogManager.Log($"节点 {sourceNode.nodeId} 经过跳过节点 {currentNodeId} 后没有找到有效的目标节点");
            }
        }

        private string FindCheckpointThumbnail(string originalText, string cleanedText)
        {
            LogManager.Log($"【匹配缩略图】开始查找检查点缩略图: 原始文本=\"{originalText}\", 清理后=\"{cleanedText}\"");

            // 尝试从文本中提取检查点名称
            string checkpointName = "";
            var cpNameMatch = Regex.Match(originalText, @"\[CP[：:]([^\]]+)\]");
            if (cpNameMatch.Success)
            {
                checkpointName = cpNameMatch.Groups[1].Value.Trim();
                LogManager.Log($"【匹配缩略图】从标记中提取检查点名称: {checkpointName}");
            }

            // 根据存放文件说明，更新缩略图查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterImages/ChapterThumbnails",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/CommodityIcons",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/CardImages",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/RewardImages",
                "Assets/Resources/GameProduceFiles/GameResources/Achievements/AchievementIcons",
                "Assets/Resources/GameProduceFiles/GameResources/GameIcons",
                "Assets/Resources/Images",
                "Assets/Resources/Image",
                "Assets/Resources/Pictures",
                "Assets/Resources/Picture",
                "Assets/Resources"
            };

            // 搜集所有图片文件
            List<string> allImageFiles = new List<string>();
            string[] imageExtensions = new string[] { "*.png", "*.jpg", "*.jpeg", "*.tga" };

            foreach (var directory in searchDirectories)
            {
                // 确保目录存在
                if (!Directory.Exists(directory))
                {
                    LogManager.Log($"【匹配缩略图】目录不存在，跳过: {directory}");
                    continue;
                }

                foreach (var extension in imageExtensions)
                {
                    try
                    {
                        allImageFiles.AddRange(Directory.GetFiles(directory, extension, SearchOption.AllDirectories));
                        LogManager.Log($"【匹配缩略图】在目录 {directory} 中搜索到 {extension} 文件 {Directory.GetFiles(directory, extension, SearchOption.AllDirectories).Length} 个");
                    }
                    catch (System.Exception ex)
                    {
                        LogManager.LogWarning($"【匹配缩略图】搜索目录时出错: {directory}, {extension}, 错误: {ex.Message}");
                    }
                }
            }

            LogManager.Log($"【匹配缩略图】共找到 {allImageFiles.Count} 个图片文件");

            // 如果提取到了检查点名称，优先尝试匹配检查点名称
            if (!string.IsNullOrEmpty(checkpointName))
            {
                // 尝试精确匹配检查点名称
                foreach (var file in allImageFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.Equals(checkpointName, StringComparison.OrdinalIgnoreCase))
                    {
                        LogManager.Log($"【匹配缩略图】找到检查点名称完全匹配的缩略图: {file}");
                        return file.Replace("\\", "/");
                    }
                }

                // 尝试包含匹配检查点名称
                foreach (var file in allImageFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.Contains(checkpointName) || checkpointName.Contains(fileName))
                    {
                        LogManager.Log($"【匹配缩略图】找到包含检查点名称的缩略图: {file}");
                        return file.Replace("\\", "/");
                    }
                }
            }

            // 直接使用清理后的文本进行匹配
            // 1. 先尝试完全匹配
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(cleanedText, StringComparison.OrdinalIgnoreCase))
                {
                    LogManager.Log($"【匹配缩略图】找到清理后文本完全匹配的缩略图: {file}");
                    return file.Replace("\\", "/");
                }
            }

            // 2. 从清理后的文本中提取前30个字符（或全文如果少于30个字符）
            string shortText = cleanedText;
            if (cleanedText.Length > 30)
            {
                shortText = cleanedText.Substring(0, 30);
                LogManager.Log($"【匹配缩略图】截取清理后文本前30个字符进行匹配: {shortText}");
            }

            // 3. 尝试包含匹配部分文本
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);

                // 检查文件名是否包含清理后文本的一部分（至少5个字符）
                if (cleanedText.Length >= 5)
                {
                    // 逐步减少匹配长度
                    for (int length = Math.Min(30, cleanedText.Length); length >= 5; length -= 5)
                    {
                        string textToMatch = cleanedText.Substring(0, length);
                        if (fileName.Contains(textToMatch))
                        {
                            LogManager.Log($"【匹配缩略图】找到包含文本前{length}个字符的缩略图: {file}, 匹配文本: \"{textToMatch}\"");
                            return file.Replace("\\", "/");
                        }
                    }
                }

                // 检查文本是否包含文件名（如果文件名至少5个字符）
                if (fileName.Length >= 5 && cleanedText.Contains(fileName))
                {
                    LogManager.Log($"【匹配缩略图】找到文本包含文件名的缩略图: {file}");
                    return file.Replace("\\", "/");
                }
            }

            // 4. 最后尝试匹配原始文本（包含标记）
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);

                // 原始文本精确匹配
                if (fileName.Equals(originalText, StringComparison.OrdinalIgnoreCase))
                {
                    LogManager.Log($"【匹配缩略图】找到原始文本精确匹配的缩略图: {file}");
                    return file.Replace("\\", "/");
                }

                // 原始文本包含匹配
                if (originalText.Contains(fileName) && fileName.Length >= 5)
                {
                    LogManager.Log($"【匹配缩略图】找到原始文本包含文件名的缩略图: {file}");
                    return file.Replace("\\", "/");
                }
            }

            // 如果仍然没有找到，打印所有图片文件名进行调试
            LogManager.Log("【匹配缩略图】未找到匹配的缩略图, 下面列出所有图片文件:");
            foreach (var file in allImageFiles)
            {
                LogManager.Log($"【匹配缩略图】图片文件: {Path.GetFileNameWithoutExtension(file)}");
            }

            return string.Empty;
        }

        private BGMNode CreateBGMNode(StoryGraphEntity entity)
        {
            var node = new BGMNode();
            node.nodeId = entity.uuid;

            string text = entity.text;
            string originalText = text; // 保存原始文本

            // 仅移除广告标记，不赋值requireAd/adType
            ParseAdMark(ref text, out _, out _);

            // 清理层级标记（BGM节点不使用该值，仅清理）
            TryExtractAndRemoveTierIndex(ref text, out _);

            // 处理起点标记
            bool isStartNode = text.Contains("[起点]");
            text = text.Replace("[起点]", "").Trim();
            if (isStartNode)
            {
                node.title = "起始节点";
                LogManager.Log($"设置BGM节点为起始节点: {node.nodeId}");
            }

            // 处理BGM标记
            text = text.Replace("[BGM]", "").Trim();

            // 处理音量设置
            var volumeMatch = Regex.Match(text, @"<S:BGM音量\s*=\s*([\d.]+)>");
            if (volumeMatch.Success)
            {
                string volumeStr = volumeMatch.Groups[1].Value;
                if (float.TryParse(volumeStr, out float volume))
                {
                    node.volume = volume;
                    LogManager.Log($"设置BGM节点音量: {volume}");
                    // 从文本中移除音量设置标记
                    text = text.Replace(volumeMatch.Value, "").Trim();
                }
                else
                {
                    LogManager.LogWarning($"BGM音量解析失败: {volumeStr}");
                }
            }
            else
            {
                // 默认音量为1.0
                node.volume = 1.0f;
            }

            // 处理循环设置
            var loopMatch = Regex.Match(text, @"<S:BGM循环\s*=\s*(true|false)>");
            if (loopMatch.Success)
            {
                string loopStr = loopMatch.Groups[1].Value.ToLower();
                node.isLoop = loopStr == "true";
                LogManager.Log($"设置BGM节点循环: {node.isLoop}");
                // 从文本中移除循环设置标记
                text = text.Replace(loopMatch.Value, "").Trim();
            }
            else
            {
                // 默认循环为true
                node.isLoop = true;
                LogManager.Log($"使用默认循环设置: true");
            }

            // 处理检查点标记
            bool isCheckpoint = false;
            string checkpointName = "";

            LogManager.Log($"开始处理BGM节点文本: \"{text}\"");

            // 检查带名称的检查点格式 [CP:XXX]
            var cpNameMatch = Regex.Match(text, @"\[CP[：:]([^\]]+)\]");
            if (cpNameMatch.Success)
            {
                isCheckpoint = true;
                checkpointName = cpNameMatch.Groups[1].Value.Trim();
                text = text.Replace(cpNameMatch.Value, "").Trim();
                LogManager.Log($"识别到带名称的检查点: {node.nodeId}, 名称: \"{checkpointName}\", 剩余文本: \"{text}\"");

                // 设置节点的名称相关属性
                node.title = $"检查点: {checkpointName}";
                node.nodeName = checkpointName;  // 优先使用[CP:XXX]中的XXX作为节点名称

                // 尝试设置 checkpointName 字段（如果存在）
                var nameField = typeof(BaseNode).GetField("checkpointName", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                if (nameField != null)
                {
                    nameField.SetValue(node, checkpointName);
                    LogManager.Log($"设置检查点名称字段: {checkpointName}");
                }
            }
            // 检查普通检查点格式 [CP]
            else if (text.Contains("[CP]"))
            {
                isCheckpoint = true;
                string beforeClean = text;
                text = text.Replace("[CP]", "").Trim();
                LogManager.Log($"识别到普通检查点: {node.nodeId}");
                LogManager.Log($"移除[CP]前: \"{beforeClean}\", 移除后: \"{text}\"");

                // 为普通检查点设置名称为清理后的文本内容
                node.title = "检查点";

                // 清理文本中的其他标记，使用纯文本作为节点名称
                string cleanedText = CleanText(text);
                LogManager.Log($"清理后的文本: \"{cleanedText}\"");

                if (!string.IsNullOrEmpty(cleanedText))
                {
                    node.nodeName = cleanedText;
                    LogManager.Log($"设置检查点节点名称为清理后文本: \"{cleanedText}\"");
                }
                else
                {
                    // 如果清理后的文本为空，使用默认名称
                    node.nodeName = "检查点";
                    LogManager.Log($"清理后文本为空，使用默认名称'检查点'");
                }
            }

            // 设置检查点标志
            var field = typeof(BaseNode).GetField("isCheckpoint", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                field.SetValue(node, isCheckpoint);
                if (isCheckpoint)
                {
                    LogManager.Log($"设置检查点节点: {node.nodeId}, isCheckpoint已设置为 {isCheckpoint}");

                    // 如果是检查点，查找缩略图
                    string thumbnailPath = FindCheckpointThumbnail(originalText, text);
                    if (!string.IsNullOrEmpty(thumbnailPath))
                    {
                        // BGM节点没有thumbnailPath属性，所以这里不做任何操作
                        LogManager.Log($"找到检查点缩略图: {thumbnailPath}，但BGM节点不支持缩略图");
                    }
                }
            }
            else
            {
                LogManager.LogError("无法找到isCheckpoint私有字段，请检查BaseNode类的实现");
                node.IsCheckpoint = isCheckpoint; // 如果反射失败，仍使用属性设置
            }

            // 处理条件 - BGM节点不支持条件，所以这里不做任何操作
            // 移除对ProcessVideoConditions的调用

            // 处理死亡节点标记（适用于任意节点类型）
            if (text.Contains("[死亡节点]"))
            {
                node.isDeadpoint = true;
                text = text.Replace("[死亡节点]", "").Trim();
            }

            // 处理终点节点标记 - BGM节点不支持终点节点标记，所以这里不做任何操作
            // 移除对isEndpoint的设置

            // 处理CG标记 - BGM节点不支持CG标记，所以这里不做任何操作
            // 移除对ProcessCGMarkers的调用

            // 处理重置到CP点标记
            bool isResetToCP = text.Contains("[重置到CP点]");
            if (isResetToCP)
            {
                node.isResetToCP = true;
                LogManager.Log($"【重置到CP点】设置BGM节点 {node.nodeId} 为重置到CP点节点");

                // 从文本中移除标记
                text = text.Replace("[重置到CP点]", "").Trim();

                // 如果有标题，添加重置到CP点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "重置到CP点";
                }
                else
                {
                    node.title += " | 重置到CP点";
                }
            }

            // 处理变量效果
            ProcessVariableEffects(text, node);

            // 设置音频路径
            node.audioClipPath = FindAudioPath(text);

            // 设置位置信息 - 将竖向坐标系转换为横向坐标系
            if (entity.location != null && entity.location.Length >= 2)
            {
                // 使用从界面设置的缩放因子
                float yMult = InvertY ? -1f : 1f;
                node.position = new Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
                LogManager.Log($"节点位置转换: 原始位置({entity.location[0]}, {entity.location[1]}) -> Unity位置({node.position.x}, {node.position.y})");
            }

            return node;
        }

        private string FindAudioPath(string text)
        {
            LogManager.Log($"【转换排查】FindAudioPath开始处理文本: \"{text}\"");

            // 保留原始文本用于完整匹配
            string originalText = text.Trim();

            // 清理标记后的文本
            string cleanedText = CleanText(text);
            LogManager.Log($"【转换排查】查找音频: 原始文本=\"{text}\", 清理后=\"{cleanedText}\"");

            // 根据存放文件说明，更新音频查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/BGM",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/Dialogues",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/SoundEffects",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/Chapters/ChapterAudioClips/VoiceOver",
                "Assets/Resources/GameProduceFiles/GameResources/Stories/StoryCollections/CollectionBGM",
                "Assets/Resources/Audio",
                "Assets/Resources/BGM",
                "Assets/Resources/Music",
                "Assets/Resources"
            };

            // 搜集所有可能的音频文件
            List<string> allAudioFiles = new List<string>();
            foreach (var directory in searchDirectories)
            {
                // 确保目录存在
                if (!Directory.Exists(directory))
                {
                    LogManager.Log($"目录不存在，跳过: {directory}");
                    continue;
                }

                // 搜索目录下的所有音频文件 - 添加大写扩展名
                string[] audioExtensions = new string[] { "*.mp3", "*.MP3", "*.wav", "*.WAV", "*.ogg", "*.OGG", "*.aac", "*.AAC" };

                foreach (var extension in audioExtensions)
                {
                    try
                    {
                        allAudioFiles.AddRange(Directory.GetFiles(directory, extension, SearchOption.AllDirectories));
                    }
                    catch (System.Exception ex)
                    {
                        LogManager.LogWarning($"搜索目录时出错: {directory}, {extension}, 错误: {ex.Message}");
                    }
                }
            }

            LogManager.Log($"共找到 {allAudioFiles.Count} 个音频文件");

            if (allAudioFiles.Count == 0)
            {
                // 没有找到任何音频文件，直接返回默认路径（不包含Assets/Resources/前缀和扩展名）
                string defaultPath = "Audio/audio_placeholder";
                LogManager.Log($"未找到任何音频文件，将使用默认路径: {defaultPath}");
                return defaultPath;
            }

            // 1. 方式一：完全匹配（保留特殊字符），与Resources中的音频文件比较 - 忽略大小写
            foreach (var file in allAudioFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(originalText, StringComparison.OrdinalIgnoreCase))
                {
                    string formattedPath = FormatResourcePath(file);
                    LogManager.Log($"找到完全匹配的音频: {file} -> 格式化路径: {formattedPath}");
                    return formattedPath;
                }
            }

            // 2. 方式二：清理标记后的文本匹配 - 忽略大小写
            foreach (var file in allAudioFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(cleanedText, StringComparison.OrdinalIgnoreCase) ||
                    cleanedText.ToLower().Contains(fileName.ToLower()) ||
                    fileName.ToLower().Contains(cleanedText.ToLower()))
                {
                    string formattedPath = FormatResourcePath(file);
                    LogManager.Log($"找到清理标记后匹配的音频: {file} -> 格式化路径: {formattedPath}");
                    return formattedPath;
                }
            }

            // 3. 方式三：如果文本长度超过10个字符，尝试匹配前10个字符 - 忽略大小写
            if (cleanedText.Length > 10)
            {
                string first10Chars = cleanedText.Substring(0, 10);
                foreach (var file in allAudioFiles)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName.StartsWith(first10Chars, StringComparison.OrdinalIgnoreCase) ||
                        fileName.ToLower().Contains(first10Chars.ToLower()))
                    {
                        string formattedPath = FormatResourcePath(file);
                        LogManager.Log($"找到前10字符匹配的音频: {file} -> 格式化路径: {formattedPath}");
                        return formattedPath;
                    }
                }
            }

            // 4. 尝试模糊匹配
            List<Tuple<string, float>> scoredFiles = new List<Tuple<string, float>>();
            foreach (var file in allAudioFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                float similarity = CalculateSimilarity(cleanedText.ToLower(), fileName.ToLower());  // 转换为小写再比较
                scoredFiles.Add(new Tuple<string, float>(file, similarity));
            }

            // 按相似度排序
            scoredFiles.Sort((a, b) => b.Item2.CompareTo(a.Item2));

            // 如果最高分达到阈值，则使用
            if (scoredFiles.Count > 0 && scoredFiles[0].Item2 > 0.5f)
            {
                string bestMatch = scoredFiles[0].Item1;
                string formattedPath = FormatResourcePath(bestMatch);
                LogManager.Log($"使用最佳模糊匹配: {bestMatch} -> 格式化路径: {formattedPath}, 相似度: {scoredFiles[0].Item2}");
                return formattedPath;
            }

            // 5. 如果所有方法都失败，返回默认路径（不包含Assets/Resources/前缀和扩展名）
            string sanitizedName = SanitizePathString(cleanedText);
            if (string.IsNullOrEmpty(sanitizedName))
            {
                sanitizedName = "audio_placeholder";
            }

            string defaultAudioPath = $"BGM/{sanitizedName}";
            LogManager.Log($"未找到音频，将使用构造路径: {defaultAudioPath}");

            return defaultAudioPath;
        }

        // 添加一个新方法来格式化资源路径
        private string FormatResourcePath(string fullPath)
        {
            if (string.IsNullOrEmpty(fullPath))
                return string.Empty;

            // 转换反斜杠为正斜杠
            fullPath = fullPath.Replace('\\', '/');

            // 提取相对于Resources文件夹的路径
            int resourcesIndex = fullPath.IndexOf("/Resources/", StringComparison.OrdinalIgnoreCase);
            if (resourcesIndex >= 0)
            {
                // 获取Resources/之后的部分
                string relativePath = fullPath.Substring(resourcesIndex + "/Resources/".Length);

                // 移除文件扩展名
                relativePath = Path.ChangeExtension(relativePath, null);

                return relativePath;
            }
            else if (fullPath.StartsWith("Assets/Resources/"))
            {
                // 如果以Assets/Resources/开头，直接移除这个前缀
                string relativePath = fullPath.Substring("Assets/Resources/".Length);

                // 移除文件扩展名
                relativePath = Path.ChangeExtension(relativePath, null);

                return relativePath;
            }

            // 如果不是标准格式，至少移除扩展名
            return Path.ChangeExtension(fullPath, null);
        }

        private CardNode CreateCardNode(StoryGraphEntity entity)
        {
            var node = new CardNode();
            node.nodeId = entity.uuid;

            string text = entity.text;
            LogManager.Log($"【卡牌节点】开始处理卡牌节点文本: \"{text}\"");

            // 统一解析广告标记
            ParseAdMark(ref text, out bool requireAd, out string adType);
            node.requireAd = requireAd;
            node.adType = adType;

            // 清理层级标记（卡牌节点不使用该值，仅清理）
            TryExtractAndRemoveTierIndex(ref text, out _);

            // 处理死亡节点标记（适用于任意节点类型）
            if (text.Contains("[死亡节点]"))
            {
                node.isDeadpoint = true;
                text = text.Replace("[死亡节点]", "").Trim();
            }

            // 处理[解锁成就:XXX]标记
            var unlockAchMatch = Regex.Match(text, @"\[解锁成就:([^\]]+)\]");
            if (unlockAchMatch.Success)
            {
                node.unlockAchievement = true;
                node.unlockAchievementName = unlockAchMatch.Groups[1].Value.Trim();
                text = text.Replace(unlockAchMatch.Value, "").Trim();
                LogManager.Log($"【解锁成就】检测到解锁成就标记: {node.unlockAchievementName}");
            }

            // 处理起点标记
            bool isStartNode = text.Contains("[起点]");
            text = text.Replace("[起点]", "").Trim();
            if (isStartNode)
            {
                node.title = "起始节点";
                LogManager.Log($"【卡牌节点】设置卡牌节点为起始节点: {node.nodeId}");
            }

            // 处理卡牌节点标记和提取卡牌名称
            string cardName = "";

            // 首先尝试匹配[卡牌选项:xxx]格式
            var cardMatch = Regex.Match(text, @"\[卡牌选项[：:]([^\]]+)\]");
            if (cardMatch.Success)
            {
                cardName = cardMatch.Groups[1].Value.Trim();
                text = text.Replace(cardMatch.Value, "").Trim();
                LogManager.Log($"【卡牌节点】识别到带名称的卡牌选项: {node.nodeId}, 卡牌名称: {cardName}, 剩余文本: \"{text}\"");
            }
            else
            {
                // 处理[卡牌选项]格式
                int startIndex = text.IndexOf("[卡牌选项]");
                if (startIndex >= 0)
                {
                    // 移除[卡牌选项]标记，但保留《AD》标记
                    string beforeCardOption = text.Substring(0, startIndex);
                    string afterCardOption = text.Substring(startIndex + "[卡牌选项]".Length);
                    text = (beforeCardOption + afterCardOption).Trim();
                    LogManager.Log($"【卡牌节点】移除[卡牌选项]标记后的文本: \"{text}\"");

                    // 清理所有特殊标记，只保留纯文本
                    string cleanText = text;
                    // 移除所有《》标记
                    cleanText = Regex.Replace(cleanText, @"《[^》]*》", "");
                    // 移除所有<>标记
                    cleanText = Regex.Replace(cleanText, @"<[^>]*>", "");
                    // 移除所有[]标记
                    cleanText = Regex.Replace(cleanText, @"\[[^\]]*\]", "");
                    // 移除所有（）标记
                    cleanText = Regex.Replace(cleanText, @"（[^）]*）", "");
                    // 移除所有()标记
                    cleanText = Regex.Replace(cleanText, @"\([^)]*\)", "");
                    // 移除所有！标记
                    cleanText = cleanText.Replace("！", "").Replace("!", "");
                    // 清理多余空格
                    cleanText = cleanText.Trim();

                    cardName = cleanText;
                    LogManager.Log($"【卡牌节点】清理特殊标记后的卡牌名称: {cardName}, 原始文本: \"{text}\"");
                }
            }

            if (!string.IsNullOrEmpty(cardName))
            {
                // 设置卡牌图片路径
                node.cardImagePath = FindCardImagePath(cardName);
                LogManager.Log($"【卡牌节点】设置卡牌图片路径: {node.cardImagePath}");

                // 设置节点标题
                node.title = $"卡牌: {text}"; // 使用完整文本作为标题
                LogManager.Log($"【卡牌节点】设置标题: {node.title}");
            }

            // 处理条件和效果之前的文本内容
            LogManager.Log($"【卡牌节点】处理条件和效果之前的文本: \"{text}\"");

            // 处理隐藏选项标记
            bool isHiddenOption = text.Contains("[隐藏]");
            if (isHiddenOption)
            {
                text = text.Replace("[隐藏]", "").Trim();
                node.showWhenUnavailable = false;
                LogManager.Log($"【卡牌节点】设置为隐藏卡牌节点: {node.nodeId}, 文本: \"{text}\", 条件不满足时不显示");
            }
            else
            {
                node.showWhenUnavailable = true;
            }

            // 新增：处理提前显示标记 [提前]
            bool isShowEarly = text.Contains("[提前]");
            if (isShowEarly)
            {
                node.showEarly = true;
                text = text.Replace("[提前]", "").Trim();
                LogManager.Log($"【卡牌节点-提前显示】检测到提前显示标记: {node.nodeId}, 文本: \"{text}\"");
            }

            // 处理重置到CP点标记
            bool isResetToCP = text.Contains("[重置到CP点]");
            if (isResetToCP)
            {
                node.isResetToCP = true;
                LogManager.Log($"【重置到CP点】设置卡牌节点 {node.nodeId} 为重置到CP点节点");

                // 从文本中移除标记
                text = text.Replace("[重置到CP点]", "").Trim();

                // 如果有标题，添加重置到CP点标记
                if (string.IsNullOrEmpty(node.title))
                {
                    node.title = "重置到CP点";
                }
                else
                {
                    node.title += " | 重置到CP点";
                }
            }

            // 处理条件
            ProcessCardConditions(text, node);

            // 处理变量效果
            ProcessVariableEffects(text, node);
            LogManager.Log($"【卡牌节点】处理变量效果的文本: {text}");
            // 设置位置信息
            if (entity.location != null && entity.location.Length >= 2)
            {
                float yMult = InvertY ? -1f : 1f;
                node.position = new Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
                LogManager.Log($"【卡牌节点】设置节点位置: ({node.position.x}, {node.position.y})");
            }

            return node;
        }

        private void ProcessCardConditions(string text, CardNode node)
        {
            var conditions = new List<VariableCondition>();

            LogManager.Log($"【卡牌条件】开始处理条件，原始文本: \"{text}\"");

            // 修改AD条件检查，使用不区分大小写的比较
            if (text.IndexOf("《AD》", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                node.requireAd = true;
                LogManager.Log($"【卡牌条件】检测到广告条件，设置requireAd=true: {node.nodeId}");
                // 从文本中移除AD条件标记（不区分大小写）
                text = Regex.Replace(text, "《AD》", "", RegexOptions.IgnoreCase).Trim();
                LogManager.Log($"【卡牌条件】移除AD标记后的文本: \"{text}\"");
            }
            else
            {
                LogManager.Log($"【卡牌条件】未检测到广告条件");
            }

            // 处理其他条件标记
            var matches = Regex.Matches(text, @"《([^》]*?)》");
            LogManager.Log($"【卡牌条件】卡牌节点 {node.nodeId} 开始处理条件，共找到 {matches.Count} 个条件标记");

            foreach (Match match in matches)
            {
                string conditionText = match.Groups[1].Value;
                LogManager.Log($"【卡牌条件】处理条件文本: \"{conditionText}\"");

                // 跳过概率标识（包括数字或变量的百分比，如《50%》《幸运值%》《幸运值%:2》）
                if (Regex.IsMatch(conditionText, @"^\s*[^%]+%\s*(?:(?:[:：]\s*\d+)\s*)?$"))
                {
                    LogManager.Log($"【卡牌条件】跳过概率选项标识《{conditionText}》，不转换为条件");
                    continue;
                }

                // 跳过AD标记，因为已经在前面处理过了
                if (conditionText.Equals("AD", StringComparison.OrdinalIgnoreCase))
                {
                    LogManager.Log($"【卡牌条件】跳过AD标记");
                    continue;
                }

                var condition = ParseVariableCondition(conditionText);
                if (condition != null)
                {
                    conditions.Add(condition);
                    // 添加到描述
                    if (string.IsNullOrEmpty(node.description))
                        node.description = $"需满足{conditionText}";
                    else
                        node.description += $"; 需满足{conditionText}";

                    // 注意：条件判断中的变量不应该被自动提取为独立变量
                    // 只有在变量效果中出现的变量才应该被提取

                    LogManager.Log($"【卡牌条件】为卡牌节点 {node.nodeId} 添加条件: {conditionText}, 解析结果: 变量={condition.variableName}, 操作={condition.operation}, 值={condition.value}");
                }
                else
                {
                    LogManager.LogWarning($"【卡牌条件】卡牌节点 {node.nodeId} 条件 《{conditionText}》 解析失败");
                }
            }

            node.conditions = conditions;
            LogManager.Log($"【卡牌条件】卡牌节点 {node.nodeId} 条件处理完成，共添加了 {conditions.Count} 个条件，requireAd={node.requireAd}");
        }

        private string FindCardImagePath(string cardName)
        {
            LogManager.Log($"查找卡牌图片: \"{cardName}\"");

            // 直接使用卡牌名称作为图片名称
            string resourcePath = $"Images/{cardName}";

            // 检查Resources目录下是否存在该图片
            Sprite sprite = Resources.Load<Sprite>(resourcePath);
            if (sprite != null)
            {
                LogManager.Log($"找到卡牌图片: {resourcePath}");
                cardImageMatchLogs.Add($"{cardName}卡牌图片精确匹配成功");
                Resources.UnloadAsset(sprite); // 卸载资源避免内存泄漏
                return resourcePath;
            }

            // 尝试在Cards目录下查找
            resourcePath = $"Cards/{cardName}";
            sprite = Resources.Load<Sprite>(resourcePath);
            if (sprite != null)
            {
                LogManager.Log($"找到卡牌图片: {resourcePath}");
                cardImageMatchLogs.Add($"{cardName}卡牌图片精确匹配成功");
                Resources.UnloadAsset(sprite); // 卸载资源避免内存泄漏
                return resourcePath;
            }

            // 根据存放文件说明，更新卡牌图片查找路径配置
            string[] searchDirectories = new string[]
            {
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/CardImages",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/CommodityIcons",
                "Assets/Resources/GameProduceFiles/GameResources/Shops/ShopImages/RewardImages",
                "Assets/Resources/GameProduceFiles/GameResources/GameIcons",
                "Assets/Resources/Images",
                "Assets/Resources/Cards",
                "Assets/Resources"
            };

            // 搜索整个Resources目录中的图片文件
            string resourcesPath = Application.dataPath + "/Resources";

            // 检查Resources目录是否存在
            if (!Directory.Exists(resourcesPath))
            {
                LogManager.LogWarning($"Resources目录不存在: {resourcesPath}");
                return cardName; // 仅返回卡牌名称
            }

            // 搜集所有图片文件
            List<string> allImageFiles = new List<string>();
            string[] imageExtensions = new string[] { "*.png", "*.jpg", "*.jpeg", "*.tga" };

            foreach (var extension in imageExtensions)
            {
                try
                {
                    allImageFiles.AddRange(Directory.GetFiles(resourcesPath, extension, SearchOption.AllDirectories));
                }
                catch (System.Exception ex)
                {
                    LogManager.LogWarning($"搜索Resources目录时出错: {extension}, 错误: {ex.Message}");
                }
            }

            LogManager.Log($"共找到 {allImageFiles.Count} 个图片文件");

            // 1. 尝试完全匹配卡牌名称
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Equals(cardName, StringComparison.OrdinalIgnoreCase))
                {
                    // 从文件路径中提取Resources相对路径
                    // 处理路径，兼容Windows反斜杠
                    string normalizedPath = file.Replace('\\', '/');
                    int resourcesIndex = normalizedPath.IndexOf("/Resources/", StringComparison.OrdinalIgnoreCase);
                    if (resourcesIndex >= 0)
                    {
                        string relativePath = normalizedPath.Substring(resourcesIndex + "/Resources/".Length);
                        // 移除文件扩展名
                        relativePath = Path.ChangeExtension(relativePath, null);
                        LogManager.Log($"找到卡牌图片完全匹配: {relativePath}");
                        videoMatchLogs.Add($"[卡牌匹配日志]{fileName}卡牌图片精确匹配成功");
                        return relativePath;
                    }
                }
            }

            // 2. 尝试包含匹配
            foreach (var file in allImageFiles)
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                if (fileName.Contains(cardName) || cardName.Contains(fileName))
                {
                    // 从文件路径中提取Resources相对路径
                    // 处理路径，兼容Windows反斜杠
                    string normalizedPath = file.Replace('\\', '/');
                    int resourcesIndex = normalizedPath.IndexOf("/Resources/", StringComparison.OrdinalIgnoreCase);
                    if (resourcesIndex >= 0)
                    {
                        string relativePath = normalizedPath.Substring(resourcesIndex + "/Resources/".Length);
                        // 移除文件扩展名
                        relativePath = Path.ChangeExtension(relativePath, null);
                        LogManager.Log($"找到卡牌图片包含匹配: {relativePath}");
                        videoMatchLogs.Add($"[卡牌匹配日志]{fileName}卡牌图片精确匹配成功");
                        return relativePath;
                    }
                }
            }

            // 3. 如果没有找到匹配的图片，尝试直接在一些常见目录中查找
            string[] commonDirs = new string[] { "Cards", "Images", "CardImages", "UI/Cards" };
            foreach (var dir in commonDirs)
            {
                resourcePath = $"{dir}/{cardName}";
                LogManager.Log($"尝试常见目录路径: {resourcePath}");
                // 检查这个路径是否存在
                sprite = Resources.Load<Sprite>(resourcePath);
                if (sprite != null)
                {
                    LogManager.Log($"在常见目录中找到卡牌图片: {resourcePath}");
                    cardImageMatchLogs.Add($"{cardName}卡牌图片精确匹配成功");
                    Resources.UnloadAsset(sprite); // 卸载资源避免内存泄漏
                    return resourcePath;
                }
            }

            // 如果所有方法都失败，只返回卡牌名称
            LogManager.LogWarning($"未找到匹配的卡牌图片: {cardName}，将直接使用名称");
            cardImageMatchLogs.Add($"卡牌图片精确匹配失败：{cardName}，未找到匹配的图片");
            return cardName;
        }

        /// <summary>
        /// 统一解析并移除《AD》《AD:15》《AD:30》《AD:3》广告标记，自动设置requireAd/adType
        /// </summary>
        private void ParseAdMark(ref string text, out bool requireAd, out string adType)
        {
            requireAd = false;
            adType = string.Empty;
            // 更严格的正则，确保只有独立的广告标记才会被识别
            var adMatch = Regex.Match(text, @"(?<!\w)《AD([:：]?(\d{1,3}))?》(?!\w)");
            if (adMatch.Success)
            {
                requireAd = true;
                var num = adMatch.Groups[2].Value;
                if (num == "15") adType = "fullscreen";
                else if (num == "30") adType = "rewarded";
                else if (num == "3") adType = "splash";
                else adType = "rewarded";
                text = text.Replace(adMatch.Value, "").Trim();
            }
        }

        // 新增：解析并移除层级标记 [层级:xxx] 或 [层级：xxx]，返回是否解析成功
        private bool TryExtractAndRemoveTierIndex(ref string text, out int tierIndex)
        {
            tierIndex = 0;
            if (string.IsNullOrEmpty(text)) return false;

            var match = Regex.Match(text, @"\[\s*层级\s*[：:]\s*(-?\d+)\s*\]");
            if (match.Success)
            {
                int parsed;
                if (int.TryParse(match.Groups[1].Value, out parsed))
                {
                    tierIndex = parsed;
                }
                // 清理该标识
                text = text.Replace(match.Value, "").Trim();
                LogManager.Log($"【层级标记】解析层级标记成功，tierIndex={tierIndex}");
                return true;
            }

            return false;
        }


        /// <summary>
        /// 清理旧的变量文件
        /// </summary>
        private void ClearOldVariableFiles()
        {
            try
            {
                string variableDir = "Assets/Resources/GameProduceFiles/Configs/Variables";
                string videoMatchLogsPath = "Assets/VideoMatchLogs/";
                string videoNodeFilesPath = "Assets/VideoNodeInfo/";
                if (Directory.Exists(variableDir))
                {
                    // 删除统一的变量文件
                    string variableFile = Path.Combine(variableDir, "Variables.json");
                    if (File.Exists(variableFile))
                    {
                        File.Delete(variableFile);
                        LogManager.Log($"删除统一变量文件: {variableFile}");
                    }

                    // 删除对应的.meta文件
                    string metaFile = Path.Combine(variableDir, "Variables.json.meta");
                    if (File.Exists(metaFile))
                    {
                        File.Delete(metaFile);
                        LogManager.Log($"删除统一变量meta文件: {metaFile}");
                    }

                    // 同时清理旧的章节变量文件（兼容性清理）
                    string[] oldVariableFiles = Directory.GetFiles(variableDir, "*_Variables.json");
                    foreach (string file in oldVariableFiles)
                    {
                        File.Delete(file);
                        LogManager.Log($"删除旧章节变量文件: {file}");
                    }

                    // 删除对应的.meta文件
                    string[] oldMetaFiles = Directory.GetFiles(variableDir, "*_Variables.json.meta");
                    foreach (string file in oldMetaFiles)
                    {
                        File.Delete(file);
                        LogManager.Log($"删除旧章节变量meta文件: {file}");
                    }

                    //删除所有视频匹配日志文件
                    if (Directory.Exists(videoMatchLogsPath))
                    {
                        string[] videoMatchlogsFiles = Directory.GetFiles(videoMatchLogsPath, "*.txt");
                        foreach (string file in videoMatchlogsFiles)
                        {
                            File.Delete(file);
                            LogManager.Log($"删除匹配日志: {file}");
                        }
                    }
                    else
                    {
                        LogManager.Log("视频匹配日志目录不存在，无需清理");
                    }

                    //删除所有视频节点信息日志文件
                    if (Directory.Exists(videoNodeFilesPath))
                    {
                        string[] videoNodeFiles = Directory.GetFiles(videoNodeFilesPath, "*.txt");
                        foreach (string file in videoNodeFiles)
                        {
                            File.Delete(file);
                            LogManager.Log($"删除视频节点日志: {file}");
                        }
                    }
                    else
                    {
                        LogManager.Log("视频节点信息日志目录不存在，无需清理");
                    }
                    // 刷新资源数据库
                    AssetDatabase.Refresh();
                    LogManager.Log($"清理完成，删除了 {oldVariableFiles.Length} 个变量文件");
                }
                else
                {
                    LogManager.Log("变量目录不存在，无需清理");
                }
            }
            catch (Exception ex)
            {
                LogManager.LogError($"清理旧变量文件时出错: {ex.Message}");
            }
        }

        // 打开变量管理器窗口

        public class StoryGraph
        {
            public List<StoryGraphEntity> entities { get; set; }
            public List<StoryGraphAssociation> associations { get; set; }
        }

        public class StoryGraphEntity
        {
            public float[] location { get; set; }
            public float[] size { get; set; }
            public string text { get; set; }
            public string uuid { get; set; }
            public string details { get; set; }
            public float[] color { get; set; }
            public string type { get; set; }
        }

        public class StoryGraphAssociation
        {
            public string source { get; set; }
            public string target { get; set; }
            public string text { get; set; }
            public string uuid { get; set; }
            public string type { get; set; }
            public float[] color { get; set; }
        }

        /// <summary>
        /// 从xlsx转换成的json文件获取变量列表
        /// </summary>
        /// <returns></returns>
        public List<VariableData> GetVariableDatasFromXlsx()
        {
            VariableExtractor.ExtractVariable(xlsxFilePath);
            TextAsset textAsset = Resources.Load<TextAsset>("VariableData/VariableData");
            if (textAsset == null)
            {
                LogManager.LogError("【变量提取器】路径有误，再检查一下");
                return new List<VariableData>();
            }

            VariableExtractListTemp dataTemp = JsonUtility.FromJson<VariableExtractListTemp>(textAsset.text);
            if (dataTemp.data == null || dataTemp.data.Count <= 0)
            {
                LogManager.LogError("JSON 解析失败或数据为空！");
                return new List<VariableData>();
            }

            List<VariableData> result = new List<VariableData>();
            foreach (var temp in dataTemp.data)
            {
                VariableData variable = new VariableData();
                CopyDataFromTemp(temp, variable);
                // 若存在全局最大值标记，则覆盖
                if (!string.IsNullOrEmpty(globalMaxValueOverride))
                {
                    variable.maxValue = globalMaxValueOverride;
                }
                result.Add(variable);
            }

            return result;
        }

        private void ApplyGlobalMaxToExtractedVariables()
        {
            if (string.IsNullOrEmpty(globalMaxValueOverride)) return;
            if (ExtractedVariables == null || ExtractedVariables.Count == 0) return;
            foreach (var v in ExtractedVariables)
            {
                v.maxValue = globalMaxValueOverride;
            }
            LogManager.Log($"【变量提取】已将全局最大值覆盖到 {ExtractedVariables.Count} 个变量，值={globalMaxValueOverride}");
        }

        private void CopyDataFromTemp(VariableDataTemp temp, VariableData target)
        {
            target.name = temp.name;
            target.displayName = temp.displayName;
            target.description = temp.description;
            target.type = VariableType.Integer;
            target.persistenceType = (VariablePersistenceType)(int.TryParse(temp.persistenceType.Trim(), out var result1) ? (result1 == 2 ? 1 : result1) : 1);
            target.defaultValue = temp.defaultValue;
            target.maxValue = temp.maxValue;
            target.usePlayerPrefs = temp.usePlayerPrefs;
            target.playerPrefsDefaultValue = temp.playerPrefsDefaultValue;
            target.showAsProgress = temp.showAsProgress;
            target.iconPath = temp.iconPath;
            target.priority = int.TryParse(temp.priority.Trim(), out var result2) ? result2 : 0;
            target.isHidden = temp.isHidden;
            target.order = int.TryParse(temp.order.Trim(), out var result3) ? result3 : 0;

            target.addValueForDay = int.TryParse(temp.addValueForDay.Trim(), out var result4) ? result4 : 0;
            target.addValueForWeek = int.TryParse(temp.addValueForWeek.Trim(), out var result5) ? result5 : 0;
            target.addValueForMonth = int.TryParse(temp.addValueForMonth.Trim(), out var result6) ? result6 : 0;

            // 将 List<int> 转换为 int[]
            target.newUserAddValueForDay = ConvertStringListToIntArray(temp.newUserAddValueForDay);
            target.newUserAddValueForWeek = ConvertStringListToIntArray(temp.newUserAddValueForWeek);
            target.newUserAddValueForMonth = ConvertStringListToIntArray(temp.newUserAddValueForMonth);

            target.isResetDaily = temp.isResetDaily;
            target.resetDailyValue = temp.resetDailyValue;
            target.isResident = temp.isResident;
        }
        public static int[] ConvertStringListToIntArray(List<string> stringList)
        {
            // 处理输入为 null 的情况
            if (stringList == null)
            {
                return new int[0];
            }

            List<int> intList = new List<int>();

            foreach (string str in stringList)
            {
                if (str != null && int.TryParse(str, out int result))
                {
                    intList.Add(result);
                }
                else
                {
                    Console.WriteLine($"跳过无效值: {str}");
                }
            }

            return intList.ToArray();
        }

        /// <summary>
        /// 验证跳转节点和跳转点的匹配关系
        /// </summary>
        /// <param name="storyData">故事数据</param>
        /// <returns>验证结果</returns>
        private bool ValidateJumpPoints(StoryData storyData)
        {
            if (storyData == null) return false;

            bool isValid = true;
            List<string> missingJumpPoints = new List<string>();
            List<string> unusedJumpPoints = new List<string>();

            // 收集所有跳转点ID
            HashSet<string> allJumpPointIds = new HashSet<string>();
            if (storyData.videoNodes != null)
            {
                foreach (var videoNode in storyData.videoNodes)
                {
                    if (videoNode.isJumpPoint && !string.IsNullOrEmpty(videoNode.jumpPointId))
                    {
                        allJumpPointIds.Add(videoNode.jumpPointId);
                    }
                }
            }

            // 检查跳转节点是否都有对应的跳转点
            if (storyData.jumpNodes != null)
            {
                foreach (var jumpNode in storyData.jumpNodes)
                {
                    if (!allJumpPointIds.Contains(jumpNode.jumpPointId))
                    {
                        missingJumpPoints.Add(jumpNode.jumpPointId);
                        isValid = false;
                        LogManager.LogError($"【跳转点验证】跳转节点 {jumpNode.nodeId} 引用的跳转点 {jumpNode.jumpPointId} 不存在");
                    }
                }
            }

            // 检查是否有未使用的跳转点
            HashSet<string> usedJumpPointIds = new HashSet<string>();
            if (storyData.jumpNodes != null)
            {
                foreach (var jumpNode in storyData.jumpNodes)
                {
                    usedJumpPointIds.Add(jumpNode.jumpPointId);
                }
            }

            foreach (string jumpPointId in allJumpPointIds)
            {
                if (!usedJumpPointIds.Contains(jumpPointId))
                {
                    unusedJumpPoints.Add(jumpPointId);
                    LogManager.LogWarning($"【跳转点验证】跳转点 {jumpPointId} 没有被任何跳转节点引用");
                }
            }

            // 输出验证结果
            if (missingJumpPoints.Count > 0)
            {
                LogManager.LogError($"【跳转点验证】发现 {missingJumpPoints.Count} 个缺失的跳转点: {string.Join(", ", missingJumpPoints)}");
            }

            if (unusedJumpPoints.Count > 0)
            {
                LogManager.LogWarning($"【跳转点验证】发现 {unusedJumpPoints.Count} 个未使用的跳转点: {string.Join(", ", unusedJumpPoints)}");
            }

            if (isValid)
            {
                LogManager.Log($"【跳转点验证】所有跳转节点和跳转点匹配正确，共 {storyData.jumpNodes?.Count ?? 0} 个跳转节点，{allJumpPointIds.Count} 个跳转点");
            }

            return isValid;
        }

        string[] imageExtensions = { ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tga", ".tif", ".tiff", ".psd", ".webp", ".svg" };
        
        /// <summary>
        /// 根据商品名称查找商品ID
        /// </summary>
        /// <param name="productName">商品名称</param>
        /// <returns>商品ID，如果未找到则返回null</returns>
        private string FindProductIdByName(string productName)
        {
            try
            {
                // 尝试从Resources加载商店数据
                var shopData = Resources.Load<TextAsset>("GameProduceFiles/Configs/ShopData");
                if (shopData != null)
                {
                    var shopDataContainer = JsonUtility.FromJson<ShopData>(shopData.text);
                    if (shopDataContainer != null && shopDataContainer.categories != null)
                    {
                        foreach (var category in shopDataContainer.categories)
                        {
                            if (category.items != null)
                            {
                                foreach (var item in category.items)
                                {
                                    // 精确匹配商品名称
                                    if (item.name == productName)
                                    {
                                        return item.id;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                LogManager.LogWarning($"加载商店数据失败: {e.Message}");
            }
            
            return null;
        }
        
        private void SetImageInfo(string path)
        {
            // 尝试添加常见扩展名（如果路径不包含扩展名）
            if (!Path.HasExtension(path))
            {
                foreach (var ext in imageExtensions)
                {
                    string candidate = path + ext;
                    if (File.Exists(candidate))
                    {
                        path = candidate;
                        break;
                    }
                }
            }

            // 检查路径是否存在
            if (!File.Exists(path))
            {
                LogManager.LogError($"路径不存在: {path}");
                return;
            }
            // 获取并设置纹理

            TextureImporter image = (TextureImporter)TextureImporter.GetAtPath(path);
            if (image != null)
            {
                image.textureType = TextureImporterType.Sprite;
                image.isReadable = true;
                LogManager.Log($"文件图片设置成功！{path}");
                image.SaveAndReimport();
            }
        }

        /// <summary>
        /// 创建任务节点
        /// </summary>
        private TaskNode CreateTaskNode(StoryGraphEntity entity)
        {
            var node = new TaskNode();
            node.nodeId = entity.uuid;
            LogManager.Log($"【任务节点转换】创建任务节点，entity.uuid: {entity.uuid}, 设置nodeId: {node.nodeId}");

            string text = entity.text;
            LogManager.Log($"【任务节点】开始处理任务节点文本: \"{text}\"");

            // 解析[任务节点:数字]标记，提取最大显示数量
            var taskNodeMatch = Regex.Match(text, @"\[任务节点:?(\d*)\]");
            if (taskNodeMatch.Success)
            {
                string maxCountStr = taskNodeMatch.Groups[1].Value;
                if (!string.IsNullOrEmpty(maxCountStr) && int.TryParse(maxCountStr, out int maxCount))
                {
                    node.maxDisplayCount = maxCount;
                    LogManager.Log($"【任务节点】设置最大显示数量: {maxCount}");
                }
                else
                {
                    node.maxDisplayCount = 3; // 默认值
                    LogManager.Log($"【任务节点】使用默认最大显示数量: 3");
                }

                // 移除标记
                text = text.Replace(taskNodeMatch.Value, "").Trim();
            }

            // 处理起点标记
            bool isStartNode = text.Contains("[起点]");
            text = text.Replace("[起点]", "").Trim();
            if (isStartNode)
            {
                node.title = "起始节点";
                LogManager.Log($"【任务节点】设置任务节点为起始节点: {node.nodeId}");
            }

            // 解析任务列表
            // 格式: 任务名1:《条件1》:<奖励1>;任务名2:《条件2》:<奖励2>;
            node.tasks = ParseTaskList(text);
            LogManager.Log($"【任务节点】共解析出 {node.tasks.Count} 个任务");

            // 设置节点位置
            if (entity.location != null && entity.location.Length >= 2)
            {
                float yMult = InvertY ? -1f : 1f;
                node.position = new UnityEngine.Vector2(entity.location[1] * ScaleFactorX, entity.location[0] * ScaleFactorY * yMult);
            }

            return node;
        }

        /// <summary>
        /// 解析任务列表
        /// 格式: 任务名1:《条件1》:<奖励1>;任务名2:《条件2》:<奖励2>;
        /// </summary>
        private List<Task> ParseTaskList(string text)
        {
            var tasks = new List<Task>();

            if (string.IsNullOrEmpty(text))
            {
                LogManager.LogWarning("【任务节点】任务文本为空");
                return tasks;
            }

            // 按分号分割任务
            string[] taskStrings = text.Split(new[] { ';', '；' }, StringSplitOptions.RemoveEmptyEntries);
            LogManager.Log($"【任务节点】分割出 {taskStrings.Length} 个任务字符串");

            foreach (string taskStr in taskStrings)
            {
                string trimmedTaskStr = taskStr.Trim();
                if (string.IsNullOrEmpty(trimmedTaskStr))
                    continue;

                LogManager.Log($"【任务节点】解析任务: \"{trimmedTaskStr}\"");

                var task = ParseSingleTask(trimmedTaskStr);
                if (task != null)
                {
                    tasks.Add(task);
                    LogManager.Log($"【任务节点】成功解析任务: {task.taskName}");
                }
                else
                {
                    LogManager.LogWarning($"【任务节点】解析任务失败: \"{trimmedTaskStr}\"");
                }
            }

            return tasks;
        }

        /// <summary>
        /// 解析单个任务
        /// 格式: 任务名:《条件》:<奖励>
        /// </summary>
        private Task ParseSingleTask(string taskStr)
        {
            try
            {
                var task = new Task();

                // 使用正则表达式匹配任务格式
                // 格式: 任务名:《条件》:<奖励>
                var taskMatch = Regex.Match(taskStr, @"^([^:：《]+)[：:]《([^》]+)》[：:]<([^>]+)>$");
                
                if (!taskMatch.Success)
                {
                    LogManager.LogWarning($"【任务节点】任务格式不匹配: \"{taskStr}\"，期望格式: 任务名:《条件》:<奖励>");
                    return null;
                }

                // 提取任务名
                task.taskName = taskMatch.Groups[1].Value.Trim();
                LogManager.Log($"【任务节点】任务名: {task.taskName}");

                // 提取并解析条件
                string conditionText = taskMatch.Groups[2].Value.Trim();
                LogManager.Log($"【任务节点】条件文本: {conditionText}");
                var condition = ParseVariableCondition(conditionText);
                if (condition != null)
                {
                    task.conditions.Add(condition);
                    LogManager.Log($"【任务节点】解析条件成功: 变量={condition.variableName}, 操作={condition.operation}, 值={condition.value}");
                }
                else
                {
                    LogManager.LogWarning($"【任务节点】解析条件失败: {conditionText}");
                }

                // 提取并解析奖励
                string rewardText = taskMatch.Groups[3].Value.Trim();
                LogManager.Log($"【任务节点】奖励文本: {rewardText}");
                var reward = ParseVariableEffect(rewardText);
                if (reward != null)
                {
                    task.rewards.Add(reward);
                    LogManager.Log($"【任务节点】解析奖励成功: 变量={reward.variableName}, 操作={reward.operation}, 值={reward.value}");
                }
                else
                {
                    LogManager.LogWarning($"【任务节点】解析奖励失败: {rewardText}");
                }

                return task;
            }
            catch (Exception ex)
            {
                LogManager.LogError($"【任务节点】解析任务时发生异常: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 统一符号标准化处理 - 将全角符号转换为半角符号
        /// </summary>
        /// <param name="text">需要标准化的文本</param>
        /// <returns>标准化后的文本</returns>
        private string NormalizeSymbols(string text)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            // 使用ChineseSignToEnglish处理字符映射
            string normalizedText = ChineseSignToEnglish.SignToEnglish(text);
            
            // 处理ChineseSignToEnglish无法处理的特殊字符（字符串替换）
            var additionalMappings = new Dictionary<string, string>
            {
                // 引号 - 智能引号转标准引号
                {"\u201C", "\""},  // 左双引号 "
                {"\u201D", "\""},  // 右双引号 "
                {"\u2018", "'"},   // 左单引号 '
                {"\u2019", "'"},   // 右单引号 '
                
                // 省略号
                {"…", "..."},
            };
            
            // 应用额外的字符串映射
            foreach (var mapping in additionalMappings)
            {
                normalizedText = normalizedText.Replace(mapping.Key, mapping.Value);
            }

            // 清理多余的空格
            normalizedText = System.Text.RegularExpressions.Regex.Replace(normalizedText, @"\s+", " ");
            normalizedText = normalizedText.Trim();

            if (normalizedText != text)
            {
                LogManager.Log($"【符号标准化】原始: \"{text}\" -> 标准化: \"{normalizedText}\"");
            }

            return normalizedText;
        }

    }
}