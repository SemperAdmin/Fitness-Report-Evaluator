
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testList() {
    const email = 'Furby203824';
    const url = `http://localhost:3000/api/evaluations/list?email=${email}`;
    
    console.log(`Fetching ${url}...`);
    try {
        const resp = await fetch(url);
        console.log('Status:', resp.status);
        const data = await resp.json();
        console.log('Data count:', data.evaluations ? data.evaluations.length : 'N/A');
        
        if (data.evaluations && data.evaluations.length > 0) {
            const stats = {};
            data.evaluations.forEach(e => {
                const r = e.marineInfo?.rank || 'Unknown';
                stats[r] = (stats[r] || 0) + 1;
            });
            console.log('Rank distribution in API response:', stats);
            console.log('Sample evaluation:', JSON.stringify(data.evaluations[0], null, 2));
        } else {
            console.log('Response body:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}

testList();
