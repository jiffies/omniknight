import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Accounts } from './pages/Accounts';
import { Dashboard } from './pages/Dashboard';
import { Groups } from './pages/Groups';
import { Settings } from './pages/Settings';
import { Tasks } from './pages/Tasks';
import { useTasks } from './hooks/useTasks';

const queryClient = new QueryClient();

function AppContent() {
  // 全局监听任务状态变化,在任意页面都能收到通知
  useTasks();

  // 注册 Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[App] Service Worker 注册成功:', registration.scope);
        })
        .catch((error) => {
          console.error('[App] Service Worker 注册失败:', error);
        });
    }
  }, []);

  return (
    <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          {/* 导航栏 */}
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <h1 className="text-xl font-bold text-indigo-600">🤖 Omniknight</h1>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    <NavLink
                      to="/"
                      end
                      className={({ isActive }) =>
                        isActive
                          ? 'border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                      }
                    >
                      总结列表
                    </NavLink>
                    <NavLink
                      to="/groups"
                      className={({ isActive }) =>
                        isActive
                          ? 'border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                      }
                    >
                      群组管理
                    </NavLink>
                    <NavLink
                      to="/accounts"
                      className={({ isActive }) =>
                        isActive
                          ? 'border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                      }
                    >
                      账号管理
                    </NavLink>
                    <NavLink
                      to="/tasks"
                      className={({ isActive }) =>
                        isActive
                          ? 'border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                      }
                    >
                      任务
                    </NavLink>
                    <NavLink
                      to="/settings"
                      className={({ isActive }) =>
                        isActive
                          ? 'border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                      }
                    >
                      设置
                    </NavLink>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* 主内容 */}
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
