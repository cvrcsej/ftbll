require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const supabase = require('./db/supabase');
const PLAYERS_DATABASE = require('./data/players');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files from root

// Vercel specific: Handle root route explicitly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});



// API: Get Players with Filters
app.get('/api/players', async (req, res) => {
    try {
        const { era, league, position, tier, club } = req.query;

        let query = supabase.from('players').select('*');

        if (era && era !== 'all') query = query.eq('era', era);
        if (league && league !== 'all') query = query.eq('league', league);
        if (tier && tier !== 'all') query = query.eq('tier', tier);

        if (club) {
            const clubs = Array.isArray(club) ? club : club.split(',');
            query = query.in('club', clubs);
        }

        if (position && position !== 'all') {
            const posMap = {
                'GK': ['GK'],
                'DEF': ['CB', 'LB', 'RB', 'LWB', 'RWB'],
                'MID': ['CDM', 'CM', 'CAM', 'RM', 'LM'],
                'FWD': ['ST', 'CF', 'RW', 'LW', 'SS']
            };
            const allowedPositions = posMap[position] || [];
            query = query.in('position', allowedPositions);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Map back to camelCase for frontend compatibility if needed, 
        // or ensure frontend handles snake_case. 
        // The migration script mapped camelCase -> snake_case db columns.
        // We should map back or update frontend. Let's map back for now to minimize frontend changes.
        const mappedData = data.map(p => ({
            ...p,
            marketValue: p.market_value,
            playStyle: p.play_style
        }));

        res.json(mappedData);
    } catch (err) {
        console.error('Error fetching players:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Get Random Player (Target)
app.get('/api/players/random', (req, res) => {
    let filteredPlayers = PLAYERS_DATABASE;
    const { era, league, position, tier, club, exclude } = req.query;

    // Apply same filters
    if (era && era !== 'all') filteredPlayers = filteredPlayers.filter(p => p.era === era);
    if (league && league !== 'all') filteredPlayers = filteredPlayers.filter(p => p.league === league);
    if (position && position !== 'all') {
        const posMap = {
            'GK': ['GK'],
            'DEF': ['CB', 'LB', 'RB', 'LWB', 'RWB'],
            'MID': ['CDM', 'CM', 'CAM', 'RM', 'LM'],
            'FWD': ['ST', 'CF', 'RW', 'LW', 'SS']
        };
        const allowedPositions = posMap[position] || [];
        filteredPlayers = filteredPlayers.filter(p => allowedPositions.includes(p.position));
    }
    if (tier && tier !== 'all') filteredPlayers = filteredPlayers.filter(p => p.tier === tier);
    if (club) {
        const clubs = Array.isArray(club) ? club : club.split(',');
        filteredPlayers = filteredPlayers.filter(p => clubs.includes(p.club));
    }

    // Exclude players (e.g., already used)
    if (exclude) {
        const excludedNames = Array.isArray(exclude) ? exclude : exclude.split(',');
        filteredPlayers = filteredPlayers.filter(p => !excludedNames.includes(p.name));
    }

    if (filteredPlayers.length === 0) {
        return res.status(404).json({ message: 'No players found matching criteria' });
    }

    const randomIndex = Math.floor(Math.random() * filteredPlayers.length);
    res.json({
        player: filteredPlayers[randomIndex],
        remaining: filteredPlayers.length
    });
});

// API: Get All Clubs
app.get('/api/meta/clubs', async (req, res) => {
    try {
        // Fetch distinct clubs
        // Supabase doesn't have a direct .distinct() in JS client easily without .csv() or raw SQL often, 
        // but creating a view or just selecting 'club' and processing set is fine for small DBs.
        // For larger DBs, use .rpc 'get_unique_clubs'
        const { data, error } = await supabase.from('players').select('club');
        if (error) throw error;

        const clubs = [...new Set(data.map(p => p.club))].sort();
        res.json(clubs);
    } catch (err) {
        console.error('Error fetching clubs:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
