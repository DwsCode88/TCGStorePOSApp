#!/usr/bin/env node

/**
 * TCGCodex - Using CORRECT Parameters from Docs
 * card_name (not search)
 * game_id[] (not game)
 */

const TCGCODEX_API_URL = 'https://tcgcodex.com/api/v1';
const API_KEY = '653|mta63K5x3DZdgmXfu3eSTKNJLgmODvwuekDhWSLP752d3b60';

console.log('\n╔══════════════════════════════════════╗');
console.log('║   TCGCodex - CORRECT Parameters     ║');
console.log('╚══════════════════════════════════════╝\n');

// Test 1: One Piece Luffy - CORRECT
console.log('Test 1: One Piece "Luffy" - CORRECT PARAMS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url1 = `${TCGCODEX_API_URL}/cards?card_name=luffy&game_id[]=5`;
  console.log('URL:', url1);
  console.log('Params: card_name=luffy, game_id[]=5\n');
  
  const response1 = await fetch(url1, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response1.status);
  const data1 = await response1.json();
  
  if (data1.data && data1.data.length > 0) {
    console.log(`✅ Found ${data1.data.length} cards!\n`);
    
    data1.data.slice(0, 5).forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name}`);
      console.log(`   Game: ${attrs.game?.name}`);
      console.log(`   Set: ${attrs.set?.name}`);
      console.log(`   Number: ${attrs.number}`);
      console.log(`   Image: ${attrs.image || 'None'}`);
      console.log('');
    });
    
    // Get prices for first card
    console.log('Getting prices for first card...\n');
    const cardId = data1.data[0].id;
    const priceUrl = `${TCGCODEX_API_URL}/cards/${cardId}/prices`;
    
    const priceResp = await fetch(priceUrl, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    if (priceResp.ok) {
      const priceData = await priceResp.json();
      if (priceData.data && priceData.data.length > 0) {
        console.log('💰 Prices:');
        priceData.data.forEach(p => {
          const attrs = p.attributes || {};
          console.log(`   ${attrs.variant}: €${attrs.price || 'N/A'}`);
        });
      } else {
        console.log('❌ No prices available');
      }
    }
  } else {
    console.log('❌ No results');
    console.log(JSON.stringify(data1, null, 2));
  }
  console.log('');
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

// Test 2: Pokemon Pikachu - CORRECT
console.log('Test 2: Pokemon "Pikachu" - CORRECT PARAMS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url2 = `${TCGCODEX_API_URL}/cards?card_name=pikachu&game_id[]=1`;
  console.log('URL:', url2);
  console.log('Params: card_name=pikachu, game_id[]=1\n');
  
  const response2 = await fetch(url2, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response2.status);
  const data2 = await response2.json();
  
  if (data2.data && data2.data.length > 0) {
    console.log(`✅ Found ${data2.data.length} Pikachu cards!\n`);
    data2.data.slice(0, 3).forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name}`);
      console.log(`   Set: ${attrs.set?.name}`);
      console.log('');
    });
  } else {
    console.log('❌ No results');
  }
  console.log('');
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

// Test 3: All One Piece cards (no name filter)
console.log('Test 3: All One Piece cards (first 5)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url3 = `${TCGCODEX_API_URL}/cards?game_id[]=5`;
  console.log('URL:', url3);
  console.log('Params: game_id[]=5 (just get any One Piece cards)\n');
  
  const response3 = await fetch(url3, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response3.status);
  const data3 = await response3.json();
  
  if (data3.data && data3.data.length > 0) {
    console.log(`✅ Found ${data3.data.length} cards in response\n`);
    console.log('Total One Piece cards in DB:', data3.meta?.total || 'Unknown');
    console.log('\nFirst 5 cards:');
    data3.data.slice(0, 5).forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name} - ${attrs.set?.name}`);
    });
  } else {
    console.log('❌ No One Piece cards in database');
  }
  console.log('');
} catch (error) {
  console.error('❌ Error:', error.message, '\n');
}

console.log('═══════════════════════════════════════');
console.log('🎯 Summary:');
console.log('═══════════════════════════════════════');
console.log('Using CORRECT parameters:');
console.log('  ✅ card_name (not search)');
console.log('  ✅ game_id[] (not game)');
console.log('Share this output!');
console.log('═══════════════════════════════════════\n');
