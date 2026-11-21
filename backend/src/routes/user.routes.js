const express = require("express");
const { signup, login } = require("../controllers/auth.controller");
const {
  getUserById,
  updateProfile,
  changePassword,
  updatePreferences,
  deleteAccount,
} = require("../controllers/user.controller");
const { requireDb } = require("../configuration/database");

const router = express.Router();

router.use(requireDb);

// Aliases for signup and login to maintain complete compatibility with existing frontend forms
router.post("/signup", signup);
router.post("/login", login);

// Profile and settings operations
router.get("/:id", getUserById);
router.patch("/:id", updateProfile);
router.put("/:id", updateProfile);
router.patch("/:id/password", changePassword);
router.patch("/:id/preferences", updatePreferences);
router.delete("/:id", deleteAccount);

module.exports = router;
