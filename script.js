// Main application logic
class DeviceStatusApp {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.lastRefresh = new Date();
        this.refreshInterval = null;
        this.loading = false;
        
        // Pagination and filtering
        this.currentPage = 1;
        this.entriesPerPage = 5;
        this.searchTerm = '';
        this.gatewayFilters = new Set(['all']);
        
        this.initializeElements();
        this.bindEvents();
        this.fetchData();
        this.startAutoRefresh();
    }

    initializeElements() {
        this.loadingEl = document.getElementById('loading');
        this.errorEl = document.getElementById('error');
        this.tableContainer = document.getElementById('table-container');
        this.tableBody = document.getElementById('table-body');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.lastUpdatedEl = document.getElementById('last-updated');
        this.tooltip = document.getElementById('tooltip');
        
        // DataTable controls
        this.searchInput = document.getElementById('search-input');
        this.filterBtn = document.getElementById('filter-btn');
        this.filterDropdown = document.getElementById('filter-dropdown');
        this.gatewayFiltersEl = document.getElementById('gateway-filters');
        
        // Pagination controls
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.pageNumbers = document.getElementById('page-numbers');
        // this.entriesSelect = document.getElementById('entries-select');
        this.entriesInfo = document.getElementById('entries-info');
    }

    bindEvents() {
        this.refreshBtn.addEventListener('click', () => this.fetchData());
        
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.filterAndRenderData();
        });
        
        // Filter functionality
        this.filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFilterDropdown();
        });
        
        // Pagination
        this.prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        // this.entriesSelect.addEventListener('change', (e) => {
        //     this.entriesPerPage = parseInt(e.target.value);
        //     this.currentPage = 1;
        //     this.filterAndRenderData();
        // });
        
        // Hide tooltip and filter dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.status-badge')) {
                this.hideTooltip();
            }
            if (!e.target.closest('.filter-container')) {
                this.hideFilterDropdown();
            }
        });
    }

    async fetchData() {
        if (this.loading) return;
        
        this.setLoading(true);
        this.hideError();
        
        try {
            // API endpoint for site device status
            const response = await fetch('https://localhost:44325/api/Sites/SiteIPStatus', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.data = result;
            this.lastRefresh = new Date();
            this.updateLastRefreshDisplay();
            this.setupGatewayFilters();
            this.filterAndRenderData();
            this.showTable();
        } catch (error) {
            console.error('Failed to fetch device status:', error);
            this.showError();
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.loading = loading;
        this.refreshBtn.disabled = loading;
        
        if (loading) {
            this.refreshBtn.classList.add('loading');
        } else {
            this.refreshBtn.classList.remove('loading');
        }
        
        if (this.data.length === 0) {
            this.loadingEl.style.display = loading ? 'block' : 'none';
        }
    }

    showError() {
        this.errorEl.style.display = 'block';
        this.tableContainer.style.display = 'none';
        this.loadingEl.style.display = 'none';
    }

    hideError() {
        this.errorEl.style.display = 'none';
    }

    showTable() {
        this.tableContainer.style.display = 'block';
        this.loadingEl.style.display = 'none';
    }

    updateLastRefreshDisplay() {
        const str = new Date().toLocaleString('en-US', { timeZone: 'Asia/calcutta' });

        var regiontime = new Date(str);
        this.lastUpdatedEl.innerHTML = `<b>Last updated:</b> ${moment(regiontime).format('DD-MM-YYYY HH:mm:ss')}`;
    }

    setupGatewayFilters() {
        const gatewayTypes = [...new Set(this.data.map(site => site.gateway_type))];
        this.gatewayFiltersEl.innerHTML = gatewayTypes.map(type => `
            <label><input type="checkbox" value="${type}" checked> ${type}</label>
        `).join('');
        
        // Add event listeners for filter checkboxes
        this.gatewayFiltersEl.addEventListener('change', (e) => {
            this.updateGatewayFilters();
        });
        
        // All checkbox handler
        const allCheckbox = this.filterDropdown.querySelector('input[value="all"]');
        allCheckbox.addEventListener('change', (e) => {
            const checkboxes = this.gatewayFiltersEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            this.updateGatewayFilters();
        });
    }

    updateGatewayFilters() {
        const allCheckbox = this.filterDropdown.querySelector('input[value="all"]');
        const gatewayCheckboxes = this.gatewayFiltersEl.querySelectorAll('input[type="checkbox"]:checked');
        
        if (gatewayCheckboxes.length === 0) {
            this.gatewayFilters = new Set(['all']);
            allCheckbox.checked = true;
        } else {
            this.gatewayFilters = new Set(Array.from(gatewayCheckboxes).map(cb => cb.value));
            allCheckbox.checked = gatewayCheckboxes.length === this.gatewayFiltersEl.querySelectorAll('input[type="checkbox"]').length;
        }
        
        this.currentPage = 1;
        this.filterAndRenderData();
    }

    filterAndRenderData() {
        // Apply search and gateway filters
        this.filteredData = this.data.filter(site => {
            const matchesSearch = this.searchTerm === '' || 
                site.site_name.toLowerCase().includes(this.searchTerm) ||
                site.site_code.toLowerCase().includes(this.searchTerm) ||
                site.gateway_type.toLowerCase().includes(this.searchTerm);
            
            const matchesFilter = this.gatewayFilters.has('all') || 
                this.gatewayFilters.has(site.gateway_type);
            
            return matchesSearch && matchesFilter;
        });
        
        this.renderTable();
        this.renderPagination();
    }

    renderTable() {
        if (this.filteredData.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">No sites found</td>
                </tr>
            `;
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.entriesPerPage;
        const endIndex = startIndex + this.entriesPerPage;
        const paginatedData = this.filteredData.slice(startIndex, endIndex);

        this.tableBody.innerHTML = paginatedData.map((site, index) => `
            <tr>
                <td class="site-name">${site.site_name}</td>
                <td class="site-code">${site.site_code}</td>
                <td>${site.gateway_type}</td>
                <td>
                    ${this.createStatusCell(site.aggregator_ip, site.aggregator_status, site.aggregator_pinged_on, 'Aggregator')}
                </td>
                <td>
                    ${this.createStatusCell(site.cabina_controller_ip, site.cabina_controller_status, site.cabina_pinged_on, 'Cabin A Controller')}
                </td>
                <td>
                    ${this.createStatusCell(site.cabinb_controller_ip, site.cabinb_controller_status, site.cabinb_pinged_on, 'Cabin B Controller')}
                </td>
                <td>
                    ${this.createStatusCell(site.router_ip, site.router_status, site.router_pinged_on, 'Router')}
                </td>
                <td>
                    ${this.createStatusCell(site.poc3_ip, site.poc3_status, site.poc3_pinged_on, 'POC3')}
                </td>
                <td>
                    ${this.createAliveSignalCell(site.aggregator_alive_status, site.aggregator_hash_key, site.aggregator_alive_last_received_on, site.aggregator_device_id)}
                </td>
            </tr>
        `).join('');

        // Add event listeners for tooltips
        this.addTooltipListeners();
    }

    createStatusCell(ip, status, pingedOn, deviceName) {
        if (!ip) {
            return `<div class="status-badge status-no-ip">No IP</div>`;
        }

        const statusClass = this.getStatusClass(status);
        const statusIcon = this.getStatusIcon(status);
        
        return `
            <div class="status-badge ${statusClass}" 
                 data-device="${deviceName}"
                 data-status="${status}"
                 data-pinged="${pingedOn}"
                 data-type="device">
                <span class="status-icon">${statusIcon}</span>
                <span>${ip}</span>
            </div>
        `;
    }

    createAliveSignalCell(aliveStatus, hashKey, receivedOn, aggregator_device_id) {
        if (aliveStatus === null || aliveStatus === undefined) {
            return `<div class="status-badge status-no-ip">No Signal</div>`;
        }

        const statusClass = this.getStatusClass(aliveStatus);
        const statusIcon = this.getStatusIcon(aliveStatus);
        
        return `
            <div class="status-badge ${statusClass}" 
                 data-device="Alive Signal"
                 data-status="${aliveStatus}"
                 data-hash="${hashKey || 'N/A'}"
                 data-received="${receivedOn}"
                 data-type="alive">
                <span class="status-icon">${statusIcon}</span>
                <span>${aggregator_device_id}</span>
            </div>
        `;
    }

    getStatusClass(status) {
        if (status === 1 || status) return 'status-alive';
        if (status === 0 || !status) return 'status-down';
        return 'status-unknown';
    }

    getStatusIcon(status) {
        if (status === 1 || status) return '📶';
        if (status === 0 || !status) return '📵';
        return '🔍';
    }

    addTooltipListeners() {
        const statusBadges = document.querySelectorAll('.status-badge');
        statusBadges.forEach(badge => {
            badge.addEventListener('mouseenter', (e) => this.showTooltip(e));
            badge.addEventListener('mouseleave', () => this.hideTooltip());
            badge.addEventListener('click', (e) => this.toggleTooltip(e));
        });
    }

    showTooltip(event) {
        const badge = event.currentTarget;
        const deviceName = badge.dataset.device;
        const status = badge.dataset.status;
        const type = badge.dataset.type;

        if (!deviceName) return;

        
        
        
        
        if (type === 'alive') {
            const hashKey = badge.dataset.hash;
            const receivedOn = badge.dataset.received;
            const formattedTime = this.formatPingTime(receivedOn);
            const isAlive = String(status).trim().toLowerCase() === 'true' || status === true;
            var statusText = isAlive ? 'Alive' :  'Down';
            this.tooltip.querySelector('.tooltip-pinged').textContent = `Received On: ${formattedTime}`;
            this.tooltip.querySelector('.tooltip-hash').textContent = `Hash Key: ${hashKey}`;
        } else {
            const pingedOn = badge.dataset.pinged;
            const formattedTime = this.formatPingTime(pingedOn);
            var statusText = status === '1' ? 'Alive' : status === '0' ? 'Down' : 'Unknown';
            this.tooltip.querySelector('.tooltip-pinged').textContent = `Pinged On: ${formattedTime}`;
            this.tooltip.querySelector('.tooltip-hash').textContent = '';
        }

        this.tooltip.querySelector('.tooltip-title').textContent = deviceName;
        this.tooltip.querySelector('.tooltip-status').textContent = `Status: ${statusText}`;

        this.positionTooltip(badge);
    }

    positionTooltip(badge) {
        const rect = badge.getBoundingClientRect();
        
        // Show tooltip to calculate dimensions
        this.tooltip.style.display = 'block';
        this.tooltip.style.visibility = 'hidden';
        
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 12; // Account for arrow

        // Adjust if tooltip goes off screen
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        // If tooltip goes off top, show below
        if (top < 8) {
            top = rect.bottom + 12;
            this.tooltip.querySelector('.tooltip-arrow').style.display = 'none';
        } else {
            this.tooltip.querySelector('.tooltip-arrow').style.display = 'block';
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.visibility = 'visible';
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    toggleTooltip(event) {
        if (this.tooltip.style.display === 'block') {
            this.hideTooltip();
        } else {
            this.showTooltip(event);
        }
    }

    formatPingTime(timestamp) {
        if (!timestamp) return 'Unknown';
        try {
            return moment(timestamp).format('DD-MM-YYYY HH:mm:ss');
        } catch {
            return 'Invalid date';
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.fetchData();
        }, 30000); // 30 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Filter dropdown methods
    toggleFilterDropdown() {
        const isVisible = this.filterDropdown.style.display === 'block';
        this.filterDropdown.style.display = isVisible ? 'none' : 'block';
    }

    hideFilterDropdown() {
        this.filterDropdown.style.display = 'none';
    }

    // Pagination methods
    renderPagination() {
        const totalEntries = this.filteredData.length;
        const totalPages = Math.ceil(totalEntries / this.entriesPerPage);
        const startEntry = totalEntries === 0 ? 0 : (this.currentPage - 1) * this.entriesPerPage + 1;
        const endEntry = Math.min(this.currentPage * this.entriesPerPage, totalEntries);

        // Update entries info
        this.entriesInfo.textContent = `Showing ${startEntry} to ${endEntry} of ${totalEntries} entries`;

        // Update pagination buttons
        this.prevBtn.disabled = this.currentPage === 1;
        this.nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;

        // Generate page numbers
        this.renderPageNumbers(totalPages);
    }

    renderPageNumbers(totalPages) {
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        let pagesHTML = '';

        // First page and ellipsis
        if (startPage > 1) {
            pagesHTML += `<span class="page-number" onclick="app.goToPage(1)">1</span>`;
            if (startPage > 2) {
                pagesHTML += `<span class="page-ellipsis">...</span>`;
            }
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            pagesHTML += `<span class="page-number ${activeClass}" onclick="app.goToPage(${i})">${i}</span>`;
        }

        // Last page and ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pagesHTML += `<span class="page-ellipsis">...</span>`;
            }
            pagesHTML += `<span class="page-number" onclick="app.goToPage(${totalPages})">${totalPages}</span>`;
        }

        this.pageNumbers.innerHTML = pagesHTML;
    }

    goToPage(pageNumber) {
        const totalPages = Math.ceil(this.filteredData.length / this.entriesPerPage);
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            this.currentPage = pageNumber;
            this.renderTable();
            this.renderPagination();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DeviceStatusApp();
});

// Logout button functionality
document.getElementById('logout-btn').addEventListener('click', () => {
    // if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('isLoggedIn'); // Clear login state
        window.location.href = 'login.html';   // Redirect to login
    // }
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const userId = document.getElementById('user-id').value;
    const password = document.getElementById('password').value;

    const validUserId = 'Admin';
    const validPassword = 'Admin@123';

    if (userId === validUserId && password === validPassword) {
        // Set login status in localStorage
        localStorage.setItem('isLoggedIn', true);
        window.location.href = 'index.html';
    } else {
        document.getElementById('error-message').textContent = 'Invalid credentials. Please try again.';
    }
});

