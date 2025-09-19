// API Configuration
const API_URL = 'https://api.themoviedb.org/3';
const IMG_PATH = 'https://image.tmdb.org/t/p/';
const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?ixlib=rb-4.0.3&auto=format&fit=crop&w500&q=80';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const movieCache = new Map();
const imageCache = new Map();

// Use your provided Bearer token
const FETCH_OPTIONS = {
	method: 'GET',
	headers: {
		accept: 'application/json',
		Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0NzNjOWNmNTg3YWE1OTFkMDI1MDJkYWE2MzUxYjllZSIsInN1YiI6IjY1ZDg2ZDdkY2VkYWM0MDE4NTUzZmRlNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.nGsRurclQjC4-euULj95Oj27UGSGzlHxnfN_qfFMUQE'
	}
};

// DOM Elements
const newMoviesTrack = document.getElementById('new-movies-track');
const newPrevBtn = document.getElementById('new-prev');
const newNextBtn = document.getElementById('new-next');
const popularSection = document.getElementById('popular-movies');
const seriesSection = document.getElementById('series-list');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const movieModal = document.getElementById('movie-modal');
const closeModal = document.getElementById('close-modal');
const movieDetail = document.getElementById('movie-detail');
const notification = document.getElementById('notification');

// Cache management functions
function getCachedData(key) {
	const cached = movieCache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.data;
	}
	return null;
}

function setCachedData(key, data) {
	movieCache.set(key, {
		data: data,
		timestamp: Date.now()
	});
}

// Optimized image loading with lazy loading and caching
function loadImageOptimized(src, alt, className = '') {
	return new Promise((resolve, reject) => {
		if (imageCache.has(src)) {
			resolve(imageCache.get(src));
			return;
		}

		const img = new Image();
		img.onload = () => {
			imageCache.set(src, img.src);
			resolve(img.src);
		};
		img.onerror = () => {
			resolve(PLACEHOLDER_IMG);
		};
		
		img.src = src;
	});
}

// Skeleton loader for better UX
function createSkeletonLoader(count = 6) {
	return Array(count).fill().map(() => `
		<div class="movie-card skeleton">
			<div class="skeleton-poster"></div>
			<div class="movie-info">
				<div class="skeleton-title"></div>
				<div class="skeleton-meta"></div>
				<div class="skeleton-description"></div>
			</div>
		</div>
	`).join('');
}

// Show notification
function showNotification(message) {
	notification.textContent = message;
	notification.classList.add('show');
	setTimeout(() => {
		notification.classList.remove('show');
	}, 3000);
}

// Fetch movies helper for list endpoints
async function fetchMovies(url, element) {
	// Check cache first
	const cacheKey = url;
	const cachedData = getCachedData(cacheKey);
	if (cachedData) {
		displayMovies(cachedData.results, element);
		return;
	}
	// Show skeleton loader while loading
	element.innerHTML = createSkeletonLoader();
	try {
		const response = await fetch(url, FETCH_OPTIONS);
		if (!response.ok) throw new Error(`API ${response.status}`);
		const data = await response.json();
		// Cache the response
		setCachedData(cacheKey, data);
		if (data.results && data.results.length > 0) {
			displayMovies(data.results, element);
		} else {
			element.innerHTML = '<p class="no-results">No movies found</p>';
		}
	} catch (error) {
		console.error('Error fetching movies:', error);
		const msg = String(error && error.message || '');
		const friendly = msg.includes('401') ? 'Invalid or missing TMDB token.' : 'Failed to load movies.';
		element.innerHTML = `<p class="no-results">${friendly}</p>`;
		showNotification(friendly);
	}
}

// Build a moving (auto-scroll) carousel for new movies
function renderCarousel(movies, trackEl) {
	trackEl.innerHTML = movies.map(m => `
		<div class="carousel-card" data-id="${m.id}">
			<img loading="lazy" src="${m.backdrop_path ? IMG_PATH + 'w780' + m.backdrop_path : PLACEHOLDER_IMG}" alt="${m.title || ''}">
			<div class="carousel-info">
				<h4>${m.title || ''}</h4>
				<div class="carousel-meta"><span>${m.release_date ? m.release_date.split('-')[0] : 'N/A'}</span><span class="rating"><i class="fas fa-star"></i> ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}</span></div>
			</div>
		</div>
	`).join('');
	// Click to open details
	trackEl.querySelectorAll('.carousel-card').forEach(card => {
		card.addEventListener('click', () => showMovieDetails(card.getAttribute('data-id')));
	});
}

