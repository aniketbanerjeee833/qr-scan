import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import VirtualList from "../components/common/VirtualList";

import {
  Search,
  RefreshCw,
  MapPin,
  Camera,
  Navigation,
  Clock,
  Building2,
  X,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";

import {
  useLazyGetOfficerVisitsQuery,
  useDownloadOfficerVisitsReportMutation,
} from "@/redux/api/officerVisitApi";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

// ============================================
// HELPERS
// ============================================

const getTodayDate = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const API_BASE_URL = "http://localhost:4000/api/";

const SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const getImageUrl = (image) => {
  if (!image) return "";

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
};

const formatDate = (date) => {
  if (!date) return "N/A";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "N/A";

  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatCoordinate = (value) => {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(6) : "N/A";
};

// ============================================
// DASHBOARD
// ============================================

export default function Dashboard() {
  // ------------------------------------------
  // URL STATE (source of truth for filters)
  // ------------------------------------------
  // ?search=abc            -> search text
  // ?visit_date=2026-11-19 -> date (defaults to today)
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const urlDate = searchParams.get("visit_date") || getTodayDate();

  // Local input state so typing feels instant;
  // the URL is updated after the debounce.
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Data
  const [visits, setVisits] = useState([]);

  // Pagination
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // UI
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedVisit, setSelectedVisit] = useState(null);

  // RTK Query
  const [getOfficerVisits, { isLoading }] =
    useLazyGetOfficerVisitsQuery();

  const [downloadReport, { isLoading: isDownloading }] =
    useDownloadOfficerVisitsReportMutation();

  // Request management
  const requestGenerationRef = useRef(0);
  const paginationLock = useRef(false);

  // ==========================================
  // URL UPDATE HELPER
  // ==========================================

  const updateParams = useCallback(
    (changes) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          Object.entries(changes).forEach(([key, value]) => {
            if (value === null || value === undefined || value === "") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          });

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // ==========================================
  // PUT TODAY'S DATE IN THE URL ON ARRIVAL
  // ==========================================

  useEffect(() => {
    if (!searchParams.get("visit_date")) {
      updateParams({ visit_date: getTodayDate() });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================
  // FETCH FIRST PAGE
  // ==========================================

  const fetchFirstPage = useCallback(
    async ({ search, visit_date }) => {
      const generation = ++requestGenerationRef.current;

      setError("");
      setVisits([]);
      setNextCursor(null);
      setHasMore(false);
      setLoadingMore(false);
      paginationLock.current = false;

      try {
        const result = await getOfficerVisits({
          limit: PAGE_SIZE,
          search: search?.trim() || "",
          visit_date: visit_date || "",
        }).unwrap();

        // Ignore outdated responses
        if (generation !== requestGenerationRef.current) return;

        setVisits(result.data || []);
        setNextCursor(result.pagination?.nextCursor ?? null);
        setHasMore(result.pagination?.hasMore ?? false);
      } catch (err) {
        if (generation !== requestGenerationRef.current) return;

        setError(err?.data?.message || "Failed to fetch officer visits.");
      }
    },
    [getOfficerVisits]
  );

  // ==========================================
  // FETCH WHENEVER URL FILTERS CHANGE
  // (covers first load, refresh, back/forward)
  // ==========================================

  useEffect(() => {
    fetchFirstPage({ search: urlSearch, visit_date: urlDate });
  }, [urlSearch, urlDate, fetchFirstPage]);

  // ==========================================
  // DEBOUNCE: INPUT -> URL
  // ==========================================

  useEffect(() => {
    const trimmed = searchInput.trim();

    if (trimmed === urlSearch) return;

    const timeout = setTimeout(() => {
      updateParams({ search: trimmed });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchInput, urlSearch, updateParams]);

  // ==========================================
  // SYNC: URL -> INPUT (back/forward, reset)
  // ==========================================

  useEffect(() => {
    setSearchInput((current) =>
      current.trim() === urlSearch ? current : urlSearch
    );
  }, [urlSearch]);

  // ==========================================
  // LOAD NEXT PAGE
  // ==========================================

  const loadMoreVisits = useCallback(async () => {
    if (paginationLock.current || !hasMore || nextCursor == null) {
      return;
    }

    paginationLock.current = true;
    setLoadingMore(true);

    const generation = requestGenerationRef.current;

    try {
      const result = await getOfficerVisits({
        limit: PAGE_SIZE,
        cursor: nextCursor,
        search: urlSearch.trim(),
        visit_date: urlDate || "",
      }).unwrap();

      // Ignore outdated pagination response
      if (generation !== requestGenerationRef.current) {
        return;
      }

      const newVisits = result.data || [];

      // Append only unique records
      setVisits((previous) => {
        const existingIds = new Set(previous.map((visit) => visit.id));

        const uniqueVisits = newVisits.filter(
          (visit) => !existingIds.has(visit.id)
        );

        return [...previous, ...uniqueVisits];
      });

      setNextCursor(result.pagination?.nextCursor ?? null);
      setHasMore(result.pagination?.hasMore ?? false);
    } catch (err) {
      if (generation === requestGenerationRef.current) {
        setError(
          err?.data?.message || "Failed to load more officer visits."
        );
      }
    } finally {
      paginationLock.current = false;

      if (generation === requestGenerationRef.current) {
        setLoadingMore(false);
      }
    }
  }, [getOfficerVisits, hasMore, nextCursor, urlSearch, urlDate]);

  // ==========================================
  // FILTER HANDLERS
  // ==========================================

  const handleDateChange = (e) => {
    // Cleared input -> param removed -> falls back to today
    updateParams({ visit_date: e.target.value || null });
  };

  // Reset: no search, date back to today (kept visible in URL)
  const handleResetFilters = () => {
    setSearchInput("");
    setSearchParams({ visit_date: getTodayDate() }, { replace: true });
  };

  const handleRefresh = () => {
    fetchFirstPage({ search: urlSearch, visit_date: urlDate });
  };

  const isDefaultFilters =
    urlSearch === "" && urlDate === getTodayDate();

  // ==========================================
  // DOWNLOAD EXCEL REPORT
  // Uses the APPLIED filters (URL), so the file
  // always matches what the table is showing.
  // ==========================================

  const handleDownloadReport = async () => {
    try {
      await downloadReport({
        search: urlSearch,
        visit_date: urlDate,
        filename: `officer_visits_${urlDate}.xlsx`,
      }).unwrap();

      toast.success("Report downloaded.");
    } catch (err) {
      console.error("Download officer visits report:", err);

      toast.error(
        err?.data?.error ||
          err?.data?.message ||
          "Failed to download report."
      );
    }
  };

  // ==========================================
  // CLOSE MODAL WITH ESCAPE
  // ==========================================

  useEffect(() => {
    if (!selectedVisit) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedVisit(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedVisit]);

  // ==========================================
  // RENDER VISIT ROW
  // ==========================================

  const renderVisit = (visit, index) => {
    return (
      <div
        key={visit.id}
        className="
          grid grid-cols-1 gap-3
          border-b border-gray-100 p-3
          transition hover:bg-gray-50
          sm:grid-cols-2
          md:grid-cols-[55px_1.2fr_1fr_1fr_1fr_1fr_90px]
          md:items-center md:gap-3 md:p-3
        "
      >
        {/* SERIAL NUMBER */}
        <div className="text-xs font-medium text-gray-500">
          <span className="md:hidden">Sl.No.: </span>
          {index + 1}
        </div>

        {/* POLICE STATION */}
        <div className="min-w-0">
          <p
            title={visit.station_name || "N/A"}
            className="whitespace-normal break-words text-sm font-semibold text-gray-800"
          >
            {visit.station_name || "N/A"}
          </p>

          <p
            title={visit.district || ""}
            className="mt-1 whitespace-normal break-words text-xs text-gray-500"
          >
            {visit.district || ""}
          </p>
        </div>

        {/* OFFICER NAME */}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 md:hidden">Officer Name</p>

          <p
            title={visit.officer_name || "N/A"}
            className="whitespace-normal break-words text-sm font-medium text-gray-800"
          >
            {visit.officer_name || "N/A"}
          </p>
        </div>

        {/* LOCATION */}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 md:hidden">Location</p>

          <p
            title={visit.location_name || "N/A"}
            className="whitespace-normal break-words text-sm text-gray-700"
          >
            {visit.location_name || "N/A"}
          </p>
        </div>

        {/* GPS */}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 md:hidden">
            GPS Coordinates
          </p>

          <p
            title={`Latitude: ${formatCoordinate(visit.latitude)}`}
            className="break-all text-xs text-gray-600"
          >
            Lat: {formatCoordinate(visit.latitude)}
          </p>

          <p
            title={`Longitude: ${formatCoordinate(visit.longitude)}`}
            className="mt-1 break-all text-xs text-gray-600"
          >
            Long: {formatCoordinate(visit.longitude)}
          </p>
        </div>

        {/* VISIT TIME */}
        <div>
          <p className="text-xs text-gray-500 md:hidden">Visit Time</p>

          <p
            title={formatDate(visit.visited_at)}
            className="text-sm text-gray-700"
          >
            {formatDate(visit.visited_at)}
          </p>

          <p
            title={formatTime(visit.visited_at)}
            className="mt-1 text-xs text-gray-500"
          >
            {formatTime(visit.visited_at)}
          </p>
        </div>

        {/* ACTION */}
        <div>
          <button
            type="button"
            title="View officer visit details"
            onClick={() => setSelectedVisit(visit)}
            className="
              flex items-center justify-center gap-1.5
              rounded-lg border border-red-200
              bg-red-50 px-3 py-2
              text-xs font-medium text-red-600
              transition hover:bg-red-100
            "
          >
            <Eye size={14} />
            View
          </button>
        </div>
      </div>
    );
  };

  // ==========================================
  // MODAL DATA
  // ==========================================

  const selectedImage =
    selectedVisit?.selfie_image || selectedVisit?.image;

  const imageUrl = getImageUrl(selectedImage);

  const hasCoordinates =
    selectedVisit?.latitude != null && selectedVisit?.longitude != null;

  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        `${selectedVisit.latitude},${selectedVisit.longitude}`
      )}`
    : null;

  // ==========================================
  // PAGE UI
  // ==========================================

  return (
    <>
      <div
        className="
          flex h-full max-h-full w-full
          min-h-0 min-w-0 flex-col
          gap-4 overflow-hidden
          bg-gray-50 p-3 md:p-5
        "
      >
        {/* ================================== */}
        {/* PAGE HEADING */}
        {/* ================================== */}

        <div
          className="
            flex shrink-0 flex-col gap-3
            sm:flex-row sm:items-center sm:justify-between
          "
        >
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
              <Building2 size={23} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Officer Visit Dashboard
              </h1>

              <p className="text-xs text-gray-700">
                Monitor and review QR-based officer visits.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || loadingMore}
            className="
              flex items-center justify-center gap-2
              rounded-lg border bg-white
              px-3 py-2 text-xs text-gray-600
              transition hover:bg-gray-50
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={14}
              className={isLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* ================================== */}
        {/* VISIT LIST CARD */}
        {/* ================================== */}

        <div
          className="
            flex min-h-0 min-w-0 flex-1 flex-col
            overflow-hidden rounded-xl
            border border-gray-200 bg-white shadow-sm
          "
        >
          {/* CARD HEADER */}
          <div className="shrink-0 border-b p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Officer Visit History
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  View and search all officer visits.
                </p>
              </div>
            </div>

            {/* SEARCH, DATE, RESET, DOWNLOAD */}
            <div
              className="
                grid grid-cols-1 gap-3
                sm:grid-cols-[1fr_180px_auto_auto]
                sm:items-end
              "
            >
              {/* SEARCH */}
              <div className="min-w-0">
                <label
                  htmlFor="visit-search"
                  className="mb-1 block text-xs font-medium text-gray-600"
                >
                  Search
                </label>

                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="visit-search"
                    type="text"
                    name="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search"
                    className="
                      h-9 w-full rounded-lg border border-gray-200
                      pl-9 pr-3
                      text-xs text-gray-700
                      outline-none transition
                      focus:border-red-400
                      focus:ring-2 focus:ring-red-100
                    "
                  />
                </div>
              </div>

              {/* DATE */}
              <div className="min-w-0">
                <label
                  htmlFor="visit-date"
                  className="mb-1 block text-xs font-medium text-gray-600"
                >
                  Date
                </label>

                <input
                  id="visit-date"
                  type="date"
                  name="visit_date"
                  value={urlDate}
                  onChange={handleDateChange}
                  className="
                    h-9 w-full min-w-0 rounded-lg border border-gray-200
                    px-3
                    text-xs text-gray-600
                    outline-none transition
                    focus:border-red-400
                    focus:ring-2 focus:ring-red-100
                  "
                />
              </div>

              {/* RESET */}
              <div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={isDefaultFilters && searchInput === ""}
                  className="
                    flex h-9 w-full items-center justify-center gap-1.5
                    rounded-lg border border-gray-200
                    px-4 text-xs font-medium text-gray-600
                    transition hover:bg-gray-50
                    disabled:cursor-not-allowed disabled:opacity-50
                    sm:w-auto
                  "
                >
                  <RefreshCw size={15} />
                  Reset
                </button>
              </div>

              {/* DOWNLOAD EXCEL */}
              <div>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={isDownloading || isLoading || visits.length === 0}
                  title={
                    visits.length === 0
                      ? "No visits to export for the selected filters"
                      : "Download Excel report for the selected date and search"
                  }
                  className="
                    flex h-9 w-full items-center justify-center gap-1.5
                    rounded-lg bg-green-600
                    px-4 text-xs font-medium text-white
                    transition hover:bg-green-700
                    disabled:cursor-not-allowed disabled:opacity-50
                    sm:w-auto
                  "
                >
                  {isDownloading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={15} />
                  )}
                  Excel Report
                </button>
              </div>
            </div>
          </div>

          {/* ================================== */}
          {/* TABLE HEADER */}
          {/* ================================== */}

          <div
            className="
              hidden shrink-0
              grid-cols-[55px_1.2fr_1fr_1fr_1fr_1fr_90px]
              gap-3 border-b bg-gray-50
              px-4 py-3
              text-[11px] font-semibold
              uppercase tracking-wide text-gray-500
              md:grid
            "
          >
            <div>Sl.No.</div>
            <div>Police Station</div>
            <div>Officer Name</div>
            <div>Location</div>
            <div>GPS</div>
            <div>Time</div>
            <div>Action</div>
          </div>

          {/* ================================== */}
          {/* VIRTUAL LIST */}
          {/* ================================== */}

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {isLoading && visits.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                <span className="loading loading-spinner loading-md mr-2" />
                Loading officer visits...
              </div>
            ) : (
              <VirtualList
                items={visits}
                renderItem={renderVisit}
                getItemKey={(visit) => visit.id}
                estimateSize={115}
                overscan={5}
                hasMore={hasMore}
                isLoadingMore={loadingMore}
                onEndReached={loadMoreVisits}
                endThreshold={5}
                emptyMessage="No officer visits found."
                loadingText="Loading more officer visits..."
                className="h-full overscroll-contain"
              />
            )}
          </div>

          {/* ================================== */}
          {/* ERROR */}
          {/* ================================== */}

          {error && (
            <div
              className="
                flex shrink-0 items-center
                justify-between gap-3
                border-t border-red-100
                bg-red-50 px-4 py-2
              "
            >
              <p className="text-xs text-red-600">{error}</p>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isLoading || loadingMore}
                className="
                  rounded-lg border border-red-200
                  bg-white px-3 py-1.5
                  text-xs text-red-600
                  hover:bg-red-100
                "
              >
                Retry
              </button>
            </div>
          )}

          {/* ================================== */}
          {/* FOOTER */}
          {/* ================================== */}

          {!isLoading && visits.length > 0 && !hasMore && (
            <div className="shrink-0 border-t bg-gray-50 px-4 py-2.5 text-center text-xs text-gray-500">
              All officer visit records loaded.
            </div>
          )}
        </div>
      </div>

      {/* ====================================== */}
      {/* VISIT DETAILS MODAL */}
      {/* ====================================== */}

      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setSelectedVisit(null)}
        >
          <div
            className="
              flex max-h-[90dvh] w-full max-w-2xl
              flex-col overflow-hidden
              rounded-xl bg-white shadow-xl
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold text-gray-800">
                Officer Visit Details
              </h2>

              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[180px_1fr]">
                {/* OFFICER IMAGE */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-600">
                    Image
                  </p>

                  {imageUrl ? (
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open full image"
                    >
                      <img
                        src={imageUrl}
                        alt="Officer selfie"
                        className="h-48 w-full rounded-lg border border-gray-200 bg-gray-50 object-cover"
                      />

                      <span className="mt-2 flex items-center gap-1 text-xs text-red-600">
                        <ExternalLink size={12} />
                        Open full image
                      </span>
                    </a>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg border bg-gray-50 text-gray-400">
                      <div className="text-center">
                        <Camera size={30} className="mx-auto mb-2" />
                        <p className="text-xs">No image available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* OFFICER + STATION DETAILS */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Officer Details
                    </h3>

                    <div>
                      <p className="text-xs text-gray-500">Officer Name</p>
                      <p className="mt-1 break-words text-sm font-medium text-gray-800">
                        {selectedVisit.officer_name || "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Phone Number</p>
                      <p className="mt-1 text-sm text-gray-800">
                        {selectedVisit.officer_phone || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Station Details
                    </h3>

                    <div>
                      <p className="text-xs text-gray-500">Police Station</p>
                      <p className="mt-1 break-words text-sm font-medium text-gray-800">
                        {selectedVisit.station_name || "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">District</p>
                      <p className="mt-1 break-words text-sm text-gray-800">
                        {selectedVisit.district || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* GPS COORDINATES + LOCATION */}
              <div className="mt-6 rounded-lg border border-gray-200 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Navigation size={16} className="text-red-500" />

                  <h3 className="text-sm font-semibold text-gray-800">
                    GPS Coordinates & Location
                  </h3>
                </div>

                <div className="mb-4 border-b border-gray-100 pb-4">
                  <p className="text-xs text-gray-500">Location Name</p>

                  <p
                    title={selectedVisit.location_name || "N/A"}
                    className="mt-1 break-words text-sm font-medium text-gray-800"
                  >
                    {selectedVisit.location_name || "N/A"}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Latitude</p>
                    <p className="mt-1 break-all text-sm text-gray-800">
                      {formatCoordinate(selectedVisit.latitude)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Longitude</p>
                    <p className="mt-1 break-all text-sm text-gray-800">
                      {formatCoordinate(selectedVisit.longitude)}
                    </p>
                  </div>
                </div>

                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="View this visit location on Google Maps"
                    className="
                      mt-4 inline-flex items-center gap-2
                      rounded-lg bg-red-50 px-3 py-2
                      text-xs font-medium text-red-600
                      transition hover:bg-red-100
                    "
                  >
                    <MapPin size={14} />
                    Open location in Google Maps
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* VISIT DATE AND TIME */}
              <div className="mt-4 rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-red-500" />

                  <h3 className="text-sm font-semibold text-gray-800">
                    Visit Date and Time
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Visit Date</p>
                    <p className="mt-1 text-sm text-gray-800">
                      {formatDate(selectedVisit.visited_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Visit Time</p>
                    <p className="mt-1 text-sm text-gray-800">
                      {formatTime(selectedVisit.visited_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex shrink-0 justify-end border-t bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="
                  rounded-lg bg-red-500
                  px-4 py-2 text-xs
                  font-medium text-white
                  transition hover:bg-red-600
                "
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}