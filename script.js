const TMDB_API_KEY = 'c074412c0bb25ca8de73189f89714dce'; // Replace with your actual API key
let currentPageMovies = 1;  // Movie page for pagination
let totalPagesMovies = 1;   // Movie total pages
let currentPageTv = 1;      // TV page for pagination
let totalPagesTv = 1;       // TV total pages
let movieName = '';         // Current search term
let genre = '';             // Selected genre id (movie genre ids used in UI)
let selectedContentType = 'movie';
let pendingRequests = 0;      // Track in-flight requests for loader
let lastResultsCountMovies = -1; // Track last results count for empty state
let lastResultsCountTv = -1;
let searchMode = 'titles'; // 'titles' or 'people'
let lastOpenedPopup = { type: null, id: null };

function setLoading(isLoading) {
    const loadingEl = document.getElementById('loading');
    if (!loadingEl) return;
    loadingEl.style.display = isLoading ? 'flex' : 'none';
    loadingEl.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    // Skeletons in results area for better perceived performance
    const resultsDiv = document.getElementById('movie-results');
    if (!resultsDiv) return;
    if (isLoading) {
        // Only show skeletons for Titles mode to avoid stacking in People flows
        if (searchMode === 'titles') {
            resultsDiv.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                const s = document.createElement('div');
                s.className = 'skeleton-card';
                const shimmer = document.createElement('div');
                shimmer.className = 'skeleton-shimmer';
                s.appendChild(shimmer);
                resultsDiv.appendChild(s);
            }
        }
    } else {
        // leave rendering to respective display functions
    }
}

function setEmptyState() {
    const emptyEl = document.getElementById('empty-state');
    if (!emptyEl) return;
    if (selectedContentType === 'movie') {
        emptyEl.style.display = lastResultsCountMovies === 0 ? 'block' : 'none';
        return;
    }
    if (selectedContentType === 'tv') {
        emptyEl.style.display = lastResultsCountTv === 0 ? 'block' : 'none';
        return;
    }
    // both: show empty only when both are zero and both have been fetched
    const bothFetched = lastResultsCountMovies !== -1 && lastResultsCountTv !== -1;
    emptyEl.style.display = bothFetched && lastResultsCountMovies === 0 && lastResultsCountTv === 0 ? 'block' : 'none';
}

function hidePaginationControls() {
    const controls = document.querySelector('.pagination-controls');
    if (!controls) return;
    controls.classList.remove('show');
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('load-more-btn');
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
}

function maybeSearchPersonFallback() {
    // No implicit fallback; explicit People tab is used
    return;
}

