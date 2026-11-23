import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import {
  useGetAllLocationQRsInfiniteQuery,
  useUpdateLocationQRMutation,
  useRegenerateLocationQRMutation,
  useDeleteLocationQRMutation,
} from "@/redux/api/locationQRApi";

import { useGetPoliceStationOptionsQuery } from "@/redux/api/policeStationApi";

import {
  MapPin,
  QrCode,
  Download,
  Search,
  RefreshCw,
  X,
  Loader2,
  Navigation,
  Pencil,
  RotateCw,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import DeleteAlertModal from "@/components/Modal/DeleteAlertModal";
import VirtualList from "@/components/common/VirtualList";
import { downloadLocationQR } from "@/utils/downloadLocationQr";

const PAGE_SIZE = 10;

// const API_ORIGIN = "http://192.168.29.2:4000";
const API_ORIGIN = "http://192.168.0.103:4000";
//const API_ORIGIN="https://448f-115-187-48-18.ngrok-free.app"

const getImageUrl = (imagePath) => {
  if (!imagePath) return "";

  return `${API_ORIGIN}/${imagePath.replace(/^\/+/, "")}`;
};

export default function LocationQRManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ============================================
  // FILTERS
  // ============================================

  // Typed text updates instantly; the debounced text is what is sent to
  // the API and written to the URL.
  const [search, setSearch] = useState(
    () => searchParams.get("search") || ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("search")?.trim() || ""
  );

  const [selectedStationId, setSelectedStationId] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Reflect the applied search in the URL
  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (debouncedSearch) {
          next.set("search", debouncedSearch);
        } else {
          next.delete("search");
        }

        return next;
      },
      { replace: true }
    );
  }, [debouncedSearch, setSearchParams]);

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedStationId("");
  };

  // ============================================
  // API
  // ============================================

  const [updateLocationQR, { isLoading: isUpdating }] =
    useUpdateLocationQRMutation();

  const [regenerateLocationQR, { isLoading: isRegenerating }] =
    useRegenerateLocationQRMutation();

  const [deleteLocationQR, { isLoading: isDeleting }] =
    useDeleteLocationQRMutation();

  // Flat station list for the two dropdowns
  const { data: stationResponse, isLoading: isLoadingStations } =
    useGetPoliceStationOptionsQuery();

  const stations = stationResponse?.data || [];

  // ============================================
  // QR LIST (INFINITE QUERY)
  // ============================================

  const {
    currentData: qrResponse,
    isLoading: isLoadingQRs,
    isFetching: isFetchingQRs,
    isFetchingNextPage: isFetchingNextQRPage,
    hasNextPage: qrHasMore,
    fetchNextPage: fetchNextQRPage,
    refetch: refetchQRs,
  } = useGetAllLocationQRsInfiniteQuery({
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(selectedStationId ? { station_id: selectedStationId } : {}),
  });

  // Flatten the cursor pages for the VirtualList
  const qrRecords = useMemo(
    () => qrResponse?.pages?.flatMap((page) => page?.data ?? []) ?? [],
    [qrResponse]
  );

  const loadMoreQRs = () => {
    if (qrHasMore && !isFetchingQRs) {
      fetchNextQRPage();
    }
  };

  // ============================================
  // MODAL STATE
  // ============================================

  const [selectedQR, setSelectedQR] = useState(null);
  const [editingQR, setEditingQR] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [editForm, setEditForm] = useState({
    location_name: "",
    latitude: "",
    longitude: "",
    is_active: 1,
    police_station_id: "",
  });

  // ============================================
  // EDIT HANDLERS
  // ============================================

  const openEditModal = (item) => {
    setEditingQR(item);

    setEditForm({
      location_name: item.location_name ?? "",
      latitude: String(item.latitude ?? ""),
      longitude: String(item.longitude ?? ""),
      is_active: Number(item.is_active),
      police_station_id: String(item.police_station_id ?? ""),
    });
  };

  const closeEditModal = () => {
    if (isUpdating) return;
    setEditingQR(null);
  };

  const handleEditChange = (field, value) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // ============================================
  // UPDATE LOCATION QR
  // ============================================

  const handleUpdateQR = async (event) => {
    event.preventDefault();

    if (!editingQR) return;

    if (editForm.latitude === "" || editForm.longitude === "") {
      toast.error("Latitude and longitude are required.");
      return;
    }

    const lat = Number(editForm.latitude);
    const lng = Number(editForm.longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      toast.error("Please enter valid coordinates.");
      return;
    }

    if (!editForm.police_station_id) {
      toast.error("Please select a police station.");
      return;
    }

    const payload = {
      id: editingQR.id,
      latitude: lat,
      longitude: lng,
      is_active: Number(editForm.is_active),
      police_station_id: Number(editForm.police_station_id),
      location_name: editForm.location_name.trim() || null,
    };

    try {
      await updateLocationQR(payload).unwrap();

      setEditingQR(null);

      // The list refreshes automatically through tag invalidation.
      toast.success("Location updated successfully.");
    } catch (error) {
      console.error("Update QR:", error);

      toast.error(
        error?.data?.message || "Failed to update location."
      );
    }
  };

  // ============================================
  // REGENERATE QR
  // ============================================

  const handleRegenerateQR = async (item) => {
    const confirmed = window.confirm(
      `Regenerate QR for "${item.location_name || "Unnamed Location"}"?\n\n` +
        "The old printed QR will stop working. " +
        "You must download and print the new QR."
    );

    if (!confirmed) return;

    try {
      const response = await regenerateLocationQR(item.id).unwrap();

      toast.success(
        response.message || "QR regenerated successfully."
      );

      if (response?.data) {
        setSelectedQR(response.data);
      }
    } catch (error) {
      console.error("Regenerate QR:", error);

      toast.error(
        error?.data?.message || "Failed to regenerate QR."
      );
    }
  };

  // ============================================
  // DOWNLOAD QR
  // ============================================

  // const handleDownloadQR = async (item) => {
  //   if (!item.qr_image) {
  //     toast.error("QR image is not available.");
  //     return;
  //   }

  //   let blobUrl;

  //   try {
  //     const response = await fetch(getImageUrl(item.qr_image), {
  //       credentials: "include",
  //       // headers: {
  //       //   "ngrok-skip-browser-warning": "true",
  //       // },
  //     });

  //     if (!response.ok) {
  //       throw new Error("Unable to fetch QR image.");
  //     }

  //     const blob = await response.blob();
  //     blobUrl = window.URL.createObjectURL(blob);

  //     const link = document.createElement("a");
  //     link.href = blobUrl;
  //     link.download = `${(item.location_name || "Location").replace(
  //       /[^a-z0-9]/gi,
  //       "_"
  //     )}_QR.png`;

  //     document.body.appendChild(link);
  //     link.click();
  //     link.remove();

  //     toast.success("QR download started.");
  //   } catch (error) {
  //     console.error("Download QR:", error);
  //     toast.error("Failed to download QR image. Check CORS settings.");
  //   } finally {
  //     if (blobUrl) {
  //       setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  //     }
  //   }
  // };

