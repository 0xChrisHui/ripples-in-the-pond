import { Suspense } from 'react';
import PondExperience from '@/src/features/home-pond/PondExperience';
import HomeLoading from './loading';

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <PondExperience mode="production" />
    </Suspense>
  );
}
