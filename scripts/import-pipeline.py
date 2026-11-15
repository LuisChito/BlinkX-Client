# AI-assisted development used for code development, debugging and documentation.
# Tool: ChatGPT, Claude
"""Importa los resultados del pipeline SPHEREx (G:\\SphereX\\SphereX-pipeline\\outputs) al visor.

Copia a public/local-data/ lo que se puede ver en la web, sin depender de IRSA ni de la API:
  - L2 en gris y en color (reducidas a 1600 px, WebP)
  - Cubo 3D y las 6 muestras de canales (WebP)
  - Espectro de 102 canales y las 6 muestras (JSON)
  - Resumen de las observaciones L2 (detectores, fechas, cuántas hay)
y escribe public/local-data/index.json, que lee la pestaña «Locales» del visor.

Uso:
  python scripts/import-pipeline.py                      # origen por defecto
  python scripts/import-pipeline.py --src "D:/otra/carpeta/outputs"
  python scripts/import-pipeline.py --explorer "G:/SphereX/web-explorer/dist"   # además copia el explorador M101

Requiere Pillow (pip install pillow). Se puede volver a correr: sobrescribe lo importado.
"""
import argparse
import sys
sys.stdout.reconfigure(encoding="utf-8")
import json
import math
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "local-data"

# Nombres conocidos (el resto se nombra por coordenadas).
KNOWN = [
    {"name": "M101 · Galaxia del Molinete", "ra": 210.80227, "dec": 54.34895},
]


def mjd_to_iso(mjd):
    try:
        v = float(mjd)
    except (TypeError, ValueError):
        return None
    if math.isnan(v):
        return None
    return (datetime(1858, 11, 17, tzinfo=timezone.utc) + timedelta(days=v)).isoformat().replace("+00:00", "Z")


def num(v):
    try:
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None


def read_ecsv(path: Path):
    """Lector mínimo de ECSV (encabezado '#' + tabla separada por espacios con comillas)."""
    import shlex

    rows = []
    header = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = shlex.split(line)
        if header is None:
            header = parts
            continue
        rows.append(dict(zip(header, parts)))
    return [
        {
            "channel": int(r["channel"]),
            "wavelength_um": num(r.get("wavelength")),
            "bandwidth_um": num(r.get("bandwidth")),
            "brightness": num(r.get("brightness")),
            "flags": int(r["FLAGS"]) if r.get("FLAGS") not in (None, "") else None,
            "nhits": int(r["NHITS"]) if r.get("NHITS") not in (None, "") else None,
        }
        for r in rows
    ]


def to_webp(src: Path, dst: Path, max_side: int):
    im = Image.open(src)
    if im.mode not in ("RGB", "RGBA", "L"):
        im = im.convert("RGBA")
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(dst, "WEBP", quality=84, method=5)
    return list(im.size)


def summarize_obs(path: Path):
    try:
        obs = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    bands = {}
    times = []
    for o in obs:
        b = (o.get("energy_bandpassname") or "").replace("SPHEREx-", "")
        bands[b] = bands.get(b, 0) + 1
        t = num(o.get("t_min"))
        if t is not None:
            times.append(t)
    times.sort()
    return {
        "count": len(obs),
        "detectors": dict(sorted(bands.items())),
        "first": mjd_to_iso(times[0]) if times else None,
        "last": mjd_to_iso(times[-1]) if times else None,
        # fechas (día) con observaciones, para la línea de tiempo
        "days": sorted({mjd_to_iso(t)[:10] for t in times}),
    }


def field_name(ra, dec):
    for k in KNOWN:
        if abs(k["ra"] - ra) < 0.05 and abs(k["dec"] - dec) < 0.05:
            return k["name"]
    return f"Campo RA {ra:.2f}° · Dec {dec:+.2f}°"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="G:/SphereX/SphereX-pipeline/outputs")
    ap.add_argument("--explorer", default=None, help="carpeta dist del explorador espectral (opcional)")
    ap.add_argument("--max-side", type=int, default=1600)
    a = ap.parse_args()

    src = Path(a.src)
    if not src.is_dir():
        raise SystemExit(f"No existe la carpeta de origen: {src}")
    OUT.mkdir(parents=True, exist_ok=True)

    fields = []
    for d in sorted(p for p in src.iterdir() if p.is_dir()):
        mf = d / "manifest.json"
        if not mf.exists():
            continue
        m = json.loads(mf.read_text(encoding="utf-8"))
        fid = d.name[:12]
        out = OUT / fid
        out.mkdir(exist_ok=True)
        ra, dec = float(m["ra"]), float(m["dec"])
        print(f"· {fid}  RA {ra:.4f}  Dec {dec:+.4f}")

        images = {}
        for key, fname, side in [
            ("l2_gray", "l2_gray.png", a.max_side),
            ("l2_rgb", "l2_rgb.png", a.max_side),
            ("cube3d", "cube3d.png", 1400),
            ("samples", "samples.png", 1600),
        ]:
            p = d / fname
            if p.exists():
                size = to_webp(p, out / f"{key}.webp", side)
                images[key] = {"src": f"/local-data/{fid}/{key}.webp", "size": size}

        spectrum = read_ecsv(d / "spectrum.ecsv") if (d / "spectrum.ecsv").exists() else []
        samples = read_ecsv(d / "samples.ecsv") if (d / "samples.ecsv").exists() else []
        l2 = m.get("l2") or {}
        allsky = m.get("allsky") or {}
        fields.append(
            {
                "id": fid,
                "name": field_name(ra, dec),
                "ra": ra,
                "dec": dec,
                "status": m.get("status"),
                "l2": {
                    "file": (l2.get("url") or "").rsplit("/", 1)[-1] or None,
                    "url": l2.get("url"),
                    "count": l2.get("count"),
                    "shape": l2.get("shape"),
                    "low": l2.get("low"),
                    "high": l2.get("high"),
                    "unit": l2.get("unit"),
                    "note": l2.get("rgb"),
                },
                "cube": {
                    "tile": (allsky.get("url") or "").rsplit("/", 1)[-1] or None,
                    "url": allsky.get("url"),
                    "shape": allsky.get("shape"),
                    "pixel": allsky.get("pixel"),
                    "unit": allsky.get("unit"),
                    "channels": allsky.get("channels"),
                },
                "observations": summarize_obs(d / "observations.json"),
                "images": images,
                "spectrum": spectrum,
                "samples": samples,
            }
        )

    explorer = None
    if a.explorer:
        ex = Path(a.explorer)
        if (ex / "index.html").exists():
            dst = ROOT / "public" / "explorador-m101"
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(ex, dst)
            explorer = "/explorador-m101/index.html"
            print(f"· explorador espectral copiado → {dst}")

    index = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": str(src),
        "explorer": explorer or (("/explorador-m101/index.html") if (ROOT / "public" / "explorador-m101" / "index.html").exists() else None),
        "fields": fields,
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Listo: {len(fields)} campos → {OUT / 'index.json'}")


if __name__ == "__main__":
    main()
