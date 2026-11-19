
import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";

import "react-toastify/dist/ReactToastify.css";

const OfficerVisitPage = lazy(
  () => import("./pages/OfficerVisitPage")
);

function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        theme="colored"
      />

      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            Loading page...
          </div>
        }
      >
        <Routes>
          <Route
            path="/qr/:qrCode"
            element={<OfficerVisitPage />}
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
