#!/usr/bin/env node

/**
 * Test JustTCG API (No SDK needed)
 * 
 * Usage:
 *   JUSTTCG_API_KEY=your_key node test-api.mjs
 * 
 * Or set in .env.local and run:
 *   node test-api.mjs
 */

const JUSTTCG_API_URL = 'https://api.justtcg.com/v1';
const API_KEY = process.env.JUSTTCG_API_KEY || process.env.NEXT_PUBLIC_JUSTTCG_API_KEY;

console.log('\n╔══════════════════════════════════════╗');
console.log('║   JustTCG API Connection Test       ║');
console.log('╚══════════════════════════════════════╝\n');

if (!API_KEY) {
  console.error('❌ ERROR: API key not set!\n');
  console.log('Set your API key in one of these ways:\n');
  console.log('1. Environment variable:');
  console.log('   export NEXT_PUBLIC_JUSTTCG_API_KEY=your_key\n');
  console.log('2. Run with key:');
  console.log('   JUSTTCG_API_KEY=your_key node test-api.mjs\n');
  console.log('3. Add to .env.local:');
  console.log('   NEXT_PUBLIC_JUSTTCG_API_KEY=your_key\n');
  console.log('Get your API key: https://justtcg.com/dashboard\n');
  process.exit(1);
}

console.log(`✓ API Key: ${API_KEY.substring(0, 10)}...\n`);

async function makeRequest(endpoint, params = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  const url = `${JUSTTCG_API_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: List Games
  console.log('Test 1: Fetching available games...');
  try {
    const response = await makeRequest('/games');
    if (response.data && response.data.length > 0) {
      console.log(`✅ PASS - Found ${response.data.length} games`);
      console.log(`   Games: ${response.data.map(g => g.slug).slice(0, 5).join(', ')}...\n`);
      passed++;
    } else {
      console.log('❌ FAIL - No games returned\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failed++;
  }

  // Test 2: Search Cards
  console.log('Test 2: Searching for "Charizard" in Pokémon...');
  try {
    const response = await makeRequest('/cards', {
      q: 'charizard',
      game: 'pokemon',
      limit: 5,
    });

    if (response.data && response.data.length > 0) {
      console.log(`✅ PASS - Found ${response.data.length} cards`);
      const firstCard = response.data[0];
      console.log(`   First result: "${firstCard.name}" from ${firstCard.setName}`);
      console.log(`   Card ID: ${firstCard.id}`);
      if (firstCard.variants && firstCard.variants.length > 0) {
        console.log(`   Variants: ${firstCard.variants.length}`);
        console.log(`   Price: $${firstCard.variants[0].price || 0}\n`);
      }
      passed++;
    } else {
      console.log('❌ FAIL - No cards returned\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failed++;
  }

  // Test 3: Get Sets
  console.log('Test 3: Fetching Pokémon sets...');
  try {
    const response = await makeRequest('/sets', {
      game: 'pokemon',
      limit: 5,
    });

    if (response.data && response.data.length > 0) {
      console.log(`✅ PASS - Found ${response.data.length} sets`);
      console.log(`   Examples: ${response.data.map(s => s.name).slice(0, 3).join(', ')}\n`);
      passed++;
    } else {
      console.log('❌ FAIL - No sets returned\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failed++;
  }

  // Test 4: Check Rate Limits
  console.log('Test 4: Checking API metadata...');
  try {
    const response = await makeRequest('/games');
    if (response._metadata) {
      console.log('✅ PASS - Metadata retrieved');
      console.log(`   Plan: ${response._metadata.plan || 'unknown'}`);
      console.log(`   Requests used: ${response._metadata.requestsUsed || 'unknown'}`);
      console.log(`   Requests available: ${response._metadata.requestsAvailable || 'unknown'}\n`);
      passed++;
    } else {
      console.log('⚠️  WARN - No metadata in response\n');
      passed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failed++;
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 SUCCESS! Your JustTCG API is working!\n');
    console.log('Next steps:');
    console.log('1. Copy justtcg-working-client.ts to lib/justtcg/client.ts');
    console.log('2. Make sure .env.local has your API key');
    console.log('3. Run: npm run dev');
    console.log('4. Test: http://localhost:3000/intake\n');
    return 0;
  } else {
    console.log('⚠️  Some tests failed.\n');
    console.log('Common issues:');
    console.log('- Invalid API key (check https://justtcg.com/dashboard)');
    console.log('- Rate limit exceeded');
    console.log('- Network issues\n');
    return 1;
  }
}

runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  });
