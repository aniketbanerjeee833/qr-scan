
// import { useEffect, useState } from "react";
// import { useParams } from "react-router-dom";
// import {
//   MapPin,
//   Camera,
//   CheckCircle,
//   AlertCircle,
//   Loader2,
// } from "lucide-react";
// import { toast } from "react-toastify";

// const API_URL = "http://192.168.0.103:4000/api/";

// // Maximum permitted distance from QR location
// const MAX_DISTANCE = 50;

// // Calculate distance between two GPS coordinates in metres
// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//   const toRadians = (degree) => (degree * Math.PI) / 180;

//   const earthRadius = 6371000;

//   const dLat = toRadians(lat2 - lat1);
//   const dLon = toRadians(lon2 - lon1);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRadians(lat1)) *
//       Math.cos(toRadians(lat2)) *
//       Math.sin(dLon / 2) ** 2;

//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return earthRadius * c;
// };

// const OfficerVisitPage = () => {
//   const { qrCode } = useParams();

//   const [qrDetails, setQrDetails] = useState(null);
//   const [loading, setLoading] = useState(true);

//   const [location, setLocation] = useState(null);
//   const [distance, setDistance] = useState(null);
//   const [locationLoading, setLocationLoading] = useState(false);

//   const [selfie, setSelfie] = useState(null);
//   const [preview, setPreview] = useState(null);

//   const [submitting, setSubmitting] = useState(false);
//   const [submitted, setSubmitted] = useState(false);

//   // Fetch QR details
//   useEffect(() => {
//     const fetchQRDetails = async () => {
//       try {
//         setLoading(true);

//         const response = await fetch(
//           `${API_URL}officer/qr/${encodeURIComponent(qrCode)}`
//         );

//         const result = await response.json();

//         if (!response.ok) {
//           throw new Error(result.message || "Failed to fetch QR details");
//         }

