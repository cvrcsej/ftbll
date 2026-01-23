const supabase = require('../db/supabase');

// Configuration
const TARGET_COUNT = 1500; // Total players to generate

const CLUBS = [
    // Premier League (High Budget)
    { name: 'Manchester City', tier: 'S', budget: 'high' },
    { name: 'Arsenal', tier: 'S', budget: 'high' },
    { name: 'Liverpool', tier: 'S', budget: 'high' },
    { name: 'Chelsea', tier: 'A', budget: 'high' },
    { name: 'Man Utd', tier: 'A', budget: 'high' },
    { name: 'Tottenham', tier: 'A', budget: 'med' },
    { name: 'Newcastle', tier: 'A', budget: 'med' },
    { name: 'Aston Villa', tier: 'B', budget: 'med' },
    { name: 'West Ham', tier: 'B', budget: 'med' },
    { name: 'Brighton', tier: 'B', budget: 'med' },
    { name: 'Everton', tier: 'C', budget: 'low' },
    { name: 'Wolves', tier: 'C', budget: 'low' },

    // La Liga
    { name: 'Real Madrid', tier: 'S', budget: 'high' },
    { name: 'Barcelona', tier: 'S', budget: 'high' },
    { name: 'Atletico Madrid', tier: 'A', budget: 'high' },
    { name: 'Sevilla', tier: 'B', budget: 'med' },
    { name: 'Real Sociedad', tier: 'B', budget: 'med' },
    { name: 'Valencia', tier: 'C', budget: 'low' },

    // Bundesliga
    { name: 'Bayern Munich', tier: 'S', budget: 'high' },
    { name: 'Dortmund', tier: 'A', budget: 'high' },
    { name: 'Leverkusen', tier: 'A', budget: 'med' },
    { name: 'RB Leipzig', tier: 'B', budget: 'med' },

    // Serie A
    { name: 'Inter Milan', tier: 'A', budget: 'high' },
    { name: 'AC Milan', tier: 'A', budget: 'high' },
    { name: 'Juventus', tier: 'A', budget: 'high' },
    { name: 'Napoli', tier: 'B', budget: 'med' },
    { name: 'Roma', tier: 'B', budget: 'med' },

    // Ligue 1
    { name: 'PSG', tier: 'S', budget: 'high' },
    { name: 'Marseille', tier: 'B', budget: 'med' },
    { name: 'Monaco', tier: 'B', budget: 'med' },
    { name: 'Lille', tier: 'C', budget: 'low' }
];

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
const FIRST_NAMES = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
    'Matteo', 'Marco', 'Luca', 'Alessandro', 'Giuseppe', 'Antonio',
    'Pierre', 'Lucas', 'Leo', 'Gabriel', 'Louis', 'Arthur',
    'Carlos', 'Jorge', 'Luis', 'Miguel', 'Jose', 'Fernando',
    'Hans', 'Lukas', 'Maximilian', 'Felix', 'Elias', 'Paul',
    'Liam', 'Noah', 'Oliver', 'Mason', 'Logan', 'Ethan'
];
const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi',
    'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert',
    'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira',
    'Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber',
    'Wilson', 'Anderson', 'Taylor', 'Moore', 'Jackson'
];

const PLAY_STYLES = [
    'Speedster', 'Tank', 'Maestro', 'Poacher', 'Wall', 'Engine', 'Technician', 'Leader', 'Prospect', 'Veteran'
];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayer() {
    const club = getRandom(CLUBS);
    const position = getRandom(POSITIONS);

    // Determine quality based on club tier + minimal randomness
    let baseValue = 10;
    if (club.tier === 'S') baseValue = 80;
    if (club.tier === 'A') baseValue = 50;
    if (club.tier === 'B') baseValue = 30;
    if (club.tier === 'C') baseValue = 15;

    // Random variation
    const value = baseValue + Math.floor(Math.random() * 40); // 80 -> 80-120 (S tier)

    let tier = 'C';
    if (value >= 100) tier = 'S';
    else if (value >= 60) tier = 'A';
    else if (value >= 30) tier = 'B';

    let age = 17 + Math.floor(Math.random() * 20); // 17-37

    // Generate Name
    const firstName = getRandom(FIRST_NAMES);
    const lastName = getRandom(LAST_NAMES);
    const name = `${firstName} ${lastName}`;

    return {
        name: name,
        club: club.name,
        era: 'modern', // Keeping it simple
        league: 'International', // Simplifying for now, or could map club -> league
        position: position,
        age: age,
        market_value: value,
        tier: tier,
        play_style: getRandom(PLAY_STYLES)
    };
}

// Fix Leagues
function getLeague(clubName) {
    const c = CLUBS.find(c => c.name === clubName);
    if (!c) return 'International';
    // Simple heuristic mapping
    if (['Manchester', 'Arsenal', 'Liverpool', 'Chelsea', 'Tottenham', 'Newcastle', 'Aston', 'West', 'Brighton', 'Everton', 'Wolves'].some(s => clubName.includes(s))) return 'Premier League';
    if (['Real', 'Barcelona', 'Atletico', 'Sevilla', 'Valencia'].some(s => clubName.includes(s))) return 'La Liga';
    if (['Bayern', 'Dortmund', 'Leverkusen', 'Leipzig'].some(s => clubName.includes(s))) return 'Bundesliga';
    if (['Inter', 'Milan', 'Juventus', 'Napoli', 'Roma'].some(s => clubName.includes(s))) return 'Serie A';
    if (['PSG', 'Marseille', 'Monaco', 'Lille'].some(s => clubName.includes(s))) return 'Ligue 1';
    return 'International';
}

async function run() {
    console.log(`Generating ${TARGET_COUNT} players...`);

    const players = [];
    for (let i = 0; i < TARGET_COUNT; i++) {
        const p = generatePlayer();
        p.league = getLeague(p.club);
        players.push(p);
    }

    console.log('Uploading to Supabase...');

    const chunkSize = 100;
    for (let i = 0; i < players.length; i += chunkSize) {
        const chunk = players.slice(i, i + chunkSize);
        const { error } = await supabase.from('players').insert(chunk);
        if (error) console.error('Error:', error);
        else console.log(`Inserted ${i + chunk.length}/${TARGET_COUNT}`);
    }

    console.log('Done!');
}

run();
