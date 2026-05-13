from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Literal

import numpy as np
import trimesh
from PIL import Image, ImageOps, UnidentifiedImageError

LampSize = Literal["Mini", "Classic", "Gallery"]
LithophaneOrientation = Literal["Portrait", "Landscape", "Square"]

SIZE_CONFIG: dict[LampSize, float] = {
    "Mini": 100.0,
    "Classic": 150.0,
    "Gallery": 200.0,
}

MIN_THICKNESS_MM = 0.8
MAX_THICKNESS_MM = 3.2
MAX_PIXELS = 170


@dataclass(frozen=True)
class LithophaneMetadata:
    width_mm: float
    height_mm: float
    min_thickness_mm: float
    max_thickness_mm: float
    vertices: int
    faces: int
    is_watertight: bool


@dataclass(frozen=True)
class LithophaneResult:
    stl_path: Path
    glb_path: Path
    metadata: LithophaneMetadata


class InvalidImageError(ValueError):
    pass


def create_lithophane(
    image_bytes: bytes,
    size: LampSize,
    output_dir: Path,
    stem: str,
    orientation: LithophaneOrientation = "Square",
) -> LithophaneResult:
    if size not in SIZE_CONFIG:
        raise ValueError(f"Unknown size: {size}")

    output_dir.mkdir(parents=True, exist_ok=True)
    image = _load_grayscale(image_bytes)
    width_mm, height_mm = _target_dimensions(SIZE_CONFIG[size], orientation)
    heightmap = _image_to_heightmap(image, width_mm, height_mm)
    mesh = _heightmap_to_mesh(heightmap, width_mm, height_mm)

    stl_path = output_dir / f"{stem}.stl"
    glb_path = output_dir / f"{stem}.glb"
    mesh.export(stl_path, file_type="stl")
    mesh.export(glb_path, file_type="glb")

    return LithophaneResult(
        stl_path=stl_path,
        glb_path=glb_path,
        metadata=LithophaneMetadata(
            width_mm=round(width_mm, 2),
            height_mm=round(height_mm, 2),
            min_thickness_mm=MIN_THICKNESS_MM,
            max_thickness_mm=MAX_THICKNESS_MM,
            vertices=len(mesh.vertices),
            faces=len(mesh.faces),
            is_watertight=bool(mesh.is_watertight),
        ),
    )


def _load_grayscale(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
        return image.convert("L")
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError("Could not read image") from exc


def _target_dimensions(selected_size_mm: float, orientation: LithophaneOrientation) -> tuple[float, float]:
    if orientation == "Portrait":
        return selected_size_mm * 9.0 / 16.0, selected_size_mm
    if orientation == "Landscape":
        return selected_size_mm, selected_size_mm * 9.0 / 16.0
    if orientation == "Square":
        return selected_size_mm, selected_size_mm
    raise ValueError(f"Unknown orientation: {orientation}")


def _image_to_heightmap(image: Image.Image, width_mm: float, height_mm: float) -> np.ndarray:
    width_px, height_px = image.size
    if width_px <= 0 or height_px <= 0:
        raise InvalidImageError("Image has no pixels")

    target_aspect = width_mm / height_mm
    image_aspect = width_px / height_px
    if image_aspect > target_aspect:
        crop_height = height_px
        crop_width = int(round(crop_height * target_aspect))
    else:
        crop_width = width_px
        crop_height = int(round(crop_width / target_aspect))

    left = (width_px - crop_width) // 2
    top = (height_px - crop_height) // 2
    cropped = image.crop((left, top, left + crop_width, top + crop_height))

    if width_mm >= height_mm:
        resized_width = MAX_PIXELS
        resized_height = max(2, int(round(MAX_PIXELS * height_mm / width_mm)))
    else:
        resized_height = MAX_PIXELS
        resized_width = max(2, int(round(MAX_PIXELS * width_mm / height_mm)))
    resized = cropped.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    pixels = np.flipud(np.asarray(resized, dtype=np.float32) / 255.0)
    low = float(pixels.min())
    high = float(pixels.max())
    if high > low:
        pixels = (pixels - low) / (high - low)
    else:
        pixels = np.full_like(pixels, 0.5)

    thickness = MIN_THICKNESS_MM + (1.0 - pixels) * (MAX_THICKNESS_MM - MIN_THICKNESS_MM)

    return thickness


def _heightmap_to_mesh(thickness: np.ndarray, width_mm: float, height_mm: float) -> trimesh.Trimesh:
    rows, cols = thickness.shape
    xs = np.linspace(-width_mm / 2.0, width_mm / 2.0, cols, dtype=np.float32)
    ys = np.linspace(-height_mm / 2.0, height_mm / 2.0, rows, dtype=np.float32)
    grid_x, grid_y = np.meshgrid(xs, ys)

    front_vertices = np.column_stack((grid_x.ravel(), grid_y.ravel(), thickness.ravel()))
    back_vertices = np.column_stack((grid_x.ravel(), grid_y.ravel(), np.zeros(rows * cols, dtype=np.float32)))
    vertices = np.vstack((front_vertices, back_vertices))

    front = np.arange(rows * cols, dtype=np.int64).reshape(rows, cols)
    back = front + rows * cols
    faces: list[list[int]] = []

    for row in range(rows - 1):
        for col in range(cols - 1):
            f00 = int(front[row, col])
            f01 = int(front[row, col + 1])
            f10 = int(front[row + 1, col])
            f11 = int(front[row + 1, col + 1])
            b00 = int(back[row, col])
            b01 = int(back[row, col + 1])
            b10 = int(back[row + 1, col])
            b11 = int(back[row + 1, col + 1])

            faces.append([f00, f10, f11])
            faces.append([f00, f11, f01])
            faces.append([b00, b11, b10])
            faces.append([b00, b01, b11])

    for col in range(cols - 1):
        _add_side(faces, int(front[0, col]), int(front[0, col + 1]), int(back[0, col + 1]), int(back[0, col]))
        _add_side(
            faces,
            int(front[rows - 1, col + 1]),
            int(front[rows - 1, col]),
            int(back[rows - 1, col]),
            int(back[rows - 1, col + 1]),
        )

    for row in range(rows - 1):
        _add_side(faces, int(front[row + 1, 0]), int(front[row, 0]), int(back[row, 0]), int(back[row + 1, 0]))
        _add_side(
            faces,
            int(front[row, cols - 1]),
            int(front[row + 1, cols - 1]),
            int(back[row + 1, cols - 1]),
            int(back[row, cols - 1]),
        )

    mesh = trimesh.Trimesh(vertices=vertices, faces=np.asarray(faces, dtype=np.int64), process=False)
    mesh.visual.vertex_colors = _vertex_colors(thickness)
    mesh.fix_normals()
    return mesh


def _add_side(faces: list[list[int]], a: int, b: int, c: int, d: int) -> None:
    faces.append([a, b, c])
    faces.append([a, c, d])


def _vertex_colors(thickness: np.ndarray) -> np.ndarray:
    brightness = 1.0 - ((thickness - MIN_THICKNESS_MM) / (MAX_THICKNESS_MM - MIN_THICKNESS_MM))
    brightness = np.clip(brightness, 0.0, 1.0).ravel()
    warm = np.column_stack(
        (
            90 + brightness * 165,
            82 + brightness * 158,
            64 + brightness * 135,
            np.full_like(brightness, 255),
        ),
    ).astype(np.uint8)
    return np.vstack((warm, warm))
