import sdk from "stremio-addon-sdk";

const { addonBuilder, serveHTTP } = sdk;

const PORT = process.env.PORT || 7000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("CHYBA: V Renderu chybí TMDB_API_KEY.");
  process.exit(1);
}

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

// Jeden společný seznam českých a československých pohádek.
// Rok slouží k přesnějšímu vyhledání filmu v TMDB.
const FAIRYTALES = [
  ["Tři oříšky pro Popelku", 1973],
  ["S čerty nejsou žerty", 1984],
  ["Anděl Páně", 2005],
  ["Anděl Páně 2", 2016],
  ["Pyšná princezna", 1952],
  ["Perinbaba", 1985],
  ["Ať žijí duchové!", 1977],
  ["Tři veteráni", 1983],
  ["Princezna se zlatou hvězdou", 1959],
  ["Šíleně smutná princezna", 1968],
  ["Byl jednou jeden král...", 1954],
  ["Sůl nad zlato", 1982],
  ["Princ a Večernice", 1978],
  ["Panna a netvor", 1978],
  ["Malá mořská víla", 1976],
  ["Hrátky s čertem", 1956],
  ["Jak se budí princezny", 1977],
  ["Dařbuján a Pandrhola", 1959],
  ["Čert ví proč", 2003],
  ["Princezna ze mlejna", 1994],
  ["Princezna ze mlejna 2", 2000],
  ["O statečném kováři", 1983],
  ["Lotrando a Zubejda", 1997],
  ["Dívka na koštěti", 1971],
  ["Čarodějův učeň", 1977],
  ["Třetí princ", 1983],
  ["O princezně Jasněnce a létajícím ševci", 1987],
  ["Nebojsa", 1988],
  ["Obušku, z pytle ven!", 1955],
  ["Honza málem králem", 1977],
  ["Za humny je drak", 1982],
  ["Princ Bajaja", 1971],
  ["Zlatovláska", 1973],
  ["Nesmrtelná teta", 1993],
  ["Rumplcimprcampr", 1997],
  ["Jezerní královna", 1998],
  ["Z pekla štěstí", 1999],
  ["Sedmero krkavců", 1993],
  ["O vánoční hvězdě", 2020],
  ["Čertova nevěsta", 2011],
  ["Peklo s princeznou", 2009],
  ["Nejkrásnější hádanka", 2008],
  ["Tajemství staré bambitky", 2011],
  ["Čertí brko", 2018],
  ["Hodinářův učeň", 2019],
  ["Princezna zakletá v čase", 2020],
  ["Krakonošovo tajemství", 2022],
  ["Tři bratři", 2014],
  ["Korunní princ", 2015],
  ["Princezna a půl království", 2019],
  ["Dvanáct měsíčků", 2012],
  ["Kouzla králů", 2008],
  ["Nejlepší přítel", 2017],
  ["Láska rohatá", 2009],
  ["Jak si nevzít princeznu", 2021],
  ["Klíč svatého Petra", 2023],
  ["Tři princezny", 2024],
  ["Šťastný smolař", 2012],
  ["Svatojánský věneček", 2015],
  ["Pravý rytíř", 2016],
  ["Škola princů", 2010],
  ["Kdyby byly ryby", 2014],
  ["Tři životy", 2007],
  ["Co takhle svatba, princi?", 1986],
  ["Taneček přes dvě pekla", 1982],
  ["Micimutr", 2011],
  ["Duch nad zlato", 2013],
  ["Princezna a písař", 2014],
  ["Kouzelník Žito", 2018],
  ["Tajemství staré bambitky 2", 2021],
  ["Tři zlaté dukáty", 2023],
  ["Největší zázrak", 2022],
  ["Čarovné jablko", 2024],
  ["Kubula a Kuba Kubikula", 1956],
  ["Jak se Franta naučil bát", 1959],
  ["Král sokolů", 2000],
  ["Jak si zasloužit princeznu", 1995],
  ["Popelka", 1969],
  ["O princezně, která ráčkovala", 1986],
  ["O zatoulané princezně", 1987],
  ["Nezbedná pohádka", 1976],
  ["O princezně se zlatým lukem", 2002],
  ["Pohádky tisíce a jedné noci", 1974],
  ["Fimfárum Jana Wericha", 2002],
  ["Fimfárum 2", 2006],
  ["Fimfárum – Do třetice všeho dobrého", 2011],
  ["Císařův slavík", 1949],
  ["Švec a čert", 1956],
  ["Bajaja", 1950],
  ["O princezně na hrášku", 1976],
  ["O medvědu Ondřejovi", 1959],
  ["O Janovi a podivuhodném příteli", 1990]
];