async function loadNewMoviesCarousel() {
	try {
		const url = `${API_URL}/movie/now_playing?language=en-US&page=1`;
		const res = await fetch(url, FETCH_OPTIONS);
		const data = await res.json();
		if (Array.isArray(data.results)) {
			renderCarousel(data.results.slice(0, 12), newMoviesTrack);
			setupCarouselControls('new-movies-carousel', 'new-movies-track', 'new-prev', 'new-next');
		}
	} catch (e) { console.error(e); }
}

function setupCarouselControls(wrapperId, trackId, prevId, nextId) {
	const wrapper = document.getElementById(wrapperId);
	const track = document.getElementById(trackId);
	const prev = document.getElementById(prevId);
	const next = document.getElementById(nextId);
	let scrollAmount = 0;
	const cardWidth = 320; // approximate
	prev.addEventListener('click', () => {
		wrapper.scrollBy({ left: -cardWidth, behavior: 'smooth' });
	});
	next.addEventListener('click', () => {
		wrapper.scrollBy({ left: cardWidth, behavior: 'smooth' });
	});
	// auto move
	setInterval(() => {
		wrapper.scrollBy({ left: cardWidth, behavior: 'smooth' });
	}, 4000);
}

async function loadPopular() {
	const url = `${API_URL}/movie/popular?language=en-US&page=1`;
	await fetchMovies(url, popularSection);
}

async function loadSeries() {
	const url = `${API_URL}/tv/popular?language=en-US&page=1`;
	try {
		const res = await fetch(url, FETCH_OPTIONS);
		const data = await res.json();
		if (Array.isArray(data.results)) {
			// Reuse displayMovies but adapt minimal fields
			const mapped = data.results.map(tv => ({
				id: tv.id,
				title: tv.name,
				release_date: tv.first_air_date,
				vote_average: tv.vote_average,
				overview: tv.overview,
				poster_path: tv.poster_path
			}));
			seriesSection.innerHTML = '';
			displayMovies(mapped, seriesSection);
		}
	} catch (e) {
		seriesSection.innerHTML = '<p class="no-results">Failed to load series.</p>';
	}
}

// Remove data saver: ensure images load normally and SW optional
// If you previously used a checkbox to toggle, it's removed in markup; here we just keep normal behavior.

document.addEventListener('DOMContentLoaded', () => {
	loadNewMoviesCarousel();
	loadPopular();
});
// Add to your existing script.js

// DOM Elements for series
const seriesTrack = document.getElementById('series-track');
const seriesPrevBtn = document.getElementById('series-prev');
const seriesNextBtn = document.getElementById('series-next');

// Load series carousel
async function loadSeriesCarousel() {
    try {
        const url = `${API_URL}/tv/popular?language=en-US&page=1`;
        const res = await fetch(url, FETCH_OPTIONS);
        const data = await res.json();
        if (Array.isArray(data.results)) {
            renderSeriesCarousel(data.results.slice(0, 12), seriesTrack);
            setupCarouselControls('series-carousel', 'series-track', 'series-prev', 'series-next');
        }
    } catch (e) { 
        console.error('Error loading series:', e);
        seriesTrack.innerHTML = '<p class="no-results">Failed to load series.</p>';
    }
}

