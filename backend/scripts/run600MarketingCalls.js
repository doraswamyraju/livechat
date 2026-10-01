import https from 'https';

const token = process.argv[2] || "EAASpP6pkZCeUBSgZCaoczZBPhHC2LRvaHlqNSV2Sis44xFiCR51D2MnfljnW5gfg2iDSOVPQC5QHdj1Vw7aywRtsgdA6MCDL1LwHrilarGmtKFVv5jsfH1bRKLpScg69PFg82gdk7RDZAk3ZAJl7ZAkPlLczg3pKuItUA7pbyZCkR5EzmMdoXZBmiRG5RHeGmqrLO5KujRAb2RB3YGf8WtbNLWuQD65Oa0Ga";

function apiRequest(path) {
  return new Promise((resolve) => {
    const url = new URL(`https://graph.facebook.com/v20.0${path}`);
    url.searchParams.append('access_token', token);

    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 500, error: err.message }));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('====================================================');
  console.log('🚀 MANACITY (APP ID 1311990813621733) MARKETING API BATCH');
  console.log('====================================================\n');

  console.log('Step 1: Validating Token Attribution...');
  const debugRes = await apiRequest(`/debug_token?input_token=${token}`);
  if (debugRes.status === 200 && debugRes.data?.data) {
    const d = debugRes.data.data;
    console.log(`✅ Verified App: ${d.application} (App ID: ${d.app_id})`);
    console.log(`✅ Valid: ${d.is_valid} | User ID: ${d.user_id}\n`);
  }

  const adAccounts = ['act_798755951361507', 'act_487826544356411', 'act_1835346447190767'];
  console.log(`🎯 Cycling calls across 3 verified Ad Accounts:`, adAccounts);

  const targetCalls = 600;
  let totalSuccessful = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  const endpoints = [
    (acc) => `/${acc}?fields=id,name,account_status,currency,amount_spent`,
    (acc) => `/${acc}/campaigns?fields=id,name,status,objective`,
    (acc) => `/${acc}/adsets?fields=id,name,status,daily_budget`,
    (acc) => `/${acc}/ads?fields=id,name,status,creative`,
    (acc) => `/${acc}/insights?date_preset=last_90d&fields=impressions,clicks,spend,cpc,cpm`
  ];

  let round = 1;
  while (totalSuccessful < targetCalls) {
    for (const acc of adAccounts) {
      for (const getEndpoint of endpoints) {
        if (totalSuccessful >= targetCalls) break;

        const path = getEndpoint(acc);
        let attempt = 0;
        let success = false;

        while (attempt < 3 && !success) {
          attempt++;
          const res = await apiRequest(path);

          if (res.status === 200 && !res.data?.error) {
            totalSuccessful++;
            success = true;
            process.stdout.write(`\r[Progress: ${totalSuccessful}/${targetCalls} calls] Round ${round} | ${acc} | Status: 200 OK ✅`);
          } else {
            const errCode = res.data?.error?.code;
            if (errCode === 17 || errCode === 613 || res.status === 429) {
              process.stdout.write(`\r⚠️ Rate limit reached on ${acc}. Throttling 3s... `);
              await sleep(3000);
            } else {
              totalErrors++;
              break;
            }
          }
          // Pacing delay (50ms) to ensure smooth throughput across all accounts
          await sleep(50);
        }
      }
    }
    round++;
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log('\n\n====================================================');
  console.log(`🎉 ALL ${totalSuccessful} META MARKETING API CALLS COMPLETED!`);
  console.log(`⏱️ Duration: ${durationSec}s`);
  console.log(`✅ App ID: 1311990813621733 (ManaCity)`);
  console.log(`✅ Successful Calls: ${totalSuccessful}`);
  console.log(`❌ Failed Calls: ${totalErrors}`);
  console.log(`📊 Success Rate: ${((totalSuccessful / (totalSuccessful + totalErrors)) * 100).toFixed(1)}%`);
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal Script Error:', err);
});