function searchPersonAndDisplay() {
    // Legacy fallback no longer used; keeping for compatibility
    setLoading(true);
    const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&page=1&include_adult=false`;
    fetch(personSearchUrl)
        .then(r => r.json())
        .then(personData => {
            const people = Array.isArray(personData.results) ? personData.results : [];
            if (!people.length) {
                setLoading(false);
                setEmptyState();
                return;
            }
            const person = people[0];
            const creditsUrl = `https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${TMDB_API_KEY}&language=en-US`;
            return fetch(creditsUrl).then(r => r.json()).then(credits => {
                const cast = Array.isArray(credits.cast) ? credits.cast : [];
                // Split into movies and tv
                let movieCredits = cast.filter(c => c.media_type === 'movie');
                let tvCredits = cast.filter(c => c.media_type === 'tv');

                // Apply genre filtering if selected
                if (genre) {
                    const genreId = Number(genre);
                    const tvGenre = MOVIE_TO_TV_GENRE[genre] ? Number(MOVIE_TO_TV_GENRE[genre]) : null;
                    movieCredits = movieCredits.filter(m => Array.isArray(m.genre_ids) && m.genre_ids.includes(genreId));
                    if (tvGenre) {
                        tvCredits = tvCredits.filter(t => Array.isArray(t.genre_ids) && t.genre_ids.includes(tvGenre));
                    }
                }

                // Prepare UI
                const resultsDiv = document.getElementById('movie-results');
                resultsDiv.innerHTML = '';
                const header = document.createElement('div');
                header.style.margin = '10px 0';
                header.textContent = `Showing credits for ${person.name}`;
                resultsDiv.appendChild(header);

                if (selectedContentType === 'movie') {
                    lastResultsCountMovies = movieCredits.length;
                    displayMovies(movieCredits, undefined);
                    lastResultsCountTv = -1;
                } else if (selectedContentType === 'tv') {
                    lastResultsCountTv = tvCredits.length;
                    displayTvShows(tvCredits, undefined);
                    lastResultsCountMovies = -1;
                } else {
                    // both
                    const moviesSection = document.createElement('div');
                    const moviesHeader = document.createElement('h2');
                    moviesHeader.textContent = 'Movies';
                    moviesSection.appendChild(moviesHeader);
                    const moviesContainer = document.createElement('div');
                    moviesContainer.className = 'movie-results';
                    moviesSection.appendChild(moviesContainer);

                    const tvSection = document.createElement('div');
                    const tvHeader = document.createElement('h2');
                    tvHeader.textContent = 'Web Series';
                    tvSection.appendChild(tvHeader);
                    const tvContainer = document.createElement('div');
                    tvContainer.className = 'movie-results';
                    tvSection.appendChild(tvContainer);

                    resultsDiv.appendChild(moviesSection);
                    resultsDiv.appendChild(tvSection);

                    lastResultsCountMovies = movieCredits.length;
                    lastResultsCountTv = tvCredits.length;
                    displayMovies(movieCredits, moviesContainer);
                    displayTvShows(tvCredits, tvContainer);
                }

                hidePaginationControls();
                setLoading(false);
                setEmptyState();
            });
        })
        .catch(() => {
            setLoading(false);
            setEmptyState();
        });
}

// Debounce utility for search input
let debounceTimer = null;
function debouncedSearchMovies(delayMs = 400) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const q = document.getElementById('movie-name').value;
        if (searchMode === 'people') {
            showPeopleSuggestions(q);
        } else {
            const sugg = document.getElementById('suggestions');
            if (sugg) sugg.style.display = 'none';
            // Auto-run title search while typing
            searchMovies();
        }
    }, delayMs);
}

// Tabs: Titles | People
function setSearchMode(mode) {
    const newMode = mode === 'people' ? 'people' : 'titles';
    searchMode = newMode;
    const tabTitles = document.getElementById('tab-titles');
    const tabPeople = document.getElementById('tab-people');
    if (tabTitles && tabPeople) {
        const titlesActive = searchMode === 'titles';
        tabTitles.classList.toggle('active', titlesActive);
        tabPeople.classList.toggle('active', !titlesActive);
        tabTitles.setAttribute('aria-selected', titlesActive ? 'true' : 'false');
        tabPeople.setAttribute('aria-selected', !titlesActive ? 'true' : 'false');
    }
    const suggestions = document.getElementById('suggestions');
    if (suggestions) suggestions.style.display = 'none';
    // Trigger search/update for active mode
    searchMovies();
}

// People autocomplete suggestions (People tab only)
function showPeopleSuggestions(query) {
    const sugg = document.getElementById('suggestions');
    if (!sugg) return;
    if (!query || query.trim().length < 2) {
        sugg.style.display = 'none';
        sugg.innerHTML = '';
        return;
    }
    const url = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
    fetch(url)
        .then(r => r.json())
        .then(data => {
            const people = Array.isArray(data.results) ? data.results.slice(0, 8) : [];
            if (!people.length) {
                sugg.style.display = 'none';
                sugg.innerHTML = '';
                return;
            }
            sugg.innerHTML = '';
            people.forEach(p => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w185${p.profile_path || ''}" alt="${p.name}">
                    <div>
                        <div>${p.name}</div>
                        <div style="font-size:12px;color:#bbb;">${(p.known_for || []).map(k => k.title || k.name).slice(0,2).join(', ')}</div>
                    </div>
                `;
                item.addEventListener('mousedown', (e) => e.preventDefault());
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.href = `person.html?personId=${p.id}`;
                });
                sugg.appendChild(item);
            });
            sugg.style.display = 'block';
        })
        .catch(() => {
            sugg.style.display = 'none';
        });
}

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    const sugg = document.getElementById('suggestions');
    const wrap = document.querySelector('.search-input-wrap');
    if (!sugg || !wrap) return;
    if (!wrap.contains(e.target)) {
        sugg.style.display = 'none';
    }
});

// Enter key triggers search based on active tab
const searchInput = document.getElementById('movie-name');
if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchMode === 'people') {
                const q = searchInput.value;
                if (q && q.trim().length > 0) {
                    const sugg = document.getElementById('suggestions');
                    if (sugg) sugg.style.display = 'none';
                    searchMovies();
                }
            } else {
                searchMovies();
            }
        }
    });
}

// Perform people search and render grid
function searchAndRenderPeople() {
    const resultsDiv = document.getElementById('movie-results');
    resultsDiv.innerHTML = '';
    const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&page=1&include_adult=false`;
    fetch(personSearchUrl)
        .then(r => r.json())
        .then(personData => {
            const people = Array.isArray(personData.results) ? personData.results : [];
            if (!people.length) {
                setLoading(false);
                lastResultsCountMovies = 0;
                lastResultsCountTv = 0;
                setEmptyState();
                return;
            }
            resultsDiv.innerHTML = '';
            const peopleContainer = document.createElement('div');
            peopleContainer.className = 'movie-results';
            people.forEach(p => {
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w500${p.profile_path || ''}" alt="${p.name}">
                    <div class="movie-title">${p.name}</div>
                `;
                card.addEventListener('click', () => {
                    window.location.href = `person.html?personId=${p.id}`;
                });
                peopleContainer.appendChild(card);
            });
            resultsDiv.appendChild(peopleContainer);
            setLoading(false);
            hidePaginationControls();
        })
        .catch(() => {
            setLoading(false);
            setEmptyState();
        });
}

function renderPersonCreditsById(personId) {
    // In-app person view to avoid external navigation issues
    setSearchMode('people');
    const url = `https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=en-US`;
    fetch(url)
        .then(r => r.json())
        .then(p => renderPersonCredits(p))
        .catch(() => {
            const resultsDiv = document.getElementById('movie-results');
            if (resultsDiv) resultsDiv.textContent = 'Failed to load person details.';
        });
}

