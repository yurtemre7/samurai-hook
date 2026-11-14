import { describe, expect, it } from 'vitest';
import { fill } from '../src/ui/hud';

describe('fill', () => {
  it('replaces named placeholders', () => {
    expect(fill('ROUND {round}! {fish}', { round: 3, fish: 'EEL' })).toBe('ROUND 3! EEL');
  });
  it('replaces repeated placeholders', () => {
    expect(fill('{a}{a}', { a: 'x' })).toBe('xx');
  });
  it('leaves unknown placeholders alone', () => {
    expect(fill('{gold} G {nope}', { gold: 5 })).toBe('5 G {nope}');
  });
  it('handles templates without placeholders', () => {
    expect(fill('K.O.!', {})).toBe('K.O.!');
  });
});
