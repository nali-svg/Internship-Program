/**
 * 变量辅助工具
 * 用于自动创建和管理变量
 */

// 类型映射 - 将字符串类型转换为数字类型
const TYPE_MAP = {
  'Boolean': 3,
  'Integer': 0,
  'Float': 1,
  'String': 2
};

// 持久化类型映射 - 将字符串类型转换为数字类型
const PERSISTENCE_TYPE_MAP = {
  'ChapterConstant': 0,
  'Accumulative': 1,
  'Shop': 2,
  'NULL': 3
};

// 反向类型映射 - 将数字类型转换为字符串类型
const REVERSE_TYPE_MAP = {
  0: 'Integer',
  1: 'Float',
  2: 'String',
  3: 'Boolean'
};

// 反向持久化类型映射 - 将数字类型转换为字符串类型
const REVERSE_PERSISTENCE_TYPE_MAP = {
  0: 'ChapterConstant',
  1: 'Accumulative',
  2: 'Shop',
  3: 'NULL'
};

/**
 * 转换变量数据为 VariableData.json 导出格式
 * @param {Array} variables - 变量数组
 * @returns {Object} - 符合 VariableData.json 格式的对象
 */
export const convertVariablesToExportFormat = (variables) => {
  return {
    data: variables.map((variable, index) => ({
      name: variable.name,
      displayName: variable.displayName || "",
      description: variable.description || "",
      type: TYPE_MAP[variable.type] !== undefined ? TYPE_MAP[variable.type] : 0,
      persistenceType: PERSISTENCE_TYPE_MAP[variable.persistenceType] !== undefined ? PERSISTENCE_TYPE_MAP[variable.persistenceType] : 3,
      defaultValue: variable.defaultValue || "",
      minValue: variable.minValue || "0",
      maxValue: variable.maxValue || "1000000",
      usePlayerPrefs: variable.usePlayerPrefs !== undefined ? variable.usePlayerPrefs : true,
      playerPrefsDefaultValue: "",
      showAsProgress: variable.showAsProgress || false,
      iconPath: variable.iconPath || "",
      priority: variable.priority !== undefined ? variable.priority : 0,
      isHidden: variable.isHidden || false,
      order: variable.order !== undefined ? variable.order : (index + 1),
      addValueForDay: 0,
      addValueForWeek: 0,
      addValueForMonth: 0,
      newUserAddValueForDay: [0],
      newUserAddValueForWeek: [0],
      newUserAddValueForMonth: [0],
      isResetDaily: false,
      resetDailyValue: 0,
      isResident: false
    }))
  };
};

/**
 * 创建一个默认变量，变量名自动递增（新变量1, 新变量2, ...）
 * @param {Object} flowStore - zustand store 实例
 * @returns {string} - 新创建的变量名
 */
export const createDefaultVariable = (flowStore) => {
  const variables = flowStore.getState().variables;
  
  // 查找 "新变量1", "新变量2", ... 中最大的编号
  const newVariablePattern = /^新变量(\d+)$/;
  let maxNumber = 0;
  
  variables.forEach(v => {
    const match = v.name.match(newVariablePattern);
    if (match) {
      maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
    }
  });
  
  const newName = `新变量${maxNumber + 1}`;
  
  // 创建新变量，使用默认配置
  const newVariable = {
    name: newName,
    displayName: '',
    description: `自动创建的变量: ${newName}`,
    type: 'Integer',
    persistenceType: 'ChapterConstant',
    defaultValue: '0',
    minValue: '0',
    maxValue: '1000000',
    priority: 0,
    isHidden: false,
    order: -1,
    iconPath: '',
    showAsProgress: false,
    usePlayerPrefs: true,
  };
  
  // 调用 store 的 addVariable 方法
  flowStore.getState().addVariable(newVariable);
  
  // 在控制台输出日志
  console.log(`[自动创建变量] 变量 "${newName}" 已自动创建`);
  
  return newName;
};

/**
 * 在所有节点中重命名变量引用
 * @param {string} oldName - 旧变量名
 * @param {string} newName - 新变量名
 * @param {Object} flowStore - zustand store 实例
 */
export const renameVariableInAllNodes = (oldName, newName, flowStore) => {
  if (!oldName || !newName || oldName === newName) {
    return;
  }
  
  // 调用 store 的 renameVariableInNodes 方法
  flowStore.getState().renameVariableInNodes(oldName, newName);
  
  console.log(`[变量重命名] 已将所有节点中的变量 "${oldName}" 重命名为 "${newName}"`);
};

/**
 * 将类型值（数字或字符串）统一转换为数字，用于类型映射
 * @param {number|string} typeValue - 类型值（可能是数字、字符串数字或类型字符串）
 * @returns {number|null} - 转换后的数字类型值，如果无法转换则返回 null
 */
const normalizeTypeToNumber = (typeValue) => {
  if (typeof typeValue === 'number') {
    // 数字类型，直接返回整数部分
    return Math.floor(typeValue);
  } else if (typeof typeValue === 'string') {
    // 字符串类型：先检查是否是有效的类型字符串
    const validTypeStrings = ['Integer', 'Float', 'String', 'Boolean'];
    if (validTypeStrings.includes(typeValue)) {
      // 是有效的类型字符串，通过 TYPE_MAP 反向查找
      return TYPE_MAP[typeValue] !== undefined ? TYPE_MAP[typeValue] : null;
    } else {
      // 可能是字符串形式的数字，尝试解析
      const numeric = parseInt(typeValue, 10);
      return !isNaN(numeric) ? numeric : null;
    }
  }
  return null;
};

