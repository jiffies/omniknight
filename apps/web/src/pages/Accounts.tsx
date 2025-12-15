import { useState } from 'react';
import { useAccounts, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts';
import { AddAccountDialog } from '../components/AddAccountDialog';

export function Accounts() {
  const { data: accountsData, isLoading } = useAccounts();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const accounts = accountsData?.data || [];

  const handleToggleActive = async (accountId: number, currentIsActive: boolean) => {
    if (confirm(currentIsActive ? '确定要禁用此账号吗？' : '确定要启用此账号吗？')) {
      await updateAccount.mutateAsync({ accountId, isActive: !currentIsActive });
    }
  };

  const handleDeleteAccount = async (accountId: number, phoneNumber: string) => {
    if (confirm(`确定要删除账号 ${phoneNumber} 吗？关联的群组也会被删除！`)) {
      await deleteAccount.mutateAsync(accountId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部：标题 + 添加按钮 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Telegram 账号管理</h2>
          <p className="mt-1 text-sm text-gray-600">管理多个账号，每个账号可以监听不同的群组</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加新账号
        </button>
      </div>

      {/* 账号列表 */}
      {accounts.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无账号</h3>
          <p className="mt-1 text-sm text-gray-500">点击上方按钮添加第一个 Telegram 账号</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {accounts.map((account) => (
              <li key={account.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  {/* 左侧：账号信息 */}
                  <div className="flex items-center flex-1">
                    {/* 头像 */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center text-lg font-semibold">
                      {account.firstName?.[0] || account.phoneNumber[0]}
                    </div>

                    {/* 账号详情 */}
                    <div className="ml-4 flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">
                          {account.firstName || account.phoneNumber}
                          {account.lastName && ` ${account.lastName}`}
                        </h3>

                        {/* 连接状态徽章 */}
                        <span
                          className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                            account.isConnected
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {account.isConnected ? '在线' : '离线'}
                        </span>

                        {/* 激活状态徽章 */}
                        {!account.isActive && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            已禁用
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-gray-500">
                        <span>{account.phoneNumber}</span>
                        {account.username && <span className="ml-2">@{account.username}</span>}
                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        关联群组: {account.groupCount} 个
                        {account.lastConnectedAt && (
                          <span className="ml-4">
                            最后连接: {new Date(account.lastConnectedAt).toLocaleString('zh-CN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧：操作按钮 */}
                  <div className="ml-4 flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleActive(account.id, account.isActive)}
                      className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                        account.isActive
                          ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                          : 'border-green-300 text-green-700 bg-white hover:bg-green-50'
                      }`}
                      disabled={updateAccount.isPending}
                    >
                      {account.isActive ? '禁用' : '启用'}
                    </button>

                    <button
                      onClick={() => handleDeleteAccount(account.id, account.phoneNumber)}
                      className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                      disabled={deleteAccount.isPending}
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

      {/* 添加账号对话框 */}
      {showAddDialog && <AddAccountDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
