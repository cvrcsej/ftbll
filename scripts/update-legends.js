const supabase = require('../db/supabase');

const LEGEND_VALUES = {
    "Pele": 200,
    "Diego Maradona": 190,
    "Johan Cruyff": 180,
    "Ronaldo Nazario": 170,
    "Zinedine Zidane": 160,
    "Franz Beckenbauer": 160,
    "Alfredo Di Stefano": 160,
    "Ferenc Puskas": 155,
    "Michel Platini": 150,
    "Marco van Basten": 150,
    "Ronaldinho": 150,
    "George Best": 145,
    "Gerd Muller": 145,
    "Eusebio": 145,
    "Bobby Charlton": 140,
    "Paolo Maldini": 140,
    "Lev Yashin": 130,
    "Thierry Henry": 130,
    "Lothar Matthaus": 130,
    "Franco Baresi": 125,
    "Roberto Baggio": 125,
    "Ruud Gullit": 125,
    "Kaka": 120,
    "Andres Iniesta": 120,
    "Xavi": 120,
    "Andrea Pirlo": 110,
    "Dennis Bergkamp": 110,
    "Alessandro Del Piero": 110,
    "Francesco Totti": 105,
    "Steven Gerrard": 100,
    "Frank Lampard": 100,
    "Paul Scholes": 100,
    "Patrick Vieira": 100,
    "Eric Cantona": 95,
    "David Beckham": 90,
    "Didier Drogba": 90,
    "Samuel Eto'o": 90,
    "Wayne Rooney": 90
};

async function updateLegends() {
    console.log('Fetching legends...');

    // Fetch all legends
    const { data: players, error } = await supabase
        .from('players')
        .select('*')
        .eq('era', 'legends');

    if (error) {
        console.error('Error fetching players:', error);
        return;
    }

    console.log(`Found ${players.length} legends. Updating values...`);

    let updatedCount = 0;

    for (const player of players) {
        let newValue = 0;

        // 1. Check specific map
        if (LEGEND_VALUES[player.name]) {
            newValue = LEGEND_VALUES[player.name];
        }
        // 2. Fallback based on Tier
        else {
            switch (player.tier) {
                case 'S': newValue = 135; break;
                case 'A': newValue = 85; break;
                case 'B': newValue = 55; break;
                case 'C': newValue = 35; break;
                default: newValue = 30;
            }
        }

        // Only update if value matches our new assignment (or is 0 currently)
        // Actually just force update to ensure consistency
        const { error: updateError } = await supabase
            .from('players')
            .update({ market_value: newValue })
            .eq('id', player.id);

        if (updateError) {
            console.error(`Failed to update ${player.name}:`, updateError);
        } else {
            // console.log(`Updated ${player.name} to €${newValue}M`);
            updatedCount++;
        }
    }

    console.log(`Successfully updated ${updatedCount} legends.`);
}

updateLegends();
