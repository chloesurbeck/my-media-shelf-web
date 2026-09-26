/**
 * ==============================================================================
 * WELCOME TO MY MEDIA SHELF - NOTION DASHBOARD & LIVE SUPABASE APP
 * ==============================================================================
 */

let supabase = null;
let isAdmin = localStorage.getItem("shelf_admin") === "true";
let selectedItem = null;
let selectedItemCategory = "video_games";
let globalSearchQuery = "";

// The 6 Shelves in the exact order & Notion color palette from your screenshots
const SHELF_CONFIGS = [
  {
    id: "video_games",
    table: "video_games",
    heading: "must play games",
    headingColor: "#e07b24",
    calloutEmoji: "🎮",
    calloutLabel: "Video Games",
    calloutBg: "#3b291e",
    creatorKey: "developer",
    creatorLabel: "Developer",
    yearKey: "release_year",
    yearLabel: "Release Year",
    defaultStatus: "Played",
    statuses: ["Played", "In Progress", "Plan to Play", "Dropped"]
  },
  {
    id: "music",
    table: "music",
    heading: "must listen to music",
    headingColor: "#cb912f",
    calloutEmoji: "🎵",
    calloutLabel: "Music",
    calloutBg: "#223437",
    creatorKey: "artist",
    creatorLabel: "Artist",
    yearKey: "release_year",
    yearLabel: "Release Year",
    defaultStatus: "Listened",
    statuses: ["Listened", "Favorite", "Plan to Listen"]
  },
  {
    id: "movies",
    table: "movies",
    heading: "must watch movies",
    headingColor: "#448361",
    calloutEmoji: "🎬",
    calloutLabel: "Movies",
    calloutBg: "#1f3329",
    creatorKey: "director",
    creatorLabel: "Director",
    yearKey: "release_year",
    yearLabel: "Release Year",
    defaultStatus: "Watched",
    statuses: ["Watched", "Plan to Watch", "In Progress", "Dropped"]
  },
  {
    id: "television",
    table: "television",
    heading: "must see tv",
    headingColor: "#337ea9",
    calloutEmoji: "📺",
    calloutLabel: "Television",
    calloutBg: "#1e2f42",
    creatorKey: "creator_studio",
    creatorLabel: "Creator / Studio",
    yearKey: "release_year",
    yearLabel: "Release Year",
    defaultStatus: "Watched",
    statuses: ["Watched", "In Progress", "Plan to Watch", "Dropped"]
  },
  {
    id: "comics",
    table: "comics",
    heading: "must read comics",
    headingColor: "#9065b0",
    calloutEmoji: "🗯️",
    calloutLabel: "Comics",
    calloutBg: "#2f243a",
    creatorKey: "author",
    creatorLabel: "Author / Creator",
    yearKey: "publication_year",
    yearLabel: "Publication Year",
    defaultStatus: "Read",
    statuses: ["Read", "In Progress", "Plan to Read", "Dropped"]
  },
  {
    id: "books",
    table: "books",
    heading: "must read books",
    headingColor: "#d44c47",
    calloutEmoji: "📚",
    calloutLabel: "Books",
    calloutBg: "#3a2323",
    creatorKey: "author",
    creatorLabel: "Author",
    yearKey: "publication_year",
    yearLabel: "Publication Year",
    defaultStatus: "Read",
    statuses: ["Read", "In Progress", "Plan to Read", "Dropped"]
  }
];

// State per shelf section on the main page
const shelfState = {};
SHELF_CONFIGS.forEach(cfg => {
  shelfState[cfg.id] = {
    activeTab: "favorite", // 'favorite' | 'recommend' | 'physical' | 'overview'
    items: [],
    totalCount: 0,
    expandedLimit: 5
  };
});

// Full Database View state (when clicking a callout bar)
let activeDbCategory = "video_games";
let activeDbFilter = "all";
let dbItems = [];
let dbPage = 0;
const DB_PAGE_SIZE = 50;

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  if (window.SUPABASE_CONFIG && SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes("YOUR_PROJECT_ID")) {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  updateAdminUI();
  renderAllShelfSkeletons();
  loadAllShelvesData();
});

function getCategoryMetaConfig(catId) {
  return SHELF_CONFIGS.find(c => c.id === catId) || SHELF_CONFIGS[0];
}

