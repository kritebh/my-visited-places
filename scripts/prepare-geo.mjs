// Downloads boundary data and builds simplified GeoJSON for the server (region
// assignment) and the client (map rendering).
//
//   node scripts/prepare-geo.mjs
//
// Sources:
//   - Natural Earth 10m countries, India point-of-view (full J&K / Ladakh)
//   - Natural Earth 10m admin-1 states/provinces (non-India countries)
//   - udit-001/india-maps-data districts (Survey of India aligned), dissolved to states
import fs from "node:fs/promises";
import path from "node:path";
import mapshaper from "mapshaper";

const root = path.resolve(import.meta.dirname, "..");
const cache = path.join(root, ".geo-cache");
const serverOut = path.join(root, "data", "geo");
const clientOut = path.join(root, "public", "geo");

const SOURCES = {
  countries:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson",
  admin1:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
  india: "https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson",
};

export const INDIA_STATE_CODES = {
  "Andaman and Nicobar Islands": "IN-AN",
  "Andhra Pradesh": "IN-AP",
  "Arunachal Pradesh": "IN-AR",
  Assam: "IN-AS",
  Bihar: "IN-BR",
  Chandigarh: "IN-CH",
  Chhattisgarh: "IN-CT",
  "Dadra and Nagar Haveli and Daman and Diu": "IN-DH",
  Delhi: "IN-DL",
  Goa: "IN-GA",
  Gujarat: "IN-GJ",
  Haryana: "IN-HR",
  "Himachal Pradesh": "IN-HP",
  "Jammu and Kashmir": "IN-JK",
  Jharkhand: "IN-JH",
  Karnataka: "IN-KA",
  Kerala: "IN-KL",
  Ladakh: "IN-LA",
  Lakshadweep: "IN-LD",
  "Madhya Pradesh": "IN-MP",
  Maharashtra: "IN-MH",
  Manipur: "IN-MN",
  Meghalaya: "IN-ML",
  Mizoram: "IN-MZ",
  Nagaland: "IN-NL",
  Odisha: "IN-OR",
  Puducherry: "IN-PY",
  Punjab: "IN-PB",
  Rajasthan: "IN-RJ",
  Sikkim: "IN-SK",
  "Tamil Nadu": "IN-TN",
  Telangana: "IN-TG",
  Tripura: "IN-TR",
  "Uttar Pradesh": "IN-UP",
  Uttarakhand: "IN-UT",
  "West Bengal": "IN-WB",
};

async function download(name, url) {
  const file = path.join(cache, `${name}.geojson`);
  try {
    await fs.access(file);
    return file;
  } catch {}
  console.log(`Downloading ${name}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/** Run a mapshaper pipeline on an in-memory FeatureCollection. */
async function shape(fc, commands) {
  const out = await mapshaper.applyCommands(`-i in.json ${commands} -o out.json format=geojson precision=0.0001`, {
    "in.json": JSON.stringify(fc),
  });
  return JSON.parse(out["out.json"].toString());
}

async function write(dir, name, fc) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, JSON.stringify(fc));
  const kb = Math.round((await fs.stat(file)).size / 1024);
  console.log(`  ${path.relative(root, file)}  ${fc.features.length} features  ${kb} KB`);
}

async function main() {
  await fs.mkdir(cache, { recursive: true });
  const [countriesFile, admin1File, indiaFile] = await Promise.all([
    download("countries", SOURCES.countries),
    download("admin1", SOURCES.admin1),
    download("india", SOURCES.india),
  ]);

  // Countries: normalise to { code, name, continent }
  const countriesRaw = await readJson(countriesFile);
  countriesRaw.features = countriesRaw.features.map((f) => {
    const p = f.properties;
    const iso = [p.ISO_A2_EH, p.ISO_A2].find((c) => c && c !== "-99");
    return {
      type: "Feature",
      geometry: f.geometry,
      properties: { code: iso ?? p.ADM0_A3, name: p.NAME_EN || p.NAME, continent: p.CONTINENT },
    };
  });
  // Merge features sharing a code (e.g. overseas parts) and simplify
  const countriesServer = await shape(countriesRaw, "-dissolve fields=code copy-fields=name,continent -simplify 15% keep-shapes");
  const countriesClient = await shape(countriesRaw, "-dissolve fields=code copy-fields=name,continent -simplify 6% weighted keep-shapes");

  // India states: dissolve districts on state name
  const indiaRaw = await readJson(indiaFile);
  indiaRaw.features = indiaRaw.features
    .filter((f) => f.geometry && f.properties.st_nm)
    .map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { name: f.properties.st_nm },
    }));
  const indiaDissolved = await shape(indiaRaw, "-clean -dissolve fields=name");
  for (const f of indiaDissolved.features) {
    const code = INDIA_STATE_CODES[f.properties.name];
    if (!code) throw new Error(`No ISO code for Indian state ${f.properties.name}`);
    f.properties = { code, name: f.properties.name, country: "IN" };
  }
  const indiaServer = await shape(indiaDissolved, "-simplify 80% keep-shapes");
  const indiaClient = await shape(indiaDissolved, "-simplify 70% weighted keep-shapes");

  // Admin-1 for the rest of the world (India comes from the dataset above)
  const admin1Raw = await readJson(admin1File);
  admin1Raw.features = admin1Raw.features
    .filter((f) => f.geometry && f.properties.iso_a2 !== "IN" && f.properties.adm0_a3 !== "IND")
    .map((f) => {
      const p = f.properties;
      const country = p.iso_a2 && p.iso_a2 !== "-99" ? p.iso_a2 : p.adm0_a3;
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          code: p.iso_3166_2 && !p.iso_3166_2.endsWith("~") ? p.iso_3166_2 : `${country}-${p.adm1_code}`,
          name: p.name_en || p.name,
          country,
        },
      };
    });
  const admin1Server = await shape(admin1Raw, "-simplify 6% keep-shapes");

  console.log("Writing:");
  await write(serverOut, "countries.json", countriesServer);
  await write(serverOut, "india-states.json", indiaServer);
  await write(serverOut, "admin1.json", admin1Server);
  await write(clientOut, "countries.json", countriesClient);
  await write(clientOut, "india-states.json", indiaClient);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