//         setQrDetails(result.data);
//       } catch (error) {
//         toast.error(error.message || "Unable to load QR details");
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (qrCode) {
//       fetchQRDetails();
//     }
//   }, [qrCode]);

//   // Check officer's current location
//   const checkLocation = () => {
//     if (!navigator.geolocation) {
//       toast.error("GPS is not supported by this browser");
//       return;
//     }

//     setLocationLoading(true);
//     setLocation(null);
//     setDistance(null);

//     navigator.geolocation.getCurrentPosition(
//       (position) => {
//         const currentLatitude = position.coords.latitude;
//         const currentLongitude = position.coords.longitude;
//         const accuracy = position.coords.accuracy;

//         const qrLatitude = Number(qrDetails.qr_location.latitude);
//         const qrLongitude = Number(qrDetails.qr_location.longitude);

//         if (
//           !Number.isFinite(qrLatitude) ||
//           !Number.isFinite(qrLongitude)
//         ) {
//           toast.error("QR location coordinates are not configured");
//           setLocationLoading(false);
//           return;
//         }

//         const calculatedDistance = calculateDistance(
//           currentLatitude,
//           currentLongitude,
//           qrLatitude,
//           qrLongitude
//         );

//         setLocation({
//           latitude: currentLatitude,
//           longitude: currentLongitude,
//           accuracy,
//         });

//         setDistance(calculatedDistance);

//         if (accuracy > 50) {
//           toast.warning(
//             `GPS accuracy is approximately ${Math.round(accuracy)} metres. Try again outdoors.`
//           );
//         } else if (calculatedDistance <= MAX_DISTANCE) {
//           toast.success("You are within the permitted 50 metre range");
//         } else {
//           toast.error(
//             `You are ${Math.round(calculatedDistance)} metres away. Move closer to the QR location.`
//           );
//         }

//         setLocationLoading(false);
//       },
//       (error) => {
//         let message = "Unable to get your location";

//         if (error.code === 1) {
//           message = "Please allow location permission in your browser";
//         } else if (error.code === 2) {
//           message = "Your current location is unavailable";
//         } else if (error.code === 3) {
//           message = "Location request timed out. Please try again";
//         }

//         toast.error(message);
//         setLocationLoading(false);
//       },
//       {
//         enableHighAccuracy: true,
//         timeout: 20000,
//         maximumAge: 0,
//       }
//     );
//   };

//   // Handle selfie selection / camera capture
//   const handleSelfieChange = (event) => {
//     const file = event.target.files?.[0];

//     if (!file) return;

//     if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
//       toast.error("Only JPG, PNG and WEBP images are allowed");
//       event.target.value = "";
//       return;
//     }

//     if (file.size > 10 * 1024 * 1024) {
//       toast.error("Image must be smaller than 10 MB");
//       event.target.value = "";
//       return;
//     }

//     setSelfie(file);

//     const imagePreview = URL.createObjectURL(file);
//     setPreview(imagePreview);
//   };

//   // Submit officer visit
//   const handleSubmit = async (event) => {
//     event.preventDefault();

//     if (!location || distance === null) {
//       toast.error("Please verify your location first");
//       return;
//     }

//     if (location.accuracy > 50) {
//       toast.error("GPS accuracy is too low. Please check your location again");
//       return;
//     }

//     if (distance > MAX_DISTANCE) {
//       toast.error("You must be within 50 metres of the QR location");
//       return;
//     }

//     if (!selfie) {
//       toast.error("Please capture your selfie");
//       return;
//     }

//     try {
//       setSubmitting(true);

//       const formData = new FormData();

//       formData.append("selfie", selfie);
//       formData.append("latitude", location.latitude);
//       formData.append("longitude", location.longitude);

//       const response = await fetch(
//         `${API_URL}officer/qr/${encodeURIComponent(qrCode)}/visit`,
//         {
//           method: "POST",
//           body: formData,
//         }
//       );

//       const result = await response.json();

//       if (!response.ok) {
//         throw new Error(result.message || "Failed to submit visit");
//       }

//       setSubmitted(true);
//       toast.success("Your visit has been submitted successfully!");
//     } catch (error) {
//       toast.error(error.message || "Failed to submit visit");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   // Loading state
//   if (loading) {
//     return (
//       <div className="flex min-h-screen items-center justify-center">
//         <Loader2 className="animate-spin" size={32} />
//         <span className="ml-3">Loading QR details...</span>
//       </div>
//     );
//   }

//   if (!qrDetails) {
//     return (
//       <div className="flex min-h-screen items-center justify-center p-5">
//         <div className="rounded-xl bg-white p-6 text-center shadow">
//           <AlertCircle className="mx-auto mb-3 text-red-500" size={40} />
//           <h2 className="text-xl font-bold">Invalid QR code</h2>
//           <p className="mt-2 text-gray-500">
//             Unable to load this QR location. Please contact your administrator.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (submitted) {
//     return (
//       <div className="flex min-h-screen items-center justify-center bg-gray-100 p-5">
//         <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
//           <CheckCircle className="mx-auto mb-4 text-green-500" size={64} />

//           <h2 className="text-2xl font-bold text-gray-800">
//             Visit Submitted!
//           </h2>

//           <p className="mt-3 text-gray-600">
//             Your visit has been successfully recorded.
//           </p>

//           <p className="mt-4 text-sm text-gray-500">
//             {qrDetails.police_station.station_name}
//           </p>
//         </div>
//       </div>
//     );
//   }

//   const isWithinRange =
//     distance !== null &&
//     distance <= MAX_DISTANCE &&
//     location?.accuracy <= 50;

//   return (
//     <div className="min-h-screen bg-gray-100 px-4 py-8">
//       <div className="mx-auto max-w-lg space-y-5">

//         {/* Header */}
//         <div className="rounded-2xl bg-blue-700 p-6 text-white shadow-lg">
//           <h1 className="text-2xl font-bold">
//             Officer Visit Verification
//           </h1>

//           <p className="mt-2 text-sm text-blue-100">
//             Scan verification and submit your visit
//           </p>
//         </div>

//         {/* QR Details */}
//         <div className="rounded-2xl bg-white p-5 shadow">
//           <h2 className="mb-4 text-lg font-bold text-gray-800">
//             QR Location Details
//           </h2>

//           <div className="space-y-3 text-sm">
//             <div>
//               <p className="text-gray-500">Location</p>
//               <p className="font-semibold text-gray-800">
//                 {qrDetails.location_name}
//               </p>
//             </div>

//             <div>
//               <p className="text-gray-500">Police Station</p>
//               <p className="font-semibold text-gray-800">
//                 {qrDetails.police_station.station_name}
//               </p>
//             </div>

//             <div>
//               <p className="text-gray-500">District</p>
//               <p className="font-semibold text-gray-800">
//                 {qrDetails.police_station.district}
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* GPS Verification */}
//         <div className="rounded-2xl bg-white p-5 shadow">
//           <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
//             <MapPin className="text-blue-600" />
//             Location Verification
//           </h2>