// Render series carousel
function renderSeriesCarousel(series, trackEl) {
    trackEl.innerHTML = series.map(s => `
        <div class="carousel-card" data-id="${s.id}" data-type="tv">
            <img loading="lazy" src="${s.backdrop_path ? IMG_PATH + 'w780' + s.backdrop_path : PLACEHOLDER_IMG}" alt="${s.name || ''}">
            <div class="carousel-info">
                <h4>${s.name || ''}</h4>
                <div class="carousel-meta">
                    <span>${s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A'}</span>
                    <span class="rating"><i class="fas fa-star"></i> ${s.vote_average ? s.vote_average.toFixed(1) : 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Click to open details
    trackEl.querySelectorAll('.carousel-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');
            showMovieDetails(card.getAttribute('data-id'), type);
        });
    });
}

// Update setupCarouselControls function
function setupCarouselControls(wrapperId, trackId, prevId, nextId) {
    const wrapper = document.getElementById(wrapperId);
    const track = document.getElementById(trackId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    
    if (!wrapper || !track || !prev || !next) return;
    
    const cardWidth = 280; // approximate width + gap
    const scrollAmount = cardWidth * 2; // Scroll 2 cards at a time
    
    prev.addEventListener('click', () => {
        wrapper.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    
    next.addEventListener('click', () => {
        wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
    
    // Hide buttons when at the edges
    const checkScrollPosition = () => {
        const { scrollLeft, scrollWidth, clientWidth } = wrapper;
        prev.style.display = scrollLeft <= 10 ? 'none' : 'flex';
        next.style.display = scrollLeft >= scrollWidth - clientWidth - 10 ? 'none' : 'flex';
    };
    
    wrapper.addEventListener('scroll', checkScrollPosition);
    checkScrollPosition(); // Initial check
    
    // Auto-scroll (optional)
    let autoScrollInterval = setInterval(() => {
        if (wrapper.scrollLeft >= wrapper.scrollWidth - wrapper.clientWidth) {
            wrapper.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }, 5000);
    
    // Pause auto-scroll on hover
    wrapper.addEventListener('mouseenter', () => clearInterval(autoScrollInterval));
    wrapper.addEventListener('mouseleave', () => {
        autoScrollInterval = setInterval(() => {
            if (wrapper.scrollLeft >= wrapper.scrollWidth - wrapper.clientWidth) {
                wrapper.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }, 5000);
    });
}

// Update initialization
document.addEventListener('DOMContentLoaded', () => {
    loadNewMoviesCarousel();
    loadPopular();
    loadSeriesCarousel(); // Add this line
});

// Update showMovieDetails to handle TV shows
async function showMovieDetails(itemId, type = 'movie') {
    try {
        const response = await fetch(`${API_URL}/${type}/${itemId}?language=en-US`, FETCH_OPTIONS);
        if (!response.ok) throw new Error('Details failed');
        const item = await response.json();

        const videosRes = await fetch(`${API_URL}/${type}/${itemId}/videos?language=en-US`, FETCH_OPTIONS);
        const videosData = await videosRes.json();
        const trailer = (videosData.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');

        // Update the rest of your function to handle both movies and TV shows
        // You'll need to adjust the display based on the type parameter
        
        // ... rest of your existing function code
        
    } catch (error) {
        console.error('Error fetching details:', error);
        showNotification('Failed to load details. Please try again later.');
    }
}
// Render movie cards with optimized image loading
function displayMovies(movies, element) {
	const size = 'w500';
	
	element.innerHTML = movies.map(movie => `
		<div class="movie-card" data-id="${movie.id}">
			<div class="movie-poster-container">
				<img loading="lazy" 
					 data-src="${movie.poster_path ? IMG_PATH + size + movie.poster_path : PLACEHOLDER_IMG}" 
					 src="${PLACEHOLDER_IMG}"
					 alt="${movie.title}" 
					 class="movie-poster">
				<div class="movie-overlay">
					<button class="play-btn"><i class="fas fa-play"></i></button>
				</div>
			</div>
			<div class="movie-info">
				<h3 class="movie-title">${movie.title}</h3>
				<div class="movie-details">
					<span>${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
					<span class="movie-rating"><i class="fas fa-star"></i> ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
				</div>
				<p class="movie-description">${movie.overview ? (movie.overview.length > 120 ? movie.overview.substring(0, 120) + '...' : movie.overview) : 'No description available.'}</p>
			</div>
		</div>
	`).join('');

	// Add click event listeners
	const movieCards = element.querySelectorAll('.movie-card');
	movieCards.forEach(card => {
		card.addEventListener('click', () => {
			const movieId = card.getAttribute('data-id');
			showMovieDetails(movieId);
		});
	});

	// Lazy load images
	lazyLoadImages();
}

// Lazy loading implementation
function lazyLoadImages() {
	const images = document.querySelectorAll('img[data-src]');
	const imageObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				const img = entry.target;
				const src = img.dataset.src;
				
				loadImageOptimized(src).then(loadedSrc => {
					img.src = loadedSrc;
					img.classList.add('loaded');
				});
				
				observer.unobserve(img);
			}
		});
	});

	images.forEach(img => imageObserver.observe(img));
}

// Movie details modal with trailer, cast, similar, comments
async function showMovieDetails(movieId) {
	try {
		const response = await fetch(`${API_URL}/movie/${movieId}?language=en-US`, FETCH_OPTIONS);
		if (!response.ok) throw new Error('Movie details failed');
		const movie = await response.json();

		const videosRes = await fetch(`${API_URL}/movie/${movieId}/videos?language=en-US`, FETCH_OPTIONS);
		const videosData = await videosRes.json();
		const trailer = (videosData.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');

		const posterSize = 'w500';
		const backdropSize = 'w1280';
		const backdropUrl = movie.backdrop_path ? IMG_PATH + backdropSize + movie.backdrop_path : '';
		
		movieDetail.innerHTML = `
			<div class="movie-detail-backdrop" style="background-image: url('${backdropUrl}')"></div>
			<div class="movie-detail-content">
				<div class="movie-detail-container">
					<div class="movie-detail-main">
						<div class="movie-poster-section">
							<div class="poster-wrapper">
								<img src="${movie.poster_path ? IMG_PATH + posterSize + movie.poster_path : PLACEHOLDER_IMG}" alt="${movie.title}" class="movie-detail-poster">
								<div class="movie-poster-overlay">
									${trailer ? `<button class="btn-play-large" id="play-trailer"><i class="fas fa-play"></i></button>` : ''}
								</div>
							</div>
						</div>
						<div class="movie-detail-info">
							<div class="movie-header">
								<h1 class="movie-detail-title">${movie.title}</h1>
								<div class="movie-detail-meta">
									<span class="movie-year">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
									<span class="movie-runtime">${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m</span>
									<div class="movie-rating">
										<i class="fas fa-star"></i>
										<span>${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
									</div>
								</div>
							</div>
							
							<div class="movie-detail-genres">
								${movie.genres ? movie.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('') : ''}
							</div>
							
							<div class="movie-overview">
								<h3>Overview</h3>
								<p>${movie.overview || 'No overview available.'}</p>
							</div>
							
							<div class="movie-actions">
								${trailer ? `<button class="btn btn-primary" id="play-trailer-btn"><i class="fas fa-play"></i> Play Trailer</button>` : ''}
								<button class="btn btn-secondary" id="watch-now"><i class="fas fa-film"></i> Watch Movie</button>
								<button class="btn btn-outline" id="watch-youtube"><i class="fab fa-youtube"></i> YouTube</button>
							</div>
							
							<div class="movie-detail-cast" id="cast-chips"></div>
						</div>
					</div>
					
					<div class="movie-tabs">
						<button class="tab-btn active" data-tab="comments"><i class="fas fa-comments"></i> Comments</button>
						<button class="tab-btn" data-tab="similar"><i class="fas fa-film"></i> Similar Movies</button>
						<button class="tab-btn" data-tab="contact"><i class="fas fa-envelope"></i> Contact</button>
					</div>
					
					<div class="tab-content">
						<div class="tab-panel active" id="comments-tab">
							<div class="comments-section">
								<div id="comments-list" class="comments-list"></div>
								<form id="comment-form" class="comment-form">
									<input id="comment-name" type="text" placeholder="Your name" required>
									<textarea id="comment-text" rows="3" placeholder="Share your thoughts about this movie..." required></textarea>
									<button class="btn btn-primary" type="submit">Post Comment</button>
								</form>
							</div>
						</div>
						<div class="tab-panel" id="similar-tab">
							<div class="similar-movies-section">
								<h3>Similar Movies You Might Like</h3>
								<div id="similar-movies-container"></div>
							</div>
						</div>
						<div class="tab-panel" id="contact-tab">
							<div class="contact-info">
								<h3>Get in Touch</h3>
								<p>Have feedback about this movie or suggestions for our site?</p>
								<div class="contact-buttons">
									<a class="btn btn-outline" href="mailto:aimeemercury6@gmail.com?subject=${encodeURIComponent('Movie feedback: ' + movie.title)}">
										<i class="fas fa-envelope"></i> Email Aimee
									</a>
									<a class="btn btn-outline" href="https://instagram.com/aimee_mercury6" target="_blank" rel="noopener">
										<i class="fab fa-instagram"></i> Instagram DM
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			${trailer ? `<div id="trailer-container" class="trailer-container" style="display:none;"><div class="trailer-wrapper"><iframe id="trailer-frame" src="" title="${movie.title} trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><button class="close-trailer" id="close-trailer"><i class="fas fa-times"></i></button></div></div>` : ''}
		`;

		// Cast
		try {
			const creditsRes = await fetch(`${API_URL}/movie/${movieId}/credits?language=en-US`, FETCH_OPTIONS);
			const credits = await creditsRes.json();
			const castList = (credits.cast || []).slice(0, 10);
			const castEl = document.getElementById('cast-chips');
			if (castEl) castEl.innerHTML = castList.map(c => `<span class="cast-chip">${c.name}${c.character ? ` as ${c.character}` : ''}</span>`).join('');
		} catch(_) {}

		// Similar movies - load in tab
		const loadSimilarMovies = async () => {
			try {
				const similarRes = await fetch(`${API_URL}/movie/${movieId}/similar?language=en-US&page=1`, FETCH_OPTIONS);
				const similar = await similarRes.json();
				const similarContainer = document.getElementById('similar-movies-container');
				
				if (similar && Array.isArray(similar.results) && similar.results.length && similarContainer) {
					similarContainer.innerHTML = `
						<div class="similar-grid">
							${similar.results.slice(0, 8).map(s => `
								<div class="similar-card" data-id="${s.id}">
									<img loading="lazy" src="${s.poster_path ? IMG_PATH + 'w342' + s.poster_path : PLACEHOLDER_IMG}" alt="${s.title || ''}">
									<div class="similar-info">
										<h4>${s.title || ''}</h4>
										<div class="similar-meta">
											<span>${s.release_date ? s.release_date.split('-')[0] : 'N/A'}</span>
											<span class="rating"><i class="fas fa-star"></i> ${s.vote_average ? s.vote_average.toFixed(1) : 'N/A'}</span>
										</div>
									</div>
								</div>
							`).join('')}
						</div>`;
					
					similarContainer.querySelectorAll('.similar-card').forEach(card => {
						card.addEventListener('click', () => {
							showMovieDetails(card.getAttribute('data-id'));
						});
					});
				} else if (similarContainer) {
					similarContainer.innerHTML = '<p class="no-results">No similar movies found.</p>';
				}
			} catch(error) {
				console.error('Error loading similar movies:', error);
				const similarContainer = document.getElementById('similar-movies-container');
				if (similarContainer) {
					similarContainer.innerHTML = '<p class="no-results">Failed to load similar movies.</p>';
				}
			}
		};

		// Tab functionality
		const tabButtons = document.querySelectorAll('.tab-btn');
		const tabPanels = document.querySelectorAll('.tab-panel');
		
		tabButtons.forEach(button => {
			button.addEventListener('click', () => {
				const targetTab = button.dataset.tab;
				
				// Update active tab button
				tabButtons.forEach(btn => btn.classList.remove('active'));
				button.classList.add('active');
				
				// Update active tab panel
				tabPanels.forEach(panel => panel.classList.remove('active'));
				document.getElementById(`${targetTab}-tab`).classList.add('active');
				
				// Load similar movies when tab is clicked
				if (targetTab === 'similar') {
					loadSimilarMovies();
				}
			});
		});

		movieModal.style.display = 'block';
		document.body.style.overflow = 'hidden';

		// Enhanced trailer functionality
		const playTrailerBtn = document.getElementById('play-trailer');
		const playTrailerBtnSmall = document.getElementById('play-trailer-btn');
		const trailerContainer = document.getElementById('trailer-container');
		const trailerFrame = document.getElementById('trailer-frame');
		const closeTrailerBtn = document.getElementById('close-trailer');
		
		const playTrailer = (e) => {
			e.preventDefault();
			if (trailer) {
				trailerFrame.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`;
				trailerContainer.style.display = 'block';
				document.body.style.overflow = 'hidden';
			}
		};
		
		if (playTrailerBtn) {
			playTrailerBtn.addEventListener('click', playTrailer);
		}
		if (playTrailerBtnSmall) {
			playTrailerBtnSmall.addEventListener('click', playTrailer);
		}
		
		if (closeTrailerBtn && trailerContainer) {
			closeTrailerBtn.addEventListener('click', () => {
				trailerContainer.style.display = 'none';
				trailerFrame.src = '';
				document.body.style.overflow = 'auto';
			});
		}
		
		// Close trailer when clicking outside
		if (trailerContainer) {
			trailerContainer.addEventListener('click', (e) => {
				if (e.target === trailerContainer) {
					trailerContainer.style.display = 'none';
					trailerFrame.src = '';
					document.body.style.overflow = 'auto';
				}
			});
		}

		// Comments (local)
		const commentsKey = `comments_${movieId}`;
		const listEl = document.getElementById('comments-list');
		function renderComments() {
			let items = [];
			try { items = JSON.parse(localStorage.getItem(commentsKey)) || []; } catch(_) {}
			if (!items.length) { listEl.innerHTML = '<p class="no-results">No comments yet.</p>'; return; }
			listEl.innerHTML = items.map(c => `
				<div class="comment-item">
					<div class="comment-meta">${c.name} · ${new Date(c.time).toLocaleString()}</div>
					<div class="comment-text">${c.text}</div>
				</div>
			`).join('');
		}
		renderComments();

		const commentForm = document.getElementById('comment-form');
		commentForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const name = document.getElementById('comment-name').value.trim() || 'Anonymous';
			const text = document.getElementById('comment-text').value.trim();
			if (!text) return;
			let items = [];
			try { items = JSON.parse(localStorage.getItem(commentsKey)) || []; } catch(_) {}
			items.unshift({ name, text, time: Date.now() });
			try { localStorage.setItem(commentsKey, JSON.stringify(items)); } catch(_) {}
			document.getElementById('comment-text').value = '';
			renderComments();
			showNotification('Comment posted');
		});

		// Enhanced streaming functionality
		const watchBtn = document.getElementById('watch-now');
		const youtubeBtn = document.getElementById('watch-youtube');
		
		// Watch Now button - multiple streaming options
		if (watchBtn) {
			watchBtn.addEventListener('click', (e) => {
				e.preventDefault();
				showStreamingOptions(movie);
			});
		}
		
		// YouTube search button
		if (youtubeBtn) {
			youtubeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				const searchQuery = encodeURIComponent(`${movie.title} full movie`);
				window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank', 'noopener');
			});
		}
	} catch (error) {
		console.error('Error fetching movie details:', error);
		showNotification('Failed to load movie details. Please try again later.');
	}
}

