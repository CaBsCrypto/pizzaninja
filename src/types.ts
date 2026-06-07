export enum PizzaType {
  Pepperoni = 'Pepperoni',
  Veggie = 'Vegetariana',
  FourCheese = 'Cuatro Quesos',
  Pineapple = 'Piña', // Obstacle
  Burnt = 'Pizza Quemada', // Obstacle
}

export enum PizzaState {
  Whole = 'Whole',     // Pizza Completa (100% circular)
  Half = 'Half',       // Media Pizza (Semicírculo)
}

export interface GameItem {
  id: number;
  type: PizzaType;
  state: PizzaState;   // Whole or Half
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isSliced: boolean;
  sliceAngle: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  points: number;
  label: string;
  cutsMade?: number;   // Track how many cuts have been made
  lastCutTime?: number; // Cooldown timestamp between consecutive cuts
  gravity?: number;     // Custom falling speed rate
  isPreSlicing?: boolean;
  preSliceFrames?: number;
  preSliceMaxFrames?: number;
  swipeAngle?: number;
  speedRatio?: number;
  cutPointX?: number;
  cutPointY?: number;
  multiplier?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  gravity: number;
  emoji?: string;
  isTopping?: boolean;
  isGlow?: boolean;    // Custom glowing shockwave ring indicator
  maxSize?: number;   // Maximum scale radius of expanding shockwave
  isStain?: boolean;  // Screen splash stain effect
}

export interface SlicedPiece {
  id: number;
  type: PizzaType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;     // Pizza source radius
  rotation: number;
  rotationSpeed: number;
  sliceAngle: number;
  startAngle: number; // For drawing custom pizza sector slices
  endAngle: number;   // For drawing custom pizza sector slices
  alpha: number;
  color: string;
  gravity?: number;   // Custom falling speed rate for satisfying slice drops
}

export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export interface SlashReplayPoint {
  x: number;
  y: number;
  t: number;
  isStart?: boolean;
}

export interface ScoreRecord {
  name: string;
  score: number;
  timestamp: number;
  duration?: number;
  slashes?: number;
  slashHistory?: SlashReplayPoint[];
  pubkey?: string;
  domain?: string;
  txHash?: string;
  verified?: boolean;
  mode?: string;
}

