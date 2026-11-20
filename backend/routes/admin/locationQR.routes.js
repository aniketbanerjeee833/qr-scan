
import express from "express";

import {
  createLocationQR,
  deleteLocationQR,
  getAllLocationQRs,
  regenerateLocationQR,
  updateLocationQR,
} from "../../controllers/admin/locationQR.controller.js";

const router = express.Router();
import userAuth from "../../middleware/userAuth.js";
import adminAuth from "../../middleware/adminAuth.js";
router.use(userAuth, adminAuth);
// Admin routes
router.post("/", createLocationQR);

router.get("/", getAllLocationQRs);
// Edit location details
router.put("/:id", updateLocationQR);

// Generate a completely new QR token and image
router.post("/:id/regenerate", regenerateLocationQR);
router.delete("/:id", deleteLocationQR);

export default router;
