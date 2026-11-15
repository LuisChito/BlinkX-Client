# AI-assisted development used for code development, debugging and documentation.
# Tool: ChatGPT, Claude
"""
SPHEREx Data Pipeline & FITS Cube Service
NASA Space Apps Challenge 2026 — Planet X and SPHEREx

Extrae de forma limpia y modular la información espectral y espacial de los cubos de datos
All-Sky oficiales de la misión SPHEREx (IRSA / IPAC / Caltech).
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

try:
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    from astropy.io import fits
    from astropy.table import Table
    from astropy.wcs import WCS
    from astroquery.ipac.irsa import Irsa
    ASTROPY_AVAILABLE = True
except ImportError:
    ASTROPY_AVAILABLE = False


class SpherexCubeService:
    """Servicio para consultar, descargar y procesar cubos SPHEREx de 102 bandas."""

    COLLECTION = "spherex_dr1_cube"
    TOTAL_CHANNELS = 102

    def __init__(self, local_cache_dir: Optional[Path] = None):
        self.cache_dir = local_cache_dir or Path(__file__).parent / "outputs"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def query_tiles_for_coordinate(
        self, ra_deg: float, dec_deg: float, radius_arcsec: float = 1.0
    ) -> List[str]:
        """Consulta en IRSA las URLs de las teselas del cubo que contienen la coordenada (RA, Dec)."""
        if not ASTROPY_AVAILABLE:
            raise RuntimeError("Astropy y Astroquery son necesarios para consultar IRSA en vivo.")

        coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="icrs")
        results = Irsa.query_sia(pos=(coord, radius_arcsec * u.arcsec), collection=[self.COLLECTION])

        if len(results) == 0:
            return []

        urls = sorted({
            str(x).strip()
            for x in results["access_url"]
            if not np.ma.is_masked(x) and str(x).strip()
        })
        return urls

    def extract_spectrum_from_fits(
        self, fits_source: str, ra_deg: float, dec_deg: float
    ) -> Dict[str, Any]:
        """
        Lee una tesela FITS del All-Sky Cube y extrae el espectro de 102 canales en el píxel de interés.
        """
        if not ASTROPY_AVAILABLE:
            raise RuntimeError("Astropy es requerido para leer archivos FITS.")

        coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="icrs")

        with fits.open(fits_source, lazy_load_hdus=True) as hdul:
            image_header = hdul["IMAGE"].header
            wcs_celestial = WCS(image_header, hdul).celestial
            xp, yp = wcs_celestial.world_to_pixel(coord)

            forma = hdul["IMAGE"].shape
            ix, iy = int(np.floor(float(xp) + 0.5)), int(np.floor(float(yp) + 0.5))

            if not (0 <= ix < forma[-1] and 0 <= iy < forma[-2]):
                raise ValueError(f"Coordenadas fuera de los límites del FITS: pixel ({ix}, {iy})")

            # Matriz de 102 canales: shape (102, y, x)
            cubo_image = hdul["IMAGE"].data
            pixel_spectrum = cubo_image[:, iy, ix].tolist()

            # Metadatos de canales
            spectral_table = Table(hdul["SPECTRAL_CHANNELS"].data) if "SPECTRAL_CHANNELS" in hdul else None
            flags = hdul["FLAGS"].data[:, iy, ix].tolist() if "FLAGS" in hdul else []
            nhits = hdul["NHITS"].data[:, iy, ix].tolist() if "NHITS" in hdul else []

            wavelengths = []
            if spectral_table is not None:
                # Localizar columna de longitud de onda central
                for col in ["wavelength", "wave", "lambda", "lambda_center"]:
                    if col in spectral_table.colnames:
                        wavelengths = [float(w) for w in spectral_table[col]]
                        break

            if not wavelengths:
                # Rango de SPHEREx DR1: 0.75 a 5.00 um espaciado logarítmicamente
                wavelengths = np.geomspace(0.75, 5.00, self.TOTAL_CHANNELS).round(4).tolist()

            return {
                "ra": ra_deg,
                "dec": dec_deg,
                "pixel": {"x": ix, "y": iy},
                "total_channels": len(pixel_spectrum),
                "bunit": image_header.get("BUNIT", "MJy/sr"),
                "channels": [
                    {
                        "channel": i + 1,
                        "wavelength_um": wavelengths[i] if i < len(wavelengths) else 0.75 + (i * 0.042),
                        "flux": float(pixel_spectrum[i]) if np.isfinite(pixel_spectrum[i]) else 0.0,
                        "flag": int(flags[i]) if i < len(flags) else 0,
                        "nhits": int(nhits[i]) if i < len(nhits) else 1,
                    }
                    for i in range(len(pixel_spectrum))
                ],
            }

    def extract_spatial_slice(
        self, fits_source: str, channel_idx: int = 0
    ) -> Dict[str, Any]:
        """Extrae un corte espacial 2D (y, x) para un canal específico (0 a 101)."""
        if not ASTROPY_AVAILABLE:
            raise RuntimeError("Astropy es requerido para leer archivos FITS.")

        with fits.open(fits_source, lazy_load_hdus=True) as hdul:
            image_data = hdul["IMAGE"].data
            if channel_idx < 0 or channel_idx >= image_data.shape[0]:
                raise IndexError(f"Canal {channel_idx} fuera de rango (0-{image_data.shape[0]-1})")

            slice_2d = image_data[channel_idx].astype(float)
            valid = slice_2d[np.isfinite(slice_2d)]

            vmin = float(np.percentile(valid, 3.5)) if valid.size else 0.0
            vmax = float(np.percentile(valid, 96.5)) if valid.size else 1.0

            normalized = np.clip((slice_2d - vmin) / max(vmax - vmin, 1e-10), 0.0, 1.0)
            normalized[~np.isfinite(slice_2d)] = 0.0

            return {
                "channel_index": channel_idx,
                "channel_number": channel_idx + 1,
                "shape": list(slice_2d.shape),
                "vmin": vmin,
                "vmax": vmax,
                "bunit": hdul["IMAGE"].header.get("BUNIT", "MJy/sr"),
                "sample_grid": normalized[::4, ::4].round(3).tolist(),  # Matriz comprimida para previsualización web
            }
