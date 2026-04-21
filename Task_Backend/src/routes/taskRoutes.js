const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateStatus,
} = require("../controllers/taskController");

router.use(authMiddleware);

router.get("/", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", roleMiddleware, deleteTask);
router.patch("/:id/status", updateStatus);

module.exports = router;