/**
 * 将持久化类型值（数字或字符串）统一转换为数字，用于类型映射
 * @param {number|string} persistenceValue - 持久化类型值
 * @returns {number|null} - 转换后的数字类型值，如果无法转换则返回 null
 */
const normalizePersistenceTypeToNumber = (persistenceValue) => {
  if (typeof persistenceValue === 'number') {
    return Math.floor(persistenceValue);
  } else if (typeof persistenceValue === 'string') {
    const validPersistenceTypeStrings = ['ChapterConstant', 'Accumulative', 'Shop', 'NULL'];
    if (validPersistenceTypeStrings.includes(persistenceValue)) {
      return PERSISTENCE_TYPE_MAP[persistenceValue] !== undefined ? PERSISTENCE_TYPE_MAP[persistenceValue] : null;
    } else {
      const numeric = parseInt(persistenceValue, 10);
      return !isNaN(numeric) ? numeric : null;
    }
  }
  return null;
};

/**
 * 从导入格式（数字类型）转换为变量管理器格式（字符串类型）
 * @param {Array} variables - 变量数组（可能包含数字类型的type和persistenceType）
 * @returns {Array} - 转换后的变量数组（字符串类型的type和persistenceType）
 */
export const convertVariablesFromImportFormat = (variables) => {
  console.log('[convertVariablesFromImportFormat] 函数被调用，输入变量数量:', variables?.length || 0);
  
  if (!Array.isArray(variables)) {
    console.warn('[convertVariablesFromImportFormat] 输入不是数组，返回空数组');
    return [];
  }

  const converted = variables.map((variable, index) => {
    const convertedVar = { ...variable };
    
    console.log(`[convertVariablesFromImportFormat] 处理变量 ${index + 1}:`, {
      name: variable.name,
      originalType: variable.type,
      originalTypeType: typeof variable.type,
      originalPersistenceType: variable.persistenceType,
      originalPersistenceTypeType: typeof variable.persistenceType
    });

    // 转换type：使用统一的辅助函数
    const numericType = normalizeTypeToNumber(variable.type);
    if (numericType !== null && REVERSE_TYPE_MAP[numericType] !== undefined) {
      convertedVar.type = REVERSE_TYPE_MAP[numericType];
      // 严格验证：确保 type: 0 转换为 'Integer'
      if (numericType === 0 && convertedVar.type !== 'Integer') {
        console.error(`[convertVariablesFromImportFormat] 严重错误：type 0 应该映射到 'Integer'，但得到了 '${convertedVar.type}'`);
        convertedVar.type = 'Integer'; // 强制修正
      }
      console.log(`[convertVariablesFromImportFormat] 变量 ${variable.name} type 转换: ${JSON.stringify(variable.type)} (${typeof variable.type}) -> ${numericType} -> ${convertedVar.type}`);
    } else {
      // 如果已经是有效的类型字符串，保持不变
      const validTypeStrings = ['Integer', 'Float', 'String', 'Boolean'];
      if (typeof variable.type === 'string' && validTypeStrings.includes(variable.type)) {
        convertedVar.type = variable.type;
        console.log(`[convertVariablesFromImportFormat] 变量 ${variable.name} type 已经是有效的类型字符串: ${variable.type}`);
      } else {
        // 无法转换，使用默认值并记录警告
        convertedVar.type = 'Integer';
        console.warn(`[convertVariablesFromImportFormat] 变量 ${variable.name} type ${JSON.stringify(variable.type)} 无法转换，使用默认值: Integer`);
      }
    }

    // 转换persistenceType：使用统一的辅助函数
    const numericPersistenceType = normalizePersistenceTypeToNumber(variable.persistenceType);
    if (numericPersistenceType !== null && REVERSE_PERSISTENCE_TYPE_MAP[numericPersistenceType] !== undefined) {
      convertedVar.persistenceType = REVERSE_PERSISTENCE_TYPE_MAP[numericPersistenceType];
      console.log(`[convertVariablesFromImportFormat] 变量 ${variable.name} persistenceType 转换: ${JSON.stringify(variable.persistenceType)} (${typeof variable.persistenceType}) -> ${numericPersistenceType} -> ${convertedVar.persistenceType}`);
    } else {
      // 如果已经是有效的类型字符串，保持不变
      const validPersistenceTypeStrings = ['ChapterConstant', 'Accumulative', 'Shop', 'NULL'];
      if (typeof variable.persistenceType === 'string' && validPersistenceTypeStrings.includes(variable.persistenceType)) {
        convertedVar.persistenceType = variable.persistenceType;
        console.log(`[convertVariablesFromImportFormat] 变量 ${variable.name} persistenceType 已经是有效的类型字符串: ${variable.persistenceType}`);
      } else {
        // 无法转换，使用默认值并记录警告
        convertedVar.persistenceType = 'ChapterConstant';
        console.warn(`[convertVariablesFromImportFormat] 变量 ${variable.name} persistenceType ${JSON.stringify(variable.persistenceType)} 无法转换，使用默认值: ChapterConstant`);
      }
    }

    return convertedVar;
  });
  
  console.log('[convertVariablesFromImportFormat] 转换完成，结果:', converted);
  // 验证转换结果
  const typeErrors = converted.filter(v => !['Integer', 'Float', 'String', 'Boolean'].includes(v.type));
  if (typeErrors.length > 0) {
    console.error('[convertVariablesFromImportFormat] 转换后仍有类型错误:', typeErrors);
  }
  return converted;
};
