
import db from "../../config/db.js";
import getError from "../../utils/getError.js";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
import { addSheet, sendWorkbook, toDateKey, toDateLabel, toTimeLabel } from "../../utils/excelReportFunctions.js";
// ========================================
// HELPERS
// ========================================

const isValidId = (id) => {
  return /^\d+$/.test(String(id)) && Number(id) > 0;
};

const getLimit = (limit) => {
  return Math.min(Math.max(Number(limit) || 10, 1), 100);
};

const getCursorId = (cursor) => {
  if (cursor === undefined || cursor === null || cursor === "") {
    return null;
  }

  if (!isValidId(cursor)) {
    return false;
  }

  return Number(cursor);
};

// ========================================
// CREATE POLICE STATION
// POST /api/admin/police-stations
// ========================================

export const createPoliceStation = async (req, res) => {
  try {
    const { station_name, district } = req.body;

    if (
      !station_name ||
      typeof station_name !== "string" ||
      !station_name.trim()
    ) {
      return getError(res, "Police station name is required", 400);
    }

    // if (
    //   district !== undefined &&
    //   district !== null &&
    //   typeof district !== "string"
    // ) {
    //   return getError(res, "Invalid district", 400);
    // }

    const [existing] = await db.query(
      `SELECT id FROM police_stations WHERE station_name = ? LIMIT 1`,
      [station_name.trim()]
    );

    if (existing.length) {
      return getError(res, "Police station already exists", 409);
    }

    const [result] = await db.query(
      `INSERT INTO police_stations
        (station_name, district, is_active)
       VALUES (?, ?, 1)`,
      [
        station_name.trim(),
        typeof district === "string" ? district.trim() || null : null,
      ]
    );

    const [created] = await db.query(
      `SELECT id, station_name, district, is_active, created_at, updated_at
       FROM police_stations
       WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Police station created successfully",
      data: created[0],
    });
  } catch (error) {
    console.error("Create police station:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return getError(res, "Police station already exists", 409);
    }

    return getError(res, "Failed to create police station", 500);
  }
};

// ========================================
// GET ALL POLICE STATIONS - CURSOR PAGINATION
// GET /api/admin/police-stations
// ========================================

export const getPoliceStations = async (req, res) => {
  try {
    const { cursor, search, is_active } = req.query;

    const limit = getLimit(req.query.limit);
    const cursorId = getCursorId(cursor);

    if (cursorId === false) {
      return getError(res, "Invalid cursor", 400);
    }

    const conditions = [];
    const values = [];

    if (cursorId) {
      conditions.push("ps.id < ?");
      values.push(cursorId);
    }

const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");

if (search?.trim()) {
  const term = `%${escapeLike(search.trim())}%`;

  conditions.push(
    "(ps.station_name LIKE ? OR ps.district LIKE ?)"
  );

  values.push(term, term);
}

    if (is_active !== undefined && is_active !== "") {
      if (!["0", "1"].includes(String(is_active))) {
        return getError(res, "Invalid is_active value", 400);
      }

      conditions.push("ps.is_active = ?");
      values.push(Number(is_active));
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await db.query(
      `SELECT
          ps.id,
          ps.station_name,
          ps.district,
          ps.is_active,
          ps.created_at,
          ps.updated_at,
          (
            SELECT COUNT(*)
            FROM police_station_officers e
            WHERE e.police_station_id = ps.id
          ) AS employee_count
       FROM police_stations ps
       ${whereClause}
       ORDER BY ps.id DESC
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
    console.error("Get police stations:", error);

    return getError(res, "Failed to fetch police stations", 500);
  }
};
export const getPoliceStationOptions = async (req, res) => {
  try {
    const [stations] = await db.query(`
      SELECT
        id,
        station_name,
        district
      FROM police_stations
      WHERE is_active = 1
      ORDER BY station_name ASC
    `);

    return res.status(200).json({
      success: true,
      data: stations,
    });
  } catch (error) {
    console.error("Get police station options:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch police station options.",
    });
  }
};
// ========================================
// GET POLICE STATION BY ID
// GET /api/admin/police-stations/:id
// ========================================

