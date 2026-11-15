<!-- AI-assisted development used for code development, debugging and documentation.
     Tool: ChatGPT, Claude -->
# BlinkX Backend & SPHEREx Data Pipeline

Pipeline científico y microservicio backend para consulta, extracción espectral y procesamiento de cubos de datos **SPHEREx DR1 All-Sky** (102 canales, 0.75–5.00 μm).
NASA Space Apps Challenge 2026.

---

## 📁 Estructura

```text
backend/
├── api.py                    # Servidor FastAPI (endpoints /api/spectrum, /api/cube-slice)
├── spherex_service.py        # Servicio Python modular (Astropy + Astroquery)
├── requirements.txt          # Dependencias de Python
├── notebooks/                # Notebooks Jupyter interactivos (respaldo de investigación)
│   ├── ingestion_test.ipynb
│   ├── m101_allsky_102_canales.ipynb
│   └── prueba.ipynb
└── outputs/                  # Archivos FITS calibrados y manifiestos ECSV
    └── spherex_dr1_canales_1_2/
        ├── Npix2858_cube_canales_1_2.fits
        └── manifest.ecsv
```

---

## 🚀 Instalación y Ejecución

### 1. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 2. Iniciar el Servidor de la API
```bash
python api.py
```
O con Uvicorn:
```bash
uvicorn api:app --reload --port 8000
```

Visita la documentación interactiva en: **`http://localhost:8000/docs`**

---

## 📡 Endpoints Principales

- **`GET /api/health`**: Estado del servicio y disponibilidad de Astropy/Astroquery.
- **`GET /api/targets`**: Lista de objetos celestes de calibración (M101, WISE 0855, Barnard's Star, Epsilon Indi B).
- **`GET /api/spectrum?ra={ra}&dec={dec}`**: Retorna los 102 canales espectrales (longitud de onda $\mu\text{m}$, flujo, banderas de calidad `FLAGS` y `NHITS`).
- **`GET /api/cube-slice?channel={0-101}`**: Retorna un corte espacial 2D del cubo para el canal seleccionado.
