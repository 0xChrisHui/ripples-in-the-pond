'use client';

import { useEffect, useState } from 'react';
import type { Track } from '@/src/types/tracks';
import { fetchTracks } from '@/src/data/tracks-source';
import Island from './Island';

/**
 * Archipelago — 群岛容器
 * 从适配层获取 tracks，散布式渲染多个 Island
 */
export default function Archipelago() {
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    fetchTracks().then(setTracks);
  }, []);

  if (tracks.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center justify-center gap-12 px-8">
      {tracks.map((track) => (
        <Island key={track.id} track={track} />
      ))}
    </section>
  );
}