export const getPoliceStationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return getError(res, "Invalid police station ID", 400);
    }

    const [rows] = await db.query(
      `SELECT
          ps.id,
          ps.station_name,
          ps.district,
          ps.is_active,
          ps.created_at,
          ps.updated_at,
          (
            SELECT COUNT(*)
            FROM police_station_officers e
            WHERE e.police_station_id = ps.id
          ) AS employee_count
       FROM police_stations ps
       WHERE ps.id = ?`,
      [id]
    );

    if (!rows.length) {
      return getError(res, "Police station not found", 404);
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get police station:", error);

    return getError(res, "Failed to fetch police station", 500);
  }
};

// ========================================
// UPDATE POLICE STATION
// PUT /api/admin/police-stations/:id
// ========================================

export const updatePoliceStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { station_name, district } = req.body;

    if (!isValidId(id)) {
      return getError(res, "Invalid police station ID", 400);
    }

    if (
      station_name === undefined &&
      district === undefined
    ) {
      return getError(res, "At least one field is required", 400);
    }

    if (
      station_name !== undefined &&
      (typeof station_name !== "string" || !station_name.trim())
    ) {
      return getError(res, "Invalid police station name", 400);
    }

    // if (
    //   district !== undefined &&
    //   district !== null &&
    //   typeof district !== "string"
    // ) {
    //   return getError(res, "Invalid district", 400);
    // }

    const [existing] = await db.query(
      `SELECT id FROM police_stations WHERE id = ?`,
      [id]
    );

    if (!existing.length) {
      return getError(res, "Police station not found", 404);
    }

    if (station_name !== undefined) {
      const [duplicate] = await db.query(
        `SELECT id
         FROM police_stations
         WHERE station_name = ? AND id != ?
         LIMIT 1`,
        [station_name.trim(), id]
      );

      if (duplicate.length) {
        return getError(res, "Police station name already exists", 409);
      }
    }

    const updates = [];
    const values = [];

    if (station_name !== undefined) {
      updates.push("station_name = ?");
      values.push(station_name.trim());
    }

    if (district !== undefined) {
      updates.push("district = ?");
      values.push(
        typeof district === "string" ? district.trim() || null : null
      );
    }

    values.push(id);

    await db.query(
      `UPDATE police_stations
       SET ${updates.join(", ")}
       WHERE id = ?`,
      values
    );

    const [updated] = await db.query(
      `SELECT id, station_name, district, is_active, created_at, updated_at
       FROM police_stations
       WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Police station updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Update police station:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return getError(res, "Police station name already exists", 409);
    }

    return getError(res, "Failed to update police station", 500);
  }
};

// ========================================
// UPDATE POLICE STATION STATUS
// PATCH /api/admin/police-stations/:id/status
// ========================================

export const updatePoliceStationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!isValidId(id)) {
      return getError(res, "Invalid police station ID", 400);
    }

    if (![0, 1, "0", "1"].includes(is_active)) {
      return getError(res, "Invalid is_active value", 400);
    }

    const [existing] = await db.query(
      `SELECT id FROM police_stations WHERE id = ?`,
      [id]
    );

    if (!existing.length) {
      return getError(res, "Police station not found", 404);
    }

    await db.query(
      `UPDATE police_stations
       SET is_active = ?
       WHERE id = ?`,
      [Number(is_active), id]
    );

    return res.status(200).json({
      success: true,
      message: "Police station status updated successfully",
      data: {
        id: Number(id),
        is_active: Number(is_active),
      },
    });
  } catch (error) {
    console.error("Update police station status:", error);

    return getError(res, "Failed to update police station status", 500);
  }
};

// ========================================
// DELETE POLICE STATION
// DELETE /api/admin/police-stations/:id
// ========================================

export const deletePoliceStation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return getError(res, "Invalid police station ID", 400);
    }

    const [existing] = await db.query(
      `SELECT id FROM police_stations WHERE id = ?`,
      [id]
    );

    if (!existing.length) {
      return getError(res, "Police station not found", 404);
    }

    const [police_station_officers] = await db.query(
      `SELECT id
       FROM police_station_officers
       WHERE police_station_id = ?
       LIMIT 1`,
      [id]
    );

    if (police_station_officers.length) {
      return getError(
        res,
        "Cannot delete police station because police_station_officers are assigned to it",
        409
      );
    }

    const [qrs] = await db.query(
      `SELECT id
       FROM location_qrs
       WHERE police_station_id = ?
       LIMIT 1`,
      [id]
    );

    if (qrs.length) {
      return getError(
        res,
        "Cannot delete police station because location QRs are assigned to it",
        409
      );
    }

    await db.query(
      `DELETE FROM police_stations WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Police station deleted successfully",
    });
  } catch (error) {
    console.error("Delete police station:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return getError(
        res,
        "Cannot delete police station because related records exist",
        409
      );
    }

    return getError(res, "Failed to delete police station", 500);
  }
};

