import type { SummaryJob } from '@omniknight/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../hooks/useGroups';
import { useTasks } from '../hooks/useTasks';
import { apiClient, handleResponse } from '../lib/api-client';

export function Tasks() {
  const navigate = useNavigate();
  const { data: tasksData, isLoading, refetch } = useTasks();
  const { data: groupsData } = useGroups();
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const tasks = tasksData?.data || [];
  const groups = groupsData?.data || [];

  // 分页
  const totalPages = Math.ceil(tasks.length / pageSize);
  const paginatedTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 根据groupId获取群组名称
  const getGroupName = (groupId: number) => {
    const group = groups.find((g: { id: number; title: string }) => g.id === groupId);
    return group?.title || `群组 #${groupId}`;
  };

  // 状态显示
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string; emoji: string }> = {
      pending: {
        text: '等待中',
        className: 'bg-gray-100 text-gray-800',
        emoji: '⏳',
      },
      fetching: {
        text: '拉取中',
        className: 'bg-blue-100 text-blue-800',
        emoji: '📥',
      },
      summarizing: {
        text: 'AI生成中',
        className: 'bg-purple-100 text-purple-800',
        emoji: '🤖',
      },
      completed: {
        text: '已完成',
        className: 'bg-green-100 text-green-800',
        emoji: '✅',
      },
      failed: {
        text: '失败',
        className: 'bg-red-100 text-red-800',
        emoji: '❌',
      },
    };

    const config = statusMap[status] || statusMap.pending;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        <span className="mr-1">{config.emoji}</span>
        {config.text}
      </span>
    );
  };

  // 任务类型显示
  const getTaskType = (task: SummaryJob) => {
    const taskType = (task as SummaryJob & { taskType?: string }).taskType || 'manual';
    const typeConfig = {
      manual: { text: '手动', className: 'bg-indigo-100 text-indigo-800' },
      scheduled: { text: '定时', className: 'bg-green-100 text-green-800' },
    };
    const config = typeConfig[taskType as keyof typeof typeConfig] || typeConfig.manual;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
      >
        {config.text}
      </span>
    );
  };

  // 计算耗时
  const getDuration = (task: SummaryJob) => {
    // 使用 scheduledAt 作为开始时间，completedAt 作为结束时间
    const start = task.scheduledAt ? new Date(task.scheduledAt).getTime() : null;
    if (!start) return '-';

    const end = task.completedAt
      ? new Date(task.completedAt).getTime()
      : task.status === 'completed' || task.status === 'failed'
        ? Date.now()
        : null;

    if (!end) return '-';

    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  // 格式化时间
  const formatTime = (timestamp: Date | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 切换展开/折叠
  const toggleExpand = (taskId: number) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  // 删除任务
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return;
    }

    try {
      const res = await apiClient.api.summaries.jobs[':id'].$delete({
        param: { id: taskId.toString() },
      });
      await handleResponse(res);
      refetch();
      alert('任务已删除');
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div>
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">任务列表</h2>
        <p className="mt-1 text-sm text-gray-600">查看所有摘要生成任务的执行状态和进度</p>
      </div>

      {/* 任务列表 */}
      <div className="mt-6">
        {isLoading ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
            加载中...
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
            暂无任务记录
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px] max-w-[200px]">
                      群组
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14">
                      类型
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      状态
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      进度
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      已拉取
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      创建时间
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      耗时
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTasks.map((task: SummaryJob) => (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
                      <tr
                        key={task.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpand(task.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{task.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 min-w-[150px] max-w-[200px]">
                          <div className="truncate" title={getGroupName(task.groupId)}>
                            {getGroupName(task.groupId)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">{getTaskType(task)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(task.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-12 bg-gray-200 rounded-full h-2 mr-1">
                              <div
                                className={`h-2 rounded-full ${
                                  task.status === 'completed'
                                    ? 'bg-green-500'
                                    : task.status === 'failed'
                                      ? 'bg-red-500'
                                      : 'bg-blue-500'
                                }`}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{task.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {task.fetchedCount}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatTime(task.scheduledAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {getDuration(task)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex gap-2">
                            {task.status === 'completed' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const periodStart = task.periodStart
                                    ? new Date(task.periodStart).getTime()
                                    : '';
                                  const periodEnd = task.periodEnd
                                    ? new Date(task.periodEnd).getTime()
                                    : '';
                                  navigate(
                                    `/?groupId=${task.groupId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
                                  );
                                }}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                查看总结
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 展开的详情行 */}
                      {expandedTaskId === task.id && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    时间信息
                                  </h4>
                                  <dl className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">创建时间:</dt>
                                      <dd className="text-gray-900">
                                        {formatTime(task.scheduledAt)}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">开始时间:</dt>
                                      <dd className="text-gray-900">
                                        {formatTime(task.startedAt)}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">完成时间:</dt>
                                      <dd className="text-gray-900">
                                        {formatTime(task.completedAt)}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">时间周期:</dt>
                                      <dd className="text-gray-900">
                                        {formatTime(task.periodStart)} ~{' '}
                                        {formatTime(task.periodEnd)}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    执行信息
                                  </h4>
                                  <dl className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">已拉取消息:</dt>
                                      <dd className="text-gray-900">{task.fetchedCount} 条</dd>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">进度:</dt>
                                      <dd className="text-gray-900">{task.progress}%</dd>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">重试次数:</dt>
                                      <dd className="text-gray-900">{task.retryCount} 次</dd>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <dt className="text-gray-500">当前消息ID:</dt>
                                      <dd className="text-gray-900">
                                        {task.currentMessageId || '-'}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              </div>

                              {/* 错误信息 */}
                              {task.errorMessage && (
                                <div className="mt-3">
                                  <h4 className="text-sm font-medium text-red-700 mb-2">
                                    错误信息
                                  </h4>
                                  <pre className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 overflow-x-auto">
                                    {task.errorMessage}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      显示第 <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>{' '}
                      到{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * pageSize, tasks.length)}
                      </span>{' '}
                      条， 共 <span className="font-medium">{tasks.length}</span> 条任务
                    </p>
                  </div>
                  <div>
                    <nav
                      className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                      aria-label="Pagination"
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一页
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === page
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
