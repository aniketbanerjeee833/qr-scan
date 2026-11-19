
import db from "../../config/db.js";
import getError from "../../utils/getError.js";

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

    if (search?.trim()) {
      conditions.push(
        "(ps.station_name LIKE ? OR ps.district LIKE ?)"
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
    const { cursor, search } = req.query;

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

    const conditions = ["police_station_id = ?"];
    const values = [stationId];

    if (cursorId) {
      conditions.push("id < ?");
      values.push(cursorId);
    }

    if (search?.trim()) {
      conditions.push("(name LIKE ? OR phone_number LIKE ?)");
      values.push(
        `%${search.trim()}%`,
        `%${search.trim()}%`
      );
    }

    const [rows] = await db.query(
      `SELECT
          id,
          name,
          phone_number,
          police_station_id
       FROM police_station_officers
       WHERE ${conditions.join(" AND ")}
       ORDER BY id DESC
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

export const deleteStationOfficer = async (req, res) => {
  try {
    const { stationId, officerId } = req.params;

    if (!isValidId(stationId) || !isValidId(officerId)) {
      return getError(res, "Invalid station or officer ID", 400);
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

    await db.query(
      `DELETE FROM police_station_officers
       WHERE id = ? AND police_station_id = ?`,
      [officerId, stationId]
    );

    return res.status(200).json({
      success: true,
      message: "Officer deleted successfully",
    });
  } catch (error) {
    console.error("Delete station officer:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return getError(
        res,
        "Cannot delete officer because related records exist",
        409
      );
    }

    return getError(res, "Failed to delete officer", 500);
  }
};
