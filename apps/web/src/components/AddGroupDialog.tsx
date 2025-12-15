import { useState } from 'react';
import { apiClient, handleResponse } from '../lib/api-client';
import { useQuery } from '@tanstack/react-query';

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
  const [expandedForums, setExpandedForums] = useState<Set<string>>(new Set());
  const [forumTopics, setForumTopics] = useState<Map<string, Topic[]>>(new Map());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 获取所有Telegram群组
  const { data: dialogsData, isLoading: dialogsLoading } = useQuery({
    queryKey: ['telegram-dialogs'],
    queryFn: async () => {
      const res = await apiClient.api.telegram.dialogs.$get();
      return handleResponse<{ data: Dialog[] }>(res);
    },
  });

  const dialogs = dialogsData?.data || [];

  // 点击Forum展开/折叠
  const handleToggleForum = async (forumId: string) => {
    if (expandedForums.has(forumId)) {
      // 折叠
      const newExpanded = new Set(expandedForums);
      newExpanded.delete(forumId);
      setExpandedForums(newExpanded);
    } else {
      // 展开并获取Topics
      if (!forumTopics.has(forumId)) {
        try {
          const res = await apiClient.api.telegram.forums[':channelId'].topics.$get({
            param: { channelId: forumId },
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
                isTopic: false,
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
                title: `${forum.title} - ${topic.title}`,
                type: 'forum' as const,
                topicId: topic.id,
                parentGroupId: forumIdMap.get(forumId), // 如果父Forum也被添加了，设置关联
                isTopic: true,
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

  if (dialogsLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <p className="text-center">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">选择要监控的群组/话题</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
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
                        {dialog.title} ({dialog.type})
                        {isAlreadyAdded && ' - 已添加'}
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
