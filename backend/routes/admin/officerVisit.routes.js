
import express from "express";
import {
  getOfficerVisits,
  downloadOfficerVisitsReport,
} from "../../controllers/admin/officerVisit.controller.js";

import userAuth from "../../middleware/userAuth.js";
import adminAuth from "../../middleware/adminAuth.js";

const router = express.Router();
router.use(userAuth, adminAuth)
router.get(
  "/report",
 
  downloadOfficerVisitsReport
);

router.get(
  "/",
  getOfficerVisits
);

export default router;