function renderPersonCredits(person) {
    const resultsDiv = document.getElementById('movie-results');
    resultsDiv.innerHTML = '';
    // Avoid global skeletons during People flow to prevent flicker/stacking
    const header = document.createElement('div');
    header.style.margin = '10px 0';
    header.textContent = `Showing credits for ${person.name}`;
    resultsDiv.appendChild(header);
    const creditsUrl = `https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${TMDB_API_KEY}&language=en-US`;
    fetch(creditsUrl)
        .then(r => r.json())
        .then(credits => {
            const cast = Array.isArray(credits.cast) ? credits.cast : [];
            let movieCredits = cast.filter(c => c.media_type === 'movie');
            let tvCredits = cast.filter(c => c.media_type === 'tv');
            if (genre) {
                const genreId = Number(genre);
                const tvGenre = MOVIE_TO_TV_GENRE[genre] ? Number(MOVIE_TO_TV_GENRE[genre]) : null;
                movieCredits = movieCredits.filter(m => Array.isArray(m.genre_ids) && m.genre_ids.includes(genreId));
                if (tvGenre) tvCredits = tvCredits.filter(t => Array.isArray(t.genre_ids) && t.genre_ids.includes(tvGenre));
            }

            const moviesSection = document.createElement('div');
            const moviesHeader = document.createElement('h2');
            moviesHeader.textContent = 'Movies';
            moviesSection.appendChild(moviesHeader);
            const moviesContainer = document.createElement('div');
            moviesContainer.className = 'movie-results';
            moviesSection.appendChild(moviesContainer);

            const tvSection = document.createElement('div');
            const tvHeader = document.createElement('h2');
            tvHeader.textContent = 'Web Series';
            tvSection.appendChild(tvHeader);
            const tvContainer = document.createElement('div');
            tvContainer.className = 'movie-results';
            tvSection.appendChild(tvContainer);

            resultsDiv.appendChild(moviesSection);
            resultsDiv.appendChild(tvSection);

            displayMovies(movieCredits, moviesContainer);
            displayTvShows(tvCredits, tvContainer);
            // No-op: results rendered
            hidePaginationControls();
        })
        .catch(() => {
            setEmptyState();
        });
}

// Best-effort mapping from Movie genre ids -> TV genre ids
// Only common/close equivalents are mapped.
const MOVIE_TO_TV_GENRE = {
    '28': '10759',     // Action -> Action & Adventure
    '35': '35',        // Comedy -> Comedy
    '18': '18',        // Drama -> Drama
    '80': '80',        // Crime -> Crime
    '99': '99',        // Documentary -> Documentary
    '878': '10765',    // Science Fiction -> Sci-Fi & Fantasy
    '10752': '10768',  // War -> War & Politics
    '27': '27',        // Horror (exists on TV in some APIs; if not, ignored client-side)
    '10402': '10402',  // Music (may or may not exist for TV)
    // Some movie-only or no-clear-TV equivalents are intentionally omitted
};

// Search Movies based on name and genre
function searchMovies() {
    movieName = document.getElementById('movie-name').value;
    genre = document.getElementById('genres').value;
    selectedContentType = document.getElementById('content-type').value;

    // Respect tab mode: people vs titles
    if (searchMode === 'people') {
        const resultsDiv = document.getElementById('movie-results');
        resultsDiv.innerHTML = '';
        hidePaginationControls();
        // Avoid skeletons in People flow
        searchAndRenderPeople();
        return;
    }

    // Reset pages
    currentPageMovies = 1;
    currentPageTv = 1;
    lastResultsCountMovies = -1;
    lastResultsCountTv = -1;
    pendingRequests = 0; // reset counter; fetch functions will manage increments

    const resultsDiv = document.getElementById('movie-results');
    resultsDiv.innerHTML = '';
    setLoading(true);
    setEmptyState();

    if (selectedContentType === 'movie') {
        fetchMoviesPage();
    } else if (selectedContentType === 'tv') {
        fetchTvPage();
        } else {
        // both: render movies and TV sections
        const moviesSection = document.createElement('div');
        const moviesHeader = document.createElement('h2');
        moviesHeader.textContent = 'Movies';
        moviesSection.appendChild(moviesHeader);
        const moviesContainer = document.createElement('div');
        moviesContainer.id = 'movies-container';
        moviesContainer.className = 'movie-results';
        moviesSection.appendChild(moviesContainer);

        const tvSection = document.createElement('div');
        const tvHeader = document.createElement('h2');
        tvHeader.textContent = 'Web Series';
        tvSection.appendChild(tvHeader);
        const tvContainer = document.createElement('div');
        tvContainer.id = 'tv-container';
        tvContainer.className = 'movie-results';
        tvSection.appendChild(tvContainer);

        resultsDiv.appendChild(moviesSection);
        resultsDiv.appendChild(tvSection);

        pendingRequests = 0; // Reset counter, let fetch functions manage increments
        Promise.all([fetchMoviesPage(true), fetchTvPage(true)])
            .then(() => {
                showPaginationButtons();
            })
            .catch(error => console.error('Error fetching both:', error));
    }
}


