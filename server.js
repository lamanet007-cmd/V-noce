const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 7000;

const TMDB_API_KEY = '3fd2be6f0cd051635ec5082d18ace561';

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

const manifest = {
    id: 'org.drsnak.czechchristmasfairytales',
    version: '2.2.0',
    name: 'České Vánoční Pohádky',
    description: 'Kompletní dynamický katalog českých a československých pohádek ze serveru TMDB.',
    resources: ['catalog'],
    types: ['movie'],
    catalogs: [
        {
            type: 'movie',
            id: 'cz_xmas_fairytales',
            name: 'České Vánoční Pohádky'
        }
    ],
    idPrefixes: ['tt']
};

app.get('/manifest.json', (req, res) => {
    res.json(manifest);
});

app.get('/catalog/movie/cz_xmas_fairytales.json', async (req, res) => {
    try {
        let allMovies = [];
        
        for (let page = 1; page <= 3; page++) {
            const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=cs-CZ&query=pohádka&page=${page}`;
            const response = await fetch(searchUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.results) allMovies = allMovies.concat(data.results);
            }
        }

        for (let page = 1; page <= 3; page++) {
            const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=cs-CZ&with_origin_country=CZ|CS&with_genres=10751,14&page=${page}`;
            const response = await fetch(discoverUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.results) allMovies = allMovies.concat(data.results);
            }
        }

        const uniqueMoviesMap = new Map();
        allMovies.forEach(movie => {
            if (movie && movie.id && movie.poster_path) {
                uniqueMoviesMap.set(movie.id, movie);
            }
        });

        const uniqueMovies = Array.from(uniqueMoviesMap.values());

        const detailedMoviesPromises = uniqueMovies.map(async (movie) => {
            try {
                const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=cs-CZ`);
                if (!detailRes.ok) return null;
                return await detailRes.json();
            } catch (err) {
                return null;
            }
        });

        const detailedMovies = await Promise.all(detailedMoviesPromises);

        const validMovies = detailedMovies
            .filter(item => item && item.imdb_id && item.poster_path)
            .sort((a, b) => b.popularity - a.popularity);

        const metas = validMovies.map(movie => {
            const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
            return {
                id: movie.imdb_id,
                type: 'movie',
                name: movie.title || movie.original_title,
                poster: posterUrl,
                posterShape: 'poster',
                background: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : posterUrl,
                description: movie.overview || 'Česká pohádka.',
                releaseInfo: movie.release_date ? movie.release_date.split('-')[0] : ''
            };
        });

        res.json({ metas });
    } catch (error) {
        console.error('Chyba při načítání:', error);
        res.json({ metas: [] });
    }
});

app.listen(PORT, () => {
    console.log(`Addon běží na portu ${PORT}`);
});
