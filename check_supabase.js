
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUserEvals() {
    const username = 'Furby203824';
    console.log(`Checking user "${username}" in Supabase...`);

    const { data: users, error: uErr } = await supabase
        .from('fit_users')
        .select('*')
        .eq('username', username);

    if (uErr) {
        console.error('User Error:', uErr);
        return;
    }

    if (!users || users.length === 0) {
        console.log(`No user found with username "${username}"`);
        return;
    }

    const user = users[0];
    console.log(`Found user: ID=${user.id}, rs_email="${user.rs_email}", rs_name="${user.rs_name}"`);

    console.log(`\nChecking evaluations for user_id="${user.id}"...`);
    const { data: evalsById, error: eErr1 } = await supabase
        .from('evaluations')
        .select('evaluation_id, marine_name, rs_email')
        .eq('user_id', user.id);

    if (eErr1) {
        console.error('Eval by ID error:', eErr1);
    } else {
        console.log(`Found ${evalsById.length} evaluations by user_id.`);
        const rankCounts = {};
        evalsById.forEach(e => {
            // Need to fetch more fields to check marine rank
        });
    }

    // Improved check with more fields
    console.log(`\nDetailed check for evaluations...`);
    const { data: fullEvals, error: eErr3 } = await supabase
        .from('evaluations')
        .select('evaluation_id, marine_name, marine_rank, rs_email, completed_date')
        .eq('user_id', user.id);

    if (eErr3) {
                console.error('Detailed Eval error:', eErr3);
            } else {
                const stats = {};
                let missingAvg = 0;
                fullEvals.forEach(e => {
                    const r = e.marine_rank || 'Unknown';
                    stats[r] = (stats[r] || 0) + 1;
                    if (e.fitrep_average === null || e.fitrep_average === undefined) {
                        missingAvg++;
                    }
                });
                console.log('Rank distribution:', stats);
                console.log('Total evaluations found:', fullEvals.length);
                console.log('Evaluations missing fitrep_average:', missingAvg);
                
                if (fullEvals.length > 0) {
            console.log('\nSample evaluation:');
            console.log(JSON.stringify(fullEvals[0], null, 2));
        }
    }

    if (user.rs_email) {
        console.log(`\nChecking evaluations for rs_email="${user.rs_email}"...`);
        const { data: evalsByEmail, error: eErr2 } = await supabase
            .from('evaluations')
            .select('evaluation_id, marine_name, rs_email')
            .eq('rs_email', user.rs_email);

        if (eErr2) console.error('Eval by email error:', eErr2);
        else console.log(`Found ${evalsByEmail.length} evaluations by rs_email.`);
    }
}

checkUserEvals();