// Show Pagination Buttons when the result is displayed
function showPaginationButtons() {
    const controls = document.querySelector('.pagination-controls');
    if (!controls) return;
    controls.classList.add('show');
    // Use movies pagination by default; for 'both', show if either can paginate
    const canPrev = (selectedContentType === 'tv') ? currentPageTv > 1 : currentPageMovies > 1;
    const canNext = (selectedContentType === 'tv') ? (currentPageTv < totalPagesTv) : (currentPageMovies < totalPagesMovies);
    if (selectedContentType === 'both') {
        const prevEither = currentPageMovies > 1 || currentPageTv > 1;
        const nextEither = (currentPageMovies < totalPagesMovies) || (currentPageTv < totalPagesTv);
        document.getElementById('prev-btn').style.display = prevEither ? 'inline-block' : 'none';
        document.getElementById('load-more-btn').style.display = nextEither ? 'inline-block' : 'none';
        return;
    }
    document.getElementById('prev-btn').style.display = canPrev ? 'inline-block' : 'none';
    document.getElementById('load-more-btn').style.display = canNext ? 'inline-block' : 'none';
}

// Display Movies on the home page
function displayMovies(movies, container) {
    const movieResultsDiv = container || document.getElementById('movie-results');
    if (!container) movieResultsDiv.innerHTML = '';

    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.classList.add('movie-card');
        movieCard.style.position = 'relative';
        movieCard.innerHTML = `
            <span class="rating-badge">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path || ''}" alt="${movie.title}" loading="lazy">
            <div class="hover-overlay">${(movie.release_date || '').slice(0,4) || ''}</div>
            <div class="movie-title">${movie.title}</div>
        `;
        movieCard.addEventListener('click', () => showMovieDetails(movie.id));
        movieResultsDiv.appendChild(movieCard);
    });

    // Scroll to the top of the results section or page
    window.scrollTo(0, 0);  // Scroll to the top
    
    // Hide loading spinner after rendering
    setLoading(false);
}

// Load more movies on the results page
function loadMoreMovies() {
    if (selectedContentType === 'tv') {
        if (currentPageTv < totalPagesTv) {
            currentPageTv++;
            fetchTvPage();
        }
        return;
    }
    if (selectedContentType === 'both') {
        let didFetch = false;
        if (currentPageMovies < totalPagesMovies) {
            currentPageMovies++;
            fetchMoviesPage(false, document.getElementById('movies-container'));
            didFetch = true;
        }
        if (currentPageTv < totalPagesTv) {
            currentPageTv++;
            fetchTvPage(false, document.getElementById('tv-container'));
            didFetch = true;
        }
        if (didFetch) showPaginationButtons();
        return;
    }
    if (currentPageMovies < totalPagesMovies) {
        currentPageMovies++;
        fetchMoviesPage();
    }
}

// Load previous movies on the results page
function loadPreviousMovies() {
    if (selectedContentType === 'tv') {
        if (currentPageTv > 1) {
            currentPageTv--;
            fetchTvPage();
        }
        return;
    }
    if (selectedContentType === 'both') {
        let didFetch = false;
        if (currentPageMovies > 1) {
            currentPageMovies--;
            fetchMoviesPage(false, document.getElementById('movies-container'));
            didFetch = true;
        }
        if (currentPageTv > 1) {
            currentPageTv--;
            fetchTvPage(false, document.getElementById('tv-container'));
            didFetch = true;
        }
        if (didFetch) showPaginationButtons();
        return;
    }
    if (currentPageMovies > 1) {
        currentPageMovies--;
        fetchMoviesPage();
    }
}

// Fetch movies based on current page, movie name, and genre
function fetchMoviesPage(appendToBoth = false, containerForBoth = undefined) {
    let url;
    if (movieName) {
        url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&page=${currentPageMovies}`;
    } else {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&page=${currentPageMovies}`;
    if (genre) {
        url += `&with_genres=${genre}`;
        }
    }

    pendingRequests += 1;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            totalPagesMovies = data.total_pages || 1;
            let results = data.results || [];
            // Client-side filter by genre for search endpoint
            if (movieName && genre) {
                const genreId = Number(genre);
                results = results.filter(item => Array.isArray(item.genre_ids) && item.genre_ids.includes(genreId));
            }
            lastResultsCountMovies = results.length;
            displayMovies(results, containerForBoth);
            showPaginationButtons();
            pendingRequests -= 1;
            if (pendingRequests <= 0) {
                setLoading(false);
                setEmptyState();
                maybeSearchPersonFallback();
            }
        })
        .catch(error => {
            console.error('Error fetching movies:', error);
            lastResultsCountMovies = 0;
            pendingRequests -= 1;
            if (pendingRequests <= 0) {
                setLoading(false);
                setEmptyState();
                maybeSearchPersonFallback();
            }
        });
}

