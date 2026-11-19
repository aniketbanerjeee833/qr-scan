import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const locationQRApi = createApi({
  reducerPath: "locationQRApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000/api/",
    credentials: "include",
  }),

  tagTypes: ["LocationQR"],

  endpoints: (builder) => ({

    // Create multiple location QRs
    createLocationQR: builder.mutation({
      query: (body) => ({
        url: "admin/location-qrs",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "LocationQR", id: "LIST" }],
    }),

    // Get location QRs with cursor pagination
    getAllLocationQRs: builder.query({
      query: (params = {}) => ({
        url: "admin/location-qrs",
        method: "GET",
        params,
      }),
      providesTags: (result) => [
        { type: "LocationQR", id: "LIST" },
        ...(Array.isArray(result?.data)
          ? result.data.map((item) => ({
              type: "LocationQR",
              id: item.id,
            }))
          : []),
      ],
    }),

    // Edit location details
    updateLocationQR: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `admin/location-qrs/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "LocationQR", id },
        { type: "LocationQR", id: "LIST" },
      ],
    }),

    // Regenerate QR token and image
    regenerateLocationQR: builder.mutation({
      query: (id) => ({
        url: `admin/location-qrs/${id}/regenerate`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "LocationQR", id },
        { type: "LocationQR", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useCreateLocationQRMutation,
  useGetAllLocationQRsQuery,
  useLazyGetAllLocationQRsQuery,
  useUpdateLocationQRMutation,
  useRegenerateLocationQRMutation,
} = locationQRApi;