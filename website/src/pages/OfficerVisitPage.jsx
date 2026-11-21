
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  MapPin,
  Camera,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { toast } from "react-toastify";

// const API_URL = "http://192.168.29.2:4000/api/";
 //https://f781-115-187-48-18.ngrok-free.app -
//const API_URL ="https://108f-2405-201-8025-5070-d5b3-e77a-b736-9cf4.ngrok-free.app/api/";
const API_URL ="https://036c-115-187-48-18.ngrok-free.app/api/";
const MAX_DISTANCE = 100;
const MAX_ACCURACY = 100;

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

const OfficerVisitPage = () => {
  const { qrCode } = useParams();

  const [qrDetails, setQrDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("WAITING");
  const [locationMessage, setLocationMessage] = useState(
    "Waiting for automatic GPS verification..."
  );

  const [officers, setOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [officersLoading, setOfficersLoading] = useState(false);

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Automatically request and verify GPS
  const checkLocation = useCallback(() => {
    if (!qrDetails) return;

    if (!window.isSecureContext) {
      setLocationStatus("ERROR");
      setLocationMessage(
        "GPS requires HTTPS. Open this page using a secure HTTPS link."
      );
      setLocationLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("ERROR");
      setLocationMessage("GPS is not supported by this browser.");
      setLocationLoading(false);
      return;
    }

    const qrLatValue = qrDetails.qr_location?.latitude;
    const qrLonValue = qrDetails.qr_location?.longitude;

    if (
      qrLatValue === null ||
      qrLatValue === undefined ||
      qrLatValue === "" ||
      qrLonValue === null ||
      qrLonValue === undefined ||
      qrLonValue === ""
    ) {
      setLocationStatus("ERROR");
      setLocationMessage("QR location coordinates are not configured.");
      setLocationLoading(false);
      return;
    }

    const qrLatitude = Number(qrLatValue);
    const qrLongitude = Number(qrLonValue);

    if (
      !Number.isFinite(qrLatitude) ||
      !Number.isFinite(qrLongitude) ||
      qrLatitude < -90 ||
      qrLatitude > 90 ||
      qrLongitude < -180 ||
      qrLongitude > 180
    ) {
      setLocationStatus("ERROR");
      setLocationMessage("Invalid QR location coordinates.");
      setLocationLoading(false);
      return;
    }

    setLocationLoading(true);
    setLocationStatus("CHECKING");
    setLocationMessage("Getting your current GPS location...");

    setLocation(null);
    setDistance(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLatitude = position.coords.latitude;
        const currentLongitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        const calculatedDistance = calculateDistance(
          currentLatitude,
          currentLongitude,
          qrLatitude,
          qrLongitude
        );

        const isAccurate = accuracy <= MAX_ACCURACY;
        const isNearby = calculatedDistance <= MAX_DISTANCE;

        setLocation({
          latitude: currentLatitude,
          longitude: currentLongitude,
          accuracy,
        });

        setDistance(calculatedDistance);

        if (isAccurate && isNearby) {
          setLocationStatus("VERIFIED");
          setLocationMessage(
            "Your location has been automatically verified."
          );
        } else {
          setLocationStatus("NOT_VERIFIED");

          if (!isAccurate) {
            setLocationMessage(
              `GPS accuracy is too low (±${Math.round(
                accuracy
              )}m). Try again outdoors.`
            );
          } else {
            setLocationMessage(
              `You are ${Math.round(
                calculatedDistance
              )} metres away. You must be within 100 metres.`
            );
          }
        }

        setLocationLoading(false);
      },
      (error) => {
        let message = "Unable to get your current location.";

        if (error.code === 1) {
          message =
            "Location permission denied. Allow location access in your browser settings.";
        } else if (error.code === 2) {
          message =
            "Your current location is unavailable. Check your phone GPS.";
        } else if (error.code === 3) {
          message = "GPS request timed out. Please try again.";
        }

        setLocation(null);
        setDistance(null);
        setLocationStatus("ERROR");
        setLocationMessage(message);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }, [qrDetails]);

  // Fetch QR details
  useEffect(() => {
    let cancelled = false;

    const fetchQRDetails = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `${API_URL}officer/qr/${encodeURIComponent(qrCode)}`,
          {
            method: "GET",
            headers: {
              "ngrok-skip-browser-warning": "true",
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Failed to fetch QR details"
          );
        }

        if (!cancelled) {
          setQrDetails(result.data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message || "Unable to load QR details");
          setQrDetails(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (qrCode) {
      fetchQRDetails();
    }

    return () => {
      cancelled = true;
    };
  }, [qrCode]);

  // Automatically check location after QR details are loaded
  useEffect(() => {
    if (qrDetails) {
      checkLocation();
    }
  }, [qrDetails, checkLocation]);

  // Fetch officers assigned to the scanned QR's police station
  useEffect(() => {
    let cancelled = false;

    const fetchOfficers = async () => {
      try {
        setOfficersLoading(true);
        setOfficers([]);
        setSelectedOfficerId("");

        const response = await fetch(
          `${API_URL}officer/qr/${encodeURIComponent(qrCode)}/officers`,
          {
            method: "GET",
            headers: {
              "ngrok-skip-browser-warning": "true",
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Failed to fetch officers"
          );
        }

        if (!cancelled) {
          setOfficers(result.data || []);

          if (!result.data?.length) {
            toast.error(
              "No officers are assigned to this police station."
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setOfficers([]);
          toast.error(error.message || "Unable to fetch officers");
        }
      } finally {
        if (!cancelled) {
          setOfficersLoading(false);
        }
      }
    };

    if (qrCode && qrDetails) {
      fetchOfficers();
    }

    return () => {
      cancelled = true;
    };
  }, [qrCode, qrDetails]);

  // Selfie selection: flip the captured selfie horizontally so that both
  // the preview and the uploaded file are saved in the unmirrored direction.


// const handleImageChange = (event) => {
//   const file = event.target.files?.[0];

//   if (!file) return;

//   if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
//     toast.error("Only JPG, PNG and WEBP images are allowed");
//     event.target.value = "";
//     return;
//   }

//   if (file.size > 20 * 1024 * 1024) {
//     toast.error("Image must be smaller than 20 MB");
//     event.target.value = "";
//     return;
//   }

//   const sourceUrl = URL.createObjectURL(file);
//   const sourceImage = new Image();

//   sourceImage.onload = () => {
//     try {
//       const canvas = document.createElement("canvas");
//       canvas.width = sourceImage.naturalWidth;
//       canvas.height = sourceImage.naturalHeight;

//       const context = canvas.getContext("2d");

//       if (!context) {
//         throw new Error("Unable to process the captured image");
//       }

//       // Correct the front-camera horizontal mirroring.
//       context.translate(canvas.width, 0);
//       context.scale(-1, 1);
//       context.drawImage(sourceImage, 0, 0);

//       canvas.toBlob(
//         (blob) => {
//           URL.revokeObjectURL(sourceUrl);

//           if (!blob) {
//             toast.error("Unable to process the captured image");
//             event.target.value = "";
//             return;
//           }

//           // Store the corrected image, not the original mirrored file.
//           const correctedFile = new File(
//             [blob],
//             "officer-selfie.jpg",
//             {
//               type: "image/jpeg",
//               lastModified: Date.now(),
//             }
//           );

//           setImage(correctedFile);
//           setPreview(URL.createObjectURL(correctedFile));
//         },
//         "image/jpeg",
//         0.92
//       );
//     } catch (error) {
//       URL.revokeObjectURL(sourceUrl);
//       toast.error(error.message || "Unable to process image");
//       event.target.value = "";
//     }
//   };

//   sourceImage.onerror = () => {
//     URL.revokeObjectURL(sourceUrl);
//     toast.error("Unable to read the captured image");
//     event.target.value = "";
//   };

//   sourceImage.src = sourceUrl;
// };
const handleImageChange = (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    toast.error("Only JPG, PNG and WEBP images are allowed");
    event.target.value = "";
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    toast.error("Image must be smaller than 20 MB");
    event.target.value = "";
    return;
  }

  const sourceUrl = URL.createObjectURL(file);
  const sourceImage = new Image();

  sourceImage.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to process the captured image");
      }

      // Draw without horizontal flipping.
      context.drawImage(
        sourceImage,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(sourceUrl);

          if (!blob) {
            toast.error("Unable to process the captured image");
            event.target.value = "";
            return;
          }

          const correctedFile = new File(
            [blob],
            "officer-selfie.jpg",
            {
              type: "image/jpeg",
              lastModified: Date.now(),
            }
          );

          setImage(correctedFile);
          setPreview(URL.createObjectURL(correctedFile));
        },
        "image/jpeg",
        0.92
      );
    } catch (error) {
      URL.revokeObjectURL(sourceUrl);
      toast.error(error.message || "Unable to process image");
      event.target.value = "";
    }
  };

  sourceImage.onerror = () => {
    URL.revokeObjectURL(sourceUrl);
    toast.error("Unable to read the captured image");
    event.target.value = "";
  };

  sourceImage.src = sourceUrl;
};

  // Submit officer visit
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedOfficerId) {
      toast.error("Please select your name");
      return;
    }

    if (locationStatus !== "VERIFIED" || !location) {
      toast.error("Your location must be verified before submission.");
      return;
    }

    if (!image) {
      toast.error("Please capture your image.");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();

      formData.append("officer_id", selectedOfficerId);
      formData.append("image", image);
      formData.append("latitude", location.latitude);
      formData.append("longitude", location.longitude);
      formData.append("gps_status", "VERIFIED");

      const response = await fetch(
        `${API_URL}officer/qr/${encodeURIComponent(qrCode)}/visit`,
        {
          method: "POST",
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to submit visit"
        );
      }

      setSubmitted(true);
      toast.success("Your visit has been submitted successfully!");
    } catch (error) {
      toast.error(error.message || "Failed to submit visit");
    } finally {
      setSubmitting(false);
    }
  };
useEffect(() => {
  return () => {
    if (preview) URL.revokeObjectURL(preview);
  };
}, [preview]);
  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
        <span className="ml-3">Loading QR details...</span>
      </div>
    );
  }

  // Invalid QR
  if (!qrDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center p-5">
        <div className="rounded-xl bg-white p-6 text-center shadow">
          <AlertCircle className="mx-auto mb-3 text-red-500" size={40} />
          <h2 className="text-xl font-bold">Invalid QR code</h2>
          <p className="mt-2 text-gray-500">
            Unable to load this QR location. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-5">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <CheckCircle className="mx-auto mb-4 text-green-500" size={64} />

          <h2 className="text-2xl font-bold text-gray-800">
            Visit Submitted!
          </h2>

          <p className="mt-3 text-gray-600">
            Your visit has been successfully recorded.
          </p>

          <p className="mt-4 text-sm text-gray-500">
            Officer:{" "}
            {officers.find(
              (officer) =>
                String(officer.id) === String(selectedOfficerId)
            )?.name}
          </p>

          <p className="mt-2 text-sm text-gray-500">
            {qrDetails.police_station?.station_name}
          </p>
        </div>
      </div>
    );
  }

  const isWithinRange = locationStatus === "VERIFIED";

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header */}
        {/* <div className="rounded-2xl bg-blue-700 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">
            Officer Visit Verification
          </h1>
        </div> */}

        {/* QR Details */}
        {/* <div className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-lg font-bold text-gray-800">
            QR Location Details
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Location</p>
              <p className="font-semibold text-gray-800">
                {qrDetails.location_name}
              </p>
            </div>

            <div>
              <p className="text-gray-500">Police Station</p>
              <p className="font-semibold text-gray-800">
                {qrDetails.police_station?.station_name}
              </p>
            </div>

            {/* <div>
              <p className="text-gray-500">District</p>
              <p className="font-semibold text-gray-800">
                {qrDetails.police_station?.district || "N/A"}
              </p>
            </div>
          </div>
        </div> */}
        {/* Header */}
