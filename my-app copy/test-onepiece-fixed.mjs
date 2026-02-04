#!/usr/bin/env node

/**
 * TCGCodex One Piece - Using Correct Game ID
 */

const TCGCODEX_API_URL = 'https://tcgcodex.com/api/v1';
const API_KEY = '653|mta63K5x3DZdgmXfu3eSTKNJLgmODvwuekDhWSLP752d3b60';

console.log('\n╔══════════════════════════════════════╗');
console.log('║   TCGCodex One Piece - Fixed        ║');
console.log('╚══════════════════════════════════════╝\n');

// Test 1: One Piece with CORRECT game ID (5)
console.log('Test 1: One Piece with game=5 (Correct ID)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url1 = `${TCGCODEX_API_URL}/cards?search=luffy&game=5&limit=5`;
  console.log('URL:', url1);
  console.log('Game ID: 5 (One Piece)\n');
  
  const response1 = await fetch(url1, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response1.status);
  const data1 = await response1.json();
  
  if (data1.data && data1.data.length > 0) {
    console.log(`✅ Found ${data1.data.length} cards:\n`);
    
    data1.data.forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name || 'Unknown'}`);
      console.log(`   Game: ${attrs.game?.name || 'Unknown'}`);
      console.log(`   Set: ${attrs.set?.name || 'Unknown'}`);
      console.log(`   Number: ${attrs.number || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('Response:', JSON.stringify(data1, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

// Test 2: Try without search parameter (just game filter)
console.log('\nTest 2: Get any One Piece cards (no search)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url2 = `${TCGCODEX_API_URL}/cards?game=5&limit=5`;
  console.log('URL:', url2);
  
  const response2 = await fetch(url2, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response2.status);
  const data2 = await response2.json();
  
  if (data2.data && data2.data.length > 0) {
    console.log(`✅ Found ${data2.data.length} One Piece cards:\n`);
    
    data2.data.forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name || 'Unknown'}`);
      console.log(`   Set: ${attrs.set?.name || 'Unknown'}`);
      console.log('');
    });
  } else {
    console.log('❌ No One Piece cards in database');
    console.log('Response:', JSON.stringify(data2, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

// Test 3: Try with different search parameter name
console.log('\nTest 3: Try "name" parameter instead of "search"');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url3 = `${TCGCODEX_API_URL}/cards?name=luffy&game=5&limit=5`;
  console.log('URL:', url3);
  
  const response3 = await fetch(url3, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response3.status);
  const data3 = await response3.json();
  
  if (data3.data && data3.data.length > 0) {
    console.log(`✅ Found ${data3.data.length} cards:\n`);
    
    data3.data.forEach((card, i) => {
      const attrs = card.attributes || {};
      console.log(`${i + 1}. ${attrs.name || 'Unknown'}`);
      console.log(`   Game: ${attrs.game?.name || 'Unknown'}`);
      console.log('');
    });
  } else {
    console.log('Response:', JSON.stringify(data3, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

// Test 4: Check what parameters the API actually accepts
console.log('\nTest 4: Get One Piece sets');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const url4 = `${TCGCODEX_API_URL}/sets?game=5`;
  console.log('URL:', url4);
  
  const response4 = await fetch(url4, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  const data4 = await response4.json();
  
  if (data4.data && data4.data.length > 0) {
    console.log(`✅ Found ${data4.data.length} One Piece sets:\n`);
    data4.data.forEach((set, i) => {
      const attrs = set.attributes || {};
      console.log(`${i + 1}. ${attrs.name || 'Unknown'}`);
    });
  } else {
    console.log('❌ No One Piece sets found');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n═══════════════════════════════════════');
console.log('🎯 Key Findings:');
console.log('═══════════════════════════════════════');
console.log('One Piece Game ID: 5 ✅');
console.log('Share the output to see if One Piece');
console.log('cards are actually in TCGCodex database!');
console.log('═══════════════════════════════════════\n');
