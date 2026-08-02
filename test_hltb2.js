import axios from "axios";

async function run() {
  const objectId = "1888160";
  const steamRes = await axios.get(
    "https://store.steampowered.com/api/appdetails",
    { params: { appids: objectId, l: "english", cc: "us" } }
  );
  const name = steamRes.data[objectId].data.name
    .replace(/[^\w\s-]/g, "")
    .trim();
  console.log("Name:", name);

  const initHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Referer: "https://howlongtobeat.com",
  };
  const auth = await axios.get(
    `https://howlongtobeat.com/api/bleed/init?t=${Date.now()}`,
    { headers: initHeaders }
  );

  const res = await axios.post(
    "https://howlongtobeat.com/api/bleed",
    {
      [auth.data.hpKey]: auth.data.hpVal,
      searchType: "games",
      searchTerms: name.split(" "),
      searchPage: 1,
      size: 1,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: "popular",
          rangeCategory: "main",
          rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
          modifier: "",
        },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
    },
    {
      headers: {
        ...initHeaders,
        "Content-Type": "application/json",
        "X-Auth-Token": auth.data.token,
        "X-Hp-Key": auth.data.hpKey,
        "X-Hp-Val": auth.data.hpVal,
      },
    }
  );

  console.log("Data:", res.data.data?.[0]);
}

run().catch(console.error);
