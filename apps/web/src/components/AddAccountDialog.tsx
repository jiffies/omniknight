import { useState } from 'react';
import { useSendCode, useVerifyCode, useVerifyPassword } from '../hooks/useAccounts';

interface AddAccountDialogProps {
  onClose: () => void;
}

export function AddAccountDialog({ onClose }: AddAccountDialogProps) {
  const [step, setStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  const sendCode = useSendCode();
  const verifyCode = useVerifyCode();
  const verifyPassword = useVerifyPassword();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber.trim()) {
      setError('请输入手机号');
      return;
    }

    try {
      const result = await sendCode.mutateAsync(phoneNumber);
      setSessionId(result.data.sessionId);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败');
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('请输入验证码');
      return;
    }

    try {
      const result = await verifyCode.mutateAsync({ sessionId, code });

      if (result.data.needPassword) {
        setStep('password');
      } else {
        alert('账号添加成功！');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码错误');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('请输入两步验证密码');
      return;
    }

    try {
      await verifyPassword.mutateAsync({ sessionId, password });
      alert('账号添加成功！');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码错误');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          添加 Telegram 账号 - 步骤 {step === 'phone' ? '1' : step === 'code' ? '2' : '3'}/3
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <div className="mb-4">
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                手机号（带国家码）
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+86 13800138000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={sendCode.isPending}
              />
              <p className="mt-1 text-sm text-gray-500">输入完整的国际格式手机号</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={sendCode.isPending}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                disabled={sendCode.isPending}
              >
                {sendCode.isPending ? '发送中...' : '发送验证码'}
              </button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit}>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">Telegram 已向 {phoneNumber} 发送验证码</p>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                验证码
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={verifyCode.isPending}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={verifyCode.isPending}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                disabled={verifyCode.isPending}
              >
                {verifyCode.isPending ? '验证中...' : '验证'}
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">此账号启用了两步验证，请输入密码</p>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                两步验证密码
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入两步验证密码"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={verifyPassword.isPending}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={verifyPassword.isPending}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                disabled={verifyPassword.isPending}
              >
                {verifyPassword.isPending ? '验证中...' : '完成'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