// ==============================================================================
// STACKED NOTION SHELVES (MAIN DASHBOARD)
// ==============================================================================
function renderAllShelfSkeletons() {
  const container = document.getElementById("all-shelves-container");
  container.innerHTML = SHELF_CONFIGS.map(cfg => `
    <section id="shelf-sec-${cfg.id}" class="space-y-4 scroll-mt-16">
      <!-- Colored Notion Heading -->
      <div class="flex items-center justify-between">
        <h2 class="text-xl sm:text-2xl font-bold tracking-tight" style="color: ${cfg.headingColor}">
          ${cfg.heading}
        </h2>
        ${isAdmin ? `
          <button onclick="openAddModalFor('${cfg.id}')" class="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-[#262626] border border-white/10">
            <span>+ Add ${cfg.calloutLabel.slice(0, -1)}</span>
          </button>
        ` : ''}
      </div>

      <!-- 4 Notion View Pills -->
      <div class="flex flex-wrap items-center gap-1.5 sm:gap-2" id="pills-${cfg.id}">
        <button onclick="switchSectionTab('${cfg.id}', 'favorite')" data-tab="favorite" class="notion-pill active">
          <span class="opacity-80">⊞</span> <span>Favorite</span>
        </button>
        <button onclick="switchSectionTab('${cfg.id}', 'recommend')" data-tab="recommend" class="notion-pill">
          <span class="opacity-80">⊞</span> <span>Recommendations</span>
        </button>
        <button onclick="switchSectionTab('${cfg.id}', 'physical')" data-tab="physical" class="notion-pill">
          <span class="opacity-80">☰</span> <span>Physically Own</span>
        </button>
        <button onclick="switchSectionTab('${cfg.id}', 'overview')" data-tab="overview" class="notion-pill">
          <span class="opacity-80">◔</span> <span>Total Overview</span>
        </button>
      </div>

      <!-- 5-Card Horizontal Notion Gallery Grid -->
      <div id="grid-${cfg.id}" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 min-h-[160px]">
        <div class="col-span-full text-xs text-gray-500 py-8">Loading ${cfg.calloutLabel.toLowerCase()}...</div>
      </div>

      <!-- Show More / Collapse inside Section -->
      <div id="more-wrap-${cfg.id}" class="hidden flex justify-end">
        <button id="btn-more-${cfg.id}" onclick="toggleSectionExpand('${cfg.id}')" class="text-xs text-gray-400 hover:text-white underline underline-offset-4">
          Show more
        </button>
      </div>

      <!-- Colored Notion Callout Bar Link (Matches Screenshots 2 & 3) -->
      <div
        onclick="openFullDatabaseView('${cfg.id}')"
        class="notion-callout mt-3"
        style="background-color: ${cfg.calloutBg}"
      >
        <div class="flex items-center gap-2.5">
          <span>${cfg.calloutEmoji}</span>
          <span class="underline underline-offset-4 decoration-white/40 font-medium text-gray-100">${cfg.calloutLabel}</span>
        </div>
        <span id="count-${cfg.id}" class="text-[11px] text-gray-300/80 font-normal">View all →</span>
      </div>
    </section>
  `).join("");
}

async function loadAllShelvesData() {
  if (!supabase) return;
  await Promise.all(SHELF_CONFIGS.map(cfg => fetchSectionTabItems(cfg.id)));
}

async function fetchSectionTabItems(catId) {
  const cfg = getCategoryMetaConfig(catId);
  const state = shelfState[catId];
  const tab = state.activeTab;

  // Query total count + filtered items for this section
  let query = supabase.from(cfg.table).select("*", { count: "exact" });

  if (globalSearchQuery) {
    if (cfg.table === "music") {
      query = query.or(`album.ilike.%${globalSearchQuery}%,artist.ilike.%${globalSearchQuery}%,genre.ilike.%${globalSearchQuery}%`);
    } else {
      query = query.or(`title.ilike.%${globalSearchQuery}%,genre.ilike.%${globalSearchQuery}%`);
    }
  } else {
    if (tab === "favorite") {
      if (cfg.table === "music") {
        query = query.or("recommend.ilike.%yes%,status.ilike.%favorite%");
      } else {
        query = query.ilike("favorite", "%yes%");
      }
    } else if (tab === "recommend") {
      query = query.ilike("recommend", "%yes%");
    } else if (tab === "physical") {
      query = query.ilike("physical_copy", "%yes%");
    }
  }

  if (cfg.table === "music") {
    query = query.order("id", { ascending: true });
  } else {
    query = query.order("title", { ascending: true });
  }

  query = query.limit(40);

  const { data, count, error } = await query;
  if (error) {
    console.warn(`Error loading ${catId}:`, error);
    return;
  }

  // Also fetch total table count once for the callout bar badge
  if (!state.totalCount) {
    const { count: fullCount } = await supabase.from(cfg.table).select("id", { count: "exact", head: true });
    state.totalCount = fullCount || (data ? data.length : 0);
    const countEl = document.getElementById(`count-${catId}`);
    if (countEl && state.totalCount) {
      countEl.innerText = `${state.totalCount.toLocaleString()} titles →`;
    }
  }

  state.items = data || [];
  renderSectionGrid(catId);
}

