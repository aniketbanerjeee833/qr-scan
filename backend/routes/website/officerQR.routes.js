
import express from "express";

import {
  getAllOfficersByPoliceStation,
  getScannedQRDetails,
  submitOfficerVisit,
} from "../../controllers/website/officerQR.controller.js";

import upload from "../../utils/upload.js";

const router = express.Router();

// Fetch police station and QR details
router.get(
  "/qr/:qrCode",
  getScannedQRDetails
);

// Capture and submit officer visit
router.post(
  "/qr/:qrCode/visit",
 upload.single("image"),
  submitOfficerVisit
);
router.get(
  "/qr/:qrCode/officers",
  getAllOfficersByPoliceStation 
);

export default router;