//           <p className="mb-4 text-sm text-gray-500">
//             You must be within 50 metres of the QR location to submit your visit.
//           </p>

//           <button
//             type="button"
//             onClick={checkLocation}
//             disabled={locationLoading}
//             className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
//           >
//             {locationLoading ? (
//               <>
//                 <Loader2 className="animate-spin" size={20} />
//                 Checking location...
//               </>
//             ) : (
//               <>
//                 <MapPin size={20} />
//                 Check My Location
//               </>
//             )}
//           </button>

//           {distance !== null && location && (
//             <div
//               className={`mt-4 rounded-lg p-4 ${
//                 isWithinRange
//                   ? "bg-green-50 text-green-700"
//                   : "bg-red-50 text-red-700"
//               }`}
//             >
//               <div className="flex items-center gap-2 font-bold">
//                 {isWithinRange ? (
//                   <CheckCircle size={20} />
//                 ) : (
//                   <AlertCircle size={20} />
//                 )}

//                 {isWithinRange
//                   ? "Location Verified"
//                   : "Location Not Verified"}
//               </div>

//               <p className="mt-2 text-sm">
//                 Distance: {Math.round(distance)} metres
//               </p>

//               <p className="mt-1 text-sm">
//                 GPS accuracy: ±{Math.round(location.accuracy)} metres
//               </p>

//               <p className="mt-1 text-sm">
//                 Allowed distance: 50 metres
//               </p>
//             </div>
//           )}
//         </div>

//         {/* Selfie Upload and Submit */}
//         <form
//           onSubmit={handleSubmit}
//           className="space-y-4 rounded-2xl bg-white p-5 shadow"
//         >
//           <h2 className="flex items-center gap-2 text-lg font-bold">
//             <Camera className="text-blue-600" />
//             Capture Officer Selfie
//           </h2>

//           <p className="text-sm text-gray-500">
//             Capture your photograph using your phone camera.
//           </p>

//           <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-blue-500">
//             <Camera size={35} className="mb-2 text-blue-600" />

//             <span className="font-semibold text-gray-700">
//               Open Camera
//             </span>

//             <span className="mt-1 text-xs text-gray-500">
//               JPG, PNG or WEBP (Max 10 MB)
//             </span>

//             <input
//               type="file"
//               accept="image/jpeg,image/png,image/webp"
//               capture="user"
//               onChange={handleSelfieChange}
//               className="hidden"
//             />
//           </label>

//           {preview && (
//             <div className="text-center">
//               <img
//                 src={preview}
//                 alt="Officer selfie preview"
//                 className="mx-auto max-h-64 rounded-xl object-cover"
//               />

//               <p className="mt-2 text-sm text-green-600">
//                 Selfie selected successfully
//               </p>
//             </div>
//           )}