<div className="rounded-2xl bg-blue-700 p-6 text-white shadow-lg">
  <h1 className="text-2xl font-bold">
    Officer Visit Verification
  </h1>

<p
  title={qrDetails.police_station?.station_name || "N/A"}
  className="mt-2 max-w-full whitespace-normal break-words text-sm font-medium leading-6 text-blue-100"
>
  Police Station: {qrDetails.police_station?.station_name || "N/A"}
</p>
</div>

{/* QR Details */}
<div className="rounded-2xl bg-white p-5 shadow">
  <h2 className="mb-4 text-lg font-bold text-gray-800">
    QR Location Details
  </h2>

  <div className="text-sm">
    <p className="text-gray-500">Location</p>

    <p className="font-semibold text-gray-800">
      {qrDetails.location_name || "N/A"}
    </p>
  </div>
</div>

        {/* Automatic GPS Verification */}
        <div className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <MapPin className="text-blue-600" />
            Location Verification
          </h2>

          <p className="mb-4 text-sm text-gray-500">
            Your GPS location is checked automatically. You must be
            within 100 metres of this QR location.
          </p>

          <div
            className={`rounded-lg p-4 ${
              isWithinRange
                ? "bg-green-50 text-green-700"
                : locationStatus === "CHECKING" ||
                    locationStatus === "WAITING"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {locationLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : isWithinRange ? (
                <CheckCircle size={20} />
              ) : (
                <AlertCircle size={20} />
              )}

              {locationLoading
                ? "Checking GPS..."
                : isWithinRange
                  ? "Location Verified"
                  : locationStatus === "CHECKING"
                    ? "Checking Location"
                    : "Location Not Verified"}
            </div>

            <p className="mt-2 text-sm">{locationMessage}</p>

            {distance !== null && location && (
              <>
                <p className="mt-2 text-sm">
                  Distance: {Math.round(distance)} metres
                </p>

                {/* <p className="mt-1 text-sm">
                  GPS accuracy: ±{Math.round(location.accuracy)} metres
                </p> */}
              </>
            )}

            <p className="mt-1 text-sm">
              Allowed distance: 100 metres
            </p>
          </div>

          {/* Retry GPS */}
          {!isWithinRange && !locationLoading && (
            <button
              type="button"
              onClick={checkLocation}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-3 font-semibold text-blue-600 hover:bg-blue-50"
            >
              <RefreshCw size={18} />
              Retry GPS Verification
            </button>
          )}
        </div>

        {/* Officer Selection, Selfie and Submit */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-5 shadow"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Camera className="text-blue-600" />
            Officer Visit Submission
          </h2>

          {/* Officer Dropdown */}
          <div>
            <label
              htmlFor="officer"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"
            >
              <User size={17} className="text-blue-600" />
              Select Your Name
            </label>

            <select
              id="officer"
              value={selectedOfficerId}
              onChange={(e) => setSelectedOfficerId(e.target.value)}
              disabled={officersLoading || officers.length === 0}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">
                {officersLoading
                  ? "Loading officers..."
                  : officers.length === 0
                    ? "No officers found"
                    : "Select your name"}
              </option>

              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.name}
                </option>
              ))}
            </select>

            {!officersLoading && officers.length === 0 && (
              <p className="mt-2 text-xs text-red-500">
                No officers are assigned to this police station.
                Contact the administrator.
              </p>
            )}
          </div>

          {/* Camera Instructions */}
          <p className="text-sm text-gray-500">
            Capture your photograph using your phone camera.
          </p>

          {/* Camera Input */}
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-blue-500">
            <Camera size={35} className="mb-2 text-blue-600" />

            <span className="font-semibold text-gray-700">
              Open Camera
            </span>

            <span className="mt-1 text-xs text-gray-500">
              JPG, PNG or WEBP (Max 20 MB)
            </span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>

          {/* Image Preview */}
          {preview && (
            <div className="text-center">
              <img
                src={preview}
                alt="Officer image preview"
                className="mx-auto max-h-64 rounded-xl object-cover"
              />

              <p className="mt-2 text-sm text-green-600">
                Image selected successfully
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={
              !isWithinRange ||
              !image ||
              !selectedOfficerId ||
              submitting ||
              officersLoading
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Submit Visit
              </>
            )}
          </button>

          {!isWithinRange && (
            <p className="text-center text-xs text-red-500">
              Automatic GPS verification must succeed before submitting.
            </p>
          )}
        </form>

        <p className="pb-4 text-center text-xs text-gray-400">
          Police Station Visit Verification System
        </p>
      </div>
    </div>
  );
};

export default OfficerVisitPage;
