"""Generate PWA icons (standard + maskable) for 打卡工作台."""
from PIL import Image, ImageDraw

SIZE = 512
BLUE = (59, 130, 246)        # #3B82F6
BLUE_DARK = (37, 99, 235)
WHITE = (255, 255, 255)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_check(draw, cx, cy, scale, color, width):
    # A simple thick checkmark centered at (cx, cy)
    s = scale  # half-size
    # Left arm
    p1 = (cx - s * 0.55, cy + s * 0.05)
    p2 = (cx - s * 0.10, cy + s * 0.55)
    p3 = (cx + s * 0.62, cy - s * 0.55)
    draw.line([p1, p2], fill=color, width=width, joint="curve")
    draw.line([p2, p3], fill=color, width=width, joint="curve")
    # round the joints/caps
    for p in (p1, p2, p3):
        draw.ellipse([p[0] - width / 2, p[1] - width / 2,
                      p[0] + width / 2, p[1] + width / 2], fill=color)


def make_standard():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # subtle gradient feel via two stacked rounded rects
    rounded_rect(d, [0, 0, SIZE, SIZE], 112, BLUE)
    rounded_rect(d, [0, 24, SIZE, SIZE], 112, BLUE_DARK)
    draw_check(d, SIZE / 2, SIZE / 2 - 6, 150, WHITE, 46)
    img.save("public/icon-512.png")


def make_maskable():
    # full-bleed (no transparency) for safe-zone masking on Android
    img = Image.new("RGBA", (SIZE, SIZE), BLUE)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, SIZE, SIZE], fill=BLUE)
    # check kept within central 80% safe zone
    draw_check(d, SIZE / 2, SIZE / 2, 120, WHITE, 38)
    img.save("public/icon-maskable-512.png")


def make_apple():
    # apple-touch-icon: no transparency, 180px
    img = Image.new("RGBA", (180, 180), BLUE)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 180, 180], fill=BLUE)
    draw_check(d, 90, 88, 52, WHITE, 16)
    img.save("public/apple-touch-icon.png")


if __name__ == "__main__":
    make_standard()
    make_maskable()
    make_apple()
    print("icons generated")