function fetchTvPage(appendToBoth = false, containerForBoth = undefined) {
    // Determine tv genre to use
    const tvGenre = genre ? (MOVIE_TO_TV_GENRE[genre] || '') : '';
    let url;
    if (movieName) {
        url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&page=${currentPageTv}`;
    } else {
        url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=en-US&page=${currentPageTv}`;
        if (tvGenre) {
            url += `&with_genres=${tvGenre}`;
        }
    }

    pendingRequests += 1;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            totalPagesTv = data.total_pages || 1;
            let results = data.results || [];
            // Client-side filter by mapped tv genre when searching
            if (movieName && tvGenre) {
                const tvGenreId = Number(tvGenre);
                results = results.filter(item => Array.isArray(item.genre_ids) && item.genre_ids.includes(tvGenreId));
            }
            lastResultsCountTv = results.length;
            displayTvShows(results, containerForBoth);
            showPaginationButtons();
            pendingRequests -= 1;
            if (pendingRequests <= 0) {
                setLoading(false);
                setEmptyState();
                maybeSearchPersonFallback();
            }
        })
        .catch(error => {
            console.error('Error fetching tv:', error);
            lastResultsCountTv = 0;
            pendingRequests -= 1;
            if (pendingRequests <= 0) {
                setLoading(false);
                setEmptyState();
                maybeSearchPersonFallback();
            }
        });
}

// Show movie details in the popup
function showMovieDetails(movieId) {
    lastOpenedPopup = { type: 'movie', id: movieId };
    const movieUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
    const videosUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;

    // Fetch movie details
    fetch(movieUrl)
        .then(response => response.json())
        .then(movie => {
            // Fetch credits and videos in parallel
            return Promise.all([
                fetch(creditsUrl).then(r => r.json()),
                fetch(videosUrl).then(r => r.json())
            ]).then(([credits, videos]) => {
                    const cast = credits.cast.slice(0, 5); // Get top 5 actors/actresses
                    const castNamesHtml = cast.map(member => `<a class=\"cast-link\" href=\"person.html?personId=${member.id}\" style=\"text-decoration:underline;\">${member.name}</a>`).join(', ');

                    const popup = document.getElementById('movie-popup');
                    const closeBtn = document.getElementById('close-popup');

                    if (!popup || !closeBtn) return; // Guard if popup not present
                    const titleEl = document.getElementById('movie-title');
                    const ratingEl = document.getElementById('movie-rating');
                    const synopsisEl = document.getElementById('movie-synopsis');
                    const posterEl = document.getElementById('movie-poster');
                    const castEl = document.getElementById('movie-cast');

                    if (titleEl) titleEl.textContent = movie.title;
                    if (ratingEl) ratingEl.textContent = `Rating: ${movie.vote_average}`;
                    if (synopsisEl) synopsisEl.textContent = movie.overview;
                    if (posterEl) posterEl.src = `https://image.tmdb.org/t/p/w500${movie.poster_path || ''}`;
                    if (castEl) castEl.innerHTML = `Cast: ${castNamesHtml}`;
                    // cast links are anchors now

                    // Trailers list (multiple)
                    const trailersSection = document.getElementById('trailers-section');
                    const trailersList = document.getElementById('trailers-list');
                    const trailerContainer = document.getElementById('trailer-container');
                    const trailerFrame = document.getElementById('trailer-frame');
                    // Reset dynamic sections when opening
                    if (trailersList) trailersList.innerHTML = '';
                    if (trailerContainer) trailerContainer.style.display = 'none';
                    const seasonsSection = document.getElementById('seasons-section');
                    const seasonsContainer = document.getElementById('seasons-container');
                    if (seasonsContainer) seasonsContainer.innerHTML = '';
                    if (seasonsSection) seasonsSection.style.display = 'none';
                    if (trailersSection && trailersList && trailerContainer && trailerFrame) {
                        trailersList.innerHTML = '';
                        trailerFrame.src = '';
                        trailerContainer.style.display = 'none';
                        const ytVideos = Array.isArray(videos.results) ? videos.results.filter(v => v.site === 'YouTube') : [];
                        if (ytVideos.length) {
                            trailersSection.style.display = 'block';
                            ytVideos.forEach((vid, idx) => {
                                const btn = document.createElement('button');
                                const thumb = `https://img.youtube.com/vi/${vid.key}/default.jpg`;
                                btn.innerHTML = `<img src="${thumb}" alt="" style="width:32px;height:24px;object-fit:cover;margin-right:6px;vertical-align:middle;"> ${vid.type || 'Video'} ${vid.name ? `- ${vid.name}` : ''}`;
                                btn.addEventListener('click', () => {
                                    // set active
                                    [...trailersList.children].forEach(c => c.classList.remove('active'));
                                    btn.classList.add('active');
                                    trailerFrame.src = `https://www.youtube.com/embed/${vid.key}?mute=1`;
                                    trailerContainer.style.display = 'block';
                                    // Scroll video into view
                                    trailerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                });
                                if (idx === 0) btn.classList.add('active');
                                trailersList.appendChild(btn);
                            });
                            // Autoplay first
                            trailerFrame.src = `https://www.youtube.com/embed/${ytVideos[0].key}?mute=1`;
                            trailerContainer.style.display = 'block';
                            // Add 'Open on YouTube' link
                            const openLink = document.createElement('a');
                            openLink.href = `https://www.youtube.com/watch?v=${ytVideos[0].key}`;
                            openLink.target = '_blank';
                            openLink.rel = 'noopener';
                            openLink.textContent = 'Open on YouTube';
                            openLink.style.marginLeft = '8px';
                            trailersSection.appendChild(openLink);
                        } else {
                            trailersSection.style.display = 'none';
                        }
                    }

                    // If movie has a collection, fetch parts
                    const collectionSection = document.getElementById('collection-section');
                    const collectionContainer = document.getElementById('collection-container');
                    if (collectionSection && collectionContainer) {
                        collectionContainer.innerHTML = '';
                        collectionSection.style.display = 'none';
                        if (movie.belongs_to_collection && movie.belongs_to_collection.id) {
                            const collId = movie.belongs_to_collection.id;
                            const collUrl = `https://api.themoviedb.org/3/collection/${collId}?api_key=${TMDB_API_KEY}&language=en-US`;
                            fetch(collUrl)
                                .then(r => r.json())
                                .then(coll => {
                                    if (Array.isArray(coll.parts) && coll.parts.length) {
                                        collectionSection.style.display = 'block';
                                        coll.parts.sort((a,b)=> (a.release_date||'') > (b.release_date||'') ? 1 : -1);
                                        coll.parts.forEach(part => {
                                            const card = document.createElement('div');
                                            card.className = 'collection-card';
                                            card.innerHTML = `
                                                <img src="https://image.tmdb.org/t/p/w500${part.poster_path || ''}" alt="${part.title}">
                                                <div class="title">${part.title} ${part.vote_average ? ` - ⭐ ${part.vote_average.toFixed(1)}` : ''}</div>
                                            `;
                                            card.addEventListener('click', () => showMovieDetails(part.id));
                                            collectionContainer.appendChild(card);
                                        });
                                    }
                                })
                                .catch(()=>{});
                        }
                    }

                    const backEl = document.getElementById('back-to-popup');
                    if (backEl && previousModes.length > 0) backEl.style.display = 'block';
                    popup.style.display = 'flex';
                    // Assign once to avoid duplicate handlers
                    if (!closeBtn.dataset.bound) {
                    closeBtn.addEventListener('click', () => {
                        popup.style.display = 'none';
                    });
                        closeBtn.dataset.bound = 'true';
                    }
                });
        })
        .catch(error => console.error('Error fetching movie details:', error));
}




