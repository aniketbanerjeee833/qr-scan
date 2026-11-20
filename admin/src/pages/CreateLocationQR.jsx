import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  QrCode,
  Loader2,
  Building2,
} from "lucide-react";
import {
  useCreateLocationQRMutation,
} from "@/redux/api/locationQRApi";
import {
  useGetPoliceStationsQuery,
} from "@/redux/api/policeStationApi";
import { toast } from "react-toastify";

const emptyLocation = () => ({
  location_name: "",
  latitude: "",
  longitude: "",
});

export default function CreateLocationQR() {
  const navigate = useNavigate();

  const [policeStationId, setPoliceStationId] = useState("");

  const [locations, setLocations] = useState([emptyLocation()]);

  // Fetch police stations
  const {
    data: stationResponse,
    isLoading: isLoadingStations,
    isFetching: isFetchingStations,
  } = useGetPoliceStationsQuery({ limit: 100 });

  const stations = (stationResponse?.data || []).filter(
    (station) => Number(station.is_active) === 1
  );

  const [createLocationQR, { isLoading }] =
    useCreateLocationQRMutation();

  const handleChange = (index, field, value) => {
    setLocations((previous) =>
      previous.map((location, i) =>
        i === index
          ? { ...location, [field]: value }
          : location
      )
    );
  };

  const addLocation = () => {
    setLocations((previous) => [...previous, emptyLocation()]);
  };

  const removeLocation = (index) => {
    setLocations((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate police station
    if (!policeStationId) {
      toast.error("Please select a police station.");
      return;
    }

    // Validate all locations
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];

      if (
        location.latitude === "" ||
        location.longitude === ""
      ) {
        toast.error(`Coordinates are required in row ${i + 1}.`);
        return;
      }

      const lat = Number(location.latitude);
      const lng = Number(location.longitude);

      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        toast.error(
          `Invalid latitude in row ${i + 1}. Latitude must be between -90 and 90.`
        );
        return;
      }

      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        toast.error(
          `Invalid longitude in row ${i + 1}. Longitude must be between -180 and 180.`
        );
        return;
      }
    }

    // Send the selected police station ID with all locations
    const payload = {
      police_station_id: Number(policeStationId),

      locations: locations.map((location) => ({
        location_name: location.location_name.trim() || null,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      })),
    };

    try {
      await createLocationQR(payload).unwrap();

      toast.success("QR codes created successfully!");

      navigate("/location-qrs", { replace: true });
    } catch (error) {
      console.error("Create QR:", error);

      toast.error(
        error?.data?.message || "Failed to create QR codes."
      );
    }
  };

  return (
    <div className="min-h-full space-y-5 bg-gray-50 p-3 md:p-5">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            navigate("/location-qrs", { replace: true })
          }
          className="rounded-lg border bg-white p-2 text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft size={19} />
        </button>

        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Create QRs
          </h1>

          <p className="mt-1 text-xs text-gray-500">
            Select a police station and add one or multiple locations
            to generate their QR codes.
          </p>
        </div>
      </div>

      {/* FORM */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold text-gray-800">
              Location Details
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Select the police station and enter location details.
            </p>
          </div>

          <div className="rounded-lg bg-red-50 p-2 text-red-600">
            <QrCode size={20} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* POLICE STATION SELECTION */}
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Building2 size={17} className="text-red-500" />
              Select Police Station *
            </label>

            <select
              value={policeStationId}
              onChange={(e) => setPoliceStationId(e.target.value)}
              required
              disabled={isLoadingStations || isFetchingStations}
              className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">
                {isLoadingStations
                  ? "Loading police stations..."
                  : "Select a police station"}
              </option>

              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.station_name}
                  {station.district
                    ? ` - ${station.district}`
                    : ""}
                </option>
              ))}
            </select>

            {!isLoadingStations && stations.length === 0 && (
              <p className="mt-2 text-xs text-red-600">
                No active police stations found. Please activate or
                create a police station first.
              </p>
            )}
          </div>

          {/* LOCATION ROWS */}
          {locations.map((location, index) => (
            <div
              key={index}
              className="rounded-xl border bg-gray-50 p-3 md:p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  Location {index + 1}
                </h3>

                {locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* LOCATION NAME */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Location Name
                  </label>

                  <input
                    type="text"
                    value={location.location_name}
                    onChange={(e) =>
                      handleChange(
                        index,
                        "location_name",
                        e.target.value
                      )
                    }
                    placeholder="Example: Main Gate"
                    className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
                  />
                </div>

                {/* LATITUDE */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Latitude *
                  </label>

                  <input
                    type="number"
                    step="any"
                    value={location.latitude}
                    onChange={(e) =>
                      handleChange(
                        index,
                        "latitude",
                        e.target.value
                      )
                    }
                    placeholder="22.5726"
                    required
                    className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
                  />
                </div>

                {/* LONGITUDE */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Longitude *
                  </label>

                  <input
                    type="number"
                    step="any"
                    value={location.longitude}
                    onChange={(e) =>
                      handleChange(
                        index,
                        "longitude",
                        e.target.value
                      )
                    }
                    placeholder="88.3639"
                    required
                    className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* ADD ANOTHER LOCATION */}
          <button
            type="button"
            onClick={addLocation}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-red-300 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Plus size={17} />
            Add Another Location
          </button>

          {/* ACTIONS */}
          <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                navigate("/location-qrs", { replace: true })
              }
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isLoading ||
                isLoadingStations ||
                isFetchingStations ||
                stations.length === 0 ||
                !policeStationId
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Generating QRs...
                </>
              ) : (
                <>
                  <QrCode size={17} />
                  Generate {locations.length} QR
                  {locations.length > 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}