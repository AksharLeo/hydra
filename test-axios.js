const axios = require("axios");
const instance = axios.create({ baseURL: "http://localhost:3000" });
instance.interceptors.request.use((cfg) => {
  console.log("Interceptor!");
  return cfg;
});
try {
  instance.delete(
    "/profile/games/artifacts/dafec759-0321-49fa-b898-f5f879947285",
    { headers: {} }
  );
  console.log("Success");
} catch (e) {
  console.log(e.name, e.message);
}
