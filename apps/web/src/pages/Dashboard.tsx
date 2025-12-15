import { useState } from 'react';
import { useGroups } from '../hooks/useGroups';
import { useSummaries } from '../hooks/useSummaries';
import ReactMarkdown from 'react-markdown';

export function Dashboard() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();

  const { data: groupsData, isLoading: isLoadingGroups } = useGroups();
  const { data: summariesData, isLoading: isLoadingSummaries } =
    useSummaries(selectedGroupId);

  const groups = groupsData?.data || [];
  const summaries = summariesData?.data || [];

  return (
    <div>
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">AI 总结列表</h2>
        <p className="mt-1 text-sm text-gray-600">
          查看所有群组的 AI 总结内容
        </p>
      </div>

      {/* 群组筛选 */}
      <div className="mt-6 bg-white shadow sm:rounded-lg p-6">
        <label htmlFor="group-select" className="block text-sm font-medium text-gray-700">
          筛选群组
        </label>
        <select
          id="group-select"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-2 border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white"
          value={selectedGroupId || ''}
          onChange={(e) =>
            setSelectedGroupId(e.target.value ? parseInt(e.target.value) : undefined)
          }
        >
          <option value="">所有群组</option>
          {groups.map((group: any) => (
            <option key={group.id} value={group.id}>
              {group.title} ({group.summaryCount || 0} 个总结)
            </option>
          ))}
        </select>
      </div>

      {/* 总结列表 */}
      <div className="mt-6 space-y-6">
        {isLoadingSummaries ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
            加载中...
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
            暂无总结，请先生成一些总结
          </div>
        ) : (
          summaries.map((summary: any) => (
            <div key={summary.id} className="bg-white shadow sm:rounded-lg overflow-hidden">
              {/* 头部信息 */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {summary.title}
                    </h3>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="mr-4">
                        📁 {summary.group?.title || '未知群组'}
                      </span>
                      <span className="mr-4">
                        📅{' '}
                        {new Date(summary.periodEnd).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>💬 {summary.messageCount} 条消息</span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {summary.aiModel}
                    </span>
                    {summary.tokensUsed && (
                      <span className="text-xs text-gray-500">
                        {summary.tokensUsed} tokens
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Markdown 内容 */}
              <div className="px-6 py-6">
                <div className="prose max-w-none">
                  <ReactMarkdown>{summary.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
