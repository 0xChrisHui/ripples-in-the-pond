'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { fetchMyScoreNFTs, fetchMyScores, saveScore } from '@/src/data/jam-source';
import { getDrafts, removeDraft } from '@/src/lib/draft-store';
import { getCachedNFTs, setCachedNFTs } from '@/src/lib/nft-cache';
import { useScoreNftPolling } from '@/src/hooks/score/useScoreNftPolling';
import {
  recordingsFrom, uploadedRecording, validCachedMaterials,
  type ArchiveRecording,
} from './archive-data';
import type { OwnedScoreNFT } from '@/src/types/jam';
import type { OwnedNFT } from '@/src/types/tracks';

export type { ArchiveRecording } from './archive-data';
export type ArchivePhase = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';
export type ArchiveSlice<T> = {
  items: T[];
  phase: ArchivePhase;
  error: string | null;
  resolved: boolean;
  cached?: boolean;
};
type Params = {
  authenticated: boolean;
  userId: string | null | undefined;
  getAccessToken: () => Promise<string | null>;
};
function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const emptyScores: ArchiveSlice<OwnedScoreNFT> = {
  items: [], phase: 'idle', error: null, resolved: false,
};
const emptyMaterials: ArchiveSlice<OwnedNFT> = {
  items: [], phase: 'idle', error: null, resolved: false,
};

