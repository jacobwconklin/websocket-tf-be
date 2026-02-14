import { generate } from 'random-words';

/**
 * Generate multiple random words for a wave
 * @param count - Number of words to generate
 * @returns Array of random words
 */
export function generateWordsForWave(count: number): string[] {
  const words: string[] = [];
  
  for (let i = 0; i < count; i++) {
    let randomWord: string | string[];
    if ((i + 1) % 10 === 0) {
        // ufo's are 10 + characters
        randomWord = generate({minLength: 10});
    } else if ((i + 1) % 4 === 0) {
        // satellites between 6 and 9 characters
        randomWord = generate({maxLength: 9, minLength: 6});
    } else {
        // asteroids are between 1 and 5 characters
        randomWord = generate({maxLength: 5});
    }
    // Convert to string if array returned
    const word = Array.isArray(randomWord) ? randomWord[0] : randomWord;
    words.push(word);
  }
  
  return words;
}

/**
 * Generate a random position for a danger spawning around Earth
 * @returns Object with x and y distance from Earth (in pixels or relative units)
 */
export function generateSpawnPosition(wave: number): { x: number; y: number } {
  // Generate a random angle (0 to 2π)
  const angle = Math.random() * Math.PI * 2;
  
  // Distance from Earth (spawn far from center)
  // Use a random distance between innerBound and outerbound units
  // innerBound at ~1/8 of screen, outerBound at edge (scaled by client)
  const innerBound = 350;
  const outerBound = 500;
  const distance = ( (Math.random() * (outerBound + (wave * 50) - innerBound)) + innerBound);
  
  // Convert polar to cartesian coordinates
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  
  return { x, y };
}
