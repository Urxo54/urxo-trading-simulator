"use client";

import dynamic from "next/dynamic";
import TrainingLoading from "./loading";

const TrainingClient = dynamic(() => import("./training-client"), {
  ssr: false,
  loading: () => <TrainingLoading />,
});

export default function TrainingPage() {
  return <TrainingClient />;
}
