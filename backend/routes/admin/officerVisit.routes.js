
import express from "express";
import {
  getOfficerVisits,
} from "../../controllers/admin/officerVisit.controller.js";

const router = express.Router();
import userAuth from "../../middleware/userAuth.js";
import adminAuth from "../../middleware/adminAuth.js";
router.get("/",userAuth,adminAuth, getOfficerVisits);

export default router;
