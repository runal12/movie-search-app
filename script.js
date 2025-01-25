const TMDB_API_KEY = 'c074412c0bb25ca8de73189f89714dce'; // Replace with your actual API key
let currentPage = 1;  // To keep track of the current page for pagination
let totalPages = 1;  // To keep track of total pages
let movieName = '';  // To store search term
let genre = '';  // To store selected genre

// Search Movies based on name and genre
function searchMovies() {
    movieName = document.getElementById('movie-name').value;
    genre = document.getElementById('genres').value;
    const contentType = document.getElementById('content-type').value; // Get the selected content type

    currentPage = 1;  // Reset to the first page for new search

    let url = '';
    
    if (contentType === 'movie' || contentType === 'both') {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&page=${currentPage}`;
        if (movieName) {
            url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${movieName}&page=${currentPage}`;
        }
    }

    if (contentType === 'tv' || contentType === 'both') {
        if (movieName) {
            url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${movieName}&page=${currentPage}`;
        } else {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=en-US&page=${currentPage}`;
        }
    }

    if (genre) {
        url += `&with_genres=${genre}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            totalPages = data.total_pages;  // Update total pages
            if (contentType === 'tv' || contentType === 'both') {
                displayTvShows(data.results);  // Show TV shows
            } else {
                displayMovies(data.results);  // Show movies
            }
            showPaginationButtons();  // Show pagination buttons when results are shown
        })
        .catch(error => console.error('Error fetching data:', error));
}


// Show Pagination Buttons when the result is displayed
function showPaginationButtons() {
    // Show the pagination controls (previous and load more buttons)
    document.querySelector('.pagination-controls').classList.add('show');
    
    // Handle visibility of pagination buttons
    document.getElementById('prev-btn').style.display = currentPage > 1 ? 'inline-block' : 'none';
    document.getElementById('load-more-btn').style.display = currentPage < totalPages ? 'inline-block' : 'none';
}

// Display Movies on the home page
function displayMovies(movies) {
    const movieResultsDiv = document.getElementById('movie-results');
    movieResultsDiv.innerHTML = ''; // Clear previous results

    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.classList.add('movie-card');
        movieCard.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
            <div class="movie-title">${movie.title}</div>
        `;
        movieCard.addEventListener('click', () => showMovieDetails(movie.id));
        movieResultsDiv.appendChild(movieCard);
    });

    // Scroll to the top of the results section or page
    window.scrollTo(0, 0);  // Scroll to the top
}

// Load more movies on the results page
function loadMoreMovies() {
    if (currentPage < totalPages) {
        currentPage++;  // Increment the page number for the next request
        fetchMovies();
    }
}

// Load previous movies on the results page
function loadPreviousMovies() {
    if (currentPage > 1) {
        currentPage--;  // Decrease the page number for the previous request
        fetchMovies();
    }
}

// Fetch movies based on current page, movie name, and genre
function fetchMovies() {
    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&page=${currentPage}`;

    if (movieName) {
        url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${movieName}&page=${currentPage}`;
    }

    if (genre) {
        url += `&with_genres=${genre}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results);
            showPaginationButtons();  // Ensure pagination buttons are shown
        })
        .catch(error => console.error('Error fetching data:', error));
}

// Show movie details in the popup
function showMovieDetails(movieId) {
    const movieUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;

    // Fetch movie details
    fetch(movieUrl)
        .then(response => response.json())
        .then(movie => {
            // Fetch credits (cast details)
            fetch(creditsUrl)
                .then(response => response.json())
                .then(credits => {
                    const cast = credits.cast.slice(0, 5); // Get top 5 actors/actresses
                    const castNames = cast.map(member => member.name).join(', ');

                    const popup = document.getElementById('movie-popup');
                    const closeBtn = document.getElementById('close-popup');

                    document.getElementById('movie-title').textContent = movie.title;
                    document.getElementById('movie-rating').textContent = `Rating: ${movie.vote_average}`;
                    document.getElementById('movie-synopsis').textContent = movie.overview;
                    document.getElementById('movie-poster').src = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                    document.getElementById('movie-cast').textContent = `Cast: ${castNames}`;

                    popup.style.display = 'flex';

                    closeBtn.addEventListener('click', () => {
                        popup.style.display = 'none';
                    });
                })
                .catch(error => console.error('Error fetching credits:', error));
        })
        .catch(error => console.error('Error fetching movie details:', error));
}




const popup = document.getElementById('movie-popup');
const closePopupButton = document.getElementById('close-popup');

// Close the popup when clicking outside of it
window.addEventListener('click', function(event) {
    if (event.target === popup) {
        closePopup();
    }
});

// Close the popup when clicking the close button
closePopupButton.addEventListener('click', closePopup);

function closePopup() {
    popup.style.display = 'none'; // Hide the popup
}

function displayTvShows(tvShows) {
    const resultsDiv = document.getElementById('movie-results');
    resultsDiv.innerHTML = '';  // Clear previous results

    tvShows.forEach(tvShow => {
        const tvCard = document.createElement('div');
        tvCard.classList.add('movie-card');
        tvCard.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${tvShow.poster_path}" alt="${tvShow.name}">
            <div class="movie-title">${tvShow.name}</div>
        `;
        tvCard.addEventListener('click', () => showTvShowDetails(tvShow.id));
        resultsDiv.appendChild(tvCard);
    });

    // Scroll to the top of the results section or page
    window.scrollTo(0, 0);  // Scroll to the top
}


function showTvShowDetails(tvShowId) {
    const tvShowUrl = `https://api.themoviedb.org/3/tv/${tvShowId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const creditsUrl = `https://api.themoviedb.org/3/tv/${tvShowId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;

    // Fetch TV show details
    fetch(tvShowUrl)
        .then(response => response.json())
        .then(tvShow => {
            // Fetch credits (cast details)
            fetch(creditsUrl)
                .then(response => response.json())
                .then(credits => {
                    const cast = credits.cast.slice(0, 5); // Get top 5 actors/actresses
                    const castNames = cast.map(member => member.name).join(', ');

                    const popup = document.getElementById('movie-popup');
                    const closeBtn = document.getElementById('close-popup');

                    document.getElementById('movie-title').textContent = tvShow.name;
                    document.getElementById('movie-rating').textContent = `Rating: ${tvShow.vote_average}`;
                    document.getElementById('movie-synopsis').textContent = tvShow.overview;
                    document.getElementById('movie-poster').src = `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`;
                    document.getElementById('movie-cast').textContent = `Cast: ${castNames}`;

                    popup.style.display = 'flex';

                    closeBtn.addEventListener('click', () => {
                        popup.style.display = 'none';
                    });
                })
                .catch(error => console.error('Error fetching credits:', error));
        })
        .catch(error => console.error('Error fetching TV show details:', error));
}
