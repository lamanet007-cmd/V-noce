import stremioAddonSdk from "stremio-addon-sdk";

const { addonBuilder, serveHTTP } = stremioAddonSdk;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 7000;

if (!TMDB_API_KEY) {
  console.error("CHYBA: Chybí TMDB_API_KEY v prostředí Render.");
  process.exit(1);
}

const BASE_URL = "https://api.themoviedb.org/3";

const manifest = {
  id: "cz.vanocni.pohadky",
  version: "1.0.1",
  name: "České vánoční pohádky",
  description:
    "Katalog českých a československých vánočních pohádek seřazených podle popularity z TMDB.",
  logo: "https://www.themoviedb.org/assets/2/v4/logos/powered-by-tmdb-green-3e6a8a3b0c4c8c3d5a8e4e6f3e5c5b3e.png",
  resources: ["catalog", "meta"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "ceske-vanocni-pohadky",
      name: "České vánoční pohádky",
      extra: [
        {
          name: "skip",
          isRequired: false
        }
      ]
    }
  ],
  idPrefixes: ["tmdb:"]
};

const builder = new addonBuilder(manifest);

const cache = new Map();
const CACHE_TIME = 6 * 60 * 60 * 1000;

async function tmdb(path, params = {}) {
  const url = new URL(BASE_URL + path);

  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "cs-CZ");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `TMDB API chyba: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function getMovieDetails(id) {
  return tmdb(`/movie/${id}`, {
    append_to_response: "keywords",
    language: "cs-CZ"
  });
}

function isCzechMovie(movie) {
  const countries = movie.production_countries || [];

  return countries.some(
    country => country.iso_3166_1 === "CZ" ||
               country.iso_3166_1 === "CS" ||
               country.iso_3166_1 === "SK"
  );
}

function isFairytale(movie) {
  const genres = (movie.genres || []).map(g => g.name.toLowerCase());

  const keywords = (
    movie.keywords?.keywords || []
  ).map(k => k.name.toLowerCase());

  const text = [
    movie.title,
    movie.original_title,
    movie.overview,
    ...keywords
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const fairytaleWords = [
    "pohádka",
    "pohadka",
    "fairy tale",
    "fairytale",
    "princezna",
    "princ",
    "král",
    "kral",
    "čert",
    "cert",
    "anděl",
    "andel",
    "kouzlo",
    "kouzelný",
    "kouzelny",
    "čaroděj",
    "carodej"
  ];

  const christmasWords = [
    "vánoce",
    "vanoce",
    "vánoční",
    "vanocni",
    "christmas",
    "christmas eve",
    "štědrý den",
    "stedry den"
  ];

  const hasFairytaleGenre =
    genres.includes("fantasy") ||
    genres.includes("family") ||
    genres.includes("rodinný") ||
    genres.includes("rodinný film");

  const hasFairytaleWord = fairytaleWords.some(word =>
    text.includes(word)
  );

  const hasChristmasWord = christmasWords.some(word =>
    text.includes(word)
  );

  return (
    (hasFairytaleGenre && hasChristmasWord) ||
    (hasFairytaleWord && hasChristmasWord)
  );
}

async function searchMovies() {
  const cached = cache.get("movies");

  if (cached && Date.now() - cached.time < CACHE_TIME) {
    return cached.data;
  }

  console.log("Načítám pohádky z TMDB...");

  const movieMap = new Map();

  // Vyhledávání podle názvů
  const searches = [
    "Vánoce",
    "Vánoční pohádka",
    "Christmas",
    "Christmas fairy tale",
    "Česká pohádka",
    "České pohádky"
  ];

  for (const query of searches) {
    try {
      const result = await tmdb("/search/movie", {
        query,
        page: 1,
        include_adult: false
      });

      for (const movie of result.results || []) {
        movieMap.set(movie.id, movie);
      }
    } catch (error) {
      console.error("Chyba při hledání:", query, error.message);
    }
  }

  // Vyhledávání českých filmů podle země a žánru
  const discoverQueries = [
    { with_origin_country: "CZ", with_genres: "14" },
    { with_origin_country: "CZ", with_genres: "10751" },
    { with_origin_country: "SK", with_genres: "14" },
    { with_origin_country: "SK", with_genres: "10751" }
  ];

  for (const params of discoverQueries) {
    try {
      const result = await tmdb("/discover/movie", {
        ...params,
        sort_by: "popularity.desc",
        page: 1,
        include_adult: false
      });

      for (const movie of result.results || []) {
        movieMap.set(movie.id, movie);
      }
    } catch (error) {
      console.error("Chyba při načítání filmů:", error.message);
    }
  }

  const movies = [...movieMap.values()];

  const detailedMovies = [];

  // Podrobnosti načítáme po menších dávkách
  for (let i = 0; i < movies.length; i += 5) {
    const batch = movies.slice(i, i + 5);

    const details = await Promise.all(
      batch.map(async movie => {
        try {
          return await getMovieDetails(movie.id);
        } catch (error) {
          console.error(
            "Chyba detailu filmu:",
            movie.id,
            error.message
          );
          return null;
        }
      })
    );

    detailedMovies.push(...details.filter(Boolean));
  }

  const filtered = detailedMovies
    .filter(movie => {
      if (!movie.id) return false;
      if (!movie.poster_path) return false;
      if (!isCzechMovie(movie)) return false;
      return isFairytale(movie);
    })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  cache.set("movies", {
    time: Date.now(),
    data: filtered
  });

  console.log(`Nalezeno pohádek: ${filtered.length}`);

  return filtered;
}

function toStremioMeta(movie) {
  return {
    id: `tmdb:${movie.id}`,
    type: "movie",
    name: movie.title || movie.original_title,
    poster: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : undefined,
    background: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : undefined,
    description: movie.overview || "",
    releaseInfo: movie.release_date
      ? movie.release_date.substring(0, 4)
      : undefined,
    genres: (movie.genres || []).map(g => g.name),
    imdbRating: movie.vote_average
      ? movie.vote_average.toFixed(1)
      : undefined,
    runtime: movie.runtime || undefined
  };
}

builder.defineCatalogHandler(async ({ extra }) => {
  try {
    const movies = await searchMovies();

    const skip = Math.max(0, Number(extra?.skip || 0));
    const pageSize = 100;

    const page = movies.slice(skip, skip + pageSize);

    return {
      metas: page.map(toStremioMeta)
    };
  } catch (error) {
    console.error("Chyba katalogu:", error);

    return {
      metas: []
    };
  }
});

builder.defineMetaHandler(async ({ id }) => {
  try {
    if (!id.startsWith("tmdb:")) {
      return { meta: null };
    }

    const tmdbId = id.replace("tmdb:", "");

    if (!/^\d+$/.test(tmdbId)) {
      return { meta: null };
    }

    const movie = await getMovieDetails(tmdbId);

    return {
      meta: toStremioMeta(movie)
    };
  } catch (error) {
    console.error("Chyba metadat:", error);

    return {
      meta: null
    };
  }
});

const addonInterface = builder.getInterface();

serveHTTP(addonInterface, {
  port: PORT
});

console.log(`České vánoční pohádky addon běží na portu ${PORT}`);