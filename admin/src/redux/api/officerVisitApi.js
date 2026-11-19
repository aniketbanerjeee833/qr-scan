
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Get today's date in local YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const officerVisitApi = createApi({
  reducerPath: "officerVisitApi",

  baseQuery: fetchBaseQuery({
    baseUrl:
      import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:4000/api/",
    credentials: "include",
  }),

  tagTypes: ["OfficerVisit"],

  endpoints: (builder) => ({
    getOfficerVisits: builder.query({
      query: ({
        limit = 20,
        cursor,
        search = "",
        station_id,
        visit_date,
      } = {}) => ({
        url: "admin/officer-visit",
        method: "GET",

        params: {
          limit,
          ...(cursor != null ? { cursor } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(station_id ? { station_id } : {}),

          // Default to today's date if frontend doesn't pass one
          visit_date: visit_date || getTodayDate(),
        },
      }),

      providesTags: (result) => [
        { type: "OfficerVisit", id: "LIST" },

        ...(result?.data || []).map((visit) => ({
          type: "OfficerVisit",
          id: visit.id,
        })),
      ],
    }),
  }),
});

export const {
  useLazyGetOfficerVisitsQuery,
} = officerVisitApi;
