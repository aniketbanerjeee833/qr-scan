
import db from "../../config/db.js";
import QRCode from "qrcode";
import crypto from "crypto";

import {
  saveGeneratedFile,
  deleteUploadedFile,
} from "../../utils/uploadQr.js";

import getError from "../../utils/getError.js";

//const CLIENT_URL = "http://192.168.29.2:5173";
// const CLIENT_URL =
//   "https://5691-2405-201-8025-5070-d5b3-e77a-b736-9cf4.ngrok-free.app";
const CLIENT_URL ="https://94c8-115-187-48-18.ngrok-free.app";
// Temporary default police station
// Later, this will come from the authenticated user.
const DEFAULT_POLICE_STATION_ID = 1;

// Generate a unique QR token
const generateQRToken = () => {
  return `LOC-${crypto.randomBytes(16).toString("hex")}`;
};

// Generate QR PNG and save it
const generateAndSaveQR = async (qrCode) => {
  const scanUrl = `${CLIENT_URL}/qr/${qrCode}`;

  const qrBuffer = await QRCode.toBuffer(scanUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    width: 500,
    margin: 2,
  });

  const savedQR = await saveGeneratedFile({
    folder: "admin/location-qrs",
    fileName: `${qrCode}.png`,
    buffer: qrBuffer,
  });

  return {
    ...savedQR,
    scanUrl,
  };
};