// Show streaming options modal
function showStreamingOptions(movie) {
	const streamingModal = document.createElement('div');
	streamingModal.className = 'modal streaming-modal';
	streamingModal.innerHTML = `
		<div class="modal-content streaming-content">
			<div class="close-modal" id="close-streaming">
				<i class="fas fa-times"></i>
			</div>
			<div class="streaming-header">
				<h2><i class="fas fa-play-circle"></i> Choose Streaming Platform</h2>
				<p>Select your preferred platform to watch "${movie.title}"</p>
			</div>
			<div class="streaming-options">
				<div class="streaming-option" data-url="https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' full movie')}">
					<div class="streaming-icon youtube">
						<i class="fab fa-youtube"></i>
					</div>
					<div class="streaming-info">
						<h3>YouTube</h3>
						<p>Search and watch on YouTube</p>
					</div>
				</div>
				<div class="streaming-option" data-url="https://vidsrc.me/embed/movie/${movie.id}">
					<div class="streaming-icon vidsrc">
						<i class="fas fa-film"></i>
					</div>
					<div class="streaming-info">
						<h3>VidSrc</h3>
						<p>Free streaming platform</p>
					</div>
				</div>
				
				
			</div>
		
		</div>
	`;
	
	document.body.appendChild(streamingModal);
	streamingModal.style.display = 'block';
	document.body.style.overflow = 'hidden';
	
	// Add event listeners
	const closeBtn = document.getElementById('close-streaming');
	const streamingOptions = streamingModal.querySelectorAll('.streaming-option');
	
	closeBtn.addEventListener('click', () => {
		streamingModal.remove();
		document.body.style.overflow = 'auto';
	});
	
	streamingOptions.forEach(option => {
		option.addEventListener('click', () => {
			const url = option.dataset.url;
			window.open(url, '_blank', 'noopener');
			streamingModal.remove();
			document.body.style.overflow = 'auto';
		});
	});
	
	// Close when clicking outside
	streamingModal.addEventListener('click', (e) => {
		if (e.target === streamingModal) {
			streamingModal.remove();
			document.body.style.overflow = 'auto';
		}
	});
}

