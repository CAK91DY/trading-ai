import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../services/api'
import type { Watchlist, MarketPage, Asset, History, Run } from '../types'
export const useMarkets = (query = '') =>
  useQuery({
    queryKey: ['markets', query],
    queryFn: () => api<MarketPage>('/markets' + query),
    staleTime: 600000,
  })
export const useAsset = (symbol: string) =>
  useQuery({
    queryKey: ['asset', symbol],
    queryFn: () => api<Asset>('/assets/' + encodeURIComponent(symbol)),
    staleTime: 600000,
  })
export const useHistory = (symbol: string, period: string) =>
  useQuery({
    queryKey: ['history', symbol, period],
    queryFn: () => api<History>(`/assets/${encodeURIComponent(symbol)}/history?period=${period}`),
    staleTime: period === '1D' ? 60000 : 600000,
  })
export const useWatchlists = () =>
  useQuery({ queryKey: ['watchlists'], queryFn: () => api<Watchlist[]>('/watchlists') })
export const useRuns = () =>
  useQuery({ queryKey: ['backtests'], queryFn: () => api<Run[]>('/backtests') })
export function useAddAsset() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, symbol }: { id: string; symbol: string }) =>
      post<Watchlist>(`/watchlists/${id}/assets`, { symbol }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['watchlists'] })
      void client.invalidateQueries({ queryKey: ['watchlist-quotes'] })
    },
  })
}
