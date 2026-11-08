from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

AVATAR_SIZE = 800          


def make_avatar(uploaded):
    """Turns an uploaded picture into a small square JPEG.
    It fixes phone photos that are rotated, crops to the centre, resizes,
    and drops hidden data such as GPS location."""
    uploaded.seek(0)
    image = Image.open(uploaded)
    image = ImageOps.exif_transpose(image)
    image = image.convert('RGB')                       # PNG with transparency -> white-safe JPEG
    image = ImageOps.fit(image, (AVATAR_SIZE, AVATAR_SIZE))
    buffer = BytesIO()
    image.save(buffer, format='JPEG', quality=88, optimize=True)
    return ContentFile(buffer.getvalue())