// ========================================
// CREATE EMPLOYEE UNDER POLICE STATION
// POST /api/admin/police-stations/:stationId/police_station_officers
// ========================================

export const createStationOfficer = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { name, phone_number } = req.body;

    if (!isValidId(stationId)) {
      return getError(res, "Invalid police station ID", 400);
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return getError(res, "Officer name is required", 400);
    }

    // if (
    //   !phone_number ||
    //   typeof phone_number !== "string" ||
    //   !phone_number.trim()
    // ) {
    //   return getError(res, "Phone number is required", 400);
    // }

    const [station] = await db.query(
      `SELECT id, is_active
       FROM police_stations
       WHERE id = ?`,
      [stationId]
    );

    if (!station.length) {
      return getError(res, "Police station not found", 404);
    }

    if (Number(station[0].is_active) !== 1) {
      return getError(res, "Police station is inactive", 400);
    }

    const [result] = await db.query(
      `INSERT INTO police_station_officers
        (name, phone_number, police_station_id)
       VALUES (?, ?, ?)`,
      [
        name.trim(),
        phone_number.trim(),
        stationId,
      ]
    );

    const [created] = await db.query(
      `SELECT id, name, phone_number, police_station_id
       FROM police_station_officers
       WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Officer created successfully",
      data: created[0],
    });
  } catch (error) {
    console.error("Create station officer:", error);

    return getError(res, "Failed to create officer", 500);
  }
};

// ========================================
// 2. GET OFFICERS BY POLICE STATION
// GET /api/admin/police-stations/:stationId/officers
// Supports cursor pagination and search
// ========================================


export const getStationOfficers = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { cursor, search, from, to } = req.query;

    const limit = getLimit(req.query.limit);
    const cursorId = getCursorId(cursor);

    if (!isValidId(stationId)) {
      return getError(res, "Invalid police station ID", 400);
    }

    if (cursorId === false) {
      return getError(res, "Invalid cursor", 400);
    }

    const [station] = await db.query(
      `SELECT id FROM police_stations WHERE id = ?`,
      [stationId]
    );

    if (!station.length) {
      return getError(res, "Police station not found", 404);
    }

    // Validate date range when supplied
    let range = null;

    if (from || to) {
      range = parseRange({ from, to });

      if (range.error) {
        return getError(res, range.error, 400);
      }
    }

    const conditions = ["o.police_station_id = ?"];
    const values = [stationId];

    // Only officers who have visits in the selected date range
    if (range) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM ${VISIT_TABLE} v
          WHERE v.${VISIT_OFFICER_COL} = o.id
            AND v.${VISIT_TIME_COL} BETWEEN ? AND ?
        )
      `);

      values.push(range.start, range.end);
    }

    if (cursorId) {
      conditions.push("o.id < ?");
      values.push(cursorId);
    }

    if (search?.trim()) {
      conditions.push(
        "(o.name LIKE ? OR o.phone_number LIKE ?)"
      );

      values.push(
        `%${search.trim()}%`,
        `%${search.trim()}%`
      );
    }

    const [rows] = await db.query(
      `SELECT
          o.id,
          o.name,
          o.phone_number,
          o.police_station_id
       FROM police_station_officers o
       WHERE ${conditions.join(" AND ")}
       ORDER BY o.id DESC
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
    console.error("Get station officers:", error);

    return getError(res, "Failed to fetch officers", 500);
  }
};


// ========================================
// 3. UPDATE OFFICER
// PUT /api/admin/police-stations/:stationId/officers/:officerId
// ========================================

export const updateStationOfficer = async (req, res) => {
  try {
    const { stationId, officerId } = req.params;
    const { name, phone_number } = req.body;

    if (!isValidId(stationId) || !isValidId(officerId)) {
      return getError(res, "Invalid station or officer ID", 400);
    }

    if (name === undefined && phone_number === undefined) {
      return getError(res, "At least one field is required", 400);
    }

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return getError(res, "Invalid officer name", 400);
    }

    if (
     
      (typeof phone_number !== "string")
    ) {
      return getError(res, "Invalid phone number", 400);
    }

    const [existing] = await db.query(
      `SELECT id
       FROM police_station_officers
       WHERE id = ? AND police_station_id = ?`,
      [officerId, stationId]
    );

    if (!existing.length) {
      return getError(res, "Officer not found in this police station", 404);
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name.trim());
    }

    if (phone_number !== undefined) {
      updates.push("phone_number = ?");
      values.push(phone_number.trim());
    }

    values.push(officerId, stationId);

    await db.query(
      `UPDATE police_station_officers
       SET ${updates.join(", ")}
       WHERE id = ? AND police_station_id = ?`,
      values
    );

    const [updated] = await db.query(
      `SELECT id, name, phone_number, police_station_id
       FROM police_station_officers
       WHERE id = ? AND police_station_id = ?`,
      [officerId, stationId]
    );

    return res.status(200).json({
      success: true,
      message: "Officer updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Update station officer:", error);

    return getError(res, "Failed to update officer", 500);
  }
};

// ========================================
// 4. DELETE OFFICER
// DELETE /api/admin/police-stations/:stationId/officers/:officerId
// ========================================

const uploadDirectory = path.resolve(
  process.cwd(),
  "uploads",
  "officer-visits"
);

export const deleteStationOfficer = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { stationId, officerId } = req.params;

    if (!isValidId(stationId) || !isValidId(officerId)) {
      return getError(res, "Invalid station or officer ID", 400);
    }

    await connection.beginTransaction();

    // 1. Verify officer belongs to this police station
    const [officers] = await connection.query(
      `SELECT id, name
       FROM police_station_officers
       WHERE id = ?
         AND police_station_id = ?
       LIMIT 1`,
      [officerId, stationId]
    );

    if (!officers.length) {
      await connection.rollback();

      return getError(
        res,
        "Officer not found in this police station",
        404
      );
    }

    // 2. Get all visit image paths belonging to this officer
    const [visits] = await connection.query(
      `SELECT id, image
       FROM officer_visits
       WHERE officer_id = ?`,
      [officerId]
    );

    // 3. Delete officer visit records
    await connection.query(
      `DELETE FROM officer_visits
       WHERE officer_id = ?`,
      [officerId]
    );

    // 4. Delete officer
    await connection.query(
      `DELETE FROM police_station_officers
       WHERE id = ?
         AND police_station_id = ?`,
      [officerId, stationId]
    );

    // 5. Commit database transaction
    await connection.commit();

    // 6. Delete physical visit images
    // const uploadDirectory = uploadDirectory;

    const imageDeletionResults = await Promise.allSettled(
      visits.map(async (visit) => {
        if (!visit.image) return;

        // Normalize database image path
        const normalizedImage = visit.image.replace(/\\/g, "/");

        const prefix = "/uploads/officer-visits/";

        // Validate image path
        if (!normalizedImage.startsWith(prefix)) {
          throw new Error(
            `Invalid officer visit image path: ${visit.image}`
          );
        }

        // Extract date-wise relative path
        const relativePath = normalizedImage.slice(prefix.length);

        // Resolve absolute image path
        const absolutePath = path.resolve(
          uploadDirectory,
          relativePath
        );

        // Prevent directory traversal
        if (
          absolutePath === uploadDirectory ||
          !absolutePath.startsWith(uploadDirectory + path.sep)
        ) {
          throw new Error("Image path is outside upload directory");
        }

        // Delete image
        await fs.unlink(absolutePath).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        });
      })
    );

    // 7. Count failed image deletions
    const failedImageDeletions = imageDeletionResults.filter(
      (result) => result.status === "rejected"
    );

    const deletedImages =
      imageDeletionResults.length - failedImageDeletions.length;

    if (failedImageDeletions.length) {
      console.error(
        "Some officer visit images could not be deleted:",
        failedImageDeletions.map((result) => result.reason)
      );
    }

    // 8. Send response
    return res.status(200).json({
      success: true,
      message: "Officer and visit history deleted successfully",
      data: {
        deleted_visits: visits.length,
        deleted_images: deletedImages,
        failed_image_deletions: failedImageDeletions.length,
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Delete station officer:", error);

    return getError(res, "Failed to delete officer", 500);
  } finally {
    connection.release();
  }
};





/* ==========================================================
   SCHEMA CONFIG: change these if your table/column names differ
========================================================== */
const VISIT_TABLE = "officer_visits";
const VISIT_OFFICER_COL = "officer_id";
const VISIT_QR_COL = "location_qr_id";
const VISIT_TIME_COL = "created_at";
const QR_TABLE = "location_qrs";
const QR_NAME_COL = "location_name";

const TZ = "Asia/Kolkata";
const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ==========================================================
   HELPERS
========================================================== */

// const isValidId = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;

// "2026-11-20" (in IST)

const toDayName = (key) =>
  new Date(`${key}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: TZ,
    weekday: "long",
  });