const handleDownloadQR = async (item) => {
  if (!item.qr_image) {
    toast.error("QR image is not available.");
    return;
  }

  try {
    await downloadLocationQR({
      logoUrl: "/assets/images/kolkata-police-logo.jpg",
      qrImageUrl: getImageUrl(item.qr_image),
      locationName: item.location_name,
      stationName: item.station_name,
      website: "www.bidhannagarcitypolice.gov.in",
      phone: "Control Room: 033-23358788/033-23410465",
      fileName: `${(
        item.location_name || "Location"
      ).replace(/[^a-z0-9]/gi, "_")}_QR.png`,
    });

    toast.success("Complete location QR downloaded.");
  } catch (error) {
    console.error("Download QR:", error);
    toast.error(error?.message || "Failed to download location QR.");
  }
};




  // ============================================
  // DELETE QR
  // ============================================

  const handleDeleteClick = (item) => {
    setDeleteTarget(item);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteLocationQR(deleteTarget.id).unwrap();

      toast.success("Location QR deleted successfully.");

      if (selectedQR?.id === deleteTarget.id) {
        setSelectedQR(null);
      }

      setDeleteTarget(null);
    } catch (error) {
      console.error("Delete location QR:", error);

      toast.error(
        error?.data?.message || "Failed to delete location QR."
      );
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden bg-gray-50 p-3 md:p-5">
      {/* PAGE HEADING */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
            <QrCode size={23} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-800">
              QR Management
            </h1>

            <p className="text-xs text-gray-700">
              Manage location-based QR codes.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={() => navigate("/location-qrs/create")}
          className="bg-red-500 text-white hover:bg-red-600"
        >
          <Plus size={17} />
          Create QR
        </Button>
      </div>

      {/* GENERATED QR LIST */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        {/* LIST HEADER */}
        <div className="shrink-0 border-b p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-800">
                Generated Location QRs
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Preview, edit, regenerate, and download QR codes. Scroll to
                load more records.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetchQRs()}
              disabled={isFetchingQRs}
              className="text-xs text-gray-600"
            >
              <RefreshCw
                size={14}
                className={isFetchingQRs ? "animate-spin" : ""}
              />
              Refresh
            </Button>
          </div>

          {/* FILTER + SEARCH */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* POLICE STATION FILTER */}
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-medium text-gray-700">
                Filter by Police Station
              </Label>

              <Select
                value={selectedStationId || "all"}
                onValueChange={(value) =>
                  setSelectedStationId(value === "all" ? "" : value)
                }
                disabled={isLoadingStations}
              >
                <SelectTrigger className="!h-10 w-full bg-white">
                  <SelectValue placeholder="All Police Stations" />
                </SelectTrigger>

                <SelectContent
                  position="popper"
                  side="bottom"
                  sideOffset={0}
                  align="start"
                  className="max-h-64"
                >
                  <SelectItem value="all">All Police Stations</SelectItem>

                  {stations.map((station) => (
                    <SelectItem
                      key={station.id}
                      value={String(station.id)}
                    >
                      {station.station_name}
                      {station.district ? ` - ${station.district}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SEARCH + RESET */}
            <div className="space-y-1.5 md:col-span-2">
              <Label
                htmlFor="qr-search"
                className="text-xs font-medium text-gray-700"
              >
                Search
              </Label>

              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <Input
                    id="qr-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className="h-10 w-full pl-10"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetFilters}
                  disabled={!search && !selectedStationId}
                  className="h-10 shrink-0 text-sm font-medium text-gray-600"
                >
                  <RefreshCw size={15} />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* QR RECORDS - VIRTUALIZED + INFINITE SCROLL */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {(isLoadingQRs || isFetchingQRs) && qrRecords.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto mb-2 animate-spin" />
              Loading QR records...
            </div>
          ) : (
            <VirtualList
              items={qrRecords}
              getItemKey={(item) => item.id}
              estimateSize={112}
              overscan={5}
              hasMore={Boolean(qrHasMore)}
              isLoadingMore={isFetchingNextQRPage}
              isBusy={isFetchingQRs}
              onEndReached={loadMoreQRs}
              endThreshold={5}
              loadingText="Loading more QR records..."
              emptyMessage="No location QR codes found."
              className="h-full overscroll-contain"
              renderItem={(item, index) => (
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 transition hover:bg-gray-50 lg:flex-row lg:items-center lg:justify-between">
                  {/* SERIAL NUMBER */}
                  <div className="flex shrink-0 items-center gap-2 lg:w-16">
                    <span className="text-sm font-semibold tabular-nums text-gray-700">
                      {index + 1}
                    </span>
                  </div>

                  {/* LOCATION DETAILS */}
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-red-50 p-2.5 text-red-600">
                      <MapPin size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        title={item.station_name || "N/A"}
                        className="break-words text-xs font-medium leading-5 text-gray-800"
                      >
                        Police Station: {item.station_name || "N/A"}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Navigation size={13} />
                          {item.latitude}, {item.longitude}
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 ${
                            Number(item.is_active) === 1
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {Number(item.is_active) === 1
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      <p
                        title={item.location_name || "N/A"}
                        className="mt-1 break-words text-xs text-gray-700"
                      >
                        Location: {item.location_name || "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:shrink-0 lg:flex-nowrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQR(item)}
                      className="text-xs text-gray-600"
                    >
                      <QrCode size={15} />
                      Preview
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleDownloadQR(item)}
                      className="bg-red-500 text-xs text-white hover:bg-red-600"
                    >
                      <Download size={15} />
                      Download
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(item)}
                      className="border-blue-200 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateQR(item)}
                      disabled={isRegenerating}
                      className="border-orange-200 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                    >
                      <RotateCw size={14} />
                      Regenerate
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(item)}
                      className="border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>

      {/* ============================================
          EDIT MODAL
      ============================================ */}

      {editingQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-semibold text-gray-800">
                  Edit Location QR
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Update location details without changing its QR.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeEditModal}
                disabled={isUpdating}
                aria-label="Close"
                className="text-gray-500"
              >
                <X size={20} />
              </Button>
            </div>

            {/* EDIT FORM */}
            <form onSubmit={handleUpdateQR} className="space-y-4 p-4">
              {/* STATIC QR IMAGE PREVIEW */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <Label className="mb-2 block text-xs font-medium text-gray-700">
                  Existing QR Code
                </Label>

                {editingQR.qr_image ? (
                  <img
                    src={getImageUrl(editingQR.qr_image)}
                    alt={`QR for ${editingQR.location_name || "Location"}`}
                    className="mx-auto h-36 w-36 object-contain"
                  />
                ) : (
                  <p className="py-6 text-center text-xs text-gray-500">
                    QR image is not available.
                  </p>
                )}

                <p className="mt-2 text-center text-[11px] text-gray-500">
                  This QR image is fixed and cannot be changed from this
                  form.
                </p>
              </div>

              {/* POLICE STATION */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Police Station *
                </Label>

                <Select
                  value={editForm.police_station_id}
                  onValueChange={(value) =>
                    handleEditChange("police_station_id", value)
                  }
                  disabled={isLoadingStations}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select police station" />
                  </SelectTrigger>

                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={6}
                    align="start"
                    className="max-h-64"
                  >
                    {stations.map((station) => (
                      <SelectItem
                        key={station.id}
                        value={String(station.id)}
                      >
                        {station.station_name}
                        {station.district ? ` - ${station.district}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* LOCATION NAME */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Location Name
                </Label>

                <Input
                  type="text"
                  value={editForm.location_name}
                  onChange={(e) =>
                    handleEditChange("location_name", e.target.value)
                  }
                  className="h-10"
                />
              </div>

              {/* COORDINATES */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Latitude *
                  </Label>

                  <Input
                    type="number"
                    step="any"
                    value={editForm.latitude}
                    onChange={(e) =>
                      handleEditChange("latitude", e.target.value)
                    }
                    required
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Longitude *
                  </Label>

                  <Input
                    type="number"
                    step="any"
                    value={editForm.longitude}
                    onChange={(e) =>
                      handleEditChange("longitude", e.target.value)
                    }
                    required
                    className="h-10"
                  />
                </div>
              </div>

              {/* STATUS */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Status
                </Label>

                <Select
                  value={String(editForm.is_active)}
                  onValueChange={(value) =>
                    handleEditChange("is_active", Number(value))
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>

                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={6}
                    align="start"
                  >
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEditModal}
                  disabled={isUpdating}
                  className="text-gray-600"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  {isUpdating && (
                    <Loader2 size={15} className="animate-spin" />
                  )}

                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          QR PREVIEW MODAL
      ============================================ */}

      {selectedQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* PREVIEW HEADER */}
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold text-gray-800">QR Preview</h3>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedQR(null)}
                aria-label="Close"
                className="text-gray-500"
              >
                <X size={20} />
              </Button>
            </div>

            {/* QR IMAGE */}
            <div className="space-y-3 p-5 text-center">
              {selectedQR.qr_image ? (
                <img
                  src={getImageUrl(selectedQR.qr_image)}
                  alt={`QR for ${selectedQR.location_name || "Location"}`}
                  className="mx-auto w-full max-w-[280px]"
                />
              ) : (
                <p className="py-10 text-sm text-red-500">
                  QR image is not available.
                </p>
              )}

              <h4 className="break-words font-semibold text-gray-800">
                {selectedQR.location_name || "Unnamed Location"}
              </h4>

              <p
                title={
                  selectedQR.station_name || "Police station not available"
                }
                className="whitespace-normal break-words text-sm text-gray-500"
              >
                {selectedQR.station_name || "N/A"}
              </p>

              <Button
                type="button"
                onClick={() => handleDownloadQR(selectedQR)}
                disabled={!selectedQR.qr_image}
                className="h-11 w-full bg-red-500 text-sm font-medium text-white hover:bg-red-600"
              >
                <Download size={17} />
                Download QR PNG
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      <DeleteAlertModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        itemName={deleteTarget?.location_name || "N/A"}
      />
    </div>
  );
}