// Close modal
closeModal.addEventListener('click', () => {
	movieModal.style.display = 'none';
	document.body.style.overflow = 'auto';
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
	if (event.target === movieModal) {
		movieModal.style.display = 'none';
		document.body.style.overflow = 'auto';
	}
});

// Search
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		performSearch();
	}
});

function performSearch() {
	const searchTerm = searchInput.value.trim();
	if (searchTerm) {
		const searchUrl = `${API_URL}/search/movie?query=${encodeURIComponent(searchTerm)}&include_adult=true&language=en-US`;
		nowPlayingSection.innerHTML = '<div class="loader"><div class="loader-circle"></div></div>';
		popularSection.innerHTML = '';
		upcomingSection.innerHTML = '';
		const parent = nowPlayingSection.parentElement;
		if (parent && parent.querySelector('.section-title')) {
			parent.querySelector('.section-title').textContent = 'Search Results';
		}
		const resultsContainer = document.createElement('div');
		resultsContainer.className = 'movies-grid';
		nowPlayingSection.innerHTML = '';
		nowPlayingSection.appendChild(resultsContainer);
		fetchMovies(searchUrl, resultsContainer);
	}
}

// Header scroll effect
window.addEventListener('scroll', function() {
	const header = document.querySelector('header');
	if (window.scrollY > 50) {
		header.classList.add('scrolled');
	} else {
		header.classList.remove('scrolled');
	}
});

