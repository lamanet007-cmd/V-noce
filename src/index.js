
import stremioAddonSdk from "stremio-addon-sdk";

const { addonBuilder, serveHTTP } = stremioAddonSdk;

const PORT = process.env.PORT || 7000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const TMDB_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";

if (!TMDB_API_KEY) {
  console.error("CHYBA: Chybí TMDB_API_KEY v prostředí Render.");
}

async function tmdb(path, params = {}) {
  if (!TMDB_API_KEY) {
    throw new Error("Chybí TMDB API klíč.");
  }

  const url = new URL(`${TMDB_URL}${path}`);

  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "cs-CZ");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `TMDB chyba ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

// =====================================
// SEZNAM ČESKÝCH A ČESKOSLOVENSKÝCH POHÁDEK
// =====================================

const FAIRYTALES = [
  ["Tři oříšky pro Popelku", 1973],
  ["S čerty nejsou žerty", 1984],
  ["Anděl Páně", 2005],
  ["Anděl Páně 2", 2016],
  ["Pyšná princezna", 1952],
  ["Princezna se zlatou hvězdou", 1959],
  ["Byl jednou jeden král", 1954],
  ["Hrátky s čertem", 1956],
  ["Dařbuján a Pandrhola", 1959],
  ["Šíleně smutná princezna", 1968],
  ["Honza málem králem", 1977],
  ["Princ a Večernice", 1978],
  ["Jak se budí princezny", 1977],
  ["Třetí princ", 1982],
  ["Sůl nad zlato", 1982],
  ["Perinbaba", 1985],
  ["Král Drozdí brada", 1984],
  ["Tři veteráni", 1983],
  ["Lotrando a Zubejda", 1997],
  ["Nesmrtelná teta", 1993],
  ["Princezna ze mlejna", 1994],
  ["Princezna ze mlejna 2", 2000],
  ["Z pekla štěstí", 1999],
  ["Z pekla štěstí 2", 2001],
  ["O princezně Jasněnce a létajícím ševci", 1987],
  ["Ať žijí duchové!", 1977],
  ["Dívka na koštěti", 1971],
  ["Jak utopit dr. Mráčka aneb Konec vodníků v Čechách", 1974],
  ["Chobotnice z II. patra", 1986],
  ["Krakonoš a lyžníci", 1980],
  ["Tajemství staré bambitky", 2011],
  ["Tajemství staré bambitky 2", 2021],
  ["Čertova nevěsta", 2011],
  ["Micimutr", 2011],
  ["Dvanáct měsíčků", 2012],
  ["Duch nad zlato", 2013],
  ["Princezna a písař", 2014],
  ["Korunní princ", 2015],
  ["Slíbená princezna", 2016],
  ["Nejlepší přítel", 2017],
  ["Kouzelník Žito", 2018],
  ["Čertí brko", 2018],
  ["Zakleté pírko", 2020],
  ["O léčivé vodě", 2020],
  ["O vánoční hvězdě", 2020],
  ["Jak si nevzít princeznu", 2021],
  ["Tři přání pro Popelku", 2021],
  ["Krakonošovo tajemství", 2022],
  ["Klíč svatého Petra", 2023],
  ["Tři princezny", 2024],
  ["Zlatovláska", 2025],
  ["Princezna zakletá v čase", 2020],
  ["Princezna zakletá v čase 2", 2022],
  ["Tajemství Lesní země", 2006],
  ["O statečném kováři", 1983],
  ["Malá mořská víla", 1976],
  ["Panna a netvor", 1978],
  ["Deváté srdce", 1978],
  ["Kopretiny pro zámeckou paní", 1981],
  ["O princezně, která ráčkovala", 1986],
  ["O třech ospalých princeznách", 1998],
  ["Kouzelný měšec", 1996],
  ["Zlatník Ondra", 1997],
  ["O princezně z Rimini", 1999],
  ["Královský slib", 2001],
  ["Čert ví proč", 2003],
  ["Poklad na Sovím hrádku", 2004],
  ["Anděl Páně", 2005],
  ["Tři životy", 2007],
  ["Kouzla králů", 2008],
  ["Láska rohatá", 2009],
  ["Dešťová víla", 2010],
  ["Škola princů", 2010],
  ["Vánoční království", 2011],
  ["Dvanáct měsíčků", 2012],
  ["Křesadlo", 2014],
  ["Svatojánský věneček", 2015],
  ["Pravý rytíř", 2016],
  ["Nejlepší přítel", 2017],
  ["O zakletém králi a odvážném Martinovi", 2018],
  ["Princezna a půl království", 2019],
  ["O vánoční hvězdě", 2020],
  ["Tři zlaté dukáty", 2023],
  ["Čarovné jablko", 2024],
  ["Sedmero krkavců", 2015],
  ["Čertoviny", 2018],
  ["Zdeňkův svět pohádek", 2016],
  ["O pokladech", 2012],
  ["Když draka bolí hlava", 2018],
  ["Největší dar", 2022],
  ["Tajemství staré bambitky", 2011]
];

// Odstranění duplicit
const uniqueFairytales = [
  ...new Map(
    FAIRYTALES.map(([title, year]) => [
      `${title}-${year}`,
      [title, year]
    ])
  ).values()
];

// =====================================
// MANIFEST
// =====================================

const manifest = {
  id: "cz.ceske.vanocni.pohadky",
  version: "2.0.1",
  name: "České a československé pohádky",
  description:
    "Katalog českých a československých pohádek s informacemi z TMDB.",
  logo: "",
  resources: ["catalog", "meta"],
  types: ["movie"],
  idPrefixes: ["tmdb:"],
  catalogs: [
    {
      type: "movie",
      id: "ceske-vanocni-pohadky",
      name: "České a československé pohádky",
      extra: [
        { name: "skip", isRequired: false },
        { name: "search", isRequired: false }
      ]
    }
  ]
};

const builder = new addonBuilder(manifest);

// =====================================
// VYHLEDÁNÍ FILMU V TMDB
// =====================================

async function findMovie(title, year) {
  try {
    const result = await tmdb("/search/movie", {
      query: title,
      year
    });

    const movies = result.results || [];

    if (!movies.length) {
      console.log("Nenalezeno:", title, year);
      return null;
    }

    const exactYear = movies.find(movie =>
      movie.release_date?.startsWith(String(year))
    );

    const movie = exactYear || movies[0];

    return {
      id: `tmdb:${movie.id}`,
      type: "movie",
      name: movie.title || title,
      poster: movie.poster_path
        ? IMAGE_URL + movie.poster_path
        : undefined,
      background: movie.backdrop_path
        ? BACKDROP_URL + movie.backdrop_path
        : undefined,
      description: movie.overview || "",
      releaseInfo: movie.release_date
        ? movie.release_date.substring(0, 4)
        : String(year),
      popularity: movie.popularity || 0
    };
  } catch (error) {
    console.error(
      `Chyba vyhledávání ${title}:`,
      error.message
    );
    return null;
  }
}

// =====================================
// NAČTENÍ KATALOGU
// =====================================

let catalogCache = null;
let catalogCacheTime = 0;

async function loadCatalog() {
  const now = Date.now();

  // Cache na 6 hodin
  if (
    catalogCache &&
    now - catalogCacheTime < 6 * 60 * 60 * 1000
  ) {
    return catalogCache;
  }

  console.log("Načítám katalog pohádek z TMDB...");

  const results = [];

  // Dávky po pěti požadavcích
  for (let i = 0; i < uniqueFairytales.length; i += 5) {
    const batch = uniqueFairytales.slice(i, i + 5);

    const batchResults = await Promise.all(
      batch.map(([title, year]) =>
        findMovie(title, year)
      )
    );

    results.push(
      ...batchResults.filter(Boolean)
    );
  }

  // Seřazení podle popularity
  results.sort(
    (a, b) => b.popularity - a.popularity
  );

  catalogCache = results;
  catalogCacheTime = now;

  console.log(
    `Katalog načten. Počet filmů: ${results.length}`
  );

  return results;
}

// =====================================
// CATALOG HANDLER
// =====================================

builder.defineCatalogHandler(async ({ extra }) => {
  try {
    let movies = await loadCatalog();

    if (extra?.search) {
      const search = extra.search.toLowerCase();

      movies = movies.filter(movie =>
        movie.name.toLowerCase().includes(search)
      );
    }

    const skip = Math.max(
      0,
      Number(extra?.skip) || 0
    );

    return {
      metas: movies.slice(skip, skip + 100)
    };
  } catch (error) {
    console.error("Chyba katalogu:", error);
    return { metas: [] };
  }
});

// =====================================
// DETAIL FILMU Z TMDB
// =====================================

builder.defineMetaHandler(async ({ type, id }) => {
  console.log("================================");
  console.log("Požadavek na detail pohádky:");
  console.log("ID:", id);
  console.log("Typ:", type);

  try {
    const match = String(id).match(/^tmdb:(\d+)$/);

    if (!match || type !== "movie") {
      console.error("Neplatné ID nebo typ:", id, type);
      return { meta: null };
    }

    const tmdbId = match[1];

    const movie = await tmdb(`/movie/${tmdbId}`, {
      append_to_response: "credits,external_ids",
      language: "cs-CZ"
    });

    if (!movie || !movie.id) {
      console.error("Film nebyl v TMDB nalezen:", tmdbId);
      return { meta: null };
    }

    const director = (
      movie.credits?.crew || []
    )
      .filter(person => person.job === "Director")
      .map(person => person.name);

    const cast = (
      movie.credits?.cast || []
    )
      .slice(0, 15)
      .map(person => person.name);

    const genres = (
      movie.genres || []
    ).map(genre => genre.name);

    const countries = (
      movie.production_countries || []
    ).map(country => country.name);

    const meta = {
      id: `tmdb:${movie.id}`,
      type: "movie",
      name: movie.title || movie.original_title || "Neznámý film",

      poster: movie.poster_path
        ? IMAGE_URL + movie.poster_path
        : undefined,

      background: movie.backdrop_path
        ? BACKDROP_URL + movie.backdrop_path
        : undefined,

      description:
        movie.overview ||
        movie.tagline ||
        "Popis filmu není v TMDB dostupný.",

      releaseInfo: movie.release_date
        ? movie.release_date.substring(0, 4)
        : undefined,

      released: movie.release_date
        ? `${movie.release_date}T00:00:00.000Z`
        : undefined,

      runtime: movie.runtime
        ? `${movie.runtime}m`
        : undefined,

      genres,
      director,
      cast,

      country: countries.join(", "),

      website:
        `https://www.themoviedb.org/movie/${movie.id}`,

      links: [
        {
          name: "TMDB",
          category: "external",
          url: `https://www.themoviedb.org/movie/${movie.id}`
        }
      ]
    };

    console.log("Detail úspěšně načten:", meta.name);

    return { meta };

  } catch (error) {
    console.error("CHYBA DETAILU TMDB:", error);
    return { meta: null };
  }
});

// =====================================
// SPUŠTĚNÍ ADDONU
// =====================================

const addonInterface = builder.getInterface();

serveHTTP(addonInterface, {
  port: Number(PORT)
});

console.log(
  `České pohádky addon běží na portu ${PORT}`
);
