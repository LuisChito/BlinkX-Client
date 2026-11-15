// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { describe, expect, it } from 'vitest';
import { SPHEREX_TARGETS } from '../data/spherexCatalog';
import {
  filterTargetsByMotion,
  generateOnTheFlySourceAtCoordinate,
  parseExplorerUrlParams,
  parseRaDecInput,
  serializeExplorerUrlParams,
  summarize6DetectorArrays,
} from '../utils/urlState';
import {
  buildInitialDetectionsForTarget,
  calculateAstrometricLinearFit,
  generateAdesPsvContent,
  getCatalogCrossMatchReport,
} from '../utils/astrometryEngine';
import {
  buildHips2FitsCutoutUrl,
  getFieldOverlayCatalogSources,
} from '../services/astronomyApi';
import { summarizeRealDetectors } from '../utils/backendMetrics';

describe('SPHEREx Explorer Catalog & 102-Band Spectra', () => {
  const mandatoryTargetNames = [
    "Barnard's Star",
    'WISE 0855',
    'Epsilon Indi B',
    'RW Aurigae',
    'R Draconis',
  ];

  it('contains all 5 mandatory NASA Space Apps Challenge targets with clean real coordinates and no hardcoded spectra', () => {
    for (const requiredName of mandatoryTargetNames) {
      const target = SPHEREX_TARGETS.find((t) => t.name === requiredName);
      expect(target).toBeDefined();
      expect(target?.isChallengeTarget).toBe(true);
      expect(target?.raDeg).toBeGreaterThanOrEqual(0);
      expect(target?.raDeg).toBeLessThan(360);
      expect(target?.decDeg).toBeGreaterThanOrEqual(-90);
      expect(target?.decDeg).toBeLessThanOrEqual(90);
      expect(target?.spectrum102).toBeUndefined();
      expect(target?.epochs).toBeUndefined();
    }
  });

  it('matches exact NASA challenge sexagesimal coordinates for WISE 0855 (08h55m10.831s, -7d14m42.53s -> RA 133.79513°, Dec -7.24515°)', () => {
    const wise0855 = SPHEREX_TARGETS.find((t) => t.id === 'wise-0855');
    expect(wise0855).toBeDefined();
    expect(wise0855!.raDeg).toBeCloseTo(133.79513, 5);
    expect(wise0855!.decDeg).toBeCloseTo(-7.24515, 5);

    const parsedChallengeCoords = parseRaDecInput('08h55m10.831s, -7d14m42.53s');
    expect(parsedChallengeCoords).not.toBeNull();
    expect(parsedChallengeCoords!.ra).toBeCloseTo(133.79513, 5);
    expect(parsedChallengeCoords!.dec).toBeCloseTo(-7.24515, 5);
  });

  it('sums separately all 6 SPHEREx LVF detector arrays (LVF-1 to LVF-6, 17 channels each) to improve SNR by sqrt(17) ≈ 4.12x', () => {
    const wise0855 = SPHEREX_TARGETS.find((t) => t.id === 'wise-0855')!;
    const otf = generateOnTheFlySourceAtCoordinate(133.79513, -7.24515, wise0855);
    const arrays = summarize6DetectorArrays(otf.spectrum102);
    expect(arrays).toHaveLength(6);
    expect(arrays.map((a) => a.band)).toEqual([
      'LVF-1',
      'LVF-2',
      'LVF-3',
      'LVF-4',
      'LVF-5',
      'LVF-6',
    ]);

    for (const arr of arrays) {
      expect(arr.channelRange[1] - arr.channelRange[0] + 1).toBe(17);
      expect(arr.snrGainFactor).toBeCloseTo(Math.sqrt(17), 2);
      expect(arr.coaddedSnr).toBeGreaterThan(arr.singleChannelSnr * 4.0);
      expect(arr.sumFluxCombined).toBeCloseTo(arr.sumFluxT1 + arr.sumFluxT2, 2);
    }
  });

  it('generates 102-band spectra and AI wavelength insights on the fly for any clicked celestial coordinate', () => {
    const barnard = SPHEREX_TARGETS.find((t) => t.id === 'barnards-star')!;
    const otfSource = generateOnTheFlySourceAtCoordinate(269.4812, 4.7125, barnard);
    expect(otfSource.spectrum102).toHaveLength(102);
    expect(otfSource.raDeg).toBeCloseTo(269.4812, 4);
    expect(otfSource.decDeg).toBeCloseTo(4.7125, 4);
    expect(otfSource.aiSummary.length).toBeGreaterThan(30);
    expect(otfSource.dominantMolecules.length).toBeGreaterThan(0);
  });
});