// Initialize with parallel loading and enhanced error handling
document.addEventListener('DOMContentLoaded', function() {
	// Show loading progress bar
	showLoadingProgress();
	
	// Load all movie sections in parallel for faster loading
	const moviePromises = [
		fetchMoviesWithRetry(`${API_URL}/movie/top_rated?language=en-US&page=1`, nowPlayingSection),
		fetchMoviesWithRetry(`${API_URL}/movie/popular?language=en-US&page=1`, popularSection),
		fetchMoviesWithRetry(`${API_URL}/movie/upcoming?language=en-US&page=1`, upcomingSection)
	];

	// Show loading progress
	let loadedCount = 0;
	const totalSections = moviePromises.length;

	// Track loading progress
	moviePromises.forEach(promise => {
		promise.then(() => {
			loadedCount++;
			updateLoadingProgress((loadedCount / totalSections) * 100);
			if (loadedCount === totalSections) {
				hideLoadingProgress();
				showNotification('All movies loaded successfully!');
			}
		}).catch(error => {
			console.error('Failed to load section:', error);
			loadedCount++;
			updateLoadingProgress((loadedCount / totalSections) * 100);
		});
	});

	// Add performance monitoring
	monitorPerformance();
});

// Loading progress functions
function showLoadingProgress() {
	const progressBar = document.getElementById('loading-progress');
	if (progressBar) {
		progressBar.classList.add('show');
	}
}

