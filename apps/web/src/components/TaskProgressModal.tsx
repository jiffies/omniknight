import type { SummaryJob } from '@omniknight/shared';

interface TaskProgressModalProps {
  job: SummaryJob;
  onClose: () => void;
}

/**
 * 任务进度弹窗组件
 */
export function TaskProgressModal({ job, onClose }: TaskProgressModalProps) {
  const isInProgress = ['pending', 'fetching', 'summarizing'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  // 计算耗时
  const getDuration = () => {
    if (!job.startedAt) return null;
    const start = new Date(job.startedAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  const duration = getDuration();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* 标题 */}
        <h3 className="text-xl font-semibold mb-4">
          {isCompleted ? '✅ 生成完成' : isFailed ? '❌ 生成失败' : '正在生成摘要...'}
        </h3>

        {/* 进度条 */}
        {isInProgress && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.progress}%</p>
          </div>
        )}

        {/* 状态显示 */}
        <div className="space-y-2 mb-4">
          {job.status === 'pending' && (
            <p className="text-gray-700 dark:text-gray-300">等待开始...</p>
          )}

          {job.status === 'fetching' && (
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                正在拉取消息... ({job.fetchedCount} 条)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                使用激进自适应策略，避免限流
              </p>
            </div>
          )}

          {job.status === 'summarizing' && (
            <p className="text-gray-700 dark:text-gray-300">AI 生成中...</p>
          )}

          {isCompleted && <p className="text-green-600 dark:text-green-400">摘要已生成成功！</p>}

          {isFailed && (
            <div>
              <p className="text-red-600 dark:text-red-400">生成失败</p>
              {job.errorMessage && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  原因: {job.errorMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 耗时 */}
        {duration && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isCompleted ? '总耗时' : '已用时'}: {duration}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {isCompleted && (
            <button
              onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              查看摘要
            </button>
          )}

          {isFailed && (
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              关闭
            </button>
          )}

          {isInProgress && (
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded transition-colors"
            >
              后台运行
            </button>
          )}
        </div>

        {/* 提示 */}
        {isInProgress && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
            可以关闭此窗口，任务会在后台继续执行
          </p>
        )}
      </div>
    </div>
  );
}
