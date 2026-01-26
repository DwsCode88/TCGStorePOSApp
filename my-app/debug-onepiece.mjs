#!/usr/bin/env node

/**
 * TCGCodex One Piece Search Debug
 * Ready to run - API key included
 */

const TCGCODEX_API_URL = 'https://tcgcodex.com/api/v1';
const API_KEY = '653|mta63K5x3DZdgmXfu3eSTKNJLgmODvwuekDhWSLP752d3b60';

console.log('\n╔══════════════════════════════════════╗');
console.log('║   TCGCodex One Piece Debug          ║');
console.log('╚══════════════════════════════════════╝\n');

console.log(`✓ API Key: ${API_KEY.substring(0, 15)}...\n`);

// Test 1: Pokemon search (baseline)
console.log('Test 1: Pokemon search (baseline)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url1 = `${TCGCODEX_API_URL}/cards?search=pikachu&game=pokemon&limit=1`;
  console.log('URL:', url1);
  
  const response1 = await fetch(url1, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response1.status);
  const data1 = await response1.json();
  
  if (data1.data && data1.data[0]) {
    const card = data1.data[0];
    const attrs = card.attributes || {};
    console.log('Result:', attrs.name || 'No name');
    console.log('Game:', attrs.game?.name || 'Unknown');
    console.log('Set:', attrs.set?.name || 'Unknown');
    console.log('✅ Pokemon works!\n');
  } else {
    console.log('❌ No results\n');
  }
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

// Test 2: One Piece search
console.log('Test 2: One Piece search');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url2 = `${TCGCODEX_API_URL}/cards?search=luffy&limit=3`;
  console.log('URL:', url2);
  console.log('Note: No game filter - searching all games\n');
  
  const response2 = await fetch(url2, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response2.status);
  const data2 = await response2.json();
  
  if (data2.data && data2.data.length > 0) {
    console.log(`Found ${data2.data.length} results:\n`);
    
    data2.data.forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name}`);
      console.log(`   Game: ${attrs.game?.name || 'Unknown'}`);
      console.log(`   Set: ${attrs.set?.name || 'Unknown'}`);
      console.log(`   Number: ${attrs.number || 'N/A'}`);
      console.log(`   Image: ${attrs.image ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Try to get prices for first card
    console.log('Fetching prices for first card...');
    const firstCardId = data2.data[0].id;
    const priceUrl = `${TCGCODEX_API_URL}/cards/${firstCardId}/prices`;
    
    const priceResponse = await fetch(priceUrl, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      console.log('Price data:', JSON.stringify(priceData, null, 2));
    } else {
      console.log('❌ Could not fetch prices (status:', priceResponse.status, ')');
    }
    
  } else {
    console.log('❌ No results found\n');
  }
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

// Test 3: Get available games
console.log('\nTest 3: Get available games');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url3 = `${TCGCODEX_API_URL}/games`;
  console.log('URL:', url3);
  
  const response3 = await fetch(url3, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  const data3 = await response3.json();
  
  if (data3.data) {
    console.log('Available games:');
    data3.data.forEach(game => {
      const attrs = game.attributes || {};
      console.log(`  - ${attrs.name || 'Unknown'} (ID: ${game.id})`);
    });
  } else {
    console.log('Games:', data3);
  }
  console.log('');
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

// Test 4: One Piece with game filter (if we know the game ID)
console.log('\nTest 4: One Piece with game=3 (One Piece game ID)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url4 = `${TCGCODEX_API_URL}/cards?search=luffy&game=3&limit=3`;
  console.log('URL:', url4);
  
  const response4 = await fetch(url4, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response4.status);
  const data4 = await response4.json();
  
  if (data4.data && data4.data.length > 0) {
    console.log(`✅ Found ${data4.data.length} One Piece cards:\n`);
    
    data4.data.forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name}`);
      console.log(`   Set: ${attrs.set?.name || 'Unknown'}`);
    });
  } else {
    console.log('❌ No results or wrong game ID\n');
  }
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

console.log('═══════════════════════════════════════');
console.log('Debug complete! Share this output.');
console.log('═══════════════════════════════════════\n');