const popup = document.getElementById('movie-popup');
const closePopupButton = document.getElementById('close-popup');

// Close the popup when clicking outside of it
if (popup) {
window.addEventListener('click', function(event) {
    if (event.target === popup) {
        closePopup();
    }
});
}

// Close the popup when clicking the close button
if (closePopupButton) {
    if (!closePopupButton.dataset.bound) {
closePopupButton.addEventListener('click', closePopup);
        closePopupButton.dataset.bound = 'true';
    }
}

function closePopup() {
    if (popup) popup.style.display = 'none'; // Hide the popup
    // Stop trailer playback and reset UI sections
    const trailerFrame = document.getElementById('trailer-frame');
    if (trailerFrame) trailerFrame.src = '';
    // Clear dynamic sections so old content doesn't persist
    const trailersSection = document.getElementById('trailers-section');
    const trailersList = document.getElementById('trailers-list');
    const trailerContainer = document.getElementById('trailer-container');
    const seasonsSection = document.getElementById('seasons-section');
    const seasonsContainer = document.getElementById('seasons-container');
    const collectionSection = document.getElementById('collection-section');
    const collectionContainer = document.getElementById('collection-container');
    if (trailersList) trailersList.innerHTML = '';
    if (trailerContainer) trailerContainer.style.display = 'none';
    if (trailersSection) trailersSection.style.display = 'none';
    if (seasonsContainer) seasonsContainer.innerHTML = '';
    if (seasonsSection) seasonsSection.style.display = 'none';
    if (collectionContainer) collectionContainer.innerHTML = '';
    if (collectionSection) collectionSection.style.display = 'none';
}

function backToPreviousTab() {}

function displayTvShows(tvShows, container) {
    const resultsDiv = container || document.getElementById('movie-results');
    if (!container) resultsDiv.innerHTML = '';

    tvShows.forEach(tvShow => {
        const tvCard = document.createElement('div');
        tvCard.classList.add('movie-card');
        tvCard.style.position = 'relative';
        tvCard.innerHTML = `
            <span class="rating-badge">⭐ ${tvShow.vote_average ? tvShow.vote_average.toFixed(1) : 'N/A'}</span>
            <img src="https://image.tmdb.org/t/p/w500${tvShow.poster_path || ''}" alt="${tvShow.name}" loading="lazy">
            <div class="hover-overlay">${(tvShow.first_air_date || '').slice(0,4) || ''}</div>
            <div class="movie-title">${tvShow.name}</div>
        `;
        tvCard.addEventListener('click', () => showTvShowDetails(tvShow.id));
        resultsDiv.appendChild(tvCard);
    });

    // Scroll to the top of the results section or page
    window.scrollTo(0, 0);  // Scroll to the top
    
    // Hide loading spinner after rendering
    setLoading(false);
}


