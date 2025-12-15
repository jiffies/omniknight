import { useState } from 'react';
import { apiClient } from '../lib/api-client';

interface AddFilterRuleDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

type RuleType = 'length' | 'keyword' | 'emoji' | 'media';

export function AddFilterRuleDialog({ onClose, onSuccess }: AddFilterRuleDialogProps) {
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<RuleType>('length');
  const [priority, setPriority] = useState(100);

  // Length配置
  const [minLength, setMinLength] = useState(5);
  const [maxLength, setMaxLength] = useState(5000);

  // Keyword配置
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordMode, setKeywordMode] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Emoji配置
  const [emojiOnly, setEmojiOnly] = useState(true);

  const [loading, setLoading] = useState(false);

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('请输入规则名称');
      return;
    }

    setLoading(true);
    try {
      let config: Record<string, unknown> = {};

      switch (ruleType) {
        case 'length':
          config = { minLength, maxLength };
          break;
        case 'keyword':
          if (keywords.length === 0) {
            alert('请至少添加一个关键词');
            return;
          }
          config = { keywords, mode: keywordMode, caseSensitive };
          break;
        case 'emoji':
          config = { emojiOnly };
          break;
        case 'media':
          config = {};
          break;
      }

      await apiClient.api['filter-rules'].$post({
        json: {
          name: name.trim(),
          type: ruleType,
          config,
          priority,
        },
      });

      alert('规则创建成功');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('创建规则失败:', error);
      alert('创建规则失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">添加过滤规则</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* 规则名称 */}
          <div>
            <label htmlFor="rule-name" className="block text-sm font-medium text-gray-700 mb-1">
              规则名称
            </label>
            <input
              id="rule-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="例如：长度过滤"
            />
          </div>

          {/* 规则类型 */}
          <div>
            <label htmlFor="rule-type" className="block text-sm font-medium text-gray-700 mb-1">
              规则类型
            </label>
            <select
              id="rule-type"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="length">长度过滤</option>
              <option value="keyword">关键词过滤</option>
              <option value="emoji">表情过滤</option>
              <option value="media">媒体过滤</option>
            </select>
          </div>

          {/* 优先级 */}
          <div>
            <label htmlFor="rule-priority" className="block text-sm font-medium text-gray-700 mb-1">
              优先级（数字越小越优先）
            </label>
            <input
              id="rule-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number.parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 根据类型显示不同配置 */}
          {ruleType === 'length' && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">长度配置</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="min-length" className="block text-xs text-gray-700 mb-1">最小长度</label>
                  <input
                    id="min-length"
                    type="number"
                    value={minLength}
                    onChange={(e) => setMinLength(Number.parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="max-length" className="block text-xs text-gray-700 mb-1">最大长度</label>
                  <input
                    id="max-length"
                    type="number"
                    value={maxLength}
                    onChange={(e) => setMaxLength(Number.parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {ruleType === 'keyword' && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">关键词配置</h4>

              <div className="mb-3">
                <label htmlFor="keyword-mode" className="block text-xs text-gray-700 mb-1">模式</label>
                <select
                  id="keyword-mode"
                  value={keywordMode}
                  onChange={(e) => setKeywordMode(e.target.value as 'blacklist' | 'whitelist')}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="blacklist">黑名单（包含关键词则过滤）</option>
                  <option value="whitelist">白名单（不包含关键词则过滤）</option>
                </select>
              </div>

              <div className="mb-3">
                <label htmlFor="keyword-input" className="block text-xs text-gray-700 mb-1">关键词列表</label>
                <div className="flex gap-2">
                  <input
                    id="keyword-input"
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    placeholder="输入关键词后按回车"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    添加
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="bg-gray-100 px-2 py-1 rounded flex items-center gap-1"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(keywords.indexOf(kw))}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm">区分大小写</span>
                </label>
              </div>
            </div>
          )}

          {ruleType === 'emoji' && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">表情配置</h4>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={emojiOnly}
                  onChange={(e) => setEmojiOnly(e.target.checked)}
                  className="rounded"
                />
                <span className="ml-2 text-sm">过滤纯表情消息</span>
              </label>
            </div>
          )}

          {ruleType === 'media' && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600">
                过滤仅包含媒体文件（图片、视频等）而无文本的消息
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
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
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300"
          >
            {loading ? '创建中...' : '创建规则'}
          </button>
        </div>
      </div>
    </div>
  );
}
