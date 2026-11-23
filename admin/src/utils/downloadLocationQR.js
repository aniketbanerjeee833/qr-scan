// =====================================
// COLORS
// Police blue palette (replaces the earlier violet shades).
// To match the logo exactly, eyedrop the dark blue and light blue
// from the logo and paste the hex values into primary / light.
// =====================================

const COLORS = {
  primary: "#1F3F7A",   // dark police blue (borders, text, icon)
  secondary: "#3D5FA3", // mid blue
  light: "#BFCDE6",     // light blue (QR inner border)
  lighter: "#E3EAF5",   // very light blue (plaque inner border)
  red: "#B45C68",
  white: "#FFFFFF",
  qr: "#111111",
};

// =====================================
// PAGE SIZE (HALF OF A4)
// =====================================

const BASE_W = 1600;
const BASE_H = 1131; // 1600 / 1.4142 (A-series ratio)
const SCALE = 1.55;  // 1600 * 1.55 = 2480 px = 210 mm at 300 DPI

// =====================================
// LOAD IMAGE
// =====================================

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () =>
      reject(new Error(`Failed to load image: ${src}`));

    image.src = src;
  });

// =====================================
// FETCH QR IMAGE
// =====================================

const fetchImageAsObjectURL = async (url) => {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch QR image.");
  }

  return URL.createObjectURL(await response.blob());
};

// =====================================
// LUCIDE-STYLE QR CODE ICON
// =====================================

const createQrIconSvg = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="100"
      height="100"
      viewBox="0 0 24 24"
      fill="none"
      stroke="${COLORS.primary}"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round">

      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>

      <path d="M14 14h3v3h-3z"/>
      <path d="M21 14v3"/>
      <path d="M14 21h3"/>
      <path d="M21 21h-3v-3"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// =====================================
// DRAW CENTERED TEXT
// =====================================

const drawCenteredText = (
  ctx,
  text,
  x,
  y,
  maxWidth,
  fontSize,
  color,
  weight = "bold"
) => {
  ctx.save();

  let size = fontSize;
  ctx.font = `${weight} ${size}px Arial`;

  while (
    ctx.measureText(text).width > maxWidth &&
    size > 20
  ) {
    size -= 2;
    ctx.font = `${weight} ${size}px Arial`;
  }

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(text, x, y);

  ctx.restore();
};

// =====================================
// DRAW TEXT WITH TEXT-WIDTH UNDERLINE
// =====================================

const drawTextWithUnderline = (
  ctx,
  text,
  x,
  y,
  maxWidth,
  fontSize,
  color,
  weight = "bold"
) => {
  ctx.save();

  let size = fontSize;
  ctx.font = `${weight} ${size}px Arial`;

  while (
    ctx.measureText(text).width > maxWidth &&
    size > 20
  ) {
    size -= 2;
    ctx.font = `${weight} ${size}px Arial`;
  }

  const textWidth = ctx.measureText(text).width;

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(text, x, y);

  // Underline only the actual text width
  const underlineY = y + size * 0.65;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x - textWidth / 2, underlineY);
  ctx.lineTo(x + textWidth / 2, underlineY);
  ctx.stroke();

  ctx.restore();
};

// =====================================
// DRAW IMAGE CONTAIN
// =====================================

const drawImageContain = (
  ctx,
  image,
  x,
  y,
  maxWidth,
  maxHeight
) => {
  const ratio = Math.min(
    maxWidth / image.naturalWidth,
    maxHeight / image.naturalHeight
  );

  const width = image.naturalWidth * ratio;
  const height = image.naturalHeight * ratio;

  ctx.drawImage(
    image,
    x + (maxWidth - width) / 2,
    y + (maxHeight - height) / 2,
    width,
    height
  );
};

// =====================================
// DRAW PLAQUE BORDER
// =====================================

const drawPlaqueBorders = (ctx, W, H) => {
  // Outer border - dark blue
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 5;

  ctx.strokeRect(
    25,
    25,
    W - 50,
    H - 50
  );

  // Inner border - very light blue
  ctx.strokeStyle = COLORS.lighter;
  ctx.lineWidth = 2;

  ctx.strokeRect(
    42,
    42,
    W - 84,
    H - 84
  );
};

// =====================================
// DRAW QR IMAGE BORDER
// =====================================

const drawQRBorder = (ctx, qrX, qrY, qrSize) => {
  // Inner border - light blue
  ctx.strokeStyle = COLORS.light;
  ctx.lineWidth = 4;

  ctx.strokeRect(
    qrX - 18,
    qrY - 18,
    qrSize + 36,
    qrSize + 36
  );

  // Outer border - dark blue
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 5;

  ctx.strokeRect(
    qrX - 31,
    qrY - 31,
    qrSize + 62,
    qrSize + 62
  );
};

