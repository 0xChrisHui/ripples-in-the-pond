'use client';

import { useCallback, useState } from 'react';
import { archivePageCount } from '../archive-state';

export type ArchiveSectionId = 'records' | 'pending' | 'favorites';
export const ARCHIVE_PAGE_SIZES: Record<ArchiveSectionId, number> = {
  records: 3,
  pending: 3,
  favorites: 7,
};

export function useArchivePagination(counts: Record<ArchiveSectionId, number | null>) {
  const [pages, setPages] = useState<Record<ArchiveSectionId, number>>({
    records: 0,
    pending: 0,
    favorites: 0,
  });
  const pageCounts = {
    records: archivePageCount(counts.records, ARCHIVE_PAGE_SIZES.records),
    pending: archivePageCount(counts.pending, ARCHIVE_PAGE_SIZES.pending),
    favorites: archivePageCount(counts.favorites, ARCHIVE_PAGE_SIZES.favorites),
  };
  const safePages = {
    records: Math.min(pages.records, pageCounts.records - 1),
    pending: Math.min(pages.pending, pageCounts.pending - 1),
    favorites: Math.min(pages.favorites, pageCounts.favorites - 1),
  };
  const changePage = useCallback((section: ArchiveSectionId, page: number) => {
    setPages((current) => ({ ...current, [section]: page }));
  }, []);
  const showRecordsPage = useCallback((page: number) => {
    setPages((current) => ({ ...current, records: page }));
  }, []);
  return {
    pageCounts,
    safePages,
    starts: {
      records: safePages.records * ARCHIVE_PAGE_SIZES.records,
      pending: safePages.pending * ARCHIVE_PAGE_SIZES.pending,
      favorites: safePages.favorites * ARCHIVE_PAGE_SIZES.favorites,
    },
    changePage,
    showRecordsPage,
  };
}
