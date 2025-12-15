import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAccountDialogs, useAccounts } from '../hooks/useAccounts';
import { apiClient, handleResponse } from '../lib/api-client';

interface AddGroupDialogProps {
  onClose: () => void;
  onSuccess: () => void;
  existingGroups: Array<{ telegramId: string }>;
}

interface Dialog {
  id: string;
  title: string;
  username?: string;
  type: 'group' | 'channel' | 'supergroup' | 'forum';
  isForum: boolean;
}

interface Topic {
  id: number;
  title: string;
  iconColor?: number;
  iconEmojiId?: string;
}

export function AddGroupDialog({ onClose, onSuccess, existingGroups }: AddGroupDialogProps) {
  const [step, setStep] = useState<'account' | 'group'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [expandedForums, setExpandedForums] = useState<Set<string>>(new Set());
  const [forumTopics, setForumTopics] = useState<Map<string, Topic[]>>(new Map());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 获取所有账号
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const accounts = accountsData?.data || [];

  // 获取选中账号的群组列表
  const { data: dialogsData, isLoading: dialogsLoading } = useAccountDialogs(selectedAccountId);
  const dialogs = dialogsData?.data || [];

  // 选择账号
  const handleSelectAccount = (accountId: number) => {
    setSelectedAccountId(accountId);
    setStep('group');
  };

  // 返回账号选择
  const handleBackToAccount = () => {
    setStep('account');
    setSelectedAccountId(null);
    setSelectedItems(new Set());
    setExpandedForums(new Set());
  };

  // 点击Forum展开/折叠
  const handleToggleForum = async (forumId: string) => {
    if (!selectedAccountId) return;

    if (expandedForums.has(forumId)) {
      // 折叠
      const newExpanded = new Set(expandedForums);
      newExpanded.delete(forumId);
      setExpandedForums(newExpanded);
    } else {
      // 展开并获取Topics
      if (!forumTopics.has(forumId)) {
        try {
          const res = await apiClient.api.accounts[':accountId'].dialogs[':channelId'].topics.$get({
            param: { accountId: selectedAccountId.toString(), channelId: forumId },
          });
          const data = await handleResponse<{ data: Topic[] }>(res);
          const newTopics = new Map(forumTopics);
          newTopics.set(forumId, data.data);
          setForumTopics(newTopics);
        } catch (error) {
          console.error('获取Forum Topics失败:', error);
          alert('获取Forum话题失败');
          return;
        }
      }

      const newExpanded = new Set(expandedForums);
      newExpanded.add(forumId);
      setExpandedForums(newExpanded);
    }
  };

  // 切换选中状态
  const handleToggleItem = (key: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  // 提交添加
  const handleSubmit = async () => {
    if (!selectedAccountId) return;

    setLoading(true);
    try {
      // 先处理普通群组，获取可能的父Forum ID
      const forumIdMap = new Map<string, number>(); // telegram_id -> db_id

      for (const key of Array.from(selectedItems)) {
        if (!key.startsWith('topic-')) {
          // 普通群组
          const dialog = dialogs.find((d) => d.id === key);

          if (dialog) {
            const res = await apiClient.api.groups.$post({
              json: {
                telegramId: dialog.id,
                title: dialog.title,
                username: dialog.username,
                type: dialog.type,
                accountId: selectedAccountId, // 添加账号ID
                isTopic: false,
                groupName: dialog.title, // 普通群组，groupName 就是 title
              },
            });
            const result = await handleResponse<{ data: { id: number } }>(res);

            // 如果是Forum类型，记录其数据库ID
            if (dialog.type === 'forum') {
              forumIdMap.set(dialog.id, result.data.id);
            }
          }
        }
      }

      // 再处理Topics
      for (const key of Array.from(selectedItems)) {
        if (key.startsWith('topic-')) {
          // Topic格式: topic-{forumId}-{topicId}
          // 注意：forumId可能是负数，如 -1002353072525，所以key是 "topic--1002353072525-10"
          const parts = key.substring(6); // 移除 "topic-" 前缀
          const lastDashIndex = parts.lastIndexOf('-'); // 找到最后一个 '-'
          const forumId = parts.substring(0, lastDashIndex); // forum ID（可能是负数）
          const topicIdStr = parts.substring(lastDashIndex + 1); // topic ID
          const topicId = Number.parseInt(topicIdStr);
          const forum = dialogs.find((d) => d.id === forumId);
          const topics = forumTopics.get(forumId) || [];
          const topic = topics.find((t) => t.id === topicId);

          if (forum && topic) {
            const res = await apiClient.api.groups.$post({
              json: {
                telegramId: forumId,
                title: `${forum.title} - ${topic.title}`, // 保持兼容性
                type: 'forum' as const,
                accountId: selectedAccountId, // 添加账号ID
                topicId: topic.id,
                parentGroupId: forumIdMap.get(forumId), // 如果父Forum也被添加了，设置关联
                isTopic: true,
                groupName: forum.title, // 父 forum 的名称
                topicName: topic.title, // topic 的名称
              },
            });
            await handleResponse(res);
          }
        }
      }

      alert('添加成功');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('添加失败:', error);
      alert(`添加失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  if (accountsLoading || (step === 'group' && dialogsLoading)) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <p className="text-center">加载中...</p>
        </div>
      </div>
    );
  }

  // 步骤1：选择账号
  if (step === 'account') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">选择账号</h3>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">还没有添加任何账号</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                去添加账号
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <button
                  type="button"
                  key={account.id}
                  onClick={() => handleSelectAccount(account.id)}
                  className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!account.isActive}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {account.firstName || account.phoneNumber}
                        {account.lastName && ` ${account.lastName}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {account.phoneNumber}
                        {account.username && ` • @${account.username}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isConnected ? (
                        <span className="text-xs text-green-600">● 在线</span>
                      ) : (
                        <span className="text-xs text-gray-400">● 离线（将自动连接）</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 步骤2：选择群组
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToAccount}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 返回
            </button>
            <h3 className="text-xl font-bold">选择要监控的群组/话题</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded p-4 mb-4">
          {dialogs.length === 0 ? (
            <p className="text-gray-500 text-center">没有找到群组</p>
          ) : (
            <div className="space-y-2">
              {dialogs.map((dialog) => {
                const isAlreadyAdded = existingGroups.some((g) => g.telegramId === dialog.id);
                const isExpanded = expandedForums.has(dialog.id);
                const topics = forumTopics.get(dialog.id) || [];

                return (
                  <div key={dialog.id}>
                    <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      {dialog.isForum ? (
                        <button
                          type="button"
                          onClick={() => handleToggleForum(dialog.id)}
                          className="text-sm"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      ) : (
                        <input
                          type="checkbox"
                          disabled={isAlreadyAdded}
                          checked={selectedItems.has(dialog.id)}
                          onChange={() => handleToggleItem(dialog.id)}
                          className="rounded"
                        />
                      )}

                      <span className={isAlreadyAdded ? 'text-gray-400' : ''}>
                        {dialog.title} ({dialog.type}){isAlreadyAdded && ' - 已添加'}
                      </span>
                    </div>

                    {/* Forum Topics */}
                    {dialog.isForum && isExpanded && (
                      <div className="ml-8 space-y-1 mt-1">
                        {topics.map((topic) => {
                          const topicKey = `topic-${dialog.id}-${topic.id}`;
                          return (
                            <div key={topic.id} className="flex items-center gap-2 p-1">
                              <input
                                type="checkbox"
                                checked={selectedItems.has(topicKey)}
                                onChange={() => handleToggleItem(topicKey)}
                                className="rounded"
                              />
                              <span className="text-sm">↳ {topic.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedItems.size === 0 || loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300"
          >
            {loading ? '添加中...' : `确认添加 (${selectedItems.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