describe('RA/Dec Coordinate Parser', () => {
  it('parses decimal degree coordinates and normalizes RA', () => {
    expect(parseRaDecInput('269.4521, 4.6934')).toEqual({ ra: 269.4521, dec: 4.6934 });
    expect(parseRaDecInput('-10.5 22.25')).toEqual({ ra: 349.5, dec: 22.25 });
  });

  it('parses HMS/DMS sexagesimal coordinates', () => {
    const parsed = parseRaDecInput('17h57m48.5s +04d41m36.2s');
    expect(parsed).not.toBeNull();
    expect(parsed!.ra).toBeCloseTo(269.4521, 2);
    expect(parsed!.dec).toBeCloseTo(4.6934, 2);
  });

  it('rejects out-of-range or malformed strings', () => {
    expect(parseRaDecInput('999, 120')).toBeNull();
    expect(parseRaDecInput("Barnard's Star")).toBeNull();
    expect(parseRaDecInput('')).toBeNull();
  });
});

describe('Bidirectional URL State Sync & Motion Filters', () => {
  it('round-trips ExplorerUrlState cleanly through URLSearchParams including sum and diff modes', () => {
    const initial = {
      target: 'wise-0855',
      ra: 133.79513,
      dec: -7.24515,
      fov: 0.15,
      epoch: 3 as const,
      mode: 'sum' as const,
      view: 'split' as const,
      lens: 'ch4' as const,
    };

    const params = serializeExplorerUrlParams(initial);
    const parsed = parseExplorerUrlParams(params);
    expect(parsed).toEqual(initial);
  });

  it('defaults to Barnard\'s Star (RA 269.4521, Dec 4.6934, FoV 0.15) when URL query params are empty', () => {
    const emptyParams = new URLSearchParams();
    const parsed = parseExplorerUrlParams(emptyParams);
    expect(parsed.target).toBe('barnards-star');
    expect(parsed.ra).toBeCloseTo(269.4521, 4);
    expect(parsed.dec).toBeCloseTo(4.6934, 4);
    expect(parsed.fov).toBeCloseTo(0.15, 3);
    expect(parsed.epoch).toBe(1);
    expect(parsed.mode).toBe('normal');
    expect(parsed.view).toBe('hud');
  });

  it('filters catalog targets by proper motion velocity or brightness change magnitude', () => {
    const barnardsBase = SPHEREX_TARGETS.find((t) => t.id === 'barnards-star')!;
    const rDraconisBase = SPHEREX_TARGETS.find((t) => t.id === 'r-draconis')!;
    const fixtureTargets = [
      { ...barnardsBase, velocityArcsecYr: 10.37, brightnessChangeMag: 0.05 },
      { ...rDraconisBase, velocityArcsecYr: 0.02, brightnessChangeMag: 5.7 },
    ];
    const highMotion = filterTargetsByMotion(fixtureTargets, 10.0, 4.5);
    expect(highMotion.some((t) => t.id === 'barnards-star')).toBe(true);
    expect(highMotion.some((t) => t.id === 'r-draconis')).toBe(true);
  });
});

