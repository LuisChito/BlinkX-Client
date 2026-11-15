# AI-assisted development used for code development, debugging and documentation.
# Tool: ChatGPT, Claude
"""
FastAPI Microservice para SPHEREx Data Pipeline
Expone endpoints REST que sirven espectros de 102 canales y cortes FITS 2D para la web.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import Optional
from spherex_service import SpherexCubeService, ASTROPY_AVAILABLE

app = FastAPI(
    title="BlinkX SPHEREx Backend API",
    description="API de extracción espectral y astrométrica de cubos FITS SPHEREx DR1 (102 canales)",
    version="1.0.0",
)

# Permitir CORS para desarrollo local (Vite/Astro en cualquier puerto)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = SpherexCubeService()

# Objetivos de calibración base
DEFAULT_TARGETS = [
    {"id": "m101", "name": "M101 (Pinwheel Galaxy)", "ra": 210.80227, "dec": 54.34895, "category": "Galaxy"},
    {"id": "wise0855", "name": "WISE 0855-0714", "ra": 133.795, "dec": -7.245, "category": "Brown Dwarf"},
    {"id": "barnard", "name": "Barnard's Star", "ra": 269.45402, "dec": 4.69339, "category": "High Proper Motion"},
    {"id": "epsilon_indi", "name": "Epsilon Indi B", "ra": 330.84, "dec": -56.79, "category": "Binary Sub-stellar"},
]


@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "astropy_installed": ASTROPY_AVAILABLE,
        "service": "BlinkX SPHEREx DR1 Data Service",
    }


@app.get("/api/targets")
def list_targets():
    """Lista de objetivos astronómicos pre-calibrados con cubos disponibles."""
    return {"targets": DEFAULT_TARGETS}


@app.get("/api/spectrum")
def get_spectrum(
    ra: float = Query(..., description="Ascensión Recta en grados (ICRS)"),
    dec: float = Query(..., description="Declinación en grados (ICRS)"),
    fits_path: Optional[str] = Query(None, description="Ruta local opcional a archivo FITS de prueba"),
):
    """
    Retorna el espectro continuo de 102 canales para la coordenada indicada.
    Si se dispone de un FITS local o se consulta en IRSA, extrae las bandas calibradas.
    """
    try:
        # Si se especifica o existe un FITS local en outputs, usarlo
        default_local_fits = Path(__file__).parent / "outputs" / "spherex_dr1_canales_1_2" / "Npix2858_cube_canales_1_2.fits"
        target_fits = fits_path or (str(default_local_fits) if default_local_fits.exists() else None)

        if target_fits and Path(target_fits).exists():
            return service.extract_spectrum_from_fits(target_fits, ra, dec)
        
        # Fallback a consulta en IRSA si Astropy está instalado
        urls = service.query_tiles_for_coordinate(ra, dec)
        if not urls:
            raise HTTPException(status_code=404, detail="No se encontraron teselas FITS para esta coordenada en IRSA DR1.")

        return service.extract_spectrum_from_fits(urls[0], ra, dec)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cube-slice")
def get_cube_slice(
    channel: int = Query(0, ge=0, le=101, description="Índice de canal espectral (0-101)"),
    fits_path: Optional[str] = Query(None, description="Ruta al archivo FITS"),
):
    """Retorna un corte espacial 2D de la tesela del cubo para el canal seleccionado."""
    default_local_fits = Path(__file__).parent / "outputs" / "spherex_dr1_canales_1_2" / "Npix2858_cube_canales_1_2.fits"
    target_fits = fits_path or (str(default_local_fits) if default_local_fits.exists() else None)

    if not target_fits or not Path(target_fits).exists():
        raise HTTPException(status_code=404, detail="Archivo FITS no encontrado en el servidor.")

    try:
        return service.extract_spatial_slice(target_fits, channel)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
