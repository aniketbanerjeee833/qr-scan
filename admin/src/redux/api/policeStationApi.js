
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// ========================================
// EXCEL DOWNLOAD HELPERS
// ========================================

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

const excelResponseHandler = async (response) => {
  if (response.ok) return response.blob();

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text || "Failed to download report",
    };
  }
};

// ========================================
// INFINITE QUERY HELPER
// ========================================

const getNextCursor = (lastPage) => {
  if (!lastPage?.pagination?.hasMore) {
    return undefined;
  }

  return lastPage.pagination.nextCursor ?? undefined;
};

// ========================================
// API
// ========================================

export const policeStationApi = createApi({
  reducerPath: "policeStationApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000/api/",
    // baseUrl: "https://YOUR-NGROK-URL.ngrok-free.app/api/",

    credentials: "include",

    // Uncomment when using ngrok:
    // prepareHeaders: (headers) => {
    //   headers.set("ngrok-skip-browser-warning", "true");
    //   return headers;
    // },
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

      invalidatesTags: [
        { type: "PoliceStation", id: "LIST" },
      ],
    }),

    // Infinite query: Police Stations
    getPoliceStations: builder.infiniteQuery({
      query: ({ queryArg, pageParam }) => ({
        url: "admin/police-stations",
        method: "GET",

        params: {
          ...queryArg,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),

      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: getNextCursor,
      },

      providesTags: (result) => [
        { type: "PoliceStation", id: "LIST" },

        ...(result?.pages ?? []).flatMap((page) =>
          (page?.data ?? []).map((station) => ({
            type: "PoliceStation",
            id: station.id,
          }))
        ),
      ],
    }),
        // Flat station list for dropdowns (not paginated, max 100)
    getPoliceStationOptions: builder.query({
  query: () => ({
    url: "admin/police-stations/options",
    method: "GET",
  }),

  providesTags: [{ type: "PoliceStation", id: "LIST" }],
}),
        getPoliceStationById: builder.query({
      query: (id) => `admin/police-stations/${id}`,

      providesTags: (result, error, id) => [
        { type: "PoliceStation", id: Number(id) },
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

      invalidatesTags: [
        { type: "PoliceStation", id: "LIST" },
      ],
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
        {
          type: "StationOfficer",
          id: `LIST-${stationId}`,
        },
        {
          type: "PoliceStation",
          id: "LIST",
        },
      ],
    }),

    // Infinite query: Station Officers
    getStationOfficers: builder.infiniteQuery({
      query: ({ queryArg, pageParam }) => {
        const { stationId, ...params } = queryArg;

        return {
          url: `admin/police-stations/${stationId}/officers`,
          method: "GET",

          params: {
            ...params,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        };
      },

      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: getNextCursor,
      },

      // IMPORTANT:
      // The third argument is the ORIGINAL query argument.
      // It is NOT { queryArg, pageParam }.
      providesTags: (result, error, arg) => [
        {
          type: "StationOfficer",
          id: `LIST-${arg.stationId}`,
        },

        ...(result?.pages ?? []).flatMap((page) =>
          (page?.data ?? []).map((officer) => ({
            type: "StationOfficer",
            id: officer.id,
          }))
        ),
      ],
    }),

    updateStationOfficer: builder.mutation({
      query: ({ stationId, officerId, ...body }) => ({
        url: `admin/police-stations/${stationId}/officers/${officerId}`,
        method: "PUT",
        body,
      }),

      invalidatesTags: (result, error, { stationId, officerId }) => [
        {
          type: "StationOfficer",
          id: officerId,
        },
        {
          type: "StationOfficer",
          id: `LIST-${stationId}`,
        },
        {
          type: "PoliceStation",
          id: "LIST",
        },
      ],
    }),

    deleteStationOfficer: builder.mutation({
      query: ({ stationId, officerId }) => ({
        url: `admin/police-stations/${stationId}/officers/${officerId}`,
        method: "DELETE",
      }),

      invalidatesTags: (result, error, { stationId, officerId }) => [
        {
          type: "StationOfficer",
          id: officerId,
        },
        {
          type: "StationOfficer",
          id: `LIST-${stationId}`,
        },
        {
          type: "PoliceStation",
          id: "LIST",
        },
      ],
    }),

    // ========================================
    // OFFICER VISIT REPORT
    // ========================================

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
    // EXCEL REPORTS
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

        if (result.error) {
          return { error: result.error };
        }

        saveBlob(
          result.data,
          filename || "station-report.xlsx"
        );

        return {
          data: { success: true },
        };
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

        if (result.error) {
          return { error: result.error };
        }

        saveBlob(
          result.data,
          filename || "officer-report.xlsx"
        );

        return {
          data: { success: true },
        };
      },
    }),

  }),
});

// ========================================
// EXPORT HOOKS
// ========================================

export const {
  // Police Stations
  useCreatePoliceStationMutation,
  useGetPoliceStationsInfiniteQuery,
  useGetPoliceStationByIdQuery,
  useUpdatePoliceStationMutation,
  useUpdatePoliceStationStatusMutation,
  useDeletePoliceStationMutation,

  // Station Officers
  useCreateStationOfficerMutation,
  useGetStationOfficersInfiniteQuery,
  useGetPoliceStationOptionsQuery,
  useUpdateStationOfficerMutation,
  useDeleteStationOfficerMutation,

  // Reports
  useGetOfficerVisitReportQuery,
  useDownloadStationReportMutation,
  useDownloadOfficerReportMutation,

} = policeStationApi;
