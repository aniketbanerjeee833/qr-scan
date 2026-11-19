
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  useCreatePoliceStationMutation,
  useGetPoliceStationsQuery,
  useUpdatePoliceStationMutation,
  useUpdatePoliceStationStatusMutation,
  useDeletePoliceStationMutation,
  useCreateStationOfficerMutation,
  useLazyGetStationOfficersQuery,
  useUpdateStationOfficerMutation,
  useDeleteStationOfficerMutation,
} from "@/redux/api/policeStationApi";

import {
  Building2,
  Users,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  Power,
  X,
  Phone,
  UserRound,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_STATION_FORM = {
  station_name: "",
  district: "",
};

const EMPTY_OFFICER_FORM = {
  name: "",
  phone_number: "",
};

export default function PoliceStationManagement() {
  // ========================================
  // API
  // ========================================

  const {
    data: stationResponse,
    isLoading: isLoadingStations,
    isFetching: isFetchingStations,
    refetch: refetchStations,
  } = useGetPoliceStationsQuery({ limit: 100 });

  const [createPoliceStation, { isLoading: isCreatingStation }] =
    useCreatePoliceStationMutation();

  const [updatePoliceStation, { isLoading: isUpdatingStation }] =
    useUpdatePoliceStationMutation();

  const [updatePoliceStationStatus] =
    useUpdatePoliceStationStatusMutation();

  const [deletePoliceStation] =
    useDeletePoliceStationMutation();

  const [createStationOfficer, { isLoading: isCreatingOfficer }] =
    useCreateStationOfficerMutation();

  const [triggerOfficers] = useLazyGetStationOfficersQuery();

  const [updateStationOfficer, { isLoading: isUpdatingOfficer }] =
    useUpdateStationOfficerMutation();

  const [deleteStationOfficer] =
    useDeleteStationOfficerMutation();

  const stations = stationResponse?.data || [];

  // ========================================
  // SELECTED STATION
  // ========================================

  const [selectedStationId, setSelectedStationId] = useState(null);

  const selectedStation =
    stations.find(
      (station) => Number(station.id) === Number(selectedStationId)
    ) || null;

  useEffect(() => {
    if (!stations.length) {
      setSelectedStationId(null);
      return;
    }

    const selectedStillExists = stations.some(
      (station) => Number(station.id) === Number(selectedStationId)
    );

    if (!selectedStationId || !selectedStillExists) {
      setSelectedStationId(stations[0].id);
    }
  }, [stations, selectedStationId]);

  // ========================================
  // MODALS
  // ========================================

  const [stationModal, setStationModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [stationForm, setStationForm] = useState(EMPTY_STATION_FORM);

  const [officerModal, setOfficerModal] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [officerForm, setOfficerForm] = useState(EMPTY_OFFICER_FORM);

  // ========================================
  // OFFICER STATE + CURSOR PAGINATION
  // ========================================

  const [officers, setOfficers] = useState([]);
  const [officerSearch, setOfficerSearch] = useState("");
  const [officerLoading, setOfficerLoading] = useState(false);
  const [officerHasMore, setOfficerHasMore] = useState(false);

  const officerCursorRef = useRef(null);
  const officerLoadingRef = useRef(false);
  const officerHasMoreRef = useRef(true);
  const officerRequestRef = useRef(0);

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
    [selectedStationId, officerSearch, triggerOfficers]
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

    if (!station_name ) {
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
          setSelectedStationId(response.data.id);
          setOfficerSearch("");
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
  // STATION STATUS
  // ========================================

  const handleStationStatus = async (station) => {
    const nextStatus =
      Number(station.is_active) === 1 ? 0 : 1;

    try {
      await updatePoliceStationStatus({
        id: station.id,
        is_active: nextStatus,
      }).unwrap();

      toast.success(
        nextStatus
          ? "Police station activated."
          : "Police station deactivated."
      );

      await refetchStations();
    } catch (error) {
      toast.error(
        error?.data?.message || "Failed to update station status."
      );
    }
  };

  // ========================================
  // DELETE STATION
  // ========================================

  const handleDeleteStation = async (station) => {
    const confirmed = window.confirm(
      `Delete "${station.station_name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deletePoliceStation(station.id).unwrap();

      toast.success("Police station deleted successfully.");

      if (Number(selectedStationId) === Number(station.id)) {
        setSelectedStationId(null);
        setOfficers([]);
        setOfficerSearch("");
      }

      await refetchStations();
    } catch (error) {
      toast.error(
        error?.data?.message || "Failed to delete police station."
      );
    }
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

    // if (!payload.phone_number) {
    //   toast.error("Phone number is required.");
    //   return;
    // }

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

  const handleDeleteOfficer = async (officer) => {
    const confirmed = window.confirm(
      `Delete officer "${officer.name}"?`
    );

    if (!confirmed) return;

    try {
      await deleteStationOfficer({
        stationId: selectedStationId,
        officerId: officer.id,
      }).unwrap();

      toast.success("Officer deleted successfully.");

      await loadOfficers(true);
      await refetchStations();
    } catch (error) {
      toast.error(
        error?.data?.message || "Failed to delete officer."
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
    // <div className="flex min-h-full flex-col bg-gray-50 p-3 md:p-5">
<div className="flex h-[calc(100vh-64px)] min-h-0 flex-col overflow-hidden bg-gray-50 p-3 md:p-5">
      {/* PAGE HEADER */}

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
            <Building2 size={23} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Police Station Management
            </h1>

            <p className="text-xs text-gray-500">
              Manage police stations and their officers.
            </p>
          </div>
        </div>

        <button
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
        </button>
      </div>

      {/* TWO COLUMN LAYOUT - FULL AVAILABLE HEIGHT */}

      {/* <div className="grid flex-1 min-h-[650px] grid-cols-1 items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"> */}
<div className="grid flex-1 min-h-0 grid-cols-1 items-stretch gap-4 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ========================================
            LEFT COLUMN - POLICE STATIONS
        ======================================== */}

        {/* <section className="flex min-h-[450px] h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm"> */}
<section className="flex min-h-0 h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="shrink-0 border-b p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-800">
                  Police Stations
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {stations.length} station(s)
                </p>
              </div>

              <button
                type="button"
                onClick={openAddStation}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                <Plus size={15} />
                Add Station
              </button>
            </div>
          </div>

          {/* Scrollable station list */}

          {/* <div className="flex-1 divide-y overflow-y-auto"> */}
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
                  No police stations found
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Add your first police station.
                </p>
              </div>
            )}

            {stations.map((station) => {
              const isSelected =
                Number(selectedStationId) === Number(station.id);

              return (
                <button
                  type="button"
                  key={station.id}
                  onClick={() => {
                    setSelectedStationId(station.id);
                    setOfficerSearch("");
                  }}
                  className={`w-full border-l-4 p-4 text-left transition ${
                    isSelected
                      ? "border-red-500 bg-red-50"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
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

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {station.station_name}
                        </p>
{/* 
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={12} />
                          {station.district || "No district"}
                        </p> */}

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
                </button>
              );
            })}
          </div>
        </section>

        {/* ========================================
            RIGHT COLUMN - OFFICERS
        ======================================== */}
<section className="flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        {/* <section className="flex min-h-[450px] h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm"> */}

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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2
                        size={19}
                        className="shrink-0 text-red-500"
                      />

                      <h2 className="truncate font-semibold text-gray-800">
                        {selectedStation.station_name}
                      </h2>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      District: {selectedStation.district || "N/A"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditStation(selectedStation)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil size={14} />
                      Edit Station
                    </button>

                    {/* <button
                      type="button"
                      onClick={() => handleStationStatus(selectedStation)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Power size={14} />
                      {Number(selectedStation.is_active) === 1
                        ? "Deactivate"
                        : "Activate"}
                    </button> */}

                    <button
                      type="button"
                      onClick={() => handleDeleteStation(selectedStation)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* OFFICER LIST HEADER */}

              <div className="shrink-0 border-b p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-gray-800">
                      <Users size={17} />
                      Police Station Officers
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Officers assigned to this police station.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAddOfficer}
                    disabled={Number(selectedStation.is_active) !== 1}
                    className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2.5 text-xs font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={15} />
                    Add Officer
                  </button>
                </div>

                <div className="relative mt-4">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={officerSearch}
                    onChange={(e) => setOfficerSearch(e.target.value)}
                    placeholder="Search officer by name or phone number..."
                    className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </div>

              {/* SCROLLABLE OFFICER RECORDS */}

              {/* <div className="flex-1 divide-y overflow-y-auto"> */}
<div className="min-h-0 flex-1 divide-y overflow-y-auto">
                {officers.map((officer) => (
                  <div
                    key={officer.id}
                    className="flex flex-col gap-3 p-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                  >
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

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditOfficer(officer)}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteOfficer(officer)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {officerLoading && officers.length === 0 && (
                  <div className="py-10 text-center text-sm text-gray-500">
                    <Loader2 className="mx-auto mb-2 animate-spin" />
                    Loading officers...
                  </div>
                )}

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
                    <button
                      type="button"
                      onClick={() => loadOfficers(false)}
                      disabled={officerLoading}
                      className="w-full rounded-lg border bg-white py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {officerLoading ? "Loading..." : "Load More"}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-gray-400">
                      All officers loaded.
                    </p>
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

              <button
                type="button"
                onClick={closeStationModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleStationSubmit}
              className="space-y-4 p-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Police Station Name *
                </label>

                <input
                  type="text"
                  value={stationForm.station_name}
                  onChange={(e) =>
                    setStationForm((previous) => ({
                      ...previous,
                      station_name: e.target.value,
                    }))
                  }
                  placeholder="Enter police station name"
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  District 
                </label>

                <input
                  type="text"
                  value={stationForm.district}
                  onChange={(e) =>
                    setStationForm((previous) => ({
                      ...previous,
                      district: e.target.value,
                    }))
                  }
                  placeholder="Enter district name"
                  //required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeStationModal}
                  className="rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreatingStation || isUpdatingStation}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {(isCreatingStation || isUpdatingStation) && (
                    <Loader2 size={15} className="animate-spin" />
                  )}

                  {editingStation ? "Save Changes" : "Add Station"}
                </button>
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

              <button
                type="button"
                onClick={closeOfficerModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleOfficerSubmit}
              className="space-y-4 p-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Officer Name *
                </label>

                <input
                  type="text"
                  value={officerForm.name}
                  onChange={(e) =>
                    setOfficerForm((previous) => ({
                      ...previous,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter officer name"
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Phone Number 
                </label>

              <input
  type="tel"
  inputMode="numeric"
  maxLength={10}
  value={officerForm.phone_number}
  onChange={(e) =>
    setOfficerForm((previous) => ({
      ...previous,
      phone_number: e.target.value.replace(/\D/g, "").slice(0, 10),
    }))
  }
  placeholder="Enter 10-digit phone number"
  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
/>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeOfficerModal}
                  className="rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreatingOfficer || isUpdatingOfficer}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {(isCreatingOfficer || isUpdatingOfficer) && (
                    <Loader2 size={15} className="animate-spin" />
                  )}

                  {editingOfficer ? "Save Changes" : "Add Officer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
