import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";





export const userApi = createApi({
  reducerPath: "userApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000/api/",
    //baseUrl: "https://448f-115-187-48-18.ngrok-free.app/api/",
    credentials: "include", // same as withCredentials: true
  //        prepareHeaders: (headers) => {
  //   headers.set("ngrok-skip-browser-warning", "true");
  //   return headers;
  // },
  }),
  tagTypes: ["User"], // 👈 added Location for countries/states/cities
  endpoints: (builder) => ({

    

    

    adminLogin: builder.mutation({
      query: (body) => ({
        url: `admin/login`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    adminLogout: builder.mutation({
      query: () => ({
        url: `admin/logout`,
        method: "POST",
      }),
      invalidatesTags: ["User"],
    }),
    getAllContactUs: builder.query({
      query: ({ page = 1, limit = 5, search = "" }) =>
        `admin/contact-us/all?page=${page}&limit=${limit}&search=${search}`,
      providesTags: ["User"],
    }),


  
  

    
  }),
});


export const {

 
  useAdminLoginMutation,
  useAdminLogoutMutation,
  useGetAllContactUsQuery
} = userApi;
