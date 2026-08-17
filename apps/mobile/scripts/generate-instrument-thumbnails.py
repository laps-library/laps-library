from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INSTRUMENTS = ROOT / "assets" / "instruments"
MANIFEST = INSTRUMENTS / "manifest.ts"

MAX_SIZE = 300
PNG_COMPRESS_LEVEL = 9


def ts_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def generate_thumbnail(source: Path, destination: Path):
    with Image.open(source) as img:

        # On conserve impérativement la transparence.
        img = img.convert("RGBA")

        # Réduction sans agrandir les petites images.
        img.thumbnail(
            (MAX_SIZE, MAX_SIZE),
            Image.Resampling.LANCZOS
        )

        destination.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        img.save(
            destination,
            format="PNG",
            optimize=True,
            compress_level=PNG_COMPRESS_LEVEL
        )

        return img.size


def main():

    if not INSTRUMENTS.exists():
        raise SystemExit(
            f"Dossier introuvable : {INSTRUMENTS}"
        )

    photos = sorted(
        p for p in INSTRUMENTS.rglob("photo.png")
        if p.parent != INSTRUMENTS
    )

    if not photos:
        raise SystemExit(
            "Aucun photo.png trouvé."
        )

    entries = []

    for photo in photos:

        thumb = photo.with_name("thumb.png")

        try:
            width, height = generate_thumbnail(
                photo,
                thumb
            )

            # Exemple :
            # Arturia/MicroFreak
            key = photo.parent.relative_to(
                INSTRUMENTS
            ).as_posix()

            entries.append(
                (key, thumb)
            )

            print(
                f"[OK] {key} → "
                f"{width}x{height}"
            )

        except Exception as error:

            print(
                f"[ERREUR] {photo} : {error}"
            )

    # Génération du nouveau manifest
    lines = [
        "export const LOCAL_PHOTOS: Record<string, any> = {"
    ]

    for key, thumb in entries:

        relative = (
            "./"
            + thumb.relative_to(
                INSTRUMENTS
            ).as_posix()
        )

        lines.append(
            f"  {ts_string(key)}: "
            f"require({ts_string(relative)}),"
        )

    lines.append("};")
    lines.append("")

    MANIFEST.write_text(
        "\n".join(lines),
        encoding="utf-8"
    )

    print()
    print(
        f"✓ {len(entries)} thumbnails générés"
    )

    print(
        f"✓ Manifest mis à jour : {MANIFEST}"
    )


if __name__ == "__main__":
    main()