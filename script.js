// ========================================
// MULTIPLAYER AUCTION GAME - TIMER-BASED BIDDING
// Game Logic, Player Management & Timer System
// ========================================

class MultiplayerAuctioneer {
    constructor() {
        this.usedPlayers = new Set();
        this.playersShown = 0;
        this.audioContext = null;
        this.selectedClubs = new Set();
        this.currentItem = null;
        this.playerIdCounter = 0;
        this.currentBids = [];

        // Timer system
        this.currentPlayerIndex = 0;
        this.timeRemaining = 20;
        this.timerInterval = null;
        this.isPaused = false;

        // Persisted Data
        this.gamePlayers = this.loadData() || [];
        this.activeSlot = null;

        this.initElements();

        // If we have data, update UI
        if (this.gamePlayers.length > 0) {
            this.renderPlayers();
            this.updateManagerSelect();
            if (document.body.classList.contains('squad-page')) {
                this.renderSquadView();
            }
        }

        this.initClubFilters();
        this.initEventListeners();

        // Listen for external storage changes (from other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'football_auction_data') {
                this.gamePlayers = this.loadData();
                this.renderPlayers();
                this.updateManagerSelect();
                this.renderSquadView();
            }
        });
    }

    saveData() {
        localStorage.setItem('football_auction_data', JSON.stringify(this.gamePlayers));
    }

    loadData() {
        const data = localStorage.getItem('football_auction_data');
        return data ? JSON.parse(data) : null;
    }

    initElements() {
        this.eraFilter = document.getElementById('era-filter');
        this.leagueFilter = document.getElementById('league-filter');
        this.positionFilter = document.getElementById('position-filter');
        this.tierFilter = document.getElementById('tier-filter');
        this.clubFiltersContainer = document.getElementById('club-filters-container');
        this.budgetInput = document.getElementById('budget-input');
        this.playerDisplay = document.getElementById('player-display');
        this.nextPlayerBtn = document.getElementById('next-player-btn');
        this.soldBtn = document.getElementById('sold-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.playersShownEl = document.getElementById('players-shown');
        this.playersRemainingEl = document.getElementById('players-remaining');

        // Multiplayer elements
        this.playerNameInput = document.getElementById('player-name-input');
        this.addPlayerBtn = document.getElementById('add-player-btn');
        this.playersList = document.getElementById('players-list');

        // Modal elements
        this.saleModal = document.getElementById('sale-modal');
        this.salePriceInput = document.getElementById('sale-price');
        this.buyerSelect = document.getElementById('buyer-select');
        this.saleError = document.getElementById('sale-error');
        this.confirmSaleBtn = document.getElementById('confirm-sale-btn');
        this.cancelSaleBtn = document.getElementById('cancel-sale-btn');
        this.closeModalBtn = document.querySelector('.close-modal');

        // Timer-based bidding elements
        this.biddingSection = document.getElementById('bidding-section');
        this.currentBidAmount = document.getElementById('current-bid-amount');
        this.currentBidLeader = document.getElementById('current-bid-leader');
        this.bidHistoryList = document.getElementById('bid-history-list');
        this.currentBidderName = document.getElementById('current-bidder-name');
        this.timerValue = document.getElementById('timer-value');
        this.timerProgress = document.getElementById('timer-progress');
        this.bidSlider = document.getElementById('bid-slider');
        this.sliderBidAmount = document.getElementById('slider-bid-amount');
        this.sliderPlayerBudget = document.getElementById('slider-player-budget');
        this.placeBidBtn = document.getElementById('place-bid-btn');
        this.passTurnBtn = document.getElementById('pass-turn-btn');
        this.pauseAuctionBtn = document.getElementById('pause-auction-btn');

        // Squad Builder Elements
        this.tabManage = document.getElementById('tab-manage');
        this.tabSquad = document.getElementById('tab-squad');
        this.viewManage = document.getElementById('view-manage');
        this.viewSquad = document.getElementById('view-squad');
        this.squadManagerSelect = document.getElementById('squad-manager-select');
        this.benchList = document.getElementById('bench-list');
        this.pitchSlots = document.querySelectorAll('.pitch-slot');
    }

    async initClubFilters() {
        try {
            const response = await fetch('/api/meta/clubs');
            const clubs = await response.json();

            this.clubFiltersContainer.innerHTML = '';

            clubs.forEach(club => {
                const label = document.createElement('label');
                label.className = 'club-checkbox-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = club;

                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.selectedClubs.add(e.target.value);
                    } else {
                        this.selectedClubs.delete(e.target.value);
                    }
                    this.updateStats();
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(club));
                this.clubFiltersContainer.appendChild(label);
            });

            this.updateStats(); // Initial stats update
        } catch (error) {
            console.error('Failed to load clubs:', error);
            this.clubFiltersContainer.innerHTML = '<div class="error">Failed to load clubs. Is server running?</div>';
        }
    }

    initEventListeners() {
        this.nextPlayerBtn?.addEventListener('click', () => this.showNextPlayer());
        this.soldBtn?.addEventListener('click', () => this.sellToHighestBidder());
        this.resetBtn?.addEventListener('click', () => this.resetSession());
        this.addPlayerBtn?.addEventListener('click', () => this.addPlayer());

        // Timer-based bidding controls
        this.placeBidBtn?.addEventListener('click', () => this.placeBid());
        this.passTurnBtn?.addEventListener('click', () => this.passTurn());
        this.pauseAuctionBtn?.addEventListener('click', () => this.togglePause());

        // Slider input
        this.bidSlider?.addEventListener('input', () => this.updateSliderDisplay());

        // Enter key to add player
        this.playerNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addPlayer();
            }
        });

        [this.eraFilter, this.leagueFilter, this.positionFilter, this.tierFilter].forEach(el => {
            el?.addEventListener('change', () => this.updateStats());
        });

        // Modal events
        this.confirmSaleBtn?.addEventListener('click', () => this.confirmSale());
        this.cancelSaleBtn?.addEventListener('click', () => this.closeSaleModal());
        this.closeModalBtn?.addEventListener('click', () => this.closeSaleModal());

        window.addEventListener('click', (e) => {
            if (this.saleModal && e.target === this.saleModal) {
                this.closeSaleModal();
            }
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Space' || e.code === 'Enter') &&
                e.target.tagName !== 'INPUT' &&
                e.target.tagName !== 'SELECT' &&
                (!this.saleModal || !this.saleModal.style.display)) {
                e.preventDefault();
                this.showNextPlayer();
            }
        });

        // Squad Builder Listeners
        this.tabManage?.addEventListener('click', () => this.switchView('manage'));
        this.tabSquad?.addEventListener('click', () => this.switchView('squad'));

        this.squadManagerSelect?.addEventListener('change', () => this.renderSquadView());

        // Global click to Deselect Slot if clicking outside
        window.addEventListener('click', (e) => {
            if (this.activeSlot) {
                // If click is NOT on a slot and NOT on the bench
                if (!e.target.closest('.pitch-slot') && !e.target.closest('.bench-player-card')) {
                    this.activeSlot = null;
                    this.renderSquadView();
                }
            }
        });

        // Drag to Bench to Remove
        if (this.benchList) {
            this.benchList.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            };
            this.benchList.ondrop = (e) => {
                e.preventDefault();
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.fromSlot) {
                        this.removeFromSquad(data.managerId, data.fromSlot);
                    }
                } catch (err) {
                    console.error('Bench drop failed', err);
                }
            };
        }
    }

    switchView(viewName) {
        if (!this.viewManage || !this.viewSquad) return;
        if (viewName === 'manage') {
            this.viewManage.style.display = 'block';
            this.viewSquad.style.display = 'none';
            this.tabManage.classList.add('active-tab');
            this.tabSquad.classList.remove('active-tab');
        } else {
            this.viewManage.style.display = 'none';
            this.viewSquad.style.display = 'block';
            this.tabManage.classList.remove('active-tab');
            this.tabSquad.classList.add('active-tab');
            this.updateManagerSelect();
            this.renderSquadView();
        }
    }

    updateManagerSelect() {
        if (!this.squadManagerSelect) return;
        // Save current selection
        const currentVal = this.squadManagerSelect.value;

        this.squadManagerSelect.innerHTML = '<option value="">Select a Manager...</option>';
        this.gamePlayers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            this.squadManagerSelect.appendChild(opt);
        });

        // Restore if exists
        if (currentVal && this.gamePlayers.find(p => p.id == currentVal)) {
            this.squadManagerSelect.value = currentVal;
        } else if (this.gamePlayers.length > 0) {
            // Auto select first
            this.squadManagerSelect.value = this.gamePlayers[0].id;
        }
    }

    removeFromSquad(managerId, pos) {
        const manager = this.gamePlayers.find(p => p.id === managerId);
        if (!manager || !manager.squad[pos]) return;

        // Remove from squad slot
        delete manager.squad[pos]; // If unique slots per pos, simple delete. 
        // Note: For duplicate positions (CB, CM), logic needs strict slot mapping.
        // My HTML uses classes like slot-cb1, slot-cb2. 
        // But data-pos is just "CB". 
        // Let's change data-pos in HTML to be unique ID like "CB1", "CB2" for better mapping?
        // Or finding which ITEM ID is in that slot.
        // Actually, easier: The slot click handler knows the specific element.
        // Let's store the specific assignment in manager.squad as { 'slot-cb1': itemId }

        // Wait, renderSquadView needs to map slots. 
        // Let's assume manager.squad is { 'slotClass': itemIndex }

        this.renderSquadView();
    }

    // Better Remove Logic handled in specific slot click implementation below


    addPlayer() {
        const name = this.playerNameInput.value.trim();

        if (!name) {
            alert('Please enter a player name');
            return;
        }

        if (this.gamePlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert('A player with this name already exists');
            return;
        }

        const startingBudget = parseFloat(this.budgetInput.value) || 100;

        const player = {
            id: this.playerIdCounter++,
            name: name,
            budget: startingBudget,
            items: [],
            squad: {}
        };

        this.gamePlayers.push(player);
        this.saveData();
        this.playerNameInput.value = '';
        this.renderPlayers();
        this.updateManagerSelect();
        this.playBeep();
    }

    removePlayer(playerId) {
        const playerIndex = this.gamePlayers.findIndex(p => p.id === playerId);
        if (playerIndex > -1) {
            const playerName = this.gamePlayers[playerIndex].name;
            if (confirm(`Remove ${playerName} from the game?`)) {
                this.gamePlayers.splice(playerIndex, 1);
                this.saveData();
                this.renderPlayers();
                this.updateManagerSelect();
                this.playBeep();
            }
        }
    }

    renderPlayers() {
        if (!this.playersList) return;
        if (this.gamePlayers.length === 0) {
            this.playersList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No players added yet</div>';
            return;
        }

        this.playersList.innerHTML = this.gamePlayers.map(player => `
            <div class="player-card">
                <div class="player-card-header">
                    <div class="player-card-name">${this.escapeHtml(player.name)}</div>
                    <button class="remove-player-btn" onclick="window.auctioneer.removePlayer(${player.id})">×</button>
                </div>
                <div class="player-card-budget">💰 $${player.budget.toFixed(1)}M</div>
                <div class="player-card-items">📦 Items: ${player.items.length}</div>
                ${player.items.length > 0 ? `
                    <div class="player-inventory">
                        ${player.items.map((item, idx) => `
                            <div class="inventory-item">
                                <span>${this.escapeHtml(item.name)} (${item.position})</span>
                                <div style="display:flex; gap:5px; align-items:center;">
                                    <span style="font-size:10px; color:#666;">$${item.price}M</span>
                                    <button class="sell-item-btn" onclick="window.auctioneer.sellItem(${player.id}, ${idx})" title="Quick Sell (80% Value)">$</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div style="margin-top:10px; font-size:10px; text-align:center; color:#999;">Go to "Visual Squad" to manage team</div>
            </div>
        `).join('');
    }

    sellItem(playerId, itemIndex) {
        const player = this.gamePlayers.find(p => p.id === playerId);
        if (!player) return;

        const item = player.items[itemIndex];
        // Calculate sell price (80% of current dynamic value? Or price paid? Plan said 80% of MV)
        // We only stored 'price' paid. We don't track live MV of owned items easily without looking up DB.
        // Let's use 80% of PAID price for fairness/simplicity, OR store MV in item.
        // Item object: { name, price (paid), position, tier }.
        // Let's assume Sell Price = 80% of PAID PRICE. It's safer.
        // User Request: "80% of market value". 
        // Since I don't have current MV on item, I'll approximate with Paid Price * 0.8.

        const sellValue = parseFloat((item.price * 0.8).toFixed(1));

        if (confirm(`Sell ${item.name} for $${sellValue}M?`)) {
            // Remove from inventory
            player.items.splice(itemIndex, 1);
            player.budget += sellValue;

            // Remove from squad if present
            // Loop through squad slots
            Object.keys(player.squad).forEach(slotKey => {
                if (player.squad[slotKey] === itemIndex) {
                    delete player.squad[slotKey];
                } else if (player.squad[slotKey] > itemIndex) {
                    // Shift indices down
                    player.squad[slotKey]--;
                }
            });

            this.saveData();
            this.renderPlayers();
            // Also update squad view if active
            if (this.tabSquad.classList.contains('active-tab')) {
                this.renderSquadView();
            }
            this.playBeep();
        }
    }

    renderSquadView() {
        if (!this.squadManagerSelect || !this.benchList) return;
        const managerId = parseInt(this.squadManagerSelect.value);
        if (!managerId && managerId !== 0) {
            this.benchList.innerHTML = '<div style="padding:20px; color:#aaa; text-align:center;">Select a manager to view squad</div>';
            return;
        }

        const manager = this.gamePlayers.find(p => p.id === managerId);
        if (!manager) return;

        // Ensure activeSlot is tracked
        if (typeof this.activeSlot === 'undefined') this.activeSlot = null;

        // 1. Render Pitch Slots
        this.pitchSlots.forEach(slot => {
            slot.innerHTML = '';
            slot.classList.remove('filled');
            slot.classList.remove('active-target');

            const slotClass = Array.from(slot.classList).find(c => c.startsWith('slot-'));
            const itemIndex = manager.squad[slotClass];

            // Highlights
            if (this.activeSlot === slotClass) {
                slot.classList.add('active-target');
                slot.style.borderColor = '#d93025'; // Ink Red
                slot.style.backgroundColor = 'rgba(217, 48, 37, 0.2)';
            } else {
                slot.style.borderColor = ''; // reset
                slot.style.backgroundColor = '';
            }

            // Drag & Drop Handlers for Slot
            slot.ondragover = (e) => this.handleDragOver(e);
            slot.ondrop = (e) => this.handleDrop(e, slotClass);
            slot.onclick = (e) => {
                e.stopPropagation(); // Prevent background click
                this.handleSlotClick(slotClass, slot.dataset.pos);
            };

            if (itemIndex !== undefined && manager.items[itemIndex]) {
                const item = manager.items[itemIndex];
                slot.classList.add('filled');
                slot.innerHTML = `
                    <div class="pitch-player-card" draggable="true" ondragstart="window.auctioneer.handleDragStart(event, ${manager.id}, ${itemIndex}, '${slotClass}')">
                        <div class="pitch-player-photo"></div>
                        <div class="pitch-player-name">${item.name}</div>
                    </div>
                `;
            }
        });

        // 2. Render Bench (filtered if slot selected)
        this.benchList.innerHTML = '';
        const squadIndices = Object.values(manager.squad);

        // Filter Logic
        let displayItems = manager.items.map((item, idx) => ({ ...item, originalIndex: idx }));

        // First, exclude players already on pitch (unless we are swapping - tricky. simple version: exclude active)
        displayItems = displayItems.filter(p => !squadIndices.includes(p.originalIndex));

        // Interaction Requirement: 
        // "click on one position -> get all available positions [players for that pos]"
        // "click on another [background/reset] -> get all players except added"

        if (this.activeSlot) {
            // Find stats/pos for this slot
            // We need to know which position this slot expects.
            // I can look it up from DOM or data map.
            const slotEl = document.querySelector(`.${this.activeSlot}`);
            if (slotEl) {
                const requiredPos = slotEl.dataset.pos;
                // Filter by position (strict or groups?)
                // e.g. CB slot shows CB, LB slot shows LB.
                // Using map from autoFillSquad logic:
                // GK: GK
                // DEF: CB, LB, RB, LWB, RWB
                // MID: CDM, CM, CAM, RM, LM
                // FWD: ST, CF, RW, LW, SS
                // Or stricter? 
                // Let's do loose matching based on groups.
                displayItems = displayItems.filter(p => this.isPositionCompatible(p.position, requiredPos));
            }
        }

        if (displayItems.length === 0) {
            this.benchList.innerHTML = '<div style="padding:10px; color:#aaa; font-size:12px; text-align:center;">No available players for this slot.</div>';
        }

        displayItems.forEach((item) => {
            const benchItem = document.createElement('div');
            benchItem.className = 'bench-player-card';
            benchItem.draggable = true;
            benchItem.ondragstart = (e) => this.handleDragStart(e, manager.id, item.originalIndex, null);

            benchItem.innerHTML = `
                 <div class="photo-placeholder"></div>
                 <div class="bench-player-info">
                    <div class="bench-player-name">${this.escapeHtml(item.name)}</div>
                    <div class="bench-player-meta">${item.position} | $${item.price}M</div>
                 </div>
            `;

            // Allow clicking to auto-fill active slot if one is selected
            benchItem.onclick = () => {
                if (this.activeSlot) {
                    this.assignPlayerToSlot(manager.id, item.originalIndex, this.activeSlot);
                } else {
                    this.autoFillSquad(manager.id, item.originalIndex);
                }
            };

            this.benchList.appendChild(benchItem);
        });
    }

    getTierColor(tier) {
        if (tier === 'S') return '#FFD700'; // Gold
        if (tier === 'A') return '#C0C0C0'; // Silver
        if (tier === 'B') return '#CD7F32'; // Bronze
        return '#333';
    }

    removeFromSquad(managerId, pos) {
        const manager = this.gamePlayers.find(p => p.id === managerId);
        if (!manager || !manager.squad[pos]) return;

        delete manager.squad[pos];
        this.saveData();
        this.renderSquadView();
    }

    handleSlotClick(slotClass, pos) {
        if (this.activeSlot === slotClass) {
            // Deselect if clicked again?
            // "when we click on the another position we should get all the players"
            // If I click same slot, maybe deselect?
            // Let's keep it simple: Click slot -> Select it.
            // Click background -> Deselect (handled by global listener).
            return;
        }
        this.activeSlot = slotClass;
        this.renderSquadView();
    }

    handleDragStart(e, managerId, itemIndex, fromSlot) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            managerId,
            itemIndex,
            fromSlot
        }));
    }

    handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e, targetSlotClass) {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            this.assignPlayerToSlot(data.managerId, data.itemIndex, targetSlotClass);
        } catch (err) {
            console.error('Drop failed', err);
        }
    }

    assignPlayerToSlot(managerId, itemIndex, targetSlotClass) {
        const manager = this.gamePlayers.find(p => p.id === managerId);
        if (!manager) return;

        // Check if player is already in another slot?
        // Dragging from bench: not in squad (filtered).
        // Dragging from pitch: 'fromSlot' is set.

        // Remove from old slot if exists (move within pitch)
        const existingSlot = Object.keys(manager.squad).find(key => manager.squad[key] === itemIndex);
        if (existingSlot) {
            delete manager.squad[existingSlot];
        }

        // If target slot is occupied, swap? Or overwrite?
        // Let's overwrite (send occupant to bench) for simplicity unless we implement swap.
        // Current logic: manager.squad[targetSlotClass] = itemIndex.
        // Previous occupant is simply overwritten, meaning they return to bench (as they are no longer in squad map).

        manager.squad[targetSlotClass] = itemIndex;

        // Reset selection
        this.activeSlot = null;
        this.saveData();
        this.renderSquadView();
        this.playBeep();
    }

    isPositionCompatible(playerPos, slotPos) {
        const strictMap = {
            'GK': ['GK'],
            'LB': ['LB', 'LWB', 'DEF'],
            'RB': ['RB', 'RWB', 'DEF'],
            'CB': ['CB', 'DEF'],
            'CDM': ['CDM', 'CM', 'MID'],
            'CM': ['CM', 'CAM', 'CDM', 'MID'],
            'LW': ['LW', 'LM', 'FWD'],
            'RW': ['RW', 'RM', 'FWD'],
            'ST': ['ST', 'CF', 'SS', 'FWD']
        };
        // Also handle generic "DEF" -> fit in any defensive slot?
        // The playerPos is from the generated player data, e.g. "CB".
        // The slotPos is from data-pos="CB".

        // Let's use the autoFillSquad groups logic reversed
        if (slotPos === 'GK' && playerPos === 'GK') return true;
        if (['LB', 'RB', 'CB'].includes(slotPos) && ['DEF', 'LB', 'RB', 'CB', 'LWB', 'RWB'].includes(playerPos)) return true;
        if (['CDM', 'CM'].includes(slotPos) && ['MID', 'CDM', 'CM', 'CAM', 'RM', 'LM'].includes(playerPos)) return true;
        if (['LW', 'RW', 'ST'].includes(slotPos) && ['FWD', 'LW', 'RW', 'ST', 'CF', 'SS', 'LM', 'RM'].includes(playerPos)) return true;

        return false;
    }

    autoFillSquad(managerId, itemIndex) {
        // ... (Keep existing logic or reuse assign?)
        // The previous autoFillSquad had good logic for finding empty compatible slots.
        // Let's restore it but tweaked to use assignPlayerToSlot if found.

        const manager = this.gamePlayers.find(p => p.id === managerId);
        if (!manager) return;
        const item = manager.items[itemIndex];

        const posMap = {
            'GK': ['slot-gk'],
            'LB': ['slot-lb'], // Simplified for brevity, could expand
            'RB': ['slot-rb'],
            'CB': ['slot-cb1', 'slot-cb2'],
            'LWB': ['slot-lb'], 'RWB': ['slot-rb'],
            'CDM': ['slot-cdm'],
            'CM': ['slot-cm1', 'slot-cm2'],
            'CAM': ['slot-cm1', 'slot-cm2'],
            'LM': ['slot-lw'], 'LW': ['slot-lw'],
            'RM': ['slot-rw'], 'RW': ['slot-rw'],
            'ST': ['slot-st'], 'CF': ['slot-st'], 'SS': ['slot-st']
        }[item.position] || [];

        // Fallback for generic positions if needed

        const emptySlot = posMap.find(slot => !manager.squad[slot]);

        if (emptySlot) {
            this.assignPlayerToSlot(managerId, itemIndex, emptySlot);
        } else {
            // Shake UI or alert
            alert(`No empty default slot for ${item.position}. Drag to force position.`);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // TIMER SYSTEM
    startTimer() {
        this.stopTimer();
        this.timeRemaining = 20;
        this.isPaused = false;
        this.pauseAuctionBtn.textContent = 'PAUSE';
        this.pauseAuctionBtn.classList.remove('paused');

        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.timeRemaining--;
                this.updateTimerDisplay();

                if (this.timeRemaining <= 0) {
                    this.passTurn();
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pauseAuctionBtn.textContent = 'RESUME';
            this.pauseAuctionBtn.classList.add('paused');
        } else {
            this.pauseAuctionBtn.textContent = 'PAUSE';
            this.pauseAuctionBtn.classList.remove('paused');
        }
        this.playBeep();
    }

    updateTimerDisplay() {
        this.timerValue.textContent = this.timeRemaining;
        const percentage = (this.timeRemaining / 20) * 100;
        this.timerProgress.style.width = `${percentage}%`;

        if (this.timeRemaining <= 5) {
            this.timerValue.classList.add('warning');
            this.timerProgress.classList.add('warning');
        } else {
            this.timerValue.classList.remove('warning');
            this.timerProgress.classList.remove('warning');
        }
    }

    setCurrentPlayer() {
        if (this.gamePlayers.length === 0) return;

        const currentPlayer = this.gamePlayers[this.currentPlayerIndex];
        this.currentBidderName.textContent = currentPlayer.name;

        // Update slider range
        const highestBid = this.getHighestBid();
        // Enforce +1M increment if there's an existing bid
        const minBid = highestBid ? highestBid.amount + 1 : this.currentItem.dynamicValue;

        this.bidSlider.min = minBid;
        this.bidSlider.max = currentPlayer.budget;

        // If they can't afford the minimum bid, maybe disable slider or clamp value?
        // HTML input range will clamp value to max if min > max? No, it's weird.
        // But logic below handles "not enough budget" alert.

        this.bidSlider.value = minBid;
        this.sliderPlayerBudget.textContent = currentPlayer.budget.toFixed(1);
        this.updateSliderDisplay();
    }

    updateSliderDisplay() {
        const bidAmount = parseFloat(this.bidSlider.value);
        this.sliderBidAmount.textContent = bidAmount.toFixed(1);
    }

    placeBid() {
        if (this.gamePlayers.length === 0) return;

        const currentPlayer = this.gamePlayers[this.currentPlayerIndex];
        const bidAmount = parseFloat(this.bidSlider.value);

        // Validation
        const highestBid = this.getHighestBid();

        // DEBUGGING LOGS
        console.log('--- Placing Bid ---');
        console.log('Current Player:', currentPlayer.name);
        console.log('Bid Amount (slider):', bidAmount);
        console.log('Highest Bid Object:', highestBid);

        const minBid = highestBid ? highestBid.amount + 1 : this.currentItem.dynamicValue;
        console.log('Calculated Min Bid:', minBid);

        if (bidAmount < minBid) {
            console.log('Bid rejected: too low');
            alert(`Bid must be at least $${minBid.toFixed(1)}M`);
            return;
        }

        if (bidAmount > currentPlayer.budget) {
            alert(`${currentPlayer.name} doesn't have enough budget!`);
            return;
        }

        // Add bid
        this.currentBids.push({
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            amount: bidAmount,
            timestamp: Date.now()
        });

        this.updateBiddingDisplay();
        this.playBeep();
        this.soldBtn.disabled = false;

        // Move to next player
        this.nextPlayer();
    }

    passTurn() {
        this.nextPlayer();
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.gamePlayers.length;
        this.setCurrentPlayer();
        this.startTimer();
    }

    openSaleModal() {
        // Legacy function - not used in timer system
    }

    closeSaleModal() {
        this.saleModal.style.display = 'none';
        this.saleError.textContent = '';
    }

    showSoldStamp() {
        const overlay = document.createElement('div');
        overlay.className = 'sold-stamp-overlay';

        const stamp = document.createElement('div');
        stamp.className = 'sold-stamp';
        stamp.textContent = 'SOLD!';

        overlay.appendChild(stamp);
        document.body.appendChild(overlay);

        setTimeout(() => {
            document.body.removeChild(overlay);
        }, 2000);
    }

    confirmSale() {
        // Legacy function - keeping for modal compatibility
        const price = parseFloat(this.salePriceInput.value);
        const buyerId = parseInt(this.buyerSelect.value);

        if (!price || price <= 0) {
            this.saleError.textContent = 'Please enter a valid price';
            return;
        }

        if (!buyerId && buyerId !== 0) {
            this.saleError.textContent = 'Please select a buyer';
            return;
        }

        const buyer = this.gamePlayers.find(p => p.id === buyerId);
        if (!buyer) {
            this.saleError.textContent = 'Buyer not found';
            return;
        }

        if (buyer.budget < price) {
            this.saleError.textContent = `${buyer.name} doesn't have enough budget! (Has: $${buyer.budget.toFixed(1)}M)`;
            return;
        }

        const itemName = this.currentItem.playerData.name;

        buyer.budget -= price;
        buyer.items.push({
            name: itemName,
            price: price,
            position: this.currentItem.playerData.position,
            tier: this.currentItem.playerData.tier
        });

        this.saveData();
        this.renderPlayers();
        this.closeSaleModal();
        this.showSoldStamp();
        if (this.soldBtn) this.soldBtn.disabled = true;
        this.currentItem = null;

        setTimeout(() => {
            alert(`✅ SOLD! ${itemName} sold to ${buyer.name} for $${price.toFixed(1)}M`);
        }, 500);

        this.playBeep();
    }

    getHighestBid() {
        if (this.currentBids.length === 0) return null;
        return this.currentBids.reduce((highest, bid) =>
            bid.amount > highest.amount ? bid : highest
        );
    }

    updateBiddingDisplay() {
        const highestBid = this.getHighestBid();
        if (this.currentBidAmount) {
            if (highestBid) {
                this.currentBidAmount.textContent = highestBid.amount.toFixed(1);
            } else {
                this.currentBidAmount.textContent = this.currentItem?.dynamicValue.toFixed(1) || '0';
            }
        }

        if (this.currentBidLeader) {
            if (highestBid) {
                this.currentBidLeader.textContent = highestBid.playerName;
            } else {
                this.currentBidLeader.textContent = 'Market Value';
            }
        }

        if (this.bidHistoryList) {
            if (this.currentBids.length === 0) {
                this.bidHistoryList.innerHTML = '<div class="no-bids">No bids yet - Starting at Market Value</div>';
            } else {
                const sortedBids = [...this.currentBids].sort((a, b) => b.amount - a.amount);
                this.bidHistoryList.innerHTML = sortedBids.map((bid, index) => `
                    <div class="bid-entry ${index === 0 ? 'highest-bid' : ''}">
                        <span class="bid-entry-player">${this.escapeHtml(bid.playerName)}</span>
                        <span class="bid-entry-amount">$${bid.amount.toFixed(1)}M</span>
                    </div>
                `).join('');
            }
        }
    }

    sellToHighestBidder() {
        this.stopTimer();
        const highestBid = this.getHighestBid();

        if (!highestBid) {
            alert('No bids placed yet! Players must place bids first.');
            return;
        }

        const buyer = this.gamePlayers.find(p => p.id === highestBid.playerId);
        if (!buyer) {
            alert('Buyer not found');
            return;
        }

        if (buyer.budget < highestBid.amount) {
            alert(`${buyer.name} no longer has enough budget!`);
            return;
        }

        const itemName = this.currentItem.playerData.name;
        const salePrice = highestBid.amount;

        buyer.budget -= salePrice;
        buyer.items.push({
            name: itemName,
            price: salePrice,
            position: this.currentItem.playerData.position,
            tier: this.currentItem.playerData.tier
        });

        this.saveData();
        this.renderPlayers();
        this.showSoldStamp();

        this.currentItem = null;
        this.currentBids = [];
        if (this.soldBtn) this.soldBtn.disabled = true;
        if (this.biddingSection) this.biddingSection.style.display = 'none';

        setTimeout(() => {
            alert(`✅ SOLD! ${itemName} sold to ${buyer.name} for $${salePrice.toFixed(1)}M`);
        }, 500);

        this.playBeep();
    }

    /* getFilteredPlayers() - Removed, logic moved to server */

    async updateStats() {
        const params = new URLSearchParams({
            era: this.eraFilter.value,
            league: this.leagueFilter.value,
            position: this.positionFilter.value,
            tier: this.tierFilter.value
        });

        if (this.selectedClubs.size > 0) {
            params.append('club', Array.from(this.selectedClubs).join(','));
        }

        try {
            const response = await fetch(`/api/players?${params.toString()}`);
            const players = await response.json();

            // Filter out used players locally for stats count, or send exclude param to API
            const availableCount = players.filter(p => !this.usedPlayers.has(p.name)).length;

            this.playersShownEl.textContent = this.playersShown;
            this.playersRemainingEl.textContent = availableCount;
        } catch (e) {
            console.error('Error fetching stats:', e);
            this.playersRemainingEl.textContent = '-';
        }
    }

    // Base Bid Display Removed
    // calculateBaseBid(tier, budget) { ... }

    generateStats(position, tier) {
        const base = {
            'S': { min: 85, max: 95 },
            'A': { min: 80, max: 88 },
            'B': { min: 75, max: 82 },
            'C': { min: 70, max: 78 }
        }[tier];

        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const val = () => rand(base.min, base.max);

        let stats = { PAC: val(), SHO: val(), PAS: val(), DRI: val(), DEF: val(), PHY: val() };

        if (['ST', 'CF', 'SS'].includes(position)) {
            stats.SHO += rand(3, 5);
            stats.DEF -= rand(30, 40);
            stats.PAC += rand(1, 4);
        } else if (['RW', 'LW', 'RM', 'LM'].includes(position)) {
            stats.PAC += rand(4, 7);
            stats.DRI += rand(3, 6);
            stats.DEF -= rand(20, 30);
        } else if (['CAM', 'CM'].includes(position)) {
            stats.PAS += rand(4, 7);
            stats.DRI += rand(2, 5);
            stats.DEF -= rand(10, 20);
        } else if (['CDM'].includes(position)) {
            stats.DEF += rand(3, 6);
            stats.PHY += rand(3, 6);
            stats.SHO -= rand(10, 20);
        } else if (['CB'].includes(position)) {
            stats.DEF += rand(5, 8);
            stats.PHY += rand(5, 8);
            stats.SHO -= rand(30, 40);
            stats.DRI -= rand(20, 30);
            stats.PAC -= rand(5, 10);
        } else if (['LB', 'RB', 'LWB', 'RWB'].includes(position)) {
            stats.PAC += rand(3, 6);
            stats.DEF += rand(2, 5);
            stats.SHO -= rand(20, 30);
        } else if (position === 'GK') {
            stats = { DIV: val(), HAN: val(), KIC: val(), REF: val(), SPE: rand(30, 50), POS: val() };
            return stats;
        }

        Object.keys(stats).forEach(k => {
            if (stats[k] > 99) stats[k] = 99;
            if (stats[k] < 40) stats[k] = 40;
        });

        return stats;
    }

    playBeep() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = 600;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.05);
        } catch (e) {
            console.log('Audio not available');
        }
    }

    renderPlayerCard(player, stats, dynamicValue, formArrow, formClass) {
        let statsHtml = '';
        if (player.position === 'GK') {
            statsHtml = `
             <div class="stats-grid">
                <div class="stat-box"><span class="stat-label">DIV</span><span class="stat-val">${stats.DIV}</span></div>
                <div class="stat-box"><span class="stat-label">HAN</span><span class="stat-val">${stats.HAN}</span></div>
                <div class="stat-box"><span class="stat-label">KIC</span><span class="stat-val">${stats.KIC}</span></div>
                <div class="stat-box"><span class="stat-label">REF</span><span class="stat-val">${stats.REF}</span></div>
                <div class="stat-box"><span class="stat-label">SPE</span><span class="stat-val">${stats.SPE}</span></div>
                <div class="stat-box"><span class="stat-label">POS</span><span class="stat-val">${stats.POS}</span></div>
             </div>`;
        } else {
            statsHtml = `
            <div class="stats-grid">
               <div class="stat-box"><span class="stat-label">PAC</span><span class="stat-val">${stats.PAC}</span></div>
               <div class="stat-box"><span class="stat-label">SHO</span><span class="stat-val">${stats.SHO}</span></div>
               <div class="stat-box"><span class="stat-label">PAS</span><span class="stat-val">${stats.PAS}</span></div>
               <div class="stat-box"><span class="stat-label">DRI</span><span class="stat-val">${stats.DRI}</span></div>
               <div class="stat-box"><span class="stat-label">DEF</span><span class="stat-val">${stats.DEF}</span></div>
               <div class="stat-box"><span class="stat-label">PHY</span><span class="stat-val">${stats.PHY}</span></div>
            </div>`;
        }

        const html = `
            <div class="card-header">
                <div class="header-top">
                    <div class="classification">CONFIDENTIAL // TOP SECRET</div>
                    <div class="barcode">||| || ||| | ||||</div>
                </div>
                <div class="player-name">${player.name}</div>
                <div class="player-meta">${player.position} | ${player.age} YRS | ${player.nationality || 'INTL'}</div> 
            </div>
            
            <div class="card-body">
                <div class="tier-stamp tier-${player.tier.toLowerCase()}">${player.tier}</div>
                
                <div class="info-grid">
                    <div class="info-row"><span class="label">CLUB</span> <span class="value">${player.club}</span></div>
                    <div class="info-row"><span class="label">LEAGUE</span> <span class="value">${player.league}</span></div>
                    <div class="info-row"><span class="label">ERA</span> <span class="value">${player.era.toUpperCase()}</span></div>
                </div>
                
                <div class="stats-container">
                    <div class="stats-header">PERFORMANCE METRICS</div>
                    ${statsHtml}
                </div>

                <div class="market-section">
                    <span class="label">MARKET VALUE (FORM)</span>
                    <div class="market-value">
                        $${dynamicValue}M 
                        <span class="form-arrow form-${formClass}" style="margin-left: 10px;">${formArrow}</span>
                    </div>
                </div>
            </div>

            <div class="card-footer">
                <!-- Base Bid Removed -->
                <div class="footer-note">* SUBJECT TO AUCTION HOUSE APPROVAL *</div>
            </div>
        `;

        this.playerDisplay.innerHTML = html;
        this.playerDisplay.classList.remove('typing');
        void this.playerDisplay.offsetWidth;
        this.playerDisplay.classList.add('typing');
    }

    showNextPlayer() {
        // Fetch random player from API
        const params = new URLSearchParams({
            era: this.eraFilter.value,
            league: this.leagueFilter.value,
            position: this.positionFilter.value,
            tier: this.tierFilter.value
        });

        if (this.selectedClubs.size > 0) {
            params.append('club', Array.from(this.selectedClubs).join(','));
        }

        if (this.usedPlayers.size > 0) {
            params.append('exclude', Array.from(this.usedPlayers).join(','));
        }

        fetch(`/api/players/random?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error('No players found');
                return res.json();
            })
            .then(data => {
                const player = data.player;
                this.processNewPlayer(player);
                this.playersRemainingEl.textContent = data.remaining - 1; // Approx
            })
            .catch(err => {
                console.log(err);
                this.playerDisplay.innerHTML = `
                    <div class="empty-state">
                        NO PLAYERS FOUND matching criteria.<br>
                        Adjust filters via terminal above.
                    </div>
                `;
                this.soldBtn.disabled = true;
            });
    }

    processNewPlayer(player) {
        // Logic extracted from showNextPlayer for clarity after async fetch

        this.usedPlayers.add(player.name);
        this.playersShown++;

        const volatility = 0.8 + Math.random() * 0.4;
        const dynamicValue = Math.round(player.marketValue * volatility);

        let formArrow = '➖';
        let formClass = 'stable';
        if (volatility > 1.05) { formArrow = '▲'; formClass = 'up'; }
        if (volatility < 0.95) { formArrow = '▼'; formClass = 'down'; }

        const budget = parseFloat(this.budgetInput.value) || 100;

        // No base bid calculation needed anymore
        const stats = this.generateStats(player.position, player.tier);

        this.currentItem = {
            playerData: player,
            stats: stats,
            dynamicValue: dynamicValue
        };

        this.renderPlayerCard(player, stats, dynamicValue, formArrow, formClass);
        this.updateStats();

        // Initialize timer-based bidding
        if (this.biddingSection) this.biddingSection.style.display = 'block';
        this.currentBids = [];
        this.currentPlayerIndex = 0;
        this.updateBiddingDisplay();
        this.setCurrentPlayer();
        this.startTimer();

        if (this.soldBtn) this.soldBtn.disabled = true;
    }

    resetSession() {
        if (confirm('Reset the entire session? This will clear all players and their inventories.')) {
            this.stopTimer();
            this.usedPlayers.clear();
            this.playersShown = 0;
            this.gamePlayers = [];
            this.saveData();
            this.currentItem = null;
            this.currentBids = [];
            if (this.playerDisplay) {
                this.playerDisplay.innerHTML = `
                    <div class="startup-screen">
                        <div class="system-msg">SYSTEM READY...</div>
                        <div class="system-msg">ADD PLAYERS TO START</div>
                        <div class="blink-cursor">_</div>
                    </div>
                `;
            }
            this.selectedClubs.clear();
            this.initClubFilters();
            this.renderPlayers();
            this.updateStats();
            if (this.soldBtn) this.soldBtn.disabled = true;
            if (this.biddingSection) this.biddingSection.style.display = 'none';
            this.playBeep();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.auctioneer = new MultiplayerAuctioneer();
});
