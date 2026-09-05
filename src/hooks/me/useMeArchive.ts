'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyNFTs } from '@/src/data/nfts-source';
import { fetchMyScoreNFTs, fetchMyScores } from '@/src/data/jam-source';
import { getDrafts } from '@/src/lib/draft-store';
import { setCachedNFTs } from '@/src/lib/nft-cache';
import { useScoreNftPolling } from '@/src/hooks/score/useScoreNftPolling';
import { recordingsFrom, type ArchiveRecording } from './archive-data';
import {
  readArchiveCache, validCachedMaterial, validCachedRecording, validCachedScore,
  writeArchiveCache, type ArchiveAuthSource,
} from './archive-cache';
import {
  emptyMaterials, emptyRecordings, emptyScores, loadingPhase, type ArchiveSlice,
} from './archive-state';
import { syncLocalDrafts } from './draft-sync';

export type { ArchiveRecording } from './archive-data';
export type { ArchivePhase, ArchiveSlice } from './archive-state';

type Params = {
  authenticated: boolean;
  authSource: ArchiveAuthSource | null;
  userId: string | null | undefined;
  getAccessToken: () => Promise<string | null>;
};
type Section = 'scores' | 'recordings' | 'materials';

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** `/me` 按 owner generation 恢复三段真实缓存，再各自后台刷新。 */
export function useMeArchive({ authenticated, authSource, userId, getAccessToken }: Params) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [scores, setScores] = useState(emptyScores);
  const [recordings, setRecordings] = useState<ArchiveSlice<ArchiveRecording>>(emptyRecordings);
  const [materials, setMaterials] = useState(emptyMaterials);
  const tokenRef = useRef(getAccessToken);
  const generationRef = useRef(0);
  const activeOwnerRef = useRef<string | null>(null);
  const syncingRef = useRef(new Set<string>());
  useEffect(() => { tokenRef.current = getAccessToken; });
  const isCurrent = useCallback((generation: number, owner: string | null) => (
    generation === generationRef.current && owner === activeOwnerRef.current
  ), []);

  const loadScores = useCallback(async (
    token: string, generation: number, owner: string, source: ArchiveAuthSource,
  ) => {
    if (!isCurrent(generation, owner)) return;
    setScores((current) => ({ ...current, phase: loadingPhase(current), error: null }));
    try {
      const items = await fetchMyScoreNFTs(token);
      if (!isCurrent(generation, owner)) return;
      writeArchiveCache({ authSource: source, userId: owner }, 'scores', '/api/me/score-nfts', items);
      setScores({ items, phase: 'ready', error: null, resolved: true });
    } catch (error) {
      if (isCurrent(generation, owner)) setScores((current) => ({
        ...current, phase: 'error', error: message(error, '唱片档案读取失败'),
      }));
    }
  }, [isCurrent]);

  const syncDrafts = useCallback(async (
    token: string, generation: number, owner: string, source: ArchiveAuthSource,
  ) => {
    const drafts = getDrafts().filter((draft) => !syncingRef.current.has(draft.clientDraftId));
    if (!drafts.length) return;
    drafts.forEach((draft) => syncingRef.current.add(draft.clientDraftId));
    const active = () => isCurrent(generation, owner);
    const result = await syncLocalDrafts(token, drafts, active);
    drafts.forEach((draft) => syncingRef.current.delete(draft.clientDraftId));
    if (!active()) return;
    try {
      const server = await fetchMyScores(token);
      if (!active()) return;
      const remote = recordingsFrom(server, []);
      writeArchiveCache({ authSource: source, userId: owner }, 'recordings', '/api/me/scores?light=1', remote);
      setRecordings({
        items: recordingsFrom(server, getDrafts(), result.failedIds, result.uploaded),
        phase: 'ready', error: null, resolved: true,
      });
    } catch (error) {
      if (active()) setRecordings((current) => ({
        ...current, phase: 'error', error: message(error, '草稿已同步，但录音刷新失败'),
      }));
    }
  }, [isCurrent]);

  const loadRecordings = useCallback(async (
    token: string, generation: number, owner: string, source: ArchiveAuthSource,
  ) => {
    if (!isCurrent(generation, owner)) return;
    setRecordings((current) => ({ ...current, phase: loadingPhase(current), error: null }));
    try {
      const server = await fetchMyScores(token);
      if (!isCurrent(generation, owner)) return;
      const remote = recordingsFrom(server, []);
      writeArchiveCache({ authSource: source, userId: owner }, 'recordings', '/api/me/scores?light=1', remote);
      setRecordings({ items: recordingsFrom(server, getDrafts()), phase: 'ready', error: null, resolved: true });
      void syncDrafts(token, generation, owner, source);
    } catch (error) {
      if (isCurrent(generation, owner)) setRecordings((current) => ({
        ...current, phase: 'error', error: message(error, '录音档案读取失败'),
      }));
    }
  }, [isCurrent, syncDrafts]);

  const loadMaterials = useCallback(async (
    token: string, generation: number, owner: string, source: ArchiveAuthSource,
  ) => {
    if (!isCurrent(generation, owner)) return;
    setMaterials((current) => ({ ...current, phase: loadingPhase(current), error: null }));
    try {
      const items = await fetchMyNFTs(token);
      if (!isCurrent(generation, owner)) return;
      setCachedNFTs(owner, items);
      writeArchiveCache({ authSource: source, userId: owner }, 'materials', '/api/me/nfts', items);
      setMaterials({ items, phase: 'ready', error: null, resolved: true });
    } catch (error) {
      if (isCurrent(generation, owner)) setMaterials((current) => ({
        ...current, phase: 'error', error: message(error, '素材档案读取失败'),
      }));
    }
  }, [isCurrent]);

  const retry = useCallback(async (section: Section) => {
    const generation = generationRef.current;
    const owner = userId ?? null;
    if (!owner || !authSource || !isCurrent(generation, owner)) return;
    const token = await tokenRef.current();
    if (!isCurrent(generation, owner)) return;
    if (!token) {
      const error = '登录凭证暂不可用，请重新登录';
      if (section === 'scores') setScores((current) => ({ ...current, phase: 'error', error }));
      if (section === 'recordings') setRecordings((current) => ({ ...current, phase: 'error', error }));
      if (section === 'materials') setMaterials((current) => ({ ...current, phase: 'error', error }));
      return;
    }
    if (section === 'scores') await loadScores(token, generation, owner, authSource);
    if (section === 'recordings') await loadRecordings(token, generation, owner, authSource);
    if (section === 'materials') await loadMaterials(token, generation, owner, authSource);
  }, [authSource, isCurrent, loadMaterials, loadRecordings, loadScores, userId]);

  useEffect(() => {
    const owner = authenticated && userId && authSource ? userId : null;
    const source = owner ? authSource : null;
    const generation = ++generationRef.current;
    activeOwnerRef.current = owner;
    queueMicrotask(async () => {
      if (!isCurrent(generation, owner)) return;
      if (!owner || !source) {
        setOwnerId(null); setScores(emptyScores); setRecordings(emptyRecordings); setMaterials(emptyMaterials);
        return;
      }
      setOwnerId(owner);
      const identity = { authSource: source, userId: owner };
      const scoreCache = readArchiveCache(identity, 'scores', validCachedScore);
      const recordingCache = readArchiveCache(identity, 'recordings', validCachedRecording);
      const materialCache = readArchiveCache(identity, 'materials', validCachedMaterial);
      setScores(scoreCache
        ? { items: scoreCache.items, phase: 'refreshing', error: null, resolved: true, cached: true }
        : emptyScores);
      setRecordings(recordingCache
        ? { items: [...recordingCache.items, ...recordingsFrom([], getDrafts())], phase: 'refreshing', error: null, resolved: true, cached: true }
        : { ...emptyRecordings, items: recordingsFrom([], getDrafts()) });
      setMaterials(materialCache
        ? { items: materialCache.items, phase: 'refreshing', error: null, resolved: true, cached: true }
        : emptyMaterials);
      const token = await tokenRef.current();
      if (!isCurrent(generation, owner)) return;
      if (!token) {
        const error = '登录凭证暂不可用，请重新登录';
        setScores((current) => ({ ...current, phase: 'error', error }));
        setRecordings((current) => ({ ...current, phase: 'error', error }));
        setMaterials((current) => ({ ...current, phase: 'error', error }));
        return;
      }
      await Promise.all([
        loadScores(token, generation, owner, source),
        loadRecordings(token, generation, owner, source),
        loadMaterials(token, generation, owner, source),
      ]);
    });
    return () => { generationRef.current = generation + 1; activeOwnerRef.current = null; };
  }, [authenticated, authSource, isCurrent, loadMaterials, loadRecordings, loadScores, userId]);

  useScoreNftPolling({
    scoreNfts: scores.items, authenticated, userId, getAccessToken,
    onRefresh: (items) => {
      if (userId && authSource && activeOwnerRef.current === userId) {
        writeArchiveCache({ authSource, userId }, 'scores', '/api/me/score-nfts', items);
        setScores({ items, phase: 'ready', error: null, resolved: true });
      }
    },
    onError: (error) => {
      if (userId && activeOwnerRef.current === userId) setScores((current) => ({ ...current, phase: 'error', error }));
    },
    onPollingChange: (polling) => {
      if (userId && activeOwnerRef.current === userId) setScores((current) => (
        polling && current.phase === 'ready' ? { ...current, phase: 'refreshing' } : current
      ));
    },
  });
  return { ownerId, scores, recordings, materials, retry };
}