// =====================================
// MAIN DOWNLOAD FUNCTION
// =====================================

export const downloadLocationQR = async ({
  logoUrl = "/assets/images/kolkata-police-logo.jpg",
  qrImageUrl,
  locationName,
  stationName,
  website = "www.bidhannagarcitypolice.gov.in",
  phone = "Control Room: 033-23358788/033-23410465",
  fileName = "Location-QR.png",
}) => {
  if (!qrImageUrl) {
    throw new Error("QR image is not available.");
  }

  let qrObjectUrl;
  let downloadUrl;

  try {
    // =====================================
    // LOAD ALL IMAGES
    // =====================================

    const [logo, qrImage, qrIcon] = await Promise.all([
      loadImage(logoUrl),

      (async () => {
        qrObjectUrl = await fetchImageAsObjectURL(qrImageUrl);
        return loadImage(qrObjectUrl);
      })(),

      loadImage(createQrIconSvg()),
    ]);

    // =====================================
    // CREATE CANVAS
    // =====================================

    const canvas = document.createElement("canvas");

    // Half of A4 = 210 mm x 148.5 mm (landscape), ratio 1.414:1.
    // Output is 2480 x 1753 px, which is 300 DPI at that size.
    // The layout below is drawn on a 1600 x 1131 grid and scaled up.
    canvas.width = Math.round(BASE_W * SCALE);
    canvas.height = Math.round(BASE_H * SCALE);

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Unable to create canvas.");
    }

    ctx.scale(SCALE, SCALE);

    const W = BASE_W;
    const H = BASE_H;

    // =====================================
    // BACKGROUND
    // =====================================

    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, W, H);

    drawPlaqueBorders(ctx, W, H);

    // =====================================
    // HEADER
    // =====================================

    // QR-SCAN heading - top centre
    drawCenteredText(
      ctx,
      "QR-SCAN",
      W / 2,
      110,
      600,
      58,
      COLORS.red
    );

    // QR icon - top left
    drawImageContain(
      ctx,
      qrIcon,
      105,
      55,
      85,
      85
    );

    // QR SCAN label below icon
    ctx.save();

    ctx.fillStyle = COLORS.red;
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "QR SCAN",
      147,
      165
    );

    ctx.restore();

    // Kolkata Police logo - top right
    drawImageContain(
      ctx,
      logo,
      1300,
      55,
      210,
      180
    );

    // =====================================
    // QR CODE
    // =====================================

    const qrSize = 410;

    const qrX = (W - qrSize) / 2;
    const qrY = 245;

    // Draw QR borders
    drawQRBorder(
      ctx,
      qrX,
      qrY,
      qrSize
    );

    // White background behind QR
    ctx.fillStyle = COLORS.white;

    ctx.fillRect(
      qrX,
      qrY,
      qrSize,
      qrSize
    );

    // Draw QR image without smoothing
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      qrImage,
      qrX,
      qrY,
      qrSize,
      qrSize
    );

    ctx.imageSmoothingEnabled = true;

    // =====================================
    // LOCATION NAME
    // =====================================

    if (locationName?.trim()) {
      drawTextWithUnderline(
        ctx,
        locationName.trim().toUpperCase(),
        W / 2,
        765,
        1250,
        48,
        COLORS.primary
      );
    }

    // =====================================
    // POLICE STATION NAME
    // =====================================

    if (stationName?.trim()) {
      drawTextWithUnderline(
        ctx,
        stationName.trim().toUpperCase(),
        W / 2,
        865,
        1350,
        57,
        COLORS.primary
      );
    }

    // =====================================
    // FOOTER
    // =====================================

    ctx.fillStyle = COLORS.primary;
    ctx.textBaseline = "middle";

    // Website - bottom left
    ctx.font = "bold 30px Georgia";
    ctx.textAlign = "left";

    ctx.fillText(
      website,
      85,
      1040
    );

    // Control room - bottom right
    ctx.font = "bold 25px Georgia";
    ctx.textAlign = "right";

    ctx.fillText(
      phone,
      1510,
      1040
    );

    // =====================================
    // GENERATE PNG
    // =====================================

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Failed to generate PNG."));
          }
        },
        "image/png"
      );
    });

    // =====================================
    // DOWNLOAD
    // =====================================

    downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

  } finally {
    if (qrObjectUrl) {
      URL.revokeObjectURL(qrObjectUrl);
    }

    if (downloadUrl) {
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 2000);
    }
  }
};
