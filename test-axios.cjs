const axios = require("axios");
const instance = axios.create();
instance
  .get("/api/test")
  .catch((e) => console.log("Promise rejected:", e.name, e.message));
