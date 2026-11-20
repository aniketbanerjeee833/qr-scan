
import db from "../../config/db.js";
import getError from "../../utils/getError.js";
import ExcelJS from "exceljs";
import { addSheet, sendWorkbook, toDateKey, toDateLabel, toTimeLabel } from "../../utils/excelReportFunctions.js";
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
      ov.officer_id,
      ov.image,
      ov.latitude,
      ov.longitude,
      ov.visited_at,

      q.location_name,
      q.qr_code,

      p.station_name,
      p.district,

      o.name AS officer_name,
      o.phone_number AS officer_phone

    FROM officer_visits ov

    LEFT JOIN location_qrs q
      ON q.id = ov.location_qr_id

    LEFT JOIN police_stations p
      ON p.id = ov.police_station_id

    LEFT JOIN police_station_officers o
      ON o.id = ov.officer_id

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
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Validate YYYY-MM-DD
const isValidDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};


// ========================================
// DOWNLOAD OFFICER VISITS REPORT (EXCEL)
// GET /api/admin/officer-visit/report
// ?visit_date=YYYY-MM-DD&search=text
// ========================================


export const downloadOfficerVisitsReport = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const selectedDate = req.query.visit_date || getTodayDate();

    // Validate date
    if (!isValidDate(selectedDate)) {
      return getError(
        res,
        "Invalid date format. Use YYYY-MM-DD",
        400
      );
    }

    // ----------------------------------
    // BUILD FILTERS
    // ----------------------------------

    const conditions = [
      "ov.visited_at >= ?",
      "ov.visited_at < DATE_ADD(?, INTERVAL 1 DAY)",
    ];

    const values = [
      `${selectedDate} 00:00:00`,
      selectedDate,
    ];

    if (search) {
      const searchValue = `%${search}%`;

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

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // ----------------------------------
    // FETCH ALL MATCHING VISITS
    // ----------------------------------

    const [visits] = await db.query(
      `
        SELECT
          ov.id,
          ov.visited_at,
          ov.latitude,
          ov.longitude,

          q.location_name,

          p.station_name,
          p.district,

          o.name AS officer_name,
          o.phone_number AS officer_phone

        FROM officer_visits ov

        LEFT JOIN location_qrs q
          ON q.id = ov.location_qr_id

        LEFT JOIN police_stations p
          ON p.id = ov.police_station_id

        LEFT JOIN police_station_officers o
          ON o.id = ov.officer_id

        ${whereClause}

        ORDER BY ov.visited_at DESC, ov.id DESC
      `,
      values
    );

    // ----------------------------------
    // PREPARE EXCEL DATA
    // ----------------------------------

    const info = [
      ["Report Date", selectedDate],
      ["Search", search || "All"],
      ["Total Visits", visits.length],
    ];

    const workbook = new ExcelJS.Workbook();

    workbook.creator =
      "Police Station Visit Verification System";

    workbook.created = new Date();

    // ----------------------------------
    // OFFICER VISITS SHEET
    // ----------------------------------

    const headers = [
      "Sr No",
      "Officer",
      "Phone",
      "Police Station",
      "District",
      "Location",
      "Visit Date",
      "Visit Time",
      "Latitude",
      "Longitude",
    ];

    const widths = [
      8,
      25,
      16,
      25,
      20,
      25,
      14,
      14,
      14,
      14,
    ];

    const rows = visits.map((visit, index) => {
      return [
        index + 1,
        visit.officer_name || "N/A",
        visit.officer_phone || "N/A",
        visit.station_name || "N/A",
        visit.district || "N/A",
        visit.location_name || "N/A",
        toDateLabel(toDateKey(visit.visited_at)),
        toTimeLabel(visit.visited_at),
        visit.latitude !== null
          ? Number(visit.latitude)
          : "",
        visit.longitude !== null
          ? Number(visit.longitude)
          : "",
      ];
    });

    addSheet(workbook, "Officer Visits", {
      title: "Officer Visit Report",
      info,
      headers,
      widths,
      rows,
    });

    // ----------------------------------
    // SEND EXCEL FILE
    // ----------------------------------

    const filename = `officer_visits_${selectedDate}.xlsx`;

    return await sendWorkbook(
      res,
      workbook,
      filename
    );

  } catch (error) {
    console.error(
      "Download officer visits report:",
      error
    );

    if (res.headersSent) {
      return res.end();
    }

    return getError(
      res,
      "Failed to generate officer visits report",
      500
    );
  }
};
