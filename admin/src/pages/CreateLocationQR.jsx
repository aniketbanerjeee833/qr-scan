
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

  // Update location fields
  const handleChange = (index, field, value) => {
    setLocations((previous) =>
      previous.map((location, i) =>
        i === index
          ? { ...location, [field]: value }
          : location
      )
    );
  };

  // Add another location
  const addLocation = () => {
    setLocations((previous) => [
      ...previous,
      emptyLocation(),
    ]);
  };

  // Remove location
  const removeLocation = (index) => {
    setLocations((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!policeStationId) {
      toast.error("Please select a police station.");
      return;
    }

    if (locations.length === 0) {
      toast.error("Please add at least one location.");
      return;
    }

    // Validate all locations
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];

      if (
        location.latitude === "" ||
        location.longitude === ""
      ) {
        toast.error(
          `Coordinates are required in row ${i + 1}.`
        );
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

  const isStationLoading =
    isLoadingStations || isFetchingStations;

  return (
    <div className="min-h-full space-y-5 bg-gray-50 p-3 md:p-5">

      {/* HEADER */}
      <div className="flex items-center gap-3">

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() =>
            navigate("/location-qrs", { replace: true })
          }
          className="shrink-0 bg-white text-gray-600"
        >
          <ArrowLeft size={19} />
        </Button>

        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Create QRs
          </h1>

          <p className="mt-1 text-xs text-gray-500">
            Select a police station and add one or multiple
            locations to generate their QR codes.
          </p>
        </div>

      </div>

      {/* FORM CARD */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

        {/* CARD HEADER */}
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

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4">

          {/* POLICE STATION SELECTION */}
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">

            <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Building2 size={17} className="text-red-500" />
              Select Police Station *
            </Label>

            <Select
              value={policeStationId}
              onValueChange={setPoliceStationId}
              disabled={isStationLoading || stations.length === 0}
            >
              <SelectTrigger className="!h-10 w-full border-gray-200 bg-white">
                <SelectValue
                  placeholder={
                    isStationLoading
                      ? "Loading police stations..."
                      : "Select a police station"
                  }
                />
              </SelectTrigger>

              <SelectContent  position="popper"
        side="bottom"
        sideOffset={0}
        align="start"
        className="max-h-64">
                {stations.map((station) => (
                  <SelectItem
                    key={station.id}
                    value={String(station.id)}
                  >
                    {station.station_name}
                    {station.district
                      ? ` - ${station.district}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isStationLoading && stations.length === 0 && (
              <p className="mt-2 text-xs text-red-600">
                No active police stations found. Please activate
                or create a police station first.
              </p>
            )}

          </div>

          {/* LOCATION ROWS */}
          {locations.map((location, index) => (
            <div
              key={index}
              className="rounded-xl border bg-gray-50 p-3 md:p-4"
            >

              {/* LOCATION HEADER */}
              <div className="mb-4 flex items-center justify-between">

                <h3 className="text-sm font-semibold text-gray-700">
                  Location {index + 1}
                </h3>

                {locations.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLocation(index)}
                    className="h-8 gap-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                )}

              </div>

              {/* LOCATION INPUTS */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                {/* LOCATION NAME */}
                <div className="space-y-1.5">

                  <Label className="text-xs font-medium text-gray-700">
                    Location Name
                  </Label>

                  <Input
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
                    className="h-10 border-gray-200 bg-white"
                  />

                </div>

                {/* LATITUDE */}
                <div className="space-y-1.5">

                  <Label className="text-xs font-medium text-gray-700">
                    Latitude *
                  </Label>

                  <Input
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
                    className="h-10 border-gray-200 bg-white"
                  />

                </div>

                {/* LONGITUDE */}
                <div className="space-y-1.5">

                  <Label className="text-xs font-medium text-gray-700">
                    Longitude *
                  </Label>

                  <Input
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
                    className="h-10 border-gray-200 bg-white"
                  />

                </div>

              </div>
            </div>
          ))}

          {/* ADD ANOTHER LOCATION */}
          <Button
            type="button"
            variant="outline"
            onClick={addLocation}
            className="h-11 w-full border-dashed border-red-300 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Plus size={17} />
            Add Another Location
          </Button>

          {/* ACTIONS */}
          <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row">

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate("/location-qrs", { replace: true })
              }
              className="h-10 px-5 text-gray-600"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={
                isLoading ||
                isStationLoading ||
                stations.length === 0 ||
                !policeStationId
              }
              className="h-10 bg-red-500 px-6 text-sm font-medium text-white hover:bg-red-600"
            >
              {isLoading ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Generating QRs...
                </>
              ) : (
                <>
                  <QrCode size={17} />
                  Generate {locations.length} QR
                  {locations.length > 1 ? "s" : ""}
                </>
              )}
            </Button>

          </div>

        </form>
      </div>
    </div>
  );
}
