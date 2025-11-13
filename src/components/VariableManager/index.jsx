import React, { useState, useRef, useEffect } from 'react';
import { Button, Modal, Form, Input, Select } from 'antd';
import styles from './index.module.scss';
import useFlowStore from '../../store/flowStore';
import { renameVariableInAllNodes } from '../../utils/variableHelper';

const { TextArea } = Input;

/**
 * 变量管理器组件
 * 用于管理全局变量
 */
export default function VariableManager() {
  const { variables, addVariable, updateVariable, deleteVariable, renameVariableInNodes } = useFlowStore();
  
  // 添加调试日志，监听变量变化
  useEffect(() => {
    console.log('[VariableManager] 变量数据已更新，数量:', variables.length);
    if (variables.length > 0) {
      console.log('[VariableManager] 变量数据示例:', variables[0]);
      console.log('[VariableManager] 所有变量的类型:', variables.map(v => ({ name: v.name, type: v.type, typeType: typeof v.type })));
    }
  }, [variables]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null);
  const [form] = Form.useForm();
  const iconFileInputRef = useRef(null);

  // 打开添加变量弹窗
  const handleAddVariable = () => {
    setEditingVariable(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // 打开编辑变量弹窗
  const handleEditVariable = (variable) => {
    setEditingVariable(variable);
    form.setFieldsValue(variable);
    setIsModalOpen(true);
  };

  // 确认添加/编辑变量
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingVariable) {
        // 编辑模式
        const oldName = editingVariable.name;
        const newName = values.name;
        
        // 如果变量名发生了变化，需要同步更新所有节点中的引用
        if (oldName !== newName) {
          renameVariableInAllNodes(oldName, newName, useFlowStore);
        }
        
        updateVariable(oldName, values);
      } else {
        // 添加模式
        addVariable(values);
      }
      
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  // 取消弹窗
  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  // 删除变量
  const handleDelete = (variableName) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除变量 "${variableName}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        deleteVariable(variableName);
      },
    });
  };

  // 处理变量图标文件选择
  const handleIconFileSelect = () => {
    iconFileInputRef.current?.click();
  };

  // 处理变量图标文件变化
  const handleIconFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name;
      form.setFieldsValue({ iconPath: fileName });
    }
    // 重置文件输入，允许重复选择同一文件
    e.target.value = '';
  };

  return (
    <div className={styles.variableManager}>
      {/* 主内容区 */}
      <div className={styles.content}>
        {/* 标题 */}
        <h2 className={styles.title}>变量管理器</h2>
        
        {/* 添加变量按钮 */}
        <Button 
          className={styles.addButton}
          onClick={handleAddVariable}
        >
          添加变量
        </Button>
        
        {/* 变量列表 */}
        <div className={styles.variableList}>
          {variables.length === 0 ? (
            <div className={styles.emptyTip}>暂无变量</div>
          ) : (
            variables.map((variable) => (
              <div key={variable.name} className={styles.variableItem}>
                <div className={styles.variableInfo}>
                  <div className={styles.variableName}>{variable.name}</div>
                  {variable.displayName && (
                    <div className={styles.variableDisplayName}>
                      {variable.displayName}
                    </div>
                  )}
                  <div className={styles.variableType}>
                    类型: {variable.type}
                  </div>
                  <div className={styles.variablePersistence}>
                    持久化: {variable.persistenceType}
                  </div>
                </div>
                <div className={styles.variableActions}>
                  <button 
                    className={styles.editBtn}
                    onClick={() => handleEditVariable(variable)}
                  >
                    编辑
                  </button>
                  <button 
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(variable.name)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 添加/编辑变量弹窗 */}
      <Modal
        title={editingVariable ? '编辑变量' : '添加变量'}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
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
          }}
        >
          {/* 1. 变量名 */}
          <Form.Item
            label="变量名"
            name="name"
            rules={[
              { required: true, message: '请输入变量名' },
              { 
                pattern: /^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/, 
                message: '变量名只能包含字母、数字、下划线和中文，且不能以数字开头' 
              },
            ]}
          >
            <Input placeholder="例如: 体力, health, score" />
          </Form.Item>

          {/* 2. 变量类型 */}
          <Form.Item
            label="变量类型"
            name="type"
          >
            <Select>
              <Select.Option value="Boolean">Boolean</Select.Option>
              <Select.Option value="Integer">Integer</Select.Option>
              <Select.Option value="Float">Float</Select.Option>
              <Select.Option value="String">String</Select.Option>
            </Select>
          </Form.Item>

          {/* 3. 持久化类型 */}
          <Form.Item
            label="持久化类型"
            name="persistenceType"
          >
            <Select>
              <Select.Option value="ChapterConstant">ChapterConstant</Select.Option>
              <Select.Option value="Accumulative">Accumulative</Select.Option>
              <Select.Option value="Shop">Shop</Select.Option>
              <Select.Option value="NULL">NULL</Select.Option>
            </Select>
          </Form.Item>

          {/* 4. 显示优先级 */}
          <Form.Item
            label="显示优先级"
            name="priority"
          >
            <Input type="number" placeholder="0" />
          </Form.Item>

          {/* 5. 隐藏变量 */}
          <Form.Item
            label="隐藏变量"
            name="isHidden"
            valuePropName="checked"
          >
            <input type="checkbox" />
          </Form.Item>

          {/* 6. 排序顺序 */}
          <Form.Item
            label="排序顺序"
            name="order"
          >
            <Input type="number" placeholder="-1" />
          </Form.Item>

          {/* 7. 默认值 */}
          <Form.Item
            label="默认值"
            name="defaultValue"
            rules={[{ required: true, message: '请输入默认值' }]}
          >
            <Input placeholder="0" />
          </Form.Item>

          {/* 8. 变量图标 */}
          <Form.Item
            label="变量图标"
            name="iconPath"
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input 
                placeholder="无 (精灵)" 
                readOnly 
                style={{ flex: 1 }}
              />
              <Button 
                onClick={handleIconFileSelect}
                type="default"
              >
                📁 选择图片
              </Button>
            </div>
          </Form.Item>

          {/* 9. 变量描述 */}
          <Form.Item
            label="变量描述"
            name="description"
          >
            <TextArea rows={3} placeholder="变量的用途说明（可选）" />
          </Form.Item>

          {/* 10. 最大值 */}
          <Form.Item
            label="最大值"
            name="maxValue"
          >
            <Input placeholder="1000000" />
          </Form.Item>

          {/* 11. 显示为进度条 */}
          <Form.Item
            label="显示为进度条"
            name="showAsProgress"
            valuePropName="checked"
          >
            <input type="checkbox" />
          </Form.Item>

          {/* 12. 持久化存储 */}
          <Form.Item
            label="持久化存储"
            name="usePlayerPrefs"
            valuePropName="checked"
          >
            <input type="checkbox" />
          </Form.Item>
        </Form>

        {/* 隐藏的图标文件输入 */}
        <input
          ref={iconFileInputRef}
          type="file"
          accept="image/*,.png,.jpg,.jpeg,.gif,.svg,.webp"
          onChange={handleIconFileChange}
          style={{ display: 'none' }}
        />
      </Modal>
    </div>
  );
}