const safeFileName = (value) =>
  String(value || "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "") || "report";

// Defaults to the current month (IST) when from/to are omitted.
const parseRange = (query) => {
  const today = toDateKey(new Date());
  const from = query.from || `${today.slice(0, 8)}01`;
  const to = query.to || today;

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return { error: "Dates must be in YYYY-MM-DD format" };
  }

  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T23:59:59.999+05:30`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: "Invalid date" };
  }

  if (start > end) {
    return { error: "From date cannot be after To date" };
  }

  if ((end - start) / 86400000 > MAX_RANGE_DAYS) {
    return { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` };
  }

  return { from, to, start, end };
};

// Groups visits (sorted by time) into [{ key, list }] per IST day.
const groupByDay = (visits) => {
  const map = new Map();

  for (const visit of visits) {
    const key = toDateKey(visit.visited_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(visit);
  }

  return [...map.entries()].map(([key, list]) => ({ key, list }));
};

const uniqueLocations = (list) =>
  [...new Set(list.map((v) => v.location_name).filter(Boolean))].join(", ");
const getOptionalReportRange = (query) => {
  const { from, to } = query;

  const isValidDate = (value) => {
    if (!value) return true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  };

  if (!isValidDate(from) || !isValidDate(to)) {
    return { error: "Invalid date format. Use YYYY-MM-DD." };
  }

  if (from && to && from > to) {
    return { error: "From date cannot be after To date." };
  }

  return {
    from: from || null,
    to: to || null,
    start: from ? `${from} 00:00:00` : null,
    end: to ? `${to} 23:59:59` : null,
  };
};

export const getOfficerVisitReport = async (req, res) => {
  try {
    const { stationId, officerId } = req.params;
    const { from, to } = req.query;

    // 1. Validate IDs
    if (!isValidId(stationId) || !isValidId(officerId)) {
      return getError(res, "Invalid station or officer ID", 400);
    }

    // 2. Validate date range
    if (from && isNaN(Date.parse(from))) {
      return getError(res, "Invalid from date", 400);
    }

    if (to && isNaN(Date.parse(to))) {
      return getError(res, "Invalid to date", 400);
    }

    if (from && to && new Date(from) > new Date(to)) {
      return getError(res, "From date cannot be greater than to date", 400);
    }

    // 3. Find officer belonging to the station
    const [officerRows] = await db.query(
      `SELECT
          o.id,
          o.name,
          o.phone_number,
          ps.station_name
       FROM police_station_officers o
       INNER JOIN police_stations ps
          ON ps.id = o.police_station_id
       WHERE o.id = ?
         AND o.police_station_id = ?
       LIMIT 1`,
      [officerId, stationId]
    );

    if (!officerRows.length) {
      return getError(res, "Officer not found in this police station", 404);
    }

    const officer = officerRows[0];

    // 4. Build date conditions
    let dateCondition = "";
    const params = [officerId];

    if (from) {
      dateCondition += ` AND v.${VISIT_TIME_COL} >= ?`;
      params.push(`${from} 00:00:00`);
    }

    if (to) {
      dateCondition += ` AND v.${VISIT_TIME_COL} < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(to);
    }

    // 5. Fetch ALL individual visits
    const [visits] = await db.query(
      `SELECT
          v.${VISIT_TIME_COL} AS visited_at,
          v.latitude,
          v.longitude,
          q.${QR_NAME_COL} AS location_name
       FROM ${VISIT_TABLE} v
       LEFT JOIN ${QR_TABLE} q
          ON q.id = v.${VISIT_QR_COL}
       WHERE v.${VISIT_OFFICER_COL} = ?
       ${dateCondition}
       ORDER BY v.${VISIT_TIME_COL} ASC`,
      params
    );

    // 6. Group visits by date
    const days = groupByDay(visits);

    // 7. Return response
    return res.status(200).json({
      success: true,
      data: {
        officer: {
          id: officer.id,
          name: officer.name,
          phone_number: officer.phone_number,
        },

        period: {
          from: from || null,
          to: to || null,
        },

        summary: {
          // Number of distinct dates
          days_visited: days.length,

          // Number of individual visit records
          total_visits: visits.length,
        },

       days: days
  .slice()
  .reverse()
  .flatMap(({ key, list }) =>
    list.map((visit) => ({
      date: key,
      date_label: toDateLabel(key),
      day: toDayName(key),
      visit_time: toTimeLabel(visit.visited_at),
      locations: visit.location_name || "N/A",
    }))
  ),
      },
    });
  } catch (error) {
    console.error("Get officer visit report:", error);

    return getError(res, "Failed to fetch officer visit report", 500);
  }
};
/* ==========================================================
   EXCEL HELPERS
========================================================== */



/* ==========================================================
   1. OFFICER REPORT
   GET /api/admin/police-stations/:stationId/officers/:officerId/report
   ?from=YYYY-MM-DD&to=YYYY-MM-DD
========================================================== */



export const downloadOfficerReport = async (req, res) => {
  try {
    const { stationId, officerId } = req.params;

    // 1. VALIDATE IDS
    if (!isValidId(stationId) || !isValidId(officerId)) {
      return getError(res, "Invalid station or officer ID", 400);
    }

    // 2. VALIDATE DATE RANGE
    const range = getOptionalReportRange(req.query);

    if (range.error) {
      return getError(res, range.error, 400);
    }

    // 3. FETCH OFFICER DETAILS
    const [officers] = await db.query(
      `SELECT
          o.id,
          o.name,
          o.phone_number,
          ps.station_name
       FROM police_station_officers o
       INNER JOIN police_stations ps
          ON ps.id = o.police_station_id
       WHERE o.id = ?
         AND o.police_station_id = ?
       LIMIT 1`,
      [officerId, stationId]
    );

    if (!officers.length) {
      return getError(
        res,
        "Officer not found in this police station",
        404
      );
    }

    const officer = officers[0];

    // 4. BUILD VISIT FILTERS
    let visitConditions = `v.${VISIT_OFFICER_COL} = ?`;

    const visitParams = [officerId];

    if (range.from) {
      visitConditions += ` AND v.${VISIT_TIME_COL} >= ?`;
      visitParams.push(range.start);
    }

    if (range.to) {
      visitConditions += ` AND v.${VISIT_TIME_COL} < DATE_ADD(?, INTERVAL 1 DAY)`;
      visitParams.push(range.to);
    }

    // 5. FETCH ALL INDIVIDUAL VISITS
    const [visits] = await db.query(
      `SELECT
          v.${VISIT_TIME_COL} AS visited_at,
          v.latitude,
          v.longitude,
          q.${QR_NAME_COL} AS location_name
       FROM ${VISIT_TABLE} v
       LEFT JOIN ${QR_TABLE} q
          ON q.id = v.${VISIT_QR_COL}
       WHERE ${visitConditions}
       ORDER BY
          v.${VISIT_TIME_COL} ASC`,
      visitParams
    );

    // 6. GROUP BY DAY
    const days = groupByDay(visits);

    // 7. EXCEL INFORMATION
    const info = [
      ["Officer", officer.name],
      ["Phone", officer.phone_number || "N/A"],
      ["Police Station", officer.station_name],
    ];

    if (range.from || range.to) {
      info.push([
        "Period",
        `${range.from ? toDateLabel(range.from) : "Beginning"} to ${
          range.to ? toDateLabel(range.to) : "Present"
        }`,
      ]);
    }

    info.push(
      ["Days Visited", days.length],
      ["Total Visits", visits.length]
    );

    const workbook = new ExcelJS.Workbook();

    workbook.creator =
      "Police Station Visit Verification System";

    workbook.created = new Date();

    // 8. SHEET: DAYS VISITED
    // ONE ROW PER INDIVIDUAL VISIT

    const dayRows = days.flatMap(({ key, list }) =>
      list.map((visit) => [
        toDateLabel(key),
        toDayName(key),
        toTimeLabel(visit.visited_at),
        visit.location_name || "N/A",
      ])
    );

    const numberedDayRows = dayRows.map((row, index) => [
      index + 1,
      ...row,
    ]);

    addSheet(workbook, "Days Visited", {
      title: "Officer Visit Report - Days Visited",
      info,
      headers: [
        "Sr No",
        "Date",
        "Day",
        "Visit Time",
        "Location",
      ],
      widths: [8, 14, 14, 16, 45],
      rows: numberedDayRows,
    });

    // 9. DOWNLOAD EXCEL FILE
    const dateSuffix = [
      range.from ? `from_${range.from}` : "",
      range.to ? `to_${range.to}` : "",
    ]
      .filter(Boolean)
      .join("_");

    const filename = `${safeFileName(officer.name)}${
      dateSuffix ? `_${dateSuffix}` : ""
    }.xlsx`;

    return await sendWorkbook(res, workbook, filename);

  } catch (error) {
    console.error("Download officer report:", error);

    if (res.headersSent) {
      return res.end();
    }

    return getError(
      res,
      "Failed to generate officer report",
      500
    );
  }
};


/* ==========================================================
   2. STATION REPORT (ALL OFFICERS)
   GET /api/admin/police-stations/:stationId/report
   ?from=YYYY-MM-DD&to=YYYY-MM-DD
========================================================== */




export const downloadStationReport = async (req, res) => {
  try {
    const { stationId } = req.params;

    // ----------------------------------
    // 1. VALIDATE STATION ID
    // ----------------------------------

    if (!isValidId(stationId)) {
      return getError(res, "Invalid police station ID", 400);
    }

    // ----------------------------------
    // 2. VALIDATE DATE RANGE
    // ----------------------------------

    const range = getOptionalReportRange(req.query);

    if (range.error) {
      return getError(res, range.error, 400);
    }

    // ----------------------------------
    // 3. FETCH POLICE STATION
    // ----------------------------------

    const [stations] = await db.query(
      `SELECT
          id,
          station_name,
          district
       FROM police_stations
       WHERE id = ?
       LIMIT 1`,
      [stationId]
    );

    if (!stations.length) {
      return getError(res, "Police station not found", 404);
    }

    const station = stations[0];

    // ----------------------------------
    // 4. FETCH OFFICERS WHO HAVE VISITS
    // ----------------------------------

    let officerConditions = `o.police_station_id = ?`;

    const officerParams = [stationId];

    let existsConditions = `v.${VISIT_OFFICER_COL} = o.id`;

    // Apply FROM date only when provided
    if (range.from) {
      existsConditions += ` AND v.${VISIT_TIME_COL} >= ?`;
      officerParams.push(range.start);
    }

    // Apply TO date only when provided
    if (range.to) {
      existsConditions += ` AND v.${VISIT_TIME_COL} < DATE_ADD(?, INTERVAL 1 DAY)`;
      officerParams.push(range.to);
    }

    officerConditions += `
      AND EXISTS (
        SELECT 1
        FROM ${VISIT_TABLE} v
        WHERE ${existsConditions}
      )
    `;

    const [officers] = await db.query(
      `SELECT
          o.id,
          o.name,
          o.phone_number
       FROM police_station_officers o
       WHERE ${officerConditions}
       ORDER BY o.name ASC, o.id ASC`,
      officerParams
    );

    // ----------------------------------
    // 5. FETCH ALL INDIVIDUAL VISIT RECORDS
    // ----------------------------------

    let visits = [];

    if (officers.length > 0) {
      let visitConditions = `v.${VISIT_OFFICER_COL} IN (?)`;

      const visitParams = [
        officers.map((officer) => officer.id),
      ];

      // Apply FROM date only when provided
      if (range.from) {
        visitConditions += ` AND v.${VISIT_TIME_COL} >= ?`;
        visitParams.push(range.start);
      }

      // Apply TO date only when provided
      if (range.to) {
        visitConditions += ` AND v.${VISIT_TIME_COL} < DATE_ADD(?, INTERVAL 1 DAY)`;
        visitParams.push(range.to);
      }

      [visits] = await db.query(
        `SELECT
            v.${VISIT_OFFICER_COL} AS officer_id,

            v.${VISIT_TIME_COL} AS visited_at,

            v.latitude,
            v.longitude,

            q.${QR_NAME_COL} AS location_name

         FROM ${VISIT_TABLE} v

         LEFT JOIN ${QR_TABLE} q
            ON q.id = v.${VISIT_QR_COL}

         WHERE ${visitConditions}

         ORDER BY
            v.${VISIT_TIME_COL} ASC`,
        visitParams
      );
    }

    // ----------------------------------
    // 6. CREATE OFFICER LOOKUP
    // ----------------------------------

    const officerMap = new Map(
      officers.map((officer) => [
        String(officer.id),
        officer,
      ])
    );

    // ----------------------------------
    // 7. PREPARE EXCEL INFORMATION
    // ----------------------------------

    const info = [
      ["Police Station", station.station_name],
      ["District", station.district || "N/A"],
    ];

    if (range.from || range.to) {
      info.push([
        "Period",
        `${range.from ? toDateLabel(range.from) : "Beginning"} to ${
          range.to ? toDateLabel(range.to) : "Present"
        }`,
      ]);
    } else {
      info.push(["Period", "All Records"]);
    }

    // ----------------------------------
    // 8. CREATE WORKBOOK
    // ----------------------------------

    const workbook = new ExcelJS.Workbook();

    workbook.creator =
      "Police Station Visit Verification System";

    workbook.created = new Date();

    // ----------------------------------
    // 9. PREPARE INDIVIDUAL VISIT ROWS
    // ----------------------------------

    const rows = visits.map((visit, index) => {
      const officer = officerMap.get(
        String(visit.officer_id)
      );

      const dateKey = toDateKey(visit.visited_at);

      return [
        index + 1,

        officer?.name || "N/A",

        officer?.phone_number || "N/A",

        toDateLabel(dateKey),

        // toDayName(dateKey),

        toTimeLabel(visit.visited_at),

        visit.location_name || "N/A",

        visit.latitude !== null &&
        visit.latitude !== undefined
          ? Number(visit.latitude)
          : "",

        visit.longitude !== null &&
        visit.longitude !== undefined
          ? Number(visit.longitude)
          : "",
      ];
    });

    // ----------------------------------
    // 10. ADD ONLY ONE EXCEL SHEET
    // ----------------------------------

    addSheet(workbook, "All Visits", {
      title: "Police Station - All Officer Visits",

      info,

      headers: [
        "Sr No",
        "Officer",
        "Phone",
        "Visit Date",
        // "Day",
        "Visit Time",
        "Location",
        "Latitude",
        "Longitude",
      ],

      widths: [
        8,
        25,
        16,
        14,
        
        16,
        35,
        16,
        16,
      ],

      rows,
    });

    // ----------------------------------
    // 11. DOWNLOAD EXCEL FILE
    // ----------------------------------

    const dateSuffix = [
      range.from ? `from_${range.from}` : "",
      range.to ? `to_${range.to}` : "",
    ]
      .filter(Boolean)
      .join("_");

    const filename = `${safeFileName(station.station_name)}${
      dateSuffix ? `_${dateSuffix}` : ""
    }.xlsx`;

    return await sendWorkbook(
      res,
      workbook,
      filename
    );

  } catch (error) {
    console.error("Download station report:", error);

    if (res.headersSent) {
      return res.end();
    }

    return getError(
      res,
      "Failed to generate station report",
      500
    );
  }
};

