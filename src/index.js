
import { addonBuilder, serveHTTP } from "stremio-addon-sdk";

const PORT = process.env.PORT || 7000;
const API_KEY = process.env.TMDB_API_KEY;
const LANGUAGE = "cs-CZ";
const CACHE_TIME = 6 * 60 * 60 * 1000;

if (!API_KEY) {
  throw new Error("Chybí TMDB_API_KEY");
}

const manifest = {
  id: "cz.vanocni.pohadky",
  version: "1.0.0",
  name: "České vánoční pohádky",
  description: "České a československé vánoční pohádky podle popularity TMDB",
  resources: ["catalog", "meta"],
  types: ["movie"],
  idPrefixes: ["tmdb:"],
  catalogs: [
    {
      type: "movie",
      id: "ceske-vanocni-pohadky",
      name: "České vánoční pohádky"
    }
  ]
};

const builder = new addonBuilder(manifest);

let cache = {
  time: 0,
  movies: []
};

async function tmdb(endpoint, params = {}) {
  const url = new URL(
    `https://api.themoviedb.org/3${endpoint}`
  );

  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", LANGUAGE);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB error: ${response.status}`);
  }

  return response.json();
}

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isChristmas(movie, keywords = []) {
  const text = normalize([
    movie.title,
    movie.original_title,
    movie.overview,
    ...keywords.map(k => k.name)
  ].join(" "));

  return [
    "vanoce",
    "vanocni",
    "stedry vecer",
    "stedry den",
    "christmas",
    "advent"
  ].some(word => text.includes(normalize(word)));
}

function isFairytale(movie, keywords = []) {
  const genres = movie.genres?.map(g => g.id)
    || movie.genre_ids
    || [];

  const text = normalize([
    movie.title,
    movie.original_title,
    movie.overview,
    ...keywords.map(k => k.name)
  ].join(" "));

  return (
    genres.includes(14) ||
    genres.includes(10751) ||
    text.includes("pohadka") ||
    text.includes("fairy tale")
  );
}

async function loadMovies() {
  if (
    cache.movies.length &&
    Date.now() - cache.time < CACHE_TIME
  ) {
    return cache.movies;
  }

  const candidates = new Map();

  // České a slovenské fantasy a rodinné filmy
  for (const country of ["CZ", "SK"]) {
    for (const genre of ["14", "10751"]) {
      for (let page = 1; page <= 5; page++) {
        const result = await tmdb("/discover/movie", {
          with_origin_country: country,
          with_genres: genre,
          sort_by: "popularity.desc",
          include_adult: "false",
          page
        });

        for (const movie of result.results || []) {
          candidates.set(movie.id, movie);
        }

        if (page >= result.total_pages) break;
      }
    }
  }

  // Další hledání vánočních filmů
  for (const query of [
    "Vánoce",
    "Vánoční pohádka",
    "Christmas"
  ]) {
    const result = await tmdb("/search/movie", {
      query,
      region: "CZ"
    });

    for (const movie of result.results || []) {
      candidates.set(movie.id, movie);
    }
  }

  const output = [];

  const list = [...candidates.values()];

  // Detailní kontrola TMDB metadat
  for (let i = 0; i < list.length; i += 8) {
    const batch = list.slice(i, i + 8);

    const details = await Promise.all(
      batch.map(movie =>
        tmdb(`/movie/${movie.id}`, {
          append_to_response: "keywords"
        }).catch(() => movie)
      )
    );

    for (const movie of details) {
      const keywords =
        movie.keywords?.keywords || [];

      if (
        !isChristmas(movie, keywords) ||
        !isFairytale(movie, keywords)
      ) {
        continue;
      }

      output.push({
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
        releaseInfo: movie.release_date?.slice(0, 4),
        imdbRating: movie.vote_average
          ? movie.vote_average.toFixed(1)
          : undefined,
        genres: movie.genres?.map(g => g.name) || [],
        links: [{
          name: "TMDB",
          category: "imdb",
          url: `https://www.themoviedb.org/movie/${movie.id}`
        }],
        _popularity: Number(movie.popularity || 0)
      });
    }
  }

  // Nejdříve nejpopulárnější
  output.sort(
    (a, b) => b._popularity - a._popularity
  );

  cache = {
    time: Date.now(),
    movies: output
  };

  console.log(`Načteno pohádek: ${output.length}`);

  return output;
}

builder.defineCatalogHandler(async ({ id, extra }) => {
  if (id !== "ceske-vanocni-pohadky") {
    return { metas: [] };
  }

  try {
    const movies = await loadMovies();

    const skip = Number(extra?.skip || 0);

    return {
      metas: movies.slice(skip, skip + 100)
        .map(({ _popularity, ...movie }) => movie)
    };
  } catch (error) {
    console.error(error);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "movie" || !id.startsWith("tmdb:")) {
    return { meta: null };
  }

  const movieId = id.replace("tmdb:", "");

  try {
    const movie = await tmdb(`/movie/${movieId}`);

    return {
      meta: {
        id,
        type: "movie",
        name: movie.title,
        poster: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : undefined,
        background: movie.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
          : undefined,
        description: movie.overview,
        releaseInfo: movie.release_date?.slice(0, 4),
        imdbRating: movie.vote_average?.toFixed(1)
      }
    };
  } catch (error) {
    console.error(error);
    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: PORT
});

console.log(`Addon běží na portu ${PORT}`);
