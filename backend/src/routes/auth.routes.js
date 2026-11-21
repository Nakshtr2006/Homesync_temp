const express = require("express");
const { signup, login, getCurrentUser } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireDb } = require("../configuration/database");

const router = express.Router();

router.use(requireDb);

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authenticate, getCurrentUser);

module.exports = router;
