import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSearchParams } from 'react-router-dom';
import { useGroups } from '../hooks/useGroups';
import { useSummaries } from '../hooks/useSummaries';

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupIdParam = searchParams.get('groupId');
  const periodStartParam = searchParams.get('periodStart');
  const periodEndParam = searchParams.get('periodEnd');

  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    groupIdParam ? Number.parseInt(groupIdParam) : undefined,
  );
  const [highlightedSummaryId, setHighlightedSummaryId] = useState<number | null>(null);
  const summaryRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // 当URL参数变化时更新选中的群组
  useEffect(() => {
    if (groupIdParam) {
      setSelectedGroupId(Number.parseInt(groupIdParam));
    }
  }, [groupIdParam]);

  const { data: groupsData, isLoading: isLoadingGroups } = useGroups();
  const { data: summariesData, isLoading: isLoadingSummaries } = useSummaries(selectedGroupId);

  const groups = groupsData?.data || [];
  const summaries = summariesData?.data || [];

  // 当总结加载完成后，滚动到匹配的总结
  useEffect(() => {
    if (!isLoadingSummaries && summaries.length > 0 && periodStartParam && periodEndParam) {
      const targetPeriodStart = Number.parseInt(periodStartParam);
      const targetPeriodEnd = Number.parseInt(periodEndParam);

      // 查找匹配的总结
      const matchingSummary = summaries.find((summary) => {
        const summaryStart = new Date(summary.periodStart).getTime();
        const summaryEnd = new Date(summary.periodEnd).getTime();
        return summaryStart === targetPeriodStart && summaryEnd === targetPeriodEnd;
      });

      if (matchingSummary) {
        // 滚动到该总结
        const element = summaryRefs.current.get(matchingSummary.id);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedSummaryId(matchingSummary.id);
            // 3秒后取消高亮
            setTimeout(() => setHighlightedSummaryId(null), 3000);
          }, 100);
        }
      }
    }
  }, [isLoadingSummaries, summaries, periodStartParam, periodEndParam]);

  return (
    <div>
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">AI 总结列表</h2>
        <p className="mt-1 text-sm text-gray-600">查看所有群组的 AI 总结内容</p>
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
          onChange={(e) => {
            const newGroupId = e.target.value ? Number.parseInt(e.target.value) : undefined;
            setSelectedGroupId(newGroupId);
            // 更新URL参数
            if (newGroupId) {
              setSearchParams({ groupId: newGroupId.toString() });
            } else {
              setSearchParams({});
            }
          }}
        >
          <option value="">所有群组</option>
          {groups.map((group) => (
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
          summaries.map((summary) => (
            <div
              key={summary.id}
              ref={(el) => {
                if (el) {
                  summaryRefs.current.set(summary.id, el);
                }
              }}
              className={`bg-white shadow sm:rounded-lg overflow-hidden transition-all duration-300 ${
                highlightedSummaryId === summary.id
                  ? 'ring-4 ring-indigo-500 ring-opacity-50'
                  : ''
              }`}
            >
              {/* 头部信息 */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{summary.title}</h3>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="mr-4">📁 {summary.group?.title || '未知群组'}</span>
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
                      <span className="text-xs text-gray-500">{summary.tokensUsed} tokens</span>
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
