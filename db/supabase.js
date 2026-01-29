require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_supabase_url')) {
    console.warn('⚠️  Supabase Not Configured. Running in Offline Mode (Local Data).');
    supabase = null;
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.warn('⚠️  Supabase Initialization Failed. Running in Offline Mode.', e.message);
        supabase = null;
    }
}

module.exports = supabase;
