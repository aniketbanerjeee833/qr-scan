import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import DeleteAlertModal from "@/components/Modal/DeleteAlertModal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  useCreatePoliceStationMutation,
  useGetPoliceStationsQuery,
  useUpdatePoliceStationMutation,
  useDeletePoliceStationMutation,
  useCreateStationOfficerMutation,
  useLazyGetStationOfficersQuery,
  useUpdateStationOfficerMutation,
  useDeleteStationOfficerMutation,
  useGetOfficerVisitReportQuery,
} from "@/redux/api/policeStationApi";

import {
  Building2,
  Users,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Pencil,
  Trash2,
  X,
  Phone,
  UserRound,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  CalendarDays,
} from "lucide-react";

const PAGE_SIZE = 10;

// Use the same base URL as your policeStationApi.
const API_URL = "http://localhost:4000/api/";

const EMPTY_STATION_FORM = {
  station_name: "",
  district: "",
};

const EMPTY_OFFICER_FORM = {
  name: "",
  phone_number: "",
};

// ========================================
// DATE + DOWNLOAD HELPERS
// ========================================

const toFileLabel = (value) =>
  String(value || "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "") || "report";

// "2026-11-20" -> "20-11-2026"
const formatInputDate = (value) =>
  value ? value.split("-").reverse().join("-") : "";

const downloadExcel = async (path, params, filename) => {
  const query = new URLSearchParams(params).toString();

  const response = await fetch(`${API_URL}${path}?${query}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Failed to download report";

    try {
      const result = await response.json();
      message = result.error || result.message || message;
    } catch {
      // Response was not JSON; keep the default message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

// ========================================
// EXPANDED OFFICER REPORT (TABLE)
// ========================================

function OfficerReportPanel({ stationId, officerId, from, to }) {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetOfficerVisitReportQuery(
      { stationId, officerId, from, to },
      { refetchOnMountOrArgChange: true }
    );

  const report = data?.data;
  const days = report?.days || [];

  const periodLabel =
    from || to
      ? `${from ? formatInputDate(from) : "Beginning"} to ${
          to ? formatInputDate(to) : "Today"
        }`
      : "All dates";

  return (
    <div className="border-t bg-gray-50 px-4 pb-4 pt-3 sm:pl-12">
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-xs text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading visit report...
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-600">
            {error?.data?.error ||
              error?.data?.message ||
              "Failed to load visit report."}
          </p>

          <Button variant="outline" size="sm"
            type="button"
            onClick={refetch}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Report */}
      {report && !isError && (
        <>
          {/* Summary */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-gray-600">
              <CalendarDays size={13} className="text-gray-400" />
              {periodLabel}
            </span>

            <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700">
              {report.summary.days_visited} day(s) visited
            </span>

            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              {report.summary.total_visits} total visit(s)
            </span>

            {isFetching && (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            )}
          </div>

          {days.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white py-8 text-center">
              <CalendarDays
                size={26}
                className="mx-auto mb-2 text-gray-300"
              />

              <p className="text-sm font-medium text-gray-600">
                No visits found
              </p>

              <p className="mt-1 text-xs text-gray-400">
                This officer has no visits in the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="max-h-72 overflow-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Sr</th>
                      <th className="px-3 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Day</th>
                      <th className="px-3 py-2.5 font-semibold">Visit</th>
                      <th className="px-3 py-2.5 font-semibold">
                        Locations
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {days.map((day, index) => (
                      <tr
                        key={day.date}
                        className="border-t border-gray-100 text-gray-700 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2.5 text-gray-400">
                          {index + 1}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-800">
                          {day.date_label}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2.5">
                          {day.day}
                        </td>

                        {/* One visit: its time. Several: first - last (count) */}
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {day.first_visit}
                          {day.visits > 1 && (
                            <span className="text-gray-400">
                              {" "}
                              – {day.last_visit} ({day.visits} visits)
                            </span>
                          )}
                        </td>

                        <td className="min-w-[160px] break-words px-3 py-2.5">
                          {day.locations || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ========================================
// PAGE
// ========================================

export default function PoliceStationManagement() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filters from the URL on initial page load. Dates remain blank by default.
  const initialStationId = searchParams.get("stationId");
  const initialStationSearch = searchParams.get("stationSearch") || "";
  const initialOfficerSearch = searchParams.get("search") || "";
  const initialReportFrom = searchParams.get("from") || "";
  const initialReportTo = searchParams.get("to") || "";

  // ========================================
  // STATION SEARCH
  // ========================================

  // Typed text updates instantly; the applied (debounced) text is what is
  // sent to the API and written to the URL.
  const [stationSearchInput, setStationSearchInput] =
    useState(initialStationSearch);
  const [stationSearch, setStationSearch] = useState(initialStationSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStationSearch(stationSearchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [stationSearchInput]);

  const clearStationSearch = () => {
    setStationSearchInput("");
    setStationSearch("");
  };

  // ========================================
  // API
  // ========================================

  const {
    data: stationResponse,
    isLoading: isLoadingStations,
    isFetching: isFetchingStations,
    refetch: refetchStations,
  } = useGetPoliceStationsQuery({
    limit: 100,
    ...(stationSearch ? { search: stationSearch } : {}),
  });

  const [createPoliceStation, { isLoading: isCreatingStation }] =
    useCreatePoliceStationMutation();

  const [updatePoliceStation, { isLoading: isUpdatingStation }] =
    useUpdatePoliceStationMutation();

  const [deletePoliceStation, { isLoading: isDeletingStation }] =
    useDeletePoliceStationMutation();

  const [createStationOfficer, { isLoading: isCreatingOfficer }] =
    useCreateStationOfficerMutation();

  const [triggerOfficers] = useLazyGetStationOfficersQuery();

  const [updateStationOfficer, { isLoading: isUpdatingOfficer }] =
    useUpdateStationOfficerMutation();

  const [deleteStationOfficer, { isLoading: isDeletingOfficer }] =
    useDeleteStationOfficerMutation();

  const stations = stationResponse?.data || [];

  // ========================================
  // SELECTED STATION
  // ========================================

  const [selectedStationId, setSelectedStationId] = useState(
    initialStationId || null
  );

  const listedStation =
    stations.find(
      (station) => Number(station.id) === Number(selectedStationId)
    ) || null;

  // Remember the selected station so the right panel stays open
  // while a search filters it out of the left list.
  const [pinnedStation, setPinnedStation] = useState(null);

  useEffect(() => {
    if (listedStation) setPinnedStation(listedStation);
  }, [listedStation]);

  const isPinnedSelected =
    pinnedStation &&
    Number(pinnedStation.id) === Number(selectedStationId);

  const selectedStation =
    listedStation || (isPinnedSelected ? pinnedStation : null);

  useEffect(() => {
    // Wait for the list; also wait while a new search/refetch is running,
    // otherwise the stale list would wrongly change the selection.
    if (isLoadingStations || isFetchingStations) return;

    // Nothing selected yet: pick the first station shown.
    if (!selectedStationId) {
      if (stations.length) setSelectedStationId(stations[0].id);
      return;
    }

    const isListed = stations.some(
      (station) => Number(station.id) === Number(selectedStationId)
    );

    // While searching, a selected station that is filtered out is kept.
    if (!isListed && !(stationSearch && isPinnedSelected)) {
      setSelectedStationId(stations[0]?.id ?? null);
    }
  }, [
    stations,
    selectedStationId,
    isLoadingStations,
    isFetchingStations,
    stationSearch,
    isPinnedSelected,
  ]);

  // ========================================
  // MODALS
  // ========================================

  const [stationModal, setStationModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [stationForm, setStationForm] = useState(EMPTY_STATION_FORM);

  const [officerModal, setOfficerModal] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [officerForm, setOfficerForm] = useState(EMPTY_OFFICER_FORM);

  // Shared confirmation modal target: { type: "station" | "officer", item }
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ========================================
  // REPORT STATE
  // ========================================

  // Keep date filters optional and blank until the user selects them.
  const [reportFrom, setReportFrom] = useState(initialReportFrom);
  const [reportTo, setReportTo] = useState(initialReportTo);

  // "station" or `officer-${id}` while a download is running
  const [downloadingKey, setDownloadingKey] = useState(null);

  // Officer whose visit report table is currently expanded
  const [expandedOfficerId, setExpandedOfficerId] = useState(null);

  // Collapse the open report whenever the station changes
  useEffect(() => {
    setExpandedOfficerId(null);
  }, [selectedStationId]);

  const toggleOfficer = (officerId) => {
    setExpandedOfficerId((current) =>
      current === officerId ? null : officerId
    );
  };

  // ========================================
  // OFFICER STATE + CURSOR PAGINATION
  // ========================================

  const [officers, setOfficers] = useState([]);
  const [officerSearch, setOfficerSearch] = useState(initialOfficerSearch);
  const [officerLoading, setOfficerLoading] = useState(false);
  const [officerHasMore, setOfficerHasMore] = useState(false);

  const officerCursorRef = useRef(null);
  const officerLoadingRef = useRef(false);
  const officerHasMoreRef = useRef(true);
  const officerRequestRef = useRef(0);

  // Keep the selected station and filters reflected in the browser URL.
  // Empty search/date values are removed rather than written as empty params.
  useEffect(() => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (selectedStationId) {
          nextParams.set("stationId", String(selectedStationId));
        } else {
          nextParams.delete("stationId");
        }

        if (stationSearch) {
          nextParams.set("stationSearch", stationSearch);
        } else {
          nextParams.delete("stationSearch");
        }

        if (officerSearch.trim()) {
          nextParams.set("search", officerSearch.trim());
        } else {
          nextParams.delete("search");
        }

        if (reportFrom) {
          nextParams.set("from", reportFrom);
        } else {
          nextParams.delete("from");
        }

        if (reportTo) {
          nextParams.set("to", reportTo);
        } else {
          nextParams.delete("to");
        }

        return nextParams;
      },
      { replace: true }
    );
  }, [
    selectedStationId,
    stationSearch,
    officerSearch,
    reportFrom,
    reportTo,
    setSearchParams,
  ]);

  // ========================================
  // LOAD OFFICERS
  // ========================================

  const loadOfficers = useCallback(
    async (reset = false, searchTerm = officerSearch) => {
      if (!selectedStationId) return;

      if (officerLoadingRef.current && !reset) return;
      if (!officerHasMoreRef.current && !reset) return;

      const requestId = ++officerRequestRef.current;

      officerLoadingRef.current = true;
      setOfficerLoading(true);

      if (reset) {
        officerCursorRef.current = null;
        officerHasMoreRef.current = true;
        setOfficerHasMore(false);
        setOfficers([]);
      }

      try {
        const params = {
          stationId: selectedStationId,
          limit: PAGE_SIZE,
        };

        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }

        if (reportFrom) params.from = reportFrom;
        if (reportTo) params.to = reportTo;

        if (!reset && officerCursorRef.current) {
          params.cursor = officerCursorRef.current;
        }

        const response = await triggerOfficers(params).unwrap();

        if (requestId !== officerRequestRef.current) return;

        const rows = Array.isArray(response?.data)
          ? response.data
          : [];

        setOfficers((previous) => {
          if (reset) return rows;

          const existingIds = new Set(
            previous.map((item) => item.id)
          );

          return [
            ...previous,
            ...rows.filter((item) => !existingIds.has(item.id)),
          ];
        });

        const nextCursor =
          response?.pagination?.nextCursor ?? null;

        officerCursorRef.current = nextCursor;

        const hasMore = Boolean(
          response?.pagination?.hasMore ?? nextCursor
        );

        officerHasMoreRef.current = hasMore;
        setOfficerHasMore(hasMore);
      } catch (error) {
        if (requestId !== officerRequestRef.current) return;

        console.error("Fetch station officers:", error);

        toast.error(
          error?.data?.message || "Unable to fetch officers."
        );
      } finally {
        if (requestId === officerRequestRef.current) {
          officerLoadingRef.current = false;
          setOfficerLoading(false);
        }
      }
    },
    [
      selectedStationId,
      officerSearch,
      reportFrom,
      reportTo,
      triggerOfficers,
    ]
  );

  // ========================================
  // LOAD WHEN STATION OR SEARCH CHANGES
  // ========================================

  useEffect(() => {
    if (!selectedStationId) {
      setOfficers([]);
      setOfficerHasMore(false);
      return;
    }

    const delay = officerSearch.trim() ? 300 : 0;

    const timer = setTimeout(() => {
      loadOfficers(true, officerSearch);
    }, delay);

    return () => {
      clearTimeout(timer);
      officerRequestRef.current++;
      officerLoadingRef.current = false;
    };
  }, [selectedStationId, officerSearch, loadOfficers]);

  // ========================================
  // DOWNLOAD EXCEL REPORTS
  // ========================================

  // officer = null  -> whole station report
  // officer = {...} -> single officer report
  const handleDownloadReport = async (officer = null) => {
    if (!selectedStation) return;

    // Date filters are optional. Download the complete report when neither
    // date is selected, or apply whichever date boundary the user selected.
    if (reportFrom && reportTo && reportFrom > reportTo) {
      toast.error("From date cannot be after To date.");
      return;
    }

    const key = officer ? `officer-${officer.id}` : "station";

    const path = officer
      ? `admin/police-stations/${selectedStation.id}/officers/${officer.id}/report`
      : `admin/police-stations/${selectedStation.id}/report`;

    const label = toFileLabel(
      officer ? officer.name : selectedStation.station_name
    );

    const reportParams = {};
    if (reportFrom) reportParams.from = reportFrom;
    if (reportTo) reportParams.to = reportTo;

    const dateSuffix = [
      reportFrom ? `from_${reportFrom}` : "",
      reportTo ? `to_${reportTo}` : "",
    ]
      .filter(Boolean)
      .join("_");

    const filename = `${label}${dateSuffix ? `_${dateSuffix}` : ""}.xlsx`;

    try {
      setDownloadingKey(key);

      await downloadExcel(path, reportParams, filename);

      toast.success("Report downloaded.");
    } catch (error) {
      console.error("Download report:", error);
      toast.error(error.message || "Failed to download report.");
    } finally {
      setDownloadingKey(null);
    }
  };

  // ========================================
  // STATION MODAL
  // ========================================

  const openAddStation = () => {
    setEditingStation(null);
    setStationForm(EMPTY_STATION_FORM);
    setStationModal(true);
  };

  const openEditStation = (station) => {
    setEditingStation(station);

    setStationForm({
      station_name: station.station_name || "",
      district: station.district || "",
    });

    setStationModal(true);
  };

  const closeStationModal = () => {
    setStationModal(false);
    setEditingStation(null);
    setStationForm(EMPTY_STATION_FORM);
  };

  const handleStationSubmit = async (event) => {
    event.preventDefault();

    const station_name = stationForm.station_name.trim();
    const district = stationForm.district.trim();

    if (!station_name) {
      toast.error("Station name is required.");
      return;
    }

    try {
      if (editingStation) {
        await updatePoliceStation({
          id: editingStation.id,
          station_name,
          district,
        }).unwrap();

        toast.success("Police station updated successfully.");
      } else {
        const response = await createPoliceStation({
          station_name,
          district,
        }).unwrap();

        toast.success("Police station created successfully.");

        if (response?.data?.id) {
          // Clear the search so the new station is visible in the list
          clearStationSearch();
          setSelectedStationId(response.data.id);
          setOfficerSearch("");
          setReportFrom("");
          setReportTo("");
        }
      }

      closeStationModal();
      await refetchStations();
    } catch (error) {
      console.error("Save police station:", error);

      toast.error(
        error?.data?.message || "Failed to save police station."
      );
    }
  };

  // ========================================
  // DELETE STATION
  // ========================================

  const handleDeleteStation = (station) => {
    setDeleteTarget({ type: "station", item: station });
  };

  // ========================================
  // OFFICER MODAL
  // ========================================

  const openAddOfficer = () => {
    if (!selectedStation) {
      toast.error("Please select a police station first.");
      return;
    }

    if (Number(selectedStation.is_active) !== 1) {
      toast.error("Activate this police station before adding officers.");
      return;
    }

    setEditingOfficer(null);
    setOfficerForm(EMPTY_OFFICER_FORM);
    setOfficerModal(true);
  };

  const openEditOfficer = (officer) => {
    setEditingOfficer(officer);

    setOfficerForm({
      name: officer.name || "",
      phone_number: officer.phone_number || "",
    });

    setOfficerModal(true);
  };

  const closeOfficerModal = () => {
    setOfficerModal(false);
    setEditingOfficer(null);
    setOfficerForm(EMPTY_OFFICER_FORM);
  };

  const handleOfficerSubmit = async (event) => {
    event.preventDefault();

    if (!selectedStationId) return;

    const payload = {
      name: officerForm.name.trim(),
      phone_number: officerForm.phone_number.trim(),
    };

    if (!payload.name) {
      toast.error("Officer name is required.");
      return;
    }

    try {
      if (editingOfficer) {
        await updateStationOfficer({
          stationId: selectedStationId,
          officerId: editingOfficer.id,
          ...payload,
        }).unwrap();

        toast.success("Officer updated successfully.");
      } else {
        await createStationOfficer({
          stationId: selectedStationId,
          ...payload,
        }).unwrap();

        toast.success("Officer added successfully.");
      }

      closeOfficerModal();
      await loadOfficers(true);
      await refetchStations();
    } catch (error) {
      console.error("Save officer:", error);

      toast.error(
        error?.data?.message || "Failed to save officer."
      );
    }
  };

  // ========================================
  // DELETE OFFICER
  // ========================================

  const handleDeleteOfficer = (officer) => {
    setDeleteTarget({ type: "officer", item: officer });
  };

  // ========================================
  // DELETE CONFIRMATION
  // ========================================

  const closeDeleteModal = () => {
    if (isDeletingStation || isDeletingOfficer) return;
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const { type, item } = deleteTarget;

    try {
      if (type === "station") {
        await deletePoliceStation(item.id).unwrap();

        toast.success("Police station deleted successfully.");

        if (Number(selectedStationId) === Number(item.id)) {
          setSelectedStationId(null);
          setPinnedStation(null);
          setOfficers([]);
          setOfficerSearch("");
          setReportFrom("");
          setReportTo("");
        }

        setDeleteTarget(null);
        await refetchStations();
        return;
      }

      await deleteStationOfficer({
        stationId: selectedStationId,
        officerId: item.id,
      }).unwrap();

      toast.success("Officer deleted successfully.");

      if (expandedOfficerId === item.id) {
        setExpandedOfficerId(null);
      }

      setDeleteTarget(null);

      await loadOfficers(true);
      await refetchStations();
    } catch (error) {
      console.error(`Delete ${type}:`, error);
      toast.error(
        error?.data?.message ||
          (type === "station"
            ? "Failed to delete police station."
            : "Failed to delete officer.")
      );
    }
  };

  // ========================================
  // REFRESH
  // ========================================

  const handleRefresh = () => {
    refetchStations();

    if (selectedStationId) {
      loadOfficers(true);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 flex-col overflow-hidden bg-gray-50 p-3 md:p-5">
      {/* PAGE HEADER */}

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
            <Building2 size={23} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Police Station & Officers
            </h1>

            <p className="text-xs text-gray-600">
              Manage police stations and their officers.
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm"
          type="button"
          onClick={handleRefresh}
          disabled={isFetchingStations || officerLoading}
          className="flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              isFetchingStations || officerLoading
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </Button>
      </div>

      {/* TWO COLUMN LAYOUT */}

      <div className="grid flex-1 min-h-0 grid-cols-1 items-stretch gap-4 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ========================================
            LEFT COLUMN - POLICE STATIONS
        ======================================== */}

        <section className="flex min-h-0 h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="shrink-0 border-b p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-800">
                  Police Stations
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {stations.length} station(s)
                  {stationSearch ? " found" : ""}
                </p>
              </div>

              <Button variant="default" size="sm"
                type="button"
                onClick={openAddStation}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                <Plus size={15} />
                Add Station
              </Button>
            </div>

            {/* Station search */}
            <div className="relative mt-3">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <Input
                type="text"
                value={stationSearchInput}
                onChange={(e) => setStationSearchInput(e.target.value)}
                placeholder="Search"
                className="h-9 w-full rounded-lg border py-2 pl-9 pr-8 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />

              {stationSearchInput ? (
                <Button variant="ghost" size="icon-sm"
                  type="button"
                  onClick={clearStationSearch}
                  aria-label="Clear station search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={14} />
                </Button>
              ) : isFetchingStations ? (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                />
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            {isLoadingStations && (
              <div className="flex justify-center py-10 text-gray-500">
                <Loader2 className="animate-spin" size={22} />
              </div>
            )}

            {!isLoadingStations && stations.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Building2
                  size={30}
                  className="mx-auto mb-2 text-gray-300"
                />

                <p className="text-sm font-medium text-gray-600">
                  {stationSearch
                    ? "No police stations match your search"
                    : "No police stations found"}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {stationSearch
                    ? "Try a different station name or district."
                    : "Add your first police station."}
                </p>
              </div>
            )}

            {stations.map((station) => {
              const isSelected =
                Number(selectedStationId) === Number(station.id);

              return (
                <Button variant="ghost" size="default"
                  type="button"
                  key={station.id}
                  onClick={() => {
                    if (Number(selectedStationId) !== Number(station.id)) {
                      setSelectedStationId(station.id);
                      setOfficerSearch("");
                      setReportFrom("");
                      setReportTo("");
                    }
                  }}
                  className={`!h-auto min-h-[76px] w-full justify-start whitespace-normal border-l-4 p-4 text-left transition ${
                    isSelected
                      ? "border-red-500 bg-red-50"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div className="flex w-full min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          isSelected
                            ? "bg-red-100 text-red-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Building2 size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          title={station.station_name || "Police Station"}
                          className="line-clamp-2 break-words text-sm font-semibold leading-5 text-gray-800"
                        >
                          {station.station_name}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                            {station.officer_count ??
                              station.employee_count ??
                              0}{" "}
                            Officers
                          </span>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] ${
                              Number(station.is_active) === 1
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {Number(station.is_active) === 1
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      size={17}
                      className={`mt-1 shrink-0 ${
                        isSelected
                          ? "text-red-500"
                          : "text-gray-300"
                      }`}
                    />
                  </div>
                </Button>
              );
            })}
          </div>
        </section>

        {/* ========================================
            RIGHT COLUMN - OFFICERS
        ======================================== */}

        <section className="flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
          {!selectedStation ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <Building2 size={40} className="mb-3 text-gray-300" />

              <h3 className="font-semibold text-gray-700">
                Select a police station
              </h3>

              <p className="mt-1 text-sm text-gray-400">
                Select a station from the left panel to view its officers.
              </p>
            </div>
          ) : (
            <>
              {/* STATION HEADER */}

              <div className="shrink-0 border-b p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <Building2
                        size={19}
                        className="mt-0.5 shrink-0 text-red-500"
                      />

                      <h2
                        title={selectedStation.station_name}
                        className="min-w-0 break-words text-sm font-semibold leading-5 text-gray-800"
                      >
                        {selectedStation.station_name}
                      </h2>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      District: {selectedStation.district || "N/A"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-nowrap gap-2">
                    <Button variant="outline" size="sm"
                      type="button"
                      onClick={() => openEditStation(selectedStation)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil size={14} />
                      Edit Station
                    </Button>

                    <Button variant="outline" size="sm"
                      type="button"
                      onClick={() => handleDeleteStation(selectedStation)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              {/* OFFICER HEADER + SEARCH / DATE FILTERS / EXCEL REPORT */}

              <div className="shrink-0 border-b p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-gray-800">
                      <Users size={17} />
                      Police Station Officers
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Click an officer to see the days visited.
                    </p>
                  </div>

                  <Button variant="default" size="sm"
                    type="button"
                    onClick={openAddOfficer}
                    disabled={Number(selectedStation.is_active) !== 1}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={15} />
                    Add Officer
                  </Button>
                </div>

                <div className="grid grid-cols-[minmax(150px,1fr)_138px_138px_auto] items-end gap-2 overflow-x-auto">
                  <div className="min-w-[150px]">
                    <Label className="mb-1 block text-[11px] font-medium text-gray-600">
                      Search Officer
                    </Label>
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <Input
                        type="text"
                        value={officerSearch}
                        onChange={(e) => setOfficerSearch(e.target.value)}
                        placeholder="Search"
                        className="h-9 w-full rounded-lg border py-2 pl-9 pr-3 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="report-from"
                      className="mb-1 block text-[11px] font-medium text-gray-600"
                    >
                      From Date
                    </Label>
                    <Input
                      id="report-from"
                      type="date"
                      value={reportFrom}
                      max={reportTo || undefined}
                      onChange={(e) => setReportFrom(e.target.value)}
                      className="h-9 w-full rounded-lg border bg-white px-2 py-2 text-xs outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="report-to"
                      className="mb-1 block text-[11px] font-medium text-gray-600"
                    >
                      To Date
                    </Label>
                    <Input
                      id="report-to"
                      type="date"
                      value={reportTo}
                      min={reportFrom || undefined}
                      onChange={(e) => setReportTo(e.target.value)}
                      className="h-9 w-full rounded-lg border bg-white px-2 py-2 text-xs outline-none focus:border-green-500"
                    />
                  </div>

                  <Button variant="outline" size="sm"
                    type="button"
                    onClick={() => handleDownloadReport()}
                    disabled={downloadingKey !== null}
                    className="flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap 
                    rounded-lg bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingKey === "station" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FileSpreadsheet size={14} />
                    )}
                    Excel Report
                  </Button>
                </div>
              </div>

              {/* SCROLLABLE OFFICER RECORDS */}

              <div className="min-h-0 flex-1 divide-y overflow-y-auto">
                {officers.map((officer) => {
                  const isExpanded = expandedOfficerId === officer.id;

                  return (
                    <div key={officer.id}>
                      {/* Clickable officer row */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => toggleOfficer(officer.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;

                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleOfficer(officer.id);
                          }
                        }}
                        className={`flex cursor-pointer flex-col gap-3 p-4 transition hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 sm:flex-row sm:items-center sm:justify-between ${
                          isExpanded ? "bg-gray-50" : ""
                        }`}
                      >
                        {/* Officer details */}
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-full bg-gray-100 p-2.5 text-gray-500">
                            <UserRound size={20} />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-800">
                              {officer.name}
                            </h4>

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Phone size={12} />
                                {officer.phone_number || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions and expand arrow */}
                        <div className="flex shrink-0 items-center justify-between gap-3">
                          {/* Action buttons: must NOT toggle the row */}
                          <div
                            className="flex flex-wrap gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="outline" size="sm"
                              type="button"
                              onClick={() => handleDownloadReport(officer)}
                              disabled={downloadingKey !== null}
                              title="Download this officer's visit report (Excel)"
                              className="flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {downloadingKey === `officer-${officer.id}` ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <FileSpreadsheet size={14} />
                              )}
                              Report
                            </Button>

                            <Button variant="outline" size="sm"
                              type="button"
                              onClick={() => openEditOfficer(officer)}
                              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil size={14} />
                              Edit
                            </Button>

                            <Button variant="outline" size="sm"
                              type="button"
                              onClick={() => handleDeleteOfficer(officer)}
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={14} />
                              Delete
                            </Button>
                          </div>

                          {/* Arrow at far right: clicks bubble up to the row */}
                          <ChevronDown
                            size={18}
                            className={`shrink-0 transition-transform duration-200 ${
                              isExpanded
                                ? "rotate-180 text-red-500"
                                : "text-gray-400"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded day-wise report table */}
                      {isExpanded && (
                        <OfficerReportPanel
                          stationId={selectedStation.id}
                          officerId={officer.id}
                          from={reportFrom}
                          to={reportTo}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Initial loading */}
                {officerLoading && officers.length === 0 && (
                  <div className="py-10 text-center text-sm text-gray-500">
                    <Loader2 className="mx-auto mb-2 animate-spin" />
                    Loading officers...
                  </div>
                )}

                {/* Empty state */}
                {!officerLoading && officers.length === 0 && (
                  <div className="py-12 text-center">
                    <Users
                      size={35}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="text-sm font-medium text-gray-600">
                      No officers found
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Add an officer to this police station.
                    </p>
                  </div>
                )}

                {/* Loading more officers */}
                {officerLoading && officers.length > 0 && (
                  <div className="py-4 text-center text-xs text-gray-500">
                    <Loader2
                      size={16}
                      className="mr-2 inline animate-spin"
                    />
                    Loading more officers...
                  </div>
                )}
              </div>

              {/* PAGINATION */}

              {officers.length > 0 && (
                <div className="shrink-0 border-t bg-gray-50 p-4">
                  {officerHasMore ? (
                    <Button variant="outline" size="sm"
                      type="button"
                      onClick={() => loadOfficers(false)}
                      disabled={officerLoading}
                      className="w-full rounded-lg border bg-white py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {officerLoading ? "Loading..." : "Load More"}
                    </Button>
                  ) : (
                    <></>
                    // <p className="text-center text-xs text-gray-400">
                    //   All officers loaded.
                    // </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ========================================
          POLICE STATION MODAL
      ======================================== */}

      {stationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {editingStation
                    ? "Edit Police Station"
                    : "Add Police Station"}
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Enter station name and district.
                </p>
              </div>

              <Button variant="ghost" size="icon-sm"
                type="button"
                onClick={closeStationModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </Button>
            </div>

            <form
              onSubmit={handleStationSubmit}
              className="space-y-4 p-4"
            >
              <div>
                <Label className="mb-1 block text-xs font-medium text-gray-700">
                  Police Station Name *
                </Label>

                <Input
                  type="text"
                  value={stationForm.station_name}
                  maxLength={150}
                  onChange={(e) =>
                    setStationForm((previous) => ({
                      ...previous,
                      station_name: e.target.value.slice(0, 150),
                    }))
                  }
                  placeholder="Enter police station name"
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {stationForm.station_name.length}/150
                </p>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-medium text-gray-700">
                  District
                </Label>

                <Input
                  type="text"
                  value={stationForm.district}
                  onChange={(e) =>
                    setStationForm((previous) => ({
                      ...previous,
                      district: e.target.value,
                    }))
                  }
                  placeholder="Enter district name of Police Station"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="ghost" size="icon-sm"
                  type="button"
                  onClick={closeStationModal}
                  className="rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>

                <Button variant="default" size="sm"
                  type="submit"
                  disabled={isCreatingStation || isUpdatingStation}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {(isCreatingStation || isUpdatingStation) && (
                    <Loader2 size={15} className="animate-spin" />
                  )}

                  {editingStation ? "Save Changes" : "Add Station"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================
          OFFICER MODAL
      ======================================== */}

      {officerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {editingOfficer ? "Edit Officer" : "Add Officer"}
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  {selectedStation?.station_name}
                </p>
              </div>

              <Button variant="ghost" size="icon-sm"
                type="button"
                onClick={closeOfficerModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </Button>
            </div>

            <form
              onSubmit={handleOfficerSubmit}
              className="space-y-4 p-4"
            >
              <div>
                <Label className="mb-1 block text-xs font-medium text-gray-700">
                  Officer Name *
                </Label>

                <Input
                  type="text"
                  value={officerForm.name}
                  maxLength={150}
                  onChange={(e) =>
                    setOfficerForm((previous) => ({
                      ...previous,
                      name: e.target.value.slice(0, 150),
                    }))
                  }
                  placeholder="Enter officer name"
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {officerForm.name.length}/150
                </p>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-medium text-gray-700">
                  Phone Number
                </Label>

                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={officerForm.phone_number}
                  onChange={(e) =>
                    setOfficerForm((previous) => ({
                      ...previous,
                      phone_number: e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10),
                    }))
                  }
                  placeholder="Enter 10-digit phone number"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm"
                  type="button"
                  onClick={closeOfficerModal}
                  className="rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>

                <Button variant="default" size="sm"
                  type="submit"
                  disabled={isCreatingOfficer || isUpdatingOfficer}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {(isCreatingOfficer || isUpdatingOfficer) && (
                    <Loader2 size={15} className="animate-spin" />
                  )}

                  {editingOfficer ? "Save Changes" : "Add Officer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteAlertModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingStation || isDeletingOfficer}
        itemName={
          deleteTarget?.type === "station"
            ? `police station "${deleteTarget.item.station_name}"`
            : deleteTarget?.type === "officer"
              ? `officer "${deleteTarget.item.name}"`
              : "this item"
        }
      />
    </div>
  );
} 