//           <button
//             type="submit"
//             disabled={!isWithinRange || !selfie || submitting}
//             className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
//           >
//             {submitting ? (
//               <>
//                 <Loader2 className="animate-spin" size={20} />
//                 Submitting...
//               </>
//             ) : (
//               <>
//                 <CheckCircle size={20} />
//                 Submit Visit
//               </>
//             )}
//           </button>

//           {!isWithinRange && (
//             <p className="text-center text-xs text-red-500">
//               Verify your GPS location within 50 metres before submitting.
//             </p>
//           )}
//         </form>

//         <p className="pb-4 text-center text-xs text-gray-400">
//           Police Station Visit Verification System
//         </p>
//       </div>
//     </div>
//   );
// };

// export default OfficerVisitPage;

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  MapPin,
  Camera,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";

const API_URL =
  import.meta.env.VITE_API_URL || "http://192.168.0.103:4000/api/";

const MAX_DISTANCE = 50;
const MAX_ACCURACY = 50;

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

  const [selfie, setSelfie] = useState(null);
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
              )} metres away. You must be within 50 metres.`
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
          message =
            "GPS request timed out. Please try again.";
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
          `${API_URL}officer/qr/${encodeURIComponent(qrCode)}`
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

  // Selfie selection
  const handleSelfieChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      toast.error("Only JPG, PNG and WEBP images are allowed");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB");
      event.target.value = "";
      return;
    }

    setSelfie(file);
    setPreview(URL.createObjectURL(file));
  };

  // Submit officer visit
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (locationStatus !== "VERIFIED" || !location) {
      toast.error("Your location must be verified before submission.");
      return;
    }

    if (!selfie) {
      toast.error("Please capture your selfie.");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();

      formData.append("selfie", selfie);
      formData.append("latitude", location.latitude);
      formData.append("longitude", location.longitude);
      formData.append("gps_status", "VERIFIED");

      const response = await fetch(
        `${API_URL}officer/qr/${encodeURIComponent(qrCode)}/visit`,
        {
          method: "POST",
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
            {qrDetails.police_station.station_name}
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
        <div className="rounded-2xl bg-blue-700 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">
            Officer Visit Verification
          </h1>

          {/* <p className="mt-2 text-sm text-blue-100">
            Automatic location verification and selfie submission
          </p> */}
        </div>

        {/* QR Details */}
        <div className="rounded-2xl bg-white p-5 shadow">
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

            <div>
              <p className="text-gray-500">District</p>
              <p className="font-semibold text-gray-800">
                {qrDetails.police_station?.district}
              </p>
            </div>
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
            within 50 metres of this QR location.
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

                <p className="mt-1 text-sm">
                  GPS accuracy: ±{Math.round(location.accuracy)} metres
                </p>
              </>
            )}

            <p className="mt-1 text-sm">
              Allowed distance: 50 metres
            </p>
          </div>

          {/* Retry only if automatic GPS fails */}
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

        {/* Selfie and Submit */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-5 shadow"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Camera className="text-blue-600" />
            Capture Officer Selfie
          </h2>

          <p className="text-sm text-gray-500">
            Capture your photograph using your phone camera.
          </p>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-blue-500">
            <Camera size={35} className="mb-2 text-blue-600" />

            <span className="font-semibold text-gray-700">
              Open Camera
            </span>

            <span className="mt-1 text-xs text-gray-500">
              JPG, PNG or WEBP (Max 10 MB)
            </span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={handleSelfieChange}
              className="hidden"
            />
          </label>

          {preview && (
            <div className="text-center">
              <img
                src={preview}
                alt="Officer selfie preview"
                className="mx-auto max-h-64 rounded-xl object-cover"
              />

              <p className="mt-2 text-sm text-green-600">
                Selfie selected successfully
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isWithinRange || !selfie || submitting}
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
