const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getTasks,
  getTaskById,
  getTaskSuggestions,
  createTask,
  updateTask,
  deleteTask,
  updateStatus,
} = require("../controllers/taskController");

router.use(authMiddleware);

router.get("/", getTasks);
router.get("/suggestions", getTaskSuggestions);
router.get("/:id", getTaskById);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.patch("/:id/status", updateStatus);

module.exports = router;