function updateLoadingProgress(percentage) {
	const progressBar = document.querySelector('.progress-bar');
	if (progressBar) {
		progressBar.style.width = percentage + '%';
	}
}

function hideLoadingProgress() {
	const progressContainer = document.getElementById('loading-progress');
	const progressBar = document.querySelector('.progress-bar');
	
	if (progressBar) {
		progressBar.style.width = '100%';
		setTimeout(() => {
			if (progressContainer) {
				progressContainer.classList.remove('show');
			}
			if (progressBar) {
				progressBar.style.width = '0%';
			}
		}, 500);
	}
}

// Performance monitoring
function monitorPerformance() {
	if ('performance' in window) {
		window.addEventListener('load', () => {
			setTimeout(() => {
				const perfData = performance.getEntriesByType('navigation')[0];
				const loadTime = perfData.loadEventEnd - perfData.loadEventStart;
				
				if (loadTime > 3000) {
					console.warn('Slow loading detected:', loadTime + 'ms');
					showNotification('Loading took longer than expected.');
				}
			}, 100);
		});
	}
}

// Smooth scroll for nav and hero buttons
document.addEventListener('click', (e) => {
	const target = e.target.closest('a[href^="#"]');
	if (!target) return;
	const id = target.getAttribute('href');
	if (id.length > 1) {
		const el = document.querySelector(id);
		if (el) {
			e.preventDefault();
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
});

// Mobile menu toggle
const mobileMenuBtn = document.querySelector('.mobile-menu');
if (mobileMenuBtn) {
	mobileMenuBtn.addEventListener('click', () => {
		document.body.classList.toggle('mobile-open');
	});
}

// Offline support and error handling
let isOnline = navigator.onLine;
let retryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Network status monitoring
window.addEventListener('online', () => {
	isOnline = true;
	showNotification('Connection restored! Reloading movies...');
	retryFailedRequests();
});

window.addEventListener('offline', () => {
	isOnline = false;
	showNotification('You are offline. Some features may be limited.');
});

// Retry failed requests when back online
async function retryFailedRequests() {
	const failedRequests = JSON.parse(localStorage.getItem('failedRequests') || '[]');
	if (failedRequests.length > 0) {
		for (const request of failedRequests) {
			try {
				await fetchMovies(request.url, document.getElementById(request.elementId));
			} catch (error) {
				console.error('Retry failed:', error);
			}
		}
		localStorage.removeItem('failedRequests');
	}
}

// Enhanced fetch with retry logic
async function fetchWithRetry(url, options = {}) {
	if (!isOnline) {
		throw new Error('No internet connection');
	}

	for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
		try {
			const response = await fetch(url, options);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			retryAttempts = 0;
			return response;
		} catch (error) {
			if (attempt === MAX_RETRY_ATTEMPTS) {
				// Store failed request for retry when online
				const failedRequests = JSON.parse(localStorage.getItem('failedRequests') || '[]');
				failedRequests.push({
					url: url,
					elementId: 'retry-' + Date.now(),
					timestamp: Date.now()
				});
				localStorage.setItem('failedRequests', JSON.stringify(failedRequests));
				throw error;
			}
			
			// Wait before retry (exponential backoff)
			await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
		}
	}
}

// Update fetchMovies to use enhanced fetch
async function fetchMoviesWithRetry(url, element) {
	// Check cache first
	const cacheKey = url;
	const cachedData = getCachedData(cacheKey);
	
	if (cachedData) {
		displayMovies(cachedData.results, element);
		return;
	}

	// Show skeleton loader while loading
	element.innerHTML = createSkeletonLoader();

	try {
		const response = await fetchWithRetry(url, FETCH_OPTIONS);
		const data = await response.json();
		
		// Cache the response
		setCachedData(cacheKey, data);
		
		if (data.results && data.results.length > 0) {
			displayMovies(data.results, element);
		} else {
			element.innerHTML = '<p class="no-results">No movies found</p>';
		}
	} catch (error) {
		console.error('Error fetching movies:', error);
		const msg = String(error && error.message || '');
		let friendly = 'Failed to load movies.';
		
		if (msg.includes('401')) {
			friendly = 'Invalid or missing TMDB token.';
		} else if (msg.includes('No internet')) {
			friendly = 'No internet connection. Please check your network.';
		} else if (msg.includes('HTTP 429')) {
			friendly = 'Too many requests. Please try again later.';
		} else if (msg.includes('HTTP 500')) {
			friendly = 'Server error. Please try again later.';
		}
		
		element.innerHTML = `<p class="no-results">${friendly}</p>`;
		showNotification(friendly);
	}
}

// Service Worker registration (disabled if you don't want offline caching / data saver)
// if ('serviceWorker' in navigator) {
// 	window.addEventListener('load', () => {
// 		navigator.serviceWorker.register('/sw.js')
// 			.then(registration => {
// 				console.log('SW registered: ', registration);
// 			})
// 			.catch(registrationError => {
// 				console.log('SW registration failed: ', registrationError);
// 			});
// 	});
// }