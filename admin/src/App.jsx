import { Routes, Route, Navigate, Outlet, BrowserRouter } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Layout from "./components/Layout/Layout";

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Spinner from "./components/Layout/Spinner";






const Login = lazy(() => import("./pages/User/Login/Login"));
// const UploadPage = lazy(() => import("./pages/UploadPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));



//  const LeaveManagement = lazy(() => import("./pages/LeaveManagement"));
 const LocationQRManagement= lazy(() => import("./pages/LocationQRManagement"));
 const PoliceStationManagement= lazy(() => import("./pages/PoliceStationManagement"));
 const CreateLocationQR= lazy(() => import("./pages/CreateLocationQR"));
 
// import all your components...
// (SliderImage, TagText, etc.)

// 🔐 Protected Route
const ProtectedRoute = ({ user, loading }) => {
  if (loading) return <div className="text-center">Loading...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

// 🔓 Public Route
const PublicRoute = ({ user, loading }) => {
  if (loading) return <div className="text-center">Loading...</div>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

// 🔁 Fallback
const RoleAwareFallback = ({ user }) => {
  //return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
   return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default function RouterWrapper() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
console.log("Browser path:", window.location.pathname);
  // ✅ Call backend to check session
 useEffect(() => {
  fetch(
    //"https://448f-115-187-48-18.ngrok-free.app/api/admin/me",
    "http://localhost:4000/api/admin/me",
    {
      credentials: "include",
      // headers: {
      //   "ngrok-skip-browser-warning": "true",
      // },
    }
  )
    .then(async (res) => {
      const data = await res.json();

      console.log("ME STATUS:", res.status);
      console.log("ME RESPONSE:", data);

      setUser(data.user || null);
    })
    .catch((err) => {
      console.error("ME ERROR:", err);
      setUser(null);
    })
    .finally(() => setLoading(false));
}, []);

  return (
     <BrowserRouter>
     <>
  <Suspense fallback={<Spinner size="lg" text="Loading ..." />}>
      {/*<Routes>

       
        <Route element={<PublicRoute user={user} loading={loading} />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* 🔒 Protected Routes */}
        {/* <Route element={<ProtectedRoute user={user} loading={loading} />}>
          <Route element={<Layout/>}>
           
            <Route path="/dashboard" element={<Dashboard />} />

          
           
           
             <Route path="/leave" element={<LeaveManagement />}/>
             <Route path="/location-qrs" element={<LocationQRManagement/>}/>
             <Route
  path="/location-qrs/create"
  element={<CreateLocationQR />}
/>
             <Route path="/database" element={<Database/>}/>
              <Route path="/upload" element={<UploadPersonnel />}/>


          </Route>
        </Route> */}
        {/* Protected Routes */}


        {/* 🔁 Fallback */}
        {/* <Route path="*" element={<RoleAwareFallback user={user} />} /> 


      </Routes>*/}
      <Routes>
  {/* Public routes */}
  <Route element={<PublicRoute user={user} loading={loading} />}>
    <Route path="/login" element={<Login />} />
  </Route>

  {/* Protected routes */}
  <Route element={<ProtectedRoute user={user} loading={loading} />}>
    <Route path="/" element={<Layout />}>
      <Route index element={<Navigate to="/dashboard" replace />} />

      <Route path="dashboard" element={<Dashboard />} />
      {/* <Route path="leave" element={<LeaveManagement />} /> */}
      <Route path="location-qrs" element={<LocationQRManagement />} />
      <Route path="location-qrs/create" element={<CreateLocationQR />} />
      <Route path="police-stations" element={<PoliceStationManagement/>} />
 
    </Route>
  </Route>

  {/* 404 */}
 <Route path="*" element={<RoleAwareFallback user={user} />} /> 
</Routes>
      </Suspense>
      </>
      <ToastContainer position="top-right" autoClose={3000} />
    
    </BrowserRouter>
  );
}