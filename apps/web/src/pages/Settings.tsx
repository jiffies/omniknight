import { useState } from 'react';
import { AddFilterRuleDialog } from '../components/AddFilterRuleDialog';
import { useFilterRules } from '../hooks/useFilterRules';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { apiClient, handleResponse } from '../lib/api-client';

export function Settings() {
  const { data: filterRulesData, refetch: refetchRules } = useFilterRules();
  const { data: systemConfigData, refetch: refetchConfig } = useSystemConfig();
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    error: pushError,
    permission: pushPermission,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();

  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configFormData, setConfigFormData] = useState({
    ai_provider: 'mock',
    ai_model: '',
    ai_temperature: 0.7,
    rate_limit_batch_size_steps: [1000, 500, 300, 100],
    rate_limit_wait_ms_steps: [2000, 3000, 4000, 5000],
  });

  const filterRules = filterRulesData?.data || [];
  const systemConfig = systemConfigData?.data || [];

  // 生成规则详情描述
  const getRuleDetails = (rule: {
    type: string;
    config: string | Record<string, unknown>;
  }): string => {
    try {
      const config =
        typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config;

      switch (rule.type) {
        case 'length':
          return `最小长度: ${config.minLength || 0}, 最大长度: ${config.maxLength || 0}`;
        case 'keyword': {
          const keywords = (config.keywords as string[]) || [];
          const mode = config.mode === 'blacklist' ? '黑名单' : '白名单';
          const caseSensitive = config.caseSensitive ? '区分大小写' : '不区分大小写';
          return `模式: ${mode}, ${caseSensitive}\n关键词: ${keywords.join(', ')}`;
        }
        case 'emoji':
          return config.emojiOnly ? '过滤纯表情消息' : '过滤包含表情的消息';
        case 'media':
          return '过滤仅包含媒体文件而无文本的消息';
        default:
          return '未知规则类型';
      }
    } catch {
      return '配置解析失败';
    }
  };

  const handleToggleRule = async (ruleId: number, isEnabled: boolean) => {
    try {
      const res = await apiClient.api['filter-rules'][':id'].$patch({
        param: { id: ruleId.toString() },
        json: { isEnabled: !isEnabled },
      });
      await handleResponse(res);
      refetchRules();
    } catch (err) {
      alert('更新失败');
    }
  };

  const handleDeleteRule = async (ruleId: number, ruleName: string) => {
    if (!confirm(`确定要删除规则"${ruleName}"吗？`)) {
      return;
    }
    try {
      const res = await apiClient.api['filter-rules'][':id'].$delete({
        param: { id: ruleId.toString() },
      });
      await handleResponse(res);
      alert('删除成功');
      refetchRules();
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleEditConfig = () => {
    // Load current config into form
    const configMap = new Map(
      systemConfig.map((c: { key: string; value: unknown }) => [c.key, c.value]),
    );
    setConfigFormData({
      ai_provider: (configMap.get('ai_provider') as string) || 'mock',
      ai_model: (configMap.get('ai_model') as string) || '',
      ai_temperature: (configMap.get('ai_temperature') as number) || 0.7,
      rate_limit_batch_size_steps: (configMap.get('rate_limit_batch_size_steps') as number[]) || [
        1000, 500, 300, 100,
      ],
      rate_limit_wait_ms_steps: (configMap.get('rate_limit_wait_ms_steps') as number[]) || [
        2000, 3000, 4000, 5000,
      ],
    });
    setEditingConfig(true);
  };

  const handleSaveConfig = async () => {
    try {
      // Save each config key
      await Promise.all([
        apiClient.api['system-config'][':key'].$put({
          param: { key: 'ai_provider' },
          json: { value: configFormData.ai_provider },
        }),
        apiClient.api['system-config'][':key'].$put({
          param: { key: 'ai_model' },
          json: { value: configFormData.ai_model },
        }),
        apiClient.api['system-config'][':key'].$put({
          param: { key: 'ai_temperature' },
          json: { value: configFormData.ai_temperature },
        }),
        apiClient.api['system-config'][':key'].$put({
          param: { key: 'rate_limit_batch_size_steps' },
          json: { value: configFormData.rate_limit_batch_size_steps },
        }),
        apiClient.api['system-config'][':key'].$put({
          param: { key: 'rate_limit_wait_ms_steps' },
          json: { value: configFormData.rate_limit_wait_ms_steps },
        }),
      ]);

      alert('配置已保存，立即生效');
      setEditingConfig(false);
      refetchConfig();
    } catch (err) {
      alert('保存失败');
    }
  };

  const handleCancelConfigEdit = () => {
    setEditingConfig(false);
  };

  return (
    <div>
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">设置</h2>
        <p className="mt-1 text-sm text-gray-600">配置过滤规则和系统参数</p>
      </div>

      {/* 过滤规则配置 */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">消息过滤规则</h3>
          <button
            type="button"
            onClick={() => setShowAddRuleDialog(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            添加规则
          </button>
        </div>

        {filterRules.length === 0 ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
            暂无过滤规则。点击"添加规则"创建新规则。
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    规则名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    优先级
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filterRules.map(
                  (rule: {
                    id: number;
                    name: string;
                    type: string;
                    config: string | Record<string, unknown>;
                    priority: number;
                    isEnabled: boolean;
                  }) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-gray-50 cursor-help"
                      title={getRuleDetails(rule)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rule.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rule.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rule.priority}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.isEnabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {rule.isEnabled ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule.id, rule.isEnabled)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {rule.isEnabled ? '禁用' : '启用'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            💡 <strong>提示：</strong>过滤规则修改后立即生效，无需重启服务。
            规则按优先级从小到大应用，第一个匹配的规则将决定消息是否被过滤。
          </p>
        </div>
      </div>

      {/* 全局配置 */}
      <div className="mt-8 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">全局配置</h3>
          {!editingConfig && (
            <button
              type="button"
              onClick={handleEditConfig}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              编辑配置
            </button>
          )}
        </div>

        <div className="bg-white shadow sm:rounded-lg p-6">
          <div className="space-y-4">
            {/* AI 配置 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">AI 模型配置</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">AI Provider</label>
                  {editingConfig ? (
                    <select
                      value={configFormData.ai_provider}
                      onChange={(e) =>
                        setConfigFormData({ ...configFormData, ai_provider: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="mock">Mock (测试)</option>
                      <option value="openai">OpenAI</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-900">
                      {systemConfig.find((c: { key: string }) => c.key === 'ai_provider')?.value ||
                        'mock'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">AI Model</label>
                  {editingConfig ? (
                    <input
                      type="text"
                      value={configFormData.ai_model}
                      onChange={(e) =>
                        setConfigFormData({ ...configFormData, ai_model: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="例如: gpt-4"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-900">
                      {systemConfig.find((c: { key: string }) => c.key === 'ai_model')?.value ||
                        '未设置'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 限流策略 */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">API 限流策略</h4>
              <p className="text-sm text-gray-500 mb-3">
                拉取 Telegram 消息时的批次大小和等待时间（逗号分隔）
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">批次大小步长</label>
                  {editingConfig ? (
                    <input
                      type="text"
                      value={configFormData.rate_limit_batch_size_steps.join(', ')}
                      onChange={(e) =>
                        setConfigFormData({
                          ...configFormData,
                          rate_limit_batch_size_steps: e.target.value
                            .split(',')
                            .map((v) => Number.parseInt(v.trim())),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="1000, 500, 300, 100"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-900">
                      {(
                        systemConfig.find(
                          (c: { key: string }) => c.key === 'rate_limit_batch_size_steps',
                        )?.value as number[]
                      )?.join(' → ') || '1000 → 500 → 300 → 100'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">等待时间步长 (ms)</label>
                  {editingConfig ? (
                    <input
                      type="text"
                      value={configFormData.rate_limit_wait_ms_steps.join(', ')}
                      onChange={(e) =>
                        setConfigFormData({
                          ...configFormData,
                          rate_limit_wait_ms_steps: e.target.value
                            .split(',')
                            .map((v) => Number.parseInt(v.trim())),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="2000, 3000, 4000, 5000"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-900">
                      {(
                        systemConfig.find(
                          (c: { key: string }) => c.key === 'rate_limit_wait_ms_steps',
                        )?.value as number[]
                      )?.join(' → ') || '2000 → 3000 → 4000 → 5000'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            {editingConfig && (
              <div className="border-t pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelConfigEdit}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  保存配置
                </button>
              </div>
            )}

            {/* 提示 */}
            <div className="border-t pt-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-800">
                  ✅ <strong>提示：</strong>全局配置修改后立即生效，无需重启服务。
                  配置在下次AI调用或消息拉取时自动应用。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 通知设置 */}
      <div className="mt-8 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">通知设置</h3>
        <div className="bg-white shadow sm:rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">推送通知</h4>
                <p className="text-sm text-gray-500">
                  {!isPushSupported
                    ? '您的浏览器不支持推送通知'
                    : isPushSubscribed
                      ? '任务完成或失败时，即使浏览器在后台也会收到通知'
                      : '启用后，任务完成或失败时会收到浏览器推送通知'}
                </p>
                {pushError && <p className="text-sm text-red-600 mt-1">{pushError}</p>}
              </div>
              <div className="flex items-center gap-3">
                {isPushLoading ? (
                  <span className="text-sm text-gray-500">加载中...</span>
                ) : !isPushSupported ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    不支持
                  </span>
                ) : isPushSubscribed ? (
                  <button
                    type="button"
                    onClick={unsubscribePush}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    关闭推送
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={subscribePush}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    启用推送
                  </button>
                )}
              </div>
            </div>

            {isPushSupported && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      pushPermission === 'granted'
                        ? 'bg-green-500'
                        : pushPermission === 'denied'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  />
                  <span>
                    通知权限：
                    {pushPermission === 'granted'
                      ? '已授权'
                      : pushPermission === 'denied'
                        ? '已拒绝（请在浏览器设置中允许）'
                        : '未请求'}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                💡 <strong>提示：</strong>
                推送通知使用 Web Push API，即使浏览器标签页在后台或关闭（但浏览器进程运行），也能收到通知。
              </p>
            </div>
          </div>
        </div>
      </div>

      {showAddRuleDialog && (
        <AddFilterRuleDialog
          onClose={() => setShowAddRuleDialog(false)}
          onSuccess={() => {
            setShowAddRuleDialog(false);
            refetchRules();
          }}
        />
      )}
    </div>
  );
}