// Validate latitude and longitude
const validateCoordinates = (latitude, longitude) => {
  if (
    latitude === undefined ||
    latitude === null ||
    latitude === "" ||
    longitude === undefined ||
    longitude === null ||
    longitude === ""
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

// Validate record ID
const isValidId = (id) => {
  return /^\d+$/.test(String(id)) && Number(id) > 0;
};

// Get police station ID
// Currently uses ID 1 as fallback.
// Later, authentication middleware should provide req.user.police_station_id.
const getPoliceStationId = (req) => {
  const stationId =
    req.user?.police_station_id ?? DEFAULT_POLICE_STATION_ID;

  return Number(stationId);
};

// ========================================
// CREATE LOCATION QR
// POST /api/admin/location-qrs
// ========================================

// export const createLocationQR = async (req, res) => {
//   let connection;
//   const savedQRs = [];

//   try {
//     const { locations } = req.body;

//     if (!Array.isArray(locations) || locations.length === 0) {
//       return getError(res, "At least one location is required", 400);
//     }

//     // Get police station ID
//     const policeStationId = getPoliceStationId(req);

//     if (!isValidId(policeStationId)) {
//       return getError(res, "Invalid police station ID", 400);
//     }

//     // Validate all coordinates before starting transaction
//     for (const location of locations) {
//       if (!validateCoordinates(location.latitude, location.longitude)) {
//         return getError(res, "Invalid latitude or longitude", 400);
//       }

//       if (
//         location.location_name !== undefined &&
//         location.location_name !== null &&
//         typeof location.location_name !== "string"
//       ) {
//         return getError(res, "Invalid location name", 400);
//       }
//     }

//     connection = await db.getConnection();
//     await connection.beginTransaction();

//     const createdLocations = [];

//     for (const location of locations) {
//       const { location_name, latitude, longitude } = location;

//       const lat = Number(latitude);
//       const lng = Number(longitude);

//       const cleanLocationName =
//         typeof location_name === "string"
//           ? location_name.trim() || null
//           : null;

//       const qrCode = generateQRToken();

//       // Generate and save QR image
//       const savedQR = await generateAndSaveQR(qrCode);

//       savedQRs.push(savedQR);

//       // Insert QR with police station relationship
//      const [result] = await connection.query(
//   `INSERT INTO location_qrs
//   (
//     police_station_id,
//     location_name,
//     qr_code,
//     qr_url,
//     latitude,
//     longitude,
//     qr_image,
//     is_active
//   )
//   VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
//   [
//     policeStationId,
//     cleanLocationName,
//     qrCode,
//     savedQR.scanUrl,
//     lat,
//     lng,
//     savedQR.filePath,
//   ]
// );

//       createdLocations.push({
//         id: result.insertId,
//         police_station_id: policeStationId,
//         location_name: cleanLocationName,
//         qr_code: qrCode,
//         scan_url: savedQR.scanUrl,
//         qr_image: savedQR.filePath,
//         latitude: lat,
//         longitude: lng,
//         is_active: 1,
//       });
//     }

//     await connection.commit();

//     return res.status(201).json({
//       success: true,
//       message: "Location QRs created successfully",
//       data: createdLocations,
//     });
//   } catch (error) {
//     if (connection) {
//       await connection.rollback();
//     }

//     // Delete generated images if database operation fails
//     for (const savedQR of savedQRs) {
//       if (savedQR?.filePath) {
//         await deleteUploadedFile(savedQR.filePath).catch(console.error);
//       }
//     }

//     console.error("Create location QR:", error);

//     if (error.code === "ER_DUP_ENTRY") {
//       return getError(res, "QR code already exists", 409);
//     }

//     if (error.code === "ER_NO_REFERENCED_ROW_2") {
//       return getError(res, "Police station does not exist", 400);
//     }

//     return getError(res, "Failed to create location QR", 500);
//   } finally {
//     if (connection) {
//       connection.release();
//     }
//   }
// };
export const createLocationQR = async (req, res) => {
  let connection;
  let transactionStarted = false;

  const savedQRs = [];

  try {
    const { police_station_id, locations } = req.body;

    // Validate police station ID
    if (!isValidId(police_station_id)) {
      return getError(res, "Please select a valid police station", 400);
    }

    const policeStationId = Number(police_station_id);

    // Validate locations array
    if (!Array.isArray(locations) || locations.length === 0) {
      return getError(res, "At least one location is required", 400);
    }

    // Validate all locations before starting the transaction
    for (const location of locations) {
      if (
        !validateCoordinates(
          location.latitude,
          location.longitude
        )
      ) {
        return getError(res, "Invalid latitude or longitude", 400);
      }

      if (
        location.location_name !== undefined &&
        location.location_name !== null &&
        typeof location.location_name !== "string"
      ) {
        return getError(res, "Invalid location name", 400);
      }
    }

    connection = await db.getConnection();

    // Verify that the selected police station exists and is active
    const [stations] = await connection.query(
      `SELECT id
       FROM police_stations
       WHERE id = ?
         AND is_active = 1
       LIMIT 1`,
      [policeStationId]
    );

    if (!stations.length) {
      return getError(
        res,
        "Police station does not exist or is inactive",
        400
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const createdLocations = [];

    for (const location of locations) {
      const {
        location_name,
        latitude,
        longitude,
      } = location;

      const lat = Number(latitude);
      const lng = Number(longitude);

      const cleanLocationName =
        typeof location_name === "string"
          ? location_name.trim() || null
          : null;

      const qrCode = generateQRToken();

      // Generate and save QR image
      const savedQR = await generateAndSaveQR(qrCode);

      savedQRs.push(savedQR);

      // Insert QR against the selected police station
      const [result] = await connection.query(
        `INSERT INTO location_qrs
        (
          police_station_id,
          location_name,
          qr_code,
          qr_url,
          latitude,
          longitude,
          qr_image,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          policeStationId,
          cleanLocationName,
          qrCode,
          savedQR.scanUrl,
          lat,
          lng,
          savedQR.filePath,
        ]
      );

      createdLocations.push({
        id: result.insertId,
        police_station_id: policeStationId,
        location_name: cleanLocationName,
        qr_code: qrCode,
        scan_url: savedQR.scanUrl,
        qr_image: savedQR.filePath,
        latitude: lat,
        longitude: lng,
        is_active: 1,
      });
    }

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Location QRs created successfully",
      data: createdLocations,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
      transactionStarted = false;
    }

    // Remove generated images if database operation fails
    for (const savedQR of savedQRs) {
      if (savedQR?.filePath) {
        await deleteUploadedFile(savedQR.filePath).catch(
          console.error
        );
      }
    }

    console.error("Create location QR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return getError(res, "QR code already exists", 409);
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return getError(res, "Police station does not exist", 400);
    }

    return getError(res, "Failed to create location QR", 500);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ========================================
// GET ALL LOCATION QRS - CURSOR PAGINATION
// GET /api/admin/location-qrs
// ========================================

export const getAllLocationQRs = async (req, res) => {
  try {
    let {
      cursor,
      limit = 10,
      search,
      is_active,
      station_id,
    } = req.query;

    limit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    if (
      cursor !== undefined &&
      (!/^\d+$/.test(String(cursor)) || Number(cursor) <= 0)
    ) {
      return getError(res, "Invalid cursor", 400);
    }

    if (
      station_id !== undefined &&
      station_id !== "" &&
      !isValidId(station_id)
    ) {
      return getError(res, "Invalid police station ID", 400);
    }

    const conditions = [];
    const values = [];

    if (cursor) {
      conditions.push("q.id < ?");
      values.push(Number(cursor));
    }

    if (station_id !== undefined && station_id !== "") {
      conditions.push("q.police_station_id = ?");
      values.push(Number(station_id));
    }

    if (search?.trim()) {
      conditions.push(
        "(q.location_name LIKE ? OR p.station_name LIKE ?)"
      );

      values.push(
        `%${search.trim()}%`,
        `%${search.trim()}%`
      );
    }

    if (is_active !== undefined && is_active !== "") {
      if (!["0", "1"].includes(String(is_active))) {
        return getError(res, "Invalid is_active value", 400);
      }

      conditions.push("q.is_active = ?");
      values.push(Number(is_active));
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await db.query(
      `SELECT
          q.id,
          q.police_station_id,
          p.station_name,
          q.location_name,
          q.qr_code,
          q.qr_image,
          q.qr_url,
          q.latitude,
          q.longitude,
          q.is_active,
          q.created_at
       FROM location_qrs q
       LEFT JOIN police_stations p
          ON p.id = q.police_station_id
       ${whereClause}
       ORDER BY q.id DESC
       LIMIT ?`,
      [...values, limit + 1]
    );

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);

    const nextCursor = hasMore
      ? String(data[data.length - 1].id)
      : null;

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Get all location QRs:", error);

    return getError(res, "Failed to fetch location QRs", 500);
  }
};
// ========================================
// UPDATE LOCATION DETAILS
// PUT /api/admin/location-qrs/:id
// ========================================

export const updateLocationQR = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;

    const {
      location_name,
      latitude,
      longitude,
      is_active,
      police_station_id,
    } = req.body;

    // Validate QR ID
    if (!isValidId(id)) {
      return getError(res, "Invalid location QR ID", 400);
    }

    // At least one field must be provided
    if (
      location_name === undefined &&
      latitude === undefined &&
      longitude === undefined &&
      is_active === undefined &&
      police_station_id === undefined
    ) {
      return getError(
        res,
        "At least one field is required to update",
        400
      );
    }

    // Validate police station ID when provided
    if (
      police_station_id !== undefined &&
      !isValidId(police_station_id)
    ) {
      return getError(res, "Invalid police station ID", 400);
    }

    // Validate location name
    if (
      location_name !== undefined &&
      location_name !== null &&
      typeof location_name !== "string"
    ) {
      return getError(res, "Invalid location name", 400);
    }

    // Latitude and longitude must be provided together
    if (
      (latitude !== undefined && longitude === undefined) ||
      (latitude === undefined && longitude !== undefined)
    ) {
      return getError(
        res,
        "Latitude and longitude must both be provided",
        400
      );
    }

    // Validate coordinates
    if (latitude !== undefined && longitude !== undefined) {
      if (!validateCoordinates(latitude, longitude)) {
        return getError(
          res,
          "Invalid latitude or longitude",
          400
        );
      }
    }

    // Validate active status
    if (
      is_active !== undefined &&
      ![0, 1, "0", "1"].includes(is_active)
    ) {
      return getError(res, "Invalid is_active value", 400);
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check whether QR exists
    const [existing] = await connection.query(
      `SELECT id, police_station_id
       FROM location_qrs
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!existing.length) {
      await connection.rollback();
      return getError(res, "Location QR not found", 404);
    }

    // Verify the new police station exists
    if (police_station_id !== undefined) {
      const [stations] = await connection.query(
        `SELECT id
         FROM police_stations
         WHERE id = ?
         LIMIT 1`,
        [Number(police_station_id)]
      );

      if (!stations.length) {
        await connection.rollback();
        return getError(res, "Police station does not exist", 400);
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (location_name !== undefined) {
      updates.push("location_name = ?");

      values.push(
        typeof location_name === "string"
          ? location_name.trim() || null
          : null
      );
    }

    if (latitude !== undefined && longitude !== undefined) {
      updates.push("latitude = ?", "longitude = ?");

      values.push(
        Number(latitude),
        Number(longitude)
      );
    }

    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(Number(is_active));
    }

    // Update police station assignment when provided
    if (police_station_id !== undefined) {
      updates.push("police_station_id = ?");
      values.push(Number(police_station_id));
    }

    values.push(id);

    await connection.query(
      `UPDATE location_qrs
       SET ${updates.join(", ")}
       WHERE id = ?`,
      values
    );

    // Fetch updated record including police station name
    const [updated] = await connection.query(
      `SELECT
          q.id,
          q.police_station_id,
          p.station_name,
          q.location_name,
          q.qr_code,
          q.qr_image,
          q.qr_url,
          q.latitude,
          q.longitude,
          q.is_active,
          q.created_at
       FROM location_qrs q
       LEFT JOIN police_stations p
          ON p.id = q.police_station_id
       WHERE q.id = ?`,
      [id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Location QR details updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Update location QR:", error);

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return getError(res, "Police station does not exist", 400);
    }

    return getError(
      res,
      "Failed to update location QR",
      500
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ========================================
// REGENERATE LOCATION QR
// POST /api/admin/location-qrs/:id/regenerate
// ========================================

export const regenerateLocationQR = async (req, res) => {
  let connection;
  let newQR;

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return getError(res, "Invalid location QR ID", 400);
    }

    connection = await db.getConnection();

    await connection.beginTransaction();

    // Get existing QR and its police station
    const [rows] = await connection.query(
      `SELECT
          id,
          police_station_id,
          location_name,
          qr_image
       FROM location_qrs
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return getError(res, "Location QR not found", 404);
    }

    const existingQR = rows[0];

    // Generate new token
    const newToken = generateQRToken();

    // Generate replacement QR image
    newQR = await generateAndSaveQR(newToken);

    // Update QR token and image.
    // police_station_id remains unchanged.
    await connection.query(
  `UPDATE location_qrs
   SET qr_code = ?,
       qr_url = ?,
       qr_image = ?
   WHERE id = ?`,
  [
    newToken,
    newQR.scanUrl,
    newQR.filePath,
    id,
  ]
);

    await connection.commit();

    // Delete old image only after successful DB commit
    if (existingQR.qr_image) {
      await deleteUploadedFile(existingQR.qr_image).catch((error) => {
        console.error("Could not delete old QR image:", error);
      });
    }

    return res.status(200).json({
      success: true,
      message: "QR code regenerated successfully. Print the new QR code.",
      data: {
        id: Number(id),
        police_station_id: existingQR.police_station_id,
        location_name: existingQR.location_name,
        qr_code: newToken,
        scan_url: newQR.scanUrl,
        qr_image: newQR.filePath,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    // Remove newly generated image if regeneration fails
    if (newQR?.filePath) {
      await deleteUploadedFile(newQR.filePath).catch(console.error);
    }

    console.error("Regenerate location QR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return getError(
        res,
        "Generated QR code already exists. Try again.",
        409
      );
    }

    return getError(res, "Failed to regenerate location QR", 500);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
// ========================================
// DELETE LOCATION QR
// DELETE /api/admin/location-qrs/:id
// ========================================

export const deleteLocationQR = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return getError(res, "Invalid location QR ID", 400);
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, qr_image
       FROM location_qrs
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();
      return getError(res, "Location QR not found", 404);
    }

    const qrImage = rows[0].qr_image;

    await connection.query(
      `DELETE FROM location_qrs WHERE id = ?`,
      [id]
    );

    await connection.commit();

    // Delete the image only after the database deletion succeeds.
    if (qrImage) {
      await deleteUploadedFile(qrImage).catch((error) => {
        console.error("Could not delete QR image:", error);
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location QR deleted successfully.",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Delete location QR:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return getError(
        res,
        "This QR cannot be deleted because related records exist.",
        409
      );
    }

    return getError(res, "Failed to delete location QR", 500);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};