/** `/me` 三个真实数据源的独立加载、缓存刷新与局部故障编排。 */
export function useMeArchive({ authenticated, userId, getAccessToken }: Params) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [scores, setScores] = useState(emptyScores);
  const [recordings, setRecordings] = useState<ArchiveSlice<ArchiveRecording>>(() => ({
    items: recordingsFrom([], getDrafts()), phase: 'idle', error: null, resolved: false,
  }));
  const [materials, setMaterials] = useState(emptyMaterials);
  const tokenRef = useRef(getAccessToken), generationRef = useRef(0);
  const activeOwnerRef = useRef<string | null>(null);
  useEffect(() => { tokenRef.current = getAccessToken; });
  const isCurrent = useCallback((generation: number, owner: string | null) => (
    generation === generationRef.current && owner === activeOwnerRef.current
  ), []);

  const loadScores = useCallback(async (token: string, generation: number, owner: string) => {
    if (!isCurrent(generation, owner)) return;
    setScores((current) => ({ ...current, phase: current.items.length ? 'refreshing' : 'loading', error: null }));
    try {
      const items = await fetchMyScoreNFTs(token);
      if (isCurrent(generation, owner)) {
        setScores({ items, phase: 'ready', error: null, resolved: true });
      }
    } catch (error) {
      if (isCurrent(generation, owner)) {
        setScores((current) => ({ ...current, phase: 'error', error: message(error, '唱片档案读取失败') }));
      }
    }
  }, [isCurrent]);

  const loadRecordings = useCallback(async (token: string, generation: number, owner: string) => {
    if (!isCurrent(generation, owner)) return;
    setRecordings((current) => ({ ...current, phase: current.items.length ? 'refreshing' : 'loading', error: null }));
    try {
      let server = await fetchMyScores(token);
      if (!isCurrent(generation, owner)) return;
      let refreshError: string | null = null;
      const uploaded: ArchiveRecording[] = [];
      const failedUploads = new Set<string>();
      for (const draft of getDrafts()) {
        if (!isCurrent(generation, owner)) return;
        try {
          const result = await saveScore(token, draft);
          if (!isCurrent(generation, owner)) return;
          uploaded.push(uploadedRecording(draft, result));
          removeDraft(draft.trackId);
        } catch (error) {
          if (!isCurrent(generation, owner)) return;
          console.error('录音上传失败，仍保留在本机:', error);
          failedUploads.add(draft.trackId);
        }
      }
      if (uploaded.length > 0) {
        if (!isCurrent(generation, owner)) return;
        try {
          server = await fetchMyScores(token);
          if (!isCurrent(generation, owner)) return;
        } catch (error) {
          if (!isCurrent(generation, owner)) return;
          refreshError = message(error, '已保存录音，但刷新暂时失败');
        }
      }
      if (isCurrent(generation, owner)) {
        setRecordings({
          items: recordingsFrom(server, getDrafts(), failedUploads, uploaded),
          phase: refreshError ? 'error' : 'ready',
          error: refreshError,
          resolved: true,
        });
      }
    } catch (error) {
      if (isCurrent(generation, owner)) {
        setRecordings((current) => ({
          ...current, phase: 'error',
          error: message(error, '录音档案读取失败'),
        }));
      }
    }
  }, [isCurrent]);

  const loadMaterials = useCallback(async (token: string, generation: number, ownerId: string) => {
    if (!isCurrent(generation, ownerId)) return;
    const cached = validCachedMaterials(getCachedNFTs(ownerId));
    setMaterials({
      items: cached, phase: cached.length ? 'refreshing' : 'loading',
      error: null, resolved: false, cached: cached.length > 0,
    });
    try {
      const items = await fetchMyNFTs(token);
      if (!isCurrent(generation, ownerId)) return;
      try { setCachedNFTs(ownerId, items); } catch (error) {
        console.warn('素材档案缓存写入失败:', error);
      }
      if (!isCurrent(generation, ownerId)) return;
      setMaterials({ items, phase: 'ready', error: null, resolved: true, cached: false });
    } catch (error) {
      if (isCurrent(generation, ownerId)) {
        setMaterials((current) => ({
          ...current, phase: 'error', error: message(error, '素材档案读取失败'),
        }));
      }
    }
  }, [isCurrent]);

  const retry = useCallback(async (section: 'scores' | 'recordings' | 'materials') => {
    const generation = generationRef.current;
    const owner = userId ?? null;
    if (!owner || !isCurrent(generation, owner)) return;
    const token = await tokenRef.current();
    if (!isCurrent(generation, owner)) return;
    if (!token) {
      const error = '登录凭证暂不可用，请重新登录';
      if (section === 'scores') setScores((current) => ({ ...current, phase: 'error', error }));
      if (section === 'recordings') setRecordings((current) => ({ ...current, phase: 'error', error }));
      if (section === 'materials') setMaterials((current) => ({ ...current, phase: 'error', error }));
      return;
    }
    if (section === 'scores') await loadScores(token, generation, owner);
    if (section === 'recordings') await loadRecordings(token, generation, owner);
    if (section === 'materials') await loadMaterials(token, generation, owner);
  }, [isCurrent, loadMaterials, loadRecordings, loadScores, userId]);

  useEffect(() => {
    const owner = authenticated && userId ? userId : null;
    const generation = ++generationRef.current;
    activeOwnerRef.current = owner;
    queueMicrotask(async () => {
      if (!isCurrent(generation, owner)) return;
      if (!owner) {
        setOwnerId(null);
        setScores(emptyScores);
        setRecordings({ items: recordingsFrom([], getDrafts()), phase: 'idle', error: null, resolved: false });
        setMaterials(emptyMaterials);
        return;
      }
      setOwnerId(owner);
      setScores(emptyScores);
      setRecordings({ items: recordingsFrom([], getDrafts()), phase: 'idle', error: null, resolved: false });
      setMaterials(emptyMaterials);
      const token = await tokenRef.current();
      if (!isCurrent(generation, owner)) return;
      if (!token) {
        const error = '登录凭证暂不可用，请重新登录';
        setScores({ ...emptyScores, phase: 'error', error });
        setRecordings((current) => ({ ...current, phase: 'error', error }));
        setMaterials({ ...emptyMaterials, phase: 'error', error });
        return;
      }
      await Promise.all([
        loadScores(token, generation, owner),
        loadRecordings(token, generation, owner),
        loadMaterials(token, generation, owner),
      ]);
    });
    return () => {
      generationRef.current = generation + 1;
      activeOwnerRef.current = null;
    };
  }, [authenticated, isCurrent, loadMaterials, loadRecordings, loadScores, userId]);

  useScoreNftPolling({
    scoreNfts: scores.items, authenticated, userId, getAccessToken,
    onRefresh: (items) => {
      if (userId && activeOwnerRef.current === userId) {
        setScores({ items, phase: 'ready', error: null, resolved: true });
      }
    },
    onError: (error) => {
      if (userId && activeOwnerRef.current === userId) {
        setScores((current) => ({ ...current, phase: 'error', error }));
      }
    },
    onPollingChange: (polling) => {
      if (userId && activeOwnerRef.current === userId) setScores((current) => (
        polling && current.phase === 'ready' ? { ...current, phase: 'refreshing' } : current
      ));
    },
  });
  return { ownerId, scores, recordings, materials, retry };
}