function showTvShowDetails(tvShowId) {
    lastOpenedPopup = { type: 'tv', id: tvShowId };
    const tvShowUrl = `https://api.themoviedb.org/3/tv/${tvShowId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const creditsUrl = `https://api.themoviedb.org/3/tv/${tvShowId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
    const videosUrl = `https://api.themoviedb.org/3/tv/${tvShowId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;

    // Fetch TV show details
    fetch(tvShowUrl)
        .then(response => response.json())
        .then(tvShow => {
            // Fetch credits, series videos, and all season videos in parallel
            const seasons = Array.isArray(tvShow.seasons) ? tvShow.seasons.filter(s => s.season_number >= 0) : [];
            const seasonVideoPromises = seasons.map(s => (
                fetch(`https://api.themoviedb.org/3/tv/${tvShowId}/season/${s.season_number}/videos?api_key=${TMDB_API_KEY}&language=en-US`).then(r => r.json()).catch(()=>({ results: [] }))
            ));
            return Promise.all([
                fetch(creditsUrl).then(r => r.json()),
                fetch(videosUrl).then(r => r.json()),
                Promise.all(seasonVideoPromises)
            ]).then(([credits, seriesVideos, seasonVideosArray]) => {
                    const cast = credits.cast.slice(0, 5); // Get top 5 actors/actresses
                    const castNamesHtml = cast.map(member => `<a class=\"cast-link\" href=\"person.html?personId=${member.id}\" style=\"text-decoration:underline;\">${member.name}</a>`).join(', ');

                    const popup = document.getElementById('movie-popup');
                    const closeBtn = document.getElementById('close-popup');

                    if (!popup || !closeBtn) return; // Guard
                    const titleEl = document.getElementById('movie-title');
                    const ratingEl = document.getElementById('movie-rating');
                    const synopsisEl = document.getElementById('movie-synopsis');
                    const posterEl = document.getElementById('movie-poster');
                    const castEl = document.getElementById('movie-cast');

                    if (titleEl) titleEl.textContent = tvShow.name;
                    if (ratingEl) ratingEl.textContent = `Rating: ${tvShow.vote_average}`;
                    if (synopsisEl) synopsisEl.textContent = tvShow.overview;
                    if (posterEl) posterEl.src = `https://image.tmdb.org/t/p/w500${tvShow.poster_path || ''}`;
                    if (castEl) castEl.innerHTML = `Cast: ${castNamesHtml}`;
                    // cast links are anchors now

                    // Trailers/Teasers list (aggregate series + all seasons)
                    const trailersSection = document.getElementById('trailers-section');
                    const trailersList = document.getElementById('trailers-list');
                    const trailerContainer = document.getElementById('trailer-container');
                    const trailerFrame = document.getElementById('trailer-frame');
                    if (trailersSection && trailersList && trailerContainer && trailerFrame) {
                        trailersList.innerHTML = '';
                        trailerFrame.src = '';
                        trailerContainer.style.display = 'none';
                        const allVideosRaw = [
                            ...(Array.isArray(seriesVideos.results) ? seriesVideos.results : []),
                            ...seasonVideosArray.flatMap(v => Array.isArray(v.results) ? v.results : [])
                        ];
                        // Only YouTube, and prefer Trailer/Teaser types
                        const ytVideos = allVideosRaw
                            .filter(v => v.site === 'YouTube')
                            .map(v => ({ key: v.key, type: v.type || 'Video', name: v.name || '', published_at: v.published_at || '' }));
                        // Dedupe by key
                        const seen = new Set();
                        const deduped = ytVideos.filter(v => (seen.has(v.key) ? false : (seen.add(v.key), true)));
                        // Sort: Trailer before Teaser before others, then by publish date
                        const order = { 'Trailer': 0, 'Teaser': 1 };
                        deduped.sort((a, b) => (order[a.type] ?? 2) - (order[b.type] ?? 2) || (a.published_at > b.published_at ? -1 : 1));

                        if (deduped.length) {
                            trailersSection.style.display = 'block';
                            deduped.forEach((vid, idx) => {
                                const btn = document.createElement('button');
                                const thumb = `https://img.youtube.com/vi/${vid.key}/default.jpg`;
                                btn.innerHTML = `<img src="${thumb}" alt="" style=\"width:32px;height:24px;object-fit:cover;margin-right:6px;vertical-align:middle;\"> ${vid.type} ${vid.name ? `- ${vid.name}` : ''}`;
                                btn.addEventListener('click', () => {
                                    [...trailersList.children].forEach(c => c.classList.remove('active'));
                                    btn.classList.add('active');
                                    trailerFrame.src = `https://www.youtube.com/embed/${vid.key}?mute=1`;
                                    trailerContainer.style.display = 'block';
                                    trailerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                });
                                if (idx === 0) btn.classList.add('active');
                                trailersList.appendChild(btn);
                            });
                            trailerFrame.src = `https://www.youtube.com/embed/${deduped[0].key}?mute=1`;
                            trailerContainer.style.display = 'block';
                        } else {
                            trailersSection.style.display = 'none';
                        }
                    }

                    // Seasons and episodes
                    const seasonsSection = document.getElementById('seasons-section');
                    const seasonsContainer = document.getElementById('seasons-container');
                    if (seasonsSection && seasonsContainer) {
                        seasonsContainer.innerHTML = '';
                        seasonsSection.style.display = Array.isArray(tvShow.seasons) && tvShow.seasons.length ? 'block' : 'none';
                        const seasons = (tvShow.seasons || []).filter(s => s.season_number >= 0);
                        seasons.forEach(season => {
                            const seasonCard = document.createElement('div');
                            seasonCard.className = 'season-card';
                            seasonCard.innerHTML = `
                                <div class="season-header">
                                    <div><strong>${season.name || ('Season ' + season.season_number)}</strong> ${season.vote_average ? ` - ⭐ ${season.vote_average.toFixed(1)}` : ''}</div>
                                    <button class="toggle-episodes">Show Episodes</button>
                                </div>
                                <div class="episodes-list" style="display:none;"></div>
                            `;
                            const toggleBtn = seasonCard.querySelector('.toggle-episodes');
                            const episodesList = seasonCard.querySelector('.episodes-list');
                            toggleBtn.addEventListener('click', () => {
                                const isHidden = episodesList.style.display === 'none';
                                episodesList.style.display = isHidden ? 'block' : 'none';
                                toggleBtn.textContent = isHidden ? 'Hide Episodes' : 'Show Episodes';
                                if (isHidden && !episodesList.dataset.loaded) {
                                    const seasonUrl = `https://api.themoviedb.org/3/tv/${tvShowId}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=en-US`;
                                    fetch(seasonUrl).then(r=>r.json()).then((seasonDetails)=>{
                                        // Episodes
                                        (seasonDetails.episodes || []).forEach(ep => {
                                            const epItem = document.createElement('div');
                                            epItem.className = 'episode-item';
                                            epItem.innerHTML = `
                                                <div>${ep.episode_number}. ${ep.name || 'Episode'} ${ep.vote_average ? ` - ⭐ ${ep.vote_average.toFixed(1)}` : ''}</div>
                                                <div>${ep.air_date ? ep.air_date : ''}</div>
                                            `;
                                            episodesList.appendChild(epItem);
                                        });
                                        episodesList.dataset.loaded = 'true';
                                    }).catch(()=>{
                                        episodesList.dataset.loaded = 'true';
                                    });
                                }
                            });
                            seasonsContainer.appendChild(seasonCard);
                        });
                    }

                    popup.style.display = 'flex';
                    if (!closeBtn.dataset.bound) {
                    closeBtn.addEventListener('click', () => {
                        popup.style.display = 'none';
                    });
                        closeBtn.dataset.bound = 'true';
                    }
                });
        })
        .catch(error => console.error('Error fetching TV show details:', error));
}

