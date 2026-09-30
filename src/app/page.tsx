import { Suspense } from "react";
import { HomeExperience } from "./components/HomeExperience";
import { SkeletonList } from "./components/SkeletonList";

export default function Home() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><SkeletonList count={4} /></main>}>
      <HomeExperience />
    </Suspense>
  );
}
