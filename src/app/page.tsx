import { Suspense } from "react";
import DebateArena from "@/components/DebateArena";

export default function Home() {
  return (
    <Suspense>
      <DebateArena />
    </Suspense>
  );
}