describe('Candidate Dossier Astrometric Fit, Catalog Cross-Match, Overlays & ADES-PSV Export', () => {
  const wise0855Base = SPHEREX_TARGETS.find((t) => t.id === 'wise-0855')!;
  const wise0855Fixture = {
    ...wise0855Base,
    velocityArcsecYr: 8.08,
    fitsId: 'SPHEREx_DR1_WISE0855_FIXTURE',
    epochs: [
      { epoch: 1 as const, label: 'T1', dateLabel: '2025-05-14T04:22:10Z', mjd: 60809.18, raShiftArcsec: 0, decShiftArcsec: 0, fluxScale: 1.0 },
      { epoch: 2 as const, label: 'T2', dateLabel: '2025-08-14T04:22:10Z', mjd: 60901.18, raShiftArcsec: -2.035, decShiftArcsec: 0.17, fluxScale: 1.0 },
      { epoch: 3 as const, label: 'T3', dateLabel: '2025-11-14T04:22:10Z', mjd: 60993.18, raShiftArcsec: -4.07, decShiftArcsec: 0.34, fluxScale: 1.0 },
      { epoch: 4 as const, label: 'T4', dateLabel: '2026-02-14T04:22:10Z', mjd: 61085.18, raShiftArcsec: -6.105, decShiftArcsec: 0.51, fluxScale: 1.0 },
    ],
  };

  it('calculates linear astrometric fit for WISE 0855 matching published ~8.08"/yr and evaluates MPC rule', () => {
    const detections = buildInitialDetectionsForTarget(wise0855Fixture);
    expect(detections).toHaveLength(4);

    const fit = calculateAstrometricLinearFit(detections, wise0855Fixture);
    expect(fit.velocityArcsecYr).toBeGreaterThan(7.8);
    expect(fit.velocityArcsecYr).toBeLessThan(8.3);
    expect(fit.rSquared).toBeGreaterThan(0.99);
    expect(fit.isLinearConsistent).toBe(true);
    expect(fit.mpcAssessment.meetsSingleNightMpcRule).toBe(false);
    expect(fit.publishedAgreementPct).toBeGreaterThan(95);
  });

  it('returns accurate catalog cross-match status for WISE 0855 and uncataloged Sector 34A', () => {
    const wiseReport = getCatalogCrossMatchReport(wise0855Fixture);
    expect(wiseReport.overallStatus).toBe('KNOWN_BENCHMARK');
    expect(wiseReport.entries.find((e) => e.catalog === 'AllWISE')?.matched).toBe(true);

    const sec34aFixture = {
      ...wise0855Base,
      id: 'm51-sector-34a',
      name: 'M51 Sector 34A',
      designation: 'UNCATALOGED-TEST',
      raDeg: 202.4696,
      decDeg: 47.1952,
    };
    const secReport = getCatalogCrossMatchReport(sec34aFixture);
    expect(secReport.overallStatus).toBe('UNCATALOGED_CANDIDATE');
    expect(secReport.entries.every((e) => !e.matched)).toBe(true);
  });

  it('provides Gaia DR3 and AllWISE overlay sources for sky field superposition', () => {
    const sources = getFieldOverlayCatalogSources(269.4521, 4.6934, 0.15, 'barnards-star');
    expect(sources.some((s) => s.catalog === 'Gaia DR3')).toBe(true);
    expect(sources.some((s) => s.catalog === 'AllWISE')).toBe(true);
  });

  it('generates valid IAU ADES-PSV output with observatory metadata and pipe-separated detections', () => {
    const detections = buildInitialDetectionsForTarget(wise0855Fixture);
    const psv = generateAdesPsvContent(wise0855Fixture, detections, 'known_catalog', 'Benchmark Y4 dwarf');

    expect(psv).toContain('# version=2022');
    expect(psv).toContain('! mpcCode C57');
    expect(psv).toContain('permID |provID');
    expect(psv).toContain('2025-05-14T04:22:10Z');
  });

  it('builds valid CDS HiPS2FITS cutout URLs for all 3 Filter Wheel modes', () => {
    const urlSrgb = buildHips2FitsCutoutUrl(133.79513, -7.24515, 0.15, 'srgb');
    const urlWave = buildHips2FitsCutoutUrl(133.79513, -7.24515, 0.15, 'wavelength');
    expect(urlSrgb).toContain('CDS%2FP%2F2MASS%2Fcolor');
    expect(urlWave).toContain('CDS%2FP%2FallWISE%2Fcolor');
  });

  it('summarizes real /api/spectrum points and /api/frames metadata by detector D1..D6 without mock fallbacks', () => {
    const empty = summarizeRealDetectors([], []);
    expect(empty).toHaveLength(6);
    expect(empty.every((d) => d.pointCount === 0 && d.meanFluxUJy === null)).toBe(true);

    const summaries = summarizeRealDetectors(
      [
        {
          wavelength: 2.8,
          flux: 120.5,
          error: 4.2,
          date_obs: '2025-05-14T00:00:00Z',
          detector: 4,
          frame_id: 'f1',
          flags: [],
        },
        {
          wavelength: 2.5,
          flux: 80.5,
          error: 3.1,
          date_obs: '2025-06-01T00:00:00Z',
          detector: 4,
          frame_id: 'f2',
          flags: ['saturated'],
        },
      ],
      [
        {
          id: 'f1',
          date_obs: '2025-05-14T00:00:00Z',
          detector: 4,
          band_um: 2.8,
          center: { ra: 133.79, dec: -7.24 },
          fov_arcsec: 540,
          exposure_s: 112.5,
          flags: [],
        },
      ],
    );

    const d4 = summaries.find((d) => d.detector === 4)!;
    expect(d4.pointCount).toBe(2);
    expect(d4.frameCount).toBe(1);
    expect(d4.meanFluxUJy).toBeCloseTo(100.5, 2);
    expect(d4.sumFluxUJy).toBeCloseTo(201.0, 2);
    expect(d4.points[0].wavelength).toBe(2.5);
    expect(d4.points[1].wavelength).toBe(2.8);
  });
});
