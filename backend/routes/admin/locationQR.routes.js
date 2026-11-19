
import express from "express";

import {
  createLocationQR,
  getAllLocationQRs,
  regenerateLocationQR,
  updateLocationQR,
} from "../../controllers/admin/locationQR.controller.js";

const router = express.Router();
import userAuth from "../../middleware/userAuth.js";
import adminAuth from "../../middleware/adminAuth.js";
// Admin routes
router.post("/",userAuth,adminAuth, createLocationQR);

router.get("/",userAuth,adminAuth, getAllLocationQRs);
// Edit location details
router.put("/:id",userAuth,adminAuth, updateLocationQR);

// Generate a completely new QR token and image
router.post("/:id/regenerate",userAuth,adminAuth, regenerateLocationQR);

export default router;
