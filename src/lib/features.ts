import { useEffect, useState } from "react";
import { fetchFeatures, type Features } from "./api.ts";

export function useFeatures(): Features | undefined {
  const [f, setF] = useState<Features>();
  useEffect(() => {
    let alive = true;
    fetchFeatures().then((v) => alive && setF(v));
    return () => {
      alive = false;
    };
  }, []);
  return f;
}
