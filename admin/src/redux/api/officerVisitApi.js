
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Get today's date in local YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
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

// Success -> Blob. Error -> parsed JSON, so error.data.error works.
const excelResponseHandler = async (response) => {
  if (response.ok) return response.blob();

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { error: text || "Failed to download report" };
  }
};
export const officerVisitApi = createApi({
  reducerPath: "officerVisitApi",

  baseQuery: fetchBaseQuery({
    baseUrl:"http://localhost:4000/api/",
    credentials: "include",
  }),

  tagTypes: ["OfficerVisit"],

  endpoints: (builder) => ({
    // Get officer visits with cursor pagination
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

    // Download Excel report using the same filters
    downloadOfficerVisitsReport: builder.mutation({
  async queryFn(
    { search = "", visit_date, filename },
    _api,
    _extraOptions,
    baseQuery
  ) {
    const result = await baseQuery({
      url: "admin/officer-visit/report",
      method: "GET",
      params: {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(visit_date ? { visit_date } : {}),
      },
      cache: "no-cache",
      responseHandler: excelResponseHandler,
    });

    if (result.error) return { error: result.error };

    saveBlob(result.data, filename || "officer-visits-report.xlsx");

    return { data: { success: true } };
  },
}),
  }),
});

export const {
  useLazyGetOfficerVisitsQuery,
  useDownloadOfficerVisitsReportMutation
} = officerVisitApi;
