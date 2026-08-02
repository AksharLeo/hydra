import { steamCatalogueSearch } from "./src/main/services/steam-catalogue";
steamCatalogueSearch({ take: 24, skip: 0 }).then((res) => {
  console.log("length:", res.edges.length, "count:", res.count);
});
