
import db from "../../config/db.js";
import getError from "../../utils/getError.js";

export const getOfficerVisits = async (req, res) => {
  try {
    const {
      search = "",
      station_id,
      visit_date,
      cursor,
    } = req.query;

    // Validate and normalize limit
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);

    // Validate cursor
    let cursorId = null;

    if (cursor !== undefined && cursor !== "") {
      cursorId = Number(cursor);

      if (!Number.isSafeInteger(cursorId) || cursorId <= 0) {
        return getError(res, "Invalid pagination cursor", 400);
      }
    }

    // Validate station ID
    let stationId = null;

    if (station_id !== undefined && station_id !== "") {
      stationId = Number(station_id);

      if (!Number.isInteger(stationId) || stationId <= 0) {
        return getError(res, "Invalid station ID", 400);
      }
    }

    // Validate single visit date (YYYY-MM-DD)
    const isValidDate = (date) => {
      if (!date) return true;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
      }

      const parsed = new Date(`${date}T00:00:00.000Z`);

      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
      );
    };

    if (!isValidDate(visit_date)) {
      return getError(
        res,
        "Invalid date format. Use YYYY-MM-DD",
        400
      );
    }

    // Build dynamic filters
    const conditions = [];
    const values = [];

    // Search station name, district, or location name
    if (search.trim()) {
      const searchValue = `%${search.trim()}%`;

      conditions.push(`
        (
          p.station_name LIKE ?
          OR p.district LIKE ?
          OR q.location_name LIKE ?
        )
      `);

      values.push(
        searchValue,
        searchValue,
        searchValue
      );
    }

    // Station filter
    if (stationId !== null) {
      conditions.push("ov.police_station_id = ?");
      values.push(stationId);
    }

    // Exact calendar-day filter
    if (visit_date) {
      conditions.push("ov.visited_at >= ?");
      values.push(`${visit_date} 00:00:00`);

      conditions.push("ov.visited_at < DATE_ADD(?, INTERVAL 1 DAY)");
      values.push(`${visit_date} 00:00:00`);
    }

    // Cursor pagination
    if (cursorId !== null) {
      conditions.push("ov.id < ?");
      values.push(cursorId);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Fetch one extra row to determine hasMore
    const [rows] = await db.query(
      `
        SELECT
          ov.id,
          ov.location_qr_id,
          ov.police_station_id,
          ov.image,
          ov.latitude,
          ov.longitude,
          ov.visited_at,

          q.location_name,
          q.qr_code,

          p.station_name,
          p.district

        FROM officer_visits ov

        LEFT JOIN location_qrs q
          ON q.id = ov.location_qr_id

        LEFT JOIN police_stations p
          ON p.id = ov.police_station_id

        ${whereClause}

        ORDER BY ov.id DESC

        LIMIT ?
      `,
      [...values, limit + 1]
    );

    // Pagination details
    const hasMore = rows.length > limit;

    const visits = hasMore
      ? rows.slice(0, limit)
      : rows;

    const nextCursor =
      hasMore && visits.length
        ? visits[visits.length - 1].id
        : null;

    return res.status(200).json({
      success: true,
      message: "Officer visits fetched successfully",
      data: visits,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Get officer visits:", error);
    return getError(res, "Failed to fetch officer visits", 500);
  }
};
