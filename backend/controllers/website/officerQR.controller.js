
import db from "../../config/db.js";
import sharp from "sharp";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import getError from "../../utils/getError.js";

const uploadDirectory = path.resolve(
  process.cwd(),
  "uploads",
  "officer-visits"
);

// QR token validation
const isValidQRToken = (qrCode) => {
  return /^LOC-[a-f0-9]{32}$/i.test(String(qrCode));
};

// Validate optional device coordinates
const validateDeviceCoordinates = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    latitude !== undefined &&
    longitude !== undefined &&
    latitude !== null &&
    longitude !== null &&
    latitude !== "" &&
    longitude !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

// ========================================
// GET SCANNED QR DETAILS
// GET /api/officer/qr/:qrCode
// ========================================

export const getScannedQRDetails = async (req, res) => {
  try {
    const { qrCode } = req.params;

    if (!isValidQRToken(qrCode)) {
      return getError(res, "Invalid QR code", 400);
    }

    const [rows] = await db.query(
      `SELECT
          q.id AS location_qr_id,
          q.qr_code,
          q.location_name,
          q.latitude AS qr_latitude,
          q.longitude AS qr_longitude,
          q.is_active,

          p.id AS police_station_id,
          p.station_name,
          p.district

       FROM location_qrs q

       INNER JOIN police_stations p
          ON p.id = q.police_station_id

       WHERE q.qr_code = ?
       LIMIT 1`,
      [qrCode]
    );

    if (!rows.length) {
      return getError(res, "QR code not found", 404);
    }

    const qr = rows[0];

    if (!qr.is_active) {
      return getError(res, "This QR code is inactive", 403);
    }

    return res.status(200).json({
      success: true,
      message: "QR details fetched successfully",

      data: {
        location_qr_id: qr.location_qr_id,
        qr_code: qr.qr_code,
        location_name: qr.location_name,

        qr_location: {
          latitude: qr.qr_latitude,
          longitude: qr.qr_longitude,
        },

        police_station: {
          id: qr.police_station_id,
          station_name: qr.station_name,
          district: qr.district,
        },
      },
    });
  } catch (error) {
    console.error("Get scanned QR details:", error);

    return getError(res, "Failed to fetch QR details", 500);
  }
};

// ========================================
// SUBMIT OFFICER VISIT
// POST /api/officer/qr/:qrCode/visit
// ========================================

export const submitOfficerVisit = async (req, res) => {
  let savedImagePath = null;

  try {
    const { qrCode } = req.params;
    const { latitude, longitude } = req.body;

    // 1. Validate QR token
    if (!isValidQRToken(qrCode)) {
      return getError(res, "Invalid QR code", 400);
    }

    // 2. Validate uploaded image
    if (!req.file || !req.file.buffer) {
      return getError(res, "Please capture a image first", 400);
    }

    // 3. Coordinates must be provided together
    const hasLatitude = latitude !== undefined && latitude !== "";
    const hasLongitude = longitude !== undefined && longitude !== "";

    if (hasLatitude !== hasLongitude) {
      return getError(
        res,
        "Latitude and longitude must be provided together",
        400
      );
    }

    let visitLatitude = null;
    let visitLongitude = null;

    if (hasLatitude && hasLongitude) {
      if (!validateDeviceCoordinates(latitude, longitude)) {
        return getError(res, "Invalid device coordinates", 400);
      }

      visitLatitude = Number(latitude);
      visitLongitude = Number(longitude);
    }

    // 4. Find QR and associated police station
    const [qrRows] = await db.query(
      `SELECT
          q.id AS location_qr_id,
          q.is_active,
          q.police_station_id,
          p.station_name,
          p.district

       FROM location_qrs q

       INNER JOIN police_stations p
          ON p.id = q.police_station_id

       WHERE q.qr_code = ?
       LIMIT 1`,
      [qrCode]
    );

    if (!qrRows.length) {
      return getError(res, "QR code not found", 404);
    }

    const qr = qrRows[0];

    if (!qr.is_active) {
      return getError(res, "This QR code is inactive", 403);
    }

    // 5. Ensure upload directory exists
    await fs.mkdir(uploadDirectory, { recursive: true });

    // 6. Generate unique image filename
    const fileName = `${crypto.randomUUID()}.jpg`;

    savedImagePath = path.join(uploadDirectory, fileName);

    // 7. Compress image using Sharp
    try {
      await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 75,
          mozjpeg: true,
        })
        .toFile(savedImagePath);
    } catch (imageError) {
      console.error("Image processing error:", imageError);

      // Remove partially created image, if any
      await fs.unlink(savedImagePath).catch(() => {});
      savedImagePath = null;

      return getError(res, "Invalid or corrupted image", 400);
    }

    // 8. Relative image path for database
    const imagePath = `/uploads/officer-visits/${fileName}`;

    // 9. Save visit details
    const [result] = await db.query(
      `INSERT INTO officer_qr_visits
      (
        location_qr_id,
        police_station_id,
        selfie_image,
        latitude,
        longitude,
        visited_at
      )
      VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        qr.location_qr_id,
        qr.police_station_id,
        imagePath,
        visitLatitude,
        visitLongitude,
      ]
    );

    // 10. Send response
    return res.status(201).json({
      success: true,
      message: "Visit submitted successfully",

      data: {
        id: result.insertId,
        location_qr_id: qr.location_qr_id,
        police_station_id: qr.police_station_id,

        station_name: qr.station_name,
        district: qr.district,

        selfie_image: imagePath,
        latitude: visitLatitude,
        longitude: visitLongitude,
        visited_at: new Date(),
      },
    });
  } catch (error) {
    // Remove saved image if database insertion or another step fails
    if (savedImagePath) {
      await fs.unlink(savedImagePath).catch(() => {});
    }

    console.error("Submit officer visit:", error);

    return getError(res, "Failed to submit officer visit", 500);
  }
};