function switchSectionTab(catId, tabName) {
  const state = shelfState[catId];
  state.activeTab = tabName;
  state.expandedLimit = tabName === "overview" ? 15 : 5;

  // Update active pill styling
  const pillsWrap = document.getElementById(`pills-${catId}`);
  if (pillsWrap) {
    pillsWrap.querySelectorAll("button").forEach(btn => {
      if (btn.getAttribute("data-tab") === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  fetchSectionTabItems(catId);
}

function toggleSectionExpand(catId) {
  const state = shelfState[catId];
  state.expandedLimit = state.expandedLimit <= 5 ? 25 : 5;
  renderSectionGrid(catId);
}

function renderSectionGrid(catId) {
  const cfg = getCategoryMetaConfig(catId);
  const state = shelfState[catId];
  const grid = document.getElementById(`grid-${catId}`);
  const moreWrap = document.getElementById(`more-wrap-${catId}`);
  const moreBtn = document.getElementById(`btn-more-${catId}`);

  if (!grid) return;

  const visibleItems = state.items.slice(0, state.expandedLimit);

  if (visibleItems.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-6 px-4 rounded-xl bg-[#222222] border border-white/5 flex items-center justify-between text-xs text-gray-400">
        <span>No items tagged in "${state.activeTab}" yet for ${cfg.calloutLabel}.</span>
        <button onclick="switchSectionTab('${catId}', 'overview')" class="text-white underline underline-offset-4">View Total Overview →</button>
      </div>
    `;
    moreWrap.classList.add("hidden");
    return;
  }

  grid.innerHTML = visibleItems.map(item => buildNotionCardHtml(cfg.id, item, true)).join("");

  if (state.items.length > 5) {
    moreWrap.classList.remove("hidden");
    moreBtn.innerText = state.expandedLimit <= 5 ? `Show all (${state.items.length})` : "Show top 5";
  } else {
    moreWrap.classList.add("hidden");
  }
}

function buildNotionCardHtml(catId, item, isLandscape) {
  const cfg = getCategoryMetaConfig(catId);
  const title = item.title || item.album || "Untitled";
  const subtitle = item[cfg.creatorKey] || item.director || item.creator_studio || item.developer || item.author || item.artist || "";
  const year = item.release_year || item.publication_year || "";
  const cover = item.cover_url || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
  const isFav = (item.favorite || "").toLowerCase().includes("yes") || (item.status || "").toLowerCase() === "favorite";
  const isRec = (item.recommend || "").toLowerCase().includes("yes");
  const hasPhys = (item.physical_copy || "").toLowerCase().includes("yes");

  const aspectClass = isLandscape ? "aspect-[16/10]" : "aspect-[2/3]";

  return `
    <div
      onclick="openDetailModal('${catId}', ${item.id})"
      class="notion-card cursor-pointer flex flex-col group relative"
    >
      <!-- Cover Image Area -->
      <div class="relative ${aspectClass} w-full bg-[#1f1f1f] overflow-hidden">
        <img
          src="${cover}"
          alt="${escapeHtml(title)}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80'"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <!-- Subtle Status Badges on Hover -->
        <div class="absolute top-2 right-2 flex gap-1 opacity-85">
          ${isFav ? '<span title="Favorite" class="p-1 bg-pink-600/90 text-white rounded shadow"><svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>' : ''}
          ${isRec ? '<span title="Recommended" class="p-1 bg-amber-500/90 text-white rounded shadow"><svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>' : ''}
          ${hasPhys ? '<span title="Physically Own" class="p-1 bg-emerald-600/90 text-white rounded shadow"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></span>' : ''}
        </div>
      </div>

      <!-- Title & Subtitle Area (Matches Notion Card Bottom Area) -->
      <div class="p-3 flex-1 flex flex-col justify-between bg-[#262626]">
        <div class="text-xs font-medium text-gray-100 leading-snug line-clamp-2">${escapeHtml(title)}</div>
        ${!isLandscape && (subtitle || year) ? `
          <div class="text-[10px] text-gray-400 truncate mt-1.5">${escapeHtml(subtitle)} ${year ? '• ' + year : ''}</div>
        ` : ''}
      </div>
    </div>
  `;
}

// ==============================================================================
// FULL DATABASE VIEW (WHEN CLICKING CALLOUT BAR e.g. 🎮 Video Games)
// ==============================================================================
function openFullDatabaseView(catId, initialFilter = "all") {
  activeDbCategory = catId;
  activeDbFilter = initialFilter;
  dbPage = 0;

  const cfg = getCategoryMetaConfig(catId);
  document.getElementById("shelf-hero").classList.add("hidden");
  document.getElementById("all-shelves-container").classList.add("hidden");
  document.getElementById("single-database-view").classList.remove("hidden");

  document.getElementById("breadcrumb-divider").classList.remove("hidden");
  const bc = document.getElementById("breadcrumb-current");
  bc.classList.remove("hidden");
  bc.innerText = `${cfg.calloutEmoji} ${cfg.calloutLabel}`;

  const titleEl = document.getElementById("db-view-title");
  titleEl.innerText = `${cfg.calloutEmoji} ${cfg.calloutLabel}`;
  titleEl.style.color = cfg.headingColor;

  setDbFilter(initialFilter);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showAllShelvesHome() {
  document.getElementById("single-database-view").classList.add("hidden");
  document.getElementById("shelf-hero").classList.remove("hidden");
  document.getElementById("all-shelves-container").classList.remove("hidden");
  document.getElementById("breadcrumb-divider").classList.add("hidden");
  document.getElementById("breadcrumb-current").classList.add("hidden");
}

function scrollToShelf(catId) {
  showAllShelvesHome();
  const el = document.getElementById(`shelf-sec-${catId}`);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function setDbFilter(filterName) {
  activeDbFilter = filterName;
  dbPage = 0;
  ["all", "favorite", "recommend", "physical", "plan"].forEach(f => {
    const el = document.getElementById(`dbf-${f}`);
    if (el) {
      if (f === filterName) el.classList.add("active");
      else el.classList.remove("active");
    }
  });
  fetchFullDbPage(true);
}

async function fetchFullDbPage(reset = true) {
  if (!supabase) return;
  const cfg = getCategoryMetaConfig(activeDbCategory);
  let query = supabase.from(cfg.table).select("*", { count: "exact" });

  if (activeDbFilter === "favorite") {
    if (cfg.table === "music") query = query.or("recommend.ilike.%yes%,status.ilike.%favorite%");
    else query = query.ilike("favorite", "%yes%");
  } else if (activeDbFilter === "recommend") {
    query = query.ilike("recommend", "%yes%");
  } else if (activeDbFilter === "physical") {
    query = query.ilike("physical_copy", "%yes%");
  } else if (activeDbFilter === "plan") {
    query = query.ilike("status", "%plan%");
  }

  if (globalSearchQuery) {
    if (cfg.table === "music") {
      query = query.or(`album.ilike.%${globalSearchQuery}%,artist.ilike.%${globalSearchQuery}%,genre.ilike.%${globalSearchQuery}%`);
    } else {
      query = query.or(`title.ilike.%${globalSearchQuery}%,genre.ilike.%${globalSearchQuery}%`);
    }
  }

  if (cfg.table === "music") {
    query = query.order("artist", { ascending: true }).order("release_year", { ascending: false });
  } else {
    query = query.order("title", { ascending: true });
  }

  const start = dbPage * DB_PAGE_SIZE;
  query = query.range(start, start + DB_PAGE_SIZE - 1);

  const { data, count } = await query;
  const items = data || [];
  dbItems = reset ? items : [...dbItems, ...items];

  document.getElementById("db-view-count").innerText = `(${(count || 0).toLocaleString()} titles)`;
  const grid = document.getElementById("db-view-grid");
  const html = items.map(item => buildNotionCardHtml(cfg.id, item, false)).join("");

  if (reset) grid.innerHTML = html;
  else grid.insertAdjacentHTML("beforeend", html);

  const loadMoreBtn = document.getElementById("btn-db-load-more");
  if (dbItems.length < (count || 0)) loadMoreBtn.classList.remove("hidden");
  else loadMoreBtn.classList.add("hidden");
}

function loadMoreDbItems() {
  dbPage++;
  fetchFullDbPage(false);
}

// ==============================================================================
// GLOBAL SEARCH
// ==============================================================================
let searchDebounce = null;
function handleGlobalSearch(val) {
  globalSearchQuery = val.trim();
  const clearBtn = document.getElementById("clear-global-search");
  if (globalSearchQuery) clearBtn.classList.remove("hidden");
  else clearBtn.classList.add("hidden");

  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const isDbView = !document.getElementById("single-database-view").classList.contains("hidden");
    if (isDbView) {
      fetchFullDbPage(true);
    } else {
      loadAllShelvesData();
    }
  }, 300);
}

function clearGlobalSearch() {
  document.getElementById("global-search-input").value = "";
  handleGlobalSearch("");
}

// ==============================================================================
// DETAIL & EDIT MODAL
// ==============================================================================
function openDetailModal(catId, itemId) {
  selectedItemCategory = catId;
  const cfg = getCategoryMetaConfig(catId);
  const pool = [...(shelfState[catId]?.items || []), ...dbItems];
  selectedItem = pool.find(i => i.id === itemId);
  if (!selectedItem) return;

  const modal = document.getElementById("detail-modal");
  const title = selectedItem.title || selectedItem.album || "Untitled";
  const subtitle = selectedItem[cfg.creatorKey] || selectedItem.director || selectedItem.creator_studio || selectedItem.developer || selectedItem.author || selectedItem.artist || "";
  const year = selectedItem.release_year || selectedItem.publication_year || "";
  const genre = selectedItem.genre || "N/A";
  const cover = selectedItem.cover_url || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
  const status = selectedItem.status || cfg.defaultStatus;
  const isFav = (selectedItem.favorite || "").toLowerCase().includes("yes") || (selectedItem.status || "").toLowerCase() === "favorite";
  const isRec = (selectedItem.recommend || "").toLowerCase().includes("yes");
  const hasPhysical = (selectedItem.physical_copy || "").toLowerCase().includes("yes");

  document.getElementById("modal-cover").src = cover;
  document.getElementById("modal-banner-bg").src = cover;
  document.getElementById("modal-title").innerText = title;
  document.getElementById("modal-subtitle").innerText = subtitle;
  document.getElementById("modal-category-badge").innerText = cfg.calloutLabel;

  document.getElementById("modal-status-view").innerText = status;
  document.getElementById("modal-status-edit").value = status;
  document.getElementById("modal-year-view").innerText = year || "—";
  document.getElementById("modal-year-edit").value = year;
  document.getElementById("modal-genre-view").innerText = genre;
  document.getElementById("modal-genre-edit").value = genre === "N/A" ? "" : genre;
  document.getElementById("modal-creator-label").innerText = cfg.creatorLabel;
  document.getElementById("modal-creator-edit").value = subtitle;
  document.getElementById("modal-cover-edit").value = selectedItem.cover_url || "";

  updateModalToggleStyle("modal-fav-toggle", isFav, "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("modal-rec-toggle", isRec, "text-yellow-400 border-yellow-500 bg-yellow-500/10");
  updateModalToggleStyle("modal-phys-toggle", hasPhysical, "text-emerald-400 border-emerald-500 bg-emerald-500/10");

  const editFooter = document.getElementById("modal-edit-footer");
  const statusView = document.getElementById("modal-status-view");
  const statusEdit = document.getElementById("modal-status-edit");
  const yearView = document.getElementById("modal-year-view");
  const yearEdit = document.getElementById("modal-year-edit");
  const genreView = document.getElementById("modal-genre-view");
  const genreEdit = document.getElementById("modal-genre-edit");
  const creatorBox = document.getElementById("modal-creator-box");
  const coverBox = document.getElementById("modal-cover-box");

  if (isAdmin) {
    editFooter.classList.remove("hidden");
    statusView.classList.add("hidden");
    statusEdit.classList.remove("hidden");
    yearView.classList.add("hidden");
    yearEdit.classList.remove("hidden");
    genreView.classList.add("hidden");
    genreEdit.classList.remove("hidden");
    creatorBox.classList.remove("hidden");
    coverBox.classList.remove("hidden");
  } else {
    editFooter.classList.add("hidden");
    statusView.classList.remove("hidden");
    statusEdit.classList.add("hidden");
    yearView.classList.remove("hidden");
    yearEdit.classList.add("hidden");
    genreView.classList.remove("hidden");
    genreEdit.classList.add("hidden");
    creatorBox.classList.add("hidden");
    coverBox.classList.add("hidden");
  }

  modal.classList.remove("hidden");
  lucide.createIcons();
}

function closeModal() {
  document.getElementById("detail-modal").classList.add("hidden");
  selectedItem = null;
}

function updateModalToggleStyle(elemId, isActive, activeClasses) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  if (isActive) {
    elem.className = `flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${activeClasses}`;
  } else {
    elem.className = "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/15 text-gray-400 transition hover:border-white/30 hover:text-white";
  }
}

async function toggleModalProp(prop) {
  if (!isAdmin) {
    alert("Unlock Editor Mode (lock icon in the top right) to edit tags.");
    return;
  }
  if (!selectedItem) return;
  const cfg = getCategoryMetaConfig(selectedItemCategory);

  const curr = (selectedItem[prop] || "").toLowerCase().includes("yes");
  selectedItem[prop] = curr ? "" : "Yes";

  const isFav = (selectedItem.favorite || "").toLowerCase().includes("yes");
  const isRec = (selectedItem.recommend || "").toLowerCase().includes("yes");
  const hasPhysical = (selectedItem.physical_copy || "").toLowerCase().includes("yes");

  updateModalToggleStyle("modal-fav-toggle", isFav, "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("modal-rec-toggle", isRec, "text-yellow-400 border-yellow-500 bg-yellow-500/10");
  updateModalToggleStyle("modal-phys-toggle", hasPhysical, "text-emerald-400 border-emerald-500 bg-emerald-500/10");

  if (supabase) {
    const patchObj = {};
    if (prop === "favorite" && cfg.table === "music") {
      patchObj.recommend = selectedItem.favorite;
      patchObj.status = selectedItem.favorite === "Yes" ? "Favorite" : "Listened";
    } else {
      patchObj[prop] = selectedItem[prop];
    }
    await supabase.from(cfg.table).update(patchObj).eq("id", selectedItem.id);
    fetchSectionTabItems(selectedItemCategory);
  }
}

async function autoLookupForEditModal() {
  if (!selectedItem) return;
  const title = selectedItem.title || selectedItem.album || "";
  if (!title) return;
  const matches = await lookupMediaCandidates(selectedItemCategory, title);
  if (matches.length > 0) {
    const best = matches[0];
    if (best.creator) document.getElementById("modal-creator-edit").value = best.creator;
    if (best.year) document.getElementById("modal-year-edit").value = best.year;
    if (best.genre) document.getElementById("modal-genre-edit").value = best.genre;
    if (best.cover) {
      document.getElementById("modal-cover-edit").value = best.cover;
      document.getElementById("modal-cover").src = best.cover;
      document.getElementById("modal-banner-bg").src = best.cover;
    }
  }
}

async function saveModalChanges() {
  if (!selectedItem || !supabase) return;
  const cfg = getCategoryMetaConfig(selectedItemCategory);

  const newStatus = document.getElementById("modal-status-edit").value;
  const newYear = document.getElementById("modal-year-edit").value.trim();
  const newGenre = document.getElementById("modal-genre-edit").value.trim();
  const newCreator = document.getElementById("modal-creator-edit").value.trim();
  const newCover = document.getElementById("modal-cover-edit").value.trim();

  const updates = {
    status: newStatus,
    genre: newGenre,
    recommend: selectedItem.recommend || "",
    physical_copy: selectedItem.physical_copy || "",
    cover_url: newCover
  };

  if (cfg.table !== "music") {
    updates.favorite = selectedItem.favorite || "";
  }
  updates[cfg.creatorKey] = newCreator;
  updates[cfg.yearKey] = newYear;

  const { error } = await supabase.from(cfg.table).update(updates).eq("id", selectedItem.id);

  if (error) {
    alert("Error saving: " + error.message);
  } else {
    closeModal();
    fetchSectionTabItems(selectedItemCategory);
    if (!document.getElementById("single-database-view").classList.contains("hidden")) {
      fetchFullDbPage(true);
    }
  }
}

async function deleteCurrentItem() {
  if (!selectedItem || !supabase) return;
  const cfg = getCategoryMetaConfig(selectedItemCategory);
  if (!confirm(`Delete "${selectedItem.title || selectedItem.album}"?`)) return;

  const { error } = await supabase.from(cfg.table).delete().eq("id", selectedItem.id);
  if (error) {
    alert("Error deleting: " + error.message);
  } else {
    closeModal();
    fetchSectionTabItems(selectedItemCategory);
  }
}

// ==============================================================================
// ADMIN / PHONE EDITING MODE
// ==============================================================================
function toggleAdminPrompt() {
  if (isAdmin) {
    if (confirm("Exit Editor Mode?")) {
      isAdmin = false;
      localStorage.setItem("shelf_admin", "false");
      updateAdminUI();
      renderAllShelfSkeletons();
      loadAllShelvesData();
    }
  } else {
    const code = prompt("Enter Editor Passcode:");
    const validCode = (window.SUPABASE_CONFIG && SUPABASE_CONFIG.adminPasscode) ? SUPABASE_CONFIG.adminPasscode : "LuckyGirl";
    if (code === validCode) {
      isAdmin = true;
      localStorage.setItem("shelf_admin", "true");
      updateAdminUI();
      renderAllShelfSkeletons();
      loadAllShelvesData();
    } else if (code !== null) {
      alert("Incorrect passcode.");
    }
  }
}

function updateAdminUI() {
  const badge = document.getElementById("admin-badge");
  const lockIcon = document.getElementById("admin-lock-icon");
  const addBtn = document.getElementById("btn-add-item");
  const mobileAddBtn = document.getElementById("btn-mobile-add");

  if (isAdmin) {
    badge.classList.remove("hidden");
    lockIcon.setAttribute("data-lucide", "unlock");
    lockIcon.classList.add("text-emerald-400");
    addBtn.classList.remove("hidden");
    mobileAddBtn.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
    lockIcon.setAttribute("data-lucide", "lock");
    lockIcon.classList.remove("text-emerald-400");
    addBtn.classList.add("hidden");
    mobileAddBtn.classList.add("hidden");
  }
  lucide.createIcons();
}

// ==============================================================================
// DYNAMIC ADD TO SHELF & LIVE AUTO-LOOKUP ENGINE
// ==============================================================================
let addModalState = {
  favorite: "",
  recommend: "",
  physical_copy: "",
  lookupTimer: null,
  matches: []
};

function openAddModalFor(catId) {
  openAddModal(catId);
}

function openAddModal(defaultCat) {
  const modal = document.getElementById("add-modal");
  document.getElementById("add-category").value = defaultCat || activeDbCategory || "video_games";
  document.getElementById("add-title").value = "";
  document.getElementById("add-creator").value = "";
  document.getElementById("add-year").value = "";
  document.getElementById("add-genre").value = "";
  document.getElementById("add-cover-url").value = "";
  document.getElementById("add-cover-preview").src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
  document.getElementById("add-lookup-matches").classList.add("hidden");
  document.getElementById("add-lookup-list").innerHTML = "";

  addModalState = { favorite: "Yes", recommend: "", physical_copy: "", lookupTimer: null, matches: [] };
  refreshAddTagStyles();
  onAddCategoryChange();

  modal.classList.remove("hidden");
  lucide.createIcons();
  setTimeout(() => document.getElementById("add-title").focus(), 60);
}

function closeAddModal() {
  document.getElementById("add-modal").classList.add("hidden");
}

function onAddCategoryChange() {
  const catId = document.getElementById("add-category").value;
  const cfg = getCategoryMetaConfig(catId);
  document.getElementById("add-creator-label").innerText = cfg.creatorLabel;
  document.getElementById("add-year-label").innerText = cfg.yearLabel;
  document.getElementById("add-title-label").innerText = catId === "music" ? "2. Album Title (or Artist - Album)" : "2. Title (Dynamic Cover & Creator Lookup)";

  const statusSel = document.getElementById("add-status");
  statusSel.innerHTML = cfg.statuses.map(s => `<option value="${s}">${s}</option>`).join("");
  statusSel.value = cfg.defaultStatus;

  const q = document.getElementById("add-title").value.trim();
  if (q.length >= 2) triggerAutoLookup();
}

function toggleAddTag(tag) {
  addModalState[tag] = addModalState[tag] === "Yes" ? "" : "Yes";
  refreshAddTagStyles();
}

function refreshAddTagStyles() {
  updateModalToggleStyle("add-fav-btn", addModalState.favorite === "Yes", "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("add-rec-btn", addModalState.recommend === "Yes", "text-yellow-400 border-yellow-500 bg-yellow-500/10");
  updateModalToggleStyle("add-phys-btn", addModalState.physical_copy === "Yes", "text-emerald-400 border-emerald-500 bg-emerald-500/10");
}

function onAddTitleInput() {
  if (addModalState.lookupTimer) clearTimeout(addModalState.lookupTimer);
  const q = document.getElementById("add-title").value.trim();
  if (q.length < 3) return;
  addModalState.lookupTimer = setTimeout(() => {
    triggerAutoLookup();
  }, 500);
}

async function triggerAutoLookup() {
  const catId = document.getElementById("add-category").value;
  const q = document.getElementById("add-title").value.trim();
  if (!q) return;

  const btnText = document.getElementById("add-lookup-btn-text");
  btnText.innerText = "Searching...";

  try {
    const matches = await lookupMediaCandidates(catId, q);
    addModalState.matches = matches;

    if (matches.length > 0) {
      applyLookupMatch(0);
      renderLookupMatches(matches);
    }
  } catch (err) {
    console.warn("Lookup error:", err);
  } finally {
    btnText.innerText = "Auto-Fill";
  }
}

function renderLookupMatches(matches) {
  const container = document.getElementById("add-lookup-matches");
  const list = document.getElementById("add-lookup-list");
  if (!matches || matches.length <= 1) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  list.innerHTML = matches.slice(0, 4).map((m, idx) => `
    <button
      type="button"
      onclick="applyLookupMatch(${idx})"
      class="flex items-center gap-2.5 p-2 rounded-xl bg-[#262626] hover:bg-[#323232] border border-white/10 text-left transition"
    >
      <img src="${m.cover || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&q=80'}" class="w-8 h-11 object-cover rounded flex-shrink-0 bg-[#191919]">
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escapeHtml(m.title)}</div>
        <div class="text-[10px] text-gray-400 truncate">${escapeHtml(m.creator || 'Unknown')} ${m.year ? '• ' + m.year : ''}</div>
      </div>
    </button>
  `).join("");
}

function applyLookupMatch(index) {
  const m = addModalState.matches[index];
  if (!m) return;
  if (m.title) document.getElementById("add-title").value = m.title;
  if (m.creator) document.getElementById("add-creator").value = m.creator;
  if (m.year) document.getElementById("add-year").value = m.year;
  if (m.genre) document.getElementById("add-genre").value = m.genre;
  if (m.cover) {
    document.getElementById("add-cover-url").value = m.cover;
    document.getElementById("add-cover-preview").src = m.cover;
  }
}

async function lookupMediaCandidates(catId, query) {
  const out = [];

  if (catId === "movies") {
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=US&media=movie&entity=movie&limit=4`);
      const d = await r.json();
      for (const item of (d.results || [])) {
        out.push({
          title: item.trackName || query,
          creator: item.artistName || "",
          year: (item.releaseDate || "").slice(0, 4),
          genre: item.primaryGenreName || "Drama",
          cover: (item.artworkUrl100 || "").replace("100x100bb", "600x600bb")
        });
      }
    } catch (_) {}
    if (out.length === 0) {
      const w = await wikiBrowserLookup(query, "film", ["director", "writer"], "Drama");
      if (w) out.push(w);
    }
  } else if (catId === "television") {
    try {
      const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      for (const entry of (d || []).slice(0, 4)) {
        const show = entry.show || {};
        const net = (show.network || show.webChannel || {}).name || "";
        const img = (show.image || {}).original || (show.image || {}).medium || "";
        out.push({
          title: show.name || query,
          creator: net || "Television Studio",
          year: (show.premiered || "").slice(0, 4),
          genre: (show.genres || []).slice(0, 2).join(", ") || "Drama",
          cover: img ? img.replace("http://", "https://") : ""
        });
      }
    } catch (_) {}
    if (out.length === 0) {
      const w = await wikiBrowserLookup(query, "TV series", ["creator", "developer", "studio", "network"], "Drama");
      if (w) out.push(w);
    }
  } else if (catId === "video_games") {
    const w = await wikiBrowserLookup(query, "video game", ["developer", "developers", "publisher"], "Adventure");
    if (w) out.push(w);
  } else if (catId === "books" || catId === "comics") {
    try {
      const gq = catId === "comics" ? `${query} manga OR comic` : `intitle:${query}`;
      const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gq)}&maxResults=4`);
      const d = await r.json();
      for (const item of (d.items || [])) {
        const info = item.volumeInfo || {};
        const thumb = ((info.imageLinks || {}).thumbnail || (info.imageLinks || {}).smallThumbnail || "")
          .replace("http://", "https://")
          .replace("&edge=curl", "");
        out.push({
          title: info.title || query,
          creator: (info.authors || []).slice(0, 2).join(", "),
          year: (info.publishedDate || "").slice(0, 4),
          genre: (info.categories || []).slice(0, 2).join(", ") || (catId === "comics" ? "Comics / Manga" : "Fiction"),
          cover: thumb
        });
      }
    } catch (_) {}
    if (out.length === 0) {
      const w = await wikiBrowserLookup(query, catId === "comics" ? "manga comic" : "book novel", ["author", "writer", "creator"], catId === "comics" ? "Comics / Manga" : "Fiction");
      if (w) out.push(w);
    }
  } else if (catId === "music") {
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=US&media=music&entity=album&limit=4`);
      const d = await r.json();
      for (const item of (d.results || [])) {
        out.push({
          title: item.collectionName || query,
          creator: item.artistName || "",
          year: (item.releaseDate || "").slice(0, 4),
          genre: item.primaryGenreName || "Pop / Rock",
          cover: (item.artworkUrl100 || "").replace("100x100bb", "600x600bb")
        });
      }
    } catch (_) {}
  }

  return out;
}

