import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Next cursor for the infinite query (undefined = no more pages)
const getNextCursor = (lastPage) => {
  if (!lastPage?.pagination?.hasMore) return undefined;

  return lastPage.pagination.nextCursor ?? undefined;
};

export const locationQRApi = createApi({
  reducerPath: "locationQRApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000/api/",
    //baseUrl: "https://448f-115-187-48-18.ngrok-free.app/api/",
    credentials: "include",
    // prepareHeaders: (headers) => {
    //   headers.set("ngrok-skip-browser-warning", "true");
    //   return headers;
    // },
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

    // Location QRs with cursor pagination (infinite query)
    getAllLocationQRs: builder.infiniteQuery({
      query: ({ queryArg, pageParam }) => ({
        url: "admin/location-qrs",
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
        { type: "LocationQR", id: "LIST" },

        ...(result?.pages ?? []).flatMap((page) =>
          (page?.data ?? []).map((item) => ({
            type: "LocationQR",
            id: item.id,
          }))
        ),
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

    // Delete location QR
    deleteLocationQR: builder.mutation({
      query: (id) => ({
        url: `admin/location-qrs/${id}`,
        method: "DELETE",
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
  useGetAllLocationQRsInfiniteQuery,
  useUpdateLocationQRMutation,
  useRegenerateLocationQRMutation,
  useDeleteLocationQRMutation,
} = locationQRApi;