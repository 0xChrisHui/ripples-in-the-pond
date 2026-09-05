'use client';

import { Suspense } from 'react';
import HomeLoading from '@/app/loading';
import PondExperience from '@/src/features/home-pond/PondExperience';

export default function Test4Page() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <PondExperience mode="test4" />
    </Suspense>
  );
}
