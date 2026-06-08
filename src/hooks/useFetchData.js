import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';

export function useFetchData(url, { params = {}, mapFn = (d) => d, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(url, { params });
      setData(mapFn(res.data?.data));
    } catch (err) {
      setError(err);
      console.error(`[useFetchData] ${url}`, err);
    } finally {
      setLoading(false);
    }
  }, [url, JSON.stringify(params), ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
