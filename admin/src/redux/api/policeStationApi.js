
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

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
} = policeStationApi;
