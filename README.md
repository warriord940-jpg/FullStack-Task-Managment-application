# 📋 Role-Based Task Management System

A modern task management web application that allows users to create, organize, and manage their tasks efficiently while enforcing **role-based access control** for administrative actions.

The application ensures that sensitive operations are restricted to authorized roles while providing a clean and responsive interface for users.

---

## 🚀 Features

- 📝 **Task Management**  
  Create, update, delete, and track tasks easily.

- 👤 **Role-Based Access Control (RBAC)**  
  Different permissions for users and administrators.

- 🔐 **Secure Backend API**  
  RESTful APIs for task and user management.

- 📦 **Database Integration**  
  Persistent data storage using MongoDB.

- ⚡ **Scalable Architecture**  
  Modular backend structure for maintainability.

- 🎨 **Responsive UI**  
  Clean and modern interface built with Tailwind CSS.

---

## 🛠 Tech Stack

### Backend
- Node.js  
- Express.js  
- MongoDB  

### Frontend
- TypeScript  
- Tailwind CSS  

---

## 📂 Project Structure

```
task-management-app
│
├── backend
│   ├── controllers
│   ├── models
│   ├── routes
│   ├── middleware
│   └── server.js
│
├── frontend
│   ├── components
│   ├── pages
│   ├── services
│   └── styles
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/task-management-app.git
cd task-management-app
```

---

### 2️⃣ Install dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

---

### 3️⃣ Setup environment variables

Create a `.env` file in the backend folder:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

---

### 4️⃣ Run the application

Start backend:

```bash
npm run dev
```

Start frontend:

```bash
npm run dev
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|------|------|------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | User login |
| GET | /api/tasks | Get all tasks |
| POST | /api/tasks | Create new task |
| PUT | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete task |

---

## 🔐 Role-Based Permissions

| Role | Permissions |
|-----|-----|
| User | Create, update, and manage personal tasks |
| Admin | Manage all tasks and user permissions |

---

## 🌐 Future Improvements

- Task priority and labels  
- Team collaboration features  
- Real-time notifications  
- Dashboard analytics  
- Mobile-friendly UI enhancements  

---

## 🤝 Contributing

Contributions are welcome!  
Feel free to fork the repository and submit a pull request.

---

## 📧 Contact

If you have any questions or suggestions, feel free to reach out.

---

⭐ If you like this project, consider giving it a **star on GitHub**!
