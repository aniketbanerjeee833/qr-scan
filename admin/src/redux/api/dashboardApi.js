import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const dashboardApi = createApi({
    reducerPath: "dashboardApi",
    baseQuery: fetchBaseQuery({
        baseUrl: "http://localhost:4000/api/",
        //baseUrl: "https://448f-115-187-48-18.ngrok-free.app/api/",
        credentials: "include",
             prepareHeaders: (headers) => {
    headers.set("ngrok-skip-browser-warning", "true");
    return headers;
  },
    }),
    tagTypes: ["Dashboard"],
    endpoints: (builder) => ({
        getPersonnelDashboard: builder.query({
            query: () => "admin/dashboard",
            providesTags: ["Dashboard"],
        }),
    }),
});

export const {
    useGetPersonnelDashboardQuery,
    
} = dashboardApi;