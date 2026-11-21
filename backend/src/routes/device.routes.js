const express = require("express");
const {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
} = require("../controllers/device.controller");
const { optionalAuth } = require("../middleware/auth.middleware");
const { requireDb } = require("../configuration/database");

const router = express.Router();

router.use(requireDb);
router.use(optionalAuth);

router.get("/", getDevices);
router.get("/:id", getDeviceById);
router.post("/", createDevice);
router.put("/:id", updateDevice);
router.patch("/:id", updateDevice);
router.delete("/:id", deleteDevice);

module.exports = router;
