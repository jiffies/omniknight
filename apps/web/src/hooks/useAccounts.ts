import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, handleResponse } from '../lib/api-client';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await apiClient.api.accounts.$get();
      return handleResponse(res);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: number) => {
      const res = await apiClient.api.accounts[':id'].$delete({
        param: { id: accountId.toString() },
      });
      return handleResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, isActive }: { accountId: number; isActive: boolean }) => {
      const res = await apiClient.api.accounts[':id'].$patch({
        param: { id: accountId.toString() },
        json: { isActive },
      });
      return handleResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useSendCode() {
  return useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await apiClient.api.accounts.auth['send-code'].$post({
        json: { phoneNumber },
      });
      return handleResponse(res);
    },
  });
}

export function useVerifyCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, code }: { sessionId: string; code: string }) => {
      const res = await apiClient.api.accounts.auth['verify-code'].$post({
        json: { sessionId, code },
      });
      return handleResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useVerifyPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, password }: { sessionId: string; password: string }) => {
      const res = await apiClient.api.accounts.auth['verify-password'].$post({
        json: { sessionId, password },
      });
      return handleResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useAccountDialogs(accountId: number | null) {
  return useQuery({
    queryKey: ['account-dialogs', accountId],
    queryFn: async () => {
      if (!accountId) return { data: [] };
      const res = await apiClient.api.accounts[':id'].dialogs.$get({
        param: { id: accountId.toString() },
      });
      return handleResponse(res);
    },
    enabled: !!accountId,
  });
}