// Initialize person page (for person.html)
function initPersonPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('personId');
    
    if (!personId) {
        document.getElementById('movie-results').innerHTML = '<p style="color: #ccc; text-align: center;">No person ID provided.</p>';
        return;
    }
    
    setLoading(true);
    
    // Fetch person details and credits
    Promise.all([
        fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=en-US`),
        fetch(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=en-US`)
    ])
    .then(responses => Promise.all(responses.map(r => r.json())))
    .then(([person, credits]) => {
        // Update page title and person info
        document.title = `${person.name} - Movie & Web Series Search`;
        document.getElementById('person-name').textContent = person.name;
        
        const personInfo = document.getElementById('person-info');
        const personPhoto = document.getElementById('person-photo');
        const personTitle = document.getElementById('person-title');
        const personBio = document.getElementById('person-bio');
        const personStats = document.getElementById('person-stats');
        
        if (personPhoto) personPhoto.src = `https://image.tmdb.org/t/p/w500${person.profile_path || ''}`;
        if (personTitle) personTitle.textContent = person.name;
        if (personBio) personBio.textContent = person.biography || 'No biography available.';
        if (personStats) {
            personStats.innerHTML = `
                <div>Known for: ${person.known_for_department || 'Acting'}</div>
                <div>Birthday: ${person.birthday || 'Unknown'}</div>
                <div>Place of birth: ${person.place_of_birth || 'Unknown'}</div>
            `;
        }
        
        personInfo.style.display = 'block';
        
        // Render credits
        const cast = Array.isArray(credits.cast) ? credits.cast : [];
        let movieCredits = cast.filter(c => c.media_type === 'movie');
        let tvCredits = cast.filter(c => c.media_type === 'tv');
        
        const resultsDiv = document.getElementById('movie-results');
        resultsDiv.innerHTML = '';
        
        const moviesSection = document.createElement('div');
        const moviesHeader = document.createElement('h2');
        moviesHeader.textContent = 'Movies';
        moviesSection.appendChild(moviesHeader);
        const moviesContainer = document.createElement('div');
        moviesContainer.className = 'movie-results';
        moviesSection.appendChild(moviesContainer);

        const tvSection = document.createElement('div');
        const tvHeader = document.createElement('h2');
        tvHeader.textContent = 'Web Series';
        tvSection.appendChild(tvHeader);
        const tvContainer = document.createElement('div');
        tvContainer.className = 'movie-results';
        tvSection.appendChild(tvContainer);

        resultsDiv.appendChild(moviesSection);
        resultsDiv.appendChild(tvSection);

        displayMovies(movieCredits, moviesContainer);
        displayTvShows(tvCredits, tvContainer);
        
        setLoading(false);
        hidePaginationControls();
    })
    .catch(error => {
        console.error('Error loading person details:', error);
        document.getElementById('movie-results').innerHTML = '<p style="color: #ccc; text-align: center;">Failed to load person details.</p>';
        setLoading(false);
    });
}


