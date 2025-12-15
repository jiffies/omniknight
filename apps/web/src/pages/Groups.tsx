import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddGroupDialog } from '../components/AddGroupDialog';
import { useAccounts } from '../hooks/useAccounts';
import { useGroups } from '../hooks/useGroups';
import { apiClient, handleResponse } from '../lib/api-client';

export function Groups() {
  const navigate = useNavigate();
  const { data: groupsData, isLoading, refetch } = useGroups();
  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts();
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set()); // 展开的 group（用于显示 topics）
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    summaryInterval: 6,
    minMessagesForSummary: 20,
    customPrompt: '',
  });

  const groups = groupsData?.data || [];
  const accounts = accountsData?.data || [];

  // 按账号分组群组（树形结构）
  const groupsByAccount = accounts.map(
    (account: {
      id: number;
      phoneNumber: string;
      username: string | null;
      isConnected: boolean;
      firstName: string | null;
    }) => {
      const accountGroups = groups.filter((g: { accountId: number }) => g.accountId === account.id);

      // 分离父 groups 和 topics
      const parentGroups = accountGroups.filter((g: { isTopic?: boolean }) => !g.isTopic);
      const topics = accountGroups.filter((g: { isTopic?: boolean }) => g.isTopic);

      // 为每个父 group 关联其 topics
      const groupsWithTopics = parentGroups.map((group: any) => ({
        ...group,
        topics: topics.filter((t: { telegramId: string }) => t.telegramId === group.telegramId),
      }));

      // 处理孤立的 topics（没有对应的父 group）
      const orphanTopics = topics.filter(
        (topic: { telegramId: string }) =>
          !parentGroups.some(
            (group: { telegramId: string }) => group.telegramId === topic.telegramId,
          ),
      );

      // 为孤立的 topics 按 telegramId 分组，创建虚拟父节点
      const orphanGroupMap = new Map<string, any[]>();
      orphanTopics.forEach((topic: any) => {
        if (!orphanGroupMap.has(topic.telegramId)) {
          orphanGroupMap.set(topic.telegramId, []);
        }
        orphanGroupMap.get(topic.telegramId)?.push(topic);
      });

      // 创建虚拟父 group 节点
      const virtualParentGroups = Array.from(orphanGroupMap.entries()).map(
        ([telegramId, topicList]) => {
          const firstTopic = topicList[0];
          return {
            id: `virtual-${telegramId}`,
            telegramId,
            title: firstTopic.groupName || '未命名群组',
            groupName: firstTopic.groupName || '未命名群组',
            type: firstTopic.type,
            isActive: topicList.some((t: any) => t.isActive),
            accountId: firstTopic.accountId,
            summaryInterval: firstTopic.summaryInterval,
            minMessagesForSummary: firstTopic.minMessagesForSummary,
            messageCount: 0,
            summaryCount: 0,
            isVirtual: true, // 标记为虚拟节点
            topics: topicList,
            updatedAt: firstTopic.updatedAt,
          };
        },
      );

      // 合并真实的 groups 和虚拟的 parent groups
      const allGroups = [...groupsWithTopics, ...virtualParentGroups];

      return {
        account,
        groups: allGroups.sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
        ),
      };
    },
  );

  // 切换账号展开/收起
  const toggleAccount = (accountId: number) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  // 切换 group 展开/收起（显示 topics）
  const toggleGroup = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // 编辑群组配置
  const handleEditGroup = (group: {
    id: number;
    summaryInterval: number;
    minMessagesForSummary: number;
    customPrompt?: string | null;
  }) => {
    setEditingGroupId(group.id);
    setEditFormData({
      summaryInterval: group.summaryInterval,
      minMessagesForSummary: group.minMessagesForSummary,
      customPrompt: group.customPrompt || '',
    });
  };

  // 保存群组配置
  const handleSaveGroup = async (groupId: number) => {
    try {
      const res = await apiClient.api.groups[':id'].$patch({
        param: { id: groupId.toString() },
        json: editFormData,
      });
      await handleResponse(res);
      setEditingGroupId(null);
      refetch();
      alert('配置已保存');
    } catch (err) {
      alert('保存失败');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingGroupId(null);
  };

  const handleGenerateSummary = async (groupId: number) => {
    setError(null);

    try {
      // 使用群组配置的总结间隔
      const group = groups.find((g) => g.id === groupId);
      const intervalHours = group?.summaryInterval || 1; // 默认 1 小时

      const now = new Date();
      const periodStart = new Date(now.getTime() - intervalHours * 60 * 60 * 1000);

      const res = await apiClient.api.summaries.generate.$post({
        json: {
          groupId,
          periodStart: periodStart.toISOString(),
          periodEnd: now.toISOString(),
        },
      });

      const data = await handleResponse<{ data: { jobId: number } }>(res);

      // 跳转到任务页面
      navigate('/tasks');
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建任务失败';
      setError(message);
      alert(`创建任务失败: ${message}`);
    }
  };

  const handleToggleActive = async (groupId: number, isActive: boolean) => {
    try {
      const res = await apiClient.api.groups[':id'].$patch({
        param: { id: groupId.toString() },
        json: { isActive: !isActive },
      });

      await handleResponse(res);
      refetch();
    } catch (err) {
      alert('更新失败');
    }
  };

  const handleDeleteGroup = async (groupId: number, title: string) => {
    if (!confirm(`确定要删除群组"${title}"吗？这将删除所有相关的总结记录。`)) {
      return;
    }

    try {
      const res = await apiClient.api.groups[':id'].$delete({
        param: { id: groupId.toString() },
      });

      await handleResponse(res);
      alert('删除成功');
      refetch();
    } catch (err) {
      alert('删除失败');
    }
  };

  return (
    <div>
      <div className="px-4 sm:px-0 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">群组管理</h2>
          <p className="mt-1 text-sm text-gray-600">管理监听的 Telegram 群组，配置总结参数</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          添加新群组/话题
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading || isLoadingAccounts ? (
        <div className="mt-6 bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
          加载中...
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6 bg-white shadow sm:rounded-lg p-6">
          <div className="text-center">
            <p className="text-gray-500 mb-4">还没有添加任何群组。请运行初始化脚本添加群组：</p>
            <code className="bg-gray-100 px-3 py-1 rounded text-sm">
              cd apps/backend && pnpm setup
            </code>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {groupsByAccount.map(({ account, groups: accountGroups }) => (
            <div key={account.id} className="bg-white shadow sm:rounded-lg overflow-hidden">
              {/* 账号头部（可点击展开/收起） */}
              <button
                type="button"
                onClick={() => toggleAccount(account.id)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{expandedAccounts.has(account.id) ? '▼' : '▶'}</span>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900">
                      {account.firstName || account.username || account.phoneNumber}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {account.phoneNumber}
                      {account.isConnected && <span className="ml-2 text-green-600">● 在线</span>}
                      {!account.isConnected && <span className="ml-2 text-gray-400">○ 离线</span>}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">{accountGroups.length} 个群组</span>
              </button>

              {/* 展开后显示群组列表 */}
              {expandedAccounts.has(account.id) && (
                <ul className="divide-y divide-gray-200">
                  {accountGroups.map(
                    (group: {
                      id: number;
                      title: string;
                      telegramId: string;
                      type: string;
                      isActive: boolean;
                      isTopic?: boolean;
                      topicId?: number;
                      messageCount?: number;
                      summaryCount?: number;
                      summaryInterval: number;
                      minMessagesForSummary: number;
                      updatedAt?: string;
                      topics?: any[];
                      groupName?: string;
                      topicName?: string;
                      customPrompt?: string | null;
                      isVirtual?: boolean;
                    }) => (
                      <li key={group.id}>
                        {/* 父 Group */}
                        <div className="hover:bg-gray-50 px-6 py-6">
                          <div className="space-y-4">
                            {/* 群组基本信息 */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  {/* 如果有 topics，显示展开/折叠按钮 */}
                                  {group.topics && group.topics.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleGroup(group.id)}
                                      className="mr-2 text-sm text-gray-600"
                                    >
                                      {expandedGroups.has(group.id) ? '▼' : '▶'}
                                    </button>
                                  )}
                                  <h4 className="text-base font-medium text-gray-900">
                                    {group.groupName || group.title}
                                  </h4>
                                  {!group.isActive && (
                                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      已暂停
                                    </span>
                                  )}
                                  {group.topics && group.topics.length > 0 && (
                                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {group.topics.length} 个话题
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center text-sm text-gray-500">
                                  <span className="mr-4">ID: {group.telegramId}</span>
                                  <span className="mr-4">类型: {group.type}</span>
                                  <span className="mr-4">消息: {group.messageCount || 0}</span>
                                  <span>总结: {group.summaryCount || 0}</span>
                                </div>
                              </div>

                              {/* 虚拟节点不显示操作按钮 */}
                              {!group.isVirtual && (
                                <div className="ml-4 flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(group.id, group.isActive)}
                                    className={`px-3 py-1 text-sm rounded ${
                                      group.isActive
                                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                                    }`}
                                  >
                                    {group.isActive ? '暂停' : '启用'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateSummary(group.id)}
                                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                  >
                                    生成总结
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGroup(group.id, group.title)}
                                    className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                                  >
                                    删除
                                  </button>
                                </div>
                              )}
                              {group.isVirtual && (
                                <div className="ml-4 text-xs text-gray-500">
                                  虚拟群组（仅包含话题）
                                </div>
                              )}
                            </div>

                            {/* 群组配置（可编辑）- 虚拟节点不显示 */}
                            {!group.isVirtual && (
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h5 className="text-sm font-medium text-gray-700 mb-3">群组配置</h5>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        总结间隔（小时）
                                      </label>
                                      {editingGroupId === group.id ? (
                                        <input
                                          type="number"
                                          min="1"
                                          max="24"
                                          value={editFormData.summaryInterval}
                                          onChange={(e) =>
                                            setEditFormData({
                                              ...editFormData,
                                              summaryInterval: Number.parseInt(e.target.value),
                                            })
                                          }
                                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                        />
                                      ) : (
                                        <div className="text-sm text-gray-900 py-2">
                                          每 {group.summaryInterval} 小时
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        最少消息数
                                      </label>
                                      {editingGroupId === group.id ? (
                                        <input
                                          type="number"
                                          min="1"
                                          max="1000"
                                          value={editFormData.minMessagesForSummary}
                                          onChange={(e) =>
                                            setEditFormData({
                                              ...editFormData,
                                              minMessagesForSummary: Number.parseInt(
                                                e.target.value,
                                              ),
                                            })
                                          }
                                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                        />
                                      ) : (
                                        <div className="text-sm text-gray-900 py-2">
                                          {group.minMessagesForSummary} 条
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* 自定义提示词 */}
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">
                                      自定义提示词（可选）
                                    </label>
                                    {editingGroupId === group.id ? (
                                      <textarea
                                        value={editFormData.customPrompt}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            customPrompt: e.target.value,
                                          })
                                        }
                                        placeholder="输入自定义提示词，将与系统提示词合并使用..."
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      />
                                    ) : (
                                      <div className="text-sm text-gray-900 py-2 whitespace-pre-wrap">
                                        {group.customPrompt || '未设置'}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 flex justify-end space-x-2">
                                  {editingGroupId === group.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                                      >
                                        取消
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveGroup(group.id)}
                                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                      >
                                        保存
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleEditGroup(group)}
                                      className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-900"
                                    >
                                      编辑
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Topics 列表 */}
                          {expandedGroups.has(group.id) &&
                            group.topics &&
                            group.topics.length > 0 && (
                              <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
                                {group.topics.map(
                                  (topic: {
                                    id: number;
                                    title: string;
                                    topicId?: number;
                                    isActive: boolean;
                                    summaryInterval: number;
                                    minMessagesForSummary: number;
                                    messageCount?: number;
                                    summaryCount?: number;
                                    topicName?: string;
                                    customPrompt?: string | null;
                                  }) => (
                                    <div
                                      key={topic.id}
                                      className="bg-gray-50 rounded p-4 space-y-2"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <h5 className="text-sm font-medium text-gray-900">
                                            ↳ {topic.topicName || topic.title}
                                          </h5>
                                          <div className="mt-1 flex items-center text-xs text-gray-500">
                                            {topic.topicId && (
                                              <span className="mr-4">
                                                Topic ID: {topic.topicId}
                                              </span>
                                            )}
                                            <span className="mr-4">
                                              消息: {topic.messageCount || 0}
                                            </span>
                                            <span>总结: {topic.summaryCount || 0}</span>
                                          </div>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleToggleActive(topic.id, topic.isActive)
                                            }
                                            className={`px-2 py-1 text-xs rounded ${
                                              topic.isActive
                                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                                            }`}
                                          >
                                            {topic.isActive ? '暂停' : '启用'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleGenerateSummary(topic.id)}
                                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                          >
                                            生成总结
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteGroup(
                                                topic.id,
                                                topic.topicName || topic.title,
                                              )
                                            }
                                            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                                          >
                                            删除
                                          </button>
                                        </div>
                                      </div>

                                      {/* Topic 配置（可编辑） */}
                                      <div className="bg-white rounded p-3 border border-gray-200">
                                        <h6 className="text-xs font-medium text-gray-700 mb-2">
                                          话题配置
                                        </h6>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="block text-xs text-gray-600 mb-1">
                                              总结间隔（小时）
                                            </label>
                                            {editingGroupId === topic.id ? (
                                              <input
                                                type="number"
                                                min="1"
                                                max="24"
                                                value={editFormData.summaryInterval}
                                                onChange={(e) =>
                                                  setEditFormData({
                                                    ...editFormData,
                                                    summaryInterval: Number.parseInt(
                                                      e.target.value,
                                                    ),
                                                  })
                                                }
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                              />
                                            ) : (
                                              <div className="text-xs text-gray-900 py-1">
                                                每 {topic.summaryInterval} 小时
                                              </div>
                                            )}
                                          </div>
                                          <div>
                                            <label className="block text-xs text-gray-600 mb-1">
                                              最少消息数
                                            </label>
                                            {editingGroupId === topic.id ? (
                                              <input
                                                type="number"
                                                min="1"
                                                max="1000"
                                                value={editFormData.minMessagesForSummary}
                                                onChange={(e) =>
                                                  setEditFormData({
                                                    ...editFormData,
                                                    minMessagesForSummary: Number.parseInt(
                                                      e.target.value,
                                                    ),
                                                  })
                                                }
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                              />
                                            ) : (
                                              <div className="text-xs text-gray-900 py-1">
                                                {topic.minMessagesForSummary} 条
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Topic 自定义提示词 */}
                                        <div>
                                          <label className="block text-xs text-gray-600 mb-1">
                                            自定义提示词（可选）
                                          </label>
                                          {editingGroupId === topic.id ? (
                                            <textarea
                                              value={editFormData.customPrompt}
                                              onChange={(e) =>
                                                setEditFormData({
                                                  ...editFormData,
                                                  customPrompt: e.target.value,
                                                })
                                              }
                                              placeholder="输入自定义提示词，将与系统提示词合并使用..."
                                              rows={2}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                            />
                                          ) : (
                                            <div className="text-xs text-gray-900 py-1 whitespace-pre-wrap">
                                              {topic.customPrompt || '未设置'}
                                            </div>
                                          )}
                                        </div>

                                        <div className="mt-2 flex justify-end space-x-2">
                                          {editingGroupId === topic.id ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                                              >
                                                取消
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSaveGroup(topic.id)}
                                                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                              >
                                                保存
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleEditGroup(topic)}
                                              className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-900"
                                            >
                                              编辑
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddGroupDialog
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            refetch();
          }}
          existingGroups={groups.map((g: { telegramId: string }) => ({ telegramId: g.telegramId }))}
        />
      )}
    </div>
  );
}
