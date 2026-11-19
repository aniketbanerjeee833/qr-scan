
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import {
  useLazyGetAllLocationQRsQuery,
  useUpdateLocationQRMutation,
  useRegenerateLocationQRMutation,
} from "@/redux/api/locationQRApi";

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
  Power,
  Plus,
} from "lucide-react";

const PAGE_SIZE = 10;

const API_ORIGIN = "http://192.168.0.103:4000";

const getImageUrl = (imagePath) => {
  if (!imagePath) return "";

  return `${API_ORIGIN}/${imagePath.replace(/^\/+/, "")}`;
};

export default function LocationQRManagement() {
  // ============================================
  // API
  // ============================================

  const [updateLocationQR, { isLoading: isUpdating }] =
    useUpdateLocationQRMutation();

  const [regenerateLocationQR, { isLoading: isRegenerating }] =
    useRegenerateLocationQRMutation();

  const [triggerQRs] = useLazyGetAllLocationQRsQuery();

  // ============================================
  // QR LIST STATE
  // ============================================

  const [qrRecords, setQrRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedQR, setSelectedQR] = useState(null);
  const [editingQR, setEditingQR] = useState(null);

  // ============================================
  // EDIT FORM
  // ============================================

  const [editForm, setEditForm] = useState({
    location_name: "",
    latitude: "",
    longitude: "",
    is_active: 1,
  });

  // ============================================
  // PAGINATION REFS
  // ============================================

  const cursorRef = useRef(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const requestIdRef = useRef(0);

  // ============================================
  // LOAD QR PAGE
  // ============================================

  const loadQRPage = useCallback(
    async (reset = false, searchTerm = search) => {
      if (loadingRef.current && !reset) return;
      if (!hasMoreRef.current && !reset) return;

      const requestId = ++requestIdRef.current;

      loadingRef.current = true;
      setLoadingMore(true);

      if (reset) {
        cursorRef.current = null;
        hasMoreRef.current = true;
        setHasMore(true);
        setQrRecords([]);
      }

      try {
        const params = {
          limit: PAGE_SIZE,
        };

        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }

        if (!reset && cursorRef.current) {
          params.cursor = cursorRef.current;
        }

        const response = await triggerQRs(params, false).unwrap();

        if (requestId !== requestIdRef.current) return;

        const rows = Array.isArray(response?.data)
          ? response.data
          : [];

        setQrRecords((previous) => {
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

        cursorRef.current = nextCursor;
        hasMoreRef.current = Boolean(nextCursor);
        setHasMore(Boolean(nextCursor));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;

        console.error("Fetch location QRs:", error);

        toast.error(
          error?.data?.message || "Unable to fetch QR records."
        );
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [search, triggerQRs]
  );

  // ============================================
  // INITIAL LOAD + SEARCH
  // ============================================

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQRPage(true, search);
    }, 300);

    return () => {
      clearTimeout(timer);
      requestIdRef.current++;
      loadingRef.current = false;
    };
  }, [search, loadQRPage]);

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
    });
  };

  const closeEditModal = () => {
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

    if (
      editForm.latitude === "" ||
      editForm.longitude === ""
    ) {
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

    const payload = {
      id: editingQR.id,
      latitude: lat,
      longitude: lng,
      is_active: Number(editForm.is_active),
    };

    // Preserve existing name if the field is blank.
    // if (editForm.location_name.trim()) {
    //   payload.location_name = editForm.location_name.trim();
    // }
    payload.location_name = editForm.location_name.trim() || null;

    try {
      await updateLocationQR(payload).unwrap();

      setEditingQR(null);

      toast.success("Location updated successfully.");

      await loadQRPage(true);
    } catch (error) {
      console.error("Update QR:", error);

      toast.error(
        error?.data?.message || "Failed to update location."
      );
    }
  };

  // ============================================
  // ACTIVATE / DEACTIVATE
  // ============================================

  const handleToggleActive = async (item) => {
    try {
      await updateLocationQR({
        id: item.id,
        is_active: item.is_active ? 0 : 1,
      }).unwrap();

      toast.success(
        item.is_active
          ? "Location deactivated successfully."
          : "Location activated successfully."
      );

      await loadQRPage(true);
    } catch (error) {
      console.error("Toggle location:", error);

      toast.error(
        error?.data?.message || "Failed to update status."
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

      await loadQRPage(true);
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

const handleDownloadQR = async (item) => {
  if (!item.qr_image) {
    toast.error("QR image is not available.");
    return;
  }

  let blobUrl;

  try {
    const response = await fetch(getImageUrl(item.qr_image));

    if (!response.ok) {
      throw new Error("Unable to fetch QR image.");
    }

    const blob = await response.blob();
    blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${(item.location_name || "Location").replace(
      /[^a-z0-9]/gi,
      "_"
    )}_QR.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    toast.success("QR download started.");
  } catch (error) {
    console.error("Download QR:", error);
    toast.error("Failed to download QR image. Check CORS settings.");
  } finally {
    if (blobUrl) {
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    }
  }
};

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-full space-y-5 bg-gray-50 p-3 md:p-5">

      {/* PAGE HEADING */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
            <QrCode size={23} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Location QR Management
            </h1>

            <p className="text-xs text-gray-500">
              Manage location-based QR codes.
            </p>
          </div>
        </div>

        <Link
          to="/location-qrs/create"
          className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
        >
          <Plus size={17} />
          Create Location QR
        </Link>
      </div>

      {/* GENERATED QR LIST */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

        {/* LIST HEADER */}

        <div className="border-b p-4">

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-800">
                Generated Location QRs
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Preview, edit, regenerate, and download QR codes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadQRPage(true)}
              disabled={loadingMore}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={loadingMore ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {/* SEARCH */}

          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search location name..."
              className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>

        {/* QR RECORDS */}

        <div className="divide-y">

          {qrRecords.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
            >

              {/* LOCATION DETAILS */}

              <div className="flex min-w-0 items-start gap-3">

                <div className="rounded-lg bg-red-50 p-2.5 text-red-600">
                  <MapPin size={20} />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-800">
                    {item.location_name || ""}
                  </h3>

                  <p className="mt-1 break-all text-xs text-gray-500">
                    {item.qr_code}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">

                    <span className="flex items-center gap-1">
                      <Navigation size={13} />
                      {item.latitude}, {item.longitude}
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 ${
                        item.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTIONS */}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">

                <button
                  type="button"
                  onClick={() => setSelectedQR(item)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  <QrCode size={15} />
                  Preview
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadQR(item)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
                >
                  <Download size={15} />
                  Download
                </button>

                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Pencil size={14} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  <Power size={14} />
                  {item.is_active ? "Deactivate" : "Activate"}
                </button>

                <button
                  type="button"
                  onClick={() => handleRegenerateQR(item)}
                  disabled={isRegenerating}
                  className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-orange-200 px-3 py-2 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 sm:col-span-1"
                >
                  <RotateCw size={14} />
                  Regenerate
                </button>

              </div>
            </div>
          ))}

          {/* EMPTY STATE */}

          {!loadingMore && qrRecords.length === 0 && (
            <div className="py-12 text-center">
              <QrCode
                size={35}
                className="mx-auto mb-3 text-gray-300"
              />

              <p className="text-sm font-medium text-gray-600">
                No location QR codes found.
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Click Create Location QR to add your first location.
              </p>

              <Link
                to="/location-qrs/create"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                <Plus size={16} />
                Create Location QR
              </Link>
            </div>
          )}

          {/* INITIAL LOADING */}

          {loadingMore && qrRecords.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto mb-2 animate-spin" />
              Loading QR records...
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="border-t bg-gray-50 p-4">

          {hasMore && (
            <button
              type="button"
              onClick={() => loadQRPage(false)}
              disabled={loadingMore}
              className="w-full rounded-lg border bg-white py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}

          {!hasMore && qrRecords.length > 0 && (
            <p className="text-center text-xs text-gray-400">
              All QR records loaded.
            </p>
          )}
        </div>
      </div>

      {/* ============================================
          EDIT MODAL
      ============================================ */}

      {editingQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-semibold text-gray-800">
                  Edit Location
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Update location details without changing its QR token.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* EDIT FORM */}

            <form
              onSubmit={handleUpdateQR}
              className="space-y-4 p-4"
            >

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Location Name (Optional)
                </label>

                <input
                  type="text"
                  value={editForm.location_name}
                  onChange={(e) =>
                    handleEditChange("location_name", e.target.value)
                  }
                  //placeholder="Leave blank to keep existing name"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Latitude *
                  </label>

                  <input
                    type="number"
                    step="any"
                    value={editForm.latitude}
                    onChange={(e) =>
                      handleEditChange("latitude", e.target.value)
                    }
                    required
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Longitude *
                  </label>

                  <input
                    type="number"
                    step="any"
                    value={editForm.longitude}
                    onChange={(e) =>
                      handleEditChange("longitude", e.target.value)
                    }
                    required
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                  />
                </div>

              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Status
                </label>

                <select
                  value={editForm.is_active}
                  onChange={(e) =>
                    handleEditChange("is_active", Number(e.target.value))
                  }
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-red-400"
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>

              {/* MODAL ACTIONS */}

              <div className="flex justify-end gap-2 border-t pt-4">

                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {isUpdating && (
                    <Loader2 size={15} className="animate-spin" />
                  )}

                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>

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
              <div>
                <h3 className="font-semibold text-gray-800">
                  Location QR
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  {/* {selectedQR.location_name || "Unnamed Location"} */}
                  {selectedQR.location_name || ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedQR(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
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

              <h4 className="font-semibold text-gray-800">
                {selectedQR.location_name || ""}
              </h4>

              <p className="break-all text-xs text-gray-500">
                {selectedQR.qr_code}
              </p>

              <button
                type="button"
                onClick={() => handleDownloadQR(selectedQR)}
                disabled={!selectedQR.qr_image}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                <Download size={17} />
                Download QR PNG
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
