import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Saves a blob as a file download in the browser.
const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

// Success -> Blob (the Excel file).
// Error   -> parsed JSON, so error.data.error works like every other endpoint.
const excelResponseHandler = async (response) => {
  if (response.ok) return response.blob();

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { error: text || "Failed to download report" };
  }
};

export const policeStationApi = createApi({
  reducerPath: "policeStationApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000/api/",
    credentials: "include",
  }),

  tagTypes: ["PoliceStation", "StationOfficer"],

  endpoints: (builder) => ({
    // ========================================
    // POLICE STATIONS
    // ========================================

    createPoliceStation: builder.mutation({
      query: (body) => ({
        url: "admin/police-stations",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "PoliceStation", id: "LIST" }],
    }),

    getPoliceStations: builder.query({
      query: (params = {}) => ({
        url: "admin/police-stations",
        method: "GET",
        params,
      }),
      providesTags: (result) => [
        { type: "PoliceStation", id: "LIST" },
        ...(Array.isArray(result?.data)
          ? result.data.map((item) => ({
              type: "PoliceStation",
              id: item.id,
            }))
          : []),
      ],
    }),

    updatePoliceStation: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `admin/police-stations/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "PoliceStation", id },
        { type: "PoliceStation", id: "LIST" },
      ],
    }),

    updatePoliceStationStatus: builder.mutation({
      query: ({ id, is_active }) => ({
        url: `admin/police-stations/${id}/status`,
        method: "PATCH",
        body: { is_active },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "PoliceStation", id },
        { type: "PoliceStation", id: "LIST" },
      ],
    }),

    deletePoliceStation: builder.mutation({
      query: (id) => ({
        url: `admin/police-stations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "PoliceStation", id: "LIST" }],
    }),

    // ========================================
    // POLICE STATION OFFICERS
    // ========================================

    createStationOfficer: builder.mutation({
      query: ({ stationId, ...body }) => ({
        url: `admin/police-stations/${stationId}/officers`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { stationId }) => [
        { type: "StationOfficer", id: `LIST-${stationId}` },
        { type: "PoliceStation", id: "LIST" },
      ],
    }),

    getStationOfficers: builder.query({
      query: ({ stationId, ...params }) => ({
        url: `admin/police-stations/${stationId}/officers`,
        method: "GET",
        params,
      }),
      providesTags: (result, error, { stationId }) => [
        { type: "StationOfficer", id: `LIST-${stationId}` },
        ...(Array.isArray(result?.data)
          ? result.data.map((item) => ({
              type: "StationOfficer",
              id: item.id,
            }))
          : []),
      ],
    }),

    updateStationOfficer: builder.mutation({
      query: ({ stationId, officerId, ...body }) => ({
        url: `admin/police-stations/${stationId}/officers/${officerId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { stationId, officerId }) => [
        { type: "StationOfficer", id: officerId },
        { type: "StationOfficer", id: `LIST-${stationId}` },
        { type: "PoliceStation", id: "LIST" },
      ],
    }),

    deleteStationOfficer: builder.mutation({
      query: ({ stationId, officerId }) => ({
        url: `admin/police-stations/${stationId}/officers/${officerId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { stationId, officerId }) => [
        { type: "StationOfficer", id: officerId },
        { type: "StationOfficer", id: `LIST-${stationId}` },
        { type: "PoliceStation", id: "LIST" },
      ],
    }),
// Day-wise visit report of one officer (for the expandable table)
getOfficerVisitReport: builder.query({
  query: ({ stationId, officerId, from, to }) => ({
    url: `admin/police-stations/${stationId}/officers/${officerId}/visit-report`,
    method: "GET",
    params: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  }),
}),
    // ========================================
    // EXCEL REPORTS (file download)
    // ========================================

    // All officers of one station
    downloadStationReport: builder.mutation({
      async queryFn(
        { stationId, from, to, filename },
        _api,
        _extraOptions,
        baseQuery
      ) {
        const result = await baseQuery({
          url: `admin/police-stations/${stationId}/report`,
          method: "GET",
          params: { from, to },
          cache: "no-cache",
          responseHandler: excelResponseHandler,
        });

        if (result.error) return { error: result.error };

        saveBlob(result.data, filename || "station-report.xlsx");

        return { data: { success: true } };
      },
    }),

    // One officer
    downloadOfficerReport: builder.mutation({
      async queryFn(
        { stationId, officerId, from, to, filename },
        _api,
        _extraOptions,
        baseQuery
      ) {
        const result = await baseQuery({
          url: `admin/police-stations/${stationId}/officers/${officerId}/report`,
          method: "GET",
          params: { from, to },
          cache: "no-cache",
          responseHandler: excelResponseHandler,
        });

        if (result.error) return { error: result.error };

        saveBlob(result.data, filename || "officer-report.xlsx");

        return { data: { success: true } };
      },
    }),
  }),
});

export const {
  // Police stations
  useCreatePoliceStationMutation,
  useGetPoliceStationsQuery,
  useUpdatePoliceStationMutation,
  useUpdatePoliceStationStatusMutation,
  useDeletePoliceStationMutation,

  // Police station officers
  useCreateStationOfficerMutation,
  useLazyGetStationOfficersQuery,
  useUpdateStationOfficerMutation,
  useDeleteStationOfficerMutation,
  useGetOfficerVisitReportQuery,
  // Excel reports
  useDownloadStationReportMutation,
  useDownloadOfficerReportMutation,
} = policeStationApi;