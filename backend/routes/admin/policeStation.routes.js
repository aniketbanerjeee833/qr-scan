
import express from "express";

import userAuth from "../../middleware/userAuth.js";
import adminAuth from "../../middleware/adminAuth.js";

import {
  createPoliceStation,
  getPoliceStations,
  getPoliceStationById,
  updatePoliceStation,
  updatePoliceStationStatus,
  deletePoliceStation,

 
  createStationOfficer,
  getStationOfficers,
  updateStationOfficer,
  deleteStationOfficer,
  downloadStationReport,
  downloadOfficerReport,
  getOfficerVisitReport,
  getPoliceStationOptions,
} from "../../controllers/admin/policeStation.controller.js";

const router = express.Router();

router.use(userAuth, adminAuth);

// Police stations
router.post("/", createPoliceStation);
router.get("/", getPoliceStations);
router.get(
  "/options",
  getPoliceStationOptions
);


router.get("/:id", getPoliceStationById);
router.put("/:id", updatePoliceStation);
router.patch("/:id/status", updatePoliceStationStatus);
router.delete("/:id", deletePoliceStation);

// Employees under a station
router.post(
  "/:stationId/officers",
  createStationOfficer
);

router.get(
  "/:stationId/officers",
  getStationOfficers
);

router.put(
  "/:stationId/officers/:officerId",
  updateStationOfficer
);

router.delete(
  "/:stationId/officers/:officerId",
  deleteStationOfficer
);
router.get("/:stationId/report", downloadStationReport);
router.get( "/:stationId/officers/:officerId/report", downloadOfficerReport);
router.get("/:stationId/officers/:officerId/visit-report",getOfficerVisitReport);
export default router;
