// Copy this file to config.js if you want to override the backend URL manually.
// Local example: window.API_URL = "http://localhost:3000/api";
// Production example: window.API_URL = "https://your-backend.example.com/api";
window.API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000/api"
  : "https://YOUR-BACKEND-DOMAIN.example.com/api";
