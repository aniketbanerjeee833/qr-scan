
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// ========================================
// DATE HELPER
// ========================================

const getTodayDate = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

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

export const officerVisitApi = createApi({
  reducerPath: "officerVisitApi",

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

  tagTypes: ["OfficerVisit"],

  endpoints: (builder) => ({

    // ========================================
    // OFFICER VISITS - INFINITE QUERY
    // ========================================

    getOfficerVisits: builder.infiniteQuery({
      query: ({ queryArg, pageParam }) => {
        const {
          limit = 20,
          search = "",
          station_id,
          visit_date,
        } = queryArg;

        return {
          url: "admin/officer-visit",
          method: "GET",

          params: {
            limit,

            ...(pageParam != null
              ? { cursor: pageParam }
              : {}),

            ...(search.trim()
              ? { search: search.trim() }
              : {}),

            ...(station_id
              ? { station_id }
              : {}),

            visit_date: visit_date || getTodayDate(),
          },
        };
      },

      infiniteQueryOptions: {
        initialPageParam: null,

        getNextPageParam: getNextCursor,
      },

      providesTags: (result) => [
        { type: "OfficerVisit", id: "LIST" },

        ...(result?.pages ?? []).flatMap((page) =>
          (page?.data ?? []).map((visit) => ({
            type: "OfficerVisit",
            id: visit.id,
          }))
        ),
      ],
    }),

    // ========================================
    // DOWNLOAD EXCEL REPORT
    // ========================================

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
            ...(search.trim()
              ? { search: search.trim() }
              : {}),

            ...(visit_date
              ? { visit_date }
              : {}),
          },

          cache: "no-cache",
          responseHandler: excelResponseHandler,
        });

        if (result.error) {
          return { error: result.error };
        }

        saveBlob(
          result.data,
          filename || "officer-visits-report.xlsx"
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
  useGetOfficerVisitsInfiniteQuery,
  useDownloadOfficerVisitsReportMutation,
} = officerVisitApi;
