import type { FrameMeta } from '../../lib/api';
import type { SpectrumPoint } from '../../lib/skyApi';

export interface RealDetectorSummary {
  detector: 1 | 2 | 3 | 4 | 5 | 6;
  bandLabel: string;
  wavelengthRangeUm: [number, number];
  pointCount: number;
  frameCount: number;
  meanFluxUJy: number | null;
  sumFluxUJy: number | null;
  points: SpectrumPoint[];
}

const DETECTOR_BANDS: Record<1 | 2 | 3 | 4 | 5 | 6, [number, number]> = {
  1: [0.75, 1.11],
  2: [1.11, 1.64],
  3: [1.64, 2.42],
  4: [2.42, 3.82],
  5: [3.82, 4.42],
  6: [4.42, 5.0],
};

export function summarizeRealDetectors(
  points: SpectrumPoint[],
  framesMeta: Array<Partial<Omit<FrameMeta, 'detector'>> & { detector: number }> = [],
): RealDetectorSummary[] {
  const detectors: Array<1 | 2 | 3 | 4 | 5 | 6> = [1, 2, 3, 4, 5, 6];
  return detectors.map((det) => {
    const detPoints = points
      .filter((p) => p.detector === det)
      .sort((a, b) => a.wavelength - b.wavelength);
    const frameCount = framesMeta.filter((f) => f.detector === det).length;
    const pointCount = detPoints.length;

    let sumFluxUJy: number | null = null;
    let meanFluxUJy: number | null = null;
    if (pointCount > 0) {
      const sum = detPoints.reduce((acc, p) => acc + p.flux, 0);
      sumFluxUJy = Number(sum.toFixed(2));
      meanFluxUJy = Number((sum / pointCount).toFixed(2));
    }

    return {
      detector: det,
      bandLabel: `D${det}`,
      wavelengthRangeUm: DETECTOR_BANDS[det],
      pointCount,
      frameCount,
      meanFluxUJy,
      sumFluxUJy,
      points: detPoints,
    };
  });
}
