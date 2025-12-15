import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../hooks/useGroups';
import { apiClient, handleResponse } from '../lib/api-client';
import { AddGroupDialog } from '../components/AddGroupDialog';

export function Groups() {
  const navigate = useNavigate();
  const { data: groupsData, isLoading, refetch } = useGroups();
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const groups = groupsData?.data || [];

  // 对群组进行排序，将Topic放在对应Forum后面
  const sortedGroups = [...groups].sort((a, b) => {
    // 如果两个都是同一个Forum的（相同telegram_id）
    if (a.telegramId === b.telegramId) {
      // Forum本身排在前面，Topic排在后面
      if (a.isTopic && !b.isTopic) return 1;
      if (!a.isTopic && b.isTopic) return -1;
      return 0;
    }
    // 否则按更新时间排序
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });

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
          <p className="mt-1 text-sm text-gray-600">
            管理监听的 Telegram 群组，配置总结参数
          </p>
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

      {isLoading ? (
        <div className="mt-6 bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
          加载中...
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6 bg-white shadow sm:rounded-lg p-6">
          <div className="text-center">
            <p className="text-gray-500 mb-4">
              还没有添加任何群组。请运行初始化脚本添加群组：
            </p>
            <code className="bg-gray-100 px-3 py-1 rounded text-sm">
              cd apps/backend && pnpm setup
            </code>
          </div>
        </div>
      ) : (
        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {sortedGroups.map((group: { id: number; title: string; telegramId: string; type: string; isActive: boolean; isTopic?: boolean; topicId?: number; messageCount?: number; summaryCount?: number; summaryInterval: number; minMessagesForSummary: number; updatedAt?: string }) => (
              <li key={group.id} className={`py-6 hover:bg-gray-50 ${group.isTopic ? 'pl-16 pr-6' : 'px-6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        {group.isTopic && (
                          <span className="text-gray-400 mr-2">↳</span>
                        )}
                        {group.title}
                      </h3>
                      {!group.isActive && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          已暂停
                        </span>
                      )}
                      {group.isTopic && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Topic
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span className="mr-4">ID: {group.telegramId}</span>
                      {group.isTopic && group.topicId && (
                        <span className="mr-4">Topic ID: {group.topicId}</span>
                      )}
                      <span className="mr-4">类型: {group.type}</span>
                      <span className="mr-4">
                        消息数: {group.messageCount || 0}
                      </span>
                      <span>总结数: {group.summaryCount || 0}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      总结间隔: 每 {group.summaryInterval} 小时 | 最少消息数:{' '}
                      {group.minMessagesForSummary}
                    </div>
                  </div>

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
                </div>
              </li>
            ))}
          </ul>
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