// Odstranění duplicit podle názvu a roku.
const uniqueFairytales = [
  ...new Map(
    FAIRYTALES.map(item => [
      `${item[0].toLowerCase()}-${item[1]}`,
      item
    ])
  ).values()
];

const manifest = {
  id: "cz.ceske.vanocni.pohadky",
  version: "2.0.0",
  name: "České a československé pohádky",
  description:
    "Výběr českých a československých filmových a televizních pohádek. Metadata z TMDB.",
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

let movieCache = [];
let lastUpdate = 0;
let loadingPromise = null;

const CACHE_TIME = 6 * 60 * 60 * 1000;

async function tmdb(path, params = {}) {
  const url = new URL(BASE_URL + path);

  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "cs-CZ");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB HTTP ${response.status}`);
  }

  return response.json();
}

async function findMovie(title, year) {
  const result = await tmdb("/search/movie", {
    query: title,
    year,
    include_adult: false
  });

  const candidates = result.results || [];

  if (!candidates.length) {
    console.warn(`Nenalezeno: ${title} (${year})`);
    return null;
  }

  // Upřednostníme výsledek se správným rokem.
  const exactYear = candidates.find(movie =>
    movie.release_date &&
    movie.release_date.startsWith(String(year))
  );

  const movie = exactYear || candidates[0];

  return {
    id: `tmdb:${movie.id}`,
    type: "movie",
    name: movie.title || title,
    poster: movie.poster_path
      ? IMAGE_URL + movie.poster_path
      : undefined,
    background: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : undefined,
    description: movie.overview || "",
    releaseInfo: movie.release_date
      ? movie.release_date.slice(0, 4)
      : String(year),
    popularity: movie.popularity || 0,
    voteAverage: movie.vote_average || 0
  };
}

async function loadCatalog() {
  if (
    movieCache.length &&
    Date.now() - lastUpdate < CACHE_TIME
  ) {
    return movieCache;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log(
      `Načítám ${uniqueFairytales.length} jedinečných pohádek...`
    );

    const results = [];

    // Menší dávky kvůli limitům TMDB.
    for (let i = 0; i < uniqueFairytales.length; i += 5) {
      const batch = uniqueFairytales.slice(i, i + 5);

      const found = await Promise.all(
        batch.map(([title, year]) =>
          findMovie(title, year).catch(error => {
            console.error(`Chyba ${title}:`, error.message);
            return null;
          })
        )
      );

      results.push(...found.filter(Boolean));
    }

    // Popularita TMDB sestupně.
    movieCache = results.sort(
      (a, b) => b.popularity - a.popularity
    );

    lastUpdate = Date.now();

    console.log(
      `Katalog připraven: ${movieCache.length} filmů.`
    );

    return movieCache;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

builder.defineCatalogHandler(async ({ extra = {} }) => {
  try {
    let movies = await loadCatalog();

    if (extra.search) {
      const query = extra.search.toLowerCase();

      movies = movies.filter(movie =>
        movie.name.toLowerCase().includes(query)
      );
    }

    const skip = Math.max(0, Number(extra.skip || 0));

    return {
      metas: movies
        .slice(skip, skip + 100)
        .map(movie => ({
          id: movie.id,
          type: movie.type,
          name: movie.name,
          poster: movie.poster,
          background: movie.background,
          description: movie.description,
          releaseInfo: movie.releaseInfo,
          genres: ["Pohádka"]
        })),
      cacheMaxAge: 3600
    };
  } catch (error) {
    console.error("Chyba katalogu:", error);

    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ id }) => {
  try {
    if (!id.startsWith("tmdb:")) {
      return { meta: null };
    }

    const tmdbId = id.slice(5);

    if (!/^\d+$/.test(tmdbId)) {
      return { meta: null };
    }

    const movie = await tmdb(`/movie/${tmdbId}`, {
      append_to_response: "credits"
    });

    return {
      meta: {
        id,
        type: "movie",
        name: movie.title,
        poster: movie.poster_path
          ? IMAGE_URL + movie.poster_path
          : undefined,
        background: movie.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
          : undefined,
        description: movie.overview || "",
        releaseInfo: movie.release_date
          ? movie.release_date.slice(0, 4)
          : undefined,
        runtime: movie.runtime || undefined,
        genres: (movie.genres || []).map(g => g.name),
        imdbRating: movie.vote_average
          ? movie.vote_average.toFixed(1)
          : undefined
      }
    };
  } catch (error) {
    console.error("Chyba metadat:", error.message);
    return { meta: null };
  }
});

const addonInterface = builder.getInterface();

serveHTTP(addonInterface, {
  port: Number(PORT)
});

console.log(`Addon běží na portu ${PORT}`);
console.log(
  `V seznamu je ${uniqueFairytales.length} jedinečných položek.`
);