async function wikiBrowserLookup(query, hint, creatorKeys, defaultGenre) {
  try {
    const srUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encodeURIComponent(query + " " + hint)}&srlimit=1&format=json`;
    const srRes = await fetch(srUrl);
    const srData = await srRes.json();
    const first = ((srData.query || {}).search || [])[0];
    if (!first) return null;

    const pageId = first.pageid;
    const detailUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&pageids=${pageId}&prop=pageimages|revisions&piprop=original|thumbnail&pithumbsize=600&rvprop=content&rvsection=0&format=json`;
    const detRes = await fetch(detailUrl);
    const detData = await detRes.json();
    const page = ((detData.query || {}).pages || {})[String(pageId)] || {};
    const cover = ((page.original || {}).source) || ((page.thumbnail || {}).source) || "";
    const txt = (((page.revisions || [])[0]) || {})["*"] || "";

    const cleanWiki = (raw) => {
      if (!raw) return "";
      let s = raw.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<ref[^/>]*\/?>/gi, "");
      s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
      s = s.replace(/\{\{(?:plainlist|flatlist|unbulleted list|ubl|hlist)\s*\|([^{}]*)\}\}/gi, "$1");
      s = s.replace(/\{\{[^{}]*\}\}/g, " ").replace(/<[^>]+>/g, " ").replace(/'''|''/g, "");
      const parts = s.split(/[\n*•|,]/).map(p => p.replace(/\([^)]*\)/g, "").trim()).filter(p => p.length > 1 && !/^(WW|NA|EU|JP|UK|US|Windows|macOS|Switch|PlayStation|Xbox)/i.test(p));
      return [...new Set(parts)].slice(0, 2).join(", ");
    };

    let creator = "";
    for (const k of creatorKeys) {
      const m = txt.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([\\s\\S]+?)(?=\\n\\s*\\|\\s*[\\w_]+\\s*=|\\n\\s*\\}\\})`, "i"));
      if (m) {
        creator = cleanWiki(m[1]);
        if (creator) break;
      }
    }

    let genre = "";
    const gm = txt.match(/\|\s*genres?\s*=\s*([\s\S]+?)(?=\n\s*\|\s*[\w_]+\s*=|\n\s*\}\})/i);
    if (gm) genre = cleanWiki(gm[1]);

    const ym = txt.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
    const year = ym ? ym[1] : "";

    return {
      title: first.title.replace(/\s*\([^)]*\)\s*$/, ""),
      creator: creator || "",
      year: year,
      genre: genre || defaultGenre,
      cover: cover
    };
  } catch (_) {
    return null;
  }
}

async function submitAddModal() {
  if (!supabase) return;
  const catId = document.getElementById("add-category").value;
  const cfg = getCategoryMetaConfig(catId);

  const title = document.getElementById("add-title").value.trim();
  if (!title) {
    alert("Please enter a title first.");
    return;
  }

  const creator = document.getElementById("add-creator").value.trim();
  const year = document.getElementById("add-year").value.trim();
  const genre = document.getElementById("add-genre").value.trim();
  const status = document.getElementById("add-status").value;
  const cover = document.getElementById("add-cover-url").value.trim();

  // Strictly only save clean columns (no url, notion_id, created_at, or last_edited_at)
  const payload = {
    genre: genre || "General",
    status: status,
    recommend: addModalState.recommend,
    physical_copy: addModalState.physical_copy,
    cover_url: cover
  };

  if (cfg.table === "music") {
    payload.album = title;
    if (addModalState.favorite === "Yes") {
      payload.recommend = "Yes";
      payload.status = "Favorite";
    }
  } else {
    payload.title = title;
    payload.favorite = addModalState.favorite;
  }

  payload[cfg.creatorKey] = creator || "Unknown";
  payload[cfg.yearKey] = year || "";

  const btn = document.getElementById("btn-submit-add");
  btn.disabled = true;

  const { data, error } = await supabase.from(cfg.table).insert([payload]).select();
  btn.disabled = false;

  if (error) {
    alert("Error adding title: " + error.message);
  } else {
    closeAddModal();
    await fetchSectionTabItems(catId);
    if (data && data.length > 0) {
      const inserted = data[0];
      if (!shelfState[catId].items.find(i => i.id === inserted.id)) {
        shelfState[catId].items.unshift(inserted);
      }
      openDetailModal(catId, inserted.id);
    }
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
